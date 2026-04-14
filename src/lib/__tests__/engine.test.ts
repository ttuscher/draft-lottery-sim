// src/lib/__tests__/engine.test.ts
//
// Validates the NHL Draft Lottery math engine against:
//   - the published 1st-overall odds in lottery-2025.json (via Monte Carlo)
//   - the published Draw 1 odds per team (via Monte Carlo)
//   - deterministic scenario tests for the 10-spot cap, conflict bumps,
//     and the backward-move guard for Draw 2.
//
// Math Background:
//   Draw 1 determines pick #1 overall (subject to a 10-spot cap).
//   Draw 2 determines pick #2 overall (subject to a 10-spot cap and
//   the rule that Draw 2 can never take pick #1).
//
// Any change to engine.ts that breaks published-odds parity should fail
// these tests.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  drawFourBalls,
  getWinner,
  runSimulation,
  resolveDraftOrder,
  MAX_MOVE_UP,
} from '../engine';
import { SeededTeam, LotteryCombo } from '../../data/types';
import { NHL_TEAMS } from '../../data/teams';
import lotteryData from '../../data/lottery-2025.json';

// ---------- Fixtures -----------------------------------------------------------

const TEAM_ORDER = lotteryData.teamOrder as string[];
const COMBOS = lotteryData.entries as LotteryCombo[];

const STANDINGS: SeededTeam[] = TEAM_ORDER.map((code, i) => ({
  seed: i + 1,
  team: NHL_TEAMS[code] ?? {
    abbreviation: code,
    city: code,
    name: 'UNKNOWN',
    logoLight: '',
    logoDark: '',
  },
  combinations: 0,
}));

const byCode = (code: string): SeededTeam => {
  const t = STANDINGS.find(s => s.team.abbreviation === code);
  if (!t) throw new Error(`Fixture missing team ${code}`);
  return t;
};

const orderCodes = (board: SeededTeam[]) =>
  board.map(s => s.team.abbreviation);

// Deterministic Mulberry32 PRNG for reproducible Monte Carlo tests.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- drawFourBalls ------------------------------------------------------

describe('drawFourBalls', () => {
  it('returns 4 distinct balls, each in 1..14, sorted ascending', () => {
    for (let i = 0; i < 500; i++) {
      const balls = drawFourBalls();
      expect(balls).toHaveLength(4);
      expect(new Set(balls).size).toBe(4);
      balls.forEach(b => {
        expect(b).toBeGreaterThanOrEqual(1);
        expect(b).toBeLessThanOrEqual(14);
      });
      for (let k = 1; k < balls.length; k++) {
        expect(balls[k]).toBeGreaterThan(balls[k - 1]);
      }
    }
  });

  it('covers every ball over many draws', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000 && seen.size < 14; i++) {
      drawFourBalls().forEach(b => seen.add(b));
    }
    expect(seen.size).toBe(14);
  });
});

// ---------- getWinner ----------------------------------------------------------

describe('getWinner', () => {
  it('matches a known 2025 combination to the correct team', () => {
    // From lottery-2025.json: combo [1,2,3,4] → SEA.
    const winner = getWinner(COMBOS, [1, 2, 3, 4]);
    expect(winner).not.toBeNull();
    expect(winner!.teamCode).toBe('SEA');
  });

  it('matches the REDRAW combination', () => {
    // 11-12-13-14 is documented as REDRAW.
    const winner = getWinner(COMBOS, [11, 12, 13, 14]);
    expect(winner).not.toBeNull();
    expect(winner!.teamCode).toBe('REDRAW');
  });

  it('is order-insensitive when the balls form a valid combo', () => {
    const w1 = getWinner(COMBOS, [4, 3, 2, 1]);
    const w2 = getWinner(COMBOS, [1, 2, 3, 4]);
    expect(w1?.teamCode).toBe(w2?.teamCode);
  });
});

// ---------- resolveDraftOrder: deterministic scenarios ------------------------

describe('resolveDraftOrder', () => {
  it('non-capped D1 winner goes to pick #1', () => {
    const board = resolveDraftOrder(STANDINGS, byCode('SJS'), byCode('CHI'), MAX_MOVE_UP);
    expect(orderCodes(board)[0]).toBe('SJS');
    expect(orderCodes(board)[1]).toBe('CHI');
    expect(board).toHaveLength(16);
    expect(new Set(orderCodes(board)).size).toBe(16);
  });

  it('non-capped D2 winner goes to pick #2', () => {
    // CHI is seed 2: draw 2 target = max(1, 1-10) = 1 = pick #2.
    const board = resolveDraftOrder(STANDINGS, byCode('NSH'), byCode('CHI'), MAX_MOVE_UP);
    const codes = orderCodes(board);
    expect(codes[0]).toBe('NSH');
    expect(codes[1]).toBe('CHI');
    // SJS fell to pick #3 because NSH jumped from 3 -> 1.
    expect(codes[2]).toBe('SJS');
  });

  it('capped D1 winner (seed 12) lands at pick #2, not #1', () => {
    // DET is seed 12 (index 11). 10-spot cap → pick #2.
    const board = resolveDraftOrder(STANDINGS, byCode('DET'), byCode('CHI'), MAX_MOVE_UP);
    const codes = orderCodes(board);
    expect(codes[0]).toBe('SJS'); // original #1 retains
    expect(codes[1]).toBe('DET'); // capped at pick #2
    // CHI was bumped to pick #3 by the D2 conflict-bump rule.
    expect(codes[2]).toBe('CHI');
  });

  it('capped D1 winner (seed 16) lands at pick #6', () => {
    // CGY is seed 16 (index 15). 10-spot cap → pick #6.
    const board = resolveDraftOrder(STANDINGS, byCode('CGY'), byCode('NSH'), MAX_MOVE_UP);
    const codes = orderCodes(board);
    // NSH is seed 3; draw 2 moves NSH to pick #2.
    expect(codes[0]).toBe('SJS');
    expect(codes[1]).toBe('NSH');
    expect(codes[5]).toBe('CGY');
  });

  it('backward-move guard: SJS stays at pick #1 when SJS wins D2 after a capped D1', () => {
    // DET wins D1 (capped to pick #2). SJS is at pick #1 by default.
    // SJS then wins D2: target would be pick #2, but SJS is already ahead. Stay.
    const board = resolveDraftOrder(STANDINGS, byCode('DET'), byCode('SJS'), MAX_MOVE_UP);
    const codes = orderCodes(board);
    expect(codes[0]).toBe('SJS');
    expect(codes[1]).toBe('DET');
  });

  it('backward-move guard: CHI stays at pick #2 when CHI wins D2 after SJS wins D1', () => {
    // SJS D1 → pick #1. CHI is already at pick #2 post-D1. D2 target = 1
    // which equals CHI's current post-D1 index. Backward-move guard keeps them.
    const board = resolveDraftOrder(STANDINGS, byCode('SJS'), byCode('CHI'), MAX_MOVE_UP);
    expect(orderCodes(board)[1]).toBe('CHI');
  });

  it('2025 NHL actual result: NYI wins D1 (seed 10 → pick #1)', () => {
    // NYI is seed 10 (index 9). Within the 10-spot cap.
    // Real 2025 lottery result was NYI #1, SJS #2, CHI #3.
    const board = resolveDraftOrder(STANDINGS, byCode('NYI'), byCode('SJS'), MAX_MOVE_UP);
    const codes = orderCodes(board);
    expect(codes[0]).toBe('NYI');
    expect(codes[1]).toBe('SJS');
    expect(codes[2]).toBe('CHI');
  });

  it('dual capped winners place independently', () => {
    // CBJ seed 13 (idx 12) → pick #3. UTA seed 14 (idx 13) → pick #4.
    const board = resolveDraftOrder(STANDINGS, byCode('CBJ'), byCode('UTA'), MAX_MOVE_UP);
    const codes = orderCodes(board);
    expect(codes[0]).toBe('SJS');
    expect(codes[1]).toBe('CHI');
    expect(codes[2]).toBe('CBJ');
    expect(codes[3]).toBe('UTA');
    expect(codes[4]).toBe('NSH');
  });

  it('throws when both draws are the same team', () => {
    expect(() =>
      resolveDraftOrder(STANDINGS, byCode('SJS'), byCode('SJS'), MAX_MOVE_UP)
    ).toThrow();
  });

  it('always produces 16 unique teams, regardless of inputs', () => {
    for (let i = 0; i < TEAM_ORDER.length; i++) {
      for (let j = 0; j < TEAM_ORDER.length; j++) {
        if (i === j) continue;
        const board = resolveDraftOrder(
          STANDINGS,
          byCode(TEAM_ORDER[i]),
          byCode(TEAM_ORDER[j]),
          MAX_MOVE_UP
        );
        expect(board).toHaveLength(16);
        expect(new Set(orderCodes(board)).size).toBe(16);
      }
    }
  });

  it('no team below seed 11 ever reaches pick #1 (cap enforced)', () => {
    // Seeds 12–16 (index 11..15) can move up 10 max → pick #2 at best.
    for (const cappedCode of ['DET', 'CBJ', 'UTA', 'VAN', 'CGY']) {
      const board = resolveDraftOrder(
        STANDINGS,
        byCode(cappedCode),
        byCode('SJS'),
        MAX_MOVE_UP
      );
      expect(orderCodes(board)[0]).not.toBe(cappedCode);
    }
  });

  it('D2 winner never takes pick #1 over a seed-1-through-11 D1 winner', () => {
    // For every non-capped D1 winner, every possible D2 winner leaves D1 at #1.
    for (const d1Code of TEAM_ORDER.slice(0, 11)) {
      for (const d2Code of TEAM_ORDER) {
        if (d2Code === d1Code) continue;
        const board = resolveDraftOrder(
          STANDINGS,
          byCode(d1Code),
          byCode(d2Code),
          MAX_MOVE_UP
        );
        expect(orderCodes(board)[0]).toBe(d1Code);
      }
    }
  });
});

// ---------- Monte Carlo validation against published odds --------------------

describe('Monte Carlo parity with published odds', () => {
  const N = 200_000;
  const TOL_DRAW1 = 0.35; // percentage points
  const TOL_PICK1 = 0.4;

  const d1Wins: Record<string, number> = {};
  const pick1: Record<string, number> = {};

  beforeAll(() => {
    // Seed Math.random deterministically for reproducible simulation.
    const rng = mulberry32(0xC0FFEE);
    vi.spyOn(Math, 'random').mockImplementation(() => rng());

    TEAM_ORDER.forEach(code => {
      d1Wins[code] = 0;
      pick1[code] = 0;
    });

    for (let i = 0; i < N; i++) {
      const res = runSimulation(STANDINGS, COMBOS, MAX_MOVE_UP);
      d1Wins[res.draw1Winner.team.abbreviation]++;
      pick1[res.finalOrder[0].team.abbreviation]++;
    }
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it.each(
    TEAM_ORDER.map(code => {
      const published = (lotteryData.teams as any)[code].baseDraw1Odds as number;
      return [code, published];
    })
  )('Draw 1 odds: %s matches published %f%% within tolerance', (code, published) => {
    const simulated = (d1Wins[code] / N) * 100;
    expect(Math.abs(simulated - published)).toBeLessThan(TOL_DRAW1);
  });

  it.each(
    TEAM_ORDER.map(code => {
      const published = (lotteryData.teams as any)[code].baseOverallNo1Odds as number;
      return [code, published];
    })
  )('#1 overall odds: %s matches published %f%% within tolerance', (code, published) => {
    const simulated = (pick1[code] / N) * 100;
    expect(Math.abs(simulated - published)).toBeLessThan(TOL_PICK1);
  });

  it('#1 overall probabilities sum to 100%', () => {
    const total = Object.values(pick1).reduce((a, b) => a + b, 0);
    expect(total).toBe(N);
  });

  it('seeds 12-16 are never awarded pick #1', () => {
    for (const code of ['DET', 'CBJ', 'UTA', 'VAN', 'CGY']) {
      expect(pick1[code]).toBe(0);
    }
  });

  it('Draw 1 win totals sum to N', () => {
    const total = Object.values(d1Wins).reduce((a, b) => a + b, 0);
    expect(total).toBe(N);
  });
});
