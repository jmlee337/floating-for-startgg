export type SelectableEvent = {
  id: number;
  name: string;
  videogameId: number;
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

export type Ranking = {
  id: number;
  rank: number;
  seriesName: string;
  iconUrl: string | null;
  iterationTitle: string;
  publishedAt: number;
  locationType: number;
  seriesId: number;
};

export type Player = {
  id: number;
  gamerTag: string;
  rankings: Ranking[];
  url: string | null;
};

export enum SyncState {
  SYNCED,
  STARTGG_ONLY,
  LOCAL_ONLY,
}

export type Entrant = {
  id: number;
  players: Player[];
  syncState: SyncState;
};

export type Origin = {
  placement: number;
  poolId: number;
};

export type Seed = {
  id: number;
  seedNum: number;
  entrant: Entrant | undefined;
  origin: Origin | undefined;
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
  phaseOrder: number;
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
