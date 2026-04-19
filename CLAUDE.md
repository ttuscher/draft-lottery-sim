@AGENTS.md

# Draft Lottery Simulator - Project State

## Master Snapshot: `snapshot-master-2026-04-17/`
v3 master. This is the canonical rollback point. Restore with:
```
cp snapshot-master-2026-04-17/src/FILE src/FILE
```
Previous snapshots: `snapshot-master-2026-04-16/` (pre-v2)

## Architecture
- **Next.js 16** / React 19 / TypeScript / Tailwind CSS v4
- Pixel font: `var(--font-press-start)` ("Press Start 2P")
- 16-bit CRT arcade aesthetic throughout
- NHL API data fetched via `useNHLStandings` hook
- **Deployed on Vercel** — auto-deploys on push to `main`
- Logos optimized: `next/image` with compressed PNGs (44MB → 672KB)
- Global `wordSpacing: '-0.3em'` on `<body>`, `-0.5em` on headers

## Key Files

### Pages
| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Lottery simulator (main page) - hosts FastDrawBoard + FullDrawBoard |
| `src/app/prospects/page.tsx` | Placeholder: "Prospect rankings coming soon..." |
| `src/app/analytics/page.tsx` | Placeholder: "HOCKEY NERD STUFF COMING SOON..." |
| `src/app/prospectrankings/page.tsx` | Redirect to `/prospects` |

### Components
| File | Purpose | Status |
|------|---------|--------|
| `FastDrawBoard.tsx` | Quick-draw simulator table (collapsed/expanded views) | **ACTIVE - MASTER** |
| `FullDrawBoard.tsx` | Ball-by-ball live draw with league/team viewers | **ACTIVE - MASTER** |
| `LiveDrawBoard.tsx` | Manual ball entry live draw with arcade cursor UI | **ACTIVE - MASTER** |
| `OddsGrid.tsx` | Live % odds by pick (Tankathon-style). Sort-to-top for locked teams with `#X` seed label + bright-gold 100% cell + sticky SEED/TEAM columns | **ACTIVE - MASTER** |
| `ThreeStars.tsx` | 3 Stars of the Lottery popup modal | **ACTIVE - MASTER** |
| `SimulatorNav.tsx` | Mode toggle (QUICK/FULL/LIVE) + action button + attempt counter | Active |
| `NavTabs.tsx` | Top navigation tabs | Active |
| `Ticker.tsx` | Scrolling ticker bar (responsive: slower/smaller on mobile) | Active |
| `CroppedLogo.tsx` | Logo renderer with next/image, scale/crop/retro filter | Active |
| `RetroBoard.tsx` | EMPTIED - unused, safe to delete | Dead |

### Data & Logic
| File | Purpose |
|------|---------|
| `src/data/pickOwnership.ts` | 2026 trade data + ownership resolution helpers (**integrated into FastDrawBoard**) |
| `src/data/nhl-standings-2026.json` | **Final 2025-26 standings** (all 82 GP complete, fetched 2026-04-17) |
| `src/data/teams.ts` | NHL team metadata (logos, names, abbreviations) |
| `src/data/types.ts` | Shared TypeScript types |
| `src/hooks/useNHLStandings.ts` | Parses standings from local JSON |
| `src/lib/engine.ts` | Core lottery simulation engine |
| `src/lib/analytics.ts` | Live odds, ball impacts, probability calculations |
| `src/lib/dynamicCombos.ts` | Dynamic combo allocation from standings |
| `src/lib/dynamicOdds.ts` | Pick-slot, draw-1, conditional draw-2, and conditional pick-2 odds |
| `src/lib/lotteryOdds.ts` | Static lottery odds reference |

## Current FastDrawBoard State

### Column Layout
**Fixed columns (never change width between states):**
- **PICK**: `w-8 sm:w-12 md:w-14`, sticky left-0
- **TEAM**: `md:w-[28%] md:min-w-[28%] md:max-w-[28%]`, sticky left-[32px]/[48px]
- **Secondary logo** (mobile only, `md:hidden`): `pl-0 pr-0`

**Pre-sim data columns (6 cols, `md:w-[11%]` each = 66% total):**
- DRAW 1 (`expandedColClass`), #1 OVR (always visible), #2 OVR (always visible), PTS (`expandedColClass`), RW (`expandedColClass`), ROW (`expandedColClass`)

**Post-sim data columns (5 cols, `md:w-[13.2%]` each = 66% total):**
- DRAW 1 (`expandedColClass`), #1 OVR (always visible), DRAW 2 (`expandedColClass`), #2 OVR (`expandedColClass`), CHANGE (always visible)
- DRAW 2 shows conditional probability of winning Draw 2 given known D1 result (via `computeConditionalDraw2Odds`)
- #2 OVR shows conditional probability of landing at pick #2 given known D1 result (via `computeConditionalPick2Odds`)
- `conditionalOdds` useMemo recomputes when `result` changes

### Desktop (always expanded)
- **PICK**: Pick number with white text-shadow
- **TEAM**: Logo + two-line display (city in small grey `text-[9px]`, team name in `text-sm` below)
- Trade partner logos inside TEAM cell (pre-sim: secondary right-aligned, post-sim: FROM logo greyed)
- +/- button hidden on desktop (`md:hidden`)
- Red headers use `wordSpacing: '-0.5em'` for tighter word spacing
- Winner rows highlighted `bg-[#FFFDE5]`

### Mobile (collapsible)
- Team shows full city name + team name (two-line)
- +/- button: small grey (`w-5 h-5`, `bg-gray-400`), only shows pre-sim
- Default visible: #1 OVR + #2 OVR (pre-sim) or #1 OVR + CHANGE (post-sim)
- Expanded adds: DRAW 1, PTS, RW, ROW (pre-sim) or DRAW 1, DRAW 2, #2 OVR (post-sim)
- `expandedColClass` = `expanded ? '' : 'hidden md:table-cell'`

### Pick Ownership Display (desktop only)
**Pre-sim (odds view):**
- Resolved trades: original team greyed (`opacity-40 grayscale`) + name with asterisk, owner logo right-aligned (full color), black tooltip "TRADE CONDITIONS RESOLVED." on hover
- Conditional trades (TOR→BOS): original team shown normally + asterisk, acquirer logo right-aligned (`opacity-50`), red tooltip "TOP 5 PROTECTED. UNRESOLVED."
- Triangle trade (DAL/CAR→NYR): original team + asterisk, NYR logo right-aligned (`opacity-50`), red tooltip "NYR TO KEEP BETTER OF DAL/CAR 1ST RD PICK. UNRESOLVED."
- OTT penalty: asterisk + red tooltip "PENALTY PICK." (no partner logo, invisible hover target with `self-stretch min-w-[40px]`)
- Stats greyed (`text-gray-300`) for resolved trades

**Post-sim (draft order) — FLIPPED:**
- `shouldFlip = !!result && (isResolved || conditionalTransferred)`
- Resolved trades: OWNER shown as primary (full color logo + name + asterisk), original team greyed as secondary right-aligned, black tooltip
- Conditional transferred: acquirer as primary, original greyed as secondary
- Conditional protected (TOR top 5): no flip, original team shown normally, no asterisk
- OTT penalty: same as pre-sim
- Stats remain greyed for resolved/transferred

**Tooltip styling:**
- Resolved/flipped: `bg-black` (black tooltip)
- Conditional/unresolved: `bg-[#E2231A]` (red tooltip)
- All tooltips: `text-[8px] font-bold uppercase`, `wordSpacing: 'normal'`, `group-hover:opacity-100`
- Positioned: `absolute left-full top-1/2 -translate-y-1/2 ml-2` (next to logo)

## Current SimulatorNav State
- Returns React fragment (`<>`) — sticky bar + non-sticky attempts counter
- Sticky bar: `sticky top-[52px] md:top-[62px] z-40 bg-[#96EDF6]`
- Grid: `grid-cols-3 gap-3 md:gap-4`, dropdown `col-span-2`, button `col-span-1`
- Action button uses `invisible` (not `hidden`) in LIVE mode to preserve layout
- Pre-sim spacer: invisible clone of ATTEMPTS row (same grid/font/margins) for consistent gap
- Post-sim: ATTEMPTS text in `col-start-3 col-span-1`, `mt-[0.525rem] md:mt-2 mb-1`

## Current FullDrawBoard State
- Three phases: DRAW_1, DRAW_2, COMPLETE
- Live draw table with ball-by-ball animation
- **Draw results**: Mobile shows "FLA WINS! / OWNS #1 PICK", desktop shows "FLORIDA WINS DRAW 1! / OWNS PICK #1"
- League viewer: ranked odds with live deltas, full city names, `table-fixed` with responsive colgroup
- Team viewer: per-ball impact analysis, full city name in dropdown and selector (uppercase)
- Stats row labels: `text-[8px] sm:text-[9px] md:text-[10px]`
- Complete phase: full draft order with pick/team/change columns
- Green arrows: `text-green-500 [text-shadow:1.5px_1.5px_0_#000]`
- Red headers: `wordSpacing: '-0.5em'`
- Three-tier responsive team names: full city (mobile + lg), abbreviation (md-lg)
- League/team panels: `md:grid-cols-2`, toggle at `md:hidden`

## Current LiveDrawBoard State
- Copied from FullDrawBoard with manual ball entry via `<select>` dropdowns
- Ball entry in active draw row (no separate input section)
- Three slot states: filled (gold ball), active (arcade cursor + dropdown), locked (dim placeholder)
- Sequential entry: `firstEmptyIdx = inputBalls.findIndex(b => b === null)`
- Active slot: larger `w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11` with `arcade-cursor` CSS class
- Dropdown options: `className="text-[#96EDF6] bg-black"`
- Button text: `{phase === 'DRAW_1' ? 'COMPLETE DRAW 1' : 'COMPLETE DRAW 2'}`
- Placeholder: "ENTER NUMBERS TO SEE ODDS CHANGE LIVE..." with `ml-2 sm:ml-3`
- Arcade cursor animation in `globals.css`: `arcadeCursor` keyframes, `step-end`, 0.53s

## Pick Ownership Data (`pickOwnership.ts`)

### Resolved Trades (unconditional)
- DET → STL, ANA → WSH, EDM → SJS, VGK → CGY, MIN → VAN, TBL → SEA, COL → STL
- FLA: condition resolved — Florida KEEPS their pick (fell inside top 10 protection). Removed from trades.

### Conditional Trades
- TOR: Top 5 protected → BOS (`protectionThreshold: 5`)
- DAL: Triangle trade → NYR (`protectionThreshold: 32`, never auto-resolves)
- CAR: Triangle trade → NYR (`protectionThreshold: 32`, never auto-resolves)

### Special Cases
- OTT: "PENALTY PICK." — handled directly in FastDrawBoard via `abbrev === 'OTT'` check (not in pickOwnership.ts)

### Helper Functions
- `resolvePickOwner(teamAbbrev, finalPickNum?)` - returns owning team abbreviation
- `getPickOwnershipDisplay(teamAbbrev, finalPickNum?)` - returns full display info

## Dynamic Odds (`dynamicOdds.ts`)
- `computeDynamicPickSlotOdds(teams, combos)` - exact probability each team lands in each pick slot
- `computeDraw1Odds(teams, combos)` - Draw 1 win probability per team
- `computeConditionalDraw2Odds(teams, combos, d1WinnerCode)` - Draw 2 win probability given known D1 winner (excludes D1 winner + locked-first-pick team)
- `computeConditionalPick2Odds(teams, combos, d1WinnerCode)` - probability of landing at pick #2 given known D1 winner (enumerates all D2 outcomes via `resolveDraftOrder`)

## Layout (`layout.tsx`)
- Header: "PUCKSON.NET" — sticky (`sticky top-0 z-50`), clickable link to `/`
- Body: `wordSpacing: '-0.3em'` globally
- Disclaimer: 3-line desktop layout with `<br className="hidden md:inline" />`, font `text-[7px] sm:text-[9px] md:text-[11px]`
- Footer padding: `pb-14 md:pb-16 pt-1` to center between content and ticker
- Panel top padding: `p-3` on all sizes (desktop sides/bottom: `md:px-6 md:pb-6`)

## CroppedLogo Component
- Uses `next/image` with `fill` + `sizes="48px"` for automatic optimization
- Default scale: 1.45x with overflow-hidden crop
- Per-team override map: `_COL_` → 1.2x (Avalanche logo peak clipping fix)
- Retro filters: saturate 2.2, contrast 1.4, brightness 110%, drop-shadow
- Pixelated image rendering
- Logo PNGs compressed to 200x200 (from 8000x5334)

## Important Lessons / Constraints
1. **NEVER use `table-fixed` or `colgroup`** on the FastDrawBoard table. It destroyed the entire layout.
2. Pick ownership changes must be **content-only** within existing `<td>` cells. Do not alter table structure.
3. Mobile font sizes should remain small (`text-[10px]`). Only desktop (`md:`) should be bumped.
4. The pixel font renders differently relative to viewport width. Mobile text appearing larger than desktop is a known characteristic.
5. Files on the mounted filesystem cannot be deleted via sandbox. Use Write to empty them with a deletion marker instead.
6. Git index.lock may get stuck on the mounted filesystem. User must run `New-Item ".git\index.lock" -Force | Remove-Item -Force` in PowerShell.
7. Snapshot folders must be excluded from TypeScript: `"exclude": ["node_modules", "snapshot-master-*"]` in tsconfig.json.
8. League/Team viewer tables align vertically via matching row padding (`py-[7px]`) and logo sizes (`md:w-7 md:h-7`).
9. Tooltip `wordSpacing` must be set to `'normal'` inline to override the global `-0.3em`.
10. Standalone tooltips (no partner logo, e.g. OTT) need `self-stretch min-w-[40px]` on the hover target span to be hoverable.
11. **PICK and TEAM columns must have fixed widths** on both `<th>` and `<td>`. Percentage-based TEAM (`md:w-[28%]`) with min/max prevents shifting between pre/post sim.
12. **Changing column count is OK** if PICK and TEAM are fixed. Pre-sim 6 data cols and post-sim 5 data cols occupy the same total width (66%) via dynamic `dataColWidth` class.
13. **CSS `sticky` requires parent taller than the sticky element.** SimulatorNav uses React fragment (`<>`) so sticky div is direct child of scrollable container.
14. **Pre-sim and post-sim spacing must match.** SimulatorNav pre-sim spacer is an invisible clone of the ATTEMPTS row structure to guarantee identical gap.
15. **`colSpan` causes browser column width recalculation.** Avoid colSpan; render same structure with different content instead.

## Current OddsGrid State (`OddsGrid.tsx`)
Live pick-slot odds table rendered under the Full / Live Draw boards.
- Header row: SEED, TEAM, 1..N pick columns (N = lottery team count)
- SEED column: original 1..N before any draw completes; once a team locks (≥99.95% at some pick), that team floats to the top with a `#X` tag (X = locked pick) and remaining teams restart at 1, 2, 3... (mirrors how the real draw reorders after each pick)
- 100% cell painted bright gold `bg-[#FFD700]`; other row-max cells pale `bg-[#FFFDE5]`
- Tiny non-zero cells render as `0.0` (threshold `raw < 1e-9`) to match Tankathon
- Sticky SEED + TEAM columns (`left-0` / `left-8 sm:left-9 md:left-11`) survive horizontal scroll
- Resolved-trade row: owner logo shown + `*` + black hover tooltip
- TOR conditional: hover over picks 6+ reveals BOS logo

## Current Algorithm: Cascade (production in `src/lib/engine.ts`)
Ported from Tankathon's 2026 chart. `resolveDraftOrder(teams, d1Winner, d2Winner)`:
1. **D1 cascade**: target index = `max(0, d1OrigIdx - MAX_MOVE_UP)`. Splice D1 winner out, splice into target index.
2. **D2 target in post-D1 frame**: compute in the re-seeded order, apply 10-spot cap against post-D1 index. Bump to `d1Target + 1` if it collides with D1 target.
3. **D2 cascade on `withoutD1`**: splice D2 winner to its target in the D1-excluded view; backward-move guard prevents moving teams down.
4. **Re-insert D1 winner** at its locked target.
Exact-math enumeration in `computeDynamicPickSlotOdds` matches Tankathon to 3 decimals.
Tests: `src/lib/engine.test.ts`, `src/lib/dynamicOdds.test.ts` — 80 passing.

## Responsive breakpoint notes
- Full/Live Draw League + Team panels: stack until `lg:` (1024px), side-by-side ≥ lg. Toggle button pair visible `flex lg:hidden`. Previously was `md:` but panels got squeezed at 768-1023px.
- Stats row label: "CURRENT WIN" (trimmed from "CURRENT WIN %" since top value already carries `%`)
- Lottery balls in Draw table: every slot div has `shrink-0` so flex can't squish them into ovals

## Header renames
- Fast Draw pre-sim: PICK column → "SEED" (reverts to "PICK" post-sim)
- Full / Live Draw league view header: permanent "SEED" (never flips to "RANK")

## Pending Work
- [x] Pick ownership integration into FastDrawBoard UI (all trades + post-sim flip)
- [x] FastDrawBoard column restructure (pre-sim 6 cols / post-sim 5 cols with conditional odds)
- [x] SimulatorNav sticky positioning + consistent pre/post-sim spacing
- [x] LiveDrawBoard manual ball entry with arcade cursor UI
- [x] Cascade algorithm in production engine (matches Tankathon exactly)
- [x] OddsGrid with locked-row float-to-top + sticky SEED/TEAM
- [x] Narrow-desktop responsive fixes (lg breakpoint, oval balls, label wrap)
- [ ] Pick ownership integration into FullDrawBoard UI
- [ ] Playoff ordering logic (picks 17-28 by regular season tiebreakers, 29-32 by playoff result)
- [ ] Ottawa always picks 32 regardless of standings
- [ ] DAL/CAR/NYR triangle trade resolution post-sim (compare final pick numbers, NYR keeps better)
