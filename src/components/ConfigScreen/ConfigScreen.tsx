import { useState } from 'react';
import type { TournamentConfig, Category, ValidationError } from '@/types';
import { DEFAULT_CONFIG, CATEGORY_STYLE } from '@/constants/auction';
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

// ─── Step 2: Category Limits ──────────────────────────────────────────────────

interface Step2Props {
  draft: TournamentConfig;
  onChange: (partial: Partial<TournamentConfig>) => void;
}

function Step2({ draft, onChange }: Step2Props) {
  const squadSize = draft.playersPerTeam - 1;

  function setCatLimit(cat: Category, max: number) {
    onChange({
      categoryLimits: {
        ...draft.categoryLimits,
        [cat]: { max },
      },
    });
  }

  return (
    <div>
      <h2 className={styles.stepTitle}>Category Limits</h2>
      <p className={styles.stepDesc}>
        Set how many players from each tier a team may pick. Players are categorised as you add
        them to the pool — the counts are dynamic, not fixed. Set max to 0 for no limit
        (capped only by total squad size of {squadSize}).
      </p>

      <div className={styles.catGrid}>
        {(['Gold', 'Silver', 'Bronze'] as Category[]).map((cat) => {
          const { color, bg } = CATEGORY_STYLE[cat];
          const currentMax = draft.categoryLimits[cat]?.max ?? 0;
          return (
            <div key={cat} className={styles.catCard} style={{ borderColor: `${color}40` }}>
              <div className={styles.catLabel} style={{ color }}>{cat}</div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Max picks / team</label>
                <input
                  className={styles.input}
                  type="number" min={0} max={squadSize}
                  style={{ background: bg, borderColor: `${color}30`, color }}
                  value={currentMax}
                  onChange={(e) => setCatLimit(cat, Number(e.target.value))}
                />
                <span className={styles.hint}>{currentMax === 0 ? 'No limit' : `≤ ${currentMax} ${cat} players`}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
        💡 Players will be automatically counted per category as you add them to the pool.
        The auctioneer sees live counts during bidding.
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
    { label: 'Gold Limit',     value: draft.categoryLimits.Gold.max === 0 ? 'No limit' : `≤ ${draft.categoryLimits.Gold.max}` },
    { label: 'Silver Limit',   value: draft.categoryLimits.Silver.max === 0 ? 'No limit' : `≤ ${draft.categoryLimits.Silver.max}` },
    { label: 'Bronze Limit',   value: draft.categoryLimits.Bronze.max === 0 ? 'No limit' : `≤ ${draft.categoryLimits.Bronze.max}` },
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

      <div className={styles.confirmNote}>
        🚀 After launching, you can add teams, upload logos and photos, add players with their
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
            <div key={s} className={styles.step}>
              {i > 0 && (
                <div className={`${styles.stepLine} ${step > s - 1 ? styles.stepLineDone : ''}`} aria-hidden="true" />
              )}
              <div className={`${styles.stepDot} ${step === s ? styles.stepDotActive : step > s ? styles.stepDotDone : ''}`}>
                {step > s ? '✓' : s}
              </div>
              <span className={`${styles.stepLabel} ${step === s ? styles.stepLabelActive : ''}`}>
                {STEP_LABELS[s]}
              </span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className={styles.body}>
          {step === 1 && <Step1 draft={draft} onChange={updateDraft} errors={errors} />}
          {step === 2 && <Step2 draft={draft} onChange={updateDraft} />}
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
