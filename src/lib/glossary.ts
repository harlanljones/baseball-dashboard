/**
 * Plain-language definitions for every specialized term on the dashboard.
 * PRODUCT.md requires metric meanings to be available without hover or
 * prior knowledge; the /glossary route renders this, and components link to
 * it from where the jargon actually appears.
 */

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface GlossaryGroup {
  title: string;
  intro: string;
  terms: GlossaryTerm[];
}

export const GLOSSARY: GlossaryGroup[] = [
  {
    title: "Hitting",
    intro: "Season-long batting rates. All grading leaves values under 10 plate appearances uncolored, because samples that small are noise.",
    terms: [
      { term: "PA", definition: "How many turns a hitter took at the plate, including walks and hit-by-pitches." },
      { term: "AVG", definition: "Hits per at-bat." },
      { term: "OBP", definition: "How often the hitter avoids making an out, counting hits, walks, and hit-by-pitches." },
      { term: "SLG", definition: "Total bases per at-bat, so doubles count more than singles." },
      { term: "OPS", definition: "On-base plus slugging; one number combining getting on base with hitting for power." },
      { term: "wOBA", definition: "Overall hitting value per plate appearance, weighting each outcome by its actual run value instead of treating all reaches alike." },
      { term: "xwOBA", definition: "What wOBA should be based on exit velocity and launch angle, stripping out defense and ballpark luck." },
      { term: "wRC+", definition: "Overall offensive production normalized so 100 is league average; 120 means 20% above." },
      { term: "WAR", definition: "Total player value expressed in wins compared with a bench-caliber replacement." },
      { term: "BB%", definition: "Share of plate appearances ending in a walk; higher is better for hitters." },
      { term: "K%", definition: "Share of plate appearances ending in a strikeout; lower is better for hitters." },
      { term: "BABIP", definition: "Batting average on balls in play. Shown but never graded: it swings mostly on luck and defense, not skill." },
    ],
  },
  {
    title: "Pitching",
    intro: "Season-long pitching rates. Lower is better everywhere here except strikeout-related columns.",
    terms: [
      { term: "IP", definition: "Innings pitched." },
      { term: "ERA", definition: "Earned runs allowed per nine innings." },
      { term: "ERA-", definition: "Park-adjusted ERA scaled so 100 is league average; 85 means 15% better than average." },
      { term: "FIP", definition: "An ERA-style estimate using only walks, strikeouts, and home runs, the outcomes pitchers control most." },
      { term: "xFIP", definition: "FIP with home-run rate normalized to league-average fly-ball volume, smoothing homer luck." },
      { term: "K%-BB%", definition: "Strikeout rate minus walk rate; a compact command measure where higher is better." },
    ],
  },
  {
    title: "Bullpen workload",
    intro: "Availability signals for relief arms, answering who can realistically pitch today.",
    terms: [
      { term: "PY", definition: "Pitches thrown yesterday; heavy counts lower the odds the arm appears today." },
      { term: "P3D", definition: "Pitches over the last three days; the cumulative short-burst fatigue signal behind back-to-back outings." },
    ],
  },
  {
    title: "Props & lean scores",
    intro: "Every scored prop exposes three transparent inputs; nothing on this site guarantees outcomes.",
    terms: [
      { term: "Lean score", definition: "A 0–100 composite of model confidence, statistical edge, and market value, weighted by the sliders on the props board. It ranks research interest, not probability." },
      { term: "Model confidence", definition: "How complete and stable the supporting sample is; more games and steadier rates raise it." },
      { term: "Statistical edge", definition: "How far the player's season rate sits from the posted line, the gap the bet is riding on." },
      { term: "Market value", definition: "An odds-based price signal comparing the posted price to the other inputs; not a fair-probability estimate." },
      { term: "Over / Under + line", definition: "Bet direction and number: \"Over 6.5 strikeouts\" needs seven or more." },
      { term: "Prices (+150 / −120)", definition: "American odds. A positive price pays that profit on a 100 stake; a negative price stakes that amount to win 100." },
      { term: "Strong / Lean / Neutral", definition: "Strength tiers derived from the score. Strong means the inputs align clearly in one direction; lean means moderate alignment; neutral means no signal worth acting on." },
      { term: "Partial data", definition: "At least one input is missing, often odds or a small sample, so treat the score as understated rather than broken." },
    ],
  },
  {
    title: "How cell grading works",
    intro: "One encoding across every table on the site.",
    terms: [
      { term: "▲ Hot (red)", definition: "Well above the good threshold or top quartile. Red means good here, hot streak rather than stop sign." },
      { term: "▼ Cold (blue)", definition: "Well below the bad threshold or bottom quartile." },
      { term: "No marker", definition: "Inside the average band, deliberately ungraded." },
    ],
  },
];
