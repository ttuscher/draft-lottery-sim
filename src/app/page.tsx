"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import SimulatorNav, { SimulatorMode } from '../components/SimulatorNav';
import FastDrawBoard from '../components/FastDrawBoard';
import FullDrawBoard from '../components/FullDrawBoard';
import LiveDrawBoard from '../components/LiveDrawBoard';

export default function LotterySimulatorPage() {
  const [mode, setMode] = useState<SimulatorMode>('QUICK');
  const [actionText, setActionText] = useState('PUSH TO\nSTART');
  const [attempts, setAttempts] = useState(0);

  const triggerSimulationRef = useRef<() => void>(() => {});

  const handleAction = useCallback(() => {
    const startsNewAttempt =
      mode === 'QUICK' ||
      (mode === 'FULL' && actionText === 'PUSH TO\nSTART') ||
      (mode === 'LIVE' && actionText === 'PUSH TO\nTRY AGAIN');

    if (startsNewAttempt) {
      setAttempts(prev => prev + 1);
    }

    triggerSimulationRef.current?.();
  }, [mode, actionText]);

  // Reset state when changing modes
  useEffect(() => {
    setAttempts(0);
    setActionText(mode === 'LIVE' ? 'ENTER\nBALLS' : 'PUSH TO\nSTART');
  }, [mode]);

  return (
    <section className="w-full pt-3 pb-2">
      <div className="max-w-5xl mx-auto px-4">

        <SimulatorNav
          currentMode={mode}
          setMode={setMode}
          actionText={actionText}
          onAction={handleAction}
          attempts={attempts}
        />

        {mode === 'QUICK' && (
          <div className="animate-in fade-in duration-300">
            <FastDrawBoard triggerRef={triggerSimulationRef} />
          </div>
        )}

        {mode === 'FULL' && (
          <div className="animate-in fade-in duration-300">
            <FullDrawBoard setActionText={setActionText} triggerRef={triggerSimulationRef} />
          </div>
        )}

        {mode === 'LIVE' && (
          <div className="animate-in fade-in duration-300">
            <LiveDrawBoard setActionText={setActionText} triggerRef={triggerSimulationRef} />
          </div>
        )}

      </div>
    </section>
  );
}
