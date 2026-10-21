import { Dispatch, SetStateAction, useMemo, useState } from 'react';
import { Entrant, Origin, Phase, Seed, SyncState } from '../common/types';
import { Stack, Typography } from '@mui/material';
import LocalSeedsList from './LocalSeedsList';

function RenderSeed({
  seedNumOffset,
  seedNum,
  entrant,
  origin,
  poolIdToSeeds,
  selectedSeedNum,
  setSelectedSeedNum,
  setMutableLocalSeeds,
}: {
  seedNumOffset: number;
  seedNum: number;
  entrant: Entrant | undefined;
  origin: Origin | undefined;
  selectedSeedNum: number;
  poolIdToSeeds: Map<number, Seed[]>;
  setSelectedSeedNum: (selectedSeedNum: number) => void;
  setMutableLocalSeeds: Dispatch<SetStateAction<Entrant[]>>;
}) {
  const overallSeedNum = seedNumOffset + seedNum;
  return (
    <>
      {entrant && (
        <Typography
          variant="caption"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
          sx={{
            backgroundColor: (theme) => {
              if (
                selectedSeedNum === overallSeedNum &&
                entrant.syncState === SyncState.LOCAL_ONLY
              ) {
                return theme.palette.secondary.light;
              }
              if (selectedSeedNum === overallSeedNum) {
                return theme.palette.primary.light;
              }
              if (entrant.syncState === SyncState.LOCAL_ONLY) {
                return theme.palette.error.light;
              }
              if (entrant.syncState === SyncState.STARTGG_ONLY) {
                return theme.palette.success.light;
              }
              return 'initial';
            },
            color: (theme) => {
              if (
                selectedSeedNum === overallSeedNum &&
                entrant.syncState === SyncState.LOCAL_ONLY
              ) {
                return theme.palette.secondary.contrastText;
              }
              if (selectedSeedNum === overallSeedNum) {
                return theme.palette.primary.contrastText;
              }
              if (entrant.syncState === SyncState.LOCAL_ONLY) {
                return theme.palette.error.contrastText;
              }
              if (entrant.syncState === SyncState.STARTGG_ONLY) {
                return theme.palette.success.contrastText;
              }
              return 'initial';
            },
          }}
          onClick={() => {
            if (!selectedSeedNum) {
              setSelectedSeedNum(overallSeedNum);
              return;
            }
            if (selectedSeedNum === overallSeedNum) {
              setSelectedSeedNum(0);
              return;
            }
            const index1 = selectedSeedNum - 1;
            const index2 = overallSeedNum - 1;
            setMutableLocalSeeds((oldMutableLocalSeeds) => {
              const arr = [...oldMutableLocalSeeds];
              [arr[index1], arr[index2]] = [arr[index2], arr[index1]];
              return arr;
            });
            setSelectedSeedNum(0);
          }}
        >
          {seedNum}:{' '}
          {entrant.players.map((player) => player.gamerTag).join(' / ')}
        </Typography>
      )}
      {origin && (
        <Typography
          variant="caption"
          color="warning"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontStyle: 'italic',
            cursor: 'not-allowed',
          }}
        >
          {seedNum}:{' '}
          {poolIdToSeeds
            .get(origin.poolId)
            ?.[origin.placement - 1]?.entrant?.players.map(
              (player) => player.gamerTag,
            )
            .join(' / ')}
        </Typography>
      )}
    </>
  );
}

export default function LocalEvent({
  phases,
  mutableLocalSeeds,
  setMutableLocalSeeds,
  overflowEntrantsStartI,
}: {
  phases: Phase[];
  mutableLocalSeeds: Entrant[];
  setMutableLocalSeeds: Dispatch<SetStateAction<Entrant[]>>;
  overflowEntrantsStartI: number;
}) {
  const { actualPhases, poolIdToSeeds } = useMemo(() => {
    const remainingEntrants = new Array(...mutableLocalSeeds);
    const newActualPhases: Phase[] = [];
    for (const phase of phases) {
      if (remainingEntrants.length === 0) {
        break;
      }

      const numEntrants = phase.pools.flatMap((pool) =>
        pool.seeds.filter((seed) => seed.entrant),
      ).length;
      const seedNumToEntrant = new Map(
        remainingEntrants
          .splice(0, numEntrants)
          .map((entrant, i) => [i + 1, entrant]),
      );

      newActualPhases.push({
        ...phase,
        pools: phase.pools.map((pool) => ({
          ...pool,
          seeds: pool.seeds.map((seed) => {
            if (!seed.entrant) {
              return seed;
            }

            const entrant = seedNumToEntrant.get(seed.seedNum);
            if (!entrant) {
              throw new Error(
                `entrant not found for seedNum ${seed.seedNum} in phase ${phase.id}`,
              );
            }
            return {
              ...seed,
              entrant,
            };
          }),
        })),
      });
    }
    const newPoolIdToSeeds = new Map<number, Seed[]>();
    newActualPhases.forEach((phase) => {
      phase.pools.forEach((pool) => {
        newPoolIdToSeeds.set(pool.id, pool.seeds);
      });
    });

    return {
      actualPhases: newActualPhases,
      poolIdToSeeds: newPoolIdToSeeds,
    };
  }, [phases, mutableLocalSeeds]);

  const [selectedSeedNum, setSelectedSeedNum] = useState(0);
  return (
    <>
      {actualPhases.map((phase) => (
        <Stack key={phase.id} direction="row" style={{ gap: '8px' }}>
          <Typography
            variant="body2"
            color="textSecondary"
            style={{ flexShrink: 0 }}
          >
            {phase.name}
          </Typography>
          <Stack
            direction="row"
            style={{
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            {phase.pools.map((pool) => (
              <Stack
                key={pool.id}
                direction="column"
                style={{ width: '130px' }}
              >
                <Typography variant="body2" color="textSecondary">
                  {pool.name}
                </Typography>
                {pool.seeds.map((seed) => (
                  <RenderSeed
                    key={seed.id}
                    entrant={seed.entrant}
                    origin={seed.origin}
                    seedNumOffset={phase.seedNumOffset}
                    seedNum={seed.seedNum}
                    poolIdToSeeds={poolIdToSeeds}
                    selectedSeedNum={selectedSeedNum}
                    setSelectedSeedNum={setSelectedSeedNum}
                    setMutableLocalSeeds={setMutableLocalSeeds}
                  />
                ))}
              </Stack>
            ))}
          </Stack>
        </Stack>
      ))}
      {overflowEntrantsStartI < mutableLocalSeeds.length && (
        <Stack direction="column">
          <Typography
            variant="body2"
            color="textSecondary"
            style={{ flexShrink: 0 }}
          >
            Overflow (
            <Typography
              component="span"
              variant="body2"
              sx={{
                color: (theme) => theme.palette.error.contrastText,
                backgroundColor: (theme) => theme.palette.error.light,
              }}
            >
              local entrants
            </Typography>{' '}
            will be removed on save)
          </Typography>
          <Stack
            direction="row"
            style={{
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            {mutableLocalSeeds
              .slice(overflowEntrantsStartI)
              .map((entrant, i) => (
                <Stack key={entrant.id} style={{ width: '130px' }}>
                  <RenderSeed
                    entrant={entrant}
                    origin={undefined}
                    seedNumOffset={overflowEntrantsStartI}
                    seedNum={i + 1}
                    poolIdToSeeds={poolIdToSeeds}
                    selectedSeedNum={selectedSeedNum}
                    setSelectedSeedNum={setSelectedSeedNum}
                    setMutableLocalSeeds={setMutableLocalSeeds}
                  />
                </Stack>
              ))}
          </Stack>
        </Stack>
      )}
      <Typography variant="body1" style={{ margin: '4px 0 -4px' }}>
        Drag to re-order!
      </Typography>
      <LocalSeedsList
        phases={phases}
        mutableLocalSeeds={mutableLocalSeeds}
        setMutableLocalSeeds={setMutableLocalSeeds}
        overflowEntrantsStartI={overflowEntrantsStartI}
      />
    </>
  );
}
