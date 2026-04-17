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
    tickerItems.push(
      <div key={`prospect-${prospect.rank}`} className="flex items-center mx-8">
        <span className="text-[#E2231A] mr-3">
          {prospect.rank}
        </span>
        <span className="text-white uppercase">
          {prospect.name}
        </span>
      </div>
    );

    // Cyan separator every 8 prospects
    if ((index + 1) % 8 === 0) {
      tickerItems.push(
        <div
          key={`separator-${prospect.rank}`}
          className="mx-8 uppercase text-[#96EDF6]"
        >
          *** PROSPECT RANKINGS ***
        </div>
      );
    }
  });

  return (
    <div className="ticker-container">
      <div className="ticker-content text-[9px] md:text-[12px]" style={{ fontFamily: 'var(--font-press-start)', letterSpacing: '0.05em' }}>
        <div className="inline-flex items-center">{tickerItems}</div>
        <div className="inline-flex items-center" aria-hidden="true">{tickerItems}</div>
      </div>
    </div>
  );
}
