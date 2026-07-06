import type { Category, TournamentConfig } from '@/types';
import { getCategoryNames, getMode, IMPORT_FALLBACK_BASE_PRICE } from '@/constants/auction';
import { csvEscape } from '@/utils/export';

// ─── Field length caps (match the manual Setup forms) ─────────────────────────
const NAME_MAX = 60;
const DESC_MAX = 200;
const TEAM_NAME_MAX = 40;
const CAPTAIN_MAX = 40;

// ─── Header aliases (matched case-insensitively against the first CSV row) ─────
const PLAYER_NAME_ALIASES = new Set(['name', 'player', 'player name', 'playername', 'full name', 'fullname']);
const CATEGORY_ALIASES    = new Set(['category', 'cat', 'categories', 'tier', 'type', 'grade', 'class']);
const DESC_ALIASES        = new Set(['description', 'desc', 'bio', 'about', 'notes', 'note', 'info']);
const BASE_ALIASES        = new Set(['base', 'base price', 'baseprice', 'base pts', 'price', 'points', 'pts', 'value']);

const TEAM_NAME_ALIASES = new Set(['team', 'team name', 'teamname', 'franchise', 'franchise name', 'club', 'side', 'name']);
const CAPTAIN_ALIASES   = new Set(['captain', 'captain name', 'captainname', 'skipper', 'leader', 'cpt']);
const COLOR_ALIASES     = new Set(['color', 'colour', 'hex', 'hex color', 'team color', 'team colour']);

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// ─── CSV parsing (RFC-4180: quoted fields, "" escapes, embedded commas/newlines) ─

/**
 * Parse CSV text into a matrix of raw string cells. Handles quoted fields,
 * doubled-quote escapes, commas/newlines inside quotes, a leading BOM, and
 * CRLF / LF / lone-CR line endings. Fully blank lines are dropped.
 */
export function parseCsvRows(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = s.length;

  while (i < n) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++; // consume CRLF as one break
      row.push(field); rows.push(row); row = []; field = ''; i++; continue;
    }
    field += c; i++;
  }
  // Flush the final field/row (files without a trailing newline).
  row.push(field);
  rows.push(row);

  // Drop blank lines (a single empty cell) so trailing newlines don't add rows.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** First column index whose (trimmed, lowercased) header is one of `aliases`, else -1. */
function findCol(headers: string[], aliases: Set<string>): number {
  return headers.findIndex((h) => aliases.has(h));
}

/** True when every cell in the row is empty/whitespace (a spacer line). */
function isBlankRow(row: string[]): boolean {
  return row.every((c) => c.trim() === '');
}

// ─── Player import ────────────────────────────────────────────────────────────

export interface ParsedPlayer {
  name: string;
  description: string;
  category: Category;
  basePrice: number;
}

export type PlayerImportResult =
  | { ok: false; error: string }
  | {
      ok: true;
      players: ParsedPlayer[];
      skippedDuplicates: number;
      invalidRows: { row: number; reason: string }[];
      warnings: string[];
      totalDataRows: number;
    };

/**
 * Parse a player-pool CSV against the tournament config. Requires a header row
 * with at least a Name column; Category / Description / Base Price columns are
 * optional and matched by alias. Categories are validated against the configured
 * category names (case-insensitive); base price is ignored in draft mode. Names
 * already in `existingPlayers` (or repeated within the file) are de-duplicated.
 */
export function parsePlayersCsv(
  text: string,
  config: TournamentConfig,
  existingPlayers: { name: string }[],
): PlayerImportResult {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { ok: false, error: 'The file is empty.' };

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const nameCol = findCol(headers, PLAYER_NAME_ALIASES);
  if (nameCol === -1) {
    return { ok: false, error: 'No "Name" column found. The first row must be a header that includes a Name column.' };
  }
  const catCol  = findCol(headers, CATEGORY_ALIASES);
  const descCol = findCol(headers, DESC_ALIASES);
  const baseCol = findCol(headers, BASE_ALIASES);

  const isDraft   = getMode(config) === 'draft';
  const catNames  = getCategoryNames(config);
  const catLookup = new Map(catNames.map((name) => [name.toLowerCase(), name]));
  const defaultCat = catNames[0] ?? '';

  const players: ParsedPlayer[] = [];
  const invalidRows: { row: number; reason: string }[] = [];
  const warnings: string[] = [];
  const seen = new Set(existingPlayers.map((p) => p.name.trim().toLowerCase()));

  let skippedDuplicates = 0;
  let truncatedNames = 0;
  let defaultedCategory = 0;
  let defaultedBase = 0;
  let totalDataRows = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (isBlankRow(row)) continue; // silently skip spacer lines
    totalDataRows++;
    const lineNo = r + 1; // 1-based line number as seen in a spreadsheet
    const cell = (col: number) => (col >= 0 && col < row.length ? row[col].trim() : '');

    // Name (required)
    let name = cell(nameCol);
    if (!name) { invalidRows.push({ row: lineNo, reason: 'missing name' }); continue; }
    let nameTruncated = false;
    if (name.length > NAME_MAX) { name = name.slice(0, NAME_MAX); nameTruncated = true; }

    // Category (validated against config; defaulted when absent)
    let category = defaultCat;
    let catDefaulted = false;
    const rawCat = cell(catCol);
    if (catCol === -1 || rawCat === '') {
      catDefaulted = true;
    } else {
      const matched = catLookup.get(rawCat.toLowerCase());
      if (!matched) { invalidRows.push({ row: lineNo, reason: `unknown category "${rawCat}"` }); continue; }
      category = matched;
    }

    // Duplicate check (against existing pool + earlier rows in this file)
    const key = name.toLowerCase();
    if (seen.has(key)) { skippedDuplicates++; continue; }
    seen.add(key);

    // Only tally defaults/truncations for rows that actually make it into the pool.
    if (nameTruncated) truncatedNames++;
    if (catDefaulted) defaultedCategory++;

    // Base price (auction only)
    let basePrice = 0;
    if (!isDraft) {
      const rawBase = cell(baseCol);
      const parsed = Number(rawBase.replace(/[,\s]/g, ''));
      if (rawBase !== '' && Number.isFinite(parsed) && parsed >= 1) {
        basePrice = Math.round(parsed);
      } else {
        basePrice = IMPORT_FALLBACK_BASE_PRICE;
        defaultedBase++;
      }
    }

    // Description (optional)
    let description = cell(descCol);
    if (description.length > DESC_MAX) description = description.slice(0, DESC_MAX);

    players.push({ name, description, category, basePrice });
  }

  if (defaultedCategory > 0) {
    warnings.push(
      catCol === -1
        ? `No Category column — ${defaultedCategory} player${plural(defaultedCategory)} set to "${defaultCat}".`
        : `${defaultedCategory} player${plural(defaultedCategory)} had no category — set to "${defaultCat}".`
    );
  }
  if (!isDraft && defaultedBase > 0) {
    warnings.push(`${defaultedBase} player${plural(defaultedBase)} had no valid base price — set to ${IMPORT_FALLBACK_BASE_PRICE}.`);
  }
  if (truncatedNames > 0) {
    warnings.push(`${truncatedNames} long name${plural(truncatedNames)} shortened to ${NAME_MAX} characters.`);
  }

  return { ok: true, players, skippedDuplicates, invalidRows, warnings, totalDataRows };
}

// ─── Team / captain import ────────────────────────────────────────────────────

export interface ParsedTeamUpdate {
  name?: string;
  captain?: string;
  color?: string;
}

export type TeamImportResult =
  | { ok: false; error: string }
  | { ok: true; updates: ParsedTeamUpdate[]; ignoredRows: number; warnings: string[] };

/**
 * Parse a teams CSV into positional updates (row 1 → team slot 1, …). Requires a
 * header row with a Team and/or Captain column; Color is optional (validated as
 * hex). Only non-empty cells produce an update, so a captains-only sheet fills
 * captains without wiping names. Rows beyond `config.totalTeams` are ignored.
 */
export function parseTeamsCsv(text: string, config: TournamentConfig): TeamImportResult {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { ok: false, error: 'The file is empty.' };

  const headers  = rows[0].map((h) => h.trim().toLowerCase());
  const nameCol  = findCol(headers, TEAM_NAME_ALIASES);
  const capCol   = findCol(headers, CAPTAIN_ALIASES);
  const colorCol = findCol(headers, COLOR_ALIASES);
  if (nameCol === -1 && capCol === -1) {
    return { ok: false, error: 'No "Team" or "Captain" column found. The first row must be a header.' };
  }

  const total = config.totalTeams;
  const updates: ParsedTeamUpdate[] = [];
  const warnings: string[] = [];
  let badColors = 0;
  let ignoredRows = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (isBlankRow(row)) continue;
    const cell = (col: number) => (col >= 0 && col < row.length ? row[col].trim() : '');

    const update: ParsedTeamUpdate = {};
    const name    = cell(nameCol).slice(0, TEAM_NAME_MAX);
    const captain = cell(capCol).slice(0, CAPTAIN_MAX);
    const color   = cell(colorCol);
    if (name)    update.name = name;
    if (captain) update.captain = captain;
    if (color) {
      if (HEX_RE.test(color)) update.color = color;
      else badColors++;
    }

    // A row with data only in unrecognised columns yields nothing — don't consume a slot.
    if (update.name === undefined && update.captain === undefined && update.color === undefined) continue;

    if (updates.length >= total) { ignoredRows++; continue; }
    updates.push(update);
  }

  if (updates.length === 0) return { ok: false, error: 'No team rows with a name or captain were found.' };
  if (badColors > 0) {
    warnings.push(`${badColors} colour value${plural(badColors)} were not valid hex (e.g. #1a2b3c) and were ignored.`);
  }
  if (ignoredRows > 0) {
    warnings.push(`${ignoredRows} extra row${plural(ignoredRows)} beyond ${total} teams ${ignoredRows === 1 ? 'was' : 'were'} ignored.`);
  }

  return { ok: true, updates, ignoredRows, warnings };
}

// ─── Downloadable templates (pre-filled headers + illustrative rows) ──────────

/** A CSV template for the player pool, using the config's real category names. */
export function buildPlayersTemplate(config: TournamentConfig): string {
  const isDraft = getMode(config) === 'draft';
  const cats = getCategoryNames(config);
  const header = isDraft ? ['Name', 'Category', 'Description'] : ['Name', 'Category', 'Description', 'Base Price'];
  const example = (name: string, cat: string, desc: string, price: string) =>
    (isDraft ? [name, cat, desc] : [name, cat, desc, price]);
  const rows = [
    header,
    example('Player One',   cats[0] ?? 'Gold',                     'Right-hand top-order batter', '500'),
    example('Player Two',   cats[1] ?? cats[0] ?? 'Silver',        'Right-arm fast bowler',       '400'),
    example('Player Three', cats[cats.length - 1] ?? 'Bronze',     'All-rounder',                 '300'),
  ];
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

/** A CSV template with one row per team slot (Team, Captain, Color). */
export function buildTeamsTemplate(config: TournamentConfig): string {
  const rows: string[][] = [['Team', 'Captain', 'Color']];
  for (let i = 0; i < config.totalTeams; i++) {
    rows.push([`Team ${i + 1}`, '', '']);
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

function plural(n: number): string {
  return n === 1 ? '' : 's';
}
