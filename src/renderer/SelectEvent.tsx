import { List, ListItemButton, ListItemText } from '@mui/material';
import { SelectableEvent } from '../common/types';

export default function SelectEvent({
  events,
  getEvent,
}: {
  events: SelectableEvent[];
  getEvent: (selectableEvent: SelectableEvent) => Promise<void>;
}) {
  return (
    <List disablePadding>
      {events.map((event) => (
        <ListItemButton
          disableGutters
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
