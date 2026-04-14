"use client";

import React from "react";

// The data from '260414 - NHL - Prospect Rankings DRAFT.csv'
const prospectData = [
  { rank: 1, name: "Gavin McKenna (LW)" },
  { rank: 2, name: "Ivar Stenberg (LW)" },
  { rank: 3, name: "Chase Reid (RHD)" },
  { rank: 4, name: "Keaton Verhoeff (RHD)" },
  { rank: 5, name: "Carson Carels (LHD)" },
  { rank: 6, name: "Caleb Malhotra (C)" },
  { rank: 7, name: "Alberts Šmits (LHD)" },
  { rank: 8, name: "Daxon Rudolph (RHD)" },
  { rank: 9, name: "Viggo Björck (C)" },
  { rank: 10, name: "Ryan Lin (RHD)" },
  { rank: 11, name: "Tynan Lawrence (C)" },
  { rank: 12, name: "Ethan Belchetz (LW)" },
  { rank: 13, name: "Oscar Hemming (LW)" },
  { rank: 14, name: "Liam Ruck (RW)" },
  { rank: 15, name: "Adam Novotný (LW)" },
  { rank: 16, name: "Xavier Villeneuve (LHD)" },
  { rank: 17, name: "Oliver Suvanto (C)" },
  { rank: 18, name: "Markus Ruck (C)" },
  { rank: 19, name: "Nikita Klepov (RW)" },
  { rank: 20, name: "Elton Hermansson (RW)" },
  { rank: 21, name: "J.P. Hurlbert (LW)" },
  { rank: 22, name: "Malte Gustafsson (LHD)" },
  { rank: 23, name: "Juho Piiparinen (RHD)" },
  { rank: 24, name: "Wyatt Cullen (LW)" },
  { rank: 25, name: "William Håkansson (LHD)" },
  { rank: 26, name: "Alexander Command (C)" },
  { rank: 27, name: "Mathis Preston (RW)" },
  { rank: 28, name: "Ilia Morozov (C)" },
  { rank: 29, name: "Marcus Nordmark (LW)" },
  { rank: 30, name: "Egor Shilov (C)" },
  { rank: 31, name: "Maddox Dagenais (C)" },
  { rank: 32, name: "Tomas Chrenko (C)" },
];

export default function Ticker() {
  const tickerItems: React.ReactNode[] = [];

  prospectData.forEach((prospect, index) => {
    // 1. Red Rank #, White Name
    tickerItems.push(
      <div key={`prospect-${prospect.rank}`} className="flex items-center mx-8">
        <span style={{ color: "#E2231A" }} className="mr-3">
          {prospect.rank}
        </span>
        <span className="text-white uppercase">
          {prospect.name}
        </span>
      </div>
    );

    // 2. Cyan Separator every 5 prospects
    if ((index + 1) % 8 === 0) {
      tickerItems.push(
        <div
          key={`separator-${prospect.rank}`}
          className="mx-8 uppercase"
          style={{ color: "#96EDF6" }}
        >
          *** PROSPECT RANKINGS ***
        </div>
      );
    }
  });

  return (
    <div className="w-full bg-black border-y-[3px] border-[#E2231A] overflow-hidden py-4 relative flex items-center shadow-[0_0_15px_rgba(226,35,26,0.3)]">
      {/* Applying the 'Press Start 2P' font directly. 
        I am including the @import in the style tag below to ensure it loads.
      */}
      <div className="flex whitespace-nowrap animate-marquee font-press-start">
        
        {/* Loop 1 */}
        <div className="flex items-center">
          {tickerItems}
        </div>
        
        {/* Loop 2 (Seamless overlap) */}
        <div className="flex items-center" aria-hidden="true">
          {tickerItems}
        </div>
        
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        .font-press-start {
          font-family: 'Press Start 2P', cursive;
          font-size: 12px;
          line-height: 1;
          letter-spacing: 0.05em;
        }

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .animate-marquee {
          animation: marquee 60s linear infinite;
          width: max-content;
        }

        /* Ensure pixel-perfect rendering for the retro font */
        .font-press-start span {
          text-rendering: pixelated;
          -webkit-font-smoothing: none;
        }
      `}</style>
    </div>
  );
}