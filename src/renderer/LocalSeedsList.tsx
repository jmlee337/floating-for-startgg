import { Entrant, Phase } from '../common/types';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import { Dispatch, SetStateAction, useMemo } from 'react';
import {
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  Typography,
} from '@mui/material';
import { DragIndicator } from '@mui/icons-material';

function Sortable({
  entrant,
  index,
  phaseAndFns,
}: {
  entrant: Entrant;
  index: number;
  phaseAndFns: {
    phaseId: number;
    phaseName: string;
    fn: (index: number) => void;
  }[];
}) {
  const { ref, handleRef } = useSortable({
    id: entrant.id,
    index,
  });

  return (
    <ListItem
      disablePadding
      ref={ref}
      style={{ justifyContent: 'space-between' }}
    >
      <Stack direction="row" style={{ gap: '8px', alignItems: 'center' }}>
        <ListItemButton
          component="button"
          ref={handleRef}
          style={{ flexGrow: 0, padding: '4px' }}
        >
          <ListItemIcon style={{ minWidth: '20px' }}>
            <DragIndicator fontSize="small" />
          </ListItemIcon>
        </ListItemButton>
        <ListItemText disableTypography style={{ margin: 0 }}>
          <Typography variant="caption">
            {index + 1}:{' '}
            {entrant.players.map((player) => player.gamerTag).join(' / ')}
          </Typography>
        </ListItemText>
      </Stack>
      <Stack direction="row" style={{ gap: '8px' }}>
        {phaseAndFns.map((phaseAndFn) => (
          <Button
            key={phaseAndFn.phaseId}
            size="small"
            onClick={() => {
              phaseAndFn.fn(index);
            }}
          >
            {phaseAndFn.phaseName}
          </Button>
        ))}
      </Stack>
    </ListItem>
  );
}

export default function LocalSeedsList({
  phases,
  mutableLocalSeeds,
  setMutableLocalSeeds,
}: {
  phases: Phase[];
  mutableLocalSeeds: Entrant[];
  setMutableLocalSeeds: Dispatch<SetStateAction<Entrant[]>>;
}) {
  const phaseAndFns = useMemo(
    () =>
      phases.map((phase) => ({
        phaseId: phase.id,
        phaseName: phase.name,
        fn: (index: number) => {
          setMutableLocalSeeds((oldMutableLocalSeeds) => {
            const newMutableLocalSeeds = [...oldMutableLocalSeeds];
            const [removed] = newMutableLocalSeeds.splice(index, 1);
            newMutableLocalSeeds.splice(phase.seedNumOffset, 0, removed);
            return newMutableLocalSeeds;
          });
        },
      })),
    [phases, setMutableLocalSeeds],
  );
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        setMutableLocalSeeds((prevEntrants) => move(prevEntrants, event));
      }}
    >
      <List>
        {phases.map((phase) => (
          <>
            <ListSubheader>{phase.name}</ListSubheader>
            {mutableLocalSeeds
              .slice(
                phase.seedNumOffset,
                phase.seedNumOffset +
                  phase.pools.flatMap((pool) =>
                    pool.seeds.filter((seed) => seed.entrant),
                  ).length,
              )
              .map((entrant, i) => (
                <Sortable
                  key={entrant.id}
                  entrant={entrant}
                  index={i + phase.seedNumOffset}
                  phaseAndFns={phaseAndFns.filter(
                    (phaseAndFn) => phaseAndFn.phaseId !== phase.id,
                  )}
                />
              ))}
          </>
        ))}
      </List>
    </DragDropProvider>
  );
}
