import { describe, expect, it } from 'vitest';
import { computeSecondOverallOdds, computePickSlotOdds } from './lotteryOdds';

describe('computeSecondOverallOdds', () => {
  const odds = computeSecondOverallOdds();

  it('returns odds for all 16 teams', () => {
    expect(Object.keys(odds).length).toBe(16);
  });

  it('sums to 100%', () => {
    const total = Object.values(odds).reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(100, 4);
  });

  it('SJS has highest 2nd-overall odds as worst-record team', () => {
    const sorted = Object.entries(odds).sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe('SJS');
  });

  it('bottom 4 teams (CBJ, UTA, VAN, CGY) have 0% odds due to 10-spot cap', () => {
    expect(odds['CBJ']).toBeCloseTo(0, 8);
    expect(odds['UTA']).toBeCloseTo(0, 8);
    expect(odds['VAN']).toBeCloseTo(0, 8);
    expect(odds['CGY']).toBeCloseTo(0, 8);
  });

  it('DET can reach #2 despite being seed 12', () => {
    expect(odds['DET']).toBeGreaterThan(4);
  });
});

describe('computePickSlotOdds', () => {
  const allSlots = computePickSlotOdds();

  it('each pick slot sums to 100%', () => {
    for (let pick = 1; pick <= 16; pick++) {
      const total = Object.values(allSlots[pick]).reduce((sum, v) => sum + v, 0);
      expect(total).toBeCloseTo(100, 4);
    }
  });

  it('each team sums to 100% across all pick slots', () => {
    const teamCodes = Object.keys(allSlots[1]);
    for (const code of teamCodes) {
      let total = 0;
      for (let pick = 1; pick <= 16; pick++) {
        total += allSlots[pick][code];
      }
      expect(total).toBeCloseTo(100, 4);
    }
  });
});
