// src/data/types.ts

export interface Team {
  abbreviation: string;
  city: string;
  name: string;
  logoLight: string; // Path to light mode SVG/PNG
  logoDark: string;  // Path to dark mode SVG/PNG
}

export interface LotteryOdds {
  seed: number;
  baseOdds: number;      // Percentage (e.g., 18.5)
  combinations: number;  // Out of 1000
}

export interface LotteryConfig {
  year: number;
  totalCombinations: number;
  draws: number;         // How many balls are drawn (usually 2)
  maxMoveUp: number;     // Teams can only move up a maximum of 10 spots
  odds: LotteryOdds[];
}

// Represents a team mapped to a specific seed for the current simulation
export interface SeededTeam {
  seed: number;
  team: Team;
  combinations: number;
}
// Add these to the bottom of src/data/types.ts

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
  finalOrder: SeededTeam[]; // The final 1-16 draft order
}