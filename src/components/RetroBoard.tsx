"use client";

import React, { useState } from 'react';
import { runSimulation } from '../lib/engine';
import { NHL_TEAMS } from '../data/teams';
import { SeededTeam, LotteryCombo, SimulationResult } from '../data/types';
import lotteryData from '../data/lottery-2025.json';

// 1. Build the initial 16-team standings directly from the JSON configuration
const initialStandings: SeededTeam[] = lotteryData.teamOrder.map((teamCode: string, index: number) => {
  const teamInfo = NHL_TEAMS[teamCode];
  
  // Fallback just in case a team code doesn't match perfectly
  if (!teamInfo) {
    console.warn(`Missing logo/team info for: ${teamCode}`);
  }

  return {
    seed: index + 1,
    team: teamInfo || { abbreviation: teamCode, city: teamCode, name: 'UNKNOWN', logoLight: '', logoDark: '' },
    combinations: 0 // The 14-ball engine doesn't need this, but it satisfies the TypeScript interface
  };
});

export default function RetroBoard() {
  // State to hold the current order of the board
  const [board, setBoard] = useState<SeededTeam[]>(initialStandings);
  // State to hold the explicit winners of the drawing
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleQuickDraw = () => {
    // Pass the standings, the literal 1001 combinations from the JSON, and the 10-spot rule
    const combos = lotteryData.entries as LotteryCombo[];
    const simResult = runSimulation(initialStandings, combos, 10);
    
    setResult(simResult);
    setBoard(simResult.finalOrder);
  };

  const handleReset = () => {
    setBoard(initialStandings);
    setResult(null);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      
      {/* Top Console / Commentary Box */}
      <div className="bg-[#B8F6FA] retro-border p-4 mb-8 flex flex-col md:flex-row justify-between items-center gap-4" style={{ fontFamily: 'var(--font-press-start)' }}>
        <p className="text-sm md:text-base uppercase leading-relaxed text-center md:text-left">
          {!result ? "PRESS START TO COMMENCE THE LOTTERY..." : "SIMULATION COMPLETE. BEHOLD THE RESULTS."}
        </p>
        
        <div className="flex gap-4">
          {!result ? (
            <button 
              onClick={handleQuickDraw}
              className="bg-[#E2231A] text-white px-6 py-3 retro-border hover:bg-black transition-colors text-sm"
            >
              QUICK DRAW
            </button>
          ) : (
            <button 
              onClick={handleReset}
              className="bg-black text-white px-6 py-3 retro-border hover:bg-gray-800 transition-colors text-sm"
            >
              RESET
            </button>
          )}
        </div>
      </div>

      {/* 16-Slot Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8" style={{ fontFamily: 'var(--font-press-start)' }}>
        {board.map((slot, index) => {
          const pickNum = index + 1;
          
          // Determine if this specific team actually won a lottery draw
          const isDraw1Winner = result?.draw1Winner.team.abbreviation === slot.team.abbreviation;
          const isDraw2Winner = result?.draw2Winner.team.abbreviation === slot.team.abbreviation;
          const isWinner = isDraw1Winner || isDraw2Winner;

          return (
            <div key={slot.team.abbreviation} className="flex items-center gap-3">
              
              {/* Pick Number Circle */}
              <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 bg-black text-white flex items-center justify-center rounded-full border-4 border-black text-sm md:text-base">
                {pickNum}
              </div>

              {/* Team Box */}
              <div className={`team-box flex-grow flex justify-between items-center p-3 ${isWinner ? 'winner' : ''}`}>
                <div className="flex flex-col gap-2 uppercase text-[10px] md:text-xs">
                  <span>{slot.team.city}</span>
                  <span>{slot.team.name}</span>
                </div>
                
                <div className="flex gap-2">
                  {/* Show jump/drop indicator if simulation has run */}
                  {result && slot.seed !== pickNum && (
                    <div className="flex flex-col items-center justify-center text-[10px]">
                      {slot.seed > pickNum ? (
                        <span className="text-green-600">▲ {slot.seed - pickNum}</span>
                      ) : (
                        <span className="text-red-600">▼ {pickNum - slot.seed}</span>
                      )}
                    </div>
                  )}

                  <div className={`flex flex-col items-center p-2 border-2 border-black ${isWinner ? 'bg-black text-white' : 'bg-[#B8F6FA] text-black'}`}>
                    <span className="text-xs md:text-sm">{slot.seed}</span>
                    <span className="text-[8px] mt-1 uppercase">Seed</span>
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