// src/lib/analytics.ts
//
// Live-draw math for the NHL Draft Lottery. Two exports:
//
//   calculateLiveOdds   – P(team wins this draw | balls drawn so far)
//   getFullBallImpacts  – per-ball effect on a selected team's odds
//
// Both functions correctly account for:
//   1. The REDRAW combo (11-12-13-14) triggering a full fresh draw.
//   2. For Draw 2, the Draw 1 winner's combos also triggering a fresh draw
//      (the Draw 1 winner cannot win Draw 2, so their combos effectively
//      cause a redraw of Draw 2).
//
// Formula
// -------
// Let D = set of balls drawn so far. For any team T:
//
//     P(T | D, d1) = T_D / N_D  +  (X_D / N_D) * P(T | fresh, d1)
//
// where
//     N_D  = # combos containing D
//     T_D  = T's combos containing D
//     X_D  = # combos containing D that trigger a redraw (REDRAW plus,
//            for Draw 2, the d1 winner's combos)
//
// The "fresh" probability is the closed-form steady state after infinite
// potential redraws:
//
//     P(T | fresh, d1) = T_total / V_empty
//     V_empty          = 1001 - 1 - (d1's total combos, or 0 for Draw 1)
//
// The Draw 1 winner's winProbability for Draw 2 is defined to be 0; their
// combos still appear in `remainingCombos` so the UI can make it visible
// that drawing those balls would trigger a redraw.

import { LotteryCombo } from '../data/types';

const REDRAW_CODE = 'REDRAW';

// ---------- Types --------------------------------------------------------------

export interface LiveOdds {
  teamCode: string;
  /** Target team's combos still containing every drawn ball. */
  remainingCombos: number;
  /** Probability this team wins the current draw, in percent (0–100). */
  winProbability: number;
  /** True if this team already won Draw 1 and is being shown for context. */
  isDraw1Winner: boolean;
}

export type BallStatus = 'DRAWN_MATCH' | 'DRAWN_MISS' | 'REMAINING_ALIVE' | 'REMAINING_DEAD';

export interface DetailedBallImpact {
  ball: number;
  status: BallStatus;
  /** Display value: for remaining balls, the hypothetical probability if drawn next.
   *  For drawn matching balls, 100 (status indicator, not a true probability).
   *  For drawn misses and dead balls, 0. */
  displayProbability: number;
  /** Percentage-point change vs. the team's current odds. 0 for drawn balls. */
  oddsChange: number;
  /** Target team's combos that would still contain the drawn set plus this ball. */
  combos: number;
  /** Chronological index for drawn balls; 99 for not-yet-drawn balls. */
  drawOrder: number;
}

// ---------- Core probability ---------------------------------------------------

function containsAll(combo: LotteryCombo, balls: number[]): boolean {
  for (const b of balls) if (!combo.balls.includes(b)) return false;
  return true;
}

/**
 * Exact probability team `targetTeam` wins the current draw given the
 * partially-drawn ball set. Returns a decimal in [0, 1].
 *
 * Returns 0 if `targetTeam` is the Draw 1 winner (they already won).
 */
export function probabilityOfWin(
  allCombos: LotteryCombo[],
  drawnBalls: number[],
  targetTeam: string,
  draw1WinnerCode?: string
): number {
  if (targetTeam === draw1WinnerCode) return 0;

  const redrawTriggers = new Set<string>([REDRAW_CODE]);
  if (draw1WinnerCode) redrawTriggers.add(draw1WinnerCode);

  let N_D = 0;    // all combos containing drawnBalls
  let X_D = 0;    // redraw-triggering combos containing drawnBalls
  let T_D = 0;    // target's combos containing drawnBalls
  let T_total = 0;   // target's total combos (base)
  let V_empty = 0;   // total non-redraw-triggering combos (base)

  for (const c of allCombos) {
    const triggersRedraw = redrawTriggers.has(c.teamCode);
    const isTarget = c.teamCode === targetTeam;

    if (!triggersRedraw) V_empty++;
    if (isTarget) T_total++;

    if (containsAll(c, drawnBalls)) {
      N_D++;
      if (triggersRedraw) X_D++;
      if (isTarget) T_D++;
    }
  }

  if (N_D === 0 || V_empty === 0) return 0;

  const probFromThisDraw = T_D / N_D;
  const probFromRedraw = (X_D / N_D) * (T_total / V_empty);
  return probFromThisDraw + probFromRedraw;
}

// ---------- Public helpers -----------------------------------------------------

/**
 * Computes live odds for every team, including (optionally) the Draw 1
 * winner. The Draw 1 winner's probability is always 0, but their
 * `remainingCombos` reflects how many of their combos are still "live"
 * (drawing one of those combinations would trigger a redraw of Draw 2).
 *
 * Sums of winProbability across active teams equal 100% (mathematically).
 */
export function calculateLiveOdds(
  allCombos: LotteryCombo[],
  drawnBalls: number[],
  teamCodes: string[],
  draw1WinnerCode?: string
): LiveOdds[] {
  // Pre-index target combos for efficiency.
  const comboByTeam: Record<string, LotteryCombo[]> = {};
  for (const c of allCombos) {
    (comboByTeam[c.teamCode] ??= []).push(c);
  }

  return teamCodes
    .map(teamCode => {
      const isDraw1Winner = teamCode === draw1WinnerCode;
      const winProbability = probabilityOfWin(
        allCombos,
        drawnBalls,
        teamCode,
        draw1WinnerCode
      ) * 100;
      const remainingCombos = (comboByTeam[teamCode] ?? []).filter(c =>
        containsAll(c, drawnBalls)
      ).length;
      return { teamCode, remainingCombos, winProbability, isDraw1Winner };
    })
    .sort((a, b) => {
      // Pin the Draw 1 winner to the top of the table for visibility.
      if (a.isDraw1Winner !== b.isDraw1Winner) return a.isDraw1Winner ? -1 : 1;
      return b.winProbability - a.winProbability;
    });
}

/**
 * For each of the 14 balls, returns the status and the hypothetical effect
 * on `targetTeam`'s win probability.
 *
 *   • DRAWN_MATCH   – ball has already been drawn and kept at least one of
 *                     the team's combos alive. `oddsChange` is 0 (historical).
 *   • DRAWN_MISS    – ball has been drawn and eliminated the team's direct
 *                     combos. `oddsChange` is 0 (historical).
 *   • REMAINING_ALIVE – ball is still in the machine; drawing it yields a
 *                       nonzero win probability for the team.
 *   • REMAINING_DEAD  – ball is still in the machine; drawing it would
 *                       zero out the team's win probability (including any
 *                       redraw paths).
 *
 * Remaining balls are sorted by oddsChange descending (most-helpful first).
 */
export function getFullBallImpacts(
  allCombos: LotteryCombo[],
  drawnBalls: number[],
  targetTeam: string,
  draw1WinnerCode?: string
): DetailedBallImpact[] {
  const impacts: DetailedBallImpact[] = [];

  // If the selected team already won Draw 1, every ball is a no-op:
  // their probability is 0 everywhere and there is no impact to compute.
  if (targetTeam === draw1WinnerCode) {
    drawnBalls.forEach((b, index) => {
      impacts.push({
        ball: b,
        status: 'DRAWN_MISS',
        displayProbability: 0,
        oddsChange: 0,
        combos: 0,
        drawOrder: index,
      });
    });
    for (let b = 1; b <= 14; b++) {
      if (drawnBalls.includes(b)) continue;
      impacts.push({
        ball: b,
        status: 'REMAINING_DEAD',
        displayProbability: 0,
        oddsChange: 0,
        combos: 0,
        drawOrder: 99,
      });
    }
    return impacts;
  }

  const currentProb = probabilityOfWin(
    allCombos,
    drawnBalls,
    targetTeam,
    draw1WinnerCode
  );

  // --- Drawn balls: replay in chronological order --------------------------
  let aliveTargetCombos = allCombos.filter(c => c.teamCode === targetTeam);
  drawnBalls.forEach((b, index) => {
    const survives = aliveTargetCombos.some(c => c.balls.includes(b));
    if (survives) {
      aliveTargetCombos = aliveTargetCombos.filter(c => c.balls.includes(b));
      impacts.push({
        ball: b,
        status: 'DRAWN_MATCH',
        displayProbability: 100,
        oddsChange: 0,
        combos: aliveTargetCombos.length,
        drawOrder: index,
      });
    } else {
      aliveTargetCombos = [];
      impacts.push({
        ball: b,
        status: 'DRAWN_MISS',
        displayProbability: 0,
        oddsChange: 0,
        combos: 0,
        drawOrder: index,
      });
    }
  });

  // --- Remaining balls: hypothetical next-draw probability ----------------
  const targetCombosAll = allCombos.filter(c => c.teamCode === targetTeam);
  for (let b = 1; b <= 14; b++) {
    if (drawnBalls.includes(b)) continue;

    const hypotheticalDraw = [...drawnBalls, b];
    const newProb = probabilityOfWin(
      allCombos,
      hypotheticalDraw,
      targetTeam,
      draw1WinnerCode
    );
    const combos = targetCombosAll.filter(c => containsAll(c, hypotheticalDraw)).length;

    impacts.push({
      ball: b,
      status: newProb > 0 ? 'REMAINING_ALIVE' : 'REMAINING_DEAD',
      displayProbability: newProb * 100,
      oddsChange: (newProb - currentProb) * 100,
      combos,
      drawOrder: 99,
    });
  }

  // Drawn balls in chronological order; remaining sorted by biggest gain first.
  impacts.sort((a, b) => {
    if (a.drawOrder !== b.drawOrder) return a.drawOrder - b.drawOrder;
    return b.oddsChange - a.oddsChange;
  });

  return impacts;
}
