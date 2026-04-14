// src/app/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { NHL_TEAMS } from '../data/teams';
import lotteryData from '../data/lottery-2025.json';

const secondOverallOdds: Record<string, number> = {
  'SJS': 18.8, 'CHI': 14.1, 'NSH': 11.2, 'PHI': 9.6, 'BOS': 8.6,
  'SEA': 7.8, 'BUF': 6.8, 'ANA': 6.3, 'PIT': 5.4, 'NYI': 3.8,
  'NYR': 3.3, 'DET': 5.3, 'CBJ': 0.0, 'UTA': 0.0, 'VAN': 0.0, 'CGY': 0.0
};

export default function LandingPage() {
  const teamOrder = lotteryData?.teamOrder || [];
  const teamsData = lotteryData?.teams || {};

  if (teamOrder.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-10" style={{ fontFamily: 'var(--font-press-start)' }}>
        <div className="border-4 border-red-600 p-8 text-center">
          <h2 className="text-red-600 text-xl mb-6 uppercase tracking-tighter" style={{ fontFamily: 'var(--font-press-start)' }}>! System Error !</h2>
          <p className="text-[10px] leading-loose">Verify JSON source at: src/data/lottery-2025.json</p>
        </div>
      </div>
    );
  }

  const standings = teamOrder.map((teamCode: string, index: number) => {
    const teamInfo = NHL_TEAMS[teamCode];
    const lotteryInfo = (teamsData as Record<string, any>)[teamCode];
    
    return {
      seed: index + 1,
      team: teamInfo || { abbreviation: teamCode, city: teamCode, name: 'UNKNOWN', logoLight: '', logoDark: '' },
      odds1: lotteryInfo ? lotteryInfo.baseOverallNo1Odds : 0,
      odds2: secondOverallOdds[teamCode] || 0
    };
  });

  return (
    <main className="min-h-screen py-12 px-4 flex flex-col items-center" style={{ fontFamily: 'var(--font-press-start)' }}>
      <div className="w-full max-w-5xl bg-white retro-border p-4 md:p-8 shadow-[8px_8px_0px_rgba(0,0,0,0.3)]">
        
        {/* Explicitly applying the Press Start 2P font to the header here */}
        <h2 className="text-lg md:text-2xl mb-6 text-center border-b-4 border-black pb-4 text-[#E2231A] uppercase tracking-wider" style={{ fontFamily: 'var(--font-press-start)' }}>
          DRAFT ORDER
        </h2>
        
        <div className="overflow-x-auto mb-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#B8F6FA] border-b-4 border-black text-[10px]">
                <th className="p-3 text-center">PICK</th>
                <th className="p-3">TEAM</th>
                <th className="p-3 text-right">1ST OVR</th>
                <th className="p-3 text-right">2ND OVR</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr key={row.team.abbreviation} className="border-b-2 border-gray-100 text-[10px] hover:bg-gray-50 transition-colors">
                  <td className="p-3 text-center font-bold text-[#E2231A]">{row.seed}</td>
                  <td className="p-2 flex items-center gap-4">
                    {row.team.logoLight && (
                      <img 
                        src={row.team.logoLight} 
                        alt=""
                        className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-[2px_2px_0_rgba(0,0,0,1)] saturate-[2.2] contrast-[1.4] brightness-110"
                        style={{ imageRendering: 'pixelated' }}
                        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                      />
                    )}
                    <span className="uppercase">{row.team.city} {row.team.name}</span>
                  </td>
                  <td className="p-3 text-right font-bold">{row.odds1 > 0 ? `${row.odds1.toFixed(1)}%` : '-'}</td>
                  <td className="p-3 text-right font-bold">{row.odds2 > 0 ? `${row.odds2.toFixed(1)}%` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-center">
          <Link href="/lotterysimulator" className="bg-[#E2231A] text-white px-8 py-4 border-4 border-black hover:bg-black hover:text-white transition-all uppercase text-xs tracking-widest">
            Commence Lottery
          </Link>
        </div>
      </div>
    </main>
  );
}