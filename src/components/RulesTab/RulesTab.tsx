import { useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { formatPts } from '@/utils/format';
import { downloadRulesPdf } from '@/utils/pdf';
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
  const totalSlots = config.totalTeams * squadSize;
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const subtitle = [
        `${config.tournamentName}`,
        `${config.totalTeams} teams · ${formatPts(config.budget)} pts budget per team · ${config.playersPerTeam} players per squad (incl. captain)`,
        'All captains must acknowledge these rules before bidding begins.',
      ].join('\n');
      const filename = `${config.tournamentName} - Auction Rules.pdf`;
      downloadRulesPdf(config.tournamentName, subtitle, sections, filename);
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

  const sections: RuleSection[] = [
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
        { text: 'Below 400 pts → +20 per bid.', hl: true },
        { text: '400 – 999 pts → +50 per bid.', hl: true },
        { text: '1,000 – 1,999 pts → +100 per bid.', hl: true },
        { text: '2,000+ pts → +200 per bid.', hl: true },
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

  return (
    <main className={styles.page} aria-label="Official auction rules">
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Official Auction Rules</h1>
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
        {formatPts(config.budget)} pts budget per team ·{' '}
        {config.playersPerTeam} players per squad (incl. captain)
        <br />
        All captains must acknowledge these rules before bidding begins.
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
