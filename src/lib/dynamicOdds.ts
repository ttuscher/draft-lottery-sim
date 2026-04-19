// src/lib/dynamicOdds.ts
//
// Computes exact pick-slot odds using dynamically allocated combos.
// Same math as lotteryOdds.ts but accepts combos and teams as parameters
// instead of reading from the static JSON.

import { SeededTeam, LotteryCombo } from '../data/types';
import { MAX_MOVE_UP, resolveDraftOrder, getLockedFirstPickTeam } from './engine';
import { probabilityOfWin } from './analytics';

export type DrawPhase = 'DRAW_1' | 'DRAW_2' | 'COMPLETE';

/**
 * Formats the phase/ball state as a short informational label for panel headers.
 *   BEFORE DRAW 1            (phase=DRAW_1, no balls drawn yet)
 *   DRAW 1, AFTER BALL 2     (phase=DRAW_1, 2 balls drawn so far)
 *   BEFORE DRAW 2            (phase=DRAW_2, no balls drawn yet)
 *   DRAW 2, AFTER BALL 1     (phase=DRAW_2, 1 ball drawn so far)
 *   FINAL                    (phase=COMPLETE)
 */
export function phaseLabel(phase: DrawPhase, ballsDrawn: number): string {
  if (phase === 'COMPLETE') return 'FINAL';
  const drawNum = phase === 'DRAW_1' ? 1 : 2;
  if (ballsDrawn <= 0) return `BEFORE DRAW ${drawNum}`;
  return `DRAW ${drawNum}, AFTER BALL ${ballsDrawn}`;
}

/**
 * Computes the exact probability each team lands in each pick slot (1-N).
 * Returns a map: pickSlot -> { teamCode -> probability% }.
 */
export function computeDynamicPickSlotOdds(
  teams: SeededTeam[],
  allCombos: LotteryCombo[]
): Record<number, Record<string, number>> {
  const teamCodes = teams.map(t => t.team.abbreviation);

  // Count combos per team (excluding REDRAW)
  const comboCountByTeam: Record<string, number> = {};
  for (const code of teamCodes) comboCountByTeam[code] = 0;
  for (const e of allCombos) {
    if (e.teamCode !== 'REDRAW' && comboCountByTeam[e.teamCode] !== undefined) {
      comboCountByTeam[e.teamCode]++;
    }
  }

  // Total valid (non-REDRAW) combos
  const totalValid = allCombos.filter(e => e.teamCode !== 'REDRAW').length;

  // Initialize result
  const result: Record<number, Record<string, number>> = {};
  for (let pick = 1; pick <= teamCodes.length; pick++) {
    result[pick] = {};
    for (const code of teamCodes) result[pick][code] = 0;
  }

  // Enumerate all (D1, D2) pairs.
  //
  // When D1 is capped by the 10-spot rule, the team locked at pick #1 is also
  // excluded from Draw 2 (their combos trigger a redraw). We mirror runSimulation:
  // skip D2 = lockedFirst AND subtract lockedFirst's combos from the D2 denominator.
  for (const d1Code of teamCodes) {
    const d1Winner = teams.find(t => t.team.abbreviation === d1Code)!;
    const pDraw1 = comboCountByTeam[d1Code] / totalValid;

    const lockedFirst = getLockedFirstPickTeam(teams, d1Code, MAX_MOVE_UP);
    const lockedFirstCombos = lockedFirst ? (comboCountByTeam[lockedFirst] ?? 0) : 0;
    const totalValidDraw2 =
      totalValid - comboCountByTeam[d1Code] - lockedFirstCombos;

    if (totalValidDraw2 <= 0) continue;

    for (const d2Code of teamCodes) {
      if (d2Code === d1Code) continue;
      if (d2Code === lockedFirst) continue;

      const d2Winner = teams.find(t => t.team.abbreviation === d2Code)!;
      const pDraw2GivenDraw1 = comboCountByTeam[d2Code] / totalValidDraw2;
      const jointProb = pDraw1 * pDraw2GivenDraw1;

      const finalOrder = resolveDraftOrder(teams, d1Winner, d2Winner, MAX_MOVE_UP);

      finalOrder.forEach((team, idx) => {
        const pick = idx + 1;
        result[pick][team.team.abbreviation] += jointProb * 100;
      });
    }
  }

  return result;
}

/**
 * Returns Draw 1 win probability for each team (combos/totalValid * 100).
 */
export function computeDraw1Odds(
  teams: SeededTeam[],
  allCombos: LotteryCombo[]
): Record<string, number> {
  const totalValid = allCombos.filter(e => e.teamCode !== 'REDRAW').length;
  const result: Record<string, number> = {};

  for (const t of teams) {
    const count = allCombos.filter(
      e => e.teamCode === t.team.abbreviation
    ).length;
    result[t.team.abbreviation] = (count / totalValid) * 100;
  }

  return result;
}

/**
 * Computes conditional Draw 2 win probability for each team,
 * given a known Draw 1 winner. Teams excluded from Draw 2
 * (D1 winner + locked-first-pick team) get 0%.
 */
export function computeConditionalDraw2Odds(
  teams: SeededTeam[],
  allCombos: LotteryCombo[],
  draw1WinnerCode: string
): Record<string, number> {
  const comboCountByTeam: Record<string, number> = {};
  for (const t of teams) comboCountByTeam[t.team.abbreviation] = 0;
  for (const e of allCombos) {
    if (e.teamCode !== 'REDRAW' && comboCountByTeam[e.teamCode] !== undefined) {
      comboCountByTeam[e.teamCode]++;
    }
  }

  const totalValid = allCombos.filter(e => e.teamCode !== 'REDRAW').length;

  const lockedFirst = getLockedFirstPickTeam(teams, draw1WinnerCode, MAX_MOVE_UP);
  const excluded = new Set<string>([draw1WinnerCode]);
  if (lockedFirst) excluded.add(lockedFirst);

  // Locked-first-pick team's combos also trigger a redraw of Draw 2,
  // so they must be removed from the denominator alongside D1 winner's combos.
  const lockedFirstCombos = lockedFirst ? (comboCountByTeam[lockedFirst] ?? 0) : 0;
  const totalValidDraw2 =
    totalValid - comboCountByTeam[draw1WinnerCode] - lockedFirstCombos;

  const result: Record<string, number> = {};
  for (const t of teams) {
    const code = t.team.abbreviation;
    if (excluded.has(code) || totalValidDraw2 <= 0) {
      result[code] = 0;
    } else {
      result[code] = (comboCountByTeam[code] / totalValidDraw2) * 100;
    }
  }
  return result;
}

/**
 * Computes conditional probability of each team landing at pick #2,
 * given a known Draw 1 winner. Enumerates all possible Draw 2 outcomes.
 */
export function computeConditionalPick2Odds(
  teams: SeededTeam[],
  allCombos: LotteryCombo[],
  draw1WinnerCode: string
): Record<string, number> {
  const comboCountByTeam: Record<string, number> = {};
  for (const t of teams) comboCountByTeam[t.team.abbreviation] = 0;
  for (const e of allCombos) {
    if (e.teamCode !== 'REDRAW' && comboCountByTeam[e.teamCode] !== undefined) {
      comboCountByTeam[e.teamCode]++;
    }
  }

  const totalValid = allCombos.filter(e => e.teamCode !== 'REDRAW').length;

  const lockedFirst = getLockedFirstPickTeam(teams, draw1WinnerCode, MAX_MOVE_UP);
  const excluded = new Set<string>([draw1WinnerCode]);
  if (lockedFirst) excluded.add(lockedFirst);

  // Locked-first-pick team's combos also trigger a redraw of Draw 2,
  // so they must be removed from the denominator alongside D1 winner's combos.
  const lockedFirstCombos = lockedFirst ? (comboCountByTeam[lockedFirst] ?? 0) : 0;
  const totalValidDraw2 =
    totalValid - comboCountByTeam[draw1WinnerCode] - lockedFirstCombos;

  const d1Winner = teams.find(t => t.team.abbreviation === draw1WinnerCode)!;

  const result: Record<string, number> = {};
  for (const t of teams) result[t.team.abbreviation] = 0;

  if (totalValidDraw2 <= 0) return result;

  for (const t of teams) {
    const d2Code = t.team.abbreviation;
    if (excluded.has(d2Code)) continue;

    const d2Winner = teams.find(tm => tm.team.abbreviation === d2Code)!;
    const pD2 = comboCountByTeam[d2Code] / totalValidDraw2;

    const finalOrder = resolveDraftOrder(teams, d1Winner, d2Winner, MAX_MOVE_UP);
    if (finalOrder[1]) {
      result[finalOrder[1].team.abbreviation] += pD2 * 100;
    }
  }

  return result;
}

/**
 * Computes live pick-slot odds that update as balls are drawn.
 *
 * Unified function handling all four phases of the draw:
 *   - DRAW_1 with partial balls drawn (uses probabilityOfWin for D1 candidates,
 *     base conditional for D2).
 *   - DRAW_1 with no balls drawn = pre-sim (equivalent to computeDynamicPickSlotOdds).
 *   - DRAW_2 with d1 winner known (enumerates D2 candidates weighted by
 *     probabilityOfWin given D1 + locked-first exclusion).
 *   - COMPLETE (d1 and d2 winners known; returns 100/0 cells).
 *
 * Returns a map: pickSlot -> { teamCode -> probability% }.
 * Sum across any pick column equals 100 (modulo float precision).
 */
export function computeLivePickSlotOdds(
  teams: SeededTeam[],
  allCombos: LotteryCombo[],
  phase: DrawPhase,
  drawnBalls: number[],
  draw1Winner?: SeededTeam | null,
  draw2Winner?: SeededTeam | null
): Record<number, Record<string, number>> {
  const teamCodes = teams.map(t => t.team.abbreviation);

  // Initialize result
  const result: Record<number, Record<string, number>> = {};
  for (let pick = 1; pick <= teamCodes.length; pick++) {
    result[pick] = {};
    for (const code of teamCodes) result[pick][code] = 0;
  }

  // COMPLETE: fixed order
  if (phase === 'COMPLETE' && draw1Winner && draw2Winner) {
    const finalOrder = resolveDraftOrder(teams, draw1Winner, draw2Winner, MAX_MOVE_UP);
    finalOrder.forEach((team, idx) => {
      result[idx + 1][team.team.abbreviation] = 100;
    });
    return result;
  }

  // Count combos per team (excluding REDRAW)
  const comboCountByTeam: Record<string, number> = {};
  for (const code of teamCodes) comboCountByTeam[code] = 0;
  for (const e of allCombos) {
    if (e.teamCode !== 'REDRAW' && comboCountByTeam[e.teamCode] !== undefined) {
      comboCountByTeam[e.teamCode]++;
    }
  }
  const totalValid = allCombos.filter(e => e.teamCode !== 'REDRAW').length;

  // Candidate D1 winners: the fixed D1 winner in DRAW_2 phase, else any team
  const d1Candidates: SeededTeam[] =
    phase === 'DRAW_2' && draw1Winner ? [draw1Winner] : teams;

  for (const d1 of d1Candidates) {
    const d1Code = d1.team.abbreviation;

    // P(D1 = d1Code)
    let pD1: number;
    if (phase === 'DRAW_2') {
      pD1 = 1;
    } else {
      // DRAW_1 phase (pre-sim or mid-balls)
      pD1 = probabilityOfWin(allCombos, drawnBalls, d1Code);
    }
    if (pD1 === 0) continue;

    const lockedFirst = getLockedFirstPickTeam(teams, d1Code, MAX_MOVE_UP);
    const lockedFirstCombos = lockedFirst ? (comboCountByTeam[lockedFirst] ?? 0) : 0;
    const totalValidDraw2 = totalValid - comboCountByTeam[d1Code] - lockedFirstCombos;
    if (totalValidDraw2 <= 0) continue;

    for (const d2 of teams) {
      const d2Code = d2.team.abbreviation;
      if (d2Code === d1Code) continue;
      if (d2Code === lockedFirst) continue;

      // P(D2 = d2Code | D1 = d1Code)
      let pD2GivenD1: number;
      if (phase === 'DRAW_2') {
        const additionalExcluded = lockedFirst ? [lockedFirst] : undefined;
        pD2GivenD1 = probabilityOfWin(
          allCombos,
          drawnBalls,
          d2Code,
          d1Code,
          additionalExcluded
        );
      } else {
        // DRAW_1 phase: D2 hasn't started, use base conditional probability
        pD2GivenD1 = comboCountByTeam[d2Code] / totalValidDraw2;
      }
      if (pD2GivenD1 === 0) continue;

      const jointProb = pD1 * pD2GivenD1;
      const finalOrder = resolveDraftOrder(teams, d1, d2, MAX_MOVE_UP);

      finalOrder.forEach((team, idx) => {
        const pick = idx + 1;
        result[pick][team.team.abbreviation] += jointProb * 100;
      });
    }
  }

  return result;
}
