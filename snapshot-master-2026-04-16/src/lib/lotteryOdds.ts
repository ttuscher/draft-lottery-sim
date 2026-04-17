// src/lib/lotteryOdds.ts
//
// Computes exact pick-slot odds by exhaustive enumeration of all
// (Draw1Winner, Draw2Winner) pairs, weighted by their joint probability
// under the 14-ball combinatorial system.
//
// The REDRAW combo (11-12-13-14) triggers a fresh draw, so it never
// produces a winner. For Draw 2, the Draw 1 winner's combos also
// trigger a redraw. Both effects are handled correctly below.

import lotteryData from '../data/lottery-2025.json';
import { NHL_TEAMS } from '../data/teams';
import { SeededTeam } from '../data/types';
import { MAX_MOVE_UP, resolveDraftOrder } from './engine';

function buildSeededTeams(): SeededTeam[] {
  return lotteryData.teamOrder.map((teamCode: string, index: number) => ({
    seed: index + 1,
    team:
      NHL_TEAMS[teamCode] || {
        abbreviation: teamCode,
        city: teamCode,
        name: 'UNKNOWN',
        logoLight: '',
        logoDark: '',
      },
    combinations: 0,
  }));
}

/**
 * Computes the exact probability each team lands in each pick slot (1-16).
 * Returns a map: pickSlot -> { teamCode -> probability% }.
 *
 * Used primarily for the landing page "2ND OVR" column but can power
 * any pick-slot probability display.
 */
export function computePickSlotOdds(): Record<number, Record<string, number>> {
  const originalTeams = buildSeededTeams();
  const teamCodes: string[] = lotteryData.teamOrder;
  const entries = lotteryData.entries as { teamCode: string; balls: number[] }[];

  // Count combos per team (excluding REDRAW)
  const comboCountByTeam: Record<string, number> = {};
  for (const code of teamCodes) comboCountByTeam[code] = 0;
  for (const e of entries) {
    if (e.teamCode !== 'REDRAW' && comboCountByTeam[e.teamCode] !== undefined) {
      comboCountByTeam[e.teamCode]++;
    }
  }

  // Total valid (non-REDRAW) combos for Draw 1
  const totalValid = entries.filter(e => e.teamCode !== 'REDRAW').length;

  // Initialize result: pick 1-16 -> team -> 0
  const result: Record<number, Record<string, number>> = {};
  for (let pick = 1; pick <= teamCodes.length; pick++) {
    result[pick] = {};
    for (const code of teamCodes) result[pick][code] = 0;
  }

  // Enumerate all (D1, D2) pairs
  for (const d1Code of teamCodes) {
    const d1Winner = originalTeams.find(t => t.team.abbreviation === d1Code)!;
    const pDraw1 = comboCountByTeam[d1Code] / totalValid;

    // For Draw 2: D1 winner's combos trigger redraw, so effective denominator
    // is totalValid minus D1 winner's combos
    const totalValidDraw2 = totalValid - comboCountByTeam[d1Code];

    for (const d2Code of teamCodes) {
      if (d2Code === d1Code) continue;

      const d2Winner = originalTeams.find(t => t.team.abbreviation === d2Code)!;
      const pDraw2GivenDraw1 = comboCountByTeam[d2Code] / totalValidDraw2;
      const jointProb = pDraw1 * pDraw2GivenDraw1;

      const finalOrder = resolveDraftOrder(
        originalTeams,
        d1Winner,
        d2Winner,
        MAX_MOVE_UP
      );

      // Accumulate probability for each team in their final pick slot
      finalOrder.forEach((team, idx) => {
        const pick = idx + 1;
        result[pick][team.team.abbreviation] += jointProb * 100;
      });
    }
  }

  return result;
}

/**
 * Convenience: returns just the 2nd-overall odds as a flat map.
 * { teamCode: probability% }
 */
export function computeSecondOverallOdds(): Record<string, number> {
  const allSlots = computePickSlotOdds();
  return allSlots[2] || {};
}
