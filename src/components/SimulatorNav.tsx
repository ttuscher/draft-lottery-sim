"use client";
import React, { useState } from "react";

export type SimulatorMode = "QUICK" | "FULL" | "LIVE";

interface SimulatorNavProps {
  currentMode: SimulatorMode;
  setMode: (mode: SimulatorMode) => void;
  actionText: string;
  onAction: () => void;
  attempts: number;
}

export default function SimulatorNav({
  currentMode,
  setMode,
  actionText,
  onAction,
  attempts,
}: SimulatorNavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const modes = [
    { value: "QUICK" as const, label: "FAST DRAW" },
    { value: "FULL" as const, label: "FULL DRAW" },
    { value: "LIVE" as const, label: "LIVE DRAW" },
  ];

  const currentLabel =
    modes.find((m) => m.value === currentMode)?.label || "QUICK DRAW";

  return (
    <div className="w-full mb-6">
      <div className="grid grid-cols-3 gap-3 md:gap-4 h-full">

        {/* Mode Dropdown */}
        <div className="relative w-full h-full flex items-center col-span-2">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full h-full bg-black text-[#96EDF6] border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center justify-between px-2 md:px-4 py-1.5 transition-all hover:bg-gray-900 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
            style={{ fontFamily: 'var(--font-press-start)' }}
          >
            <span className="text-[9px] sm:text-[10px] md:text-[11px] lg:text-sm leading-snug text-left truncate">
              SIM MODE: {currentLabel}
            </span>
            <span className="text-[9px] md:text-[11px] lg:text-sm text-[#96EDF6] ml-2 flex-shrink-0">
              ▼
            </span>
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-black border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] z-50 flex flex-col">
              {modes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => {
                    setMode(mode.value);
                    setDropdownOpen(false);
                  }}
                  className="text-left text-[#96EDF6] hover:bg-[#96EDF6] hover:text-black text-[9px] sm:text-[10px] md:text-[11px] lg:text-sm py-3 px-4 border-b-2 border-gray-800 last:border-none transition-colors truncate"
                  style={{ fontFamily: 'var(--font-press-start)' }}
                >
                  SIM MODE: {mode.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Button: hidden in LIVE mode */}
        <div className={`w-full h-full relative flex flex-col items-center justify-center col-span-1 ${currentMode === 'LIVE' ? 'invisible' : ''}`}>
          <button
            onClick={onAction}
            className="w-full h-full bg-[#E2231A] hover:bg-[#C41E17] text-white border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center justify-center px-2 md:px-5 py-1.5 transition-all hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
            style={{ fontFamily: 'var(--font-press-start)' }}
          >
            <span className="text-[9px] md:text-[11px] lg:text-sm leading-snug text-center">
              {(currentMode === "FULL" || currentMode === "LIVE") && actionText ? (
                actionText.split('\n').map((line, idx, arr) => (
                  <React.Fragment key={idx}>
                    {line}
                    {idx < arr.length - 1 && <br />}
                  </React.Fragment>
                ))
              ) : (
                attempts > 0 ? (
                  <>PUSH TO<br />TRY AGAIN</>
                ) : (
                  <>PUSH TO<br />START</>
                )
              )}
            </span>
          </button>

          {attempts > 0 && (
            <div
              className="absolute top-full mt-[0.525rem] md:mt-2 w-full text-center text-[7px] sm:text-[9px] text-black drop-shadow-[1px_1px_0_#fff] font-bold tracking-widest uppercase"
              style={{ fontFamily: 'var(--font-press-start)' }}
            >
              ATTEMPTS: {attempts}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
