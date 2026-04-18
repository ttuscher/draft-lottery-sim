"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { runSimulation, MAX_MOVE_UP } from '../lib/engine';
import { NHL_TEAMS } from '../data/teams';
import { SeededTeam, LotteryCombo, SimulationResult } from '../data/types';
import { useNHLStandings, NHLTeamStanding } from '../hooks/useNHLStandings';
import { buildDynamicLotteryData } from '../lib/dynamicCombos';
import { computeDynamicPickSlotOdds, computeDraw1Odds } from '../lib/dynamicOdds';
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
  // Post-sim + expanded: hide 2ND OVR on mobile to make room for trade partner column
  const hide2ndOvrClass = (result && expanded) ? 'hidden md:table-cell' : '';

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
          <table className={`text-left border-collapse w-full ${result ? 'md:min-w-[960px]' : 'md:min-w-[800px]'}`}>

            <thead>
              <tr className="bg-[#B8F6FA] border-b-4 border-black text-[8px] sm:text-[9px] md:text-xs" style={{ fontFamily: 'var(--font-press-start)' }}>
                <th className={`py-2 px-1 text-center w-8 sm:w-12 whitespace-nowrap ${stickyPickHeadClass}`}>PICK</th>
                <th className={`py-2 px-1 sm:px-2 text-left whitespace-nowrap md:w-[1%] ${stickyTeamHeadClass}`}>TEAM</th>
                {result ? (
                  <th className="py-2 pl-2 sm:pl-3 pr-0 text-left whitespace-nowrap md:w-[1%]">FROM</th>
                ) : (
                  <th className="py-2 pl-2 sm:pl-3 pr-0 text-left whitespace-nowrap md:hidden"></th>
                )}
                {result && (
                  <th className="py-2 px-2 text-center w-14 sm:w-20 md:w-[8%] whitespace-nowrap">CHANGE</th>
                )}
                <th className={`py-2 px-2 text-center whitespace-nowrap md:w-[12%] ${cyanHeadClass} ${result ? 'hidden md:table-cell' : expandedColClass}`}>DRAW 1</th>
                <th className={`py-2 px-2 text-center whitespace-nowrap md:w-[12%] ${cyanHeadClass} ${result ? 'hidden md:table-cell' : ''}`}>#1 OVR</th>
                <th className={`py-2 px-2 text-center whitespace-nowrap md:w-[12%] ${cyanHeadClass} ${result ? 'hidden md:table-cell' : hide2ndOvrClass}`}>#2 OVR</th>
                <th className={`py-2 px-2 text-center whitespace-nowrap md:w-[12%] ${result ? 'hidden' : expandedColClass}`}>PTS</th>
                <th className={`py-2 px-2 text-center whitespace-nowrap md:w-[12%] ${result ? 'hidden' : expandedColClass}`}>RW</th>
                <th className={`py-2 px-2 text-center whitespace-nowrap md:w-[12%] ${result ? 'hidden' : expandedColClass}`}>ROW</th>
              </tr>
            </thead>

            <tbody>

              {/* ===== LOTTERY TEAMS SEPARATOR ===== */}
              <tr>
                <td
                  colSpan={99}
                  className="py-1.5 px-2 bg-gray-300 text-black text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-widest text-left border-b-2 border-black"
                  style={{ fontFamily: 'var(--font-press-start)' }}
                >
                  LOTTERY TEAMS
                </td>
              </tr>

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
                  ? `TRADE CONDITIONS RESOLVED.`
                  : isConditional && conditionalResolved && conditionalTransferred
                  ? `FROM ${abbrev}`
                  : isConditional && conditionalResolved && !conditionalTransferred
                  ? null
                  : isConditional
                  ? `${(trade as { protection: string }).protection}. UNRESOLVED.`
                  : null;

                // Triangle trade teams
                const isTriangle = abbrev === 'DAL' || abbrev === 'CAR' || abbrev === 'NYR';
                // Asterisk suffix: ** for OTT, * for triangle trade, nothing else post-sim
                const asterisk = result
                  ? (abbrev === 'OTT' ? '**' : isTriangle ? '*' : '')
                  : (abbrev === 'OTT' ? '**' : tooltipText ? '*' : '');
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

                // Post-sim: flip display — show owner as primary, original team as greyed secondary
                const shouldFlip = !!result && (isResolved || conditionalTransferred);
                const mainTeam = shouldFlip ? (ownerTeam ?? conditionalOwnerTeam ?? slot.team) : slot.team;
                const mainGreyed = !shouldFlip && isResolved;

                return (
                  <tr
                    key={abbrev}
                    className={`border-b-2 border-gray-200 hover:bg-[#E5FCFD] transition-colors ${rowBg}`}
                  >
                    <td className={`py-1.5 px-1 ${stickyPickClass}`} style={{ backgroundColor: 'inherit' }}>
                      <div className="flex justify-center items-center h-full">
                        <div className={`font-bold text-xs sm:text-sm md:text-base transition-all duration-300 ${numClass}`}>
                          {pickNum}
                        </div>
                      </div>
                    </td>

                    <td className={`py-1.5 px-0 sm:px-1 ${stickyTeamClass} max-w-[120px] sm:max-w-[160px] md:max-w-none md:w-[1%]`} style={{ backgroundColor: 'inherit' }}>
                      <div className="flex items-center gap-1.5 md:gap-2 w-full">
                        {mainTeam.logoLight ? (
                          <CroppedLogo src={mainTeam.logoLight} alt={mainTeam.abbreviation} sizeClass="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10" wrapperClass={`shrink-0${mainGreyed ? ' opacity-40 grayscale' : ''}`} />
                        ) : (
                          <span className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center text-[8px] shrink-0">?</span>
                        )}
                        <div className="flex flex-col min-w-0">
                          {result ? (
                            <div className="md:hidden flex flex-col min-w-0" style={{ wordSpacing: '-0.5em' }}>
                              <span className="font-bold text-[7px] sm:text-[8px] uppercase tracking-tight truncate text-gray-500">{mainTeam.city}</span>
                              <span className="font-bold text-[10px] sm:text-[11px] uppercase tracking-tight truncate leading-tight">{mainTeam.name}{asterisk}</span>
                            </div>
                          ) : (
                            <span className="md:hidden font-bold text-[10px] sm:text-[11px] uppercase tracking-tight truncate">
                              {shouldFlip ? mainTeam.abbreviation : abbrev}{abbrev === 'OTT' ? '**' : ''}
                            </span>
                          )}
                          <span className={`hidden md:block font-bold text-[9px] uppercase tracking-tight whitespace-nowrap ${mainGreyed ? 'text-gray-400' : 'text-gray-500'}`}>{mainTeam.city}</span>
                          <span className={`hidden md:block font-bold text-sm uppercase tracking-tight whitespace-nowrap leading-tight team-name ${mainGreyed ? 'text-gray-400' : ''}`}>{mainTeam.name}{asterisk}</span>
                        </div>
                        {/* Pre-sim only: trade partner logo inside TEAM cell (desktop) */}
                        {!result && tooltipText && (() => {
                          const secondaryAbbrev = isResolved ? (trade as { owner: string }).owner : isConditional ? (trade as { acquirer: string }).acquirer : null;
                          const secondaryTeam = secondaryAbbrev ? NHL_TEAMS[secondaryAbbrev] : null;
                          const secondaryGreyClass = isResolved ? '' : ' opacity-50';
                          if (secondaryTeam?.logoLight) {
                            return (
                              <span className="hidden md:inline-flex flex-1 justify-end shrink-0 relative group cursor-default">
                                <CroppedLogo src={secondaryTeam.logoLight} alt={secondaryTeam.abbreviation} sizeClass="w-10 h-10" wrapperClass={`shrink-0${secondaryGreyClass}`} />
                                <span className={`pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 ${isResolved ? 'bg-black' : 'bg-[#E2231A]'} text-white text-[8px] font-bold uppercase tracking-tight whitespace-nowrap rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30`} style={{ wordSpacing: 'normal' }}>
                                  {tooltipText}
                                </span>
                              </span>
                            );
                          }
                          return (
                            <span className="hidden md:inline-flex flex-1 justify-end shrink-0 relative group cursor-default self-stretch min-w-[40px]">
                              <span className={`pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 mr-1 px-2 py-1 bg-[#E2231A] text-white text-[8px] font-bold uppercase tracking-tight whitespace-nowrap rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30`} style={{ wordSpacing: 'normal' }}>
                                {tooltipText}
                              </span>
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                    {/* FROM / trade partner column */}
                    <td className={`py-1.5 pl-2 sm:pl-3 pr-0 ${result ? '' : 'md:hidden'}`}>
                      {(() => {
                        if (result) {
                          // Post-sim: show original team as FROM
                          if (!shouldFlip) return null;
                          const fromTeam = NHL_TEAMS[abbrev];
                          if (!fromTeam) return null;
                          return (
                            <div className="flex items-center gap-1 md:gap-2">
                              <CroppedLogo src={fromTeam.logoLight} alt={fromTeam.abbreviation} sizeClass="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10" wrapperClass="shrink-0 opacity-40 grayscale" />
                              <span className="md:hidden font-bold text-[10px] sm:text-[11px] uppercase tracking-tight text-gray-500">{fromTeam.abbreviation}</span>
                              <div className="hidden md:flex flex-col min-w-0">
                                <span className="font-bold text-[9px] uppercase tracking-tight whitespace-nowrap text-gray-400">{fromTeam.city}</span>
                                <span className="font-bold text-sm uppercase tracking-tight whitespace-nowrap leading-tight text-gray-400">{fromTeam.name}</span>
                              </div>
                            </div>
                          );
                        }
                        // Pre-sim mobile: trade partner with tappable tooltip
                        const mPartnerAbbrev = isResolved ? (trade as { owner: string }).owner : isConditional ? (trade as { acquirer: string }).acquirer : null;
                        const mPartnerTeam = mPartnerAbbrev ? NHL_TEAMS[mPartnerAbbrev] : null;
                        if (!mPartnerTeam) return null;
                        const mGreyed = !isResolved && isConditional;
                        return (
                          <div className="flex items-center gap-1 relative md:hidden">
                            <CroppedLogo src={mPartnerTeam.logoLight} alt={mPartnerTeam.abbreviation} sizeClass="w-6 h-6 sm:w-8 sm:h-8" wrapperClass={`shrink-0${mGreyed ? ' opacity-40 grayscale' : ''}`} />
                            <button
                              type="button"
                              className={`font-bold text-[10px] sm:text-[11px] uppercase tracking-tight ${mGreyed ? 'text-gray-400' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setMobileTooltip(mobileTooltip === abbrev ? null : abbrev); }}
                            >
                              {mPartnerTeam.abbreviation}*
                              {mobileTooltip === abbrev && mTipText && (
                                <span
                                  className="absolute left-0 top-full mt-0.5 px-2 py-1 bg-black text-white text-[8px] font-bold uppercase tracking-tight whitespace-nowrap rounded-sm z-40 shadow-[2px_2px_0_rgba(0,0,0,0.5)]"
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

                    {result && (
                      <td className="py-1.5 px-2 text-center md:w-[8%]">
                        <span className={`font-bold text-[10px] sm:text-[11px] md:text-sm whitespace-nowrap ${changeColor}`}>
                          {changeLabel}
                        </span>
                      </td>
                    )}

                    {/* Odds columns — cyan fill, gold for winners */}
                    <td className={`py-1.5 px-2 text-center md:w-[12%] text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg} ${result ? 'hidden md:table-cell' : expandedColClass}`}>
                      {teamOdds.d1 > 0 ? <RetroNum value={teamOdds.d1.toFixed(1)} /> : '—'}
                    </td>
                    <td className={`py-1.5 px-2 text-center md:w-[12%] text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg} ${result ? 'hidden md:table-cell' : ''}`}>
                      {teamOdds.firstOvr > 0 ? <RetroNum value={teamOdds.firstOvr.toFixed(1)} /> : '—'}
                    </td>
                    <td className={`py-1.5 px-2 text-center md:w-[12%] text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg} ${result ? 'hidden md:table-cell' : hide2ndOvrClass}`}>
                      {teamOdds.secondOvr > 0 ? <RetroNum value={teamOdds.secondOvr.toFixed(1)} /> : '—'}
                    </td>

                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm font-bold ${result ? 'hidden' : expandedColClass} ${statsColorClass}`}>
                      {stats?.points ?? '—'}
                    </td>
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm ${result ? 'hidden' : expandedColClass} ${statsColorClass}`}>
                      {stats?.regulationWins ?? '—'}
                    </td>
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm ${result ? 'hidden' : expandedColClass} ${statsColorClass}`}>
                      {stats?.regulationPlusOtWins ?? '—'}
                    </td>
                  </tr>
                );
              })}

              {/* ===== PLAYOFF TEAMS SEPARATOR ===== */}
              <tr>
                <td
                  colSpan={99}
                  className="py-1.5 px-2 bg-gray-300 text-black text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-widest text-left border-y-2 border-black"
                  style={{ fontFamily: 'var(--font-press-start)' }}
                >
                  PLAYOFF TEAMS
                </td>
              </tr>

              {/* ===== PLAYOFF TEAM ROWS ===== */}
              {playoffTeams.map((slot, index) => {
                const pickNum = 17 + index;
                const abbrev = slot.team.abbreviation;
                const stats = getStats(abbrev);

                // Pick trade resolution (desktop only)
                const pTrade = PICK_OWNERSHIP[abbrev];
                const pIsResolved = pTrade?.type === 'resolved';
                const pIsConditional = pTrade?.type === 'conditional';
                const pTooltipText = pIsResolved && result
                  ? `FROM ${abbrev}`
                  : pIsResolved
                  ? `TRADE CONDITIONS RESOLVED.`
                  : pIsConditional
                  ? `${(pTrade as { protection: string }).protection}. UNRESOLVED.`
                  : null;

                const pIsTriangle = abbrev === 'DAL' || abbrev === 'CAR' || abbrev === 'NYR';
                const pAsterisk = result
                  ? (abbrev === 'OTT' ? '**' : pIsTriangle ? '*' : '')
                  : (abbrev === 'OTT' ? '**' : pTooltipText ? '*' : '');
                const pMTipText = pTooltipText ?? (abbrev === 'OTT' ? 'PENALTY SANCTION. PICK 32ND.' : null);

                // Post-sim: flip display — show owner as primary, original team as greyed secondary
                const pShouldFlip = !!result && pIsResolved;
                const pOwnerTeam = pIsResolved ? NHL_TEAMS[(pTrade as { owner: string }).owner] : null;
                const pMainTeam = pShouldFlip ? (pOwnerTeam ?? slot.team) : slot.team;
                const pMainGreyed = !pShouldFlip && pIsResolved;

                return (
                  <tr
                    key={abbrev}
                    className="border-b-2 border-gray-200 hover:bg-gray-50 transition-colors bg-white"
                  >
                    <td className={`py-1.5 px-1 ${stickyPickClass}`} style={{ backgroundColor: 'inherit' }}>
                      <div className="flex justify-center items-center h-full">
                        <div className="font-bold text-xs sm:text-sm md:text-base text-gray-400">
                          {pickNum}
                        </div>
                      </div>
                    </td>

                    <td className={`py-1.5 px-0 sm:px-1 ${stickyTeamClass} max-w-[120px] sm:max-w-[160px] md:max-w-none md:w-[1%]`} style={{ backgroundColor: 'inherit' }}>
                      <div className="flex items-center gap-1.5 md:gap-2 w-full">
                        {pMainTeam.logoLight ? (
                          <CroppedLogo src={pMainTeam.logoLight} alt={pMainTeam.abbreviation} sizeClass="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10" wrapperClass={`shrink-0 ${pMainGreyed ? 'opacity-30 grayscale' : 'opacity-60'}`} />
                        ) : (
                          <span className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center text-[8px] shrink-0 text-gray-400">?</span>
                        )}
                        <div className="flex flex-col min-w-0">
                          {result ? (
                            <div className="md:hidden flex flex-col min-w-0" style={{ wordSpacing: '-0.5em' }}>
                              <span className="font-bold text-[7px] sm:text-[8px] uppercase tracking-tight truncate text-gray-400">{pMainTeam.city}</span>
                              <span className="font-bold text-[10px] sm:text-[11px] uppercase tracking-tight truncate leading-tight text-gray-500">{pMainTeam.name}{pAsterisk}</span>
                            </div>
                          ) : (
                            <span className="md:hidden font-bold text-[10px] sm:text-[11px] uppercase tracking-tight truncate text-gray-500">
                              {pShouldFlip ? pMainTeam.abbreviation : abbrev}{abbrev === 'OTT' ? '**' : ''}
                            </span>
                          )}
                          <span className={`hidden md:block font-bold text-[9px] uppercase tracking-tight whitespace-nowrap ${pMainGreyed ? 'text-gray-300' : 'text-gray-400'}`}>{pMainTeam.city}</span>
                          <span className={`hidden md:block font-bold text-sm uppercase tracking-tight whitespace-nowrap leading-tight team-name ${pMainGreyed ? 'text-gray-300' : 'text-gray-500'}`}>{pMainTeam.name}{pAsterisk}</span>
                        </div>
                        {/* Pre-sim only: trade partner logo inside TEAM cell (desktop) */}
                        {!result && pTooltipText && (() => {
                          const pSecondaryAbbrev = pIsResolved ? (pTrade as { owner: string }).owner : pIsConditional ? (pTrade as { acquirer: string }).acquirer : null;
                          const pSecondaryTeam = pSecondaryAbbrev ? NHL_TEAMS[pSecondaryAbbrev] : null;
                          const pSecondaryGreyClass = pIsResolved ? '' : ' opacity-50';
                          if (pSecondaryTeam?.logoLight) {
                            return (
                              <span className="hidden md:inline-flex flex-1 justify-end shrink-0 relative group cursor-default">
                                <CroppedLogo src={pSecondaryTeam.logoLight} alt={pSecondaryTeam.abbreviation} sizeClass="w-10 h-10" wrapperClass={`shrink-0${pSecondaryGreyClass}`} />
                                <span className={`pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 ${pIsResolved ? 'bg-black' : 'bg-[#E2231A]'} text-white text-[8px] font-bold uppercase tracking-tight whitespace-nowrap rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30`} style={{ wordSpacing: 'normal' }}>
                                  {pTooltipText}
                                </span>
                              </span>
                            );
                          }
                          return (
                            <span className="hidden md:inline-flex flex-1 justify-end shrink-0 relative group cursor-default self-stretch min-w-[40px]">
                              <span className={`pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 mr-1 px-2 py-1 bg-[#E2231A] text-white text-[8px] font-bold uppercase tracking-tight whitespace-nowrap rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30`} style={{ wordSpacing: 'normal' }}>
                                {pTooltipText}
                              </span>
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                    {/* FROM / trade partner column */}
                    <td className={`py-1.5 pl-2 sm:pl-3 pr-0 ${result ? '' : 'md:hidden'}`}>
                      {(() => {
                        if (result) {
                          if (!pShouldFlip) return null;
                          const fromTeam = NHL_TEAMS[abbrev];
                          if (!fromTeam) return null;
                          return (
                            <div className="flex items-center gap-1 md:gap-2">
                              <CroppedLogo src={fromTeam.logoLight} alt={fromTeam.abbreviation} sizeClass="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10" wrapperClass="shrink-0 opacity-30 grayscale" />
                              <span className="md:hidden font-bold text-[10px] sm:text-[11px] uppercase tracking-tight text-gray-500">{fromTeam.abbreviation}</span>
                              <div className="hidden md:flex flex-col min-w-0">
                                <span className="font-bold text-[9px] uppercase tracking-tight whitespace-nowrap text-gray-300">{fromTeam.city}</span>
                                <span className="font-bold text-sm uppercase tracking-tight whitespace-nowrap leading-tight text-gray-300">{fromTeam.name}</span>
                              </div>
                            </div>
                          );
                        }
                        // Pre-sim mobile: trade partner with tappable tooltip
                        const mPartnerAbbrev = pIsResolved ? (pTrade as { owner: string }).owner : pIsConditional ? (pTrade as { acquirer: string }).acquirer : null;
                        const mPartnerTeam = mPartnerAbbrev ? NHL_TEAMS[mPartnerAbbrev] : null;
                        if (!mPartnerTeam) return null;
                        const mGreyed = !pIsResolved && pIsConditional;
                        return (
                          <div className="flex items-center gap-1 relative md:hidden">
                            <CroppedLogo src={mPartnerTeam.logoLight} alt={mPartnerTeam.abbreviation} sizeClass="w-6 h-6 sm:w-8 sm:h-8" wrapperClass={`shrink-0${mGreyed ? ' opacity-40 grayscale' : ''}`} />
                            <button
                              type="button"
                              className={`font-bold text-[10px] sm:text-[11px] uppercase tracking-tight ${mGreyed ? 'text-gray-400' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setMobileTooltip(mobileTooltip === abbrev ? null : abbrev); }}
                            >
                              {mPartnerTeam.abbreviation}*
                              {mobileTooltip === abbrev && pMTipText && (
                                <span
                                  className="absolute left-0 top-full mt-0.5 px-2 py-1 bg-black text-white text-[8px] font-bold uppercase tracking-tight whitespace-nowrap rounded-sm z-40 shadow-[2px_2px_0_rgba(0,0,0,0.5)]"
                                  style={{ wordSpacing: 'normal' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {pMTipText}
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      })()}
                    </td>

                    {result && (
                      <td className="py-1.5 px-2 text-center md:w-[8%]">
                        <span className="font-bold text-[10px] sm:text-[11px] md:text-sm text-gray-400">—</span>
                      </td>
                    )}

                    {/* Odds columns — cyan fill, dashes for playoff teams */}
                    <td className={`py-1.5 px-2 text-center md:w-[12%] text-[10px] sm:text-[11px] md:text-sm text-gray-400 ${cyanCellClass} ${result ? 'hidden md:table-cell' : expandedColClass}`}>
                      —
                    </td>
                    <td className={`py-1.5 px-2 text-center md:w-[12%] text-[10px] sm:text-[11px] md:text-sm text-gray-400 ${cyanCellClass} ${result ? 'hidden md:table-cell' : ''}`}>
                      —
                    </td>
                    <td className={`py-1.5 px-2 text-center md:w-[12%] text-[10px] sm:text-[11px] md:text-sm text-gray-400 ${cyanCellClass} ${result ? 'hidden md:table-cell' : hide2ndOvrClass}`}>
                      —
                    </td>

                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm font-bold ${result ? 'hidden' : expandedColClass} ${pIsResolved ? 'text-gray-300' : 'text-gray-500'}`}>
                      {stats?.points ?? '—'}
                    </td>
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm ${result ? 'hidden' : expandedColClass} ${pIsResolved ? 'text-gray-300' : 'text-gray-500'}`}>
                      {stats?.regulationWins ?? '—'}
                    </td>
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm ${result ? 'hidden' : expandedColClass} ${pIsResolved ? 'text-gray-300' : 'text-gray-500'}`}>
                      {stats?.regulationPlusOtWins ?? '—'}
                    </td>
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
          <p className="text-[7px] sm:text-[8px] md:text-[10px] text-gray-500 uppercase tracking-wide" style={{ fontFamily: 'var(--font-press-start)', wordSpacing: '-0.4em' }}>
            **OTT to pick 32nd due to penalty sanction.
          </p>
        </div>

      </div>

    </div>
  );
}
