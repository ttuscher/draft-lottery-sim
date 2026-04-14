// src/app/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { NHL_TEAMS } from '../data/teams';
import lotteryData from '../data/lottery-2025.json';

// Standard, mathematically exact 2025 NHL Draft 2nd Overall Odds
const secondOverallOdds: Record<string, number> = {
  'SJS': 18.8, 'CHI': 14.1, 'NSH': 11.2, 'PHI': 9.6, 'BOS': 8.6,
  'SEA': 7.8, 'BUF': 6.8, 'ANA': 6.3, 'PIT': 5.4, 'NYI': 3.8,
  'NYR': 3.3, 'DET': 5.3, 'CBJ': 0.0, 'UTA': 0.0, 'VAN': 0.0, 'CGY': 0.0
};

export default function LandingPage() {
  // SAFETY CHECK: If the JSON import fails, show an error message instead of crashing
  if (!lotteryData || !lotteryData.teamOrder) {
    return (
      <div className="p-10 text-center bg-white retro-border m-10" style={{ fontFamily: 'var(--font-press-start)' }}>
        <h2 className="text-red-600 mb-4">SYSTEM ERROR: DATA NOT FOUND</h2>
        <p className="text-xs">Ensure lottery-2025.json is in src/data/</p>
      </div>
    );
  }

  const standings = lotteryData.teamOrder.map((teamCode: string, index: number) => {
    const teamInfo = NHL_TEAMS[teamCode];
    const lotteryInfo = (lotteryData.teams as Record<string, any>)[teamCode];
    
    return {
      seed: index + 1,
      team: teamInfo || { abbreviation: teamCode, city: teamCode, name: 'UNKNOWN', logoLight: '', logoDark: '' },
      odds1: lotteryInfo ? lotteryInfo.baseOverallNo1Odds : 0,
      odds2: secondOverallOdds[teamCode] || 0
    };
  });

  return (
    <main className="min-h-screen py-12 px-4 flex flex-col items-center" style={{ fontFamily: 'var(--font-press-start)' }}>
      <div className="w-full max-w-5xl bg-white retro-border p-4 md:p-8 shadow-[8px_8px_0px_rgba(0,0,0,0.3)] animate-in fade-in">
        <h2 className="text-lg md:text-2xl mb-6 text-center border-b-4 border-black pb-4 text-[#E2231A] uppercase tracking-wider">
          Current Standings
        </h2>
        <div className="overflow-x-auto mb-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#B8F6FA] border-b-4 border-black text-[10px] md:text-xs">
                <th className="p-3 text-center w-12 md:w-16">SEED</th>
                <th className="p-3">TEAM</th>
                <th className="p-3 text-right">1ST OVERALL</th>
                <th className="p-3 text-right">2ND OVERALL</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr key={row.team.abbreviation} className="border-b-2 border-gray-200 text-[10px] md:text-xs hover:bg-[#96EDF6] transition-colors">
                  <td className="p-3 text-center font-bold text-[#E2231A]">{row.seed}</td>
                  <td className="p-2 md:p-3">
                    <div className="flex items-center gap-3 md:gap-4">
                      {row.team.logoLight && (
                        <img 
                          src={row.team.logoLight} 
                          alt={row.team.abbreviation}
                          className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-[3px_3px_0_rgba(0,0,0,1)] saturate-[2.5] contrast-[1.5] brightness-110 sepia-[.15]"
                          style={{ imageRendering: 'pixelated' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                        />
                      )}
                      <span className="uppercase whitespace-nowrap">{row.team.city} {row.team.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-right font-bold">{row.odds1 > 0 ? `${row.odds1.toFixed(1)}%` : '-'}</td>
                  <td className="p-3 text-right font-bold">{row.odds2 > 0 ? `${row.odds2.toFixed(1)}%` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center">
          <Link href="/lotterysimulator" className="bg-[#E2231A] text-white px-6 py-4 md:px-10 md:py-5 border-4 border-black hover:bg-black hover:text-[#96EDF6] transition-colors text-xs md:text-sm text-center inline-block shadow-[6px_6px_0px_rgba(0,0,0,0.2)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[4px_4px_0px_rgba(0,0,0,0.2)] uppercase tracking-widest">
            Commence Lottery
          </Link>
        </div>
      </div>
    </main>
  );
}