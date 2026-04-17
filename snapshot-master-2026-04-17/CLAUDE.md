@AGENTS.md

# Draft Lottery Simulator - Project State

## Master Snapshot: `snapshot-master-2026-04-17/`
v2 master. This is the canonical rollback point. Restore with:
```
cp snapshot-master-2026-04-17/src/FILE src/FILE
```
Previous snapshot: `snapshot-master-2026-04-16/` (pre-v2)

## Architecture
- **Next.js 16** / React 19 / TypeScript / Tailwind CSS v4
- Pixel font: `var(--font-press-start)` ("Press Start 2P")
- 16-bit CRT arcade aesthetic throughout
- NHL API data fetched via `useNHLStandings` hook

## Key Files

### Pages
| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Lottery simulator (main page) - hosts FastDrawBoard + FullDrawBoard |
| `src/app/prospects/page.tsx` | Placeholder: "Prospect rankings and analyst leaderboards coming soon..." |
| `src/app/analytics/page.tsx` | Placeholder: "Nerd stuff coming soon..." |
| `src/app/lotterysimulator/page.tsx` | Redirect to `/` |

### Components
| File | Purpose | Status |
|------|---------|--------|
| `FastDrawBoard.tsx` | Quick-draw simulator table (collapsed/expanded views) | **ACTIVE - MASTER** |
| `FullDrawBoard.tsx` | Ball-by-ball live draw with league/team viewers | **ACTIVE - MASTER** |
| `SimulatorNav.tsx` | Mode toggle (QUICK/FULL) + action button + attempt counter | Active |
| `NavTabs.tsx` | Top navigation tabs | Active |
| `Ticker.tsx` | Scrolling ticker bar | Active |
| `CroppedLogo.tsx` | Logo renderer with scale/crop/retro filter | Active |
| `LiveDrawBoard.tsx` | EMPTIED - unused, safe to delete | Dead |
| `RetroBoard.tsx` | EMPTIED - unused, safe to delete | Dead |

### Data & Logic
| File | Purpose |
|------|---------|
| `src/data/pickOwnership.ts` | 2026 trade data + ownership resolution helpers (NOT yet imported by any component) |
| `src/data/teams.ts` | NHL team metadata (logos, names, abbreviations) |
| `src/data/types.ts` | Shared TypeScript types |
| `src/hooks/useNHLStandings.ts` | Fetches/parses live NHL standings |
| `src/lib/engine.ts` | Core lottery simulation engine |
| `src/lib/analytics.ts` | Live odds, ball impacts, probability calculations |
| `src/lib/dynamicCombos.ts` | Dynamic combo allocation from standings |
| `src/lib/dynamicOdds.ts` | Pick-slot and draw-1 odds computation |
| `src/lib/lotteryOdds.ts` | Static lottery odds reference |
| `src/lib/lotteryRuntime.ts` | EMPTIED - dead code |
| `src/app/api/standings/route.ts` | EMPTIED - deprecated API route |

## Current FastDrawBoard State

### Collapsed View (default)
- **PICK**: Pick number with colored shadow (gold=up, red=down, white=neutral)
- **TEAM**: Logo + full name on desktop, abbreviation on mobile (`md:` breakpoint)
- **DRAW 1**: Draw 1 odds percentage
- **1ST OVR / 2ND OVR**: First/second overall odds (centered alignment)
- **CHANGE**: Shows after simulation (arrows + number, whitespace-nowrap)
- SEED #X sublabel shows below team name after simulation

### Expanded View (+ button)
- TEAM switches to abbreviation on all sizes
- Adds: GP, RECORD (##-##-## zero-padded format), PTS, PTS%, RW, ROW

### Font Sizes
- Mobile: `text-[10px]` for data, `text-[8px]` for headers
- Tablet: `sm:text-[11px]` data, `sm:text-[9px]` headers
- Desktop: `md:text-sm` (14px) data, `md:text-xs` (12px) headers
- Team column max-width: `max-w-[120px] sm:max-w-[160px] md:max-w-[200px]`

### Section Separators
- "LOTTERY TEAMS" - grey background, black text
- "PLAYOFF TEAMS" - grey background, black text

## Current FullDrawBoard State
- Three phases: DRAW_1, DRAW_2, COMPLETE
- Live draw table with ball-by-ball animation
- League viewer: ranked odds with live deltas
- Team viewer: per-ball impact analysis with selector dropdown
- Complete phase: full draft order with pick/team/change columns
- `comboCounts` useMemo optimization (precomputed combo counts per team)

## Pick Ownership Data (`pickOwnership.ts`)
**EXISTS but NOT IMPORTED by any component yet.** Previous integration attempt broke layout; reverted.

### Resolved Trades (unconditional)
- DET -> STL, ANA -> WSH, EDM -> SJS, VGK -> CGY, MIN -> VAN, TBL -> SEA, COL -> STL

### Conditional Trades
- TOR: Top 5 protected -> BOS
- FLA: Top 10 protected -> CHI

### Helper Functions
- `resolvePickOwner(teamAbbrev, finalPickNum?)` - returns owning team abbreviation
- `getPickOwnershipDisplay(teamAbbrev, finalPickNum?)` - returns full display info (showTeam, subLabel, isTransferred, isConditional, isProtected)

### UI Design (approved but not yet implemented)
- **Collapsed pre-draw**: Owner's logo+name, grey "FROM DET" sublabel; conditional shows "TOP 10 PROTECTED -> CHI"
- **Collapsed post-draw**: Owner's logo+name if transferred; no sublabel if protection held
- **Expanded**: Original team greyed out + arrow + owner logo/abbrev; stats greyed for transferred picks

## CroppedLogo Component
- Default scale: 1.45x with overflow-hidden crop
- Per-team override map: `_COL_` -> 1.2x (Avalanche logo peak clipping fix)
- Retro filters: saturate 2.2, contrast 1.4, brightness 110%, drop-shadow
- Pixelated image rendering

## Important Lessons / Constraints
1. **NEVER use `table-fixed` or `colgroup`** on the FastDrawBoard table. It destroyed the entire layout.
2. Pick ownership changes must be **content-only** within existing `<td>` cells. Do not alter table structure.
3. Mobile font sizes should remain small (`text-[10px]`). Only desktop (`md:`) should be bumped.
4. The pixel font renders differently relative to viewport width. Mobile text appearing larger than desktop is a known characteristic.
5. Files on the mounted filesystem cannot be deleted via sandbox. Use Write to empty them with a deletion marker instead.
6. Git index.lock may get stuck on the mounted filesystem. User must manually `rm .git/index.lock` on their machine.

## Pending Work
- [ ] Pick ownership integration into FastDrawBoard UI (data file ready, UI reverted)
- [ ] Pick ownership integration into FullDrawBoard UI
- [ ] Playoff ordering logic (picks 17-28 by regular season tiebreakers, 29-32 by playoff result)
- [ ] Ottawa always picks 32 regardless of standings
- [ ] DAL/CAR/NYR triangle trade logic (NYR gets better of DAL/CAR picks)
