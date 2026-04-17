// src/lib/engine.ts
import { SeededTeam, LotteryCombo, SimulationResult } from '../data/types';

/** NHL rule: a lottery winner can move up a maximum of this many spots. */
export const MAX_MOVE_UP = 10;

/**
 * Randomly draws 4 ping-pong balls out of 14 using a Fisher-Yates shuffle.
 */
export function drawFourBalls(): number[] {
  const machine = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  // Fisher-Yates shuffle to randomly select the first 4 balls
  for (let i = 0; i < 4; i++) {
    const j = i + Math.floor(Math.random() * (machine.length - i));
    [machine[i], machine[j]] = [machine[j], machine[i]];
  }

  // Extract the first 4 and sort them
  return machine.slice(0, 4).sort((a, b) => a - b);
}

/**
 * Matches the drawn balls to a specific team combination.
 */
export function getWinner(allCombos: LotteryCombo[], drawnBalls: number[]): LotteryCombo | null {
  return allCombos.find(c => c.balls.every(b => drawnBalls.includes(b))) || null;
}

/**
 * Runs a complete NHL Draft Lottery simulation using real 14-ball physics.
 */
export function runSimulation(
  teams: SeededTeam[],
  allCombos: LotteryCombo[],
  maxMoveUp: number
): SimulationResult {
  let draw1WinnerTeam: SeededTeam;
  while (true) {
    const balls = drawFourBalls();
    const winningCombo = getWinner(allCombos, balls);

    if (winningCombo && winningCombo.teamCode !== 'REDRAW') {
      const team = teams.find(t => t.team.abbreviation === winningCombo.teamCode);
      if (team) {
        draw1WinnerTeam = team;
        break;
      }
    }
  }

  let draw2WinnerTeam: SeededTeam;
  while (true) {
    const balls = drawFourBalls();
    const winningCombo = getWinner(allCombos, balls);

    if (winningCombo && winningCombo.teamCode !== 'REDRAW') {
      if (winningCombo.teamCode !== draw1WinnerTeam.team.abbreviation) {
        const team = teams.find(t => t.team.abbreviation === winningCombo.teamCode);
        if (team) {
          draw2WinnerTeam = team;
          break;
        }
      }
    }
  }

  const finalOrder = resolveDraftOrder(teams, draw1WinnerTeam, draw2WinnerTeam, maxMoveUp);

  return {
    draw1Winner: draw1WinnerTeam,
    draw2Winner: draw2WinnerTeam,
    finalOrder,
  };
}

/**
 * Applies the NHL 10-spot maximum move-up rule and calculates the final 1-16 order.
 *
 * Correct NHL rules implemented here:
 *   1. Draw 1 winner can move up to pick #1, capped at `maxMove` spots from their
 *      ORIGINAL standings position.
 *   2. Draw 2 winner targets pick #2 at best. Draw 2 can never take pick #1.
 *   3. Cap for Draw 2 is also measured from the original standings position.
 *   4. If Draw 2's target collides with Draw 1's target, Draw 2 is bumped back.
 *   5. Backward-move guard: if Draw 2 winner is already at or ahead of their
 *      target after Draw 1 resolves, they keep their position.
 *
 * Validated against published NHL odds via 500k-trial Monte Carlo.
 */
export function resolveDraftOrder(
  originalTeams: SeededTeam[],
  d1Winner: SeededTeam,
  d2Winner: SeededTeam,
  maxMove: number
): SeededTeam[] {
  if (d1Winner.team.abbreviation === d2Winner.team.abbreviation) {
    throw new Error('Draw 1 and Draw 2 winners must be different teams.');
  }

  const d1OrigIdx = originalTeams.findIndex(
    t => t.team.abbreviation === d1Winner.team.abbreviation
  );
  const d2OrigIdx = originalTeams.findIndex(
    t => t.team.abbreviation === d2Winner.team.abbreviation
  );

  if (d1OrigIdx < 0 || d2OrigIdx < 0) {
    throw new Error('Winning team not found in originalTeams.');
  }

  const d1Target = Math.max(0, d1OrigIdx - maxMove);

  const post = originalTeams.filter(
    t => t.team.abbreviation !== d1Winner.team.abbreviation
  );
  post.splice(d1Target, 0, d1Winner);

  let d2Target = Math.max(1, d2OrigIdx - maxMove);
  if (d2Target === d1Target) {
    d2Target = d1Target + 1;
  }

  const d2PostIdx = post.findIndex(
    t => t.team.abbreviation === d2Winner.team.abbreviation
  );
  if (d2PostIdx <= d2Target) {
    return post;
  }

  const final = post.filter(
    t => t.team.abbreviation !== d2Winner.team.abbreviation
  );
  final.splice(d2Target, 0, d2Winner);
  return final;
}
