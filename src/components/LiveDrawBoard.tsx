"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { NHL_TEAMS } from '../data/teams';
import { SeededTeam, LotteryCombo } from '../data/types';
import { calculateLiveOdds, getFullBallImpacts, probabilityOfWin } from '../lib/analytics';
import { resolveDraftOrder, MAX_MOVE_UP, getLockedFirstPickTeam } from '../lib/engine';
import { useNHLStandings } from '../hooks/useNHLStandings';
import { buildDynamicLotteryData } from '../lib/dynamicCombos';
import { computeDraw1Odds, phaseLabel } from '../lib/dynamicOdds';
import CroppedLogo from './CroppedLogo';
import ThreeStars, { computeThreeStars } from './ThreeStars';
import OddsGrid from './OddsGrid';
import { PICK_OWNERSHIP, resolvePickOwner, getPickOwnershipDisplay } from '../data/pickOwnership';

/** Renders a number with a tightened decimal point */
const RetroNum = ({ value, prefix = '', suffix = '' }: { value: string; prefix?: string; suffix?: string }) => {
  const idx = value.indexOf('.');
  if (idx === -1) return <>{prefix}{value}{suffix}</>;
  return (
    <span className="retro-num">
      {prefix}{value.slice(0, idx)}<span className="dec">.</span>{value.slice(idx + 1)}{suffix}
    </span>
  );
};

type Phase = 'DRAW_1' | 'DRAW_2' | 'COMPLETE';

interface DrawHistoryEntry {
  balls: number[];
  result: SeededTeam | 'REDRAW' | null;
}

interface LiveDrawBoardProps {
  setActionText?: (text: string) => void;
  setActionDisabled?: (disabled: boolean) => void;
  triggerRef?: React.MutableRefObject<() => void>;
}

export default function LiveDrawBoard({ setActionText, setActionDisabled, triggerRef }: LiveDrawBoardProps) {
  // Dynamic standings from NHL API data
  const { lotteryTeams: lotteryStandings, playoffTeams: playoffStandings } = useNHLStandings();
  const dynamicData = useMemo(
    () => buildDynamicLotteryData(lotteryStandings, playoffStandings),
    [lotteryStandings, playoffStandings]
  );
  const initialStandings = dynamicData.lotteryTeams;
  const combos = dynamicData.remappedCombos;

  // Compute Draw 1 baseline odds from dynamic combos
  const baseDraw1OddsMap = useMemo(
    () => computeDraw1Odds(initialStandings, combos),
    [initialStandings, combos]
  );

  const [phase, setPhase] = useState<Phase>('DRAW_1');
  const [activeBalls, setActiveBalls] = useState<number[]>([]);
  const [history, setHistory] = useState<DrawHistoryEntry[]>([]);

  const [draw1Winner, setDraw1Winner] = useState<SeededTeam | null>(null);
  const [draw2Winner, setDraw2Winner] = useState<SeededTeam | null>(null);
  const [showStars, setShowStars] = useState(false);

  const [selectedTeam, setSelectedTeam] = useState<string>(initialStandings[0].team.abbreviation);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [mobileViewerTab, setMobileViewerTab] = useState<'league' | 'team'>('league');

  // Live Draw: 4 ball slots for manual entry via dropdowns
  const [inputBalls, setInputBalls] = useState<(number | null)[]>([null, null, null, null]);

  const allTeamCodes = useMemo(
    () => initialStandings.map(t => t.team.abbreviation),
    [initialStandings]
  );

  const draw1WinnerCode = draw1Winner?.team.abbreviation;

  // If Draw 1 winner can't reach #1 (10-spot cap), the team locked at #1 is also excluded from Draw 2
  const lockedFirstPick = useMemo(() => {
    if (!draw1WinnerCode) return undefined;
    return getLockedFirstPickTeam(initialStandings, draw1WinnerCode);
  }, [draw1WinnerCode, initialStandings]);

  const additionalExcluded = useMemo(() => {
    return lockedFirstPick ? [lockedFirstPick] : undefined;
  }, [lockedFirstPick]);

  const d1WinnerPickNum = useMemo(() => {
    if (!draw1WinnerCode) return undefined;
    const d1OrigIdx = initialStandings.findIndex(t => t.team.abbreviation === draw1WinnerCode);
    if (d1OrigIdx < 0) return undefined;
    return Math.max(0, d1OrigIdx - MAX_MOVE_UP) + 1;
  }, [draw1WinnerCode, initialStandings]);

  // Precomputed combo lookup for O(1) resolution on fourth ball
  const comboByBalls = useMemo(() => {
    const map = new Map<string, LotteryCombo>();
    for (const combo of combos) {
      map.set([...combo.balls].sort((a, b) => a - b).join(','), combo);
    }
    return map;
  }, [combos]);

  // Precomputed combo counts per team — avoids O(1001) filter calls per team
  const comboCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of combos) {
      counts[c.teamCode] = (counts[c.teamCode] || 0) + 1;
    }
    return counts;
  }, [combos]);

  // Live balls: combine any valid inputBalls being typed with no prior activeBalls needed
  // This makes odds update in real-time as each ball is entered
  const liveBalls = useMemo(() => {
    return inputBalls.filter((b): b is number => b !== null);
  }, [inputBalls]);

  const liveOdds = useMemo(() => {
    return calculateLiveOdds(combos, liveBalls, allTeamCodes, draw1WinnerCode, additionalExcluded);
  }, [combos, liveBalls, allTeamCodes, draw1WinnerCode, additionalExcluded]);

  const impact = useMemo(() => {
    return getFullBallImpacts(combos, liveBalls, selectedTeam, draw1WinnerCode, additionalExcluded);
  }, [combos, liveBalls, selectedTeam, draw1WinnerCode, additionalExcluded]);

  // Baseline odds for computing deltas in the CHANGE column
  const baselineOdds = useMemo(() => {
    const map: Record<string, number> = {};
    if (phase === 'DRAW_1' || !draw1WinnerCode) {
      // Draw 1: baseline = dynamic baseDraw1Odds
      for (const code of allTeamCodes) {
        map[code] = baseDraw1OddsMap[code] || 0;
      }
    } else {
      // Draw 2: baseline = T_base / (1001 - 1 - excluded_combos)
      const d1Combos = comboCounts[draw1WinnerCode] || 0;
      const lockedCombos = lockedFirstPick ? (comboCounts[lockedFirstPick] || 0) : 0;
      const d2Denom = 1001 - 1 - d1Combos - lockedCombos; // subtract REDRAW + D1 winner + locked team
      for (const code of allTeamCodes) {
        if (code === draw1WinnerCode || code === lockedFirstPick) {
          map[code] = 0;
        } else {
          map[code] = ((comboCounts[code] || 0) / d2Denom) * 100;
        }
      }
    }
    return map;
  }, [phase, draw1WinnerCode, lockedFirstPick, allTeamCodes, comboCounts, baseDraw1OddsMap]);

  // D1 winner's "match probability" (chance their combo is drawn, triggering redraw)
  const d1WinnerMatchProb = useMemo(() => {
    if (!draw1WinnerCode || phase === 'DRAW_1') return 0;
    return probabilityOfWin(combos, liveBalls, draw1WinnerCode) * 100;
  }, [combos, draw1WinnerCode, liveBalls, phase]);

  const currentOrder = useMemo<SeededTeam[]>(() => {
    if (!draw1Winner) return initialStandings;

    if (!draw2Winner) {
      const d1OrigIdx = initialStandings.findIndex(
        t => t.team.abbreviation === draw1Winner.team.abbreviation
      );
      const d1Target = Math.max(0, d1OrigIdx - MAX_MOVE_UP);
      const partial = initialStandings.filter(
        t => t.team.abbreviation !== draw1Winner.team.abbreviation
      );
      partial.splice(d1Target, 0, draw1Winner);
      return partial;
    }

    return resolveDraftOrder(initialStandings, draw1Winner, draw2Winner, MAX_MOVE_UP);
  }, [initialStandings, draw1Winner, draw2Winner]);

  // Check if all 4 input balls are valid
  const allInputsValid = useMemo(() => {
    const filled = inputBalls.filter((b): b is number => b !== null);
    if (filled.length !== 4) return false;
    // Check all unique
    return new Set(filled).size === 4;
  }, [inputBalls]);

  const handleSubmitBalls = useCallback(() => {
    const filled = inputBalls.filter((b): b is number => b !== null);
    if (filled.length !== 4 || new Set(filled).size !== 4) return;

    const sortedBalls = [...filled].sort((a, b) => a - b).join(',');
    const comboMatch = comboByBalls.get(sortedBalls) ?? null;

    let isRedraw = false;
    let winnerTeam: SeededTeam | null = null;

    if (!comboMatch) {
      isRedraw = true;
    } else {
      const teamCode = (comboMatch as any).teamCode || (comboMatch as any).team;
      winnerTeam = initialStandings.find(t => t.team.abbreviation === teamCode) || null;

      if (!winnerTeam || teamCode === 'REDRAW') {
        isRedraw = true;
      } else if (draw1Winner && winnerTeam.team.abbreviation === draw1Winner.team.abbreviation) {
        isRedraw = true;
      } else if (lockedFirstPick && winnerTeam.team.abbreviation === lockedFirstPick) {
        isRedraw = true;
      }
    }

    const finishedEntry: DrawHistoryEntry = {
      balls: filled,
      result: isRedraw ? 'REDRAW' : winnerTeam
    };

    setActiveBalls(filled);
    setHistory(prev => [...prev, finishedEntry]);
    setInputBalls([null, null, null, null]);

    if (!isRedraw && winnerTeam) {
      if (phase === 'DRAW_1') {
        setDraw1Winner(winnerTeam);
        setPhase('DRAW_2');
        const nextBest = initialStandings.find(t => t.team.abbreviation !== winnerTeam!.team.abbreviation)!.team.abbreviation;
        setSelectedTeam(nextBest);
      } else {
        setDraw2Winner(winnerTeam);
        setPhase('COMPLETE');
        setShowStars(true);
      }
    }

  }, [inputBalls, comboByBalls, draw1Winner, lockedFirstPick, phase, initialStandings]);

  const handleNextStep = useCallback(() => {
    if (phase === 'COMPLETE') {
      setPhase('DRAW_1');
      setActiveBalls([]);
      setDraw1Winner(null);
      setDraw2Winner(null);
      setHistory([]);
      setShowStars(false);
      setInputBalls([null, null, null, null]);
      return;
    }

    // In Live Draw mode, the button submits the entered balls
    handleSubmitBalls();
  }, [phase, handleSubmitBalls]);

  useEffect(() => {
    if (triggerRef) {
      triggerRef.current = handleNextStep;
    }
  }, [triggerRef, handleNextStep]);

  useEffect(() => {
    if (!setActionText) return;

    if (phase === 'COMPLETE') {
      setActionText("PUSH TO\nTRY AGAIN");
      setActionDisabled?.(false);
      return;
    }

    if (allInputsValid) {
      setActionText(phase === 'DRAW_1' ? "COMPLETE\nDRAW 1" : "COMPLETE\nDRAW 2");
      setActionDisabled?.(false);
    } else {
      setActionText("SELECT\nNUMBERS");
      setActionDisabled?.(true);
    }
  }, [phase, allInputsValid, setActionText, setActionDisabled]);

  return (
    <div className="max-w-5xl mx-auto">

      {/* THE DRAW TABLE */}
      {phase !== 'COMPLETE' && (
        <div className="w-full bg-white border-4 border-black p-3 md:px-6 md:pb-6 mb-4 shadow-[8px_8px_0px_rgba(0,0,0,1)]">
          <h2 className="text-title text-[#E2231A] mb-3 text-center border-b-4 border-black pb-2 whitespace-nowrap">
            LIVE DRAW AND RESULTS
          </h2>

          <div className="w-full mb-2">
            <table className="w-full text-left border-collapse table-fixed">
              <colgroup>
                <col className="w-[12%] md:w-[8%]" />
                <col className="w-[32%] md:w-[25%]" />
                <col className="w-[56%] md:w-[67%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#B8F6FA] border-b-4 border-black text-micro text-black">
                  <th className="py-2 px-1 md:px-2 text-center whitespace-nowrap">DRAW</th>
                  <th className="py-2 px-2 md:px-4 text-left" colSpan={2}>RESULT</th>
                </tr>
              </thead>
              <tbody>

                {/* Completed Draws */}
                {history.map((row, idx) => {
                  let line1 = '';
                  let line2 = '';
                  let mobileLine1 = '';
                  let mobileLine2 = '';

                  const isRedraw = row.result === 'REDRAW';
                  const resultTeam = (!isRedraw && row.result) ? (row.result as SeededTeam) : null;

                  if (isRedraw) {
                    line1 = 'RE-DRAW';
                    mobileLine1 = 'RE-DRAW';
                  } else if (resultTeam) {
                    const pickNum = currentOrder.findIndex(t => t.team.abbreviation === resultTeam.team.abbreviation) + 1;
                    const isDraw2 = history.slice(0, idx).some(h => h.result && h.result !== 'REDRAW');
                    const drawNum = isDraw2 ? 2 : 1;
                    const winnerAbbrev = resultTeam.team.abbreviation;
                    const winnerCity = NHL_TEAMS[winnerAbbrev]?.city || winnerAbbrev;
                    mobileLine1 = `${winnerAbbrev} WINS!`;
                    mobileLine2 = `OWNS #${pickNum} PICK`;
                    line1 = `${winnerCity} WINS DRAW ${drawNum}!`;
                    line2 = `OWNS PICK #${pickNum}`;
                  }

                  return (
                    <tr key={`history-${idx}`} className="border-b-2 border-gray-200 bg-[#E5FCFD] h-[44px] md:h-[52px] transition-colors">
                      <td className="py-1 px-1 md:px-2 border-r-2 border-transparent">
                        <div className="flex justify-center items-center h-full">
                          <div className="text-num text-black [text-shadow:2px_2px_0_#fff]">
                            {idx + 1}
                          </div>
                        </div>
                      </td>
                      <td className="py-1 px-1 md:px-4 border-r-2 border-transparent">
                        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
                          {row.balls.map((b, i) => (
                            <div key={i} className="shrink-0 w-5 h-5 md:w-10 md:h-10 flex items-center justify-center rounded-full border-2 md:border-4 border-[#FFCC00] bg-[#FFCC00] text-black font-bold text-micro shadow-[0_0_10px_rgba(255,204,0,0.8)]">
                              {b}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-1 px-1 md:px-4">
                        <div className="flex items-center justify-start w-full h-full">
                          {isRedraw ? (
                            <span className="text-red-600 font-bold text-micro uppercase drop-shadow-[1px_1px_0_#fff]">RE-DRAW</span>
                          ) : resultTeam ? (
                            <div className="flex items-center gap-2 md:gap-4 justify-start">
                              {resultTeam.team.logoLight && (
                                <CroppedLogo src={resultTeam.team.logoLight} sizeClass="w-8 h-8 md:w-10 md:h-10" wrapperClass="shrink-0" />
                              )}
                              <div className="flex flex-col md:flex-row md:items-center text-left justify-center md:gap-1.5">
                                <span className="md:hidden font-bold text-micro text-black whitespace-nowrap leading-[1.25]">
                                  {mobileLine1 || line1}
                                </span>
                                <span className="md:hidden font-bold text-micro text-black whitespace-nowrap leading-[1.25]">
                                  {mobileLine2 || line2}
                                </span>
                                <span className="hidden md:inline font-bold text-body uppercase text-black whitespace-nowrap leading-[1.25]">
                                  {line1}
                                </span>
                                <span className="hidden md:inline font-bold text-body uppercase text-black whitespace-nowrap leading-[1.25]">
                                  {line2}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Active Draw Row — sequential ball entry with arcade cursor */}
                <tr className="border-b-2 border-gray-200 bg-[#E5FCFD] h-[44px] md:h-[52px] transition-colors">
                  <td className="py-1 px-1 md:px-2 border-r-2 border-transparent">
                    <div className="flex justify-center items-center h-full">
                      <div className="text-num text-black [text-shadow:2px_2px_0_#fff] animate-pulse">
                        {history.filter(h => h.result && h.result !== 'REDRAW').length + 1}
                      </div>
                    </div>
                  </td>
                  <td className="py-1 px-1 md:px-4 border-r-2 border-transparent">
                    <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
                      {[0, 1, 2, 3].map((slotIndex) => {
                        const val = inputBalls[slotIndex];
                        const usedBalls = inputBalls.filter((b, i) => i !== slotIndex && b !== null) as number[];
                        // First null slot is the active one; slots after it are locked
                        const firstEmptyIdx = inputBalls.findIndex(b => b === null);
                        const isActive = val === null && slotIndex === firstEmptyIdx;
                        const isLocked = val === null && slotIndex > firstEmptyIdx;

                        // Filled: gold ball
                        if (val !== null) {
                          return (
                            <div key={`slot-${slotIndex}`} className="shrink-0 w-5 h-5 md:w-10 md:h-10 flex items-center justify-center rounded-full border-2 md:border-4 border-[#FFCC00] bg-[#FFCC00] text-black font-bold text-micro shadow-[0_0_10px_rgba(255,204,0,0.8)]">
                              {val}
                            </div>
                          );
                        }

                        // Active: blinking arcade cursor block with dropdown
                        if (isActive) {
                          return (
                            <div key={`slot-${slotIndex}`} className="shrink-0 relative w-5 h-5 md:w-11 md:h-11 arcade-cursor">
                              <select
                                value=""
                                onChange={(e) => {
                                  const num = parseInt(e.target.value, 10);
                                  if (!isNaN(num)) {
                                    setInputBalls(prev => { const next = [...prev]; next[slotIndex] = num; return next; });
                                  }
                                }}
                                className="w-full h-full text-stat text-center appearance-none cursor-pointer outline-none bg-transparent text-transparent relative z-10"
                               
                              >
                                <option value="" className="text-[#96EDF6] bg-black"></option>
                                {Array.from({ length: 14 }, (_, i) => i + 1)
                                  .filter(n => !usedBalls.includes(n))
                                  .map(n => (
                                    <option key={n} value={n} className="text-[#96EDF6] bg-black">{n}</option>
                                  ))
                                }
                              </select>
                            </div>
                          );
                        }

                        // Locked: dim empty placeholder
                        return (
                          <div key={`slot-${slotIndex}`} className="shrink-0 w-5 h-5 md:w-11 md:h-11 border-2 md:border-3 border-gray-300/40 rounded-sm" />
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-1 px-1 md:px-4">
                    <div className="flex items-center w-full h-full justify-start">
                      {!allInputsValid && (
                        <span className="text-gray-400 font-bold text-micro uppercase tracking-widest animate-pulse ml-2 md:ml-3 leading-[1.25]">
                          SELECT NUMBERS TO SEE ODDS CHANGE LIVE...
                        </span>
                      )}
                    </div>
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEAGUE VIEW + TEAM VIEW: Shown during active draws only */}
      {phase !== 'COMPLETE' && (
        <>
        {/* Mobile toggle buttons */}
        <div className="flex lg:hidden gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMobileViewerTab('league')}
            className={`flex-1 py-1.5 px-2 border-4 border-black text-button leading-[1.25] shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all ${
              mobileViewerTab === 'league'
                ? 'bg-black text-[#96EDF6]'
                : 'bg-white text-black hover:bg-gray-100'
            }`}
           
          >
            LEAGUE VIEW
          </button>
          <button
            type="button"
            onClick={() => setMobileViewerTab('team')}
            className={`flex-1 py-1.5 px-2 border-4 border-black text-button leading-[1.25] shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all ${
              mobileViewerTab === 'team'
                ? 'bg-black text-[#96EDF6]'
                : 'bg-white text-black hover:bg-gray-100'
            }`}
           
          >
            TEAM VIEW
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-4">

          {/* ===== LEAGUE VIEW: Live Odds Leaderboard ===== */}
          <div className={`w-full bg-white border-4 border-black p-3 md:p-4 shadow-[8px_8px_0px_rgba(0,0,0,1)] ${mobileViewerTab !== 'league' ? 'hidden lg:block' : ''}`}>
            <div className="flex items-center justify-between mb-3 border-b-4 border-black pb-2">
              <h3 className="text-heading text-[#E2231A] whitespace-nowrap">
                LEAGUE VIEW
              </h3>
              <span className="text-label text-gray-500 whitespace-nowrap">
                {phaseLabel(phase, liveBalls.length)}
              </span>
            </div>

            <div>
              <table className="w-full text-left border-collapse table-fixed">
                <colgroup>
                  <col className="w-[10%]" />
                  <col className="w-[48%] lg:w-[36%]" />
                  <col className="w-[14%] lg:w-[18%]" />
                  <col className="w-[14%] lg:w-[18%]" />
                  <col className="w-[14%] lg:w-[18%]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#B8F6FA] border-b-4 border-black text-micro">
                    <th className="py-1 px-1 text-center whitespace-nowrap">SEED</th>
                    <th className="py-1 pl-0.5 md:pl-2 text-left">TEAM</th>
                    <th className="py-1 px-1 text-center whitespace-nowrap">COMBOS</th>
                    <th className="py-1 px-1 text-right whitespace-nowrap">WIN %</th>
                    <th className="py-1 px-1 text-right pr-2 whitespace-nowrap">CHANGE</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let rank = 0;
                    const sortedOdds = [...liveOdds].sort((a, b) => {
                      const aLocked = a.teamCode === lockedFirstPick ? 0 : a.isDraw1Winner ? 1 : 2;
                      const bLocked = b.teamCode === lockedFirstPick ? 0 : b.isDraw1Winner ? 1 : 2;
                      if (aLocked !== bLocked) return aLocked - bLocked;
                      return b.winProbability - a.winProbability;
                    });
                    return sortedOdds.map((odds) => {
                      const teamInfo = NHL_TEAMS[odds.teamCode];
                      const isD1Winner = odds.isDraw1Winner;
                      const isLockedFirst = odds.teamCode === lockedFirstPick;
                      const isExcluded = isD1Winner || isLockedFirst;

                      // D1 winner: show their match probability (chance combo drawn = redraw)
                      // Delta is suppressed for excluded teams since they can't win Draw 2
 const displayWin = isExcluded ? (isD1Winner ? d1WinnerMatchProb : 0) : odds.winProbability;
 const baseline = baselineOdds[odds.teamCode] ?? 0;
 const delta = isExcluded ? 0 : displayWin - baseline;

 // Rank: excluded teams get labels, others start at 1
 if (!isExcluded) rank++;

 return (
 <tr
 key={odds.teamCode}
 className={`border-b border-gray-200 transition-colors text-micro ${
 isExcluded
 ? 'bg-[#FFCC00]/20'
                              : 'hover:bg-[#E5FCFD]'                           
 }`}
 >
 <td className={`py-[7px] px-0.5 md:px-1 text-center text-num whitespace-nowrap ${isExcluded ? 'text-gray-400' : 'text-black'}`}>
 {isExcluded ? `#${isLockedFirst ? 1 : d1WinnerPickNum}` : rank}
 </td>
 <td className="py-[7px] pl-0.5 md:pl-2 pr-0.5">
 {(() => {
 const trade = PICK_OWNERSHIP[odds.teamCode];
 const isResolved = trade?.type === 'resolved';
 const ownerAbbrev = isResolved ? (trade as { owner: string }).owner : null;
 const ownerTeam = ownerAbbrev ? NHL_TEAMS[ownerAbbrev] : null;
 const displayTeam = isResolved && ownerTeam ? ownerTeam : teamInfo;

 return (
 <div className="flex items-center gap-1.5 md:gap-2.5">
 {displayTeam?.logoLight && (
 <CroppedLogo src={displayTeam.logoLight} sizeClass="w-5 h-5 md:w-7 md:h-7" wrapperClass="shrink-0" />
 )}
 <div className={`min-w-0 uppercase font-bold tracking-tight team-name ${isExcluded ? 'text-gray-400' : ''}`}>
 {/* Mobile: two lines (city above, nickname below) */}
 <div className="md:hidden">
 <div className="truncate">{displayTeam?.city || odds.teamCode}</div>
 <div className="truncate">{displayTeam?.name || ''}</div>
 </div>
 {/* md only: one line (city + nickname combined) */}
 <div className="hidden md:block lg:hidden truncate">
 {displayTeam?.city || odds.teamCode}{displayTeam?.name ? ` ${displayTeam.name}` : ''}
 </div>
 {/* lg+: nickname only (side-by-side panels get less room) */}
 <div className="hidden lg:block truncate">
 {displayTeam?.name || displayTeam?.city || odds.teamCode}
 </div>
 {isResolved && (
 <div className="text-gray-400 text-micro truncate">FROM {odds.teamCode}</div>
 )}
 </div>
 </div>
 );
 })()}
 </td>
 <td className={`py-[7px] px-0.5 md:px-1 text-center text-num whitespace-nowrap ${isExcluded ? 'text-gray-400' : ''}`}>
 {odds.remainingCombos}
 </td>
 <td className={`py-[7px] px-0.5 md:px-1 text-right text-num whitespace-nowrap ${isExcluded ? 'text-gray-400' : ''}`}>
 {isExcluded ? (
 <span className="text-gray-400">—</span>
 ) : displayWin > 0 ? (
 <RetroNum value={displayWin.toFixed(1)} suffix="%" />
 ) : (
 <span className="text-gray-300">0%</span>
 )}
 </td>
 <td className={`py-[7px] px-0.5 md:px-1 text-right pr-1 md:pr-2 text-num whitespace-nowrap ${isExcluded ? 'text-gray-400' : ''}`}>
                            {Math.abs(delta) < 0.05 ? (
                              <span className="text-gray-400">—</span>
                            ) : delta > 0 ? (
                              <span className={isExcluded ? 'text-gray-400' : 'text-green-600'}><RetroNum value={delta.toFixed(1)} prefix="+" suffix="%" /></span>
                            ) : (
                              <span className={isExcluded ? 'text-gray-400' : 'text-[#E2231A]'}><RetroNum value={delta.toFixed(1)} suffix="%" /></span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}

                </tbody>
              </table>
            </div>
          </div>

          {/* ===== TEAM VIEW: Per-Ball Intel Panel ===== */}
          <div className={`w-full bg-white border-4 border-black p-3 md:p-4 shadow-[8px_8px_0px_rgba(0,0,0,1)] flex flex-col ${mobileViewerTab !== 'team' ? 'hidden lg:flex' : ''}`}>
 <div className="flex items-center justify-between mb-3 border-b-4 border-black pb-2">
 <h3 className="text-heading text-[#E2231A] whitespace-nowrap">
 TEAM VIEW
 </h3>
 <span className="text-label text-gray-500 whitespace-nowrap">
                {phaseLabel(phase, liveBalls.length)}
              </span>
            </div>

            {/* Team Selector Dropdown — full width, "Selected Team: CHI" + logo */}
            <div className="relative mb-2">
              <button
                onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                className="w-full bg-black text-[#96EDF6] border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center justify-between px-2 md:px-4 py-1.5 transition-all hover:bg-gray-900 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {(() => {
                    const selTrade = PICK_OWNERSHIP[selectedTeam];
                    const selOwner = selTrade?.type === 'resolved' ? (selTrade as { owner: string }).owner : null;
 const displayLogo = selOwner ? NHL_TEAMS[selOwner]?.logoDark : NHL_TEAMS[selectedTeam]?.logoDark;
 return displayLogo ? <CroppedLogo src={displayLogo} sizeClass="w-5 h-5 md:w-6 md:h-6" wrapperClass="shrink-0" /> : null;
 })()}
 <span className="text-micro leading-[1.25] text-left truncate uppercase team-name">
 {(() => {
 const selTrade = PICK_OWNERSHIP[selectedTeam];
 const selIsResolved = selTrade?.type === 'resolved';
 const selOwner = selIsResolved ? (selTrade as { owner: string }).owner : null;
 if (selOwner) {
 return <>{NHL_TEAMS[selOwner]?.city || selOwner} <span className="text-[#96EDF6]/60">(FROM {selectedTeam})</span></>;
 }
 return <>{NHL_TEAMS[selectedTeam]?.city || selectedTeam}</>;
 })()}
 </span>
 </div>
 <span className="text-[9px] md:text-[10px] lg:text-[11px] text-[#96EDF6] ml-2 flex-shrink-0">▼</span>
 </button>

 {teamDropdownOpen && (
 <div className="absolute top-full left-0 w-full mt-2 bg-black border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] z-50 max-h-[200px] overflow-y-auto custom-scrollbar flex flex-col">
 {allTeamCodes
 .map(code => {
 const t = NHL_TEAMS[code];
 const codeOdds = liveOdds.find(o => o.teamCode === code);
 return (
 <button
 key={code}
 onClick={() => {
 setSelectedTeam(code);
 setTeamDropdownOpen(false);
 }}
 className="group text-left text-[#96EDF6] hover:bg-[#96EDF6] hover:text-black text-micro py-2 px-4 border-b-2 border-gray-800 last:border-none transition-colors flex items-center justify-between"
 >
 <div className="flex items-center gap-2 min-w-0 flex-1">
 {(() => {
 const ddTrade = PICK_OWNERSHIP[code];
 const ddOwner = ddTrade?.type === 'resolved' ? (ddTrade as { owner: string }).owner : null;
 const ddLogo = ddOwner ? NHL_TEAMS[ddOwner]?.logoDark : t?.logoDark;
 return ddLogo ? <CroppedLogo src={ddLogo} sizeClass="w-4 h-4 md:w-5 md:h-5" wrapperClass="shrink-0" /> : null;
 })()}
 {(() => {
 const ddTrade = PICK_OWNERSHIP[code];
 const ddOwner = ddTrade?.type === 'resolved' ? (ddTrade as { owner: string }).owner : null;
 const ddOwnerTeam = ddOwner ? NHL_TEAMS[ddOwner] : null;
 if (ddOwnerTeam) {
 return (
 <span className="uppercase font-bold tracking-tight truncate team-name">
 {ddOwnerTeam.city} <span className="text-[#96EDF6]/60 group-hover:text-black/40">(FROM {code})</span>
 </span>
 );
 }
 return (
 <span className="uppercase font-bold tracking-tight truncate team-name">
 {NHL_TEAMS[code]?.city || code}
 </span>
 );
 })()}
 </div>
 <span className="font-bold text-[#96EDF6] group-hover:text-black w-[45px] md:w-[50px] text-right inline-block ml-2 flex-shrink-0">
 {codeOdds ? <RetroNum value={codeOdds.winProbability.toFixed(1)} suffix="%" /> : '—'}
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Stats Row: Balls Alive | Current Win % | Vs Original */}
            {(() => {
              const teamOdds = liveOdds.find(o => o.teamCode === selectedTeam);
              const baseline = baselineOdds[selectedTeam] ?? 0;
              const currentWin = teamOdds?.winProbability ?? 0;
              const delta = currentWin - baseline;
              const deltaColor = Math.abs(delta) < 0.05 ? 'text-black' : delta > 0 ? 'text-green-600' : 'text-[#E2231A]';
              const deltaNode = Math.abs(delta) < 0.05 ? <>—</> : delta > 0 ? <RetroNum value={delta.toFixed(1)} prefix="+" suffix="%" /> : <RetroNum value={delta.toFixed(1)} suffix="%" />;
              const ballsAlive = impact.filter(i => i.status === 'REMAINING_ALIVE').length;
 return (
 <div className="flex mb-1 flex-grow">
 <div className="flex-1 flex flex-col items-center justify-center py-1 bg-[#E5FCFD]">
 <span className="text-stat text-black leading-[1.25] text-[14px]! md:text-[16px]! lg:text-[18px]!">{ballsAlive}</span>
 <span className="text-micro uppercase font-bold text-gray-500 leading-[1.25] text-[7px]! md:text-[8px]! lg:text-[9px]!">BALLS ALIVE</span>
 </div>
 <div className="flex-1 flex flex-col items-center justify-center py-1 bg-[#E5FCFD]">
 <span className="text-stat text-black leading-[1.25] text-[14px]! md:text-[16px]! lg:text-[18px]!"><RetroNum value={currentWin.toFixed(1)} suffix="%" /></span>
 <span className="text-micro uppercase font-bold text-gray-500 leading-[1.25] whitespace-nowrap text-[7px]! md:text-[8px]! lg:text-[9px]!">CURRENT WIN</span>
 </div>
 <div className="flex-1 flex flex-col items-center justify-center py-1 bg-[#E5FCFD]">
 <span className={`text-stat leading-[1.25] text-[14px]! md:text-[16px]! lg:text-[18px]! ${deltaColor}`}>{deltaNode}</span>
 <span className="text-micro uppercase font-bold text-gray-500 leading-[1.25] text-[7px]! md:text-[8px]! lg:text-[9px]!">VS ORIGINAL</span>
 </div>
 </div>
 );
 })()}

 {/* Per-Ball Impact Table — pushed to bottom to align with League View */}
 <div className="mt-auto">
 <table className="w-full text-left border-collapse table-fixed">
 <colgroup>
 <col className="w-[14%]" />
 <col className="w-[30%]" />
 <col className="w-[30%]" />
 <col className="w-[26%]" />
 </colgroup>
 <thead>
 <tr className="bg-[#B8F6FA] border-b-4 border-black text-micro">
                    <th className="py-1 px-1 text-center">BALL</th>
                    <th className="py-1 px-1 text-center">STATUS</th>
                    <th className="py-1 px-1 text-center">COMBOS</th>
                    <th className="py-1 px-1 text-right pr-2">IMPACT</th>
                  </tr>
                </thead>
                <tbody>
                  {impact.map((imp) => {
                    const isWinner = selectedTeam === draw1WinnerCode || selectedTeam === lockedFirstPick;
                    const isDrawn = imp.status === 'DRAWN_MATCH' || imp.status === 'DRAWN_MISS';
                    const isMatch = imp.status === 'DRAWN_MATCH';
                    const isAlive = imp.status === 'REMAINING_ALIVE';
                    const isDead = imp.status === 'REMAINING_DEAD';

                    // Redraw detection: ALIVE ball with 0 combos but positive odds change
                    // This means the team benefits only via the redraw path
                    const isRedrawPath = isAlive && imp.combos === 0 && imp.oddsChange > 0;

                    let statusLabel = '';
                    let statusColor = '';
                    if (isMatch) {
                      statusLabel = 'MATCH';
                      statusColor = 'text-green-600 font-bold';
                    } else if (imp.status === 'DRAWN_MISS') {
                      statusLabel = 'MISS';
                      statusColor = 'text-gray-400';
                    } else if (isRedrawPath) {
                      statusLabel = 'RE-DRAW';
                      statusColor = 'text-gray-400';
                    } else if (isAlive) {
                      statusLabel = 'ALIVE';
                      statusColor = 'text-black';
                    } else {
                      statusLabel = 'OUT';
                      statusColor = 'text-[#E2231A]';
                    }

                    let changeDisplay: React.ReactNode = '';
                    let changeColor = 'text-gray-400';
                    if (isDrawn) {
                      changeDisplay = '—';
                    } else if (isRedrawPath) {
                      changeDisplay = imp.oddsChange > 0 ? <RetroNum value={imp.oddsChange.toFixed(1)} prefix="+" suffix="%" /> : <RetroNum value={imp.oddsChange.toFixed(1)} suffix="%" />;
                      changeColor = 'text-gray-400';
                    } else if (imp.oddsChange > 0) {
                      changeDisplay = <RetroNum value={imp.oddsChange.toFixed(1)} prefix="+" suffix="%" />;
                      changeColor = 'text-green-600';
                    } else if (imp.oddsChange < 0) {
                      changeDisplay = <RetroNum value={imp.oddsChange.toFixed(1)} suffix="%" />;
                      changeColor = 'text-[#E2231A]';
                    } else {
                      changeDisplay = '0%';
 }

 // Row height: use py-1.5 to align with League View rows
 return (
 <tr
 key={imp.ball}
 className={`border-b border-gray-200 text-micro transition-colors ${
 isWinner ? 'bg-gray-50' : isMatch ? 'bg-green-50' : isDead ? 'bg-red-50' : isRedrawPath ? 'bg-gray-50' : 'hover:bg-[#E5FCFD]'                         
 }`}
 >
 <td className="py-1.5 px-1">
 <div className="flex justify-center">
 <div className={`w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full border-2 md:border-[3px] font-bold text-micro ${
 isWinner
 ? 'border-gray-300 bg-gray-200 text-gray-400'
                                : isMatch
                                ? 'border-green-500 bg-green-500 text-white shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                                : imp.status === 'DRAWN_MISS'
                                ? 'border-gray-300 bg-gray-200 text-gray-500'
                                : isDead
                                ? 'border-[#E2231A]/40 bg-red-50 text-[#E2231A]/60'
                                : isRedrawPath
                                ? 'border-gray-300 bg-gray-100 text-gray-400'
                                : 'border-white bg-white text-black shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                            }`}>
                              {imp.ball}
                            </div>
                          </div>
                        </td>
                        <td className={`py-1.5 px-1 text-center font-bold uppercase ${isWinner ? 'text-gray-400' : statusColor}`}>
                          {statusLabel}
                        </td>
                        <td className={`py-1.5 px-1 text-center text-num ${isWinner ? 'text-gray-400' : isRedrawPath ? 'text-gray-400' : ''}`}>
                          {imp.combos}
                        </td>
                        <td className={`py-1.5 px-1 text-right pr-2 text-num ${isWinner ? 'text-gray-400' : changeColor}`}>
                          {changeDisplay}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
        </>
      )}

      {/* PICK ODDS GRID: live during draws; hidden post-sim (COMPLETE) */}
      {phase !== 'COMPLETE' && (
        <OddsGrid
          teams={initialStandings}
          combos={combos}
          phase={phase}
          drawnBalls={liveBalls}
          draw1Winner={draw1Winner}
          draw2Winner={draw2Winner}
        />
      )}

      {/* 3 Stars of the Lottery — modal popup */}
      {showStars && phase === 'COMPLETE' && (
        <ThreeStars
          stars={computeThreeStars(currentOrder)}
          onClose={() => setShowStars(false)}
        />
      )}

      {/* COMPLETE PHASE: Full Draft Order */}
      {phase === 'COMPLETE' && (
 <div className="w-full bg-white border-4 border-black p-3 md:p-6 mb-2 shadow-[8px_8px_0px_rgba(0,0,0,1)] animate-in fade-in">
 <h2 className="text-title text-[#E2231A] mb-3 text-center border-b-4 border-black pb-2 whitespace-nowrap">
 2026 SIMULATED DRAFT ORDER
 </h2>

 <div className="w-full mb-2 overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-[#B8F6FA] border-b-4 border-black text-micro">
 <th className="py-2 px-1 text-center w-10 md:w-16 whitespace-nowrap sticky left-0 z-20 bg-[#B8F6FA]">PICK</th>
 <th className="py-2 px-1 md:px-2 text-left sticky left-10 md:left-16 z-20 bg-[#B8F6FA]">TEAM</th>
 <th className="py-2 px-1 text-center w-16 md:w-24 whitespace-nowrap">CHANGE</th>
 </tr>
 </thead>
 <tbody>
 {currentOrder.map((slot, index) => {
 const pickNum = index + 1;
 const abbrev = slot.team.abbreviation;

 // Resolve pick ownership
 const display = getPickOwnershipDisplay(abbrev, pickNum);
 const ownerAbbrev = resolvePickOwner(abbrev, pickNum);
 const ownerTeam = NHL_TEAMS[ownerAbbrev];
 const showTeamData = ownerTeam ?? slot.team;
 const isTransferred = display.isTransferred;
 const fromTeam = isTransferred ? slot.team : null;

 const change = slot.seed - pickNum;

 const numClass = 'text-black [text-shadow:2px_2px_0_#fff]';
                  let changeLabel = '';
                  let changeColor = 'text-gray-400';
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

 return (
 <tr key={abbrev} className="bg-white border-b-2 border-gray-200 hover:bg-[#E5FCFD] transition-colors">
 <td className="py-1.5 px-1 sticky left-0 z-10 bg-inherit">
 <div className="flex justify-center items-center h-full">
 <div className={`text-num transition-all duration-300 ${numClass}`}>
 {pickNum}
 </div>
 </div>
 </td>

 <td className="py-1.5 px-1 md:px-2 sticky left-10 md:left-16 z-10 bg-inherit">
 <div className="flex items-center gap-2 md:gap-3 w-full">
 {showTeamData.logoLight ? (
 <CroppedLogo src={showTeamData.logoLight} alt={showTeamData.abbreviation} sizeClass="w-8 h-8 md:w-14 md:h-14" wrapperClass="shrink-0" />
 ) : (
 <span className="w-8 h-8 md:w-14 md:h-14 flex items-center justify-center text-micro shrink-0">?</span>
 )}

 <div className="flex flex-col min-w-0 flex-1">
 <span className="font-bold text-micro uppercase tracking-tight truncate team-name">
 {showTeamData.city} {showTeamData.name}
 </span>
 </div>

 {fromTeam && fromTeam.logoLight && (
 <CroppedLogo src={fromTeam.logoLight} alt={fromTeam.abbreviation} sizeClass="w-6 h-6 md:w-10 md:h-10" wrapperClass="shrink-0 opacity-40 grayscale ml-auto" />
 )}
 </div>
 </td>

 <td className="py-1.5 px-1">
 <div className="flex justify-center items-center h-full">
 <span className={`text-num whitespace-nowrap ${changeColor}`}>
 {changeLabel}
 </span>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>

 <div className="flex justify-center mt-4">
 <button
 type="button"
 onClick={handleNextStep}
 className="px-6 py-2 border-4 border-black bg-[#E2231A] text-white text-button shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"

            >
              TRY AGAIN
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
