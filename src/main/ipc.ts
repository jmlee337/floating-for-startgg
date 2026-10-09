import { app, ipcMain, safeStorage, shell } from 'electron';
import Store from 'electron-store';
import {
  SelectableEvent,
  RendererTournament,
  RendererEvent,
  RendererPhase,
  NewOriginPhaseLink,
  RendererDestPhaseLink,
  RendererOriginPhaseLink,
} from '../common/types';

function toDestOriginRendererPhaseLinks(
  jsonPhaseLinks: any[],
  phaseId: number,
) {
  return {
    originPhaseLinks: jsonPhaseLinks
      .filter((jsonPhaseLink) => jsonPhaseLink.originPhaseId === phaseId)
      .map((jsonPhaseLink): RendererOriginPhaseLink => ({
        id: jsonPhaseLink.id,
        numSeeds: jsonPhaseLink.numSeeds,
        destPhaseId: jsonPhaseLink.destPhaseId,
        maintainMatchup: jsonPhaseLink.maintainMatchup,
        isDefault: jsonPhaseLink.isDefault,
        type: jsonPhaseLink.type,
        destSeedOrder: jsonPhaseLink.destSeedOrder,
        destBracketSide: jsonPhaseLink.destBracketSide,
        originPlacement: jsonPhaseLink.originPlacement,
        originPhaseId: jsonPhaseLink.originPhaseId,
        originLosses: jsonPhaseLink.originLosses,
      })),
    destPhaseLinks: jsonPhaseLinks
      .filter((jsonPhaseLink) => jsonPhaseLink.destPhaseId === phaseId)
      .map((jsonPhaseLink): RendererDestPhaseLink => ({
        id: jsonPhaseLink.id,
        numSeeds: jsonPhaseLink.numSeeds,
        destPhaseId: jsonPhaseLink.destPhaseId,
        maintainMatchup: jsonPhaseLink.maintainMatchup,
        isDefault: jsonPhaseLink.isDefault,
        type: jsonPhaseLink.type,
        destSeedOrder: jsonPhaseLink.destSeedOrder,
        destBracketSide: jsonPhaseLink.destBracketSide,
        originPlacement: jsonPhaseLink.originPlacement,
        originPhaseId: jsonPhaseLink.originPhaseId,
        originLosses: jsonPhaseLink.originLosses,
      }))
      .sort((a, b) => a.destSeedOrder - b.destSeedOrder),
  };
}

export default async function setupIPCs() {
  const store = new Store<{
    base64EncryptedPassword: string;
    email: string;
    cookies: string[];
  }>();

  ipcMain.removeHandler('getAppVersion');
  ipcMain.handle('getAppVersion', app.getVersion);

  ipcMain.removeAllListeners('getVersionLatest');
  ipcMain.handle('getVersionLatest', async () => {
    try {
      const response = await fetch(
        'https://api.github.com/repos/jmlee337/losers-progressions-for-startgg/releases/latest',
      );
      const json = await response.json();
      const latestVersion = json.tag_name;
      if (typeof latestVersion !== 'string') {
        return '';
      }
      return latestVersion;
    } catch {
      return '';
    }
  });

  ipcMain.removeAllListeners('update');
  ipcMain.handle('update', async () => {
    await shell.openExternal(
      'https://github.com/jmlee337/losers-progressions-for-startgg/releases/latest',
    );
    app.quit();
  });

  ipcMain.removeAllListeners('getEmail');
  ipcMain.handle('getEmail', () => {
    return store.get('email', '');
  });

  ipcMain.removeAllListeners('getPassword');
  ipcMain.handle('getPassword', () => {
    if (!safeStorage.isEncryptionAvailable()) {
      return '';
    }

    const base64EncryptedPassword = store.get('base64EncryptedPassword', '');
    if (base64EncryptedPassword === '') {
      return '';
    }

    try {
      return safeStorage.decryptString(
        Buffer.from(base64EncryptedPassword, 'base64'),
      );
    } catch {
      return '';
    }
  });

  const cookieMap = new Map<string, string>();
  store.get('cookies', []).forEach((cookie) => {
    const keyAndValue = cookie.split('=');
    if (keyAndValue.length === 2) {
      cookieMap.set(keyAndValue[0], keyAndValue[1]);
    }
  });
  const getCookies = () => {
    console.log(cookieMap);
    if (cookieMap.size === 0) {
      return '';
    }

    return Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join(';');
  };
  const setCookies = (setCookie: string[]) => {
    setCookie.forEach((cookie) => {
      const parts = cookie.split(';');
      if (parts.length > 0) {
        const keyAndValue = parts[0].split('=');
        if (keyAndValue.length === 2) {
          cookieMap.set(keyAndValue[0], keyAndValue[1]);
        }
      }
    });
    store.set(
      'cookies',
      Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`),
    );
  };
  const fetchWithCookie = async (
    url: string,
    method: string,
    body: string | undefined = undefined,
  ) => {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'client-version': '20',
        Cookie: getCookies(),
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    try {
      const json = JSON.parse(text);
      const setCookie = response.headers.getSetCookie();
      console.log(`Set-Cookie: ${JSON.stringify(setCookie)}`);
      setCookies(setCookie);
      return json;
    } catch (e: unknown) {
      throw new Error(text, { cause: e });
    }
  };

  ipcMain.removeAllListeners('isLoggedIn');
  ipcMain.handle('isLoggedIn', async () => {
    if (!cookieMap.has('gg_session')) {
      return false;
    }

    const response = await fetch(
      'https://www.start.gg/api/-/rest/user/current_user',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'client-version': '20',
          Cookie: getCookies(),
        },
      },
    );

    if (response.status === 403) {
      return false;
    }
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    const setCookie = response.headers.getSetCookie();
    console.log(`Set-Cookie: ${JSON.stringify(setCookie)}`);
    setCookies(setCookie);
    return true;
  });

  ipcMain.removeAllListeners('login');
  ipcMain.handle('login', async (event, email: string, password: string) => {
    const response = await fetch('https://www.start.gg/api/-/rest/user/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-version': '20',
      },
      body: JSON.stringify({
        email,
        password,
        rememberMe: true,
        validationKey: 'LOGIN_userLogin',
      }),
    });

    if (response.status === 400) {
      throw new Error('Password incorrect');
    }
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    store.set('email', email);
    if (safeStorage.isEncryptionAvailable()) {
      try {
        store.set(
          'base64EncryptedPassword',
          safeStorage.encryptString(password).toString('base64'),
        );
      } catch {
        // best effort, just catch
      }
    }

    const setCookie = response.headers.getSetCookie();
    console.log(`Set-Cookie: ${JSON.stringify(setCookie)}`);
    setCookies(setCookie);
  });

  ipcMain.removeAllListeners('logout');
  ipcMain.handle('logout', async () => {
    await fetchWithCookie('https://www.start.gg/api/-/rest/user/logout', 'GET');
    cookieMap.clear();
    store.set('cookies', []);
  });

  ipcMain.removeAllListeners('getTournaments');
  ipcMain.handle('getTournaments', async () => {
    const json = await fetchWithCookie(
      'https://www.start.gg/api/-/rest/tournaments?page=1&per_page=25&filter={%22isTournamentAdmin%22:true}',
      'GET',
    );
    const tournamentsJson = json.items?.entities?.tournament;
    if (!Array.isArray(tournamentsJson)) {
      return [];
    }

    return tournamentsJson.map((tournament) => ({
      name: tournament.name,
      slug: tournament.slug.slice(11),
    }));
  });

  ipcMain.removeAllListeners('getTournament');
  ipcMain.handle(
    'getTournament',
    async (event, slug: string): Promise<RendererTournament> => {
      const json = await fetchWithCookie(
        `https://www.start.gg/api/-/rest/tournament/${slug}?expand[]=event&expand[]=phase`,
        'GET',
      );
      const tournamentJson = json.entities?.tournament;
      if (!(tournamentJson instanceof Object)) {
        throw new Error('no tournament in response');
      }

      const eventIdToPhases = new Map<
        number,
        { id: number; state: number }[]
      >();
      const phasesJson = json.entities?.phase;
      if (Array.isArray(phasesJson)) {
        phasesJson.forEach((phaseJson) => {
          let phases = eventIdToPhases.get(phaseJson.eventId);
          if (!phases) {
            phases = [];
            eventIdToPhases.set(phaseJson.eventId, phases);
          }
          phases.push({ id: phaseJson.id, state: phaseJson.state });
        });
      }

      const events: SelectableEvent[] = [];
      const eventsJson = json.entities?.event;
      if (Array.isArray(eventsJson)) {
        eventsJson.forEach((eventJson) => {
          const { id } = eventJson;
          const phases = eventIdToPhases.get(id);
          if (
            phases &&
            phases.length > 1 &&
            phases.some((phase) => phase.state === 1)
          ) {
            events.push({
              id,
              phaseIds: phases.map((phase) => phase.id),
              name: eventJson.name,
            });
          }
        });
      }

      return {
        name: tournamentJson.name,
        slug: tournamentJson.slug.slice(11),
        events,
      };
    },
  );

  ipcMain.removeAllListeners('getEvent');
  ipcMain.handle(
    'getEvent',
    async (ev, event: SelectableEvent): Promise<RendererEvent> => {
      const phases: RendererPhase[] = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const phaseId of event.phaseIds) {
        // eslint-disable-next-line no-await-in-loop
        const json = await fetchWithCookie(
          `https://www.start.gg/api/-/rest/phase/${phaseId}?expand[]=bracketSetup&expand[]=phaseLink`,
          'GET',
        );
        const jsonPhase = json.entities?.phase;
        if (!(jsonPhase instanceof Object)) {
          throw new Error('no tournament in response');
        }

        const { id } = jsonPhase;
        let destPhaseLinks: RendererDestPhaseLink[] = [];
        let originPhaseLinks: RendererOriginPhaseLink[] = [];
        const jsonPhaseLinks = json.entities?.phaseLink;
        if (Array.isArray(jsonPhaseLinks)) {
          ({ destPhaseLinks, originPhaseLinks } =
            toDestOriginRendererPhaseLinks(jsonPhaseLinks, id));
        }

        phases.push({
          id,
          destPhaseLinks,
          originPhaseLinks,
          name: jsonPhase.name,
          state: jsonPhase.state,
          bracketType: jsonPhase.bracketType,
          groupCount: jsonPhase.groupCount,
          numProgressing: jsonPhase.numProgressing ?? 0,
          winnersTargetPhaseId: jsonPhase.winnersTargetPhaseId,
        });
      }
      return {
        ...event,
        phases,
      };
    },
  );

  ipcMain.removeAllListeners('putDestPhaseLinks');
  ipcMain.handle(
    'putDestPhaseLinks',
    async (
      event,
      phaseId: number,
      destPhaseLinksIn: RendererDestPhaseLink[],
    ): Promise<RendererPhase> => {
      const json = await fetchWithCookie(
        `https://www.start.gg/api/-/rest/phase/${phaseId}`,
        'PUT',
        JSON.stringify({
          destPhaseLinks: destPhaseLinksIn,
        }),
      );
      if (!Array.isArray(json.entities?.phase)) {
        throw new Error('no phase array');
      }

      const jsonPhase = (json.entities.phase as any[]).find(
        (phase) => phase.id === phaseId,
      );
      if (jsonPhase === undefined) {
        throw new Error('no updated phase');
      }

      const jsonPhaseLinks = json.entities?.phaseLink;
      if (!Array.isArray(jsonPhaseLinks)) {
        throw new Error('no phaseLink array');
      }

      const { destPhaseLinks, originPhaseLinks } =
        toDestOriginRendererPhaseLinks(jsonPhaseLinks, phaseId);
      return {
        id: phaseId,
        name: jsonPhase.name,
        state: jsonPhase.state,
        bracketType: jsonPhase.bracketType,
        groupCount: jsonPhase.groupCount,
        destPhaseLinks,
        originPhaseLinks,
        numProgressing: jsonPhase.numProgressing ?? 0,
        winnersTargetPhaseId: jsonPhase.winnersTargetPhaseId,
      };
    },
  );

  ipcMain.removeAllListeners('putOriginPhaseLinks');
  ipcMain.handle(
    'putOriginPhaseLinks',
    async (
      event,
      phaseId: number,
      originPhaseLinksIn: (NewOriginPhaseLink | RendererOriginPhaseLink)[],
    ): Promise<RendererPhase> => {
      const json = await fetchWithCookie(
        `https://www.start.gg/api/-/rest/phase/${phaseId}`,
        'PUT',
        JSON.stringify({
          originPhaseLinks: originPhaseLinksIn,
        }),
      );
      if (!Array.isArray(json.entities?.phase)) {
        throw new Error('no phase array');
      }

      const jsonPhase = (json.entities.phase as any[]).find(
        (phase) => phase.id === phaseId,
      );
      if (jsonPhase === undefined) {
        throw new Error('no updated phase');
      }

      const jsonPhaseLinks = json.entities?.phaseLink;
      if (!Array.isArray(jsonPhaseLinks)) {
        throw new Error('no phaseLink array');
      }

      const { destPhaseLinks, originPhaseLinks } =
        toDestOriginRendererPhaseLinks(jsonPhaseLinks, phaseId);
      return {
        id: phaseId,
        name: jsonPhase.name,
        state: jsonPhase.state,
        bracketType: jsonPhase.bracketType,
        groupCount: jsonPhase.groupCount,
        destPhaseLinks,
        originPhaseLinks,
        numProgressing: jsonPhase.numProgressing ?? 0,
        winnersTargetPhaseId: jsonPhase.winnersTargetPhaseId,
      };
    },
  );

  ipcMain.removeAllListeners('putNumProgressing');
  ipcMain.handle(
    'putNumProgressing',
    async (
      event,
      phaseId: number,
      groupTypeId: number,
      numProgressing: number,
      winnersTargetPhaseId: number,
    ): Promise<RendererPhase> => {
      const json = await fetchWithCookie(
        `https://www.start.gg/api/-/rest/phase/${phaseId}`,
        'PUT',
        JSON.stringify({
          groupTypeId,
          numProgressing: numProgressing.toString(10),
          winnersTargetPhaseId:
            winnersTargetPhaseId === 0 ? undefined : winnersTargetPhaseId,
        }),
      );
      if (!Array.isArray(json.entities?.phase)) {
        throw new Error('no phase array');
      }

      const jsonPhase = (json.entities.phase as any[]).find(
        (phase) => phase.id === phaseId,
      );
      if (jsonPhase === undefined) {
        throw new Error('no updated phase');
      }

      const jsonPhaseLinks = json.entities?.phaseLink;
      if (!Array.isArray(jsonPhaseLinks)) {
        throw new Error('no phaseLink array');
      }

      const { destPhaseLinks, originPhaseLinks } =
        toDestOriginRendererPhaseLinks(jsonPhaseLinks, phaseId);
      return {
        id: phaseId,
        name: jsonPhase.name,
        state: jsonPhase.state,
        bracketType: jsonPhase.bracketType,
        groupCount: jsonPhase.groupCount,
        destPhaseLinks,
        originPhaseLinks,
        numProgressing: jsonPhase.numProgressing ?? 0,
        winnersTargetPhaseId: jsonPhase.winnersTargetPhaseId,
      };
    },
  );
}
