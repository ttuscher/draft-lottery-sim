"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import SimulatorNav, { SimulatorMode } from '../components/SimulatorNav';
import FastDrawBoard from '../components/FastDrawBoard';
import FullDrawBoard from '../components/FullDrawBoard';
import LiveDrawBoard from '../components/LiveDrawBoard';

export default function LotterySimulatorPage() {
  const [mode, setMode] = useState<SimulatorMode>('QUICK');
  const [actionText, setActionText] = useState('PUSH TO\nSTART');
  const [actionDisabled, setActionDisabled] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const triggerSimulationRef = useRef<() => void>(() => {});

  const handleAction = useCallback(() => {
    if (actionDisabled) return;

    const startsNewAttempt =
      mode === 'QUICK' ||
      (mode === 'FULL' && actionText === 'PUSH TO\nSTART') ||
      (mode === 'LIVE' && actionText === 'PUSH TO\nTRY AGAIN');

    if (startsNewAttempt) {
      setAttempts(prev => prev + 1);
    }

    triggerSimulationRef.current?.();
  }, [mode, actionText, actionDisabled]);

  // Reset state when changing modes
  useEffect(() => {
    setAttempts(0);
    if (mode === 'LIVE') {
      setActionText('SELECT\nNUMBERS');
      setActionDisabled(true);
    } else {
      setActionText('PUSH TO\nSTART');
      setActionDisabled(false);
    }
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
          actionDisabled={actionDisabled}
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
            <LiveDrawBoard
              setActionText={setActionText}
              setActionDisabled={setActionDisabled}
              triggerRef={triggerSimulationRef}
            />
          </div>
        )}

      </div>
    </section>
  );
}
