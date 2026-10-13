import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { ConfiguredPhase, Phase, RendererEvent } from '../common/types';
import { useMemo, useState } from 'react';

function getDirectInPerPool(phase: Phase) {
  if (phase.pools.length === 0) {
    throw new Error(`no pools in phase ${phase.id}`);
  }

  const directInPerPool = phase.pools[0].seeds.filter(
    (seed) => !seed.projected,
  ).length;
  if (
    phase.pools.every(
      (pool) =>
        pool.seeds.filter((seed) => !seed.projected).length === directInPerPool,
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
    (seed) => seed.projected,
  ).length;
  if (
    phase.pools.every(
      (pool) =>
        pool.seeds.filter((seed) => seed.projected).length ===
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
}: {
  eventId: number;
  phase: Phase;
  configuredPhaseInitial: ConfiguredPhase | undefined;
  progressingInPerPool: number;
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
              }}
            >
              Update
            </Button>
          )}
      </CardActions>
    </Card>
  );
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

    return {
      idToConfiguredPhase: idToConfiguredPhaseInner,
      idToDirectInPerPool: idToDirectInPerPoolInner,
      idToProgressingInPerPool: idToProgressingInPerPoolInner,
      fullyConfigured: event.seeds.phases.every((phase) => {
        const configuredPhase = idToConfiguredPhaseInner.get(phase.id);
        if (!configuredPhase) {
          return false;
        }

        const progressingInPerPool = idToProgressingInPerPoolInner.get(
          phase.id,
        );
        if (
          !progressingInPerPool &&
          configuredPhase.progressingInPerPool !== 0
        ) {
          throw new Error('unreachable');
        }
        if (progressingInPerPool !== configuredPhase.progressingInPerPool) {
          return false;
        }
        if (progressingInPerPool === 0) {
          return true;
        }

        const directInPerPool = idToDirectInPerPoolInner.get(phase.id);
        if (!directInPerPool && configuredPhase.directInPerPool !== 0) {
          throw new Error('unreachable');
        }
        return directInPerPool === configuredPhase.directInPerPool;
      }),
    };
  }, [event]);

  const [open, setOpen] = useState(false);

  return (
    <Stack
      direction="column"
      style={{
        paddingTop: '8px',
        paddingLeft: '8px',
        paddingRight: '8px',
        gap: '8px',
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
          Floating Not Configured
        </Alert>
      )}
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          reflow();
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
            />
          ))}
        </DialogContent>
      </Dialog>
      {event.seeds.phases
        .filter((phase) => idToDirectInPerPool.get(phase.id) ?? 0 !== 0)
        .map((phase) => (
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
                  {pool.seeds.map((seed) => (
                    <Typography
                      key={seed.id}
                      variant="caption"
                      color={seed.projected ? 'warning' : 'textPrimary'}
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontStyle: seed.projected ? 'italic' : 'initial',
                      }}
                    >
                      {seed.seedNum}:{' '}
                      {seed.entrant.players
                        .map((player) => player.gamerTag)
                        .join(' / ')}
                    </Typography>
                  ))}
                </Stack>
              ))}
            </Stack>
          </Stack>
        ))}
      <Typography variant="caption">
        {event.seeds.raw
          .map((entrant) =>
            entrant.players.map((player) => player.gamerTag).join(' / '),
          )
          .join(', ')}
      </Typography>
      {fullyConfigured && (
        <Stack direction="row" style={{ justifyContent: 'end' }}>
          <Button
            variant="contained"
            onClick={() => {
              setOpen(true);
            }}
          >
            Configure
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
