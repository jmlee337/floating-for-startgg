import {
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FormEvent, useCallback, useState } from 'react';
import { Refresh } from '@mui/icons-material';
import { RendererTournament, SelectableTournament } from '../common/types';

export default function SelectTournament({
  gettingTournaments,
  getTournaments,
  tournaments,
  setTournament,
  openError,
}: {
  gettingTournaments: boolean;
  getTournaments: () => Promise<void>;
  tournaments: SelectableTournament[];
  setTournament: (tournament: RendererTournament) => void;
  openError: (message: string) => void;
}) {
  const [getting, setGetting] = useState(false);
  const getTournament = useCallback(
    async (slug: string) => {
      try {
        setGetting(true);
        setTournament(await window.electron.getTournament(slug));
      } catch (e: unknown) {
        if (e instanceof Error) {
          openError(e.message);
        }
      } finally {
        setGetting(false);
      }
    },
    [openError, setTournament],
  );

  return (
    <>
      <Stack
        direction="row"
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '48px',
        }}
      >
        <form
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '8px',
            paddingLeft: '8px',
            paddingRight: '8px',
          }}
          onSubmit={(ev: FormEvent<HTMLFormElement>) => {
            ev.preventDefault();
            ev.stopPropagation();

            const target = ev.target as typeof ev.target & {
              slug: { value: string };
            };
            const slug = target.slug.value;
            if (slug) {
              getTournament(slug);
            }
          }}
        >
          <TextField
            disabled={getting}
            label="tournament slug"
            name="slug"
            placeholder="out-of-the-blue-5"
            size="small"
          />
          <Button disabled={getting} type="submit" variant="contained">
            Fetch!
          </Button>
        </form>
        <Tooltip title="Refresh" placement="left">
          <span>
            <IconButton
              disabled={gettingTournaments}
              onClick={() => getTournaments()}
            >
              {gettingTournaments ? (
                <CircularProgress size="24px" />
              ) : (
                <Refresh />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <List disablePadding>
        {tournaments.map((tournament) => (
          <ListItemButton
            disableGutters
            disabled={getting}
            key={tournament.slug}
            style={{ paddingLeft: '8px', paddingRight: '8px' }}
            onClick={() => {
              getTournament(tournament.slug);
            }}
          >
            <ListItemText>
              {tournament.name}{' '}
              <Typography variant="caption">({tournament.slug})</Typography>
            </ListItemText>
          </ListItemButton>
        ))}
      </List>
    </>
  );
}
