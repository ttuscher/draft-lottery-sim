// src/hooks/useNHLStandings.ts
//
// Reads NHL standings from locally saved JSON file.
// Data sourced from: curl -sL "https://api-web.nhle.com/v1/standings/now"

"use client";

import { useMemo } from 'react';
import standingsData from '../data/nhl-standings-2026.json';
import { computePlayoffDraftOrder } from '../lib/playoffBracket';

export interface NHLTeamStanding {
  teamAbbrev: string;
  teamName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  pointPctg: number;       // 0-1 scale from API
  regulationWins: number;  // RW
  regulationPlusOtWins: number; // ROW
  record: string;          // "W-L-OTL" formatted
  clinchIndicator: string; // 'e' = eliminated, 'p'/'x'/'y'/'z' = clinched playoff
}

interface UseNHLStandingsResult {
  /** All 32 teams, lottery-eligible first (worst-first), then playoff teams (best-last). */
  standings: NHLTeamStanding[];
  /** Just the eliminated (lottery-eligible) teams, sorted worst-first. */
  lotteryTeams: NHLTeamStanding[];
  /** Just the clinched (playoff) teams, sorted best-last. */
  playoffTeams: NHLTeamStanding[];
}

/**
 * NHL Draft Lottery tiebreaker sort (ascending = worst first = highest pick):
 * 1. Points (fewer = higher pick)
 * 2. Point percentage (lower = higher pick — handles different GP)
 * 3. Regulation wins (fewer = higher pick)
 * 4. Regulation + OT wins (fewer = higher pick)
 * 5. Total wins (fewer = higher pick)
 */
function draftLotterySort(a: NHLTeamStanding, b: NHLTeamStanding): number {
  if (a.points !== b.points) return a.points - b.points;
  if (Math.abs(a.pointPctg - b.pointPctg) > 0.0005) return a.pointPctg - b.pointPctg;
  if (a.regulationWins !== b.regulationWins) return a.regulationWins - b.regulationWins;
  if (a.regulationPlusOtWins !== b.regulationPlusOtWins) return a.regulationPlusOtWins - b.regulationPlusOtWins;
  return a.wins - b.wins;
}

export function useNHLStandings(): UseNHLStandingsResult {
  const { lotteryTeams, playoffTeams, standings } = useMemo(() => {
    const raw: any[] = (standingsData as any).standings || [];

    const parsed: NHLTeamStanding[] = raw.map((t: any) => ({
      teamAbbrev: t.teamAbbrev?.default || '',
      teamName: t.teamName?.default || '',
      gamesPlayed: t.gamesPlayed ?? 0,
      wins: t.wins ?? 0,
      losses: t.losses ?? 0,
      otLosses: t.otLosses ?? 0,
      points: t.points ?? 0,
      pointPctg: t.pointPctg ?? 0,
      regulationWins: t.regulationWins ?? 0,
      regulationPlusOtWins: t.regulationPlusOtWins ?? 0,
      record: `${String(t.wins ?? 0).padStart(2, '0')}-${String(t.losses ?? 0).padStart(2, '0')}-${String(t.otLosses ?? 0).padStart(2, '0')}`,
      clinchIndicator: t.clinchIndicator || '',
    }));

    // Separate by clinch status: eliminated = lottery, clinched = playoff
    const eliminated = parsed.filter(t => t.clinchIndicator === 'e');
    const clinched = parsed.filter(t => ['p', 'x', 'y', 'z'].includes(t.clinchIndicator));

    // Teams with no indicator yet: treat as lottery if below playoff line
    const undetermined = parsed.filter(t => !t.clinchIndicator);

    // Sort lottery teams: worst first (ascending)
    const lottery = [...eliminated, ...undetermined].sort(draftLotterySort);

    // Order playoff teams by simulated bracket result (top seed advances)
    // Returns abbreviations in draft order: picks 17-32
    const playoffOrder = computePlayoffDraftOrder(raw);
    const clinchMap = new Map(clinched.map(t => [t.teamAbbrev, t]));
    const playoff = playoffOrder
      .map(abbrev => clinchMap.get(abbrev))
      .filter((t): t is NHLTeamStanding => !!t);

    // Combined: lottery first, then playoff
    const combined = [...lottery, ...playoff];

    return { lotteryTeams: lottery, playoffTeams: playoff, standings: combined };
  }, []);

  return { standings, lotteryTeams, playoffTeams };
}
