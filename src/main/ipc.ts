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
  Entrant,
  Phase,
  Seed,
} from '../common/types';

type SeedPhase = Phase & {
  phaseOrder: number;
};

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

  ipcMain.removeHandler('getVersionLatest');
  ipcMain.handle('getVersionLatest', async () => {
    try {
      const response = await fetch(
        'https://api.github.com/repos/jmlee337/floating-for-startgg/releases/latest',
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

  ipcMain.removeHandler('update');
  ipcMain.handle('update', async () => {
    await shell.openExternal(
      'https://github.com/jmlee337/floating-for-startgg/releases/latest',
    );
    app.quit();
  });

  ipcMain.removeHandler('getEmail');
  ipcMain.handle('getEmail', () => {
    return store.get('email', '');
  });

  ipcMain.removeHandler('getPassword');
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

  ipcMain.removeHandler('isLoggedIn');
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

  ipcMain.removeHandler('login');
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

  ipcMain.removeHandler('logout');
  ipcMain.handle('logout', async () => {
    await fetchWithCookie('https://www.start.gg/api/-/rest/user/logout', 'GET');
    cookieMap.clear();
    store.set('cookies', []);
  });

  ipcMain.removeHandler('getTournaments');
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

  const eventIdToPhases = new Map<
    number,
    { id: number; name: string; phaseOrder: number }[]
  >();
  ipcMain.removeHandler('getTournament');
  ipcMain.handle(
    'getTournament',
    async (event, slug: string): Promise<RendererTournament> => {
      eventIdToPhases.clear();

      const json = await fetchWithCookie(
        `https://www.start.gg/api/-/rest/tournament/${slug}?expand[]=event&expand[]=phase`,
        'GET',
      );
      const tournamentJson = json.entities?.tournament;
      if (!(tournamentJson instanceof Object)) {
        throw new Error('no tournament in response');
      }

      const phaseIdToEventId = new Map<number, number>();
      const phasesJson = json.entities?.phase;
      if (Array.isArray(phasesJson)) {
        phasesJson.forEach((phaseJson) => {
          phaseIdToEventId.set(phaseJson.id, phaseJson.eventId);
          let phases = eventIdToPhases.get(phaseJson.eventId);
          if (!phases) {
            phases = [];
            eventIdToPhases.set(phaseJson.eventId, phases);
          }
          phases.push({
            id: phaseJson.id,
            name: phaseJson.name,
            phaseOrder: phaseJson.phaseOrder,
          });
        });
      }

      const events: SelectableEvent[] = [];
      const eventsJson = json.entities?.event;
      if (Array.isArray(eventsJson)) {
        eventsJson.forEach((eventJson) => {
          if (eventJson.state === 1) {
            const { id } = eventJson;
            const phases = eventIdToPhases.get(id);
            if (phases && phases.length > 1) {
              events.push({
                id,
                name: eventJson.name,
              });
            }
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

  ipcMain.removeHandler('getEvent');
  ipcMain.handle(
    'getEvent',
    async (ev, event: SelectableEvent): Promise<RendererEvent> => {
      const phases = eventIdToPhases.get(event.id);
      if (!phases) {
        throw new Error(`no phases foudn for event ${event.id}`);
      }

      const eventJson = await fetchWithCookie(
        `https://www.start.gg/api/-/rest/event/${event.id}?expand[]=entrants&mutations[]=playerData`,
        'GET',
      );
      const jsonEntrants = eventJson.entities?.entrants;
      if (!Array.isArray(jsonEntrants)) {
        throw new Error('no entrants in response');
      }

      const idToEntrant = new Map<number, Entrant>();
      jsonEntrants.forEach((entrant) => {
        const id = entrant.id;
        if (!Number.isInteger(id)) {
          return;
        }
        const participantIds = entrant.participantIds;
        if (!Array.isArray(participantIds)) {
          return;
        }
        const playerIds = entrant.playerIds;
        if (!(playerIds instanceof Object)) {
          return;
        }
        const players = entrant.mutations.players;
        if (!(players instanceof Object)) {
          return;
        }

        const entrantPlayers = participantIds.map((participantId) => {
          const playerId = entrant.playerIds[participantId];
          if (!playerId) {
            throw new Error(
              `no playerId for participant ${participantId} in entrant ${id}`,
            );
          }
          const player = players[playerId];
          if (player === undefined) {
            throw new Error(`player ${playerId} not found in entrant ${id}`);
          }

          return { id: playerId, gamerTag: player.gamerTag };
        });
        idToEntrant.set(id, { id, players: entrantPlayers });
      });

      const seedPhases: SeedPhase[] = [];
      for (const phase of phases) {
        const phaseJson = await fetchWithCookie(
          `https://www.start.gg/api/-/rest/phase/${phase.id}?expand[]=seeding`,
          'GET',
        );

        const idToPool = new Map<
          number,
          { id: number; name: string; seeds: Seed[] }
        >();
        const jsonGroups = phaseJson.entities?.groups;
        if (Array.isArray(jsonGroups)) {
          jsonGroups.forEach((jsonGroup) => {
            idToPool.set(jsonGroup.id, {
              id: jsonGroup.id,
              name: jsonGroup.displayIdentifier,
              seeds: [],
            });
          });
        }

        const jsonSeeds = phaseJson.entities?.seeds;
        if (Array.isArray(jsonSeeds)) {
          jsonSeeds.forEach((jsonSeed) => {
            const id = jsonSeed.id;
            if (!Number.isInteger(id)) {
              throw new Error('no id found for seed');
            }
            const seedNum = jsonSeed.seedNum;
            if (!Number.isInteger(seedNum)) {
              throw new Error(`no seedNum found for seed ${id}`);
            }
            const phaseGroupId = jsonSeed.phaseGroupId;
            if (!Number.isInteger(phaseGroupId)) {
              throw new Error(`no phaseGroupId found for seed ${id}`);
            }

            const getEntrant = () => {
              const entrantId = jsonSeed.entrantId;
              if (Number.isInteger(entrantId)) {
                const entrant = idToEntrant.get(entrantId);
                if (!entrant) {
                  throw new Error(
                    `no entrant found for ${entrantId} in seed ${id} (phase ${phase.id})`,
                  );
                }
                return { entrant, projected: false };
              }

              const projectedEntrantId = jsonSeed.projectedEntrantId;
              if (Number.isInteger(projectedEntrantId)) {
                const entrant = idToEntrant.get(projectedEntrantId);
                if (!entrant) {
                  throw new Error(
                    `no projected entrant found for ${projectedEntrantId} in seed ${id} (phase ${phase.id})`,
                  );
                }
                return { entrant, projected: true };
              }

              throw new Error(
                `no entrant or projected entrant found in seed ${id}`,
              );
            };
            const { entrant, projected } = getEntrant();

            const pool = idToPool.get(phaseGroupId);
            if (!pool) {
              throw new Error(
                `pool ${phaseGroupId} not found for seed ${id} (phase ${phase.id})`,
              );
            }
            pool.seeds.push({ id, seedNum, entrant, projected });
          });
        }

        const pools = Array.from(idToPool.values());
        pools.forEach((pool) => {
          pool.seeds.sort((a, b) => a.seedNum - b.seedNum);
        });
        pools.sort((a, b) => {
          if (a.seeds.length === 0 && b.seeds.length === 0) {
            return 0;
          }
          if (a.seeds.length === 0 && b.seeds.length > 0) {
            return 1;
          }
          if (a.seeds.length > 0 && b.seeds.length === 0) {
            return -1;
          }
          // a.seeds.length > 0 && b.seeds.length > 0
          return a.seeds[0].seedNum - b.seeds[0].seedNum;
        });
        seedPhases.push({
          id: phase.id,
          name: phase.name,
          pools,
          phaseOrder: phase.phaseOrder,
        });
      }
      seedPhases.sort((a, b) => b.phaseOrder - a.phaseOrder);

      const raw: Entrant[] = [];
      seedPhases.forEach((phase) => {
        const phaseSeeds = phase.pools.flatMap((pool) =>
          pool.seeds.filter((seed) => !seed.projected),
        );
        phaseSeeds.sort((a, b) => a.seedNum - b.seedNum);
        raw.push(...phaseSeeds.map((seed) => seed.entrant));
      });
      return {
        ...event,
        seeds: {
          phases: seedPhases,
          raw,
        },
      };
    },
  );

  ipcMain.removeHandler('putDestPhaseLinks');
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

  ipcMain.removeHandler('putOriginPhaseLinks');
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

  ipcMain.removeHandler('putNumProgressing');
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
