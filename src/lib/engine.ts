// src/lib/engine.ts
import { SeededTeam, LotteryCombo, SimulationResult } from '../data/types';

/**
 * Randomly draws 4 ping-pong balls out of 14.
 */
export function drawFourBalls(): number[] {
  const machine = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const drawn: number[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * machine.length);
    drawn.push(machine.splice(idx, 1)[0]);
  }
  return drawn.sort((a, b) => a - b);
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
    finalOrder
  };
}

/**
 * Applies the NHL 10-spot maximum move-up rule and calculates the final 1-16 order.
 */
function resolveDraftOrder(
  originalTeams: SeededTeam[],
  d1Winner: SeededTeam,
  d2Winner: SeededTeam,
  maxMove: number
): SeededTeam[] {
  const d1OriginalIndex = originalTeams.findIndex(t => t.team.abbreviation === d1Winner.team.abbreviation);
  const d2OriginalIndex = originalTeams.findIndex(t => t.team.abbreviation === d2Winner.team.abbreviation);

  const d1TargetIndex = Math.max(0, d1OriginalIndex - maxMove);
  let d2TargetIndex = Math.max(0, d2OriginalIndex - maxMove);

  if (d2TargetIndex === d1TargetIndex) {
    d2TargetIndex += 1;
  }

  const remainingTeams = originalTeams.filter(t => 
    t.team.abbreviation !== d1Winner.team.abbreviation && 
    t.team.abbreviation !== d2Winner.team.abbreviation
  );

  const finalBoard: SeededTeam[] = new Array(originalTeams.length);
  
  finalBoard[d1TargetIndex] = d1Winner;
  finalBoard[d2TargetIndex] = d2Winner;

  let remainingIndex = 0;
  for (let i = 0; i < finalBoard.length; i++) {
    if (!finalBoard[i]) {
      finalBoard[i] = remainingTeams[remainingIndex];
      remainingIndex++;
    }
  }

  return finalBoard;
}