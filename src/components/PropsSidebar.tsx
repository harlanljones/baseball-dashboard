import PlayerHeadshot from "@/components/PlayerHeadshot";
import TeamLogo from "@/components/TeamLogo";
import { GOOD_CLASS, BAD_CLASS } from "@/lib/statColor";
import type { PlayerRef, TeamRef } from "@/lib/mlb/types";
import type { PropMarketKey, PropTier, ScoredProp } from "@/lib/odds/types";

const MARKET_LABELS: Record<PropMarketKey, string> = {
  pitcher_strikeouts: "Strikeouts",
  pitcher_outs: "Outs recorded",
  batter_hits: "Hits",
  batter_total_bases: "Total bases",
  batter_home_runs: "Home runs",
  batter_rbis: "RBIs",
  batter_walks: "Walks",
};

const TIER_CLASS: Record<PropTier, string> = {
  "strong-over": GOOD_CLASS,
  "lean-over": "bg-hot/8 text-hot/80",
  neutral: "text-ink/50",
  "lean-under": "bg-cold/8 text-cold/80",
  "strong-under": BAD_CLASS,
};

const TIER_LABEL: Record<PropTier, string> = {
  "strong-over": "Strong over",
  "lean-over": "Lean over",
  neutral: "Neutral",
  "lean-under": "Lean under",
  "strong-under": "Strong under",
};

function formatPrice(price: number): string {
  return price > 0 ? `+${price}` : `${price}`;
}

function PropRow({ prop }: { prop: ScoredProp }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-ink/10 bg-paper px-2.5 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink @2xl:text-base">
          {MARKET_LABELS[prop.marketKey]} {prop.line}
        </div>
        <div className="mt-0.5 space-y-0.5">
          {prop.evidence.map((line, i) => (
            <div key={i} className="break-words text-xs leading-snug text-ink/50">
              {line}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${TIER_CLASS[prop.tier]}`}>
          {TIER_LABEL[prop.tier]}
        </span>
        <span className="nums font-mono text-xs text-ink/60">
          O {formatPrice(prop.overPrice)} / U {formatPrice(prop.underPrice)}
        </span>
      </div>
    </div>
  );
}

function PlayerGroup({ group }: { group: PropPlayerGroup }) {
  const { player, evidence, props } = group;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <PlayerHeadshot personId={player.id} size={20} />
        <span className="text-sm font-semibold text-ink">{player.fullName}</span>
      </div>
      {evidence.length > 0 && (
        <div className="space-y-0.5 pl-[26px]">
          {evidence.map((line, i) => (
            <div key={i} className="break-words text-xs leading-snug text-ink/45">
              {line}
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        {props.map((p, i) => (
          <PropRow key={i} prop={p} />
        ))}
      </div>
    </div>
  );
}

/** One player's props for a team, plus matchup evidence shared across all of them (splits, head-to-head history). */
export interface PropPlayerGroup {
  player: PlayerRef;
  evidence: string[];
  props: ScoredProp[];
}

export interface PropTeamGroup {
  team: TeamRef;
  players: PropPlayerGroup[];
}

/**
 * Presentational — renders the sidebar's content. Owns its own card shell
 * (unlike the page's other `Section`-wrapped children) since it needs to
 * render its own empty state without a surrounding title bar mismatch.
 */
export default function PropsSidebar({ groups }: { groups: PropTeamGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-md border border-ink/10 bg-card p-4 shadow-sm">
        <h2 className="eyebrow text-base">Player props</h2>
        <p className="mt-2 text-sm text-ink/50">No props available for this game.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-ink/10 bg-card p-4 shadow-sm">
      <h2 className="eyebrow mb-3 text-base">Player props</h2>
      <div className="space-y-5 @2xl:grid @2xl:grid-cols-2 @2xl:items-start @2xl:gap-5 @2xl:space-y-0">
        {groups.map(({ team, players }) => (
          <div key={team.id} className="space-y-3">
            <div className="flex items-center gap-1.5 border-b border-ink/10 pb-1.5">
              <TeamLogo teamId={team.id} size={18} />
              <span className="text-xs font-semibold uppercase tracking-wide text-ink/60">
                {team.abbreviation ?? team.name}
              </span>
            </div>
            {players.map((group) => (
              <PlayerGroup key={group.player.id} group={group} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
