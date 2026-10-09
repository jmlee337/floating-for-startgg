import {
  Alert,
  AppBar,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBack,
  CloudDownload,
  Refresh,
  Settings,
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { lt } from 'semver';
import {
  RendererEvent,
  RendererTournament,
  SelectableTournament,
} from '../common/types';
import SelectTournament from './SelectTournament';
import SelectEvent from './SelectEvent';
import SelectedEvent from './SelectedEvent';

function Hello() {
  const [appVersion, setAppVersion] = useState('');
  const [versionLatest, setVersionLatest] = useState('');

  const [settled, setSettled] = useState(false);

  const [error, setError] = useState('');
  const [errorOpen, setErrorOpen] = useState(false);
  const openError = useCallback((message: string) => {
    setError(message);
    setErrorOpen(true);
  }, []);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [gettingTournaments, setGettingTournaments] = useState(false);
  const [tournaments, setTournaments] = useState<SelectableTournament[]>([]);
  const [gettingTournament, setGettingTournament] = useState(false);
  const [selectedTournament, setSelectedTournament] =
    useState<RendererTournament | null>(null);
  const [gettingEvent, setGettingEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<RendererEvent | null>(
    null,
  );

  const title = useMemo(() => {
    if (!isLoggedIn) {
      return 'Login';
    }
    if (!selectedTournament) {
      return 'Select Tournament';
    }
    if (!selectedEvent) {
      return 'Select Event';
    }
    return 'Edit Progressions!';
  }, [isLoggedIn, selectedEvent, selectedTournament]);

  const getTournaments = useCallback(async () => {
    try {
      setGettingTournaments(true);
      setTournaments(await window.electron.getTournaments());
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
        setErrorOpen(true);
      }
    } finally {
      setGettingTournaments(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const appVersionPromise = window.electron.getAppVersion();
        const versionLatestPromise = window.electron.getVersionLatest();
        const isLoggedInPromise = window.electron.isLoggedIn();
        const initAppVersion = await appVersionPromise;
        const initVersionLatest = await versionLatestPromise;
        setAppVersion(initAppVersion);
        setVersionLatest(initVersionLatest);
        if (initVersionLatest && lt(initAppVersion, initVersionLatest)) {
          setSettingsOpen(true);
        }
        const initIsLoggedIn = await isLoggedInPromise;
        setIsLoggedIn(initIsLoggedIn);
        if (initIsLoggedIn) {
          await getTournaments();
        } else {
          setEmail(await window.electron.getEmail());
          setPassword(await window.electron.getPassword());
        }
      } catch (e: unknown) {
        if (e instanceof Error) {
          setError(e.message);
          setErrorOpen(true);
        }
      } finally {
        setSettled(true);
      }
    })();
  }, [getTournaments]);
  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          backgroundColor: (theme) => theme.palette.common.white,
          color: (theme) => theme.palette.text.primary,
        }}
      >
        <Toolbar disableGutters style={{ paddingLeft: '8px' }}>
          <Stack
            direction="row"
            style={{
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <Typography
              variant="body1"
              sx={{ color: (theme) => theme.palette.text.disabled }}
              style={{
                flexGrow: 1,
                flexShrink: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </Typography>
            <Tooltip placement="left" title="Settings">
              <IconButton
                onClick={() => {
                  setSettingsOpen(true);
                }}
              >
                <Settings />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>
      <Toolbar />
      <Stack style={{ margin: '0 -8px 8px -8px' }}>
        {settled && (
          <>
            {isLoggedIn && (
              <>
                {selectedTournament && (
                  <>
                    <Stack direction="row" style={{ alignItems: 'center' }}>
                      <ListItemButton
                        style={{ paddingLeft: '8px', paddingRight: '8px' }}
                        onClick={() => {
                          setSelectedTournament(null);
                          setSelectedEvent(null);
                        }}
                      >
                        <ListItemIcon>
                          <ArrowBack />
                        </ListItemIcon>
                        <ListItemText>{selectedTournament.name}</ListItemText>
                      </ListItemButton>
                      <Tooltip title="Refresh" placement="left">
                        <span>
                          <IconButton
                            disabled={gettingTournament}
                            onClick={async () => {
                              try {
                                setGettingTournament(true);
                                setSelectedTournament(
                                  await window.electron.getTournament(
                                    selectedTournament.slug,
                                  ),
                                );
                              } catch (e: unknown) {
                                if (e instanceof Error) {
                                  openError(e.message);
                                }
                              } finally {
                                setGettingTournament(false);
                              }
                            }}
                          >
                            {gettingTournament ? (
                              <CircularProgress size="24px" />
                            ) : (
                              <Refresh />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                    {selectedEvent && (
                      <>
                        <Stack direction="row" style={{ alignItems: 'center' }}>
                          <ListItemButton
                            style={{ paddingLeft: '8px', paddingRight: '8px' }}
                            onClick={() => {
                              setSelectedEvent(null);
                            }}
                          >
                            <ListItemIcon>
                              <ArrowBack />
                            </ListItemIcon>
                            <ListItemText>{selectedEvent.name}</ListItemText>
                          </ListItemButton>
                          <Tooltip title="Refresh" placement="left">
                            <span>
                              <IconButton
                                disabled={gettingEvent}
                                onClick={async () => {
                                  try {
                                    setGettingEvent(true);
                                    setSelectedEvent(
                                      await window.electron.getEvent(
                                        selectedEvent,
                                      ),
                                    );
                                  } catch (e: unknown) {
                                    if (e instanceof Error) {
                                      openError(e.message);
                                    }
                                  } finally {
                                    setGettingEvent(false);
                                  }
                                }}
                              >
                                {gettingEvent ? (
                                  <CircularProgress size="24px" />
                                ) : (
                                  <Refresh />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                        {selectedEvent.phases.length > 0 && (
                          <SelectedEvent
                            event={selectedEvent}
                            openError={openError}
                            refresh={async () => {
                              try {
                                setGettingEvent(true);
                                setSelectedEvent(
                                  await window.electron.getEvent(selectedEvent),
                                );
                              } catch (e: unknown) {
                                if (e instanceof Error) {
                                  openError(e.message);
                                }
                              } finally {
                                setGettingEvent(false);
                              }
                            }}
                          />
                        )}
                        {selectedEvent.phases.length === 0 && (
                          <Alert severity="warning">
                            No configurable phases
                          </Alert>
                        )}
                      </>
                    )}
                    {!selectedEvent && (
                      <>
                        {selectedTournament.events.length > 0 && (
                          <SelectEvent
                            events={selectedTournament.events}
                            setEvent={setSelectedEvent}
                            openError={openError}
                          />
                        )}
                        {selectedTournament.events.length === 0 && (
                          <Alert severity="warning">
                            No configurable events
                          </Alert>
                        )}
                      </>
                    )}
                  </>
                )}
                {!selectedTournament && (
                  <SelectTournament
                    gettingTournaments={gettingTournaments}
                    getTournaments={getTournaments}
                    tournaments={tournaments}
                    setTournament={setSelectedTournament}
                    openError={openError}
                  />
                )}
              </>
            )}
            {!isLoggedIn && (
              <Stack
                style={{ alignItems: 'start', marginLeft: '8px' }}
                spacing="8px"
              >
                <TextField
                  label="start.gg email"
                  size="small"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                  }}
                />
                <TextField
                  label="start.gg password"
                  size="small"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                  }}
                />
                <Button
                  disabled={loggingIn}
                  type="submit"
                  variant="contained"
                  onClick={async () => {
                    try {
                      setLoggingIn(true);
                      await window.electron.login(email, password);
                      setIsLoggedIn(true);
                      setTournaments(await window.electron.getTournaments());
                    } catch (e: unknown) {
                      if (e instanceof Error) {
                        setError(e.message);
                        setErrorOpen(true);
                      }
                    } finally {
                      setLoggingIn(false);
                    }
                  }}
                >
                  Login!
                </Button>
              </Stack>
            )}
          </>
        )}
        {!settled && <CircularProgress style={{ marginLeft: '8px' }} />}
      </Stack>
      <Dialog
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
        }}
      >
        <Stack
          direction="row"
          style={{
            alignItems: 'center',
            justifyContent: 'space-between',
            marginRight: '24px',
          }}
        >
          <DialogTitle>Settings</DialogTitle>
          <Typography variant="caption">
            Losers Progressions for start.gg v{appVersion}
          </Typography>
        </Stack>
        {appVersion && versionLatest && lt(appVersion, versionLatest) && (
          <DialogContent>
            <Alert
              severity="warning"
              style={{ marginTop: '8px' }}
              action={
                <Button
                  endIcon={<CloudDownload />}
                  variant="contained"
                  onClick={() => {
                    window.electron.update();
                  }}
                >
                  Quit and download
                </Button>
              }
            >
              Update available! v{versionLatest}
            </Alert>
          </DialogContent>
        )}
        {isLoggedIn && (
          <DialogActions>
            <Button
              color="warning"
              variant="contained"
              onClick={async () => {
                await window.electron.logout();
                setEmail(await window.electron.getEmail());
                setPassword(await window.electron.getPassword());
                setIsLoggedIn(false);
                setSettingsOpen(false);
              }}
            >
              Logout
            </Button>
          </DialogActions>
        )}
      </Dialog>
      <Dialog
        open={errorOpen}
        onClose={() => {
          setErrorOpen(false);
        }}
      >
        <DialogContent>
          <DialogContentText>{error}</DialogContentText>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
