---
name: Baseball Dashboard
description: Game-day MLB research dashboard with scoreboard identity, evidence-first prop leans
colors:
  paper: "#f5f5f0"
  card: "#ffffff"
  ink: "#1b2420"
  field: "#173f2c"
  field-deep: "#0e2a1d"
  grass: "#22543c"
  gold: "#d9a13b"
  gold-deep: "#85600e"
  clay: "#a8542f"
  clay-deep: "#8f3f22"
  hot: "#be3e2e"
  hot-deep: "#9c342a"
  cold: "#33689b"
typography:
  display:
    fontFamily: "Barlow Condensed, IBM Plex Sans, sans-serif"
    fontWeight: 600
    textTransform: uppercase
    letterSpacing: "0.02em–0.14em by role"
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "14–16px"
    lineHeight: 1.5
  label:
    fontFamily: "Barlow Condensed, sans-serif"
    fontWeight: 600
    fontSize: "12px"
    letterSpacing: "0.06em"
    textTransform: uppercase
  data:
    fontFamily: "IBM Plex Mono, monospace"
    fontVariantNumeric: tabular-nums
rounded:
  sm: "3px"
  md: "6px"
spacing:
  header: "2.875rem"
  footer: "3.25rem"
  card-padding: "1rem"
components:
  section-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  status-badge-live:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.field-deep}"
    typography: "{typography.label}"
  cta-gold:
    backgroundColor: "transparent"
    textColor: "{colors.gold-deep}"
    rounded: "{rounded.md}"
---

# Design System: Baseball Dashboard

## Overview

**Creative North Star: "The Night Scoreboard"**

The interface is a ballpark scoreboard that happens to run research: a constant field-green structure holds day-game paper surfaces and night-game dark panels, gold marks everything that matters right now (live inning, current sort, the score tick before every heading), and every number is set in a monospace face as if it were wired to an LED plate. Density is honest — this is an Operate tool for bettors, so scanability and evidence outrank decoration, and the brand lives in precise details rather than ornament.

Depth is nearly absent by doctrine. Surfaces are flat cards separated by hairline rules on paper; shadow appears only to lift interactive cards at rest (`shadow-sm`) and under the live-status pill. The one authored flourish is the linescore rendered as a physical scoreboard: inset inning plates with LED-style gutter separation inside a deep-green frame.

**Key Characteristics:**
- Field-green chrome + gold accents on paper/night-paper surfaces
- Barlow Condensed uppercase headings with a gold scoreboard tick (`.eyebrow`)
- IBM Plex Mono with tabular figures for all numerals (`.nums`)
- Flat ruled panels; hairline `border-ink/10` dividers instead of nested boxes
- Evidence-first: every graded value carries color AND a ▲/▼ marker AND words somewhere

## Colors

A restrained ballpark palette: one structural green family, one gold signal, three semantic accents, warm neutrals. Dark mode keeps the same hue structure and swaps surface lightness plus accent brightness.

### Primary
- **Field Green** (#173f2c): header bar, linescore frame, live-status pill. The product's spine.
- **Field Deep** (#0e2a1d): inset plates and highest-contrast text on gold badges.

### Secondary
- **Grass** (#22543c / night #93bfa7): positive lean scores, links' hover state, focus rings, "Final" badge tint.
- **Gold** (#d9a13b / night #e5b54e): attention and liveness — current inning, live badge, weight sliders, the tick before headings.
- **Gold Deep** (#85600e / night #e5b54e): gold as *text* in day mode (AA-safe). Bright gold is for chips/ticks/fills, never small text on paper.

### Tertiary
- **Hot** (#be3e2e) / **Hot Deep** (#9c342a): stat grading "well above average". Red means good here — hot/cold, not stop/go.
- **Cold** (#33689b / night #82aecf): stat grading "well below average"; wind blowing in.
- **Clay** (#a8542f) / **Clay Deep** (#8f3f22): failures only — section errors, error pages. Never scores or directions.

### Neutral
- **Paper** (#f5f5f0 / #101613): page canvas.
- **Card** (#ffffff / #18211c): raised panel fill.
- **Ink** (#1b2420 / #e8eae6): all text; opacity steps ≥65% only (AA floor).

### Named Rules
**The One Goodness Rule.** When a stat is graded, good is always hot-red, bad is always cold-blue, everywhere. Lean *strength* is the exception that speaks in grass/gold. Nothing else encodes good/bad by color.

**The Deep-Twin Rule.** Bright accent shades (gold/hot/clay) are for chips, ticks, fills, and dark surfaces; their `-deep` twins are the only forms allowed as small-day-mode text. Both themes must clear WCAG AA at every pairing.

**Clay Means Broken.** Clay is reserved for failure states. A postponed game, a weak score, an "Under" direction — none of these may wear clay.

## Typography

**Display Font:** Barlow Condensed (500/600/700) — scoreboard lettering.
**Body Font:** IBM Plex Sans (400/500/600).
**Data Font:** IBM Plex Mono (400/500/600) with `.nums` tabular figures.

**Character:** Broadcast-board condensed caps against workmanlike data faces. Numerals never render proportionally.

### Hierarchy
- **Display** (700, 28–30px, uppercase, wide tracking): page titles ("Today's Games").
- **Headline** (600, 18px, `.eyebrow` caps + gold tick): primary section titles.
- **Title** (600, 16px, `.eyebrow` caps): demoted/collapsible sections, team column headers.
- **Sub-title** (600, 16px, sentence case): team names inside sections.
- **Body** (400, 14–16px): descriptions, evidence lines; measure ≤75ch.
- **Label** (600, 10–12px, caps, 0.08em): factor labels, "lean score", table headers.
- **Data** (mono, 14px): every statistic, price, and score.

### Named Rules
**The Tick Rule.** Section identity comes from the gold-tick eyebrow itself — no kicker above a heading, ever; the heading speaks alone.

## Layout

Centered `max-w-5xl` column (`PageContainer`) with 16px gutters, except the game page's full-height split pane (main + collapsible props pane, width persisted). Slate grid: 1 → 2 → 3 columns at 640/1024. Game page stacks eight ranked sections; reference tiers (Season series, Game log) collapse behind `<details>`. Weather conditions sit in one unboxed 4-up strip (2-up mobile). Spacing rhythm: 8px base, generous section gaps (16–24px).

## Elevation & Depth

Flat by default. `shadow-sm` lifts resting cards minimally; `shadow-md` belongs only to floating chrome (live pill). Hierarchy is drawn with hairline `border-ink/10` rules and tonal shifts between paper and card, never with layered boxes-in-boxes.

### Shadow Vocabulary
- **Resting lift** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.05)`): section cards, slate cards.
- **Floating chrome** (`0 4px 6px -1px rgb(0 0 0 / 0.1)`): the live-status pill only.

### Named Rules
**The Ruled-Panel Rule.** Group with spacing and hairlines; never nest a bordered box inside a bordered box.

## Shapes

Small radii only: 6px (`rounded-md`) on cards/chips/buttons, 3px on linescore plates and direction chips. Pill-shaped only for the live-status badge. Borders are 1px hairlines (`ink/10–25`); accent-colored borders appear solely on interactive affordances (CTA outline, hover states).

## Components

### Cards / Containers
- **Corner:** 6px; **Background:** card; **Border:** 1px ink/10; **Shadow:** resting lift; **Padding:** 16px.

### Buttons
- **Shape:** 6px, compact (py-1/py-2).
- **Primary CTA:** transparent fill, gold-deep text + 40%-alpha border; hover washes gold/10.
- **Secondary:** hairline ink border, hover bg-field/5.
- **Destructive-context retry:** solid clay-deep fill, paper text.

### Chips
- **Status badge:** caps Barlow, 2px radius; Live = solid gold on field-deep with pulsing dot; Final = field tint + grass text; Preview/disruption = outlined neutral.
- **Direction chip (Over/Under):** outlined neutral — words carry meaning, color stays out.
- **Tier chip (Strong/Lean):** strong = field tint block; lean = gold-deep semibold text.

### Tables
- Dense data tables: mono numerals, right-aligned stats, sr-only captions, hairline row rules, sortable headers are real buttons with `aria-sort` and ↑/↓ glyphs.

### Signature Component: Linescore
Deep-green frame, 3px gutter-separated inning plates (`field-deep/50` fill), gold underline+bold marking the inning in progress (plus `aria-current` and an sr-only note), R/H/E totals on solid deep plates.

## Do's and Don'ts

### Do:
- **Do** pair every graded color with its ▲/▼ marker and keep legends near graded tables.
- **Do** use `-deep` accent twins for any small text on day-mode surfaces.
- **Do** set all statistics in Plex Mono with `.nums`.
- **Do** collapse reference-tier sections so the research path leads.

### Don't:
- **Don't** rely on color alone for direction, score, or state (PRODUCT.md hard rule).
- **Don't** use bright gold/hot/clay as small text on paper/card in day mode.
- **Don't** put clay on anything that isn't a failure.
- **Don't** nest bordered boxes inside bordered boxes; unbox inner tiles.
- **Don't** add a kicker/label above a heading — the eyebrow heading stands alone.
