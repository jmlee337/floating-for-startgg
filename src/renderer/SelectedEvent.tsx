import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import {
  ConfiguredPhase,
  Entrant,
  Phase,
  RendererEvent,
  Seed,
  SeedsStatus,
} from '../common/types';
import { useMemo, useState } from 'react';

function getDirectInPerPool(phase: Phase) {
  if (phase.pools.length === 0) {
    throw new Error(`no pools in phase ${phase.id}`);
  }

  const directInPerPool = phase.pools[0].seeds.filter(
    (seed) => seed.entrant,
  ).length;
  if (
    phase.pools.every(
      (pool) =>
        pool.seeds.filter((seed) => seed.entrant).length === directInPerPool,
    )
  ) {
    return directInPerPool;
  }
  return -1;
}
function getProgressingInPerPool(phase: Phase) {
  if (phase.pools.length === 0) {
    throw new Error(`no pools in phase ${phase.id}`);
  }

  const progressingInPerPool = phase.pools[0].seeds.filter(
    (seed) => seed.origin,
  ).length;
  if (
    phase.pools.every(
      (pool) =>
        pool.seeds.filter((seed) => seed.origin).length ===
        progressingInPerPool,
    )
  ) {
    return progressingInPerPool;
  }
  return -1;
}

function ConfigurePhase({
  eventId,
  phase,
  configuredPhaseInitial,
  progressingInPerPool,
  setDirty,
}: {
  eventId: number;
  phase: Phase;
  configuredPhaseInitial: ConfiguredPhase | undefined;
  progressingInPerPool: number;
  setDirty: () => void;
}) {
  const [configuredPhase, setConfiguredPhase] = useState(
    configuredPhaseInitial,
  );
  const [directInPerPool, setDirectInPerPool] = useState(
    configuredPhaseInitial?.directInPerPool ?? 0,
  );

  return (
    <Card key={phase.id} style={{ flexShrink: 0 }}>
      <CardContent style={{ display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6">{phase.name}</Typography>
        {progressingInPerPool === 0 && (
          <FormControl style={{ marginTop: '8px' }}>
            <InputLabel id={`direct-in-per-pool-label-${phase.id}`}>
              Floated in / pool
            </InputLabel>
            <Select
              disabled
              size="small"
              label="Floated in / pool"
              labelId={`direct-in-per-pool-label-${phase.id}`}
              value={-1}
            >
              <MenuItem value={-1}>Unlimited</MenuItem>
            </Select>
          </FormControl>
        )}
        {progressingInPerPool > 0 && (
          <FormControl style={{ marginTop: '8px' }}>
            <InputLabel id={`direct-in-per-pool-label-${phase.id}`}>
              Floated in / pool
            </InputLabel>
            <Select
              disabled={phase.bracketType !== 3}
              size="small"
              label="Floated in / pool"
              labelId={`direct-in-per-pool-label-${phase.id}`}
              value={directInPerPool}
              onChange={(ev) => {
                setDirectInPerPool(ev.target.value);
              }}
            >
              <MenuItem value={0}>0</MenuItem>
              <MenuItem value={1}>1</MenuItem>
              <MenuItem value={2}>2</MenuItem>
              <MenuItem value={3}>3</MenuItem>
              <MenuItem value={4}>4</MenuItem>
              <MenuItem value={5}>5</MenuItem>
              <MenuItem value={6}>6</MenuItem>
              <MenuItem value={7}>7</MenuItem>
              <MenuItem value={8}>8</MenuItem>
            </Select>
          </FormControl>
        )}
        {progressingInPerPool === -1 && (
          <Alert severity="error">Uneven pool progressions in</Alert>
        )}
        {(!configuredPhase ||
          (configuredPhase &&
            configuredPhase.progressingInPerPool === progressingInPerPool)) && (
          <Typography variant="caption">
            Progressing in: {progressingInPerPool} / pool
          </Typography>
        )}
        {configuredPhase &&
          configuredPhase.progressingInPerPool !== progressingInPerPool && (
            <Typography variant="caption" color="warning">
              Progressing in: {progressingInPerPool} / pool (previously{' '}
              {configuredPhase.progressingInPerPool})
            </Typography>
          )}
      </CardContent>
      <CardActions style={{ justifyContent: 'end' }}>
        {!configuredPhase && (
          <Button
            variant="contained"
            onClick={async () => {
              await window.electron.upsertConfiguredPhase({
                id: phase.id,
                eventId,
                directInPerPool,
                progressingInPerPool,
              });
              setConfiguredPhase(
                await window.electron.getConfiguredPhase(phase.id),
              );
              setDirty();
            }}
          >
            Confirm
          </Button>
        )}
        {configuredPhase &&
          (directInPerPool !== configuredPhase.directInPerPool ||
            progressingInPerPool !== configuredPhase.progressingInPerPool) && (
            <Button
              variant="contained"
              onClick={async () => {
                await window.electron.upsertConfiguredPhase({
                  id: phase.id,
                  eventId,
                  directInPerPool,
                  progressingInPerPool,
                });
                setConfiguredPhase(
                  await window.electron.getConfiguredPhase(phase.id),
                );
                setDirty();
              }}
            >
              Update
            </Button>
          )}
      </CardActions>
    </Card>
  );
}

function StartggEvent({ phases }: { phases: Phase[] }) {
  const poolIdToSeeds = useMemo(() => {
    const newPoolIdToSeeds = new Map<number, Seed[]>();
    phases.forEach((phase) => {
      phase.pools.forEach((pool) => {
        newPoolIdToSeeds.set(pool.id, pool.seeds);
      });
    });
    return newPoolIdToSeeds;
  }, [phases]);
  return (
    <>
      {phases.map((phase) => (
        <Stack key={phase.id} direction="row" style={{ gap: '8px' }}>
          <Typography variant="body2" style={{ flexShrink: 0 }}>
            {phase.name}
          </Typography>
          <Stack
            direction="row"
            style={{
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            {phase.pools.map((pool) => (
              <Stack
                key={pool.id}
                direction="column"
                style={{ width: '130px' }}
              >
                <Typography variant="body2">{pool.name}</Typography>
                {pool.seeds.map((seed) => (
                  <Typography
                    key={seed.id}
                    variant="caption"
                    color={seed.origin ? 'warning' : 'textPrimary'}
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontStyle: seed.origin ? 'italic' : 'initial',
                    }}
                  >
                    {seed.seedNum}:{' '}
                    {seed.entrant &&
                      seed.entrant.players
                        .map((player) => player.gamerTag)
                        .join(' / ')}
                    {seed.origin &&
                      poolIdToSeeds
                        .get(seed.origin.poolId)
                        ?.[seed.origin.placement - 1]?.entrant?.players.map(
                          (player) => player.gamerTag,
                        )
                        .join(' / ')}
                  </Typography>
                ))}
              </Stack>
            ))}
          </Stack>
        </Stack>
      ))}
    </>
  );
}

function LocalEvent({
  phases,
  localSeeds,
}: {
  phases: Phase[];
  localSeeds: Entrant[];
}) {
  const actualPhases = useMemo(() => {
    const remainingEntrants = new Array(...localSeeds);
    const ret: Phase[] = [];
    for (const phase of phases) {
      if (remainingEntrants.length === 0) {
        break;
      }

      const numEntrants = phase.pools
        .map((pool) => pool.seeds.filter((seed) => seed.entrant).length)
        .reduce((prev, curr) => prev + curr);
      const seedNumToEntrant = new Map(
        remainingEntrants
          .splice(0, numEntrants)
          .map((entrant, i) => [i + 1, entrant]),
      );

      ret.push({
        ...phase,
        pools: phase.pools.map((pool) => ({
          ...pool,
          seeds: pool.seeds.map((seed) => {
            const entrant = seedNumToEntrant.get(seed.seedNum);
            return {
              ...seed,
              entrant: entrant ?? { id: seed.seedNum, players: [] },
            };
          }),
        })),
      });
    }
    return ret;
  }, [phases, localSeeds]);

  return <StartggEvent phases={actualPhases} />;
}

export default function SelectedEvent({
  event,
  reflow,
}: {
  event: RendererEvent;
  reflow: () => Promise<void>;
}) {
  const {
    idToConfiguredPhase,
    idToDirectInPerPool,
    idToProgressingInPerPool,
    fullyConfigured,
    configurationMatches,
    properlyFlowed,
  } = useMemo(() => {
    const idToConfiguredPhaseInner = new Map(
      event.configuredPhases.map((configuredPhase) => [
        configuredPhase.id,
        configuredPhase,
      ]),
    );

    const idToDirectInPerPoolInner = new Map<number, number>();
    event.seeds.phases.forEach((phase) => {
      idToDirectInPerPoolInner.set(phase.id, getDirectInPerPool(phase));
    });

    const idToProgressingInPerPoolInner = new Map<number, number>();
    event.seeds.phases.forEach((phase) => {
      idToProgressingInPerPoolInner.set(
        phase.id,
        getProgressingInPerPool(phase),
      );
    });

    const fullyConfiguredInner = event.seeds.phases.every((phase) =>
      idToConfiguredPhaseInner.has(phase.id),
    );
    const configurationMatchesInner =
      fullyConfiguredInner &&
      event.seeds.phases.every((phase) => {
        const configuredPhase = idToConfiguredPhaseInner.get(phase.id)!;
        const progressingInPerPool = idToProgressingInPerPoolInner.get(
          phase.id,
        );
        if (
          !progressingInPerPool &&
          configuredPhase.progressingInPerPool !== 0
        ) {
          throw new Error('unreachable');
        }
        return progressingInPerPool === configuredPhase.progressingInPerPool;
      });
    const properlyFlowedInner =
      configurationMatchesInner &&
      event.seeds.phases.every((phase) => {
        const configuredPhase = idToConfiguredPhaseInner.get(phase.id)!;
        const progressingInPerPool = idToProgressingInPerPoolInner.get(
          phase.id,
        );
        if (
          !progressingInPerPool &&
          configuredPhase.progressingInPerPool !== 0
        ) {
          throw new Error('unreachable');
        }
        if (progressingInPerPool === 0) {
          return true;
        }

        const directInPerPool = idToDirectInPerPoolInner.get(phase.id);
        if (!directInPerPool && configuredPhase.directInPerPool !== 0) {
          throw new Error('unreachable');
        }
        return directInPerPool === configuredPhase.directInPerPool;
      });

    return {
      idToConfiguredPhase: idToConfiguredPhaseInner,
      idToDirectInPerPool: idToDirectInPerPoolInner,
      idToProgressingInPerPool: idToProgressingInPerPoolInner,
      fullyConfigured: fullyConfiguredInner,
      configurationMatches: configurationMatchesInner,
      properlyFlowed: properlyFlowedInner,
    };
  }, [event]);

  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [editing, setEditing] = useState(false);
  const [localSeeds, setLocalSeeds] = useState<Entrant[]>([]);

  return (
    <Stack
      direction="column"
      style={{
        paddingTop: '8px',
        paddingLeft: '8px',
        paddingRight: '8px',
        gap: '16px',
      }}
    >
      {!fullyConfigured && (
        <Alert
          severity="warning"
          action={
            <Button
              variant="contained"
              onClick={() => {
                setOpen(true);
              }}
            >
              Configure
            </Button>
          }
        >
          Floating not configured
        </Alert>
      )}
      {fullyConfigured && !configurationMatches && (
        <Alert
          severity="warning"
          action={
            <Button
              variant="contained"
              onClick={() => {
                setOpen(true);
              }}
            >
              Confirm configuration
            </Button>
          }
        >
          start.gg progressions changed
        </Alert>
      )}
      {fullyConfigured && configurationMatches && !properlyFlowed && (
        <Alert
          severity="warning"
          action={
            <Button
              variant="contained"
              onClick={() => {
                reflow();
              }}
            >
              Reflow
            </Button>
          }
        >
          Entrant reflow required
        </Alert>
      )}
      {event.seedsStatus === SeedsStatus.FIX_UNSUPPORTED && (
        <Alert severity="warning">
          Rematch detction unsupported for this format
        </Alert>
      )}
      {fullyConfigured && configurationMatches && properlyFlowed && (
        <Stack
          direction="row"
          style={{
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: '36px',
          }}
        >
          <Typography variant="body1" style={{ margin: '4px 0' }}>
            {editing ? 'Editing locally:' : 'Viewing start.gg:'}
          </Typography>
          {editing ? (
            <Stack direction="row" style={{ gap: '8px' }}>
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  setEditing(false);
                }}
              >
                View start.gg
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" style={{ gap: '8px' }}>
              <Button
                color="warning"
                size="small"
                variant="contained"
                onClick={() => {
                  setOpen(true);
                }}
              >
                Configure Floating
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={async () => {
                  let newLocalSeeds = await window.electron.getLocalSeeds(
                    event.id,
                  );
                  if (newLocalSeeds.length === 0) {
                    newLocalSeeds = event.seeds.raw;
                    await window.electron.updateLocalSeeds(
                      event.id,
                      newLocalSeeds,
                    );
                  }
                  setLocalSeeds(newLocalSeeds);
                  setEditing(true);
                }}
              >
                Edit Locally
              </Button>
            </Stack>
          )}
        </Stack>
      )}
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          if (dirty) {
            reflow();
          }
        }}
      >
        <DialogTitle>Configure Floating for {event.name}</DialogTitle>
        <DialogContent
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          {event.seeds.phases.map((phase) => (
            <ConfigurePhase
              key={phase.id}
              eventId={event.id}
              phase={phase}
              configuredPhaseInitial={idToConfiguredPhase.get(phase.id)}
              progressingInPerPool={idToProgressingInPerPool.get(phase.id)!}
              setDirty={() => {
                setDirty(true);
              }}
            />
          ))}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              setOpen(false);
              reflow();
            }}
          >
            Force Reflow
          </Button>
        </DialogActions>
      </Dialog>
      {editing ? (
        <LocalEvent
          phases={event.seeds.phases.filter(
            (phase) => idToDirectInPerPool.get(phase.id) ?? 0 !== 0,
          )}
          localSeeds={localSeeds}
        />
      ) : (
        <StartggEvent
          phases={event.seeds.phases.filter(
            (phase) => idToDirectInPerPool.get(phase.id) ?? 0 !== 0,
          )}
        />
      )}
    </Stack>
  );
}
