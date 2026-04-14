// src/components/Ticker.tsx
"use client";

import React from 'react';

export default function Ticker() {
  // Generate 16 placeholder prospects
  const prospects = Array.from({ length: 16 }, (_, i) => `PROSPECT #${i + 1}`);

  // Duplicate the array to allow the CSS animation to loop seamlessly
  const tickerItems = [...prospects, ...prospects];

  return (
    <div className="ticker-container shadow-[0_-4px_15px_rgba(0,0,0,0.3)]" style={{ fontFamily: 'var(--font-press-start)' }}>
      <div className="ticker-content">
        {tickerItems.map((prospect, index) => {
          // Calculate true rank 1-16 even in the duplicated half
          const rank = (index % 16) + 1;
          
          return (
            <div key={index} className="inline-block text-[10px] md:text-xs text-white mr-12 md:mr-24">
              <span className="text-[#E2231A] mr-2 md:mr-3">{rank}</span> 
              {prospect}
            </div>
          );
        })}
      </div>
    </div>
  );
}