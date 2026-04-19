"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { runSimulation, MAX_MOVE_UP } from '../lib/engine';
import { NHL_TEAMS } from '../data/teams';
import { SeededTeam, LotteryCombo, SimulationResult } from '../data/types';
import { useNHLStandings, NHLTeamStanding } from '../hooks/useNHLStandings';
import { buildDynamicLotteryData } from '../lib/dynamicCombos';
import { computeDynamicPickSlotOdds, computeDraw1Odds, computeConditionalDraw2Odds, computeConditionalPick2Odds } from '../lib/dynamicOdds';
import CroppedLogo from './CroppedLogo';
import { PICK_OWNERSHIP } from '../data/pickOwnership';

/** Renders a percentage with a tightened decimal point */
const RetroNum = ({ value, suffix = '%' }: { value: string; suffix?: string }) => {
  const idx = value.indexOf('.');
  if (idx === -1) return <>{value}{suffix}</>;
  return (
    <span className="retro-num">
      {value.slice(0, idx)}<span className="dec">.</span>{value.slice(idx + 1)}{suffix}
    </span>
  );
};

// ThreeStars modal is only used in FullDrawBoard

interface FastDrawBoardProps {
  triggerRef?: React.MutableRefObject<() => void>;
}

export default function FastDrawBoard({ triggerRef }: FastDrawBoardProps) {
  const { lotteryTeams: lotteryStandings, playoffTeams: playoffStandings } = useNHLStandings();
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [board, setBoard] = useState<SeededTeam[] | null>(null);
  const [mobileTooltip, setMobileTooltip] = useState<string | null>(null);

  const dynamicData = useMemo(() => {
    return buildDynamicLotteryData(lotteryStandings, playoffStandings);
  }, [lotteryStandings, playoffStandings]);

  const odds = useMemo(() => {
    const pickSlotOdds = computeDynamicPickSlotOdds(
      dynamicData.lotteryTeams,
      dynamicData.remappedCombos
    );
    const draw1Odds = computeDraw1Odds(
      dynamicData.lotteryTeams,
      dynamicData.remappedCombos
    );
    return { pickSlotOdds, draw1Odds };
  }, [dynamicData]);

  // Conditional odds computed after simulation (Draw 2 odds given known D1 winner)
  const conditionalOdds = useMemo(() => {
    if (!result) return null;
    const d1Code = result.draw1Winner.team.abbreviation;
    const draw2Odds = computeConditionalDraw2Odds(
      dynamicData.lotteryTeams,
      dynamicData.remappedCombos,
      d1Code
    );
    const pick2Odds = computeConditionalPick2Odds(
      dynamicData.lotteryTeams,
      dynamicData.remappedCombos,
      d1Code
    );
    return { draw2Odds, pick2Odds };
  }, [result, dynamicData]);

  const handleFastDraw = useCallback(() => {
    const simResult = runSimulation(
      dynamicData.lotteryTeams,
      dynamicData.remappedCombos,
      MAX_MOVE_UP
    );
    setResult(simResult);
    setBoard(simResult.finalOrder);
  }, [dynamicData]);

  useEffect(() => {
    if (triggerRef) {
      triggerRef.current = handleFastDraw;
    }
  }, [triggerRef, handleFastDraw]);

  // Dismiss mobile tooltip on tap outside
  useEffect(() => {
    if (!mobileTooltip) return;
    const dismiss = () => setMobileTooltip(null);
    document.addEventListener('click', dismiss);
    return () => document.removeEventListener('click', dismiss);
  }, [mobileTooltip]);

  const { lotteryTeams, playoffTeams, standingsMap } = dynamicData;
  const displayLotteryTeams = board || lotteryTeams;

  const getTeamOdds = (abbrev: string) => {
    const firstOvr = odds.pickSlotOdds[1]?.[abbrev] ?? 0;
    const secondOvr = odds.pickSlotOdds[2]?.[abbrev] ?? 0;
    const d1 = odds.draw1Odds[abbrev] ?? 0;
    const d2 = secondOvr;
    return { firstOvr, secondOvr, d1, d2 };
  };

  const getStats = (abbrev: string): NHLTeamStanding | null => {
    return standingsMap[abbrev] || null;
  };

  // Sticky column styles
  const stickyPickClass = "sticky left-0 z-10 bg-inherit";
  const stickyTeamClass = "sticky left-[32px] sm:left-[48px] z-10 bg-inherit";
  const stickyPickHeadClass = "sticky left-0 z-20 bg-[#B8F6FA]";
  const stickyTeamHeadClass = "sticky left-[32px] sm:left-[48px] z-20 bg-[#B8F6FA]";

  // Cyan fill for odds columns
  const cyanCellClass = "bg-[#E5FCFD]";
  const cyanHeadClass = "bg-[#96EDF6]";

  // On desktop (md:), always show expanded columns. On mobile, toggle via expanded state.
  const expandedColClass = expanded ? '' : 'hidden md:table-cell';
  // Data column width: 6 pre-sim or 5 post-sim columns share the same total space (~66%)
  // PICK ~6% + TEAM ~28% + data ~66% = 100%
  const dataColWidth = result ? 'md:w-[13.2%]' : 'md:w-[11%]';

  return (
    <div className="w-full pb-2">
      <div className="w-full bg-white border-4 border-black p-3 md:px-6 md:pb-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] mx-auto max-w-5xl">

        {/* Header + Expand Button */}
        <div className="flex items-center justify-between mb-3 border-b-4 border-black pb-2">
          <div className="flex-1" />
          <h2 className="text-sm sm:text-base md:text-xl text-center text-[#E2231A] uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: 'var(--font-press-start)', wordSpacing: '-0.5em' }}>
            {result ? '2026 SIMULATED DRAFT ORDER' : '2026 DRAFT LOTTERY ODDS'}
          </h2>
          <div className="flex-1 flex justify-end">
            {!result && (
              <button
                type="button"
                onClick={() => setExpanded(prev => !prev)}
                className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-400 text-white border-2 border-gray-500 shadow-[2px_2px_0px_rgba(0,0,0,0.3)] flex md:hidden items-center justify-center transition-all hover:translate-y-[1px] hover:shadow-[1px_1px_0px_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-none text-xs sm:text-sm font-bold leading-none cursor-pointer"
              >
                {expanded ? '-' : '+'}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto mb-2">
          <table className="text-left border-collapse w-full md:min-w-[800px]">

            <thead>
              <tr className="bg-[#B8F6FA] border-b-4 border-black text-[8px] sm:text-[9px] md:text-xs" style={{ fontFamily: 'var(--font-press-start)' }}>
                <th className={`py-2 px-1 text-center w-8 sm:w-12 md:w-14 whitespace-nowrap ${stickyPickHeadClass}`}>PICK</th>
                <th className={`py-2 px-1 sm:px-2 text-left whitespace-nowrap md:w-[28%] md:min-w-[28%] md:max-w-[28%] ${stickyTeamHeadClass}`}>TEAM</th>
                {/* Secondary logo column (mobile only, hidden desktop) */}
                <th className="py-2 pl-0 pr-0 text-left whitespace-nowrap md:hidden"></th>
                {result ? (
                  <>
                    <th className={`py-2 px-2 text-center whitespace-nowrap ${dataColWidth} ${cyanHeadClass} ${expandedColClass}`}>DRAW 1</th>
                    <th className={`py-2 px-2 text-center whitespace-nowrap ${dataColWidth} ${cyanHeadClass}`}>#1 OVR</th>
                    <th className={`py-2 px-2 text-center whitespace-nowrap ${dataColWidth} ${cyanHeadClass} ${expandedColClass}`}>DRAW 2</th>
                    <th className={`py-2 px-2 text-center whitespace-nowrap ${dataColWidth} ${cyanHeadClass} ${expandedColClass}`}>#2 OVR</th>
                    <th className={`py-2 px-2 text-center whitespace-nowrap ${dataColWidth}`}>CHANGE</th>
                  </>
                ) : (
                  <>
                    <th className={`py-2 px-2 text-center whitespace-nowrap ${dataColWidth} ${cyanHeadClass} ${expandedColClass}`}>DRAW 1</th>
                    <th className={`py-2 px-2 text-center whitespace-nowrap ${dataColWidth} ${cyanHeadClass}`}>#1 OVR</th>
                    <th className={`py-2 px-2 text-center whitespace-nowrap ${dataColWidth} ${cyanHeadClass}`}>#2 OVR</th>
                    <th className={`py-2 px-2 text-center whitespace-nowrap ${dataColWidth} ${expandedColClass}`}>PTS</th>
                    <th className={`py-2 px-2 text-center whitespace-nowrap ${dataColWidth} ${expandedColClass}`}>RW</th>
                    <th className={`py-2 px-2 text-center whitespace-nowrap ${dataColWidth} ${expandedColClass}`}>ROW</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>

              {/* ===== LOTTERY TEAM ROWS ===== */}
              {displayLotteryTeams.map((slot, index) => {
                const pickNum = index + 1;
                const abbrev = slot.team.abbreviation;
                const stats = getStats(abbrev);
                const teamOdds = getTeamOdds(abbrev);

                // Pick trade resolution (desktop only)
                const trade = PICK_OWNERSHIP[abbrev];
                const isResolved = trade?.type === 'resolved';
                const isConditional = trade?.type === 'conditional';
                const ownerTeam = isResolved ? NHL_TEAMS[(trade as { owner: string }).owner] : null;

                // For conditional trades post-sim, resolve whether pick transferred
                let conditionalResolved = false;
                let conditionalTransferred = false;
                let conditionalOwnerTeam: typeof ownerTeam = null;
                if (isConditional && result) {
                  conditionalResolved = true;
                  const threshold = (trade as { protectionThreshold: number }).protectionThreshold;
                  if (pickNum <= threshold) {
                    conditionalTransferred = false; // protected, original team keeps it
                  } else {
                    conditionalTransferred = true;
                    conditionalOwnerTeam = NHL_TEAMS[(trade as { acquirer: string }).acquirer] ?? null;
                  }
                }

                const tooltipText = isResolved && result
                  ? `FROM ${abbrev}`
                  : isResolved
                  ? `${abbrev} TO ${(trade as { owner: string }).owner}:\nTRADE COMPLETE.`
                  : isConditional && conditionalResolved && conditionalTransferred
                  ? `FROM ${abbrev}`
                  : isConditional && conditionalResolved && !conditionalTransferred
                  ? null
                  : isConditional && (abbrev === 'DAL' || abbrev === 'CAR')
                  ? `NYR TO GET BETTER OF CAR/DAL PICK.`
                  : isConditional
                  ? `TOR TO BOS:\nTOP 5 PROTECTED.`
                  : null;
                const tooltipIsRed = isConditional && !conditionalResolved;

                // Triangle trade teams
                const isTriangle = abbrev === 'DAL' || abbrev === 'CAR';
                // Asterisk suffix: ** for OTT, * for triangle trade, nothing else post-sim
                const asterisk = result
                  ? (abbrev === 'OTT' ? '**' : isTriangle ? '*' : '')
                  : (abbrev === 'OTT' ? '**' : tooltipText ? '*' : '');
                // Mobile post-sim: only OTT gets asterisks (triangle footnote hidden on mobile)
                const mobileAsterisk = abbrev === 'OTT' ? '**' : '';
                // Mobile tap tooltip (includes OTT which has no desktop hover tooltip)
                const mTipText = tooltipText ?? (abbrev === 'OTT' ? 'PENALTY SANCTION. PICK 32ND.' : null);

                const isDraw1Winner = result?.draw1Winner?.team?.abbreviation === abbrev;
                const isDraw2Winner = result?.draw2Winner?.team?.abbreviation === abbrev;
                const isWinner = isDraw1Winner || isDraw2Winner;

                const change = slot.seed - pickNum;

                const numClass = 'text-black [text-shadow:2px_2px_0_#fff]';
                let changeLabel = '';
                let changeColor = 'text-gray-400';
                if (result) {
                  if (change > 0) {
                    changeLabel = `▲ ${change}`;
                    changeColor = 'text-green-500 [text-shadow:1.5px_1.5px_0_#000]';
                  } else if (change < 0) {
                    changeLabel = `▼ ${Math.abs(change)}`;
                    changeColor = 'text-[#E2231A]';
                  } else {
                    changeLabel = '—';
                    changeColor = 'text-gray-400';
                  }
                }

                const rowBg = isWinner ? 'bg-[#FFFDE5]' : 'bg-white';
                const oddsCellBg = isWinner ? 'bg-[#FFFDE5]' : cyanCellClass;

                // Grey out stats for resolved trades + conditional trades that transferred
                const statsColorClass = (isResolved || conditionalTransferred) ? 'text-gray-300' : '';

                // Resolved trades always show owner as primary (pre-sim and post-sim)
                // Conditional trades flip only post-sim when transferred
                const shouldFlip = isResolved || (!!result && conditionalTransferred);
                const mainTeam = shouldFlip ? (ownerTeam ?? conditionalOwnerTeam ?? slot.team) : slot.team;
                const mainGreyed = false;

                return (
                  <tr
                    key={abbrev}
                    className={`border-b-2 border-gray-200 hover:bg-[#E5FCFD] transition-colors ${rowBg}`}
                  >
                    <td className={`py-1.5 px-1 w-8 sm:w-12 md:w-14 ${stickyPickClass}`} style={{ backgroundColor: 'inherit' }}>
                      <div className="flex justify-center items-center h-full">
                        <div className={`font-bold text-xs sm:text-sm md:text-base transition-all duration-300 ${numClass}`}>
                          {pickNum}
                        </div>
                      </div>
                    </td>

                    <td className={`py-1.5 px-0 sm:px-1 ${stickyTeamClass} md:w-[28%] md:min-w-[28%] md:max-w-[28%]`} style={{ backgroundColor: 'inherit' }}>
                      <div className="flex items-center gap-1.5 md:gap-2 w-full">
                        {mainTeam.logoLight ? (
                          <CroppedLogo src={mainTeam.logoLight} alt={mainTeam.abbreviation} sizeClass="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10" wrapperClass="shrink-0" />
                        ) : (
                          <span className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center text-[8px] shrink-0">?</span>
                        )}
                        <div className="flex flex-col min-w-0">
                          {result ? (
                            <>
                              <span className="md:hidden font-bold text-[8px] sm:text-[9px] uppercase tracking-tight truncate text-gray-500">{mainTeam.city}</span>
                              <span className="md:hidden font-bold text-[10px] sm:text-[11px] uppercase tracking-tight truncate leading-tight">{mainTeam.name}{mobileAsterisk}</span>
                            </>
                          ) : (
                            <>
                              <span className="md:hidden font-bold text-[8px] sm:text-[9px] uppercase tracking-tight truncate text-gray-500">{mainTeam.city}</span>
                              <span className="md:hidden font-bold text-[10px] sm:text-[11px] uppercase tracking-tight truncate leading-tight">{mainTeam.name}{tooltipText ? '*' : (abbrev === 'OTT' ? '**' : '')}</span>
                            </>
                          )}
                          <span className={`hidden md:block font-bold text-[9px] uppercase tracking-tight whitespace-nowrap ${mainGreyed ? 'text-gray-400' : 'text-gray-500'}`}>{mainTeam.city}</span>
                          <span className={`hidden md:block font-bold text-sm uppercase tracking-tight whitespace-nowrap leading-tight team-name ${mainGreyed ? 'text-gray-400' : ''}`}>{mainTeam.name}{asterisk}</span>
                        </div>
                        {/* Pre-sim only: trade partner logo inside TEAM cell (desktop) */}
                        {!result && tooltipText && (() => {
                          const secondaryAbbrev = isResolved ? abbrev : isConditional ? (trade as { acquirer: string }).acquirer : null;
                          const secondaryTeam = secondaryAbbrev ? NHL_TEAMS[secondaryAbbrev] : null;
                          const secondaryGreyClass = ' opacity-40 grayscale';
                          if (secondaryTeam?.logoLight) {
                            return (
                              <span className="hidden md:inline-flex flex-1 justify-end shrink-0 relative group cursor-default">
                                <CroppedLogo src={secondaryTeam.logoLight} alt={secondaryTeam.abbreviation} sizeClass="w-10 h-10" wrapperClass={`shrink-0${secondaryGreyClass}`} />
                                <span className={`pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 ${tooltipIsRed ? 'bg-[#E2231A]' : 'bg-gray-500'} text-white text-[8px] font-bold uppercase tracking-tight whitespace-pre-line rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 w-[150px]`} style={{ wordSpacing: 'normal' }}>
                                  {tooltipText}
                                </span>
                              </span>
                            );
                          }
                          return (
                            <span className="hidden md:inline-flex flex-1 justify-end shrink-0 relative group cursor-default self-stretch min-w-[40px]">
                              <span className={`pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 mr-1 px-2 py-1 bg-[#E2231A] text-white text-[8px] font-bold uppercase tracking-tight whitespace-pre-line rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 w-[150px]`} style={{ wordSpacing: 'normal' }}>
                                {tooltipText}
                              </span>
                            </span>
                          );
                        })()}
                        {/* Post-sim desktop: FROM logo inside TEAM cell */}
                        {result && shouldFlip && (() => {
                          const fromTeam = NHL_TEAMS[abbrev];
                          if (!fromTeam?.logoLight) return null;
                          return (
                            <span className="hidden md:inline-flex shrink-0 ml-auto">
                              <CroppedLogo src={fromTeam.logoLight} alt={fromTeam.abbreviation} sizeClass="w-10 h-10" wrapperClass="shrink-0 opacity-40 grayscale" />
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Secondary logo column (mobile only) — pre-sim: trade partner, post-sim: FROM logo */}
                    <td className="py-1.5 pl-0 pr-0 md:hidden">
                      {(() => {
                        if (result) {
                          if (!shouldFlip) return null;
                          const fromTeam = NHL_TEAMS[abbrev];
                          if (!fromTeam?.logoLight) return null;
                          return <CroppedLogo src={fromTeam.logoLight} alt={fromTeam.abbreviation} sizeClass="w-6 h-6 sm:w-8 sm:h-8" wrapperClass="shrink-0 opacity-40 grayscale" />;
                        }
                        if (!tooltipText && abbrev !== 'OTT') return null;
                        const mSecondaryAbbrev = isResolved ? abbrev : isConditional ? (trade as { acquirer: string }).acquirer : null;
                        const mSecondaryTeam = mSecondaryAbbrev ? NHL_TEAMS[mSecondaryAbbrev] : null;
                        if (!mSecondaryTeam) return null;
                        return (
                          <div className="flex items-center gap-1 relative">
                            <button
                              type="button"
                              className="shrink-0"
                              onClick={(e) => { e.stopPropagation(); setMobileTooltip(mobileTooltip === abbrev ? null : abbrev); }}
                            >
                              <CroppedLogo src={mSecondaryTeam.logoLight} alt={mSecondaryAbbrev ?? ''} sizeClass="w-6 h-6 sm:w-8 sm:h-8" wrapperClass="opacity-40 grayscale" />
                              {mobileTooltip === abbrev && mTipText && (
                                <span
                                  className={`absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-1 ${tooltipIsRed ? 'bg-[#E2231A]' : 'bg-gray-500'} text-white text-[7px] font-bold uppercase tracking-tight rounded-sm z-40 shadow-[2px_2px_0_rgba(0,0,0,0.5)] w-[32vw] text-left whitespace-pre-line`}
                                  style={{ wordSpacing: 'normal' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {mTipText}
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Data columns: pre-sim (6 cols) vs post-sim (5 cols) */}
                    {result ? (
                      <>
                        {/* DRAW 1 */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg} ${expandedColClass}`}>
                          {teamOdds.d1 > 0 ? <RetroNum value={teamOdds.d1.toFixed(1)} /> : '—'}
                        </td>
                        {/* #1 OVR */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg}`}>
                          {teamOdds.firstOvr > 0 ? <RetroNum value={teamOdds.firstOvr.toFixed(1)} /> : '—'}
                        </td>
                        {/* DRAW 2 (conditional on D1 result) */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg} ${expandedColClass}`}>
                          {(() => {
                            const d2 = conditionalOdds?.draw2Odds[abbrev] ?? 0;
                            return d2 > 0 ? <RetroNum value={d2.toFixed(1)} /> : '—';
                          })()}
                        </td>
                        {/* #2 OVR (conditional on D1 result) */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg} ${expandedColClass}`}>
                          {(() => {
                            const p2 = conditionalOdds?.pick2Odds[abbrev] ?? 0;
                            return p2 > 0 ? <RetroNum value={p2.toFixed(1)} /> : '—';
                          })()}
                        </td>
                        {/* CHANGE */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-[10px] sm:text-[11px] md:text-sm font-bold`}>
                          <span className={`whitespace-nowrap ${changeColor}`}>{changeLabel}</span>
                        </td>
                      </>
                    ) : (
                      <>
                        {/* DRAW 1 */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg} ${expandedColClass}`}>
                          {teamOdds.d1 > 0 ? <RetroNum value={teamOdds.d1.toFixed(1)} /> : '—'}
                        </td>
                        {/* #1 OVR */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg}`}>
                          {teamOdds.firstOvr > 0 ? <RetroNum value={teamOdds.firstOvr.toFixed(1)} /> : '—'}
                        </td>
                        {/* #2 OVR */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg}`}>
                          {teamOdds.secondOvr > 0 ? <RetroNum value={teamOdds.secondOvr.toFixed(1)} /> : '—'}
                        </td>
                        {/* PTS */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-[10px] sm:text-[11px] md:text-sm font-bold ${expandedColClass} ${statsColorClass}`}>
                          {stats?.points ?? '—'}
                        </td>
                        {/* RW */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-[10px] sm:text-[11px] md:text-sm ${expandedColClass} ${statsColorClass}`}>
                          {stats?.regulationWins ?? '—'}
                        </td>
                        {/* ROW */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-[10px] sm:text-[11px] md:text-sm ${expandedColClass} ${statsColorClass}`}>
                          {stats?.regulationPlusOtWins ?? '—'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}


            </tbody>
          </table>
        </div>

        {/* Footnotes */}
        <div className="px-2 md:px-4 pt-3 md:pt-4 pb-0 space-y-0.5">
          {result ? (
            <p className="text-[7px] sm:text-[8px] md:text-[10px] text-gray-500 uppercase tracking-wide" style={{ fontFamily: 'var(--font-press-start)', wordSpacing: '-0.4em' }}>
              *NYR to keep better of DAL/CAR 1st rd pick.
            </p>
          ) : (
            <p className="text-[7px] sm:text-[8px] md:text-[10px] text-gray-500 uppercase tracking-wide" style={{ fontFamily: 'var(--font-press-start)', wordSpacing: '-0.4em' }}>
              *Original pick owner&apos;s season results shown.
            </p>
          )}
        </div>

      </div>

    </div>
  );
}
