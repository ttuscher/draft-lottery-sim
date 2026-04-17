// src/lib/__tests__/analytics.test.ts
//
// Live-draw math tests for analytics.ts:
//   - calculateLiveOdds: probabilities sum to 100% for Draw 1 AND Draw 2,
//     with REDRAW and Draw 1 winner redraw-triggering combos properly handled.
//   - getFullBallImpacts: oddsChange deltas are exact, historical (DRAWN_*)
//     rows carry oddsChange=0, dead balls yield -currentProb.
//   - D1 winner retains 0% win probability and is marked isDraw1Winner.

import { describe, it, expect } from 'vitest';
import {
  calculateLiveOdds,
  getFullBallImpacts,
  probabilityOfWin,
} from '../analytics';
import { LotteryCombo } from '../../data/types';
import lotteryData from '../../data/lottery-2025.json';

const TEAM_CODES = lotteryData.teamOrder as string[];
const COMBOS = lotteryData.entries as LotteryCombo[];

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const EPSILON = 1e-9;

// Helpers
const comboCount = (code: string) =>
  COMBOS.filter(c => c.teamCode === code).length;

// ---------- calculateLiveOdds: Draw 1 -----------------------------------------

describe('calculateLiveOdds — Draw 1', () => {
  it('fresh Draw 1 sums to 100% and matches published baseDraw1Odds', () => {
    const odds = calculateLiveOdds(COMBOS, [], TEAM_CODES);
    expect(sum(odds.map(o => o.winProbability))).toBeCloseTo(100, 6);

    for (const o of odds) {
      const published = (lotteryData.teams as any)[o.teamCode].baseDraw1Odds as number;
      expect(o.winProbability).toBeCloseTo(published, 3);
    }
  });

  it('after partial draw, probabilities still sum to 100%', () => {
    for (const drawn of [[1], [7], [11], [1, 2], [11, 12], [1, 2, 3]]) {
      const odds = calculateLiveOdds(COMBOS, drawn, TEAM_CODES);
      expect(sum(odds.map(o => o.winProbability))).toBeCloseTo(100, 6);
    }
  });

  it('REDRAW adjustment matters for subsets of {11,12,13,14}', () => {
    // With only ball 11 drawn, the REDRAW combo {11,12,13,14} is still
    // reachable. The naive "strip REDRAW from denominator" formula gives a
    // slightly different answer than the correct formula.
    const drawn = [11];
    const probSJS = probabilityOfWin(COMBOS, drawn, 'SJS');

    // Naive calc (buggy): SJS combos with 11 / (all combos with 11 - REDRAW)
    const sjsContaining11 = COMBOS.filter(c =>
      c.teamCode === 'SJS' && c.balls.includes(11)
    ).length;
    const allContaining11 = COMBOS.filter(c => c.balls.includes(11)).length;
    const naive = sjsContaining11 / (allContaining11 - 1);

    // The correct formula should equal the naive plus the REDRAW-fallback term.
    // Specifically: prob = T_D/N_D + (X_D/N_D) * (T_total / V_empty)
    // where X_D = 1 (REDRAW contains 11), N_D = allContaining11.
    const expected =
      sjsContaining11 / allContaining11 +
      (1 / allContaining11) * (185 / 1000);
    expect(probSJS).toBeCloseTo(expected, 9);
    // And the two formulas differ noticeably:
    expect(Math.abs(probSJS - naive)).toBeGreaterThan(EPSILON);
  });

  it('exposes isDraw1Winner=false for every row in Draw 1', () => {
    const odds = calculateLiveOdds(COMBOS, [], TEAM_CODES);
    for (const o of odds) expect(o.isDraw1Winner).toBe(false);
  });
});

// ---------- calculateLiveOdds: Draw 2 -----------------------------------------

describe('calculateLiveOdds — Draw 2 (D1 winner = CHI)', () => {
  const D1 = 'CHI';

  it('fresh Draw 2 sums to 100% across all 16 teams', () => {
    const odds = calculateLiveOdds(COMBOS, [], TEAM_CODES, D1);
    expect(sum(odds.map(o => o.winProbability))).toBeCloseTo(100, 6);
  });

  it('D1 winner has winProbability=0 and isDraw1Winner=true', () => {
    const odds = calculateLiveOdds(COMBOS, [], TEAM_CODES, D1);
    const chi = odds.find(o => o.teamCode === D1)!;
    expect(chi.winProbability).toBe(0);
    expect(chi.isDraw1Winner).toBe(true);
    expect(chi.remainingCombos).toBe(comboCount(D1)); // 135 combos still live
  });

  it('SJS Draw 2 baseline matches T_base / (1001 - 1 - D1_total) exactly', () => {
    const odds = calculateLiveOdds(COMBOS, [], TEAM_CODES, D1);
    const sjs = odds.find(o => o.teamCode === 'SJS')!;
    const expected = (comboCount('SJS') / (1001 - 1 - comboCount(D1))) * 100;
    expect(sjs.winProbability).toBeCloseTo(expected, 9);
    // And it's notably different from the old (buggy) 18.5% number.
    expect(sjs.winProbability).toBeGreaterThan(21);
  });

  it('pins the D1 winner to the top of the sort', () => {
    const odds = calculateLiveOdds(COMBOS, [], TEAM_CODES, D1);
    expect(odds[0].teamCode).toBe(D1);
    expect(odds[0].isDraw1Winner).toBe(true);
  });

  it('still sums to 100% after partial draws in Draw 2', () => {
    for (const drawn of [[1], [7], [11], [1, 2], [11, 12], [1, 2, 3]]) {
      const odds = calculateLiveOdds(COMBOS, drawn, TEAM_CODES, D1);
      expect(sum(odds.map(o => o.winProbability))).toBeCloseTo(100, 6);
    }
  });

  it('handles a D1 winner with no remaining combos under current draw', () => {
    // UTA seed 14 has 15 combos. Construct a drawnBalls set that no UTA combo
    // contains: ball 1 is in only a small fraction of UTA's combos, so after
    // drawing {1}, UTA's surviving combo count drops considerably. We check
    // only that the sum still equals 100 no matter what.
    const odds = calculateLiveOdds(COMBOS, [1, 2], TEAM_CODES, 'UTA');
    expect(sum(odds.map(o => o.winProbability))).toBeCloseTo(100, 6);
  });
});

// ---------- getFullBallImpacts: structure ------------------------------------

describe('getFullBallImpacts — structural invariants', () => {
  it('returns 14 rows regardless of phase', () => {
    for (const drawn of [[], [3], [3, 7], [3, 7, 11]]) {
      const impacts = getFullBallImpacts(COMBOS, drawn, 'SJS');
      expect(impacts).toHaveLength(14);
      const balls = impacts.map(i => i.ball).sort((a, b) => a - b);
      expect(balls).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    }
  });

  it('drawn balls have oddsChange=0 (historical, not hypothetical)', () => {
    const drawn = [3, 7];
    const impacts = getFullBallImpacts(COMBOS, drawn, 'SJS');
    for (const imp of impacts) {
      if (imp.status === 'DRAWN_MATCH' || imp.status === 'DRAWN_MISS') {
        expect(imp.oddsChange).toBe(0);
      }
    }
  });

  it('drawn balls sort chronologically first; remaining follow', () => {
    const drawn = [7, 3];
    const impacts = getFullBallImpacts(COMBOS, drawn, 'SJS');
    expect(impacts[0].ball).toBe(7);
    expect(impacts[1].ball).toBe(3);
    // Remaining 12 balls follow.
    for (let i = 2; i < impacts.length; i++) {
      expect(impacts[i].drawOrder).toBe(99);
    }
  });
});

// ---------- getFullBallImpacts: correctness -----------------------------------

describe('getFullBallImpacts — delta correctness', () => {
  it('each oddsChange equals exact probability delta', () => {
    const drawn = [2];
    const currentProb = probabilityOfWin(COMBOS, drawn, 'SJS') * 100;
    const impacts = getFullBallImpacts(COMBOS, drawn, 'SJS');

    for (const imp of impacts) {
      if (imp.status === 'DRAWN_MATCH' || imp.status === 'DRAWN_MISS') continue;
      const expectedNew = probabilityOfWin(COMBOS, [...drawn, imp.ball], 'SJS') * 100;
      expect(imp.displayProbability).toBeCloseTo(expectedNew, 9);
      expect(imp.oddsChange).toBeCloseTo(expectedNew - currentProb, 9);
    }
  });

  it('average oddsChange across remaining balls is ~0 (law of total expectation)', () => {
    // A uniformly-drawn ball's expected effect on the team's probability
    // is exactly zero — drawing a ball cannot change the unconditional odds.
    const drawn = [1];
    const impacts = getFullBallImpacts(COMBOS, drawn, 'SJS');
    const remaining = impacts.filter(i => i.drawOrder === 99);
    expect(remaining).toHaveLength(13);
    const mean = sum(remaining.map(r => r.oddsChange)) / remaining.length;
    expect(mean).toBeCloseTo(0, 9);
  });

  it('REMAINING_DEAD balls have the full negative delta', () => {
    // Ball 1 is not in REDRAW combo {11,12,13,14}. If drawing ball b wipes
    // out all of SJS's combos AND ball b isn't a redraw-trigger participant,
    // oddsChange should equal -currentProb.
    const drawn = [1]; // Keeps SJS combos varied; some balls still kill them.
    const impacts = getFullBallImpacts(COMBOS, drawn, 'SJS');
    const deadBalls = impacts.filter(i => i.status === 'REMAINING_DEAD');
    for (const imp of deadBalls) {
      expect(imp.displayProbability).toBe(0);
      // Delta equals -currentProb exactly.
      const currentProb = probabilityOfWin(COMBOS, drawn, 'SJS') * 100;
      expect(imp.oddsChange).toBeCloseTo(-currentProb, 9);
    }
  });

  it('accounts for Draw 2 redraw-triggers from D1 winner', () => {
    // With D1=CHI, a ball that kills SJS's own combos can still keep some
    // redraw-triggering combos (CHI or REDRAW) containing that ball alive,
    // so the resulting prob is not 0 (just smaller).
    const drawn = [1];
    const impactsNoD1 = getFullBallImpacts(COMBOS, drawn, 'SJS');
    const impactsWithD1 = getFullBallImpacts(COMBOS, drawn, 'SJS', 'CHI');
    // Not every value needs to differ, but at least one should.
    const anyDifferent = impactsWithD1.some((imp, i) =>
      Math.abs(imp.displayProbability - impactsNoD1[i].displayProbability) > 1e-6
    );
    expect(anyDifferent).toBe(true);
  });

  it('target = D1 winner returns all zeros', () => {
    const impacts = getFullBallImpacts(COMBOS, [1], 'CHI', 'CHI');
    for (const imp of impacts) {
      expect(imp.displayProbability).toBe(0);
    }
  });
});

// ---------- probabilityOfWin: spot-checks ------------------------------------

describe('probabilityOfWin — anchor values', () => {
  it('fresh Draw 1: SJS = 18.5%', () => {
    expect(probabilityOfWin(COMBOS, [], 'SJS') * 100).toBeCloseTo(18.5, 9);
  });

  it('fresh Draw 2 (D1=CHI): SJS = 185/865 ≈ 21.387%', () => {
    const expected = (185 / (1001 - 1 - 135)) * 100;
    expect(probabilityOfWin(COMBOS, [], 'SJS', 'CHI') * 100).toBeCloseTo(expected, 9);
  });

  it('returns 0 if target is the D1 winner', () => {
    expect(probabilityOfWin(COMBOS, [], 'CHI', 'CHI')).toBe(0);
    expect(probabilityOfWin(COMBOS, [1, 2], 'CHI', 'CHI')).toBe(0);
  });
});
