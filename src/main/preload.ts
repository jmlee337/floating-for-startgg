import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  ConfiguredPhase,
  Entrant,
  RendererEvent,
  RendererTournament,
  SelectableEvent,
} from '../common/types';

export type Channels = 'ipc-example';

const electronHandler = {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('getAppVersion'),
  getVersionLatest: (): Promise<string> =>
    ipcRenderer.invoke('getVersionLatest'),
  update: (): Promise<void> => ipcRenderer.invoke('update'),
  getEmail: (): Promise<string> => ipcRenderer.invoke('getEmail'),
  getPassword: (): Promise<string> => ipcRenderer.invoke('getPassword'),
  isLoggedIn: (): Promise<boolean> => ipcRenderer.invoke('isLoggedIn'),
  login: (email: string, password: string): Promise<void> =>
    ipcRenderer.invoke('login', email, password),
  logout: (): Promise<void> => ipcRenderer.invoke('logout'),
  getTournaments: (): Promise<{ name: string; slug: string }[]> =>
    ipcRenderer.invoke('getTournaments'),
  getTournament: (slug: string): Promise<RendererTournament> =>
    ipcRenderer.invoke('getTournament', slug),
  getEvent: (event: SelectableEvent): Promise<RendererEvent> =>
    ipcRenderer.invoke('getEvent', event),
  upsertConfiguredPhase: (configuredPhase: ConfiguredPhase): Promise<void> =>
    ipcRenderer.invoke('upsertConfiguredPhase', configuredPhase),
  getConfiguredPhase: (phaseId: number): Promise<ConfiguredPhase> =>
    ipcRenderer.invoke('getConfiguredPhase', phaseId),
  reflow: (selectableEvent: SelectableEvent): Promise<RendererEvent> =>
    ipcRenderer.invoke('reflow', selectableEvent),
  uploadSeeds: (
    selectableEvent: SelectableEvent,
    entrants: Entrant[],
  ): Promise<RendererEvent> =>
    ipcRenderer.invoke('uploadSeeds', selectableEvent, entrants),
  updateLocalSeeds: (eventId: number, entrants: Entrant[]): Promise<void> =>
    ipcRenderer.invoke('updateLocalSeeds', eventId, entrants),
  getLocalSeeds: (eventId: number): Promise<Entrant[]> =>
    ipcRenderer.invoke('getLocalSeeds', eventId),
  openUserPage: (playerId: number, gamerTag: string): Promise<void> =>
    ipcRenderer.invoke('openUserPage', playerId, gamerTag),
  onMessage: (callback: (event: IpcRendererEvent, message: string) => void) => {
    ipcRenderer.removeAllListeners('message');
    ipcRenderer.on('message', callback);
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
