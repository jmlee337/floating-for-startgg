import { Entrant } from '../common/types';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import { Dispatch, SetStateAction, useRef, useState } from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { DragIndicator } from '@mui/icons-material';

function Sortable({ entrant, index }: { entrant: Entrant; index: number }) {
  const [element, setElement] = useState<Element | null>(null);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const { isDragging } = useSortable({
    id: entrant.id,
    index,
    element,
    handle: handleRef,
    data: entrant,
  });

  return (
    <ListItem
      disablePadding
      ref={setElement}
      data-shadow={isDragging || undefined}
      style={{ gap: '8px' }}
    >
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
  mutableLocalSeeds,
  setMutableLocalSeeds,
}: {
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
        {mutableLocalSeeds.map((entrant, i) => (
          <Sortable key={entrant.id} entrant={entrant} index={i} />
        ))}
      </List>
    </DragDropProvider>
  );
}
