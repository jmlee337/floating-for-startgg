import { useMemo } from 'react';
import { Phase, Seed } from '../common/types';
import { Stack, Typography } from '@mui/material';

export default function StartggEvent({
  showProjected,
  phases,
}: {
  showProjected: boolean;
  phases: Phase[];
}) {
  const poolIdToSeeds = useMemo(() => {
    const newPoolIdToSeeds = new Map<number, Seed[]>();
    phases.forEach((phase) => {
      phase.pools.forEach((pool) => {
        newPoolIdToSeeds.set(pool.id, pool.seeds);
      });
    });
    return newPoolIdToSeeds;
  }, [phases]);
  return (
    <>
      {phases.map((phase) => (
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
                  <Typography
                    key={seed.id}
                    variant="caption"
                    color={seed.origin ? 'warning' : 'textPrimary'}
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontStyle: seed.origin ? 'italic' : 'initial',
                    }}
                  >
                    {seed.seedNum}:{' '}
                    {seed.entrant &&
                      seed.entrant.players
                        .map((player) => player.gamerTag)
                        .join(' / ')}
                    {showProjected &&
                      seed.origin &&
                      poolIdToSeeds
                        .get(seed.origin.poolId)
                        ?.[seed.origin.placement - 1]?.entrant?.players.map(
                          (player) => player.gamerTag,
                        )
                        .join(' / ')}
                  </Typography>
                ))}
              </Stack>
            ))}
          </Stack>
        </Stack>
      ))}
    </>
  );
}
