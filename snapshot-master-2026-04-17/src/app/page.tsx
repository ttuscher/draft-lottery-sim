"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import SimulatorNav, { SimulatorMode } from '../components/SimulatorNav';
import FastDrawBoard from '../components/FastDrawBoard';
import FullDrawBoard from '../components/FullDrawBoard';

export default function LotterySimulatorPage() {
  const [mode, setMode] = useState<SimulatorMode>('QUICK');
  const [actionText, setActionText] = useState('PUSH TO\nSTART');
  const [attempts, setAttempts] = useState(0);

  const triggerSimulationRef = useRef<() => void>(() => {});

  const handleAction = useCallback(() => {
    const startsNewAttempt =
      mode === 'QUICK' ||
      (mode === 'FULL' && actionText === 'PUSH TO\nSTART');

    if (startsNewAttempt) {
      setAttempts(prev => prev + 1);
    }

    triggerSimulationRef.current?.();
  }, [mode, actionText]);

  // Reset state when changing between QUICK and FULL
  useEffect(() => {
    setAttempts(0);
    setActionText('PUSH TO\nSTART');
  }, [mode]);

  return (
    <section className="w-full pt-3 pb-8">
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

      </div>
    </section>
  );
}
