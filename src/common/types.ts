type CommonPhaseLink = {
  destPhaseId: number;
  maintainMatchup: boolean;
  isDefault: boolean;
  destSeedOrder: number;
  destBracketSide: number;
};

type OriginPhaseFields = {
  type: 1 | 2;
  originPlacement: number;
  originPhaseId: number;
  originLosses: number | null;
};

type DestPhaseLink = CommonPhaseLink & (OriginPhaseFields | { type: 3 });
type OriginPhaseLink = CommonPhaseLink & OriginPhaseFields;

type RendererFields = {
  id: number;
  numSeeds: number;
};

export type RendererDestPhaseLink = DestPhaseLink & RendererFields;
export type RendererOriginPhaseLink = OriginPhaseLink & RendererFields;

export type NewOriginPhaseLink = OriginPhaseLink & {
  cId: string;
};

export type RendererPhase = {
  id: number;
  name: string;
  state: number;
  bracketType: number;
  groupCount: number;
  numProgressing: number;
  destPhaseLinks: RendererDestPhaseLink[];
  originPhaseLinks: RendererOriginPhaseLink[];
  winnersTargetPhaseId: number | null;
};

export type SelectableEvent = {
  id: number;
  name: string;
};

export type RendererEvent = SelectableEvent & {
  seeds: RendererSeeds;
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
  entrant: Entrant;
  projected: boolean;
};

export type Pool = {
  id: number;
  name: string;
  seeds: Seed[];
};

export type Phase = {
  id: number;
  name: string;
  pools: Pool[];
};

export type RendererSeeds = {
  phases: Phase[];
  raw: Entrant[];
};
