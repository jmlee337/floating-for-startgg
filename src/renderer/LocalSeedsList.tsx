import { Entrant, Phase } from '../common/types';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import { Dispatch, SetStateAction } from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Typography,
} from '@mui/material';
import { DragIndicator } from '@mui/icons-material';

function Sortable({ entrant, index }: { entrant: Entrant; index: number }) {
  const { ref, handleRef } = useSortable({
    id: entrant.id,
    index,
  });

  return (
    <ListItem disablePadding ref={ref} style={{ gap: '8px' }}>
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
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        setMutableLocalSeeds((prevEntrants) => move(prevEntrants, event));
      }}
    >
      <List>
        {phases.map((phase) => (
          <>
            <ListSubheader key={phase.id}>{phase.name}</ListSubheader>
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
                />
              ))}
          </>
        ))}
      </List>
    </DragDropProvider>
  );
}
