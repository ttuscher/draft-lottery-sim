'use client';

import React, { useState, useEffect, useCallback } from 'react';
import CroppedLogo from './CroppedLogo';
import { NHL_TEAMS } from '../data/teams';
import { SeededTeam } from '../data/types';
import { PICK_OWNERSHIP } from '../data/pickOwnership';

export interface StarEntry {
  abbrev: string;
  label: string;        // "SORRY" / used for share text
  rightBig: string;     // "1ST" / "2ND" / "3" (number)
  rightSmall: string;   // "OVERALL" / "SPOTS LOST"
  pickNum?: number;     // Final pick number (used for 3rd star "PICK #X")
}

/**
 * Find the "loser" of a conditional trade for 3rd Star fallback.
 */
function findConditionalLoser(
  finalOrder: SeededTeam[],
  usedTeams: Set<string>
): StarEntry | null {
  const conditionalTeams = Object.entries(PICK_OWNERSHIP).filter(
    ([, trade]) => trade.type === 'conditional'
  );

  for (const [teamAbbrev, trade] of conditionalTeams) {
    if (trade.type !== 'conditional') continue;

    const pickIdx = finalOrder.findIndex(s => s.team.abbreviation === teamAbbrev);
    if (pickIdx === -1) continue;
    const pickNum = pickIdx + 1;

    if (pickNum <= trade.protectionThreshold) {
      // Protection held — acquirer lost out
      if (!usedTeams.has(trade.acquirer)) {
        return {
          abbrev: trade.acquirer,
          label: 'SORRY',
          rightBig: `TOP ${trade.protectionThreshold}`,
          rightSmall: 'BLOCKED',
        };
      }
    } else {
      // Pick transfers — original team lost their pick
      if (!usedTeams.has(teamAbbrev)) {
        return {
          abbrev: teamAbbrev,
          label: 'SORRY',
          rightBig: `#${pickNum}`,
          rightSmall: 'PICK LOST',
        };
      }
    }
  }

  return null;
}

/**
 * Compute the 3 Stars from a simulation result.
 *
 * ★   1st overall pick winner (top)
 * ★★  2nd overall pick winner (middle)
 * ★★★ Biggest faller / "Sorry" (bottom)
 *
 * Guarantees 3 different teams.
 */
export function computeThreeStars(finalOrder: SeededTeam[]): [StarEntry, StarEntry, StarEntry] {
  // ★ 1st overall pick
  const first = finalOrder[0];
  const firstStar: StarEntry = {
    abbrev: first.team.abbreviation,
    label: '1ST OVERALL',
    rightBig: '1ST',
    rightSmall: 'OVERALL',
  };

  // ★★ 2nd overall pick
  const second = finalOrder[1];
  const secondStar: StarEntry = {
    abbrev: second.team.abbreviation,
    label: '2ND OVERALL',
    rightBig: '2ND',
    rightSmall: 'OVERALL',
  };

  // ★★★ Biggest faller (different team)
  const usedTeams = new Set([first.team.abbreviation, second.team.abbreviation]);

  let worstDrop = 0;
  let worstDropper: { slot: SeededTeam; pickNum: number } | null = null;

  finalOrder.forEach((slot, index) => {
    const pickNum = index + 1;
    const change = slot.seed - pickNum;
    if (!usedTeams.has(slot.team.abbreviation) && change < worstDrop) {
      worstDrop = change;
      worstDropper = { slot, pickNum };
    }
  });

  let thirdStar: StarEntry;

  if (worstDropper && worstDrop < 0) {
    const wd = worstDropper as { slot: SeededTeam; pickNum: number };
    const dropCount = Math.abs(worstDrop);
    thirdStar = {
      abbrev: wd.slot.team.abbreviation,
      label: 'SORRY',
      rightBig: `${dropCount}`,
      rightSmall: dropCount === 1 ? 'SPOT LOST' : 'SPOTS LOST',
      pickNum: wd.pickNum,
    };
  } else {
    const conditional = findConditionalLoser(finalOrder, usedTeams);
    if (conditional) {
      thirdStar = conditional;
    } else {
      // Final fallback: last lottery pick not already used
      thirdStar = { abbrev: finalOrder[finalOrder.length - 1].team.abbreviation, label: 'SORRY', rightBig: '0', rightSmall: 'SPOTS LOST', pickNum: finalOrder.length };
      for (let i = finalOrder.length - 1; i >= 0; i--) {
        if (!usedTeams.has(finalOrder[i].team.abbreviation)) {
          const drop = Math.abs(finalOrder[i].seed - (i + 1));
          thirdStar = {
            abbrev: finalOrder[i].team.abbreviation,
            label: 'SORRY',
            rightBig: `${drop}`,
            rightSmall: drop > 0 ? (drop === 1 ? 'SPOT LOST' : 'SPOTS LOST') : 'NO MOVEMENT',
            pickNum: i + 1,
          };
          break;
        }
      }
    }
  }

  return [firstStar, secondStar, thirdStar];
}

interface ThreeStarsProps {
  stars: [StarEntry, StarEntry, StarEntry];
  onClose: () => void;
  onShare?: () => void;
}

export default function ThreeStars({ stars, onClose, onShare }: ThreeStarsProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showButtons, setShowButtons] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Staggered reveals: 1st (top) → 2nd → 3rd (bottom), then buttons
  useEffect(() => {
    setVisibleCount(0);
    setShowButtons(false);
    const t1 = setTimeout(() => setVisibleCount(1), 800);
    const t2 = setTimeout(() => setVisibleCount(2), 1800);
    const t3 = setTimeout(() => setVisibleCount(3), 2800);
    const t4 = setTimeout(() => setShowButtons(true), 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [stars]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const shareText = useCallback(() => {
    const lines = stars.map((s, i) => {
      const team = NHL_TEAMS[s.abbrev];
      const name = team ? `${team.city} ${team.name}` : s.abbrev;
      const prefix = i === 0 ? '1st Pick' : i === 1 ? '2nd Pick' : 'Sorry';
      return `${prefix}: ${name} (${s.rightBig} ${s.rightSmall})`;
    });
    return `Stars of the Lottery\n${lines.join('\n')}\n\ndraftlotterysim.com`;
  }, [stars]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText('https://draftlotterysim.com').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, []);

  const handleShareX = useCallback(() => {
    const text = encodeURIComponent(shareText());
    window.open(`https://x.com/intent/tweet?text=${text}`, '_blank', 'noopener');
  }, [shareText]);

  const handleShareIG = useCallback(() => {
    // Instagram doesn't have a web share API — copy text for user to paste
    navigator.clipboard.writeText(shareText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [shareText]);

  // ★ = 1st pick, ★★ = 2nd pick, ★★★ = sorry
  const starLabels = ['★', '★★', '★★★'];
  const subLabels = ['WINNER!', 'RUNNER-UP', 'SORRY!'];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        fadeIn ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ fontFamily: 'var(--font-press-start)' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[94vw] max-w-[420px] md:max-w-[600px] lg:max-w-[680px] mx-auto">

        {/* CRT scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
          }}
        />

        {/* Main panel — symmetric vertical padding */}
        <div className="relative bg-black border-4 border-[#96EDF6] px-2 sm:px-3 md:px-5 py-4 sm:py-5 md:py-7 shadow-[0_0_40px_rgba(150,237,246,0.3),0_0_80px_rgba(150,237,246,0.1)] overflow-hidden flex flex-col">

          {/* === HEADER ZONE === */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <span className="text-[#FFCC00] text-2xl sm:text-3xl md:text-5xl animate-pulse -mt-2 sm:-mt-3 md:-mt-4">★★★</span>
              <span className="text-[#FFCC00] text-xl sm:text-3xl md:text-4xl uppercase tracking-wider [text-shadow:3px_3px_0_#E2231A]">
                STARS OF
              </span>
              <span className="text-[#FFCC00] text-2xl sm:text-3xl md:text-5xl animate-pulse -mt-2 sm:-mt-3 md:-mt-4">★★★</span>
            </div>
            <span className="text-[#FFCC00] text-xl sm:text-3xl md:text-4xl uppercase tracking-wider [text-shadow:3px_3px_0_#E2231A] mt-1 sm:mt-2">
              THE LOTTERY
            </span>
          </div>

          {/* Divider */}
          <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-[#96EDF6]/50 to-transparent my-3 sm:my-4 md:my-6" />

          {/* === STAR ROWS — 3-column grid === */}
          <div className="flex flex-col gap-2 sm:gap-3 md:gap-4 mx-2 sm:mx-3 md:mx-5">
            {[0, 1, 2].map((starIdx) => {
              const star = stars[starIdx];
              const team = NHL_TEAMS[star.abbrev];
              const isVisible = visibleCount >= starIdx + 1;
              const isSorry = starIdx === 2;

              return (
                <div
                  key={starIdx}
                  className={`grid grid-cols-[0.8fr_1.8fr_1fr] items-center px-1 sm:px-2 md:px-3 py-2 sm:py-3 md:py-4 transition-all duration-700 ${
                    isVisible
                      ? 'opacity-100 translate-y-0 scale-100'
                      : 'opacity-0 translate-y-6 scale-95'
                  } ${starIdx === 0
                    ? 'bg-[#FFCC00]/10 border border-[#FFCC00]/40 shadow-[0_0_20px_rgba(255,204,0,0.15)]'
                    : isSorry
                    ? 'bg-[#E2231A]/10 border border-[#E2231A]/30'
                    : 'border border-[#96EDF6]/10'
                  }`}
                >
                  {/* LEFT PANEL: Star symbols — nudged up to visually center */}
                  <div className="flex justify-center items-center self-center -mt-2 sm:-mt-2.5 md:-mt-3">
                    <div className={`text-[#FFCC00] text-3xl sm:text-4xl md:text-5xl leading-[1] flex flex-col items-center ${
                      starIdx === 0 ? '[text-shadow:2px_2px_0_#E2231A] animate-pulse' : ''
                    }`}>
                      {starIdx === 2 ? (
                        <>
                          <span className="leading-[0.7]">★★</span>
                          <span className="leading-[0.7]">★</span>
                        </>
                      ) : (
                        <span>{starLabels[starIdx]}</span>
                      )}
                    </div>
                  </div>

                  {/* CENTER PANEL: Logo + text — fixed sub-grid for alignment */}
                  <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 sm:gap-x-3 md:gap-x-4">
                    {team?.logoLight && (
                      <div className="flex items-center justify-center w-14 h-14 sm:w-18 sm:h-18 md:w-24 md:h-24">
                        <CroppedLogo
                          src={team.logoLight}
                          alt={star.abbrev}
                          sizeClass="w-14 h-14 sm:w-18 sm:h-18 md:w-24 md:h-24"
                          wrapperClass=""
                        />
                      </div>
                    )}
                    <div className="flex flex-col justify-center">
                      <span className="font-bold text-lg sm:text-xl md:text-3xl uppercase leading-tight text-white">
                        {star.abbrev}
                      </span>
                      <span className={`text-[9px] sm:text-[11px] md:text-sm uppercase tracking-wider mt-0.5 ${
                        starIdx === 0 ? 'text-[#FFCC00]'
                        : isSorry ? 'text-[#E2231A]/70'
                        : 'text-[#96EDF6]'
                      }`}>
                        {subLabels[starIdx]}
                      </span>
                    </div>
                  </div>

                  {/* RIGHT PANEL: Stat block — centered */}
                  <div className="flex flex-col items-center justify-center">
                    <span className={`font-bold leading-none whitespace-nowrap ${
                      isSorry
                        ? 'text-[#E2231A] [text-shadow:2px_2px_0_#7f1d1d] text-lg sm:text-xl md:text-3xl'
                        : 'text-[#FFCC00] [text-shadow:2px_2px_0_#E2231A] text-xl sm:text-2xl md:text-4xl'
                    }`}>
                      {star.rightBig}
                    </span>
                    <span className={`uppercase tracking-wider mt-1 md:mt-1.5 text-center ${
                      isSorry
                        ? 'text-[#E2231A]/70 text-[9px] sm:text-[11px] md:text-sm'
                        : 'text-[#FFCC00]/70 text-[9px] sm:text-[11px] md:text-sm'
                    }`}>
                      {star.rightSmall}
                    </span>
                    {star.pickNum && (
                      <span className="text-[#E2231A]/50 text-[9px] sm:text-[11px] md:text-sm uppercase tracking-wider mt-0.5 text-center">
                        PICK #{star.pickNum}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-[#96EDF6]/50 to-transparent my-3 sm:my-4 md:my-6" />

          {/* === FOOTER ZONE: Buttons + branding === */}
          <div className={`flex items-center justify-center gap-3 sm:gap-4 transition-all duration-500 ${
            showButtons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            {/* Share button with dropdown */}
            <div className="relative w-[140px] sm:w-[160px] md:w-[180px]">
              <button
                type="button"
                onClick={() => setShareOpen(prev => !prev)}
                disabled={!showButtons}
                className="w-full bg-[#96EDF6] text-black border-2 border-[#96EDF6] px-3 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-[11px] md:text-xs font-bold uppercase tracking-wider text-center whitespace-nowrap shadow-[4px_4px_0px_rgba(150,237,246,0.4)] transition-all hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(150,237,246,0.4)] active:translate-y-1 active:shadow-none cursor-pointer"
              >
                {copied ? 'COPIED!' : 'SHARE'}
              </button>

              {shareOpen && (
                <div className="absolute bottom-full left-0 w-full mb-2 bg-black border-2 border-[#96EDF6] shadow-[0_0_20px_rgba(150,237,246,0.3)] z-20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { handleCopyLink(); setShareOpen(false); }}
                    className="group w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 text-[8px] sm:text-[10px] md:text-xs text-[#96EDF6] hover:bg-[#96EDF6] hover:text-black transition-colors font-bold uppercase tracking-wider whitespace-nowrap border-b border-[#96EDF6]/20 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    COPY LINK
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleShareX(); setShareOpen(false); }}
                    className="group w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 text-[8px] sm:text-[10px] md:text-xs text-[#96EDF6] hover:bg-[#96EDF6] hover:text-black transition-colors font-bold uppercase tracking-wider whitespace-nowrap border-b border-[#96EDF6]/20 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    SHARE TO X
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleShareIG(); setShareOpen(false); }}
                    className="group w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 text-[8px] sm:text-[10px] md:text-xs text-[#96EDF6] hover:bg-[#96EDF6] hover:text-black transition-colors font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <circle cx="12" cy="12" r="5" />
                      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                    </svg>
                    SHARE TO INSTA
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={!showButtons}
              className="w-[140px] sm:w-[160px] md:w-[180px] bg-[#FFCC00] text-black border-2 border-[#FFCC00] px-3 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-[11px] md:text-xs font-bold uppercase tracking-wider text-center whitespace-nowrap shadow-[4px_4px_0px_rgba(255,204,0,0.4)] transition-all hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(255,204,0,0.4)] active:translate-y-1 active:shadow-none cursor-pointer"
            >
              VIEW RESULTS
            </button>
          </div>

          {/* Branding + ESC hint */}
          <div className={`text-center mt-2 sm:mt-3 transition-opacity duration-500 ${showButtons ? 'opacity-100' : 'opacity-0'}`}>
            <span className="hidden md:block text-[#96EDF6]/30 text-[8px] uppercase tracking-widest mb-1">
              ESC TO CLOSE
            </span>
            <span className="text-[#96EDF6] text-[7px] sm:text-[8px] md:text-[10px] font-bold uppercase tracking-wider">
              DRAFT LOTTERY SIMULATOR BY PUCKSON.NET
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
