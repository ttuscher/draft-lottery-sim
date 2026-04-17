// src/data/pickOwnership.ts
//
// 2026 NHL Draft first-round pick ownership.
// Each entry maps the team whose RECORD earns the slot
// to the team (or conditional logic) that OWNS the pick.

export type PickTrade =
  | { type: 'resolved'; owner: string; from: string }
  | { type: 'conditional'; originalTeam: string; acquirer: string; protection: string; protectionThreshold: number };

/**
 * Resolved trades: pick ownership is fully determined regardless of lottery outcome.
 * Key = team whose record/standings earn the draft slot.
 * Value = team who owns the pick.
 */
const RESOLVED_TRADES: Record<string, PickTrade> = {
  DET: { type: 'resolved', owner: 'STL', from: 'DET' },
  ANA: { type: 'resolved', owner: 'WSH', from: 'ANA' },
  EDM: { type: 'resolved', owner: 'SJS', from: 'EDM' },
  VGK: { type: 'resolved', owner: 'CGY', from: 'VGK' },
  MIN: { type: 'resolved', owner: 'VAN', from: 'MIN' },
  TBL: { type: 'resolved', owner: 'SEA', from: 'TBL' },
  COL: { type: 'resolved', owner: 'STL', from: 'COL' },
};

/**
 * Conditional trades: pick transfers only if it falls outside the protection range.
 * "TOP 5 PROTECTED" means the original team keeps it if the final pick is 1-5.
 * "TOP 10 PROTECTED" means the original team keeps it if the final pick is 1-10.
 */
const CONDITIONAL_TRADES: Record<string, PickTrade> = {
  TOR: { type: 'conditional', originalTeam: 'TOR', acquirer: 'BOS', protection: 'TOP 5 PROTECTED', protectionThreshold: 5 },
  FLA: { type: 'conditional', originalTeam: 'FLA', acquirer: 'CHI', protection: 'TOP 10 PROTECTED', protectionThreshold: 10 },
};

/** Combined lookup: all traded picks keyed by the team whose record earns the slot. */
export const PICK_OWNERSHIP: Record<string, PickTrade> = {
  ...RESOLVED_TRADES,
  ...CONDITIONAL_TRADES,
};

/**
 * Given a team abbreviation and their final pick number (post-lottery),
 * returns the abbreviation of the team that actually owns the pick.
 * Returns the original team if no trade exists or if the pick is protected.
 */
export function resolvePickOwner(teamAbbrev: string, finalPickNum?: number): string {
  const trade = PICK_OWNERSHIP[teamAbbrev];
  if (!trade) return teamAbbrev;

  if (trade.type === 'resolved') {
    return trade.owner;
  }

  // Conditional: check if pick falls within protection range
  if (trade.type === 'conditional' && finalPickNum !== undefined) {
    if (finalPickNum <= trade.protectionThreshold) {
      // Protected — original team keeps it
      return trade.originalTeam;
    }
    // Outside protection — pick transfers
    return trade.acquirer;
  }

  // No final pick yet — ownership unresolved
  return teamAbbrev;
}

/**
 * Returns display info for a pick's ownership status.
 * Used by UI components to show "FROM DET" or "TOP 5 PROTECTED: BOS" labels.
 */
export function getPickOwnershipDisplay(teamAbbrev: string, finalPickNum?: number): {
  showTeam: string;       // The team whose logo/name to display prominently
  subLabel: string | null; // Grey text below the name (e.g., "FROM DET", "TOP 5 PROTECTED: BOS")
  isTransferred: boolean;  // Whether the pick has transferred to a different team
  isConditional: boolean;  // Whether this is a conditional pick (pre-resolution)
  isProtected: boolean;    // Whether a conditional pick was kept by original team
} {
  const trade = PICK_OWNERSHIP[teamAbbrev];

  if (!trade) {
    return { showTeam: teamAbbrev, subLabel: null, isTransferred: false, isConditional: false, isProtected: false };
  }

  if (trade.type === 'resolved') {
    return {
      showTeam: trade.owner,
      subLabel: `FROM ${trade.from}`,
      isTransferred: true,
      isConditional: false,
      isProtected: false,
    };
  }

  // Conditional trade
  if (finalPickNum === undefined) {
    // Pre-draw: show original team with protection note
    return {
      showTeam: trade.originalTeam,
      subLabel: `${trade.protection} → ${trade.acquirer}`,
      isTransferred: false,
      isConditional: true,
      isProtected: false,
    };
  }

  if (finalPickNum <= trade.protectionThreshold) {
    // Protected — original team keeps it
    return {
      showTeam: trade.originalTeam,
      subLabel: null,
      isTransferred: false,
      isConditional: false,
      isProtected: true,
    };
  }

  // Condition triggered — pick transfers
  return {
    showTeam: trade.acquirer,
    subLabel: `FROM ${trade.originalTeam}`,
    isTransferred: true,
    isConditional: false,
    isProtected: false,
  };
}
