import { Entrant, Phase, Player } from '../common/types';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import { Dispatch, SetStateAction, useMemo } from 'react';
import {
  Button,
  Link,
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

function PlayerWithRankings({
  player,
  missing,
}: {
  player: Player;
  missing: boolean;
}) {
  return (
    <>
      {player.url ? (
        <Link
          href={player.url}
          target="_blank"
          sx={{
            color: (theme) =>
              missing
                ? theme.palette.error.contrastText
                : theme.palette.primary.main,
            textDecorationColor: (theme) =>
              missing
                ? `alpha(from ${theme.palette.error.contrastText} / 0.4)`
                : 'var(--Link-underlineColor)',
          }}
        >
          {player.gamerTag}
        </Link>
      ) : (
        player.gamerTag
      )}

      {player.rankings
        .sort((a, b) => {
          if (a.locationType === b.locationType) {
            return a.seriesId - b.seriesId;
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
  idToRawEntrant,
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
  idToRawEntrant: Map<number, Entrant>;
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
      sx={{
        backgroundColor: (theme) => {
          if (!idToRawEntrant.has(entrant.id)) {
            return theme.palette.error.light;
          }
          if (index % 2 === 1) {
            return theme.palette.action.hover;
          }
          return 'initial';
        },
      }}
    >
      <Stack direction="row" style={{ gap: '8px', alignItems: 'center' }}>
        <ListItemButton
          component="button"
          ref={handleRef}
          style={{ flexGrow: 0, padding: '4px', cursor: 'grab' }}
        >
          <ListItemIcon style={{ minWidth: '20px' }}>
            <DragIndicator fontSize="small" />
          </ListItemIcon>
        </ListItemButton>
        <ListItemText disableTypography style={{ margin: 0 }}>
          <Typography
            variant="caption"
            style={{
              display: 'flex',
              flexDirection: 'row',
            }}
            sx={{
              color: (theme) =>
                idToRawEntrant.has(entrant.id)
                  ? 'initial'
                  : theme.palette.error.contrastText,
            }}
          >
            {index + 1}:&nbsp;
            {entrant.players.map((player) => (
              <PlayerWithRankings
                key={player.id}
                player={player}
                missing={!idToRawEntrant.has(entrant.id)}
              />
            ))}
          </Typography>
        </ListItemText>
      </Stack>
      <Stack direction="row" style={{ gap: '8px' }}>
        {phaseAndFns.map((phaseAndFn) => (
          <Button
            key={phaseAndFn.phaseId}
            size="small"
            sx={{
              color: (theme) =>
                idToRawEntrant.has(entrant.id)
                  ? theme.palette.primary.main
                  : theme.palette.error.contrastText,
            }}
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
  idToRawEntrant,
}: {
  phases: Phase[];
  mutableLocalSeeds: Entrant[];
  setMutableLocalSeeds: Dispatch<SetStateAction<Entrant[]>>;
  idToRawEntrant: Map<number, Entrant>;
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
      <List disablePadding>
        {phases.map((phase) => (
          <>
            <ListSubheader disableGutters key={phase.id}>
              {phase.name}
            </ListSubheader>
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
                  idToRawEntrant={idToRawEntrant}
                />
              ))}
          </>
        ))}
      </List>
    </DragDropProvider>
  );
}
