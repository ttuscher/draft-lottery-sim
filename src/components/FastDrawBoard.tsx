"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { runSimulation, MAX_MOVE_UP } from '../lib/engine';
import { NHL_TEAMS } from '../data/teams';
import { SeededTeam, LotteryCombo, SimulationResult } from '../data/types';
import { useNHLStandings, NHLTeamStanding } from '../hooks/useNHLStandings';
import { buildDynamicLotteryData } from '../lib/dynamicCombos';
import { computeDynamicPickSlotOdds, computeDraw1Odds } from '../lib/dynamicOdds';
import CroppedLogo from './CroppedLogo';
// ThreeStars modal is only used in FullDrawBoard

interface FastDrawBoardProps {
  triggerRef?: React.MutableRefObject<() => void>;
}

export default function FastDrawBoard({ triggerRef }: FastDrawBoardProps) {
  const { lotteryTeams: lotteryStandings, playoffTeams: playoffStandings } = useNHLStandings();
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [board, setBoard] = useState<SeededTeam[] | null>(null);

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

  return (
    <div className="w-full pb-2">
      <div className="w-full bg-white border-4 border-black p-3 md:px-6 md:pb-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] mx-auto max-w-5xl" style={{ fontFamily: 'var(--font-press-start)' }}>

        {/* Header + Expand Button */}
        <div className="flex items-center justify-between mb-3 border-b-4 border-black pb-2">
          <div className="flex-1" />
          <h2 className="text-sm sm:text-base md:text-xl text-center text-[#E2231A] uppercase tracking-wider whitespace-nowrap">
            {result ? '2026 SIMULATED DRAFT ORDER' : '2026 DRAFT LOTTERY ODDS'}
          </h2>
          <div className="flex-1 flex justify-end">
            <button
              type="button"
              onClick={() => setExpanded(prev => !prev)}
              className="w-7 h-7 sm:w-8 sm:h-8 bg-black text-white border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] flex md:hidden items-center justify-center transition-all hover:translate-y-[2px] hover:shadow-[1px_1px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-sm sm:text-base font-bold leading-none cursor-pointer"
            >
              {expanded ? '-' : '+'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto mb-2">
          <table className="text-left border-collapse w-full md:min-w-[800px]">

            <thead>
              <tr className="bg-[#B8F6FA] border-b-4 border-black text-[8px] sm:text-[9px] md:text-xs">
                <th className={`py-2 px-1 text-center w-8 sm:w-12 whitespace-nowrap ${stickyPickHeadClass}`}>PICK</th>
                <th className={`py-2 px-1 sm:px-2 text-left whitespace-nowrap ${stickyTeamHeadClass}`}>TEAM</th>
                <th className={`py-2 px-2 text-center whitespace-nowrap md:w-[10%] ${cyanHeadClass}`}>DRAW 1</th>
                <th className={`py-2 px-2 text-center whitespace-nowrap md:w-[10%] ${cyanHeadClass}`}>1ST OVR</th>
                <th className={`py-2 px-2 text-center whitespace-nowrap md:w-[10%] ${cyanHeadClass}`}>2ND OVR</th>
                {result && (
                  <th className="py-2 px-2 text-center w-14 sm:w-20 md:w-[10%] whitespace-nowrap">CHANGE</th>
                )}
                <th className={`py-2 px-2 text-center whitespace-nowrap md:w-[10%] ${expandedColClass}`}>PTS</th>
                <th className={`py-2 px-2 text-center whitespace-nowrap md:w-[10%] ${expandedColClass}`}>RW</th>
                <th className={`py-2 px-2 text-center whitespace-nowrap md:w-[10%] ${expandedColClass}`}>ROW</th>
              </tr>
            </thead>

            <tbody>

              {/* ===== LOTTERY TEAMS SEPARATOR ===== */}
              <tr>
                <td
                  colSpan={99}
                  className="py-1.5 px-2 bg-gray-300 text-black text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-widest text-left border-b-2 border-black"
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

                const isDraw1Winner = result?.draw1Winner?.team?.abbreviation === abbrev;
                const isDraw2Winner = result?.draw2Winner?.team?.abbreviation === abbrev;
                const isWinner = isDraw1Winner || isDraw2Winner;

                const change = slot.seed - pickNum;

                let numClass = 'text-black [text-shadow:2px_2px_0_#fff]';
                if (result && change > 0) {
                  numClass = 'text-black [text-shadow:2px_2px_0_#15803d]';
                } else if (result && change < 0) {
                  numClass = 'text-black [text-shadow:2px_2px_0_#E2231A]';
                }
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

                    <td className={`py-1.5 px-0 sm:px-1 ${stickyTeamClass} max-w-[120px] sm:max-w-[160px] md:max-w-none`} style={{ backgroundColor: 'inherit' }}>
                      <div className="flex items-center gap-1.5 md:gap-2 w-full">
                        {slot.team.logoLight ? (
                          <CroppedLogo src={slot.team.logoLight} alt={abbrev} sizeClass="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10" wrapperClass="shrink-0" />
                        ) : (
                          <span className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center text-[8px] shrink-0">?</span>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="md:hidden font-bold text-[10px] sm:text-[11px] uppercase tracking-tight truncate">{abbrev}</span>
                          <span className="hidden md:block font-bold text-[9px] uppercase tracking-tight whitespace-nowrap text-gray-500">{slot.team.city}</span>
                          <span className="hidden md:block font-bold text-sm uppercase tracking-tight whitespace-nowrap leading-tight">{slot.team.name}</span>
                        </div>
                      </div>
                    </td>

                    {/* Odds columns — cyan fill, gold for winners */}
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg}`}>
                      {teamOdds.d1 > 0 ? `${teamOdds.d1.toFixed(1)}%` : '—'}
                    </td>
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg}`}>
                      {teamOdds.firstOvr > 0 ? `${teamOdds.firstOvr.toFixed(1)}%` : '—'}
                    </td>
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm font-bold ${oddsCellBg}`}>
                      {teamOdds.secondOvr > 0 ? `${teamOdds.secondOvr.toFixed(1)}%` : '—'}
                    </td>

                    {result && (
                      <td className="py-1.5 px-2">
                        <div className="flex justify-center items-center h-full">
                          <span className={`font-bold text-[10px] sm:text-[11px] md:text-sm whitespace-nowrap ${changeColor}`}>
                            {changeLabel}
                          </span>
                        </div>
                      </td>
                    )}

                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm font-bold ${expandedColClass}`}>
                      {stats?.points ?? '—'}
                    </td>
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm ${expandedColClass}`}>
                      {stats?.regulationWins ?? '—'}
                    </td>
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm ${expandedColClass}`}>
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
                >
                  PLAYOFF TEAMS
                </td>
              </tr>

              {/* ===== PLAYOFF TEAM ROWS ===== */}
              {playoffTeams.map((slot, index) => {
                const pickNum = 17 + index;
                const abbrev = slot.team.abbreviation;
                const stats = getStats(abbrev);

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

                    <td className={`py-1.5 px-0 sm:px-1 ${stickyTeamClass} max-w-[120px] sm:max-w-[160px] md:max-w-none`} style={{ backgroundColor: 'inherit' }}>
                      <div className="flex items-center gap-1.5 md:gap-2 w-full">
                        {slot.team.logoLight ? (
                          <CroppedLogo src={slot.team.logoLight} alt={abbrev} sizeClass="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10" wrapperClass="shrink-0 opacity-60" />
                        ) : (
                          <span className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center text-[8px] shrink-0 text-gray-400">?</span>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="md:hidden font-bold text-[10px] sm:text-[11px] uppercase tracking-tight truncate text-gray-500">{abbrev}</span>
                          <span className="hidden md:block font-bold text-[9px] uppercase tracking-tight whitespace-nowrap text-gray-400">{slot.team.city}</span>
                          <span className="hidden md:block font-bold text-sm uppercase tracking-tight whitespace-nowrap leading-tight text-gray-500">{slot.team.name}</span>
                        </div>
                      </div>
                    </td>

                    {/* Odds columns — cyan fill, dashes for playoff teams */}
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm text-gray-400 ${cyanCellClass}`}>
                      —
                    </td>
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm text-gray-400 ${cyanCellClass}`}>
                      —
                    </td>
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm text-gray-400 ${cyanCellClass}`}>
                      —
                    </td>

                    {result && (
                      <td className="py-1.5 px-2">
                        <div className="flex justify-center items-center h-full">
                          <span className="font-bold text-[10px] sm:text-[11px] md:text-sm text-gray-400">—</span>
                        </div>
                      </td>
                    )}

                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm font-bold text-gray-500 ${expandedColClass}`}>
                      {stats?.points ?? '—'}
                    </td>
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm text-gray-500 ${expandedColClass}`}>
                      {stats?.regulationWins ?? '—'}
                    </td>
                    <td className={`py-1.5 px-2 text-center text-[10px] sm:text-[11px] md:text-sm text-gray-500 ${expandedColClass}`}>
                      {stats?.regulationPlusOtWins ?? '—'}
                    </td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
