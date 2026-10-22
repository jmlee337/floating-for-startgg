import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron';
import Store from 'electron-store';
import {
  SelectableEvent,
  RendererTournament,
  RendererEvent,
  Entrant,
  Phase,
  Seed,
  ConfiguredPhase,
  SeedsStatus,
  Ranking,
  Player,
  SyncState,
  Origin,
} from '../common/types';
import { mkdirSync } from 'fs';
import path from 'path';
import DatabaseContstructor from 'better-sqlite3';

type SeedPhase = Omit<Phase, 'seedNumOffset'>;
function toPhases(seedPhases: SeedPhase[]): Phase[] {
  let seedNumOffset = 0;
  const phases: Phase[] = [];
  for (const seedPhase of seedPhases) {
    phases.push({
      ...seedPhase,
      seedNumOffset,
    });
    seedNumOffset += seedPhase.pools.flatMap((pool) =>
      pool.seeds.filter((seed) => seed.entrant),
    ).length;
  }
  return phases;
}

type DbSeed = {
  entrantId: number;
  eventId: number;
  seedNum: number;
};

type DbPlayerToEntrant = {
  eventId: number;
  playerId: number;
  entrantId: number;
};

type DbPlayer = Omit<Player, 'rankings'>;

type DbRanking = Ranking & {
  playerId: number;
};

const PHASE_SEEDS_QUERY = `
  query phaseSeeds($phaseId: ID, $page: Int) {
    phase(id: $phaseId) {
      seeds(query: {page: $page, perPage: 512, sortBy: "seedNum ASC"}) {
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
            originPhase {
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

const UPDATE_PHASE_SEEDS_MUTATION = `
  mutation updatePhaseSeeds($phaseId: ID!, $seedMapping: [UpdatePhaseSeedInfo]!) {
    updatePhaseSeeding(
      phaseId: $phaseId
      seedMapping: $seedMapping
      options: { strictMode: false }
    ) {
      id
    }
  }
`;

const TOURNAMENT_PARTICIPANTS_QUERY = `
  query players($slug: String, $eventId: ID, $videogameId: ID, $page: Int) {
    tournament(slug: $slug) {
      participants(
        query: { page: $page, perPage: 512, filter: { eventIds: [$eventId] } }
      ) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          player {
            id
            gamerTag
            rankings(videogameId: $videogameId) {
              id
              rank
              iteration {
                title
                publishedAt
                series {
                  id
                  locationType
                  name
                  images(type: "icon") {
                    url
                  }
                }
              }
            }
            url
          }
        }
      }
    }
  }
`;

function getThresholdS() {
  // 400 days ago
  return Math.floor(Date.now() / 1000) - 34560000;
}

export default async function setupIPCs(mainWindow: BrowserWindow) {
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
    `CREATE TABLE IF NOT EXISTS playersToEntrant (
      eventId INTEGER,
      playerId INTEGER,
      entrantId INTEGER,
      PRIMARY KEY (playerId, entrantId)
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
  try {
    db.prepare('ALTER TABLE players DROP COLUMN entrantId').run();
  } catch {
    // just catch
  }
  try {
    db.prepare('ALTER TABLE players DROP COLUMN eventId').run();
  } catch {
    // just catch
  }
  try {
    db.prepare('ALTER TABLE players ADD COLUMN url TEXT').run();
  } catch {
    // just catch
  }
  db.prepare(
    `CREATE TABLE IF NOT EXISTS rankings (
      id INTEGER PRIMARY KEY,
      playerId INTEGER,
      rank INTEGER,
      seriesName TEXT,
      iconUrl TEXT,
      iterationTitle TEXT,
      publishedAt INTEGER,
      locationType INTEGER,
      seriesId INTEGER
    )`,
  ).run();
  const deleteInsertIntoPlayersToEntrant = (
    eventId: number,
    entrants: Entrant[],
  ) => {
    const entrantIds = entrants.map((entrant) => entrant.id);
    db.prepare(
      `DELETE FROM playersToEntrant WHERE entrantId IN (${entrantIds.join(',')})`,
    ).run();
    entrants.forEach((entrant) => {
      entrant.players.forEach((player) => {
        db.prepare(
          `INSERT INTO playersToEntrant (
            eventId, playerId, entrantId
          ) values (
            @eventId, @playerId, @entrantId
          )`,
        ).run({
          eventId,
          playerId: player.id,
          entrantId: entrant.id,
        });
      });
    });
  };
  const replaceIntoPlayers = (dbPlayer: DbPlayer) => {
    db.prepare(
      `REPLACE INTO players (
        id, gamerTag, url
      ) values (
        @id, @gamerTag, @url
      )`,
    ).run(dbPlayer);
  };
  const deleteInsertIntoRankings = (player: Player, thresholdS: number) => {
    db.prepare('DELETE FROM rankings WHERE playerId = @playerId').run({
      playerId: player.id,
    });
    player.rankings
      .filter((ranking) => ranking.publishedAt > thresholdS)
      .forEach((ranking) => {
        const dbRanking: DbRanking = {
          ...ranking,
          playerId: player.id,
        };
        db.prepare(
          `REPLACE INTO rankings (
        id,
        playerId,
        rank,
        seriesName,
        iconUrl,
        iterationTitle,
        publishedAt,
        locationType,
        seriesId
      ) values (
        @id,
        @playerId,
        @rank,
        @seriesName,
        @iconUrl,
        @iterationTitle,
        @publishedAt,
        @locationType,
        @seriesId
      )`,
        ).run(dbRanking);
      });
  };
  const updateForEntrants = (eventId: number, entrants: Entrant[]) => {
    deleteInsertIntoPlayersToEntrant(eventId, entrants);
    entrants.forEach((entrant) => {
      entrant.players.forEach((player) => {
        replaceIntoPlayers(player);
        deleteInsertIntoRankings(player, getThresholdS());
      });
    });
  };

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
              videogameId: eventJson.videogameId,
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

  const maybeFixSeeds = async (
    phases: SeedPhase[],
  ): Promise<{ shouldRefresh: boolean; seedsStatus: SeedsStatus }> => {
    const idToPhase = new Map(phases.map((phase) => [phase.id, phase]));
    const poolIdToSeeds = new Map(
      phases.flatMap((phase) =>
        phase.pools.map((pool) => [pool.id, pool.seeds]),
      ),
    );
    let reflowRequired = false;
    let fixUnsupported = false;
    let shouldRefresh = false;
    for (const phase of phases) {
      let progressingInSeedsPerPool = -1;
      let directSeedsPerPool = -1;
      const numPools = phase.pools.length;
      const k = numPools * 2;
      if (
        phase.pools.some((pool) => {
          const progressingInSeeds = pool.seeds.filter((seed) => seed.origin);
          if (progressingInSeedsPerPool === -1) {
            progressingInSeedsPerPool = progressingInSeeds.length;
          } else if (progressingInSeedsPerPool !== progressingInSeeds.length) {
            return true;
          }

          const directSeeds = pool.seeds.filter((seed) => seed.entrant);
          if (directSeedsPerPool === -1) {
            directSeedsPerPool = directSeeds.length;
          } else if (directSeedsPerPool !== directSeeds.length) {
            return true;
          }

          for (let i = 0; i < directSeeds.length - 1; i++) {
            const multiplier = i + 1;
            if (
              directSeeds[i].seedNum + directSeeds[i + 1].seedNum !==
              multiplier * k + 1
            ) {
              return true;
            }
          }
          return false;
        })
      ) {
        reflowRequired = true;
        continue;
      }
      if (
        phase.bracketType !== 3 ||
        progressingInSeedsPerPool === 0 ||
        progressingInSeedsPerPool === 1
      ) {
        continue;
      }

      const inPhaseIds = new Set<number>();
      phase.pools
        .flatMap((pool) => pool.seeds.filter((seed) => seed.origin))
        .forEach((seed) => {
          inPhaseIds.add(seed.origin!.phaseId);
        });
      if (inPhaseIds.size > 1) {
        fixUnsupported = true;
        continue;
      }

      const inPhase = idToPhase.get(Array.from(inPhaseIds.keys())[0]);
      if (!inPhase || inPhase.bracketType !== 3) {
        continue;
      }
      if (progressingInSeedsPerPool > numPools) {
        fixUnsupported = true;
        continue;
      }

      const expectedPools = phase.pools.map((pool) => {
        const directSeedNums = pool.seeds
          .filter((seed) => seed.entrant)
          .map((seed) => seed.seedNum);
        const lastI = directSeedNums.length - 1;
        const multiplier = lastI + 1;
        const progressingSeedNum1 =
          multiplier * k + 1 - directSeedNums[directSeedNums.length - 1];

        // blessed case
        if (progressingInSeedsPerPool === 2 && numPools % 2 === 0) {
          const progressingSeedNum2 = progressingSeedNum1 + numPools;
          return {
            id: pool.id,
            expectedSeedNums: [
              ...directSeedNums,
              progressingSeedNum1,
              progressingSeedNum2,
            ],
          };
        }

        // 01, 02, 03, 04
        // 08, 07, 06, 05
        // 09, 10, 11, 12
        // 16, 15, 14, 13
        // 17, 18, 19, 20
        // 24, 23, 22, 21
        // ->
        // 01, 02, 03, 04
        // 08, 07, 06, 05
        // 09, 10, 11, 12
        // 13, 16, 15, 14 +1
        // 19, 20, 17, 18 +2
        // 23, 22, 21, 24 +3
        const unFixedSeedNums = [progressingSeedNum1];
        const progressingSeedNums = [progressingSeedNum1];
        for (let i = 1; i < progressingInSeedsPerPool; i++) {
          const round = directSeedNums.length + i + 1;
          const maxSeedNum = round * numPools;
          const nextLastI = directSeedNums.length - 1 + i;
          const nextMultiplier = nextLastI + 1;
          const unFixedSeedNum =
            nextMultiplier * k + 1 - unFixedSeedNums[i - 1];
          let maybeNextSeedNum = unFixedSeedNum + i;
          if (maybeNextSeedNum > maxSeedNum) {
            maybeNextSeedNum -= numPools;
          }
          unFixedSeedNums[i] = unFixedSeedNum;
          progressingSeedNums[i] = maybeNextSeedNum;
        }
        return {
          id: pool.id,
          expectedSeedNums: [...directSeedNums, ...progressingSeedNums],
        };
      });
      if (
        phase.pools.every((pool, i) => {
          const { expectedSeedNums } = expectedPools[i];
          return pool.seeds.every(
            (seed, j) => seed.seedNum === expectedSeedNums[j],
          );
        })
      ) {
        continue;
      }

      const progressingInSeeds = phase.pools.flatMap((pools) =>
        pools.seeds.filter((seed) => seed.origin),
      );
      const seedNumStart = progressingInSeeds
        .map((seed) => seed.seedNum)
        .reduce((prev, curr) => Math.min(prev, curr), Number.MAX_SAFE_INTEGER);
      const expectedSeedNumToPoolId = new Map<number, number>();
      expectedPools.forEach((expectedPool) => {
        expectedPool.expectedSeedNums
          .filter((seedNum) => seedNum >= seedNumStart)
          .forEach((seedNum) => {
            expectedSeedNumToPoolId.set(seedNum, expectedPool.id);
          });
      });
      const seedMapping = progressingInSeeds
        .map((seed) => {
          const origin = seed.origin!;
          const seeds = poolIdToSeeds.get(origin.poolId);
          if (!seeds) {
            throw new Error(`pool ${origin.poolId} not found`);
          }
          const index = origin.placement - 1;
          if (index >= seeds.length) {
            throw new Error(
              `pool ${origin.poolId} seeds length ${seeds.length} vs placement ${origin.placement}`,
            );
          }
          const seedNum = seeds[index].seedNum;
          return {
            id: seed.id,
            origin: {
              ...origin,
              seedNum,
            },
          };
        })
        .sort((a, b) => a.origin.seedNum - b.origin.seedNum)
        .map((seed, i) => {
          const seedNum = seedNumStart + i;
          const phaseGroupId = expectedSeedNumToPoolId.get(seedNum);
          if (phaseGroupId === undefined) {
            throw new Error(`poolId not found for seedNum: ${seedNum}`);
          }
          return { seedId: seed.id, seedNum, phaseGroupId };
        });
      mainWindow.webContents.send(
        'message',
        `fixing phase seeding ${phase.id}`,
      );
      await fetchGqlWithCookie(UPDATE_PHASE_SEEDS_MUTATION, {
        phaseId: phase.id,
        seedMapping,
      });
      shouldRefresh = true;
    }
    let seedsStatus = SeedsStatus.FIXED;
    if (reflowRequired) {
      seedsStatus = SeedsStatus.REFLOW_REQUIRED;
    } else if (fixUnsupported) {
      seedsStatus = SeedsStatus.FIX_UNSUPPORTED;
    }
    return { shouldRefresh, seedsStatus };
  };

  const idToLastRawEntrant = new Map<
    number,
    { entrant: Entrant; overallSeedNum: number }
  >();
  const getEvent = async (
    slug: string,
    event: SelectableEvent,
  ): Promise<RendererEvent> => {
    mainWindow.webContents.send('message', `fetching event ${event.id}`);

    const participantIdToPlayer = new Map<number, Player>();
    let page = 1;
    while (true) {
      const nextData = await fetchGqlWithCookie(TOURNAMENT_PARTICIPANTS_QUERY, {
        slug,
        eventId: event.id,
        videogameId: event.videogameId,
        page,
      });

      const { nodes } = nextData.tournament.participants;
      if (Array.isArray(nodes)) {
        nodes.forEach((node) => {
          const rankings: Ranking[] = [];
          const nodeRankings = node.player.rankings;
          if (Array.isArray(nodeRankings)) {
            nodeRankings.forEach((nodeRanking) => {
              rankings.push({
                id: nodeRanking.id,
                rank: nodeRanking.rank,
                iterationTitle: nodeRanking.iteration.title,
                publishedAt: nodeRanking.iteration.publishedAt,
                seriesId: nodeRanking.iteration.series.id,
                seriesName: nodeRanking.iteration.series.name,
                locationType: nodeRanking.iteration.series.locationType,
                iconUrl: nodeRanking.iteration.series.images[0]?.url ?? null,
              });
            });
          }
          const player = {
            id: node.player.id,
            gamerTag: node.player.gamerTag,
            rankings,
            url: node.player.url,
          };
          participantIdToPlayer.set(node.id, player);
        });
      }

      page += 1;
      if (page > nextData.tournament.participants.pageInfo.totalPages) {
        break;
      }
    }

    const eventJson = await fetchWithCookie(
      `https://www.start.gg/api/-/rest/event/${event.id}?expand[]=entrants&expand[]=phase&expand[]=groups&bustCache`,
      'GET',
    );
    const jsonEvent = eventJson.entities?.event;
    if (!jsonEvent || typeof jsonEvent !== 'object') {
      throw new Error('no event in response');
    }
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

      const entrantPlayers = participantIds.map((participantId) => {
        const player = participantIdToPlayer.get(participantId);
        if (!player) {
          throw new Error(
            `no player for participant: ${participantId} in entrant ${id}`,
          );
        }
        return player;
      });
      idToEntrant.set(id, {
        id,
        players: entrantPlayers,
        // remote entrants are always "synced"
        syncState: SyncState.SYNCED,
      });
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

      mainWindow.webContents.send('message', `fetching phase ${phase.id}`);
      page = 1;
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
            const phaseId = node.progressionSource?.originPhase.id;
            const origin: Origin | undefined =
              placement && poolId ? { placement, poolId, phaseId } : undefined;
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

    const maybeFixSeedsRes = await maybeFixSeeds(seedPhases);
    if (maybeFixSeedsRes.shouldRefresh) {
      return getEvent(slug, event);
    }

    const newPhases = toPhases(seedPhases);
    idToLastRawEntrant.clear();
    const raw: Entrant[] = [];
    newPhases.forEach((phase) => {
      phase.pools
        .flatMap((pool) => pool.seeds.filter((seed) => seed.entrant))
        .sort((a, b) => a.seedNum - b.seedNum)
        .forEach((seed) => {
          if (!seed.entrant) {
            throw new Error('unreachable');
          }

          raw.push(seed.entrant);
          idToLastRawEntrant.set(seed.entrant.id, {
            entrant: seed.entrant,
            overallSeedNum: seed.seedNum + phase.seedNumOffset,
          });
        });
    });

    // update players
    db.transaction(() => {
      updateForEntrants(event.id, raw);
    })();

    return {
      ...event,
      seeds: {
        phases: newPhases,
        raw,
      },
      configuredPhases: db
        .prepare('SELECT * FROM phases WHERE eventId = @eventId')
        .all({ eventId: event.id }) as ConfiguredPhase[],
      seedsStatus: maybeFixSeedsRes.seedsStatus,
    };
  };
  ipcMain.removeHandler('getEvent');
  ipcMain.handle('getEvent', (ev, slug: string, event: SelectableEvent) => {
    mainWindow.webContents.send('message', '');
    return getEvent(slug, event);
  });

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

  const putDirect = async (
    phaseId: number,
    entrantIds: number[],
    prevEntrantIds: number[],
  ) => {
    mainWindow.webContents.send('message', `seeding phase ${phaseId}`);
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
    const nonDirectDestPhaseLinks = destPhaseLinks
      .filter((destPhaseLink) => destPhaseLink.type !== 3)
      .sort((a, b) => a.destSeedOrder - b.destSeedOrder);
    const newOrderedDestPhaseLinks = [
      directDestPhaseLink,
      ...nonDirectDestPhaseLinks,
    ];

    // check if changes actually needed
    const orderCorrect = newOrderedDestPhaseLinks.every(
      (destPhaseLink, i) => destPhaseLink.destSeedOrder === i,
    );
    if (!orderCorrect) {
      newOrderedDestPhaseLinks.forEach((destPhaseLink, i) => {
        destPhaseLink.destSeedOrder = i;
      });
    }
    if (
      entrantIds.length === prevEntrantIds.length &&
      entrantIds.every((entrantId, i) => entrantId === prevEntrantIds[i])
    ) {
      // no entrant changes needed
      if (orderCorrect) {
        // no order changes needed
        return;
      }

      // order changes needed
      await fetchWithCookie(
        `https://www.start.gg/api/-/rest/phase/${phaseId}`,
        'PUT',
        JSON.stringify({ destPhaseLinks: newOrderedDestPhaseLinks }),
      );
      return;
    }

    // entrant changes needed
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
    async (
      ev,
      slug: string,
      selectedEvent: SelectableEvent,
    ): Promise<RendererEvent> => {
      mainWindow.webContents.send('message', '');
      const event = await getEvent(slug, selectedEvent);
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
        const prevEntrantIds = phase.pools
          .flatMap((pool) => pool.seeds.filter((seed) => seed.entrant))
          .sort((a, b) => a.seedNum - b.seedNum)
          .map((seed) => seed.entrant!.id);
        await putDirect(phase.id, entrantIds, prevEntrantIds);
      }
      return getEvent(slug, selectedEvent);
    },
  );

  ipcMain.removeHandler('uploadSeeds');
  ipcMain.handle(
    'uploadSeeds',
    async (
      ev,
      slug: string,
      selectedEvent: SelectableEvent,
      entrants: Entrant[],
    ): Promise<RendererEvent> => {
      mainWindow.webContents.send('message', '');
      const event = await getEvent(slug, selectedEvent);
      const expectedEntrantIds = new Set(
        event.seeds.raw.map((entrant) => entrant.id),
      );
      entrants.forEach((entrant) => {
        if (!expectedEntrantIds.delete(entrant.id)) {
          throw new Error('start.gg entrants changed, download required');
        }
      });
      if (expectedEntrantIds.size !== 0) {
        throw new Error('start.gg entrants changed, download required');
      }

      const idToConfiguredPhase = new Map(
        event.configuredPhases.map((configuredPhase) => [
          configuredPhase.id,
          configuredPhase,
        ]),
      );
      for (const phase of event.seeds.phases) {
        if (entrants.length === 0) {
          break;
        }

        const configuredPhase = idToConfiguredPhase.get(phase.id);
        if (!configuredPhase) {
          continue;
        }

        const numEntrants =
          configuredPhase.progressingInPerPool === 0
            ? entrants.length
            : configuredPhase.directInPerPool * phase.pools.length;
        const entrantIds = entrants
          .splice(0, numEntrants)
          .map((entrant) => entrant.id);
        const prevEntrantIds = phase.pools
          .flatMap((pool) => pool.seeds.filter((seed) => seed.entrant))
          .sort((a, b) => a.seedNum - b.seedNum)
          .map((seed) => seed.entrant!.id);
        await putDirect(phase.id, entrantIds, prevEntrantIds);
      }
      return await getEvent(slug, selectedEvent);
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

      db.transaction(() => {
        db.prepare('DELETE FROM seeds WHERE eventId = @eventId').run({
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
        updateForEntrants(eventId, entrants);
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

    const entrantIdToPlayerIds = new Map<number, number[]>();
    (
      db
        .prepare('SELECT * FROM playersToEntrant WHERE eventId = @eventId')
        .all({ eventId }) as DbPlayerToEntrant[]
    ).forEach((dbPlayerToEntrant) => {
      const { entrantId } = dbPlayerToEntrant;
      let playerIds = entrantIdToPlayerIds.get(entrantId);
      if (!playerIds) {
        playerIds = [];
        entrantIdToPlayerIds.set(entrantId, playerIds);
      }
      playerIds.push(dbPlayerToEntrant.playerId);
    });

    const thresholdS = getThresholdS();
    const copyIdToLastRawEntrant = new Map(idToLastRawEntrant);
    const entrants = dbSeeds.map((seed): Entrant => {
      const playerIds = entrantIdToPlayerIds.get(seed.entrantId);
      if (!playerIds) {
        throw new Error(`no player ids found for entrant ${seed.entrantId}`);
      }
      const players = playerIds.map((playerId) => {
        const dbPlayer = db
          .prepare('SELECT * FROM players WHERE id = @playerId')
          .get({ playerId }) as DbPlayer | undefined;
        if (!dbPlayer) {
          throw new Error(`player ${playerId} not found`);
        }

        const rankings = db
          .prepare(
            'SELECT * FROM rankings WHERE playerId = @playerId AND publishedAt > @thresholdS',
          )
          .all({ playerId, thresholdS }) as DbRanking[];
        return {
          id: dbPlayer.id,
          gamerTag: dbPlayer.gamerTag,
          rankings,
          url: dbPlayer.url,
        };
      });
      const syncState = copyIdToLastRawEntrant.delete(seed.entrantId)
        ? SyncState.SYNCED
        : SyncState.LOCAL_ONLY;
      return {
        id: seed.entrantId,
        players,
        syncState,
      };
    });

    entrants.push(
      ...Array.from(copyIdToLastRawEntrant.values())
        .sort((a, b) => a.overallSeedNum - b.overallSeedNum)
        .map((entrant): Entrant => ({
          ...entrant.entrant,
          syncState: SyncState.STARTGG_ONLY,
        })),
    );

    return entrants;
  });
}
