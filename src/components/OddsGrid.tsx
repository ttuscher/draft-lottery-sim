"use client";

import React, { useMemo } from 'react';
import { NHL_TEAMS } from '../data/teams';
import { SeededTeam, LotteryCombo } from '../data/types';
import { computeLivePickSlotOdds, DrawPhase, phaseLabel } from '../lib/dynamicOdds';
import { PICK_OWNERSHIP } from '../data/pickOwnership';
import CroppedLogo from './CroppedLogo';

interface OddsGridProps {
  teams: SeededTeam[];
  combos: LotteryCombo[];
  phase: DrawPhase;
  drawnBalls: number[];
  draw1Winner?: SeededTeam | null;
  draw2Winner?: SeededTeam | null;
}

/**
 * Live pick-slot odds grid (NHL-style).
 * Rows = teams in seed order. Columns = SEED, TEAM, 1..N pick slots.
 * Each cell shows % chance that team lands at that pick, given drawn balls.
 * Row-max cell is highlighted gold. 0% cells are left blank.
 *
 * Once a team's odds at a pick reach 100% (locked in), that team floats to
 * the top of the grid (ordered by its locked pick number) and the locked
 * cell is painted a brighter gold. SEED and TEAM columns are sticky so the
 * team context is always visible on horizontal scroll.
 */
export default function OddsGrid({
  teams,
  combos,
  phase,
  drawnBalls,
  draw1Winner,
  draw2Winner,
}: OddsGridProps) {
  const n = teams.length;

  const oddsByPick = useMemo(
    () => computeLivePickSlotOdds(teams, combos, phase, drawnBalls, draw1Winner, draw2Winner),
    [teams, combos, phase, drawnBalls, draw1Winner, draw2Winner]
  );

  // Precompute row max per team so we can highlight the modal pick slot.
  const rowMaxByTeam = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of teams) {
      const code = t.team.abbreviation;
      let max = 0;
      for (let pick = 1; pick <= n; pick++) {
        const v = oddsByPick[pick]?.[code] ?? 0;
        if (v > max) max = v;
      }
      map[code] = max;
    }
    return map;
  }, [teams, oddsByPick, n]);

  // Teams with a locked-in (≥99.95%) pick float to the top in pick order
  // with a `#X` seed label matching their locked pick. Remaining teams
  // follow below with seed labels restarting at 1 (mirroring how the draw
  // itself is actually conducted once a winner is locked in).
  const displayRows = useMemo(() => {
    const locked: { team: SeededTeam; pick: number }[] = [];
    const rest: SeededTeam[] = [];
    for (const t of teams) {
      const code = t.team.abbreviation;
      let lockedPick = -1;
      for (let p = 1; p <= n; p++) {
        if ((oddsByPick[p]?.[code] ?? 0) >= 99.95) {
          lockedPick = p;
          break;
        }
      }
      if (lockedPick > 0) locked.push({ team: t, pick: lockedPick });
      else rest.push(t);
    }
    locked.sort((a, b) => a.pick - b.pick);
    const rows: { team: SeededTeam; label: string; isLocked: boolean }[] = [];
    for (const l of locked) {
      rows.push({ team: l.team, label: `#${l.pick}`, isLocked: true });
    }
    for (let i = 0; i < rest.length; i++) {
      rows.push({ team: rest[i], label: String(i + 1), isLocked: false });
    }
    return rows;
  }, [teams, oddsByPick, n]);

  const pickColumns = Array.from({ length: n }, (_, i) => i + 1);

  // Sticky column classes. Left offsets match SEED column widths
  // (w-8=32px, w-9=36px, w-11=44px).
  const stickySeedHead = 'sticky left-0 z-20 bg-[#B8F6FA]';
  const stickyTeamHead = 'sticky left-8 sm:left-9 md:left-11 z-20 bg-[#B8F6FA]';
  const stickySeedCell = 'sticky left-0 z-10 bg-inherit';
  const stickyTeamCell = 'sticky left-8 sm:left-9 md:left-11 z-10 bg-inherit';

  return (
    <div className="w-full bg-white border-4 border-black p-3 md:p-4 shadow-[8px_8px_0px_rgba(0,0,0,1)] mb-4">
      <div className="flex items-center justify-between mb-3 border-b-4 border-black pb-2">
        <h3
          className="text-xs sm:text-sm md:text-base lg:text-base text-[#E2231A] uppercase tracking-wider whitespace-nowrap"
          style={{ fontFamily: 'var(--font-press-start)', wordSpacing: '-0.5em' }}
        >
          % ODDS BY PICK
        </h3>
        <span
          className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap"
          style={{ fontFamily: 'var(--font-press-start)', wordSpacing: '-0.3em' }}
        >
          {phaseLabel(phase, drawnBalls.length)}
        </span>
      </div>

      {/* Horizontal scroll on mobile; fits naturally on desktop */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed" style={{ minWidth: `${n * 40 + 120}px` }}>
          <thead>
            <tr
              className="bg-[#B8F6FA] border-b-4 border-black text-[8px] sm:text-[10px] md:text-[11px]"
              style={{ fontFamily: 'var(--font-press-start)', wordSpacing: 'normal' }}
            >
              <th className={`py-1 pl-0.5 pr-2 md:pr-3 text-center whitespace-nowrap w-8 sm:w-9 md:w-11 ${stickySeedHead}`}>SEED</th>
              <th className={`py-1 pl-2 md:pl-3 text-left whitespace-nowrap w-10 sm:w-12 md:w-12 ${stickyTeamHead}`}>TEAM</th>
              {pickColumns.map((p) => (
                <th
                  key={p}
                  className="py-1 px-0 text-center whitespace-nowrap"
                  style={{ wordSpacing: 'normal' }}
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map(({ team: t, label, isLocked: rowIsLocked }) => {
              const code = t.team.abbreviation;
              const teamInfo = NHL_TEAMS[code];
              const rowMax = rowMaxByTeam[code] ?? 0;

              // Resolved-trade swap: show owner logo/abbrev instead of original,
              // with hover tooltip matching the pattern used elsewhere.
              const trade = PICK_OWNERSHIP[code];
              const isResolved = trade?.type === 'resolved';
              const ownerAbbrev = isResolved ? (trade as { owner: string }).owner : code;
              const displayTeam = isResolved ? (NHL_TEAMS[ownerAbbrev] ?? teamInfo) : teamInfo;
              const tooltipText = isResolved
                ? `${code} TO ${ownerAbbrev}:\nTRADE COMPLETE.`
                : null;

              return (
                <tr
                  key={code}
                  className="bg-white border-b border-gray-200 hover:bg-[#E5FCFD] transition-colors text-[8px] sm:text-[9px] md:text-[10px]"
                >
                  <td
                    className={`py-[6px] px-0.5 text-center font-bold whitespace-nowrap ${stickySeedCell} ${
                      rowIsLocked ? 'text-gray-400' : ''
                    }`}
                    style={{ fontFamily: 'var(--font-press-start)' }}
                  >
                    {label}
                  </td>
                  <td className={`py-[6px] pl-2 md:pl-3 pr-0.5 relative group cursor-default ${stickyTeamCell}`}>
                    <div className="flex items-center gap-0.5">
                      {displayTeam?.logoLight && (
                        <CroppedLogo
                          src={displayTeam.logoLight}
                          sizeClass="w-5 h-5 sm:w-6 sm:h-6"
                          wrapperClass="shrink-0"
                        />
                      )}
                      {isResolved && (
                        <span
                          className="font-bold leading-none"
                          style={{ fontFamily: 'var(--font-press-start)' }}
                        >
                          *
                        </span>
                      )}
                    </div>
                    {tooltipText && (
                      <span
                        className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-500 text-white text-[8px] font-bold uppercase tracking-tight whitespace-pre-line rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 w-[150px]"
                        style={{ wordSpacing: 'normal', fontFamily: 'var(--font-press-start)' }}
                      >
                        {tooltipText}
                      </span>
                    )}
                  </td>
                  {pickColumns.map((p) => {
                    const raw = oddsByPick[p]?.[code] ?? 0;
                    // Only truly zero cells are blank; tiny nonzero values
                    // render as "0.0" to match Tankathon/NHL published charts.
                    const isBlank = raw < 1e-9;
                    // Locked-in cell: team is guaranteed this pick. Painted
                    // a bright gold so it visually separates from plain
                    // row-max highlights.
                    const isLocked = raw >= 99.95;
                    // Row-max highlight: within a hair of the row max and
                    // non-zero, but only for non-locked cells.
                    const isMax =
                      !isBlank && !isLocked && rowMax > 0 && Math.abs(raw - rowMax) < 0.0001;
                    // TOR conditional trade: picks 6+ transfer to BOS (top-5 protected).
                    // On hover, reveal the Bruins logo in place of the odds number.
                    const showBosSwap = code === 'TOR' && p > 5 && !isBlank;
                    return (
                      <td
                        key={p}
                        className={`py-[6px] px-0 text-center font-bold whitespace-nowrap ${
                          isLocked ? 'bg-[#FFD700]' : isMax ? 'bg-[#FFFDE5]' : ''
                        } ${isBlank ? 'text-gray-300' : 'text-black'} ${
                          showBosSwap ? 'relative group/bos cursor-pointer' : ''
                        }`}
                        style={{ fontFamily: 'var(--font-press-start)', letterSpacing: '-0.1em' }}
                      >
                        {showBosSwap ? (
                          <>
                            <span className="group-hover/bos:invisible">
                              {raw.toFixed(1)}
                            </span>
                            <span className="pointer-events-none absolute inset-0 hidden group-hover/bos:flex items-center justify-center">
                              <CroppedLogo
                                src="/logos/20252026_BOS_Logo_Light.png"
                                sizeClass="w-5 h-5 sm:w-6 sm:h-6"
                                wrapperClass="shrink-0"
                              />
                            </span>
                          </>
                        ) : (
                          isBlank ? '' : raw.toFixed(1)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
