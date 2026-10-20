import { useState } from 'react';
import { ConfiguredPhase, Phase } from '../common/types';
import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';

export default function ConfigurePhase({
  eventId,
  phase,
  configuredPhaseInitial,
  directInPerPoolInitial,
  progressingInPerPool,
  setDirty,
}: {
  eventId: number;
  phase: Phase;
  configuredPhaseInitial: ConfiguredPhase | undefined;
  directInPerPoolInitial: number;
  progressingInPerPool: number;
  setDirty: () => void;
}) {
  const [configuredPhase, setConfiguredPhase] = useState(
    configuredPhaseInitial,
  );
  const [directInPerPool, setDirectInPerPool] = useState(
    configuredPhaseInitial?.directInPerPool ?? directInPerPoolInitial,
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
