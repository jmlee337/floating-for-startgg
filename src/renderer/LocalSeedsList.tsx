import { Entrant, Phase, Player } from '../common/types';
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
  Tooltip,
  Typography,
} from '@mui/material';
import { DragIndicator, EmojiEvents } from '@mui/icons-material';

function PlayerWithRankings({ player }: { player: Player }) {
  return (
    <>
      {player.gamerTag}
      {player.rankings
        .sort((a, b) => {
          if (a.locationType === b.locationType) {
            return a.seriesCreatedAt - b.seriesCreatedAt;
          }
          return a.locationType - b.locationType;
        })
        .map((ranking) => (
          <Stack
            key={ranking.id}
            direction="row"
            style={{ alignItems: 'center', marginLeft: '8px', gap: '4px' }}
          >
            <Tooltip title={`${ranking.seriesName}: ${ranking.iterationTitle}`}>
              {ranking.iconUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <img src={ranking.iconUrl} height="20px" width="20px" />
              ) : (
                <EmojiEvents fontSize="small" />
              )}
            </Tooltip>
            {ranking.rank}
          </Stack>
        ))}
    </>
  );
}

function Sortable({
  entrant,
  index,
  phaseOrder,
  phaseAndFns,
}: {
  entrant: Entrant;
  index: number;
  phaseOrder: number;
  phaseAndFns: {
    phaseId: number;
    phaseName: string;
    phaseOrder: number;
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
      sx={
        index % 2 === 1
          ? {
              backgroundColor: (theme) => theme.palette.action.hover,
            }
          : undefined
      }
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
          <Typography
            variant="caption"
            style={{ display: 'flex', flexDirection: 'row' }}
          >
            {index + 1}:{' '}
            {entrant.players.map((player) => (
              <PlayerWithRankings key={player.id} player={player} />
            ))}
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
            {phaseOrder < phaseAndFn.phaseOrder ? '↑' : '↓'}{' '}
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
        phaseOrder: phase.phaseOrder,
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
                  phaseOrder={phase.phaseOrder}
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
