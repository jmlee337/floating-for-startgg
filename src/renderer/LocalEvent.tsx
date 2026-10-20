import { Dispatch, SetStateAction, useMemo, useState } from 'react';
import { Entrant, Phase, Seed } from '../common/types';
import { Stack, Typography } from '@mui/material';
import LocalSeedsList from './LocalSeedsList';

export default function LocalEvent({
  phases,
  mutableLocalSeeds,
  setMutableLocalSeeds,
  idToRawEntrant,
}: {
  phases: Phase[];
  mutableLocalSeeds: Entrant[];
  setMutableLocalSeeds: Dispatch<SetStateAction<Entrant[]>>;
  idToRawEntrant: Map<number, Entrant>;
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
    return { actualPhases: newActualPhases, poolIdToSeeds: newPoolIdToSeeds };
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
                  <>
                    {seed.entrant && (
                      <Typography
                        key={seed.id}
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
                              selectedSeedNum ===
                                phase.seedNumOffset + seed.seedNum &&
                              !idToRawEntrant.has(seed.entrant!.id)
                            ) {
                              return theme.palette.secondary.light;
                            }
                            if (
                              selectedSeedNum ===
                              phase.seedNumOffset + seed.seedNum
                            ) {
                              return theme.palette.primary.light;
                            }
                            if (!idToRawEntrant.has(seed.entrant!.id)) {
                              return theme.palette.error.light;
                            }
                            return 'initial';
                          },
                          color: (theme) => {
                            if (
                              selectedSeedNum ===
                                phase.seedNumOffset + seed.seedNum &&
                              !idToRawEntrant.has(seed.entrant!.id)
                            ) {
                              return theme.palette.secondary.contrastText;
                            }
                            if (
                              selectedSeedNum ===
                              phase.seedNumOffset + seed.seedNum
                            ) {
                              return theme.palette.primary.contrastText;
                            }
                            if (!idToRawEntrant.has(seed.entrant!.id)) {
                              return theme.palette.error.contrastText;
                            }
                            return 'initial';
                          },
                        }}
                        onClick={() => {
                          if (!selectedSeedNum) {
                            setSelectedSeedNum(
                              phase.seedNumOffset + seed.seedNum,
                            );
                            return;
                          }
                          if (selectedSeedNum === seed.seedNum) {
                            setSelectedSeedNum(0);
                            return;
                          }
                          const index1 = selectedSeedNum - 1;
                          const index2 = phase.seedNumOffset + seed.seedNum - 1;
                          setMutableLocalSeeds((oldMutableLocalSeeds) => {
                            const arr = [...oldMutableLocalSeeds];
                            [arr[index1], arr[index2]] = [
                              arr[index2],
                              arr[index1],
                            ];
                            return arr;
                          });
                          setSelectedSeedNum(0);
                        }}
                      >
                        {seed.seedNum}:{' '}
                        {seed.entrant.players
                          .map((player) => player.gamerTag)
                          .join(' / ')}
                      </Typography>
                    )}
                    {seed.origin && (
                      <Typography
                        key={seed.id}
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
                        {seed.seedNum}:{' '}
                        {poolIdToSeeds
                          .get(seed.origin.poolId)
                          ?.[seed.origin.placement - 1]?.entrant?.players.map(
                            (player) => player.gamerTag,
                          )
                          .join(' / ')}
                      </Typography>
                    )}
                  </>
                ))}
              </Stack>
            ))}
          </Stack>
        </Stack>
      ))}
      <Typography variant="body1" style={{ margin: '4px 0 -4px' }}>
        Drag to re-order!
      </Typography>
      <LocalSeedsList
        phases={phases}
        mutableLocalSeeds={mutableLocalSeeds}
        setMutableLocalSeeds={setMutableLocalSeeds}
        idToRawEntrant={idToRawEntrant}
      />
    </>
  );
}
