import { describe, it, expect } from 'vitest';
import type { TournamentConfig } from '@/types';
import { parseCsvRows, parsePlayersCsv, parseTeamsCsv } from '@/utils/csvImport';
import { IMPORT_FALLBACK_BASE_PRICE } from '@/constants/auction';

function cfg(mode: 'auction' | 'draft'): TournamentConfig {
  return {
    tournamentName: 'T', mode, totalTeams: 3, playersPerTeam: 4,
    budget: 3000, minBidReserve: 100, logoBase64: null,
    categories: [
      { name: 'Gold',   color: '#ffd700', bgColor: '#2a1f00', min: 0, max: 3, draftCount: 1 },
      { name: 'Silver', color: '#c0c0c0', bgColor: '#1a1a2a', min: 0, max: 4, draftCount: 1 },
      { name: 'Bronze', color: '#cd7f32', bgColor: '#1f0f00', min: 0, max: 4, draftCount: 1 },
    ],
  };
}

describe('parseCsvRows (RFC-4180)', () => {
  it('parses basic rows and CRLF endings', () => {
    expect(parseCsvRows('Name,Category\nAlice,Gold\nBob,Silver'))
      .toEqual([['Name', 'Category'], ['Alice', 'Gold'], ['Bob', 'Silver']]);
    expect(parseCsvRows('a,b\r\nc,d\r\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('handles quoted commas, escaped quotes, and embedded newlines', () => {
    expect(parseCsvRows('Name,Desc\n"Smith, John",Opener'))
      .toEqual([['Name', 'Desc'], ['Smith, John', 'Opener']]);
    expect(parseCsvRows('Name\n"He said ""hi"""')).toEqual([['Name'], ['He said "hi"']]);
    expect(parseCsvRows('Name,Bio\nAmy,"line1\nline2"')).toEqual([['Name', 'Bio'], ['Amy', 'line1\nline2']]);
  });

  it('strips a BOM, drops blank spacer lines, tolerates lone-CR and missing trailing newline', () => {
    expect(parseCsvRows('﻿Name\nAmy')).toEqual([['Name'], ['Amy']]);
    expect(parseCsvRows('a\n\nb')).toEqual([['a'], ['b']]);
    expect(parseCsvRows('a,b\rc,d')).toEqual([['a', 'b'], ['c', 'd']]);
    expect(parseCsvRows('x,y')).toEqual([['x', 'y']]);
    expect(parseCsvRows('')).toEqual([]);
    expect(parseCsvRows('a,,c')).toEqual([['a', '', 'c']]); // empty cells ≠ blank line
  });
});

describe('parsePlayersCsv', () => {
  it('imports valid rows, validates categories case-insensitively, reports invalid rows', () => {
    const r = parsePlayersCsv('Name,Category,Base Price\nAlice,gold,500\nBob,Platinum,400\nCara,SILVER,\n', cfg('auction'), []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.players.map((p) => [p.name, p.category, p.basePrice])).toEqual([
      ['Alice', 'Gold', 500],
      ['Cara', 'Silver', IMPORT_FALLBACK_BASE_PRICE], // blank base → fallback, with a warning
    ]);
    expect(r.invalidRows).toEqual([{ row: 3, reason: 'unknown category "Platinum"' }]);
    expect(r.warnings.some((w) => w.includes(String(IMPORT_FALLBACK_BASE_PRICE)))).toBe(true);
  });

  it('de-dupes against the existing pool and within the file (case-insensitive)', () => {
    const r = parsePlayersCsv('Name,Category\nAlice,Gold\nALICE,Silver\nBob,Bronze', cfg('auction'), [{ name: 'bob' }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.players.map((p) => p.name)).toEqual(['Alice']);
    expect(r.skippedDuplicates).toBe(2);
  });

  it('ignores base price entirely in draft mode (always 0, no warnings about it)', () => {
    const r = parsePlayersCsv('Name,Category,Base Price\nAlice,Gold,9999', cfg('draft'), []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.players[0].basePrice).toBe(0);
    expect(r.warnings).toHaveLength(0);
  });

  it('fails clearly without a Name column or with an empty file', () => {
    expect(parsePlayersCsv('Foo,Bar\n1,2', cfg('auction'), []).ok).toBe(false);
    expect(parsePlayersCsv('', cfg('auction'), []).ok).toBe(false);
  });
});

describe('parseTeamsCsv', () => {
  it('maps rows to team slots positionally and only overwrites non-empty cells', () => {
    const r = parseTeamsCsv('Team,Captain,Color\nLions,Ana,#ff0000\n,Ben,\nTigers,,notahex', cfg('auction'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.updates).toEqual([
      { name: 'Lions', captain: 'Ana', color: '#ff0000' },
      { captain: 'Ben' },          // blank name/colour left untouched
      { name: 'Tigers' },          // invalid colour ignored (with a warning)
    ]);
    expect(r.warnings.some((w) => w.toLowerCase().includes('hex'))).toBe(true);
  });

  it('ignores rows beyond totalTeams and reports them', () => {
    const r = parseTeamsCsv('Team\nA\nB\nC\nD\nE', cfg('auction')); // config has 3 teams
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.updates).toHaveLength(3);
    expect(r.ignoredRows).toBe(2);
  });

  it('fails clearly when neither a Team nor Captain column exists', () => {
    expect(parseTeamsCsv('Foo\nx', cfg('auction')).ok).toBe(false);
  });
});
