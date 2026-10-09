import { contextBridge, ipcRenderer } from 'electron';
import {
  NewOriginPhaseLink,
  RendererDestPhaseLink,
  RendererEvent,
  RendererOriginPhaseLink,
  RendererPhase,
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
  putDestPhaseLinks: (
    phaseId: number,
    destPhaseLinks: RendererDestPhaseLink[],
  ): Promise<RendererPhase> =>
    ipcRenderer.invoke('putDestPhaseLinks', phaseId, destPhaseLinks),
  putOriginPhaseLinks: (
    phaseId: number,
    originPhaseLinks: (NewOriginPhaseLink | RendererOriginPhaseLink)[],
  ): Promise<RendererPhase> =>
    ipcRenderer.invoke('putOriginPhaseLinks', phaseId, originPhaseLinks),
  putNumProgressing: (
    phaseId: number,
    groupTypeId: number,
    numProgressing: number,
    winnersTargetPhaseId: number,
  ): Promise<RendererPhase> =>
    ipcRenderer.invoke(
      'putNumProgressing',
      phaseId,
      groupTypeId,
      numProgressing,
      winnersTargetPhaseId,
    ),
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
