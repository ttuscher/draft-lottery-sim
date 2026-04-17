// src/lib/playoffBracket.ts
//
// Simulates the NHL playoff bracket using "top seed always advances" logic.
// Returns playoff teams ordered for picks 17-32.

import { NHLTeamStanding } from '../hooks/useNHLStandings';

interface BracketTeam {
  abbrev: string;
  points: number;
  regulationWins: number;
  regulationPlusOtWins: number;
  wins: number;
  conference: string;
  division: string;
}

/**
 * Regular-season tiebreaker comparison (ascending = worse team first = higher pick).
 * Same logic as draftLotterySort in useNHLStandings.
 */
function regSeasonSort(a: BracketTeam, b: BracketTeam): number {
  if (a.points !== b.points) return a.points - b.points;
  if (a.regulationWins !== b.regulationWins) return a.regulationWins - b.regulationWins;
  if (a.regulationPlusOtWins !== b.regulationPlusOtWins) return a.regulationPlusOtWins - b.regulationPlusOtWins;
  return a.wins - b.wins;
}

/** Pick the team with the better regular season record. */
function betterTeam(a: BracketTeam, b: BracketTeam): BracketTeam {
  return regSeasonSort(a, b) >= 0 ? a : b;
}

function worseTeam(a: BracketTeam, b: BracketTeam): BracketTeam {
  return regSeasonSort(a, b) >= 0 ? b : a;
}

/**
 * Given the raw standings JSON entries for playoff teams,
 * returns an ordered list of team abbreviations for picks 17-32.
 * Ottawa is always placed at pick 32.
 */
export function computePlayoffDraftOrder(rawStandings: any[]): string[] {
  const playoff = rawStandings.filter((t: any) =>
    ['p', 'x', 'y', 'z'].includes(t.clinchIndicator || '')
  );

  const teams: BracketTeam[] = playoff.map((t: any) => ({
    abbrev: t.teamAbbrev?.default || '',
    points: t.points ?? 0,
    regulationWins: t.regulationWins ?? 0,
    regulationPlusOtWins: t.regulationPlusOtWins ?? 0,
    wins: t.wins ?? 0,
    conference: t.conferenceName || '',
    division: t.divisionName || '',
  }));

  const east = teams.filter(t => t.conference === 'Eastern');
  const west = teams.filter(t => t.conference === 'Western');

  const eastBracket = buildConferenceBracket(east);
  const westBracket = buildConferenceBracket(west);

  // Simulate each conference
  const eastResult = simulateConference(eastBracket);
  const westResult = simulateConference(westBracket);

  // Cup Final: better regular season record wins
  const cupFinalists = [eastResult.champion, westResult.champion];
  const cupWinner = betterTeam(cupFinalists[0], cupFinalists[1]);
  const cupLoser = worseTeam(cupFinalists[0], cupFinalists[1]);

  // Combine all eliminated teams by round
  const r1Losers = [...eastResult.r1Losers, ...westResult.r1Losers];
  const r2Losers = [...eastResult.r2Losers, ...westResult.r2Losers];
  const cfLosers = [eastResult.cfLoser, westResult.cfLoser];

  // Picks 17-28: R1 + R2 losers sorted by regular season (worst first = higher pick)
  const earlyEliminated = [...r1Losers, ...r2Losers].sort(regSeasonSort);

  // Picks 29-30: CF losers sorted by regular season
  const cfSorted = cfLosers.sort(regSeasonSort);

  // Pick 31: Cup final loser
  // Pick 32: Cup final winner (but Ottawa overrides to 32)
  const fullOrder = [
    ...earlyEliminated,
    ...cfSorted,
    cupLoser,
    cupWinner,
  ].map(t => t.abbrev);

  // Ottawa always picks 32: remove from current position, append at end
  const ottIdx = fullOrder.indexOf('OTT');
  if (ottIdx !== -1) {
    fullOrder.splice(ottIdx, 1);
    fullOrder.push('OTT');
  }

  return fullOrder;
}

interface ConferenceBracket {
  // First round matchups: [higher seed, lower seed]
  series1: [BracketTeam, BracketTeam]; // #1 seed vs WC2
  series2: [BracketTeam, BracketTeam]; // Div A: #2 vs #3
  series3: [BracketTeam, BracketTeam]; // #2 seed vs WC1
  series4: [BracketTeam, BracketTeam]; // Div B: #2 vs #3
}

interface ConferenceResult {
  champion: BracketTeam;
  cfLoser: BracketTeam;
  r1Losers: BracketTeam[];
  r2Losers: BracketTeam[];
}

function buildConferenceBracket(confTeams: BracketTeam[]): ConferenceBracket {
  // Group by division
  const divisions: Record<string, BracketTeam[]> = {};
  for (const t of confTeams) {
    if (!divisions[t.division]) divisions[t.division] = [];
    divisions[t.division].push(t);
  }

  // Sort each division by points desc
  const divNames = Object.keys(divisions);
  for (const d of divNames) {
    divisions[d].sort((a, b) => -regSeasonSort(a, b)); // best first
  }

  // Division winners
  const divWinners = divNames.map(d => ({ div: d, team: divisions[d][0] }));

  // #1 seed = division winner with most points
  divWinners.sort((a, b) => -regSeasonSort(a.team, b.team)); // best first
  const seed1Div = divWinners[0].div;
  const seed2Div = divWinners[1].div;
  const seed1 = divWinners[0].team;
  const seed2 = divWinners[1].team;

  // Top 3 from each division qualify, rest go to wild card pool
  const wcPool: BracketTeam[] = [];
  const divQualified: Record<string, BracketTeam[]> = {};

  for (const d of divNames) {
    divQualified[d] = divisions[d].slice(0, 3);
    wcPool.push(...divisions[d].slice(3));
  }

  // Wild cards: best 2 from pool, sorted best first
  wcPool.sort((a, b) => -regSeasonSort(a, b));
  const wc1 = wcPool[0]; // higher wild card
  const wc2 = wcPool[1]; // lower wild card

  // Bracket structure:
  // Top half: #1 seed vs WC2, then Div of #1 seed: 2nd vs 3rd
  // Bottom half: #2 seed vs WC1, then Div of #2 seed: 2nd vs 3rd
  const div1Teams = divQualified[seed1Div];
  const div2Teams = divQualified[seed2Div];

  return {
    series1: [seed1, wc2],              // #1 vs WC2
    series2: [div1Teams[1], div1Teams[2]], // Seed1's div: 2nd vs 3rd
    series3: [seed2, wc1],              // #2 vs WC1
    series4: [div2Teams[1], div2Teams[2]], // Seed2's div: 2nd vs 3rd
  };
}

function simulateConference(bracket: ConferenceBracket): ConferenceResult {
  const r1Losers: BracketTeam[] = [];

  // Round 1: top seed always wins
  const w1 = betterTeam(bracket.series1[0], bracket.series1[1]);
  r1Losers.push(worseTeam(bracket.series1[0], bracket.series1[1]));

  const w2 = betterTeam(bracket.series2[0], bracket.series2[1]);
  r1Losers.push(worseTeam(bracket.series2[0], bracket.series2[1]));

  const w3 = betterTeam(bracket.series3[0], bracket.series3[1]);
  r1Losers.push(worseTeam(bracket.series3[0], bracket.series3[1]));

  const w4 = betterTeam(bracket.series4[0], bracket.series4[1]);
  r1Losers.push(worseTeam(bracket.series4[0], bracket.series4[1]));

  // Round 2: bracket stays fixed (w1 vs w2, w3 vs w4)
  const r2Losers: BracketTeam[] = [];

  const sf1 = betterTeam(w1, w2);
  r2Losers.push(worseTeam(w1, w2));

  const sf2 = betterTeam(w3, w4);
  r2Losers.push(worseTeam(w3, w4));

  // Conference Final
  const champion = betterTeam(sf1, sf2);
  const cfLoser = worseTeam(sf1, sf2);

  return { champion, cfLoser, r1Losers, r2Losers };
}
