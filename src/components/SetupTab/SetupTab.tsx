import { useState, useCallback, useId } from 'react';
import type { Team, Player, Category, ValidationError } from '@/types';
import { CATEGORY_STYLE, CATEGORIES } from '@/constants/auction';
import { validatePlayerForm } from '@/utils/auction';
import { formatPts } from '@/utils/format';
import { useTournament } from '@/context/TournamentContext';
import { ImageUpload } from '@/components/ImageUpload/ImageUpload';
import { Avatar } from '@/components/Avatar/Avatar';
import styles from './SetupTab.module.css';

// ─── Team Card ────────────────────────────────────────────────────────────────

interface TeamCardProps {
  team: Team;
  index: number;
  onChange: (id: number, field: keyof Team, value: string | null) => void;
}

function TeamCard({ team, index, onChange }: TeamCardProps) {
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
            maxDim={300}
            placeholder="🛡️"
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

        {/* Captain row */}
        <div className={styles.captainImgRow}>
          <ImageUpload
            value={team.captainBase64}
            onChange={(v) => onChange(team.id, 'captainBase64', v)}
            label="Captain"
            size={60}
            circle={true}
            maxDim={200}
            placeholder="👤"
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
      </div>
    </div>
  );
}

// ─── Add Player Form ──────────────────────────────────────────────────────────

interface AddPlayerFormProps {
  onAdd: (p: Omit<Player, 'id' | 'status'>) => void;
}

function AddPlayerForm({ onAdd }: AddPlayerFormProps) {
  const [name,      setName]      = useState('');
  const [category,  setCategory]  = useState<Category>('Gold');
  const [basePrice, setBasePrice] = useState('');
  const [photo,     setPhoto]     = useState<string | null>(null);
  const [errors,    setErrors]    = useState<ValidationError[]>([]);

  const nameId     = useId();
  const catId      = useId();
  const priceId    = useId();

  const getErr = (f: string) => errors.find((e) => e.field === f)?.message;

  function handleSubmit() {
    const price = Number(basePrice);
    const errs  = validatePlayerForm(name, price);
    if (errs.length) { setErrors(errs); return; }
    onAdd({ name: name.trim(), category, basePrice: price, photoBase64: photo });
    setName(''); setBasePrice(''); setPhoto(null); setErrors([]);
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Add Player</div>

      {/* Player photo centered */}
      <div className={styles.playerImgRow}>
        <ImageUpload
          value={photo}
          onChange={setPhoto}
          label="Photo"
          size={80}
          circle={true}
          maxDim={200}
          placeholder="👤"
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
        <label className={styles.formLabel} htmlFor={catId}>Category</label>
        <select
          id={catId}
          className={styles.formSelect}
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          <option value="Gold">🥇 Gold</option>
          <option value="Silver">🥈 Silver</option>
          <option value="Bronze">🥉 Bronze</option>
        </select>
      </div>

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

      <button className={styles.addBtn} onClick={handleSubmit}>+ Add Player</button>
    </div>
  );
}

// ─── Player Table ─────────────────────────────────────────────────────────────

interface PlayerTableProps {
  players: Player[];
  onRemove: (id: number) => void;
}

function PlayerTable({ players, onRemove }: PlayerTableProps) {
  if (players.length === 0) {
    return (
      <div className={styles.emptyState} role="status">
        <div className={styles.emptyIcon} aria-hidden="true">👤</div>
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
          <th scope="col">Base</th>
          <th scope="col"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => {
          const { color } = CATEGORY_STYLE[p.category];
          return (
            <tr key={p.id}>
              <td>
                <div className={styles.playerInfoCell}>
                  <Avatar
                    src={p.photoBase64}
                    name={p.name}
                    size={32}
                    color={color}
                    circle={true}
                  />
                  <div>
                    <div className={styles.playerName}>{p.name}</div>
                  </div>
                </div>
              </td>
              <td>
                <span
                  className={styles.catBadge}
                  style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
                >
                  {p.category}
                </span>
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                {formatPts(p.basePrice)}
              </td>
              <td>
                <button
                  className={styles.removeBtn}
                  onClick={() => onRemove(p.id)}
                  aria-label={`Remove ${p.name}`}
                >✕</button>
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
}

type View = 'teams' | 'players';

export function SetupTab({ teams, onTeamsChange, players, onPlayersChange }: SetupTabProps) {
  const { config } = useTournament();
  const [view, setView] = useState<View>('teams');

  const handleTeamChange = useCallback(
    (id: number, field: keyof Team, value: string | null) => {
      onTeamsChange(teams.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
    },
    [teams, onTeamsChange]
  );

  const handleAddPlayer = useCallback(
    (partial: Omit<Player, 'id' | 'status'>) => {
      const newPlayer: Player = { ...partial, id: Date.now(), status: 'pending' };
      onPlayersChange([...players, newPlayer]);
    },
    [players, onPlayersChange]
  );

  const handleRemovePlayer = useCallback(
    (id: number) => onPlayersChange(players.filter((p) => p.id !== id)),
    [players, onPlayersChange]
  );

  // Dynamic category counts
  const catCounts = { Gold: 0, Silver: 0, Bronze: 0 } as Record<Category, number>;
  players.forEach((p) => catCounts[p.category]++);
  const squadSize  = config.playersPerTeam - 1;
  const totalSlots = config.totalTeams * squadSize;

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Tournament Setup</h1>
        <p className={styles.pageSubtitle}>
          Configure all {config.totalTeams} teams and build the player pool before starting the auction.
        </p>
      </div>

      {/* Stats bar */}
      <div className={styles.statsBar} role="status">
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Teams</span>
          <span className={styles.statValue}>{config.totalTeams}</span>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Budget / Team</span>
          <span className={styles.statValue} style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>
            {formatPts(config.budget)}
          </span>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        {CATEGORIES.map((cat) => (
          <div key={cat} className={styles.statItem}>
            <span className={styles.statLabel} style={{ color: CATEGORY_STYLE[cat].color }}>{cat}</span>
            <span className={styles.statValue} style={{ color: CATEGORY_STYLE[cat].color }}>
              {catCounts[cat]}
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

      {/* Sub-nav */}
      <div className={styles.subNav} role="tablist">
        {([['teams', '🏟️ Teams & Captains'], ['players', '👤 Player Pool']] as [View, string][]).map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            className={`${styles.subNavBtn} ${view === v ? styles.subNavBtnActive : ''}`}
            onClick={() => setView(v)}
          >{label}</button>
        ))}
      </div>

      {view === 'teams' && (
        <section aria-label="Team configuration" className={styles.teamGrid}>
          {teams.map((team, i) => (
            <TeamCard key={team.id} team={team} index={i} onChange={handleTeamChange} />
          ))}
        </section>
      )}

      {view === 'players' && (
        <section aria-label="Player pool" className={styles.playerPanel}>
          <AddPlayerForm onAdd={handleAddPlayer} />
          <div className={`${styles.card} ${styles.cardScrollable}`}>
            <div className={styles.cardTitle}>Player Pool ({players.length})</div>
            <PlayerTable players={players} onRemove={handleRemovePlayer} />
          </div>
        </section>
      )}
    </main>
  );
}
