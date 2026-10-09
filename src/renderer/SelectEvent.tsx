import { useCallback, useState } from 'react';
import { List, ListItemButton, ListItemText } from '@mui/material';
import { RendererEvent, SelectableEvent } from '../common/types';

export default function SelectEvent({
  events,
  setEvent,
  openError,
}: {
  events: SelectableEvent[];
  setEvent: (event: RendererEvent) => void;
  openError: (message: string) => void;
}) {
  const [getting, setGetting] = useState(false);
  const getEvent = useCallback(
    async (event: SelectableEvent) => {
      try {
        setGetting(true);
        setEvent(await window.electron.getEvent(event));
      } catch (e: unknown) {
        if (e instanceof Error) {
          openError(e.message);
        }
      } finally {
        setGetting(false);
      }
    },
    [openError, setEvent],
  );

  return (
    <List disablePadding>
      {events.map((event) => (
        <ListItemButton
          disableGutters
          disabled={getting}
          key={event.id}
          style={{ paddingLeft: '8px', paddingRight: '8px' }}
          onClick={() => {
            getEvent(event);
          }}
        >
          <ListItemText>{event.name}</ListItemText>
        </ListItemButton>
      ))}
    </List>
  );
}
