// src/lib/engine.ts
import { SeededTeam, LotteryCombo, SimulationResult } from '../data/types';

/** NHL rule: a lottery winner can move up a maximum of this many spots. */
export const MAX_MOVE_UP = 10;

/**
 * When the Draw 1 winner can't reach pick #1 (due to the 10-spot cap),
 * the team that gets locked into #1 by default is also ineligible for Draw 2.
 * Returns that team's abbreviation, or undefined if the D1 winner took #1.
 */
export function getLockedFirstPickTeam(
  originalTeams: SeededTeam[],
  d1WinnerCode: string,
  maxMove: number = MAX_MOVE_UP
): string | undefined {
  const d1OrigIdx = originalTeams.findIndex(
    t => t.team.abbreviation === d1WinnerCode
  );
  if (d1OrigIdx < 0) return undefined;

  const d1Target = Math.max(0, d1OrigIdx - maxMove);
  if (d1Target === 0) return undefined; // D1 winner took #1, no one else locked

  // The team that ends up at index 0 after removing D1 winner and reinserting at d1Target
  const post = originalTeams.filter(
    t => t.team.abbreviation !== d1WinnerCode
  );
  // post[0] is the team that was seed 1 (or seed 2 if D1 winner was seed 1, but
  // if D1 winner was seed 1 they'd always reach #1, so post[0] is always the worst-record team)
  return post[0]?.team.abbreviation;
}

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

  // If D1 winner can't reach #1, the team locked at #1 is also ineligible for Draw 2
  const lockedFirstPick = getLockedFirstPickTeam(teams, draw1WinnerTeam.team.abbreviation, maxMoveUp);
  const draw2Excluded = new Set<string>([draw1WinnerTeam.team.abbreviation]);
  if (lockedFirstPick) draw2Excluded.add(lockedFirstPick);

  let draw2WinnerTeam: SeededTeam;
  while (true) {
    const balls = drawFourBalls();
    const winningCombo = getWinner(allCombos, balls);

    if (winningCombo && winningCombo.teamCode !== 'REDRAW') {
      if (!draw2Excluded.has(winningCombo.teamCode)) {
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
 * Correct NHL algorithm (Tankathon-verified cascade):
 *   1. **Draw 1 cascade.** D1 winner splices out of their original seed and
 *      inserts at `d1Target = max(0, d1Seed - maxMove)`. Teams between target
 *      and original position shift down by 1. Pick #1 is now fixed.
 *   2. **Locked pick #1.** If D1 was capped (d1Target > 0), the team now at
 *      pick #1 is "locked" there. In the main draw flow (`runSimulation`) that
 *      team is also excluded from Draw 2; `resolveDraftOrder` itself does not
 *      enforce eligibility (callers do), but it will never move a locked team.
 *   3. **Draw 2 cascade.** D2's 10-spot cap is measured from their *post-D1*
 *      position, not their original seed. Target is floored at pick #2:
 *      `d2Target = max(1, d2PostD1Idx - maxMove)`.
 *   4. **Next-available bump.** If D2's target equals D1's locked slot
 *      (d1Target), D2 moves to `d1Target + 1` instead.
 *   5. **Cascade insertion.** D2 is operated on a 15-team view with D1 removed,
 *      so D1's locked slot is skipped. Teams between D2's post-D1 position and
 *      target shift down by 1 in that 15-team view.
 *   6. **Backward-move guard.** If D2 is already at or ahead of their target
 *      in the 15-team view (only possible with illegal inputs like D2 == the
 *      locked-seed-1 team), D2 stays put rather than moving backward.
 *   7. D1 is reinserted at `d1Target` to produce the final 16-team order.
 *
 * Validated against Tankathon's published 2026 chart via 500k-trial Monte Carlo.
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

  const d1Code = d1Winner.team.abbreviation;

  // ---- Step 1: D1 cascade ------------------------------------------------
  // Splice D1 out of their original seed and insert at d1Target.
  const d1Target = Math.max(0, d1OrigIdx - maxMove);
  const postD1: SeededTeam[] = [...originalTeams];
  postD1.splice(d1OrigIdx, 1);
  postD1.splice(d1Target, 0, d1Winner);

  // ---- Step 2: Compute D2's target in the post-D1 full-array frame -------
  const d2PostD1IdxFull = postD1.findIndex(
    t => t.team.abbreviation === d2Winner.team.abbreviation
  );

  // D2 cap: 10 spots from post-D1 position, with pick #2 floor.
  let d2TargetFull = Math.max(1, d2PostD1IdxFull - maxMove);

  // Next-available bump: if target collides with D1's locked slot, step past it.
  if (d2TargetFull === d1Target) {
    d2TargetFull = d1Target + 1;
  }

  // ---- Step 3: D2 cascade on the 15-team "without-D1" view --------------
  // Skipping over D1's locked slot is naturally handled by operating on the
  // array with D1 removed.
  const withoutD1: SeededTeam[] = postD1.filter(
    t => t.team.abbreviation !== d1Code
  );

  // Translate full-array indices to the withoutD1-array indices.
  // (withoutD1 idx = full idx if the item was before D1, else full idx - 1)
  const d2PostD1IdxNoD1 =
    d2PostD1IdxFull > d1Target ? d2PostD1IdxFull - 1 : d2PostD1IdxFull;
  const d2TargetNoD1 =
    d2TargetFull > d1Target ? d2TargetFull - 1 : d2TargetFull;

  // Backward-move guard: only cascade D2 when they're actually behind their
  // target. This is the usual case; the guard only matters for illegal inputs.
  if (d2PostD1IdxNoD1 > d2TargetNoD1) {
    withoutD1.splice(d2PostD1IdxNoD1, 1);
    withoutD1.splice(d2TargetNoD1, 0, d2Winner);
  }

  // ---- Step 4: Reinsert D1 at their locked slot --------------------------
  const result: SeededTeam[] = [...withoutD1];
  result.splice(d1Target, 0, d1Winner);

  return result;
}
