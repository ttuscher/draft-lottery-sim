// src/components/SimulatorNav.tsx
"use client";

import React from 'react';

export type SimulatorMode = 'QUICK' | 'FULL' | 'LIVE';

interface NavProps {
  currentMode: SimulatorMode;
  setMode: (mode: SimulatorMode) => void;
}

export default function SimulatorNav({ currentMode, setMode }: NavProps) {
  const modes: SimulatorMode[] = ['QUICK', 'FULL', 'LIVE'];

  return (
    <div className="flex flex-col md:flex-row justify-center gap-4 mb-8" style={{ fontFamily: 'var(--font-press-start)' }}>
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => setMode(mode)}
          className={`px-4 py-3 text-sm md:text-base border-4 transition-colors ${
            currentMode === mode 
              ? 'bg-black text-white border-black' 
              : 'bg-white text-black border-black hover:bg-[#96EDF6]'
          }`}
        >
          {mode} DRAW
        </button>
      ))}
    </div>
  );
}