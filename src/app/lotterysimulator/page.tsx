// src/app/lotterysimulator/page.tsx
"use client";

import { useState } from 'react';
import SimulatorNav, { SimulatorMode } from '../../components/SimulatorNav';
import RetroBoard from '../../components/RetroBoard';
import FullDrawBoard from '../../components/FullDrawBoard';

export default function LotterySimulatorPage() {
  const [mode, setMode] = useState<SimulatorMode>('QUICK');

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-5xl mx-auto">
        
        {/* The Mode Switcher */}
        <SimulatorNav currentMode={mode} setMode={setMode} />

        {/* ----------------------------- */}
        {/* VIEW 1: QUICK DRAW            */}
        {/* ----------------------------- */}
        {mode === 'QUICK' && (
          <div className="animate-in fade-in duration-300">
            <RetroBoard />
          </div>
        )}
        
        {/* ----------------------------- */}
        {/* VIEW 2: FULL DRAW             */}
        {/* ----------------------------- */}
        {mode === 'FULL' && (
          <div className="animate-in fade-in duration-300">
            <FullDrawBoard />
          </div>
        )}

        {/* ----------------------------- */}
        {/* VIEW 3: LIVE DRAW             */}
        {/* ----------------------------- */}
        {mode === 'LIVE' && (
          <div className="bg-black text-white p-8 md:p-16 text-center border-4 border-[#E2231A] shadow-[8px_8px_0px_rgba(0,0,0,0.3)] animate-in fade-in duration-300" style={{ fontFamily: 'var(--font-press-start)' }}>
            <h2 className="text-xl md:text-2xl text-[#96EDF6] mb-8 leading-relaxed">
              LIVE DRAW MODE
            </h2>
            <p className="text-xs md:text-sm leading-loose text-gray-300">
              MANUAL BALL ENTRY TERMINAL OFFLINE.<br/><br/>
              (COMING SOON)
            </p>
          </div>
        )}

      </div>
    </main>
  );
}