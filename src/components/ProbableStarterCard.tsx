import PlayerHeadshot from "./PlayerHeadshot";
import { dec2, int } from "@/lib/format";
import { statClass } from "@/lib/statColor";
import type {
  PitcherRecentForm,
  PitcherSplitLine,
  PlayerRef,
  SaberPitching,
  TeamRef,
} from "@/lib/mlb/types";

function teamName(t: TeamRef): string {
  return t.abbreviation ?? t.name;
}

function SplitRow({
  label,
  split,
}: {
  label: string;
  split: PitcherSplitLine | null;
}) {
  return (
    <tr className="border-t border-ink/10">
      <td className="py-1 pr-2 text-left text-ink/60">{label}</td>
      <td className="font-mono py-1 px-2 text-right">{split?.ip ?? "—"}</td>
      <td className={`font-mono py-1 px-2 text-right ${statClass("era", split?.era)}`}>
        {split?.era ?? "—"}
      </td>
      <td className="font-mono py-1 px-2 text-right">{split?.bbPct ?? "—"}</td>
      <td className="font-mono py-1 pl-2 text-right">{split?.kPct ?? "—"}</td>
    </tr>
  );
}

function SeasonStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="font-display text-xs font-semibold uppercase tracking-wider text-ink/50">
        {label}
      </div>
      <div className={`font-mono text-sm ${valueClass ?? ""}`}>{value}</div>
    </div>
  );
}

export default function ProbableStarterCard({
  pitcher,
  team,
  hand,
  season,
  homeAway,
  vsLeft,
  vsRight,
  recentForm,
  homeAwayLabel,
}: {
  pitcher: PlayerRef | null;
  team: TeamRef;
  hand: "L" | "R" | null;
  season: SaberPitching | null;
  homeAway: PitcherSplitLine | null;
  vsLeft: PitcherSplitLine | null;
  vsRight: PitcherSplitLine | null;
  recentForm: PitcherRecentForm | null;
  homeAwayLabel: "Home" | "Road";
}) {
  if (!pitcher) {
    return (
      <div className="min-w-0 rounded-md border border-ink/10 p-3">
        <h3 className="font-display mb-1 text-base font-semibold">{teamName(team)}</h3>
        <p className="text-sm text-ink/50">Probable starter: TBD</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-md border border-ink/10 p-3">
      <h3 className="font-display mb-2 flex items-center gap-2 text-base font-semibold">
        <PlayerHeadshot personId={pitcher.id} size={28} />
        {pitcher.fullName}
        {hand && <span className="text-sm font-normal text-ink/50">({hand})</span>}
        <span className="ml-auto text-sm font-normal text-ink/50">{teamName(team)}</span>
      </h3>

      <div className="mb-3 grid grid-cols-4 gap-2 border-b border-ink/10 pb-3">
        <SeasonStat label="WAR" value={season ? dec2(season.war) : "—"} />
        <SeasonStat
          label="FIP"
          value={season ? dec2(season.fip) : "—"}
          valueClass={statClass("fip", season?.fip)}
        />
        <SeasonStat label="xFIP" value={season ? dec2(season.xfip) : "—"} />
        <SeasonStat
          label="ERA-"
          value={season ? int(season.eraMinus) : "—"}
          valueClass={statClass("eraMinus", season?.eraMinus)}
        />
      </div>

      <table className="nums w-full text-sm">
        <caption className="sr-only">
          {pitcher.fullName} season sabermetrics and situational splits
        </caption>
        <thead>
          <tr>
            <th scope="col" className="font-display py-1 pr-2 text-left text-xs font-semibold uppercase tracking-wider text-ink/50">
              Split
            </th>
            <th scope="col" className="font-display py-1 px-2 text-right text-xs font-semibold uppercase tracking-wider text-ink/50">IP</th>
            <th scope="col" className="font-display py-1 px-2 text-right text-xs font-semibold uppercase tracking-wider text-ink/50">ERA</th>
            <th scope="col" className="font-display py-1 px-2 text-right text-xs font-semibold uppercase tracking-wider text-ink/50">BB%</th>
            <th scope="col" className="font-display py-1 pl-2 text-right text-xs font-semibold uppercase tracking-wider text-ink/50">K%</th>
          </tr>
        </thead>
        <tbody>
          <SplitRow
            label="Season"
            split={
              season
                ? { ip: season.ip ?? "—", era: season.era, bbPct: season.bbPct, kPct: season.kPct }
                : null
            }
          />
          <SplitRow label={homeAwayLabel} split={homeAway} />
          <SplitRow label="vs LHB" split={vsLeft} />
          <SplitRow label="vs RHB" split={vsRight} />
          {recentForm && recentForm.starts === 0 ? (
            <tr className="border-t border-ink/10">
              <td colSpan={5} className="py-1 text-left text-sm text-ink/50">
                No outings in the last 30 days
              </td>
            </tr>
          ) : (
            <SplitRow label="Last 30 days" split={recentForm} />
          )}
        </tbody>
      </table>
      {!season && (
        <p className="mt-2 text-xs text-ink/50">Season stats unavailable.</p>
      )}
    </div>
  );
}
