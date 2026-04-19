// src/lib/dynamicOdds.ts
//
// Computes exact pick-slot odds using dynamically allocated combos.
// Same math as lotteryOdds.ts but accepts combos and teams as parameters
// instead of reading from the static JSON.

import { SeededTeam, LotteryCombo } from '../data/types';
import { MAX_MOVE_UP, resolveDraftOrder, getLockedFirstPickTeam } from './engine';

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

  // Enumerate all (D1, D2) pairs
  for (const d1Code of teamCodes) {
    const d1Winner = teams.find(t => t.team.abbreviation === d1Code)!;
    const pDraw1 = comboCountByTeam[d1Code] / totalValid;

    const totalValidDraw2 = totalValid - comboCountByTeam[d1Code];

    for (const d2Code of teamCodes) {
      if (d2Code === d1Code) continue;

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
  const totalValidDraw2 = totalValid - comboCountByTeam[draw1WinnerCode];

  const lockedFirst = getLockedFirstPickTeam(teams, draw1WinnerCode, MAX_MOVE_UP);
  const excluded = new Set<string>([draw1WinnerCode]);
  if (lockedFirst) excluded.add(lockedFirst);

  const result: Record<string, number> = {};
  for (const t of teams) {
    const code = t.team.abbreviation;
    if (excluded.has(code)) {
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
  const totalValidDraw2 = totalValid - comboCountByTeam[draw1WinnerCode];

  const lockedFirst = getLockedFirstPickTeam(teams, draw1WinnerCode, MAX_MOVE_UP);
  const excluded = new Set<string>([draw1WinnerCode]);
  if (lockedFirst) excluded.add(lockedFirst);

  const d1Winner = teams.find(t => t.team.abbreviation === draw1WinnerCode)!;

  const result: Record<string, number> = {};
  for (const t of teams) result[t.team.abbreviation] = 0;

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
