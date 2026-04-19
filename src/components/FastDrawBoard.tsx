"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { runSimulation, MAX_MOVE_UP } from '../lib/engine';
import { NHL_TEAMS } from '../data/teams';
import { SeededTeam, LotteryCombo, SimulationResult } from '../data/types';
import { useNHLStandings } from '../hooks/useNHLStandings';
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

  const { lotteryTeams } = dynamicData;
  const displayLotteryTeams = board || lotteryTeams;

  const getTeamOdds = (abbrev: string) => {
    const firstOvr = odds.pickSlotOdds[1]?.[abbrev] ?? 0;
    const secondOvr = odds.pickSlotOdds[2]?.[abbrev] ?? 0;
    const d1 = odds.draw1Odds[abbrev] ?? 0;
    const d2 = secondOvr;
    return { firstOvr, secondOvr, d1, d2 };
  };

  // Sticky column styles. Left offsets must match PICK column width
  // (w-8 = 32px base, md:w-14 = 56px at md+).
  const stickyPickClass = "sticky left-0 z-10 bg-inherit";
  const stickyTeamClass = "sticky left-8 md:left-14 z-10 bg-inherit";
  const stickyPickHeadClass = "sticky left-0 z-20 bg-[#B8F6FA]";
  const stickyTeamHeadClass = "sticky left-8 md:left-14 z-20 bg-[#B8F6FA]";

  // Cyan fill for odds columns
  const cyanCellClass = "bg-[#E5FCFD]";
  const cyanHeadClass = "bg-[#96EDF6]";

  // On desktop (md:), always show expanded columns. On mobile, toggle via expanded state.
  const expandedColClass = expanded ? '' : 'hidden md:table-cell';
  // Data column width: 3 pre-sim or 5 post-sim columns share the same total space (~66%)
  // PICK ~6% + TEAM ~28% + data ~66% = 100%
  const dataColWidth = result ? 'md:w-[13.2%]' : 'md:w-[22%]';

  return (
    <div className="w-full pb-2">
      <div className="panel p-3 md:px-6 md:pb-6 mx-auto max-w-5xl">

        {/* Header + Expand Button */}
        <div className="flex items-center justify-between mb-3 border-b-4 border-black pb-2">
          <div className="flex-1" />
          <h2 className="text-title text-[#E2231A] text-center whitespace-nowrap">
            {result ? '2026 SIMULATED DRAFT ORDER' : '2026 DRAFT LOTTERY ODDS'}
          </h2>
          <div className="flex-1 flex justify-end">
            {!result && (
              <button
                type="button"
                onClick={() => setExpanded(prev => !prev)}
                className="w-5 h-5 md:w-6 md:h-6 bg-gray-400 text-white border-2 border-gray-500 shadow-[2px_2px_0px_rgba(0,0,0,0.3)] flex md:hidden items-center justify-center transition-all hover:translate-y-[1px] hover:shadow-[1px_1px_0px_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-none text-body font-bold leading-none cursor-pointer"
              >
                {expanded ? '-' : '+'}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto mb-2">
          <table className="text-left border-collapse w-full">

            <thead>
              <tr className="bg-[#B8F6FA] border-b-4 border-black text-label">
                <th className={`py-2 px-1 text-center w-8 md:w-14 whitespace-nowrap ${stickyPickHeadClass}`}>{result ? 'PICK' : 'SEED'}</th>
                <th className={`py-2 px-1 md:px-2 text-left whitespace-nowrap md:w-[22%] md:min-w-[22%] md:max-w-[22%] ${stickyTeamHeadClass}`}>TEAM</th>
                {/* Trade partner / FROM logo column — visible at all breakpoints */}
                <th className="py-2 pl-0 pr-0 md:pl-1 md:pr-1 text-left whitespace-nowrap md:w-[6%]"></th>
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
                  </>
                )}
              </tr>
            </thead>

            <tbody>

              {/* ===== LOTTERY TEAM ROWS ===== */}
              {displayLotteryTeams.map((slot, index) => {
                const pickNum = index + 1;
                const abbrev = slot.team.abbreviation;
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
                    <td className={`py-1.5 px-1 w-8 md:w-14 ${stickyPickClass}`} style={{ backgroundColor: 'inherit' }}>
                      <div className="flex justify-center items-center h-full">
                        <div className={`text-num transition-all duration-300 ${numClass}`}>
                          {pickNum}
                        </div>
                      </div>
                    </td>

                    <td className={`py-1.5 px-0 md:px-1 ${stickyTeamClass} md:w-[22%] md:min-w-[22%] md:max-w-[22%]`} style={{ backgroundColor: 'inherit' }}>
                      <div className="flex items-center gap-1.5 md:gap-2 w-full">
                        {mainTeam.logoLight ? (
                          <CroppedLogo src={mainTeam.logoLight} alt={mainTeam.abbreviation} sizeClass="w-6 h-6 md:w-10 md:h-10" wrapperClass="shrink-0" />
                        ) : (
                          <span className="w-6 h-6 md:w-10 md:h-10 flex items-center justify-center text-[9px] md:text-[10px] lg:text-[11px] shrink-0">?</span>
                        )}
                        <div className="flex flex-col min-w-0">
                          {/* Mobile: city on its own line, nickname below */}
                          <span className="md:hidden text-label truncate">{mainTeam.city}</span>
                          {result ? (
                            <span className="md:hidden text-label truncate">{mainTeam.name}{mobileAsterisk}</span>
                          ) : (
                            <span className="md:hidden text-label truncate">{mainTeam.name}{tooltipText ? '*' : (abbrev === 'OTT' ? '**' : '')}</span>
                          )}
                          {/* Desktop: same two-line layout */}
                          <span className={`hidden md:block text-label whitespace-nowrap ${mainGreyed ? 'text-gray-400' : ''}`}>{mainTeam.city}</span>
                          <span className={`hidden md:block text-label whitespace-nowrap team-name ${mainGreyed ? 'text-gray-400' : ''}`}>{mainTeam.name}{asterisk}</span>
                        </div>
                      </div>
                    </td>

                    {/* Trade partner / FROM logo column — dedicated at all breakpoints */}
                    <td className="py-1.5 pl-0 pr-0 md:pl-1 md:pr-1">
                      {(() => {
                        // Post-sim: show FROM logo (greyed) when primary was flipped
                        if (result) {
                          if (!shouldFlip) return null;
                          const fromTeam = NHL_TEAMS[abbrev];
                          if (!fromTeam?.logoLight) return null;
                          return (
                            <CroppedLogo src={fromTeam.logoLight} alt={fromTeam.abbreviation} sizeClass="w-6 h-6 md:w-10 md:h-10" wrapperClass="shrink-0 opacity-40 grayscale" />
                          );
                        }

                        // Pre-sim: partner logo + tooltip
                        if (!tooltipText && abbrev !== 'OTT') return null;
                        const secondaryAbbrev = isResolved ? abbrev : isConditional ? (trade as { acquirer: string }).acquirer : null;
                        const secondaryTeam = secondaryAbbrev ? NHL_TEAMS[secondaryAbbrev] : null;

                        // OTT case: no logo, desktop-only hover tooltip via invisible span
                        if (!secondaryTeam) {
                          return (
                            <span className="hidden md:inline-flex relative group cursor-default self-stretch min-w-[40px] h-10">
                              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[#E2231A] text-white text-[7px] md:text-[8px] lg:text-[9px] uppercase tracking-tight whitespace-pre-line rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 w-[150px]">
                                {mTipText}
                              </span>
                            </span>
                          );
                        }

                        const tipBg = tooltipIsRed ? 'bg-[#E2231A]' : 'bg-gray-500';
                        const showMobileTip = mobileTooltip === abbrev;

                        return (
                          <div className="relative group inline-flex">
                            <button
                              type="button"
                              className="shrink-0 bg-transparent border-0 p-0 cursor-default"
                              onClick={(e) => { e.stopPropagation(); setMobileTooltip(showMobileTip ? null : abbrev); }}
                            >
                              <CroppedLogo src={secondaryTeam.logoLight} alt={secondaryTeam.abbreviation} sizeClass="w-6 h-6 md:w-10 md:h-10" wrapperClass="shrink-0 opacity-40 grayscale" />
                            </button>
                            <span
                              className={`pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 ${tipBg} text-white text-[7px] md:text-[8px] lg:text-[9px] uppercase tracking-tight whitespace-pre-line rounded-sm transition-opacity duration-150 z-40 w-[150px] ${showMobileTip ? 'opacity-100' : 'opacity-0'} md:group-hover:opacity-100`}
                            >
                              {tooltipText}
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Data columns: pre-sim (6 cols) vs post-sim (5 cols) */}
                    {result ? (
                      <>
                        {/* DRAW 1 */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-num ${oddsCellBg} ${expandedColClass}`}>
                          {teamOdds.d1 > 0 ? <RetroNum value={teamOdds.d1.toFixed(1)} /> : '—'}
                        </td>
                        {/* #1 OVR */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-num ${oddsCellBg}`}>
                          {teamOdds.firstOvr > 0 ? <RetroNum value={teamOdds.firstOvr.toFixed(1)} /> : '—'}
                        </td>
                        {/* DRAW 2 (conditional on D1 result) */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-num ${oddsCellBg} ${expandedColClass}`}>
                          {(() => {
                            const d2 = conditionalOdds?.draw2Odds[abbrev] ?? 0;
                            return d2 > 0 ? <RetroNum value={d2.toFixed(1)} /> : '—';
                          })()}
                        </td>
                        {/* #2 OVR (conditional on D1 result) */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-num ${oddsCellBg} ${expandedColClass}`}>
                          {(() => {
                            const p2 = conditionalOdds?.pick2Odds[abbrev] ?? 0;
                            return p2 > 0 ? <RetroNum value={p2.toFixed(1)} /> : '—';
                          })()}
                        </td>
                        {/* CHANGE */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-num`}>
                          <span className={`whitespace-nowrap ${changeColor}`}>{changeLabel}</span>
                        </td>
                      </>
                    ) : (
                      <>
                        {/* DRAW 1 */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-num ${oddsCellBg} ${expandedColClass}`}>
                          {teamOdds.d1 > 0 ? <RetroNum value={teamOdds.d1.toFixed(1)} /> : '—'}
                        </td>
                        {/* #1 OVR */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-num ${oddsCellBg}`}>
                          {teamOdds.firstOvr > 0 ? <RetroNum value={teamOdds.firstOvr.toFixed(1)} /> : '—'}
                        </td>
                        {/* #2 OVR */}
                        <td className={`py-1.5 px-2 text-center ${dataColWidth} text-num ${oddsCellBg}`}>
                          {teamOdds.secondOvr > 0 ? <RetroNum value={teamOdds.secondOvr.toFixed(1)} /> : '—'}
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
            <p className="text-[9px] md:text-[10px] lg:text-[11px] text-gray-500 uppercase tracking-wide">
              *NYR to keep better of DAL/CAR 1st rd pick.
            </p>
          ) : (
            <p className="text-[9px] md:text-[10px] lg:text-[11px] text-gray-500 uppercase tracking-wide">
              *Original pick owner&apos;s season results shown.
            </p>
          )}
        </div>

      </div>

    </div>
  );
}
