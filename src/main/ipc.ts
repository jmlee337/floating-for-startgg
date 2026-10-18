import { app, ipcMain, safeStorage, shell } from 'electron';
import Store from 'electron-store';
import {
  SelectableEvent,
  RendererTournament,
  RendererEvent,
  Entrant,
  Phase,
  Seed,
  ConfiguredPhase,
  Player,
} from '../common/types';
import { mkdirSync } from 'fs';
import path from 'path';
import DatabaseContstructor from 'better-sqlite3';

type SeedPhase = Phase & {
  phaseOrder: number;
};

type DbSeed = {
  entrantId: number;
  eventId: number;
  seedNum: number;
};

type DbPlayer = {
  id: number;
  eventId: number;
  entrantId: number;
  gamerTag: string;
};

const PHASE_SEEDS_QUERY = `
  query phaseSeeds($phaseId: ID, $page: Int) {
    phase(id: $phaseId) {
      seeds(query: {page: $page, perPage: 249, sortBy: "seedNum ASC"}) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          phaseGroup {
            id
          }
          seedNum
          groupSeedNum
          placeholderName
          progressionSource {
            originPlacement
            originPhaseGroup {
              id
            }
          }
          entrant {
            id
          }
        }
      }
    }
  }
`;

export default async function setupIPCs() {
  const store = new Store<{
    base64EncryptedPassword: string;
    email: string;
    cookies: string[];
  }>();
  const userDataPath = app.getPath('userData');
  mkdirSync(userDataPath, { recursive: true });
  const db = new DatabaseContstructor(
    path.join(userDataPath, 'floating-for-startgg.sqlite3'),
  );
  db.pragma('journal_mode = WAL');
  db.prepare(
    `CREATE TABLE IF NOT EXISTS phases (
      id INTEGER PRIMARY KEY,
      eventId INTEGER,
      directInPerPool INTEGER,
      progressingInPerPool INTEGER
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS seeds (
      entrantId INTEGER PRIMARY KEY,
      eventId INTEGER,
      seedNum INTEGER
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY,
      eventId INTEGER,
      entrantId INTEGER,
      gamerTag TEXT
    )`,
  ).run();

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
  const fetchGqlWithCookie = async (query: string, variables: any) => {
    const json = await fetchWithCookie(
      'https://www.start.gg/api/-/gql',
      'POST',
      JSON.stringify({ query, variables }),
    );
    if (json.errors) {
      throw new Error(
        json.errors.map((error: any) => error.message).join(', '),
      );
    }
    return json.data;
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

  ipcMain.removeHandler('getTournament');
  ipcMain.handle(
    'getTournament',
    async (event, slug: string): Promise<RendererTournament> => {
      const json = await fetchWithCookie(
        `https://www.start.gg/api/-/rest/tournament/${slug}?expand[]=event`,
        'GET',
      );
      const tournamentJson = json.entities?.tournament;
      if (!(tournamentJson instanceof Object)) {
        throw new Error('no tournament in response');
      }

      const events: SelectableEvent[] = [];
      const eventsJson = json.entities?.event;
      if (Array.isArray(eventsJson)) {
        eventsJson.forEach((eventJson) => {
          if (eventJson.state === 1) {
            events.push({
              id: eventJson.id,
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

  const getEvent = async (event: SelectableEvent): Promise<RendererEvent> => {
    const eventJson = await fetchWithCookie(
      `https://www.start.gg/api/-/rest/event/${event.id}?expand[]=entrants&expand[]=phase&expand[]=groups&mutations[]=playerData&bustCache`,
      'GET',
    );
    const jsonEntrants = eventJson.entities?.entrants;
    if (!Array.isArray(jsonEntrants)) {
      throw new Error('no entrants in response');
    }
    const jsonPhases = eventJson.entities?.phase;
    if (!Array.isArray(jsonPhases)) {
      throw new Error('no phases in response');
    }
    const jsonGroups = eventJson.entities?.groups;
    if (!Array.isArray(jsonGroups)) {
      throw new Error('no pools in response');
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

    const phases = jsonPhases.map((jsonPhase) => ({
      id: jsonPhase.id,
      name: jsonPhase.name,
      bracketType: jsonPhase.bracketType,
      phaseOrder: jsonPhase.phaseOrder,
    }));

    const phaseIdToIdToPool = new Map<
      number,
      Map<number, { id: number; name: string; seeds: Seed[] }>
    >();
    jsonGroups.forEach((jsonGroup) => {
      let idToPool = phaseIdToIdToPool.get(jsonGroup.phaseId);
      if (!idToPool) {
        idToPool = new Map();
        phaseIdToIdToPool.set(jsonGroup.phaseId, idToPool);
      }
      idToPool.set(jsonGroup.id, {
        id: jsonGroup.id,
        name: jsonGroup.displayIdentifier,
        seeds: [],
      });
    });

    const seedPhases: SeedPhase[] = [];
    for (const phase of phases) {
      const idToPool = phaseIdToIdToPool.get(phase.id);
      if (!idToPool) {
        throw new Error(`no pools found for phase ${phase.id}`);
      }

      let page = 1;
      while (true) {
        const nextData = await fetchGqlWithCookie(PHASE_SEEDS_QUERY, {
          phaseId: phase.id,
          page,
        });
        const { nodes } = nextData.phase.seeds;
        if (Array.isArray(nodes)) {
          nodes.forEach((node) => {
            const entrantId = node.entrant?.id;
            const entrant = entrantId ? idToEntrant.get(entrantId) : undefined;
            const placement = node.progressionSource?.originPlacement;
            const poolId = node.progressionSource?.originPhaseGroup.id;
            const origin =
              placement && poolId ? { placement, poolId } : undefined;
            const seed: Seed = {
              id: node.id,
              seedNum: node.seedNum,
              entrant,
              origin,
            };
            const pool = idToPool.get(node.phaseGroup.id);
            if (!pool) {
              throw new Error(
                `pool ${node.phaseGroup.id} not found for seed ${node.id} (phase ${phase.id})`,
              );
            }
            pool.seeds.push(seed);
          });
        }
        page += 1;
        if (page > nextData.phase.seeds.pageInfo.totalPages) {
          break;
        }
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
        bracketType: phase.bracketType,
        phaseOrder: phase.phaseOrder,
        pools,
      });
    }
    seedPhases.sort((a, b) => b.phaseOrder - a.phaseOrder);

    const raw: Entrant[] = [];
    seedPhases.forEach((phase) => {
      const phaseSeeds = phase.pools.flatMap((pool) =>
        pool.seeds.filter((seed) => seed.entrant),
      );
      phaseSeeds.sort((a, b) => a.seedNum - b.seedNum);
      raw.push(...phaseSeeds.map((seed) => seed.entrant!));
    });

    return {
      ...event,
      seeds: {
        phases: seedPhases,
        raw,
      },
      configuredPhases: db
        .prepare('SELECT * FROM phases WHERE eventId = @eventId')
        .all({ eventId: event.id }) as ConfiguredPhase[],
    };
  };
  ipcMain.removeHandler('getEvent');
  ipcMain.handle('getEvent', (ev, event: SelectableEvent) => getEvent(event));

  ipcMain.removeHandler('upsertConfiguredPhase');
  ipcMain.handle(
    'upsertConfiguredPhase',
    (event, configuredPhase: ConfiguredPhase) => {
      db.prepare(
        `REPLACE INTO phases (
          id, eventId, directInPerPool, progressingInPerPool
        ) values (
          @id, @eventId, @directInPerPool, @progressingInPerPool
        )`,
      ).run(configuredPhase);
    },
  );

  ipcMain.removeHandler('getConfiguredPhase');
  ipcMain.handle('getConfiguredPhase', (event, phaseId: number) => {
    const configuredPhase = db
      .prepare('SELECT * FROM phases WHERE id = @id')
      .get({ id: phaseId }) as ConfiguredPhase | undefined;
    if (!configuredPhase) {
      throw new Error(`no configured phase found for ${phaseId}`);
    }
    return configuredPhase;
  });

  const putDirect = async (phaseId: number, entrantIds: number[]) => {
    const phaseJson = await fetchWithCookie(
      `https://www.start.gg/api/-/rest/phase/${phaseId}?expand[]=phaseLink`,
      'GET',
    );
    const phaseLinks = phaseJson.entities?.phaseLink;
    if (!Array.isArray(phaseLinks)) {
      throw new Error(`no phaseLinks found for phase ${phaseId}`);
    }

    const destPhaseLinks = phaseLinks
      .filter((phaseLink) => phaseLink.destPhaseId === phaseId)
      .sort((a, b) => a.destSeedOrder - b.destSeedOrder);
    const directDestPhaseLinks = destPhaseLinks.filter(
      (destPhaseLink) => destPhaseLink.type === 3,
    );
    if (directDestPhaseLinks.length > 1) {
      throw new Error(
        `multiple direct entrant links found for phase ${phaseId}`,
      );
    }

    const initialEntrants: any = {};
    entrantIds.forEach((entrantId) => {
      initialEntrants[entrantId] = true;
    });

    // no existing direct destPhaseLink
    if (directDestPhaseLinks.length === 0) {
      destPhaseLinks.unshift({
        destPhaseId: phaseId,
        maintainMatchup: false,
        isDefault: false,
        entrantIds,
        type: 3,
        destBracketSide: 1,
        cId: `${phaseId}-1`,
        initialEntrants,
        numSeeds: entrantIds.length,
      });
      destPhaseLinks.forEach((destPhaseLink, i) => {
        destPhaseLink.destSeedOrder = i;
      });
      await fetchWithCookie(
        `https://www.start.gg/api/-/rest/phase/${phaseId}`,
        'PUT',
        JSON.stringify({ destPhaseLinks }),
      );
      return;
    }

    // existing direct destPhaseLink
    const [directDestPhaseLink] = directDestPhaseLinks;
    const nonDirectDestPhaseLinks = destPhaseLinks.filter(
      (destPhaseLink) => destPhaseLink.type !== 3,
    );
    const newOrderedDestPhaseLinks = [
      directDestPhaseLink,
      ...nonDirectDestPhaseLinks,
    ];
    newOrderedDestPhaseLinks.forEach((destPhaseLink, i) => {
      destPhaseLink.destSeedOrder = i;
    });

    directDestPhaseLink.entrantIds = [];
    directDestPhaseLink.initialEntrants = {};
    directDestPhaseLink.numSeeds = 0;
    await fetchWithCookie(
      `https://www.start.gg/api/-/rest/phase/${phaseId}`,
      'PUT',
      JSON.stringify({ destPhaseLinks: newOrderedDestPhaseLinks }),
    );

    directDestPhaseLink.entrantIds = entrantIds;
    directDestPhaseLink.initialEntrants = initialEntrants;
    directDestPhaseLink.numSeeds = entrantIds.length;
    await fetchWithCookie(
      `https://www.start.gg/api/-/rest/phase/${phaseId}`,
      'PUT',
      JSON.stringify({ destPhaseLinks: newOrderedDestPhaseLinks }),
    );
  };
  ipcMain.removeHandler('reflow');
  ipcMain.handle(
    'reflow',
    async (ev, selectedEvent: SelectableEvent): Promise<RendererEvent> => {
      const event = await getEvent(selectedEvent);
      const rawEntrantIds = event.seeds.raw.map((entrant) => entrant.id);
      const idToConfiguredPhase = new Map(
        event.configuredPhases.map((configuredPhase) => [
          configuredPhase.id,
          configuredPhase,
        ]),
      );

      for (const phase of event.seeds.phases) {
        if (rawEntrantIds.length === 0) {
          break;
        }

        const configuredPhase = idToConfiguredPhase.get(phase.id);
        if (!configuredPhase) {
          continue;
        }

        const numEntrants =
          configuredPhase.progressingInPerPool === 0
            ? rawEntrantIds.length
            : configuredPhase.directInPerPool * phase.pools.length;
        const entrantIds = rawEntrantIds.splice(0, numEntrants);
        await putDirect(phase.id, entrantIds);
      }
      return getEvent(selectedEvent);
    },
  );

  ipcMain.removeHandler('updateLocalSeeds');
  ipcMain.handle(
    'updateLocalSeeds',
    (event, eventId: number, entrants: Entrant[]) => {
      const dbSeeds = entrants.map((entrant, i): DbSeed => ({
        entrantId: entrant.id,
        eventId,
        seedNum: i + 1,
      }));
      const dbPlayers = entrants.flatMap((entrant): DbPlayer[] =>
        entrant.players.map((player) => ({
          id: player.id,
          eventId,
          entrantId: entrant.id,
          gamerTag: player.gamerTag,
        })),
      );

      db.transaction(() => {
        db.prepare('DELETE FROM seeds WHERE eventId = @eventId').run({
          eventId,
        });
        db.prepare('DELETE FROM players WHERE eventId = @eventId').run({
          eventId,
        });
        dbSeeds.forEach((dbSeed) => {
          db.prepare(
            `INSERT INTO seeds (
              entrantId, eventId, seedNum
            ) values (
              @entrantId, @eventId, @seedNum
            )`,
          ).run(dbSeed);
        });
        dbPlayers.forEach((dbPlayer) => {
          db.prepare(
            `INSERT INTO players (
              id, eventId, entrantId, gamerTag
            ) values (
              @id, @eventId, @entrantId, @gamerTag
            )`,
          ).run(dbPlayer);
        });
      })();
    },
  );

  ipcMain.removeHandler('getLocalSeeds');
  ipcMain.handle('getLocalSeeds', (event, eventId: number): Entrant[] => {
    const dbSeeds = db
      .prepare(
        'SELECT * FROM seeds WHERE eventId = @eventId ORDER BY seedNum ASC',
      )
      .all({ eventId }) as DbSeed[];

    const entrantIdToPlayers = new Map<number, Player[]>();
    (
      db
        .prepare('SELECT * FROM players WHERE eventId = @eventId')
        .all({ eventId }) as DbPlayer[]
    ).forEach((dbPlayer) => {
      let players = entrantIdToPlayers.get(dbPlayer.entrantId);
      if (!players) {
        players = [];
        entrantIdToPlayers.set(dbPlayer.entrantId, players);
      }
      players.push({ id: dbPlayer.id, gamerTag: dbPlayer.gamerTag });
    });

    const entrants = dbSeeds.map((seed): Entrant => {
      const players = entrantIdToPlayers.get(seed.entrantId);
      if (!players) {
        throw new Error(`player(s) not found for entrant ${seed.entrantId}`);
      }
      return { id: seed.entrantId, players };
    });

    return entrants;
  });
}
