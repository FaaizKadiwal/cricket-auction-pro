import { useState } from 'react';
import { getTotalSlots, describeBidTiers, getMode } from '@/constants/auction';
import { getRoundSchedule, canUseBalancedGrid } from '@/utils/draft';
import { useTournament } from '@/context/TournamentContext';
import { formatPts } from '@/utils/format';
import { Icon, type IconName } from '@/components/Icon/Icon';
import styles from './RulesTab.module.css';

interface RuleItem {
  text: string;
  hl?: boolean;
}

interface RuleSection {
  title: string;
  icon: IconName;
  hl?: boolean;
  items: RuleItem[];
}

export function RulesTab() {
  const { config, squadSize } = useTournament();
  const totalSlots = getTotalSlots(config);
  const isDraft = getMode(config) === 'draft';
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const subtitle = [
        `${config.tournamentName}`,
        isDraft
          ? `${config.totalTeams} teams · ${squadSize} draft rounds · ${config.playersPerTeam} players per squad (incl. captain)`
          : `${config.totalTeams} teams · ${formatPts(config.budget)} pts budget per team · ${config.playersPerTeam} players per squad (incl. captain)`,
        isDraft ? 'All captains must acknowledge these rules before the draft begins.' : 'All captains must acknowledge these rules before bidding begins.',
      ].join('\n');
      const filename = `${config.tournamentName} - ${isDraft ? 'Draft' : 'Auction'} Rules.pdf`;
      // Lazy-load the PDF generator (jsPDF + its deps) only on demand so it
      // stays out of the initial bundle that loads on the projector.
      const { downloadRulesPdf } = await import('@/utils/pdf');
      downloadRulesPdf(config.tournamentName, subtitle, sections, filename, `OFFICIAL ${isDraft ? 'DRAFT' : 'AUCTION'} RULES`);
    } finally {
      setDownloading(false);
    }
  };

  const catLimitLines = config.categories.map((cat) => {
    const parts: string[] = [];
    if (cat.min > 0) parts.push(`minimum ${cat.min}`);
    if (cat.max > 0) parts.push(`maximum ${cat.max}`);
    const limit = parts.length > 0 ? parts.join(', ') + ' players per team' : 'no per-team limit';
    return `${cat.name.toUpperCase()}: ${limit}.`;
  });

  const auctionSections: RuleSection[] = [
    {
      title: 'Tournament Overview',
      icon: 'building' as IconName,
      items: [
        { text: `${config.totalTeams} teams participate. Each team is managed by a Captain who bids on behalf of their side.` },
        { text: `Each team must consist of exactly ${config.playersPerTeam} players — 1 Captain (pre-assigned) + ${squadSize} auction picks.` },
        { text: `Total auction slots: ${totalSlots} (${config.totalTeams} teams × ${squadSize} picks each).` },
        { text: 'Every player in the pool must be declared sold before results are finalised.' },
      ],
    },
    {
      title: 'Points Budget',
      icon: 'coins' as IconName,
      items: [
        { text: `Each team receives a fixed budget of ${formatPts(config.budget)} Points to spend across all ${squadSize} auction picks.` },
        { text: 'Unused points do not carry over. Budget is strictly per-team and non-transferable.' },
        { text: `A captain must utilize their budget efficiently such that a ${config.playersPerTeam} player squad is formed.` },
      ],
    },
    {
      title: 'Category Composition',
      icon: 'layers' as IconName,
      items: [
        { text: `Players are categorised individually as they are added to the pool — ${config.categories.map((c) => c.name).join(', ')}.` },
        ...catLimitLines.map((t) => ({ text: t })),
        { text: 'The auctioneer can filter the pool by category to run category-by-category auction rounds.' },
      ],
    },
    {
      title: 'Bidding Procedure',
      icon: 'gavel' as IconName,
      items: [
        { text: 'The Auctioneer announces the player and their base price. Bidding opens immediately at that price.' },
        { text: 'A captain may pick a player at the base price. This is known as the "base pick".' },
        { text: 'After the base pick, captains raise bids using a single increment that scales with the current bid:' },
        ...describeBidTiers().map((line) => ({ text: `${line} per bid.`, hl: true })),
        { text: "The highest active bidder when the Auctioneer calls 'SOLD' wins the player at that final price." },
        { text: 'If no bids are placed, the player is declared UNSOLD and may re-enter a Flash Round.' },
      ],
    },
    {
      title: 'Bidding Cap Rule',
      icon: 'lock' as IconName,
      hl: true,
      items: [
        {
          text: `DEFINITION: Every captain must always retain enough points to cover their remaining squad slots at the minimum price. The minimum reserve per slot is ${config.minBidReserve} pts.`,
          hl: true,
        },
        {
          text: `FORMULA: Maximum Bid = Remaining Budget − (Slots Still to Fill After This Pick × ${config.minBidReserve} pts).`,
          hl: true,
        },
        {
          text: config.minBidReserve > 0
            ? `EXAMPLE: A captain has ${formatPts(config.minBidReserve * 6)} pts left and 3 more picks needed. After this player, 2 slots remain. Reserve = 2 × ${config.minBidReserve} = ${formatPts(config.minBidReserve * 2)} pts. Bid cap = ${formatPts(config.minBidReserve * 6)} − ${formatPts(config.minBidReserve * 2)} = ${formatPts(config.minBidReserve * 4)} pts.`
            : 'No minimum reserve is configured — captains may spend their full remaining budget at any time.',
          hl: true,
        },
        {
          text: 'ENFORCEMENT: The system automatically blocks any bid exceeding the cap in real time.',
          hl: true,
        },
        { text: 'LAST PICK EXCEPTION: A captain on their final pick may spend their entire remaining budget — no reserve is required.' },
        { text: "PURPOSE: Prevents a captain from 'going all in' and being unable to complete their roster, which would structurally disadvantage their team." },
      ],
    },
    {
      title: 'Bid Validity',
      icon: 'scale' as IconName,
      items: [
        { text: `A bid is invalid if the team's squad is already full (${squadSize} auction picks reached).` },
        { text: 'A bid is invalid if the team has reached the maximum category quota for that player tier.' },
        { text: 'Once declared aloud, a bid cannot be retracted or revised. All bids are binding and final.' },
      ],
    },
    {
      title: 'Auction Order & Format',
      icon: 'trophy' as IconName,
      items: [
        { text: 'The auctioneer may sequence players in any order, or run category-by-category rounds.' },
        { text: "The auctioneer determines the 'Right of First Nomination' within each category." },
        { text: 'After all players are processed, unsold players may re-enter a Flash Round at a reduced price.' },
      ],
    },
    {
      title: 'Dispute Resolution',
      icon: 'alert-circle' as IconName,
      items: [
        { text: "The Tournament Referee's ruling on all matters is final and binding." },
        { text: "Disputes must be raised immediately — before the next player's bidding commences." },
        { text: 'Collusion between captains to suppress prices artificially will result in disqualification.' },
        { text: 'Technical glitches during an active bid trigger a full re-auction of that player.' },
      ],
    },
    {
      title: 'Squad Lock & Post-Auction',
      icon: 'shield-check' as IconName,
      items: [
        { text: `A team's squad is locked once all ${squadSize} picks are made and the full player pool is auctioned.` },
        { text: 'Teams must participate with a complete and valid squad.' },
        { text: 'The list of players in a team cannot be changed after the auction concludes as it will be the final squad list.' },
        { text: 'No trades, swaps, or transfers between teams are permitted after the auction concludes.' },
      ],
    },
  ];

  // ── Draft rules (used when config.mode === 'draft') ──────────────────────────
  const scheduleText = getRoundSchedule(config).map((c, i) => `R${i + 1} ${c}`).join(', ');
  const draftCatLines = config.categories
    .filter((c) => c.draftCount > 0)
    .map((c) => `${c.name.toUpperCase()}: each team drafts ${c.draftCount} (${config.totalTeams * c.draftCount} needed in the pool).`);
  const usingGrid = canUseBalancedGrid(config);

  const draftSections: RuleSection[] = [
    {
      title: 'Tournament Overview',
      icon: 'building' as IconName,
      items: [
        { text: `${config.totalTeams} teams take part. Each team is led by a Captain and drafts players in turns — there is no bidding or budget.` },
        { text: `Each squad has exactly ${config.playersPerTeam} players: 1 Captain (pre-assigned) + ${squadSize} drafted picks.` },
        { text: `The draft runs for ${squadSize} rounds — ${totalSlots} picks in total (${config.totalTeams} teams × ${squadSize}).` },
      ],
    },
    {
      title: 'Draft Order',
      icon: 'refresh' as IconName,
      items: [
        { text: 'Before the draft, teams are randomly shuffled into a base pick order (slots S1 onward) using a recorded seed, so the draw is fair and can be re-verified.', hl: true },
        { text: 'Once confirmed, the base order is locked for the whole draft.' },
      ],
    },
    {
      title: 'Round Structure',
      icon: 'layers' as IconName,
      items: [
        { text: `Each round draws from a single category. Schedule: ${scheduleText}.` },
        ...draftCatLines.map((text) => ({ text })),
      ],
    },
    {
      title: 'Pick Order & Fairness',
      icon: (usingGrid ? 'shield-check' : 'scale') as IconName,
      hl: true,
      items: usingGrid
        ? [
            { text: 'This draft uses the Balanced Custom Grid — a mathematically optimal schedule.', hl: true },
            { text: "Every team's picks are balanced so no slot is systematically advantaged: within each category and overall, the pick-position totals are as equal as the maths allows." },
          ]
        : [
            { text: 'This draft uses a snake order — the pick order reverses every round (first-to-last, then last-to-first), so the team picking last in one round picks first in the next.', hl: true },
          ],
    },
    {
      title: 'Making a Pick',
      icon: 'gavel' as IconName,
      items: [
        { text: "On each pick, only undrafted players of the current round's category may be selected." },
        { text: 'The operator selects a player for the team on the clock and confirms; the pick is recorded and the clock advances to the next team.' },
        { text: 'The most recent pick can be undone. A pick can also be reassigned to the correct team from the Squads tab if a mistake is spotted later.' },
      ],
    },
    {
      title: 'Finalisation',
      icon: 'check-circle' as IconName,
      items: [
        { text: `The draft is complete once all ${totalSlots} picks are made; final squads appear on the Squads tab.` },
        { text: 'Results can be exported as CSV or JSON. No trades, swaps, or transfers are permitted after the draft concludes.' },
      ],
    },
  ];

  const sections = isDraft ? draftSections : auctionSections;

  return (
    <main className={styles.page} aria-label={isDraft ? 'Official draft rules' : 'Official auction rules'}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Official {isDraft ? 'Draft' : 'Auction'} Rules</h1>
        <button
          className={styles.downloadBtn}
          onClick={handleDownload}
          disabled={downloading}
          aria-label="Download rules as PDF"
        >
          {downloading ? 'Generating...' : <><Icon name="arrow-down" size={14} /> Download PDF</>}
        </button>
      </div>

      <p className={styles.pageSubtitle}>
        {config.tournamentName} · {config.totalTeams} teams ·{' '}
        {isDraft
          ? <>{squadSize} draft rounds</>
          : <>{formatPts(config.budget)} pts budget per team</>} ·{' '}
        {config.playersPerTeam} players per squad (incl. captain)
        <br />
        All captains must acknowledge these rules before {isDraft ? 'the draft begins' : 'bidding begins'}.
      </p>

      {sections.map((section, si) => (
        <section key={si} className={styles.section} aria-label={section.title}>
          <h2 className={`${styles.sectionTitle} ${section.hl ? styles.sectionTitleHL : ''}`}>
            <Icon name={section.icon} size={16} style={{ marginRight: 8, flexShrink: 0 }} />
            {section.title}
          </h2>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {section.items.map((item, ii) => (
              <li
                key={ii}
                className={`${styles.ruleItem} ${item.hl ? styles.ruleItemHL : ''}`}
              >
                <span className={`${styles.ruleNum} ${item.hl ? styles.ruleNumHL : ''}`}>
                  {ii + 1}.
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
