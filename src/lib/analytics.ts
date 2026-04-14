// src/lib/analytics.ts
import { LotteryCombo } from '../data/types';

export interface LiveOdds {
  teamCode: string;
  remainingCombos: number;
  winProbability: number;
}

export type BallStatus = 'DRAWN_MATCH' | 'DRAWN_MISS' | 'REMAINING_ALIVE' | 'REMAINING_DEAD';

export interface DetailedBallImpact {
  ball: number;
  status: BallStatus;
  probability: number;
  combos: number;
  drawOrder: number;
}

/**
 * Calculates real-time odds for each team based on the ping-pong balls drawn so far.
 */
export function calculateLiveOdds(
  allCombos: LotteryCombo[], 
  drawnBalls: number[], 
  activeTeams: string[]
): LiveOdds[] {
  const possibleCombos = allCombos.filter(combo => {
    if (combo.teamCode === 'REDRAW') return false; 
    return drawnBalls.every(ball => combo.balls.includes(ball));
  });

  const totalPossible = possibleCombos.length;
  const comboCounts: Record<string, number> = {};
  activeTeams.forEach(t => comboCounts[t] = 0);

  possibleCombos.forEach(combo => {
    if (comboCounts[combo.teamCode] !== undefined) {
      comboCounts[combo.teamCode]++;
    }
  });

  return activeTeams.map(teamCode => {
    const remaining = comboCounts[teamCode] || 0;
    return {
      teamCode,
      remainingCombos: remaining,
      winProbability: totalPossible > 0 ? (remaining / totalPossible) * 100 : 0
    };
  }).sort((a, b) => b.winProbability - a.winProbability);
}

/**
 * Calculates the status and impact of all 14 balls on a specific team's odds.
 */
export function getFullBallImpacts(
  allCombos: LotteryCombo[],
  drawnBalls: number[],
  targetTeam: string
): DetailedBallImpact[] {
  let teamCombos = allCombos.filter(c => c.teamCode === targetTeam && c.teamCode !== 'REDRAW');
  const impacts: DetailedBallImpact[] = [];

  // 1. Evaluate balls that have already been drawn (Chronologically)
  drawnBalls.forEach((b, index) => {
    const survives = teamCombos.some(c => c.balls.includes(b));
    if (survives) {
      teamCombos = teamCombos.filter(c => c.balls.includes(b));
      impacts.push({ ball: b, status: 'DRAWN_MATCH', probability: 100, combos: teamCombos.length, drawOrder: index });
    } else {
      teamCombos = []; 
      impacts.push({ ball: b, status: 'DRAWN_MISS', probability: 0, combos: 0, drawOrder: index });
    }
  });

  // 2. Evaluate remaining balls in the machine
  for (let b = 1; b <= 14; b++) {
    if (drawnBalls.includes(b)) continue;

    if (teamCombos.length === 0) {
      impacts.push({ ball: b, status: 'REMAINING_DEAD', probability: 0, combos: 0, drawOrder: 99 });
    } else {
      const simDraw = [...drawnBalls, b];
      const possible = allCombos.filter(c => c.teamCode !== 'REDRAW' && simDraw.every(x => c.balls.includes(x)));
      const teamWins = possible.filter(c => c.teamCode === targetTeam).length;
      const prob = possible.length > 0 ? (teamWins / possible.length) * 100 : 0;

      impacts.push({
        ball: b,
        status: teamWins > 0 ? 'REMAINING_ALIVE' : 'REMAINING_DEAD',
        probability: prob,
        combos: teamWins,
        drawOrder: 99
      });
    }
  }

  // 3. Sort: Drawn balls at the top, then remaining balls highest odds to lowest
  impacts.sort((a, b) => {
    if (a.drawOrder !== b.drawOrder) return a.drawOrder - b.drawOrder;
    if (b.probability !== a.probability) return b.probability - a.probability;
    return b.combos - a.combos; // Secondary sort by raw combos
  });

  return impacts;
}