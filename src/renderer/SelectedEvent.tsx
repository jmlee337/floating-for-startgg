import {
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import styled from '@emotion/styled';
import { useMemo } from 'react';
import { RendererEvent } from '../common/types';
import getBracketTypeDesc from './getBracketTypeDesc';
import getOriginPhaseLinkTypeDesc from './getOriginPhaseLinkTypeDesc';
import getDestBracketSideDesc from './getDestBracketSideDesc';
import getDestPhaseLinkOriginBracketSideDesc from './getDestPhaseLinkOriginBracketSideDesc';

const Cell = styled(TableCell)`
  padding: 4px;
`;

export default function SelectedEvent({ event }: { event: RendererEvent }) {
  const idToPhase = useMemo(
    () => new Map(event.phases.map((phase) => [phase.id, phase])),
    [event.phases],
  );

  return (
    <Stack
      direction="row"
      style={{
        alignItems: 'start',
        flexWrap: 'wrap',
        gap: '8px',
        paddingTop: '8px',
        paddingLeft: '8px',
        paddingRight: '8px',
      }}
    >
      {event.phases.map((phase) => (
        <Card key={phase.id}>
          <CardContent style={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h5">{phase.name}</Typography>
            <Typography variant="caption">
              {getBracketTypeDesc(phase.bracketType)} x{phase.groupCount}
            </Typography>
            {phase.destPhaseLinks.length > 0 && (
              <>
                <Typography style={{ marginTop: '8px' }}>In</Typography>
                <Table size="small">
                  <TableBody>
                    {phase.destPhaseLinks.map((destPhaseLink) => (
                      <TableRow key={destPhaseLink.id}>
                        <Cell>{destPhaseLink.numSeeds}</Cell>
                        <Cell>
                          {destPhaseLink.type === 3
                            ? 'Seeded'
                            : idToPhase.get(destPhaseLink.originPhaseId)?.name}
                          {destPhaseLink.type !== 3 &&
                            getDestPhaseLinkOriginBracketSideDesc(
                              idToPhase.get(destPhaseLink.originPhaseId)!
                                .bracketType,
                              destPhaseLink,
                            )}
                        </Cell>
                        {phase.bracketType === 2 && (
                          <Cell>
                            {destPhaseLink.destBracketSide === 1 ? 'W' : 'L'}
                          </Cell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
            {phase.originPhaseLinks.length > 0 && (
              <>
                <Typography style={{ marginTop: '8px' }}>Out</Typography>
                <Table size="small">
                  <TableBody>
                    {phase.originPhaseLinks.map((originPhaseLink) => (
                      <TableRow key={originPhaseLink.id}>
                        <Cell>
                          {getOriginPhaseLinkTypeDesc(
                            originPhaseLink,
                            phase.bracketType,
                          )}
                        </Cell>
                        <Cell>
                          {idToPhase.get(originPhaseLink.destPhaseId)?.name}
                          {getDestBracketSideDesc(
                            originPhaseLink.destBracketSide,
                            idToPhase.get(originPhaseLink.destPhaseId)
                              ?.bracketType,
                          )}
                        </Cell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
