export type SelectableEvent = {
  id: number;
  name: string;
};

export enum SeedsStatus {
  FIXED,
  FIX_UNSUPPORTED,
  REFLOW_REQUIRED,
}

export type RendererEvent = SelectableEvent & {
  seeds: RendererSeeds;
  configuredPhases: ConfiguredPhase[];
  seedsStatus: SeedsStatus;
};

export type SelectableTournament = {
  name: string;
  slug: string;
};

export type RendererTournament = SelectableTournament & {
  events: SelectableEvent[];
};

export type Player = {
  id: number;
  gamerTag: string;
};

export type Entrant = {
  id: number;
  players: Player[];
};

export type Seed = {
  id: number;
  seedNum: number;
  entrant: Entrant | undefined;
  origin: { placement: number; poolId: number } | undefined;
};

export type Pool = {
  id: number;
  name: string;
  seeds: Seed[];
};

export type Phase = {
  id: number;
  name: string;
  /**
   * 1 SINGLE_ELIMINATION
   * 2 DOUBLE_ELIMINATION
   * 3 ROUND_ROBIN
   * 4 SWISS
   * 5 EXHIBITION
   * 6CUSTOM_SCHEDULE
   * 7 MATCHMAKING
   * 8 ELIMINATION_ROUNDS
   * 9 RACE
   * 10 CIRCUIT
   */
  bracketType: number;
  seedNumOffset: number;
  pools: Pool[];
};

export type RendererSeeds = {
  phases: Phase[];
  raw: Entrant[];
};

export type ConfiguredPhase = {
  id: number;
  eventId: number;
  directInPerPool: number;
  progressingInPerPool: number;
};
