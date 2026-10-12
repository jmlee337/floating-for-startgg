import { Stack, Typography } from '@mui/material';
import { RendererEvent } from '../common/types';

export default function SelectedEvent({ event }: { event: RendererEvent }) {
  return (
    <Stack
      direction="column"
      style={{
        paddingTop: '8px',
        paddingLeft: '8px',
        paddingRight: '8px',
        gap: '8px',
      }}
    >
      {event.seeds.phases.map((phase) => (
        <Stack key={phase.id} direction="row" style={{ gap: '8px' }}>
          <Typography variant="body2" style={{ flexShrink: 0 }}>
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
                {pool.seeds.map((seed) => (
                  <Typography
                    key={seed.id}
                    variant="caption"
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontStyle: seed.projected ? 'italic' : 'initial',
                    }}
                  >
                    {seed.seedNum}:{' '}
                    {seed.entrant.players
                      .map((player) => player.gamerTag)
                      .join(' / ')}
                  </Typography>
                ))}
              </Stack>
            ))}
          </Stack>
        </Stack>
      ))}
      <Typography variant="caption">
        {event.seeds.raw
          .map((entrant) =>
            entrant.players.map((player) => player.gamerTag).join(' / '),
          )
          .join(', ')}
      </Typography>
    </Stack>
  );
}
