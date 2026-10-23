import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import {
  Entrant,
  Phase,
  RendererEvent,
  SeedsStatus,
  SyncState,
} from '../common/types';
import { useMemo, useState } from 'react';
import { CloudDownload, CloudUpload, Restore, Save } from '@mui/icons-material';
import LocalEvent from './LocalEvent';
import StartggEvent from './StartggEvent';
import ConfigurePhase from './ConfigurePhase';
import isFloatingCompatible from './isFloatingCompatible';

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

export default function SelectedEvent({
  event,
  reflow,
  uploadSeeds,
}: {
  event: RendererEvent;
  reflow: () => Promise<void>;
  uploadSeeds: (localSeeds: Entrant[]) => Promise<void>;
}) {
  const {
    idToConfiguredPhase,
    idToDirectInPerPool,
    idToProgressingInPerPool,
    startggHasFloating,
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

    let numDirectPhases = 0;
    const idToDirectInPerPoolInner = new Map<number, number>();
    event.seeds.phases.forEach((phase) => {
      const directInPerPool = getDirectInPerPool(phase);
      idToDirectInPerPoolInner.set(phase.id, directInPerPool);
      if (directInPerPool !== 0) {
        numDirectPhases++;
      }
    });
    const startggHasFloatingInner = numDirectPhases > 1;

    const idToProgressingInPerPoolInner = new Map<number, number>();
    event.seeds.phases.forEach((phase) => {
      idToProgressingInPerPoolInner.set(
        phase.id,
        getProgressingInPerPool(phase),
      );
    });

    const floatablePhases = event.seeds.phases.filter((phase) =>
      isFloatingCompatible(phase.bracketType),
    );
    const fullyConfiguredInner = floatablePhases.every((phase) =>
      idToConfiguredPhaseInner.has(phase.id),
    );
    const configurationMatchesInner =
      fullyConfiguredInner &&
      floatablePhases.every((phase) => {
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
      floatablePhases.every((phase) => {
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
      startggHasFloating: startggHasFloatingInner,
      fullyConfigured: fullyConfiguredInner,
      configurationMatches: configurationMatchesInner,
      properlyFlowed: properlyFlowedInner,
    };
  }, [event]);

  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [editing, setEditing] = useState(false);
  const [dbLocalSeeds, setDbLocalSeeds] = useState<Entrant[]>([]);
  const dbSeedsUnchanged = useMemo(
    () =>
      dbLocalSeeds.length === event.seeds.raw.length &&
      dbLocalSeeds.every((entrant, i) => entrant.id === event.seeds.raw[i].id),
    [dbLocalSeeds, event.seeds.raw],
  );
  const dbSeedsEntrantMismatch = useMemo(
    () =>
      dbLocalSeeds.some((entrant) => entrant.syncState !== SyncState.SYNCED),
    [dbLocalSeeds],
  );

  const [mutableLocalSeeds, setMutableLocalSeeds] = useState<Entrant[]>([]);
  const mutableSeedsUnchanged = useMemo(
    () =>
      dbLocalSeeds.length === mutableLocalSeeds.length &&
      dbLocalSeeds.every(
        (entrant, i) => entrant.id === mutableLocalSeeds[i].id,
      ),
    [dbLocalSeeds, mutableLocalSeeds],
  );

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
              {startggHasFloating ? 'Confirm configuration' : 'Configure'}
            </Button>
          }
        >
          {startggHasFloating
            ? 'start.gg has floating'
            : 'Floating not configured'}
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
            boxSizing: 'border-box',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <Typography variant="body1" style={{ margin: '4px 0' }}>
            {editing ? 'Click to swap!' : 'Viewing start.gg:'}
          </Typography>
          {editing ? (
            <Stack direction="row" style={{ gap: '8px' }}>
              <Button
                disabled={dbSeedsUnchanged}
                color="error"
                size="small"
                variant="contained"
                endIcon={<CloudDownload />}
                onClick={async () => {
                  const newLocalSeeds = event.seeds.raw;
                  await window.electron.updateLocalSeeds(
                    event.id,
                    newLocalSeeds,
                  );
                  setDbLocalSeeds(newLocalSeeds);
                  setMutableLocalSeeds(newLocalSeeds);
                }}
              >
                Download
              </Button>
              <Button
                disabled={dbSeedsUnchanged || dbSeedsEntrantMismatch}
                size="small"
                variant="contained"
                endIcon={<CloudUpload />}
                onClick={() => {
                  uploadSeeds(dbLocalSeeds);
                }}
              >
                Upload
              </Button>
              <Button
                disabled={mutableSeedsUnchanged}
                color="warning"
                size="small"
                variant="contained"
                endIcon={<Restore />}
                onClick={() => {
                  setMutableLocalSeeds(dbLocalSeeds);
                }}
              >
                Revert
              </Button>
              <Button
                disabled={mutableSeedsUnchanged}
                size="small"
                variant="contained"
                endIcon={<Save />}
                onClick={async () => {
                  await window.electron.updateLocalSeeds(
                    event.id,
                    mutableLocalSeeds.filter((entrant, i) => {
                      if (i < event.seeds.raw.length) {
                        return true;
                      }
                      return entrant.syncState !== SyncState.LOCAL_ONLY;
                    }),
                  );
                  const newMutableLocalSeeds =
                    await window.electron.getLocalSeeds(event.id);
                  setDbLocalSeeds(newMutableLocalSeeds);
                  setMutableLocalSeeds(newMutableLocalSeeds);
                }}
              >
                Save
              </Button>
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
                  setDbLocalSeeds(newLocalSeeds);
                  setMutableLocalSeeds(newLocalSeeds);
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
              directInPerPoolInitial={idToDirectInPerPool.get(phase.id)!}
              progressingInPerPool={idToProgressingInPerPool.get(phase.id)!}
              setDirty={() => {
                setDirty(true);
              }}
            />
          ))}
        </DialogContent>
        {fullyConfigured && (
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
        )}
      </Dialog>
      {editing ? (
        <LocalEvent
          phases={event.seeds.phases.filter(
            (phase) => idToDirectInPerPool.get(phase.id) ?? 0 !== 0,
          )}
          mutableLocalSeeds={mutableLocalSeeds}
          setMutableLocalSeeds={setMutableLocalSeeds}
          overflowEntrantsStartI={event.seeds.raw.length}
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
