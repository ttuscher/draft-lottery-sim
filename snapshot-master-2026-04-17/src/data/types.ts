// src/data/types.ts

export interface Team {
  abbreviation: string;
  city: string;
  name: string;
  logoLight: string;
  logoDark: string;
}

export interface SeededTeam {
  seed: number;
  team: Team;
  combinations: number;
}

export interface LotteryCombo {
  id: number;
  balls: number[];
  teamCode: string;
  seq: number;
  comboLabel: string;
}

export interface SimulationResult {
  draw1Winner: SeededTeam;
  draw2Winner: SeededTeam;
  finalOrder: SeededTeam[];
}
