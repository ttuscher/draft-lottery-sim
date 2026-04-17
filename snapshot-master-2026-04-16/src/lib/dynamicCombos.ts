// src/lib/dynamicCombos.ts
//
// Dynamically allocates lottery combinations based on current NHL standings.
// Takes the fixed combo distribution from 2025 and remaps team codes
// so that the current worst team gets seed 1's combos, etc.

import lotteryData from '../data/lottery-2025.json';
import { NHL_TEAMS } from '../data/teams';
import { SeededTeam, LotteryCombo } from '../data/types';
import type { NHLTeamStanding } from '../hooks/useNHLStandings';

/** Fixed combo allocation per seed position (from 2025 NHL rules). */
const COMBOS_PER_SEED: number[] = [
  185, 135, 115, 95, 85, 75, 65, 60, 50, 35, 30, 25, 20, 15, 5, 5
];

/** The original team order from the static 2025 data. */
const ORIGINAL_TEAM_ORDER: string[] = lotteryData.teamOrder;

/** All 1001 original combos. */
const ORIGINAL_ENTRIES = lotteryData.entries as LotteryCombo[];

/**
 * Given pre-sorted lottery and playoff teams, returns:
 * - lotteryTeams: SeededTeam[] with dynamic seed assignments and combos
 * - playoffTeams: SeededTeam[] (no combos)
 * - remappedCombos: all 1001 combos with teamCodes swapped to current standings
 * - standingsMap: quick lookup by abbreviation
 */
export function buildDynamicLotteryData(
  lotteryStandings: NHLTeamStanding[],
  playoffStandings: NHLTeamStanding[]
): {
  lotteryTeams: SeededTeam[];
  playoffTeams: SeededTeam[];
  remappedCombos: LotteryCombo[];
  standingsMap: Record<string, NHLTeamStanding>;
} {
  // Build seed-to-new-team mapping
  // seed 1 (worst) -> lotteryStandings[0], seed 2 -> [1], etc.
  const seedToNewTeam: Record<string, string> = {};
  for (let i = 0; i < Math.min(16, lotteryStandings.length); i++) {
    const originalTeamCode = ORIGINAL_TEAM_ORDER[i];
    const newTeamCode = lotteryStandings[i]?.teamAbbrev || originalTeamCode;
    seedToNewTeam[originalTeamCode] = newTeamCode;
  }

  // Remap combos: swap original teamCode for new teamCode
  const remappedCombos: LotteryCombo[] = ORIGINAL_ENTRIES.map(entry => {
    if (entry.teamCode === 'REDRAW') return entry;
    const newCode = seedToNewTeam[entry.teamCode] || entry.teamCode;
    return { ...entry, teamCode: newCode };
  });

  // Build SeededTeam arrays for lottery teams
  const lotteryTeams: SeededTeam[] = lotteryStandings.slice(0, 16).map((standing, idx) => {
    const abbrev = standing.teamAbbrev;
    const teamInfo = NHL_TEAMS[abbrev];
    return {
      seed: idx + 1,
      team: teamInfo || {
        abbreviation: abbrev,
        city: standing.teamName,
        name: '',
        logoLight: '',
        logoDark: '',
      },
      combinations: COMBOS_PER_SEED[idx] || 0,
    };
  });

  // Build SeededTeam arrays for playoff teams
  const playoffTeams: SeededTeam[] = playoffStandings.map((standing, idx) => {
    const abbrev = standing.teamAbbrev;
    const teamInfo = NHL_TEAMS[abbrev];
    return {
      seed: 17 + idx,
      team: teamInfo || {
        abbreviation: abbrev,
        city: standing.teamName,
        name: '',
        logoLight: '',
        logoDark: '',
      },
      combinations: 0,
    };
  });

  // Quick lookup map
  const standingsMap: Record<string, NHLTeamStanding> = {};
  for (const s of [...lotteryStandings, ...playoffStandings]) {
    standingsMap[s.teamAbbrev] = s;
  }

  return { lotteryTeams, playoffTeams, remappedCombos, standingsMap };
}
