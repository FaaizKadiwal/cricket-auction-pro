import { useState, Fragment } from 'react';
import type { TournamentConfig, CategoryDefinition, ValidationError } from '@/types';
import { DEFAULT_CONFIG } from '@/constants/auction';
import { validateConfig } from '@/utils/auction';
import { formatPts } from '@/utils/format';
import { ImageUpload } from '@/components/ImageUpload/ImageUpload';
import styles from './ConfigScreen.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfigScreenProps {
  onLaunch: (config: TournamentConfig) => void;
}

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Structure',
  2: 'Categories',
  3: 'Confirm',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErr(errors: ValidationError[], field: string): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

// ─── Step 1: Structure ────────────────────────────────────────────────────────

interface Step1Props {
  draft: TournamentConfig;
  onChange: (partial: Partial<TournamentConfig>) => void;
  errors: ValidationError[];
}

function Step1({ draft, onChange, errors }: Step1Props) {
  const squadSize = draft.playersPerTeam - 1;

  return (
    <div>
      <h2 className={styles.stepTitle}>Tournament Structure</h2>
      <p className={styles.stepDesc}>
        Define the size and budget of your tournament. These settings apply globally to all teams.
      </p>

      <div className={styles.formGrid}>
        <div className={`${styles.formGroup} ${styles.formGroupFull} ${styles.logoRow}`}>
          <div className={styles.logoCol}>
            <ImageUpload
              value={draft.logoBase64}
              onChange={(v) => onChange({ logoBase64: v })}
              label="Tournament Logo"
              size={72}
              circle={false}
              maxDim={200}
              placeholder="🏏"
            />
          </div>
          <div className={styles.nameCol}>
            <label className={styles.label}>Tournament Name</label>
            <input
              className={styles.input}
              value={draft.tournamentName}
              maxLength={60}
              placeholder="e.g. Premier Cricket League 2025"
              onChange={(e) => onChange({ tournamentName: e.target.value })}
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Total Teams</label>
          <input
            className={`${styles.input} ${getErr(errors, 'totalTeams') ? styles.inputError : ''}`}
            type="number" min={2} max={20}
            value={draft.totalTeams}
            onChange={(e) => onChange({ totalTeams: Number(e.target.value) })}
          />
          {getErr(errors, 'totalTeams')
            ? <span className={styles.fieldError}>{getErr(errors, 'totalTeams')}</span>
            : <span className={styles.hint}>Min 2 · Max 20 teams</span>
          }
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Players per Team (incl. Captain)</label>
          <input
            className={`${styles.input} ${getErr(errors, 'playersPerTeam') ? styles.inputError : ''}`}
            type="number" min={3} max={15}
            value={draft.playersPerTeam}
            onChange={(e) => onChange({ playersPerTeam: Number(e.target.value) })}
          />
          {getErr(errors, 'playersPerTeam')
            ? <span className={styles.fieldError}>{getErr(errors, 'playersPerTeam')}</span>
            : <span className={styles.hint}>
                1 captain + {squadSize} auction pick{squadSize !== 1 ? 's' : ''}
              </span>
          }
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Budget per Team (pts)</label>
          <input
            className={`${styles.input} ${getErr(errors, 'budget') ? styles.inputError : ''}`}
            type="number" min={100}
            value={draft.budget}
            onChange={(e) => onChange({ budget: Number(e.target.value) })}
          />
          {getErr(errors, 'budget')
            ? <span className={styles.fieldError}>{getErr(errors, 'budget')}</span>
            : <span className={styles.hint}>Points each captain has to spend</span>
          }
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Min Reserve per Remaining Slot (pts)</label>
          <input
            className={`${styles.input} ${getErr(errors, 'minBidReserve') ? styles.inputError : ''}`}
            type="number" min={0}
            value={draft.minBidReserve}
            onChange={(e) => onChange({ minBidReserve: Number(e.target.value) })}
          />
          {getErr(errors, 'minBidReserve')
            ? <span className={styles.fieldError}>{getErr(errors, 'minBidReserve')}</span>
            : <span className={styles.hint}>Bid cap reserve · 0 = no minimum hold-back</span>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a dark bgColor from a hex color for badge backgrounds */
function deriveBgColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${Math.round(r * 0.16).toString(16).padStart(2, '0')}${Math.round(g * 0.16).toString(16).padStart(2, '0')}${Math.round(b * 0.16).toString(16).padStart(2, '0')}`;
}

function blankCategory(): CategoryDefinition {
  return { name: '', color: '#888888', bgColor: '#151515', min: 0, max: 0 };
}

// ─── Step 2: Custom Categories ───────────────────────────────────────────────

interface Step2Props {
  draft: TournamentConfig;
  onChange: (partial: Partial<TournamentConfig>) => void;
  errors: ValidationError[];
}

function Step2({ draft, onChange, errors }: Step2Props) {
  const squadSize = draft.playersPerTeam - 1;
  const cats = draft.categories;

  function updateCat(index: number, partial: Partial<CategoryDefinition>) {
    const updated = cats.map((c, i) => {
      if (i !== index) return c;
      const merged = { ...c, ...partial };
      // Auto-derive bgColor when color changes
      if (partial.color) merged.bgColor = deriveBgColor(partial.color);
      return merged;
    });
    onChange({ categories: updated });
  }

  function addCategory() {
    onChange({ categories: [...cats, blankCategory()] });
  }

  function removeCategory(index: number) {
    onChange({ categories: cats.filter((_, i) => i !== index) });
  }

  function moveCategory(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= cats.length) return;
    const updated = [...cats];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange({ categories: updated });
  }

  const catErr = getErr(errors, 'categories');

  return (
    <div>
      <h2 className={styles.stepTitle}>Player Categories</h2>
      <p className={styles.stepDesc}>
        Define tiers from highest to lowest. Unsold players demote to the next tier;
        the lowest-tier unsold players get their base price halved. Set max to 0 for
        no limit (capped by squad size of {squadSize}).
      </p>

      {catErr && <div className={styles.fieldError} style={{ marginBottom: 12 }}>{catErr}</div>}

      <div className={styles.catList}>
        {cats.map((cat, i) => {
          const nameErr = getErr(errors, `cat_name_${i}`);
          return (
            <div key={i} className={styles.catCard} style={{ borderColor: `${cat.color}40` }}>
              <div className={styles.catCardHeader}>
                <div className={styles.catTierBadge} style={{ background: cat.bgColor, color: cat.color, borderColor: `${cat.color}30` }}>
                  Tier {i + 1}
                </div>
                <div className={styles.catActions}>
                  <button
                    type="button"
                    className={styles.catArrowBtn}
                    disabled={i === 0}
                    onClick={() => moveCategory(i, -1)}
                    aria-label="Move up"
                  >↑</button>
                  <button
                    type="button"
                    className={styles.catArrowBtn}
                    disabled={i === cats.length - 1}
                    onClick={() => moveCategory(i, 1)}
                    aria-label="Move down"
                  >↓</button>
                  {cats.length > 1 && (
                    <button
                      type="button"
                      className={styles.catRemoveBtn}
                      onClick={() => removeCategory(i)}
                      aria-label={`Remove ${cat.name || 'category'}`}
                    >×</button>
                  )}
                </div>
              </div>

              <div className={styles.catFields}>
                <div className={styles.catFieldName}>
                  <label className={styles.label}>Name</label>
                  <input
                    className={`${styles.input} ${nameErr ? styles.inputError : ''}`}
                    value={cat.name}
                    maxLength={30}
                    placeholder="e.g. Gold"
                    onChange={(e) => updateCat(i, { name: e.target.value })}
                  />
                  {nameErr && <span className={styles.fieldError}>{nameErr}</span>}
                </div>

                <div className={styles.catFieldColor}>
                  <label className={styles.label}>Color</label>
                  <input
                    type="color"
                    className={styles.colorInput}
                    value={cat.color}
                    title="Category color"
                    onChange={(e) => updateCat(i, { color: e.target.value })}
                  />
                </div>

                <div className={styles.catFieldNum}>
                  <label className={styles.label}>Min</label>
                  <input
                    className={styles.input}
                    type="number" min={0} max={squadSize}
                    value={cat.min}
                    title="Minimum picks per team"
                    onChange={(e) => updateCat(i, { min: Number(e.target.value) })}
                  />
                </div>

                <div className={styles.catFieldNum}>
                  <label className={styles.label}>Max</label>
                  <input
                    className={styles.input}
                    type="number" min={0} max={squadSize}
                    value={cat.max}
                    title="Maximum picks per team"
                    onChange={(e) => updateCat(i, { max: Number(e.target.value) })}
                  />
                </div>
              </div>

              <span className={styles.hint}>
                {cat.min > 0 ? `Min ${cat.min}` : 'No minimum'}
                {' · '}
                {cat.max > 0 ? `Max ${cat.max} per team` : 'No limit'}
              </span>
            </div>
          );
        })}
      </div>

      <button type="button" className={styles.addCatBtn} onClick={addCategory}>+ Add Category</button>

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
        Tier order matters — unsold players demote down the list. The lowest tier's unsold players
        get their base price halved instead of being removed.
      </div>
    </div>
  );
}

// ─── Step 3: Confirm ─────────────────────────────────────────────────────────

interface Step3Props { draft: TournamentConfig; }

function Step3({ draft }: Step3Props) {
  const squadSize  = draft.playersPerTeam - 1;
  const totalSlots = draft.totalTeams * squadSize;
  const totalPot   = draft.totalTeams * draft.budget;

  const summaryItems = [
    { label: 'Tournament',     value: draft.tournamentName || '—' },
    { label: 'Teams',          value: String(draft.totalTeams) },
    { label: 'Squad Size',     value: `${draft.playersPerTeam} (1 captain + ${squadSize} picks)` },
    { label: 'Total Slots',    value: String(totalSlots) },
    { label: 'Budget / Team',  value: `${formatPts(draft.budget)} pts` },
    { label: 'Total Pot',      value: `${formatPts(totalPot)} pts` },
    { label: 'Min Reserve',    value: `${draft.minBidReserve} pts / slot` },
    { label: 'Categories',     value: `${draft.categories.length} tiers` },
  ];

  return (
    <div>
      <h2 className={styles.stepTitle}>Confirm & Launch</h2>
      <p className={styles.stepDesc}>
        Review your tournament settings below. Once launched you will move to the Setup page
        to enter team details and add players.
      </p>

      <div className={styles.summaryGrid}>
        {summaryItems.map((item) => (
          <div key={item.label} className={styles.summaryCard}>
            <div className={styles.summaryCardTitle}>{item.label}</div>
            <div className={styles.summaryCardValue} style={{ fontSize: item.value.length > 14 ? 14 : 20, paddingTop: 4 }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic category summary */}
      <div className={styles.catSummaryRow}>
        {draft.categories.map((cat, i) => (
          <div key={i} className={styles.catSummaryChip} style={{ borderColor: `${cat.color}40`, color: cat.color }}>
            <span className={styles.catSummaryDot} style={{ background: cat.color }} />
            <span className={styles.catSummaryName}>{cat.name}</span>
            <span className={styles.catSummaryLimits}>
              {cat.min > 0 ? `min ${cat.min}` : ''}
              {cat.min > 0 && cat.max > 0 ? ' · ' : ''}
              {cat.max > 0 ? `max ${cat.max}` : cat.min === 0 ? 'no limit' : ''}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.confirmNote}>
        After launching, you can add teams, upload logos and photos, add players with their
        base prices, then start the live auction. All data is auto-saved — a refresh won't lose progress.
      </div>
    </div>
  );
}

// ─── ConfigScreen ─────────────────────────────────────────────────────────────

export function ConfigScreen({ onLaunch }: ConfigScreenProps) {
  const [step, setStep]   = useState<Step>(1);
  const [draft, setDraft] = useState<TournamentConfig>({ ...DEFAULT_CONFIG });
  const [errors, setErrors] = useState<ValidationError[]>([]);

  function updateDraft(partial: Partial<TournamentConfig>) {
    setDraft((d) => ({ ...d, ...partial }));
    setErrors([]);
  }

  function handleNext() {
    if (step === 1) {
      const errs = validateConfig(draft.totalTeams, draft.playersPerTeam, draft.budget, draft.minBidReserve);
      if (errs.length) { setErrors(errs); return; }
    }
    if (step === 2) {
      const errs: ValidationError[] = [];
      if (draft.categories.length === 0) {
        errs.push({ field: 'categories', message: 'At least one category is required.' });
      }
      const names = new Set<string>();
      draft.categories.forEach((cat, i) => {
        const trimmed = cat.name.trim();
        if (!trimmed) {
          errs.push({ field: `cat_name_${i}`, message: 'Name is required.' });
        } else if (names.has(trimmed.toLowerCase())) {
          errs.push({ field: `cat_name_${i}`, message: 'Duplicate name.' });
        } else {
          names.add(trimmed.toLowerCase());
        }
        if (cat.max > 0 && cat.min > cat.max) {
          errs.push({ field: `cat_name_${i}`, message: 'Min cannot exceed max.' });
        }
      });
      if (errs.length) { setErrors(errs); return; }
    }
    setStep((s) => Math.min(3, s + 1) as Step);
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1) as Step);
    setErrors([]);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Tournament configuration">

        {/* Header */}
        <div className={styles.panelHeader}>
          <span className={styles.logo} aria-hidden="true">🏏</span>
          <div className={styles.titleBlock}>
            <div className={styles.appTitle}>Cricket Auction Pro</div>
            <div className={styles.appSub}>Tournament Setup Wizard</div>
          </div>
        </div>

        {/* Step indicators */}
        <div className={styles.steps} aria-label="Setup progress">
          {([1, 2, 3] as Step[]).map((s, i) => (
            <Fragment key={s}>
              {i > 0 && (
                <div className={`${styles.stepLine} ${step > s - 1 ? styles.stepLineDone : ''}`} aria-hidden="true" />
              )}
              <div className={styles.step}>
                <div className={`${styles.stepDot} ${step === s ? styles.stepDotActive : step > s ? styles.stepDotDone : ''}`}>
                  {step > s ? '✓' : s}
                </div>
                <span className={`${styles.stepLabel} ${step === s ? styles.stepLabelActive : ''}`}>
                  {STEP_LABELS[s]}
                </span>
              </div>
            </Fragment>
          ))}
        </div>

        {/* Body */}
        <div className={styles.body}>
          {step === 1 && <Step1 draft={draft} onChange={updateDraft} errors={errors} />}
          {step === 2 && <Step2 draft={draft} onChange={updateDraft} errors={errors} />}
          {step === 3 && <Step3 draft={draft} />}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {step > 1
            ? <button className={styles.btnBack} onClick={handleBack}>← Back</button>
            : <div />
          }
          {step < 3
            ? <button className={styles.btnNext} onClick={handleNext}>Next →</button>
            : <button className={styles.btnLaunch} onClick={() => onLaunch(draft)}>🚀 Launch Tournament</button>
          }
        </div>
      </div>
    </div>
  );
}
