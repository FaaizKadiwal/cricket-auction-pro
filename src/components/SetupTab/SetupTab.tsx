import { useState, useCallback, useId, useMemo, useEffect, useRef } from 'react';
import type { Team, Player, Category, ValidationError, ToastType } from '@/types';
import { getCategoryStyle, getCategoryNames, getTotalSlots, getMode } from '@/constants/auction';
import { validatePlayerForm, countByCategory } from '@/utils/auction';
import { formatPts } from '@/utils/format';
import { withAlpha } from '@/utils/color';
import { downloadFile } from '@/utils/export';
import {
  parsePlayersCsv, parseTeamsCsv, buildPlayersTemplate, buildTeamsTemplate,
  type PlayerImportResult, type TeamImportResult,
} from '@/utils/csvImport';
import { useTournament } from '@/context/TournamentContext';
import { ImageUpload } from '@/components/ImageUpload/ImageUpload';
import { Avatar } from '@/components/Avatar/Avatar';
import { Icon } from '@/components/Icon/Icon';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import styles from './SetupTab.module.css';

// A successfully-parsed import awaiting the operator's confirmation.
type PlayerImportSuccess = Extract<PlayerImportResult, { ok: true }>;
type TeamImportSuccess = Extract<TeamImportResult, { ok: true }>;

// ─── Team Card ────────────────────────────────────────────────────────────────

interface TeamCardProps {
  team: Team;
  index: number;
  onChange: (id: number, field: keyof Team, value: string | null) => void;
  /** Draft mode hides the captain here — captains are a separate pool drawn to franchises. */
  hideCaptain?: boolean;
}

function TeamCard({ team, index, onChange, hideCaptain = false }: TeamCardProps) {
  const nameId    = useId();
  const captainId = useId();

  return (
    <div className={styles.teamCard}>
      <div className={styles.teamCardTop} style={{ background: team.color }} />
      <div className={styles.teamCardBody}>
        <div className={styles.teamNum}>Team {index + 1}</div>

        {/* Logo + text fields row */}
        <div className={styles.teamCardImgRow}>
          <ImageUpload
            value={team.logoBase64}
            onChange={(v) => onChange(team.id, 'logoBase64', v)}
            label="Logo"
            size={72}
            circle={false}
            maxDim={500}
            placeholder={<Icon name="shield" size={28} />}
          />
          <div className={styles.teamCardTextFields}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor={nameId}>Team Name</label>
              <input
                id={nameId}
                className={styles.formInput}
                value={team.name}
                maxLength={40}
                placeholder="e.g. Karachi Kings"
                onChange={(e) => onChange(team.id, 'name', e.target.value)}
              />
            </div>
            <div className={styles.colorRow}>
              <input
                type="color"
                className={styles.colorInput}
                value={team.color}
                aria-label={`Colour for ${team.name || `Team ${index + 1}`}`}
                onChange={(e) => onChange(team.id, 'color', e.target.value)}
              />
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                {team.color}
              </span>
            </div>
          </div>
        </div>

        {/* Captain row — omitted in draft mode (captains are a separate, drawn pool) */}
        {!hideCaptain && (
          <div className={styles.captainImgRow}>
            <ImageUpload
              value={team.captainBase64}
              onChange={(v) => onChange(team.id, 'captainBase64', v)}
              label="Captain"
              size={60}
              circle={true}
              maxDim={400}
              smartCrop={true}
              placeholder={<Icon name="user" size={24} />}
            />
            <div style={{ flex: 1 }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor={captainId}>Captain Name</label>
                <input
                  id={captainId}
                  className={styles.formInput}
                  value={team.captain}
                  maxLength={40}
                  placeholder="Captain's full name"
                  onChange={(e) => onChange(team.id, 'captain', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Captain Pool Card (draft mode only) ──────────────────────────────────────
// Captains are known people entered as an UNPAIRED pool; the random Captain Draw
// in the Draft tab decides which franchise each one leads. Stored positionally on
// `team.captain` (reused as storage) — the order here carries no team assignment.

interface CaptainPoolCardProps {
  team: Team;
  index: number;
  onChange: (id: number, field: keyof Team, value: string | null) => void;
}

function CaptainPoolCard({ team, index, onChange }: CaptainPoolCardProps) {
  const captainId = useId();
  return (
    <div className={styles.captainPoolCard}>
      <ImageUpload
        value={team.captainBase64}
        onChange={(v) => onChange(team.id, 'captainBase64', v)}
        label="Photo"
        size={56}
        circle={true}
        maxDim={400}
        smartCrop={true}
        placeholder={<Icon name="user" size={22} />}
      />
      <div className={styles.captainPoolFields}>
        <label className={styles.formLabel} htmlFor={captainId}>Captain {index + 1}</label>
        <input
          id={captainId}
          className={styles.formInput}
          value={team.captain}
          maxLength={40}
          placeholder="Captain's full name"
          onChange={(e) => onChange(team.id, 'captain', e.target.value)}
        />
      </div>
    </div>
  );
}

// ─── Player Form (Add + Edit) ─────────────────────────────────────────────────

interface PlayerFormProps {
  editingPlayer: Player | null;
  onAdd: (p: Omit<Player, 'id' | 'status'>) => void;
  onUpdate: (id: number, data: Omit<Player, 'id' | 'status'>) => void;
  onCancelEdit: () => void;
}

function PlayerForm({ editingPlayer, onAdd, onUpdate, onCancelEdit }: PlayerFormProps) {
  const { config } = useTournament();
  const isDraft = getMode(config) === 'draft';
  const catNames = getCategoryNames(config);
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState<Category>(catNames[0] ?? '');
  const [basePrice,   setBasePrice]   = useState('');
  const [photo,       setPhoto]       = useState<string | null>(null);
  const [errors,      setErrors]      = useState<ValidationError[]>([]);

  const nameId  = useId();
  const descId  = useId();
  const catId   = useId();
  const priceId = useId();

  const isEditing = editingPlayer !== null;

  // Pre-fill form when entering edit mode, clear when exiting
  useEffect(() => {
    if (editingPlayer) {
      setName(editingPlayer.name);
      setDescription(editingPlayer.description ?? '');
      setCategory(editingPlayer.category);
      setBasePrice(String(editingPlayer.basePrice));
      setPhoto(editingPlayer.photoBase64);
      setErrors([]);
    } else {
      setName('');
      setDescription('');
      setCategory(catNames[0] ?? '');
      setBasePrice('');
      setPhoto(null);
      setErrors([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPlayer?.id]);

  const getErr = (f: string) => errors.find((e) => e.field === f)?.message;

  function handleSubmit() {
    const price = isDraft ? 0 : Number(basePrice);
    // Draft mode has no bidding, so base price is irrelevant — validate the name only.
    let errs = validatePlayerForm(name, price);
    if (isDraft) errs = errs.filter((e) => e.field !== 'basePrice');
    if (errs.length) { setErrors(errs); return; }

    const data = { name: name.trim(), description: description.trim(), category, basePrice: price, photoBase64: photo };

    if (isEditing) {
      onUpdate(editingPlayer.id, data);
      onCancelEdit();
    } else {
      onAdd(data);
      setName(''); setDescription(''); setBasePrice(''); setPhoto(null); setErrors([]);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{isEditing ? 'Edit Player' : 'Add Player'}</div>

      {/* Player photo centered */}
      <div className={styles.playerImgRow}>
        <ImageUpload
          value={photo}
          onChange={setPhoto}
          label="Photo"
          size={80}
          circle={true}
          maxDim={400}
          smartCrop={true}
          placeholder={<Icon name="user" size={32} />}
        />
      </div>

      <div className={styles.formGroup} style={{ marginBottom: 10 }}>
        <label className={styles.formLabel} htmlFor={nameId}>Player Name</label>
        <input
          id={nameId}
          className={`${styles.formInput} ${getErr('name') ? styles.formInputError : ''}`}
          value={name}
          maxLength={60}
          placeholder="Full name"
          onChange={(e) => { setName(e.target.value); setErrors([]); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          aria-invalid={!!getErr('name')}
        />
        {getErr('name') && <p className={styles.formError} role="alert">{getErr('name')}</p>}
      </div>

      <div className={styles.formGroup} style={{ marginBottom: 10 }}>
        <label className={styles.formLabel} htmlFor={descId}>Description <span className={styles.formLabelOptional}>(optional)</span></label>
        <textarea
          id={descId}
          className={styles.formTextarea}
          value={description}
          maxLength={200}
          rows={2}
          placeholder="e.g. Explosive opener, 3× tournament MVP"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className={styles.formGroup} style={{ marginBottom: 10 }}>
        <label className={styles.formLabel} htmlFor={catId}>Category</label>
        <select
          id={catId}
          className={styles.formSelect}
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          {config.categories.map((cat) => (
            <option key={cat.name} value={cat.name}>{cat.name}</option>
          ))}
        </select>
      </div>

      {!isDraft && (
        <div className={styles.formGroup} style={{ marginBottom: 10 }}>
          <label className={styles.formLabel} htmlFor={priceId}>Base Price (pts)</label>
          <input
            id={priceId}
            className={`${styles.formInput} ${getErr('basePrice') ? styles.formInputError : ''}`}
            style={{ fontFamily: 'var(--font-mono)' }}
            type="number" min={1}
            value={basePrice}
            placeholder="e.g. 400"
            onChange={(e) => { setBasePrice(e.target.value); setErrors([]); }}
            aria-invalid={!!getErr('basePrice')}
          />
          {getErr('basePrice') && <p className={styles.formError} role="alert">{getErr('basePrice')}</p>}
        </div>
      )}

      <button className={styles.addBtn} onClick={handleSubmit}>
        {isEditing ? <><Icon name="save" size={14} /> Save Changes</> : '+ Add Player'}
      </button>
      {isEditing && (
        <button className={styles.cancelBtn} onClick={onCancelEdit}>
          Cancel
        </button>
      )}
    </div>
  );
}

// ─── Player Table ─────────────────────────────────────────────────────────────

interface PlayerTableProps {
  players: Player[];
  editingPlayerId: number | null;
  onRemove: (id: number) => void;
  onEdit: (player: Player) => void;
}

function PlayerTable({ players, editingPlayerId, onRemove, onEdit }: PlayerTableProps) {
  const { config } = useTournament();
  const isDraft = getMode(config) === 'draft';

  if (players.length === 0) {
    return (
      <div className={styles.emptyState} role="status">
        <div className={styles.emptyIcon} aria-hidden="true"><Icon name="user" size={36} /></div>
        <p className={styles.emptyText}>No players added yet</p>
      </div>
    );
  }

  return (
    <table className={styles.table} aria-label="Player pool">
      <thead>
        <tr>
          <th scope="col">Player</th>
          <th scope="col">Category</th>
          {!isDraft && <th scope="col">Base</th>}
          <th scope="col"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => {
          const { color } = getCategoryStyle(config, p.category);
          const isBeingEdited = p.id === editingPlayerId;
          return (
            <tr key={p.id} className={isBeingEdited ? styles.rowEditing : undefined}>
              <td>
                <div className={styles.playerInfoCell}>
                  <Avatar
                    src={p.photoBase64}
                    name={p.name}
                    size={32}
                    color={color}
                    square={false}
                  />
                  <div>
                    <div className={styles.playerName}>{p.name}</div>
                  </div>
                </div>
              </td>
              <td>
                <span
                  className={styles.catBadge}
                  style={{ background: withAlpha(color, 0.125), color, border: `1px solid ${withAlpha(color, 0.25)}` }}
                >
                  {p.category}
                </span>
              </td>
              {!isDraft && <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                {formatPts(p.basePrice)}
              </td>}
              <td>
                <div className={styles.actionCell}>
                  {p.status === 'pending' && (
                    <button
                      className={`${styles.editBtn} ${isBeingEdited ? styles.editBtnActive : ''}`}
                      onClick={() => isBeingEdited ? undefined : onEdit(p)}
                      aria-label={`Edit ${p.name}`}
                      aria-pressed={isBeingEdited}
                    ><Icon name="pencil" size={13} /></button>
                  )}
                  <button
                    className={styles.removeBtn}
                    onClick={() => onRemove(p.id)}
                    disabled={p.status === 'sold'}
                    title={p.status === 'sold' ? 'Undo the sale in the Auction tab before removing this player' : undefined}
                    aria-label={p.status === 'sold'
                      ? `${p.name} is sold — undo the sale before removing`
                      : `Remove ${p.name}`}
                  ><Icon name="x" size={12} /></button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── SetupTab ─────────────────────────────────────────────────────────────────

interface SetupTabProps {
  teams: Team[];
  onTeamsChange: (teams: Team[]) => void;
  players: Player[];
  onPlayersChange: (players: Player[]) => void;
  onToast: (msg: string, type: ToastType) => void;
}

type View = 'teams' | 'players';

export function SetupTab({ teams, onTeamsChange, players, onPlayersChange, onToast }: SetupTabProps) {
  const { config } = useTournament();
  const isDraft = getMode(config) === 'draft';
  const [view, setView] = useState<View>('teams');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');

  // CSV import — hidden file inputs + parsed-result-awaiting-confirmation state
  const playersFileRef = useRef<HTMLInputElement>(null);
  const teamsFileRef = useRef<HTMLInputElement>(null);
  const [pendingPlayerImport, setPendingPlayerImport] = useState<PlayerImportSuccess | null>(null);
  const [pendingTeamImport, setPendingTeamImport] = useState<TeamImportSuccess | null>(null);

  // Clear editing state when switching away from players view
  useEffect(() => {
    if (view !== 'players') setEditingPlayer(null);
  }, [view]);

  const handleTeamChange = useCallback(
    (id: number, field: keyof Team, value: string | null) => {
      onTeamsChange(teams.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
    },
    [teams, onTeamsChange]
  );

  const handleAddPlayer = useCallback(
    (partial: Omit<Player, 'id' | 'status'>) => {
      // Monotonic id derived from the current pool — unique and collision-free,
      // unlike Date.now() which repeats for two adds within the same millisecond.
      const nextId = players.reduce((max, p) => (p.id > max ? p.id : max), 0) + 1;
      const newPlayer: Player = { ...partial, id: nextId, status: 'pending' };
      onPlayersChange([...players, newPlayer]);
    },
    [players, onPlayersChange]
  );

  const handleUpdatePlayer = useCallback(
    (id: number, data: Omit<Player, 'id' | 'status'>) => {
      onPlayersChange(players.map((p) => (p.id === id ? { ...p, ...data } : p)));
    },
    [players, onPlayersChange]
  );

  const handleRemovePlayer = useCallback(
    (id: number) => {
      // A sold player is removed by undoing its sale in the Auction tab, which
      // also clears the sold record. Removing it here would strand that record
      // and desync squads/budgets, so block it (the button is also disabled).
      const target = players.find((p) => p.id === id);
      if (target?.status === 'sold') return;
      if (editingPlayer?.id === id) setEditingPlayer(null);
      onPlayersChange(players.filter((p) => p.id !== id));
    },
    [players, onPlayersChange, editingPlayer]
  );

  const handleEditPlayer = useCallback((player: Player) => {
    setEditingPlayer(player);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingPlayer(null);
  }, []);

  // ── CSV import: players ────────────────────────────────────────────────────
  const handlePlayersFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    file.text().then((text) => {
      const result = parsePlayersCsv(text, config, players);
      if (!result.ok) { onToast(result.error, 'warn'); return; }
      if (result.players.length === 0) {
        const why = result.skippedDuplicates > 0
          ? 'every name is already in the pool'
          : result.invalidRows.length > 0 ? 'no rows were valid' : 'no player rows were found';
        onToast(`Nothing to import — ${why}.`, 'warn');
        return;
      }
      setPendingPlayerImport(result);
    }).catch(() => onToast('Could not read that file.', 'warn'));
  }, [config, players, onToast]);

  const applyPlayerImport = useCallback(() => {
    if (!pendingPlayerImport) return;
    let nextId = players.reduce((max, p) => (p.id > max ? p.id : max), 0);
    const added: Player[] = pendingPlayerImport.players.map((pp) => {
      nextId += 1;
      return { ...pp, id: nextId, status: 'pending' as const, photoBase64: null };
    });
    onPlayersChange([...players, ...added]);
    onToast(`Imported ${added.length} player${added.length === 1 ? '' : 's'}.`, 'ok');
    setPendingPlayerImport(null);
    setView('players');
  }, [pendingPlayerImport, players, onPlayersChange, onToast]);

  // ── CSV import: teams & captains ───────────────────────────────────────────
  const handleTeamsFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    file.text().then((text) => {
      const result = parseTeamsCsv(text, config);
      if (!result.ok) { onToast(result.error, 'warn'); return; }
      setPendingTeamImport(result);
    }).catch(() => onToast('Could not read that file.', 'warn'));
  }, [config, onToast]);

  const applyTeamImport = useCallback(() => {
    if (!pendingTeamImport) return;
    const { updates } = pendingTeamImport;
    const next = teams.map((t, i) => {
      const u = updates[i];
      if (!u) return t;
      return {
        ...t,
        ...(u.name !== undefined ? { name: u.name } : {}),
        ...(u.captain !== undefined ? { captain: u.captain } : {}),
        ...(u.color !== undefined ? { color: u.color } : {}),
      };
    });
    const count = Math.min(updates.length, teams.length);
    onTeamsChange(next);
    onToast(`Updated ${count} team${count === 1 ? '' : 's'}.`, 'ok');
    setPendingTeamImport(null);
    setView('teams');
  }, [pendingTeamImport, teams, onTeamsChange, onToast]);

  const downloadPlayersTemplate = useCallback(
    () => downloadFile('players_template.csv', buildPlayersTemplate(config), 'text/csv;charset=utf-8'),
    [config]
  );
  const downloadTeamsTemplate = useCallback(
    () => downloadFile('teams_template.csv', buildTeamsTemplate(config), 'text/csv;charset=utf-8'),
    [config]
  );

  // Dynamic category counts
  const catCounts = useMemo(() => countByCategory(players, config), [config, players]);
  const totalSlots = getTotalSlots(config);

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    return q === '' ? players : players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, playerSearch]);

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Tournament Setup</h1>
        <p className={styles.pageSubtitle}>
          Configure all {config.totalTeams} teams and build the player pool before starting the {isDraft ? 'draft' : 'auction'}.
        </p>
      </div>

      {/* Stats bar */}
      <div className={styles.statsBar} role="status">
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Teams</span>
          <span className={styles.statValue}>{config.totalTeams}</span>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        {!isDraft && (
          <>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Budget / Team</span>
              <span className={styles.statValue} style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>
                {formatPts(config.budget)}
              </span>
            </div>
            <div className={styles.statDivider} aria-hidden="true" />
          </>
        )}
        {config.categories.map((cat) => (
          <div key={cat.name} className={styles.statItem}>
            <span className={styles.statLabel} style={{ color: cat.color }}>{cat.name}</span>
            <span className={styles.statValue} style={{ color: cat.color }}>
              {catCounts[cat.name] ?? 0}
            </span>
          </div>
        ))}
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Players</span>
          <span className={styles.statValue} style={{ color: players.length >= totalSlots ? 'var(--success)' : 'var(--text)' }}>
            {players.length} / {totalSlots}
          </span>
        </div>
      </div>

      {/* Sub-nav — toggle buttons, not a full ARIA tab widget (no arrow-key
          navigation or tabpanel wiring), so aria-pressed is the honest semantic */}
      <div className={styles.subNav} role="group" aria-label="Setup sections">
        {([
            { id: 'teams' as View,   label: isDraft ? 'Franchises & Captains' : 'Teams & Captains', icon: 'shield' as const },
            { id: 'players' as View, label: 'Player Pool',       icon: 'user'   as const },
          ]).map(({ id, label, icon }) => (
          <button
            key={id}
            aria-pressed={view === id}
            className={`${styles.subNavBtn} ${view === id ? styles.subNavBtnActive : ''}`}
            onClick={() => setView(id)}
          ><Icon name={icon} size={14} /> {label}</button>
        ))}
      </div>

      {/* CSV import toolbar (context-sensitive to the active sub-view) */}
      <div className={styles.importToolbar}>
        <span className={styles.importHint}>
          {view === 'teams'
            ? 'Bulk-fill teams & captains from a spreadsheet'
            : 'Bulk-add players from a spreadsheet'}
        </span>
        <button
          type="button"
          className={styles.templateLink}
          onClick={view === 'teams' ? downloadTeamsTemplate : downloadPlayersTemplate}
        >
          <Icon name="download" size={13} /> Template
        </button>
        <button
          type="button"
          className={styles.importBtn}
          onClick={() => (view === 'teams' ? teamsFileRef.current : playersFileRef.current)?.click()}
        >
          <Icon name="upload" size={13} /> Import CSV
        </button>
        <input
          ref={teamsFileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleTeamsFile}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
        <input
          ref={playersFileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handlePlayersFile}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      </div>

      {view === 'teams' && (isDraft ? (
        <>
          <div className={styles.setupSectionHead}>
            <h2 className={styles.setupSectionTitle}>Franchises</h2>
            <p className={styles.setupSectionNote}>The teams players are drafted into — name, logo and colour. Captains are set up separately below.</p>
          </div>
          <section aria-label="Franchises" className={styles.teamGrid}>
            {teams.map((team, i) => (
              <TeamCard key={team.id} team={team} index={i} onChange={handleTeamChange} hideCaptain />
            ))}
          </section>

          <div className={styles.setupSectionHead}>
            <h2 className={styles.setupSectionTitle}>Captains</h2>
            <p className={`${styles.setupSectionNote} ${styles.captainPoolNote}`} role="note">
              <Icon name="alert-circle" size={13} />
              <span>These captains are decided in advance. The random <strong>Captain Draw</strong> in the Draft tab decides which franchise each one leads — the order here does <strong>not</strong> assign them to a team.</span>
            </p>
          </div>
          <section aria-label="Captains pool" className={styles.captainPoolGrid}>
            {teams.map((team, i) => (
              <CaptainPoolCard key={team.id} team={team} index={i} onChange={handleTeamChange} />
            ))}
          </section>
        </>
      ) : (
        <section aria-label="Team configuration" className={styles.teamGrid}>
          {teams.map((team, i) => (
            <TeamCard key={team.id} team={team} index={i} onChange={handleTeamChange} />
          ))}
        </section>
      ))}

      {view === 'players' && (
        <section aria-label="Player pool" className={styles.playerPanel}>
          <PlayerForm
            editingPlayer={editingPlayer}
            onAdd={handleAddPlayer}
            onUpdate={handleUpdatePlayer}
            onCancelEdit={handleCancelEdit}
          />
          <div className={`${styles.card} ${styles.cardScrollable}`}>
            <div className={styles.cardTitle}>
              Player Pool ({playerSearch.trim() ? `${filteredPlayers.length}/${players.length}` : players.length})
            </div>
            <input
              className={styles.poolSearch}
              type="search"
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="Search players by name…"
              aria-label="Search players by name"
            />
            <PlayerTable
              players={filteredPlayers}
              editingPlayerId={editingPlayer?.id ?? null}
              onRemove={handleRemovePlayer}
              onEdit={handleEditPlayer}
            />
          </div>
        </section>
      )}

      {pendingPlayerImport && (
        <ConfirmDialog
          title={`Import ${pendingPlayerImport.players.length} player${pendingPlayerImport.players.length === 1 ? '' : 's'}?`}
          message={
            <div className={styles.importSummary}>
              <p>{pendingPlayerImport.players.length} new player{pendingPlayerImport.players.length === 1 ? '' : 's'} will be added to the pool.</p>
              {(pendingPlayerImport.skippedDuplicates > 0 || pendingPlayerImport.invalidRows.length > 0 || pendingPlayerImport.warnings.length > 0) && (
                <ul className={styles.importIssues}>
                  {pendingPlayerImport.skippedDuplicates > 0 && (
                    <li>{pendingPlayerImport.skippedDuplicates} duplicate name{pendingPlayerImport.skippedDuplicates === 1 ? '' : 's'} already in the pool will be skipped.</li>
                  )}
                  {pendingPlayerImport.invalidRows.length > 0 && (
                    <li>
                      {pendingPlayerImport.invalidRows.length} row{pendingPlayerImport.invalidRows.length === 1 ? '' : 's'} skipped
                      {' '}({pendingPlayerImport.invalidRows.slice(0, 3).map((r) => `line ${r.row}: ${r.reason}`).join('; ')}
                      {pendingPlayerImport.invalidRows.length > 3 ? '; …' : ''}).
                    </li>
                  )}
                  {pendingPlayerImport.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}
            </div>
          }
          confirmLabel="Add to pool"
          tone="success"
          onConfirm={applyPlayerImport}
          onCancel={() => setPendingPlayerImport(null)}
        />
      )}

      {pendingTeamImport && (
        <ConfirmDialog
          title="Apply imported team details?"
          message={
            <div className={styles.importSummary}>
              <p>
                Name and captain will be set for {Math.min(pendingTeamImport.updates.length, teams.length)} team
                {Math.min(pendingTeamImport.updates.length, teams.length) === 1 ? '' : 's'} (in order).
              </p>
              <p className={styles.importNote}>Existing names/captains in those slots will be overwritten.</p>
              {pendingTeamImport.warnings.length > 0 && (
                <ul className={styles.importIssues}>
                  {pendingTeamImport.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}
            </div>
          }
          confirmLabel="Apply"
          onConfirm={applyTeamImport}
          onCancel={() => setPendingTeamImport(null)}
        />
      )}
    </main>
  );
}
