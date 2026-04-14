// src/components/FullDrawBoard.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { NHL_TEAMS } from '../data/teams';
import { SeededTeam, LotteryCombo } from '../data/types';
import lotteryData from '../data/lottery-2025.json';
import { calculateLiveOdds, getFullBallImpacts } from '../lib/analytics';

const initialStandings: SeededTeam[] = lotteryData.teamOrder.map((teamCode: string, index: number) => ({
  seed: index + 1,
  team: NHL_TEAMS[teamCode] || { abbreviation: teamCode, city: teamCode, name: 'UNKNOWN', logoLight: '', logoDark: '' },
  combinations: 0
}));

const combos = lotteryData.entries as LotteryCombo[];

type Phase = 'DRAW_1' | 'DRAW_2' | 'COMPLETE';

export default function FullDrawBoard() {
  const [phase, setPhase] = useState<Phase>('DRAW_1');
  const [drawnBalls, setDrawnBalls] = useState<number[]>([]);
  
  const [draw1Winner, setDraw1Winner] = useState<SeededTeam | null>(null);
  const [draw2Winner, setDraw2Winner] = useState<SeededTeam | null>(null);
  
  const [selectedTeam, setSelectedTeam] = useState<string>(initialStandings[0].team.abbreviation);

  const activeTeams = useMemo(() => {
    return initialStandings
      .map(t => t.team.abbreviation)
      .filter(t => t !== draw1Winner?.team.abbreviation);
  }, [draw1Winner]);

  const liveOdds = useMemo(() => {
    return calculateLiveOdds(combos, drawnBalls, activeTeams);
  }, [drawnBalls, activeTeams]);

  const impact = useMemo(() => {
    return getFullBallImpacts(combos, drawnBalls, selectedTeam);
  }, [drawnBalls, selectedTeam]);

  const handleDrawNextBall = () => {
    if (drawnBalls.length >= 4) return;
    const machine = Array.from({length: 14}, (_, i) => i + 1).filter(b => !drawnBalls.includes(b));
    const nextBall = machine[Math.floor(Math.random() * machine.length)];
    setDrawnBalls([...drawnBalls, nextBall]);
  };

  const handleResolveDraw = () => {
    const winningCombo = combos.find(c => c.balls.every(b => drawnBalls.includes(b)));
    
    if (!winningCombo || winningCombo.teamCode === 'REDRAW' || winningCombo.teamCode === draw1Winner?.team.abbreviation) {
      alert("REDRAW! \n\nThis combination is either invalid or belongs to a team that already won. The machine will be reset.");
      setDrawnBalls([]);
      return;
    }

    const winnerTeam = initialStandings.find(t => t.team.abbreviation === winningCombo.teamCode)!;

    if (phase === 'DRAW_1') {
      setDraw1Winner(winnerTeam);
      setPhase('DRAW_2');
      setDrawnBalls([]);
      const nextBest = liveOdds.find(o => o.teamCode !== winnerTeam.team.abbreviation)?.teamCode || initialStandings[1].team.abbreviation;
      setSelectedTeam(nextBest);
    } else {
      setDraw2Winner(winnerTeam);
      setPhase('COMPLETE');
    }
  };

  const finalOrder = useMemo(() => {
    if (phase !== 'COMPLETE' || !draw1Winner || !draw2Winner) return [];
    
    const maxMove = 10;
    const d1OriginalIndex = initialStandings.findIndex(t => t.team.abbreviation === draw1Winner.team.abbreviation);
    const d2OriginalIndex = initialStandings.findIndex(t => t.team.abbreviation === draw2Winner.team.abbreviation);

    const d1TargetIndex = Math.max(0, d1OriginalIndex - maxMove);
    let d2TargetIndex = Math.max(0, d2OriginalIndex - maxMove);
    if (d2TargetIndex === d1TargetIndex) d2TargetIndex += 1;

    const remainingTeams = initialStandings.filter(t => 
      t.team.abbreviation !== draw1Winner.team.abbreviation && 
      t.team.abbreviation !== draw2Winner.team.abbreviation
    );

    const board = new Array(16).fill(null);
    board[d1TargetIndex] = draw1Winner;
    board[d2TargetIndex] = draw2Winner;

    let rIdx = 0;
    for (let i = 0; i < 16; i++) {
      if (!board[i]) {
        board[i] = remainingTeams[rIdx];
        rIdx++;
      }
    }
    return board;
  }, [phase, draw1Winner, draw2Winner]);

  if (phase === 'COMPLETE') {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in">
        <div className="bg-[#B8F6FA] retro-border p-4 mb-8 text-center" style={{ fontFamily: 'var(--font-press-start)' }}>
          <p className="text-base uppercase text-[#E2231A]">LOTTERY COMPLETE</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8" style={{ fontFamily: 'var(--font-press-start)' }}>
          {finalOrder.map((slot, index) => {
            const pickNum = index + 1;
            const isWinner = slot.team.abbreviation === draw1Winner?.team.abbreviation || slot.team.abbreviation === draw2Winner?.team.abbreviation;
            return (
              <div key={slot.team.abbreviation} className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 bg-black text-white flex items-center justify-center rounded-full border-4 border-black text-sm">{pickNum}</div>
                <div className={`team-box flex-grow flex justify-between items-center p-3 ${isWinner ? 'winner' : ''}`}>
                  <div className="flex flex-col gap-2 uppercase text-[10px] md:text-xs">
                    <span>{slot.team.city}</span>
                    <span>{slot.team.name}</span>
                  </div>
                  <div className="flex gap-2">
                    {slot.seed !== pickNum && (
                      <div className="flex flex-col items-center justify-center text-[10px]">
                        {slot.seed > pickNum ? <span className="text-green-600">▲ {slot.seed - pickNum}</span> : <span className="text-red-600">▼ {pickNum - slot.seed}</span>}
                      </div>
                    )}
                    <div className={`flex flex-col items-center p-2 border-2 border-black ${isWinner ? 'bg-black text-white' : 'bg-[#B8F6FA] text-black'}`}>
                      <span className="text-xs">{slot.seed}</span><span className="text-[8px] mt-1 uppercase">Seed</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto" style={{ fontFamily: 'var(--font-press-start)' }}>
      
      <div className="bg-black text-white retro-border p-6 mb-8 text-center relative shadow-[8px_8px_0px_rgba(0,0,0,0.3)]">
        <h2 className="text-[#96EDF6] text-sm md:text-xl mb-6">
          {phase === 'DRAW_1' ? "DRAW 1: FIRST OVERALL PICK" : "DRAW 2: SECOND OVERALL PICK"}
        </h2>
        
        <div className="flex justify-center gap-4 md:gap-8 mb-8">
          {[0, 1, 2, 3].map(slotIndex => {
            const ball = drawnBalls[slotIndex];
            return (
              <div key={slotIndex} className={`w-14 h-14 md:w-20 md:h-20 rounded-full border-4 flex items-center justify-center text-lg md:text-2xl transition-all ${ball ? 'bg-white text-black border-white shadow-[0_0_15px_#FFFFFF]' : 'bg-transparent border-[#96EDF6] text-[#96EDF6] opacity-50'}`}>
                {ball ? ball : '-'}
              </div>
            );
          })}
        </div>

        {drawnBalls.length < 4 ? (
          <button 
            onClick={handleDrawNextBall}
            className="bg-[#E2231A] text-white px-8 py-4 border-4 border-white hover:bg-white hover:text-[#E2231A] transition-colors"
          >
            DRAW NEXT BALL
          </button>
        ) : (
          <button 
            onClick={handleResolveDraw}
            className="bg-[#96EDF6] text-black px-8 py-4 border-4 border-white hover:bg-white hover:text-black transition-colors"
          >
            CONFIRM WINNER
          </button>
        )}
      </div>

      {/* Grid changed to 5 columns for a 60/40 layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch">
        
        {/* Left Column: Live Leaderboard (Wider) */}
        <div className="lg:col-span-3 bg-white retro-border p-4 shadow-[8px_8px_0px_rgba(0,0,0,0.3)] flex flex-col h-full">
          <h3 className="text-xs md:text-sm mb-4 border-b-4 border-black pb-2 uppercase text-[#E2231A]">Live Leaderboard</h3>
          
          {phase === 'DRAW_2' && draw1Winner && (
            <div className="bg-[#E2231A] text-white p-3 mb-4 border-2 border-black text-[10px] md:text-xs flex justify-between items-center uppercase">
              <span>★ 1ST OVERALL PICK SECURED:</span>
              <span>{draw1Winner.team.city} {draw1Winner.team.name}</span>
            </div>
          )}

          <div className="overflow-x-auto flex-grow">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-4 border-black text-[10px] md:text-xs bg-[#B8F6FA]">
                  <th className="p-1 md:p-2">TEAM</th>
                  <th className="p-1 md:p-2 text-right hidden md:table-cell">COMBOS</th>
                  <th className="p-1 md:p-2 text-right">WIN %</th>
                </tr>
              </thead>
              <tbody>
                {liveOdds.map(odd => {
                  const teamInfo = initialStandings.find(t => t.team.abbreviation === odd.teamCode)?.team;
                  const isSelected = selectedTeam === odd.teamCode;
                  const isDead = odd.winProbability === 0;

                  return (
                    <tr 
                      key={odd.teamCode} 
                      onClick={() => setSelectedTeam(odd.teamCode)}
                      className={`border-b-2 border-gray-200 cursor-pointer transition-colors text-[10px] md:text-xs 
                        ${isSelected ? 'bg-black text-white hover:bg-gray-800' : 'hover:bg-[#B8F6FA] text-black'} 
                        ${isDead && !isSelected ? 'opacity-30' : ''}`
                      }
                    >
                      <td className="p-1 md:p-2">{teamInfo?.city} {teamInfo?.name}</td>
                      <td className="p-1 md:p-2 text-right hidden md:table-cell">{odd.remainingCombos}</td>
                      <td className="p-1 md:p-2 text-right">{odd.winProbability.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Target Team Analysis (Narrower) */}
        <div className="lg:col-span-2 bg-[#B8F6FA] retro-border p-4 shadow-[8px_8px_0px_rgba(0,0,0,0.3)] flex flex-col h-full">
          <h3 className="text-xs md:text-sm mb-4 border-b-4 border-black pb-2 uppercase text-[#E2231A]">Team Intel</h3>
          
          <div className="bg-white border-2 border-black p-3 text-center mb-4">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Selected Team</span>
            <span className="text-sm md:text-base font-bold">{initialStandings.find(t => t.team.abbreviation === selectedTeam)?.team.name}</span>
          </div>

          <div className="flex-grow">
            <table className="w-full text-left border-collapse bg-white border-2 border-black h-full">
              <thead>
                <tr className="border-b-4 border-black text-[10px] md:text-xs bg-[#96EDF6]">
                  <th className="p-1 md:p-2 w-1/4 text-center">BALL</th>
                  <th className="p-1 md:p-2 w-1/4 text-center">COMBOS</th>
                  <th className="p-1 md:p-2 text-right">IMPACT</th>
                </tr>
              </thead>
              <tbody>
                {impact?.map((imp) => {
                  let probText = '';
                  let ballClass = '';
                  let textClass = 'text-black';

                  if (imp.status === 'DRAWN_MATCH') {
                    probText = '✓ MATCH';
                    ballClass = 'bg-[#FFD700] text-black border-[#FFD700] shadow-[0_0_10px_#FFD700]';
                  } else if (imp.status === 'DRAWN_MISS') {
                    probText = '✗ MISS';
                    ballClass = 'bg-[#E2231A] text-white border-[#E2231A] shadow-[0_0_10px_#E2231A]';
                    textClass = 'text-[#E2231A]';
                  } else if (imp.status === 'REMAINING_ALIVE') {
                    probText = `➜ ${imp.probability.toFixed(1)}%`;
                    ballClass = 'bg-white text-green-600 border-green-600 shadow-[0_0_8px_#16a34a]';
                    textClass = 'text-green-700';
                  } else {
                    probText = '➜ 0.0%';
                    ballClass = 'bg-transparent text-gray-400 border-gray-300';
                    textClass = 'text-gray-400 opacity-60';
                  }

                  return (
                    <tr key={imp.ball} className={`text-[10px] md:text-xs transition-colors border-b-2 border-gray-100 ${textClass}`}>
                      <td className="p-1 md:p-[6px] text-center border-r-2 border-black/10">
                        {/* Perfect flex centering inside the ball */}
                        <div className="flex justify-center items-center">
                          <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center font-bold ${ballClass}`}>
                            {imp.ball}
                          </div>
                        </div>
                      </td>
                      <td className="p-1 md:p-[6px] text-center font-bold">
                        {imp.combos > 0 ? imp.combos : '-'}
                      </td>
                      <td className="p-1 md:p-[6px] text-right pr-2 md:pr-4 font-bold">
                        {probText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}