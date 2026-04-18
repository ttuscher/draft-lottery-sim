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
| `ThreeStars.tsx` | 3 Stars of the Lottery popup modal | **ACTIVE - MASTER** |
| `SimulatorNav.tsx` | Mode toggle (QUICK/FULL) + action button + attempt counter | Active |
| `NavTabs.tsx` | Top navigation tabs | Active |
| `Ticker.tsx` | Scrolling ticker bar (responsive: slower/smaller on mobile) | Active |
| `CroppedLogo.tsx` | Logo renderer with next/image, scale/crop/retro filter | Active |
| `LiveDrawBoard.tsx` | EMPTIED - unused, safe to delete | Dead |
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
| `src/lib/dynamicOdds.ts` | Pick-slot and draw-1 odds computation |
| `src/lib/lotteryOdds.ts` | Static lottery odds reference |

## Current FastDrawBoard State

### Desktop (always expanded)
- **PICK**: Pick number with colored shadow (green=up, red=down, white=neutral)
- **TEAM**: Logo + two-line display (city in small grey text, team name in `text-sm` below)
- **DRAW 1 / 1ST OVR / 2ND OVR**: Odds percentages on cyan background
- **CHANGE**: Shows after simulation (green ▲ / red ▼ with shadow, matching FullDrawBoard style)
- **PTS / RW / ROW**: Always visible on desktop
- All data columns use `md:w-[10%]` for even distribution
- +/- button hidden on desktop (`md:hidden`)
- Red headers use `wordSpacing: '-0.5em'` for tighter word spacing

### Mobile (collapsible)
- Team shows abbreviation only
- +/- button: small grey (`w-5 h-5`, `bg-gray-400`)
- Expanded adds: PTS, RW, ROW
- Column class: `expandedColClass` = `expanded ? '' : 'hidden md:table-cell'`

### Section Separators
- "LOTTERY TEAMS" - grey background, black text
- "PLAYOFF TEAMS" - grey background, black text

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

## Pending Work
- [x] Pick ownership integration into FastDrawBoard UI (all trades + post-sim flip)
- [ ] Pick ownership integration into FullDrawBoard UI
- [ ] Playoff ordering logic (picks 17-28 by regular season tiebreakers, 29-32 by playoff result)
- [ ] Ottawa always picks 32 regardless of standings
- [ ] DAL/CAR/NYR triangle trade resolution post-sim (compare final pick numbers, NYR keeps better)
