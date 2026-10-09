import {
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownward, ArrowUpward, DeleteForever } from '@mui/icons-material';
import {
  NewOriginPhaseLink,
  RendererDestPhaseLink,
  RendererOriginPhaseLink,
  RendererPhase,
} from '../common/types';
import getBracketTypeDesc from './getBracketTypeDesc';
import getOriginPhaseLinkTypeDesc from './getOriginPhaseLinkTypeDesc';
import getDestBracketSideDesc from './getDestBracketSideDesc';
import {
  losersPlacementToTopN,
  singleElimPlacementToTopN,
} from '../common/constants';
import withOrdinalSuffix from './withOrdinalSuffix';
import getDestPhaseLinkOriginBracketSideDesc from './getDestPhaseLinkOriginBracketSideDesc';

function arrayRange(start: number, stop: number) {
  if (start > stop) {
    return [];
  }

  return Array.from(
    { length: stop - start + 1 },
    (value, index) => start + index,
  );
}

const seNumProgressingValues = [0, 1, 2, 4, 8, 16, 32];
const deNumProgressingValues = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32];
const otherProgressingValues = arrayRange(0, 16);
function bracketTypeToProgressingValues(bracketType: number) {
  switch (bracketType) {
    case 1:
      return seNumProgressingValues;
    case 2:
      return deNumProgressingValues;
    case 3:
    case 4:
    case 6:
    case 7:
      return otherProgressingValues;
    // elimination rounds don't support progressions
    // exhibition, race, circuit idk
    default:
      return [];
  }
}
function bracketTypeToMenuItems(bracketType: number) {
  return bracketTypeToProgressingValues(bracketType).map((n) => (
    <MenuItem value={n} key={n}>
      {n}
    </MenuItem>
  ));
}

function getNextPlacement(phase: RendererPhase) {
  const placementMax = Math.max(
    ...phase.originPhaseLinks.map(
      (originPhaseLink) => originPhaseLink.originPlacement,
    ),
  );
  if (phase.numProgressing > placementMax) {
    return phase.numProgressing + 1;
  }

  if (phase.bracketType === 1) {
    const allPlacements = Array.from(singleElimPlacementToTopN.keys());
    const index = allPlacements.indexOf(placementMax);
    if (index === -1 || index >= allPlacements.length - 1) {
      return 0;
    }
    return allPlacements[index + 1];
  }
  if (phase.bracketType === 2) {
    const allPlacements = Array.from(losersPlacementToTopN.keys());
    const index = allPlacements.indexOf(placementMax);
    if (index === -1 || index >= allPlacements.length - 1) {
      return 0;
    }
    return allPlacements[index + 1];
  }
  if (
    phase.bracketType === 3 ||
    phase.bracketType === 4 ||
    phase.bracketType === 6 ||
    phase.bracketType === 7
  ) {
    return placementMax + 1;
  }
  return 0;
}

function getPlacements(start: number, bracketType: number) {
  if (bracketType === 1) {
    const allPlacements = Array.from(singleElimPlacementToTopN.keys());
    const index = allPlacements.indexOf(start);
    if (index === -1) {
      return [];
    }
    return allPlacements.slice(index);
  }
  if (bracketType === 2) {
    const allPlacements = Array.from(losersPlacementToTopN.keys());
    const index = allPlacements.indexOf(start);
    if (index === -1) {
      return [];
    }
    return allPlacements.slice(index);
  }
  if (
    bracketType === 3 ||
    bracketType === 4 ||
    bracketType === 6 ||
    bracketType === 7
  ) {
    return arrayRange(start, 16);
  }
  return [];
}

export default function SelectedPhase({
  phase,
  setPhase,
  idToPhase,
  refreshEvent,
  openError,
}: {
  phase: RendererPhase | null;
  setPhase: (phase: RendererPhase | null) => void;
  idToPhase: Map<number, RendererPhase>;
  refreshEvent: () => Promise<void>;
  openError: (message: string) => void;
}) {
  const [fetching, setFetching] = useState(false);

  const putDestPhaseLinks = useCallback(
    async (phaseId: number, newDestPhaseLinks: RendererDestPhaseLink[]) => {
      try {
        setFetching(true);
        setPhase(
          await window.electron.putDestPhaseLinks(phaseId, newDestPhaseLinks),
        );
        await refreshEvent();
      } catch (e: unknown) {
        if (e instanceof Error) {
          openError(e.message);
        }
      } finally {
        setFetching(false);
      }
    },
    [openError, refreshEvent, setPhase],
  );

  const putNumProgressing = useCallback(
    async (
      phaseId: number,
      groupTypeId: number,
      numProgressing: number,
      winnersTargetPhaseId: number,
    ) => {
      try {
        setFetching(true);
        setPhase(
          await window.electron.putNumProgressing(
            phaseId,
            groupTypeId,
            numProgressing,
            winnersTargetPhaseId,
          ),
        );
        await refreshEvent();
      } catch (e: unknown) {
        if (e instanceof Error) {
          openError(e.message);
        }
      } finally {
        setFetching(false);
      }
    },
    [openError, refreshEvent, setPhase],
  );

  const putOriginPhaseLinks = useCallback(
    async (
      phaseId: number,
      newOriginPhaseLinks: (NewOriginPhaseLink | RendererOriginPhaseLink)[],
    ) => {
      try {
        setFetching(true);
        setPhase(
          await window.electron.putOriginPhaseLinks(
            phaseId,
            newOriginPhaseLinks,
          ),
        );
        await refreshEvent();
      } catch (e: unknown) {
        if (e instanceof Error) {
          openError(e.message);
        }
      } finally {
        setFetching(false);
      }
    },
    [openError, refreshEvent, setPhase],
  );

  const originPhaseLinkMenuItems = useMemo(() => {
    const arr: JSX.Element[] = [];
    if (phase === null) {
      return arr;
    }

    Array.from(idToPhase.entries()).forEach(([phaseId, { bracketType }]) => {
      if (phase.id === phaseId) {
        return;
      }

      if (bracketType === 2) {
        arr.push(
          <MenuItem value={`${phaseId}-1`} key={`${phaseId}-1`}>
            {idToPhase.get(phaseId)?.name}
            {getDestBracketSideDesc(1, bracketType)}
          </MenuItem>,
        );
        arr.push(
          <MenuItem value={`${phaseId}-2`} key={`${phaseId}-2`}>
            {idToPhase.get(phaseId)?.name}
            {getDestBracketSideDesc(2, bracketType)}
          </MenuItem>,
        );
      } else {
        arr.push(
          <MenuItem value={`${phaseId}-1`} key={`${phaseId}-1`}>
            {idToPhase.get(phaseId)?.name}
            {getDestBracketSideDesc(1, bracketType)}
          </MenuItem>,
        );
      }
    });
    return arr;
  }, [phase, idToPhase]);

  const showNumProgressing = useMemo(() => {
    if (!phase) {
      return false;
    }
    if (phase.numProgressing === 0) {
      return true;
    }
    if (phase.originPhaseLinks.length === 0) {
      return true;
    }

    // se
    if (phase.bracketType === 1) {
      if (phase.originPhaseLinks.length !== 1) {
        return false;
      }

      const [originPhaseLink] = phase.originPhaseLinks;
      if (originPhaseLink.originLosses !== 0) {
        return false;
      }
      const topN = singleElimPlacementToTopN.get(
        originPhaseLink.originPlacement,
      );
      if (topN === undefined || topN !== phase.numProgressing) {
        return false;
      }
      return true;
    }

    // de
    if (phase.bracketType === 2) {
      if (phase.originPhaseLinks.length === 1) {
        const [originPhaseLink] = phase.originPhaseLinks;
        return (
          originPhaseLink.originLosses === 0 &&
          originPhaseLink.originPlacement === 1
        );
      }
      if (phase.originPhaseLinks.length !== 2) {
        return false;
      }

      const originPhaseLinksWithZeroOriginLosses =
        phase.originPhaseLinks.filter(
          (originPhaseLink) => originPhaseLink.originLosses === 0,
        );
      if (originPhaseLinksWithZeroOriginLosses.length !== 1) {
        return false;
      }
      const [winnersOriginPhaseLink] = originPhaseLinksWithZeroOriginLosses;

      const originPhaseLinksWithOneOriginLoss = phase.originPhaseLinks.filter(
        (originPhaseLink) => originPhaseLink.originLosses === 1,
      );
      if (originPhaseLinksWithOneOriginLoss.length !== 1) {
        return false;
      }
      const [losersOriginPhaseLink] = originPhaseLinksWithOneOriginLoss;

      if (
        winnersOriginPhaseLink.destPhaseId !== losersOriginPhaseLink.destPhaseId
      ) {
        return false;
      }

      // is there also a way to check winnersTopN?
      const losersTopN = losersPlacementToTopN.get(
        losersOriginPhaseLink.originPlacement,
      );
      if (losersTopN === undefined || losersTopN !== phase.numProgressing) {
        return false;
      }
      return true;
    }

    // rr, swiss, custom, ladder
    if (
      phase.bracketType === 3 ||
      phase.bracketType === 4 ||
      phase.bracketType === 6 ||
      phase.bracketType === 7
    ) {
      if (phase.originPhaseLinks.length !== phase.numProgressing) {
        return false;
      }
      if (phase.originPhaseLinks[0].originPlacement !== 1) {
        return false;
      }

      const { destPhaseId } = phase.originPhaseLinks[0];
      for (let i = 1; i < phase.originPhaseLinks.length; i += 1) {
        const originPhaseLink = phase.originPhaseLinks[i];
        const originPlacement = i + 1;
        if (originPhaseLink.originPlacement !== originPlacement) {
          return false;
        }
        if (originPhaseLink.destPhaseId !== destPhaseId) {
          return false;
        }
      }
      return true;
    }

    // elimination rounds don't support progressions
    // exhibition, race, circuit idk
    return false;
  }, [phase]);

  const numProgressingMenuItems = useMemo(() => {
    if (phase === null) {
      return [];
    }

    return bracketTypeToMenuItems(phase.bracketType);
  }, [phase]);

  const destinationPhaseMenuItems = useMemo(() => {
    if (phase === null) {
      return [];
    }

    return Array.from(idToPhase.entries())
      .filter(([phaseId]) => phaseId !== phase.id)
      .map(([phaseId, { name }]) => (
        <MenuItem value={phaseId} key={phaseId}>
          {name}
        </MenuItem>
      ));
  }, [phase, idToPhase]);

  const placementMenuItems = useMemo(() => {
    if (
      phase === null ||
      phase.numProgressing === 0 ||
      phase.originPhaseLinks.some(
        (originPhaseLink) => originPhaseLink.type === 2,
      )
    ) {
      return [];
    }

    const placements = getPlacements(
      getNextPlacement(phase),
      phase.bracketType,
    );
    return [
      <MenuItem value="remainder" key="remainder">
        Remainder
      </MenuItem>,
    ].concat(
      placements.map((placement) => (
        <MenuItem value={placement} key={placement}>
          {withOrdinalSuffix(placement)}
        </MenuItem>
      )),
    );
  }, [phase]);

  const [numProgressing, setNumProgressing] = useState(0);
  const [normalDestinationPhaseId, setNormalDestinationPhaseId] = useState(0);
  const [placement, setPlacement] = useState<number | 'remainder'>('remainder');
  const [losersDestinationPhaseId, setLosersDestinationPhaseId] = useState('');
  useEffect(() => {
    if (phase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNumProgressing(
        phase.originPhaseLinks.length === 0 ? 0 : phase.numProgressing,
      );
      setNormalDestinationPhaseId(phase.winnersTargetPhaseId ?? 0);
      setPlacement(getNextPlacement(phase));
      setLosersDestinationPhaseId(`${phase.winnersTargetPhaseId ?? 0}-1`);
    }
  }, [phase]);

  return (
    <Dialog
      open={phase !== null}
      onClose={() => {
        setPhase(null);
      }}
    >
      {phase && (
        <DialogContent
          style={{
            display: 'flex',
            flexDirection: 'column',
            paddingRight: '16px',
          }}
        >
          <Typography variant="h5">{phase.name}</Typography>
          <Typography variant="caption">
            {getBracketTypeDesc(phase.bracketType)} x{phase.groupCount}
          </Typography>
          {phase.destPhaseLinks.length > 0 && (
            <>
              <Divider textAlign="right">
                <DialogContentText>In</DialogContentText>
              </Divider>
              <List disablePadding>
                {phase.destPhaseLinks.map((destPhaseLink, index) => (
                  <ListItem key={destPhaseLink.id} disableGutters>
                    <ListItemText>
                      {destPhaseLink.numSeeds}
                      {': '}
                      {destPhaseLink.type === 3
                        ? 'Seeded'
                        : idToPhase.get(destPhaseLink.originPhaseId)?.name}
                      {destPhaseLink.type !== 3 &&
                        getDestPhaseLinkOriginBracketSideDesc(
                          idToPhase.get(destPhaseLink.originPhaseId)!
                            .bracketType,
                          destPhaseLink,
                        )}
                    </ListItemText>
                    {phase.bracketType === 2 && (
                      <Select
                        disabled={fetching}
                        size="small"
                        style={{ marginLeft: '8px' }}
                        value={destPhaseLink.destBracketSide}
                        onChange={(event) => {
                          const newDestPhaseLinks = structuredClone(
                            phase.destPhaseLinks,
                          );

                          const destBracketSide = event.target.value;
                          let destSeedOrder = 99;
                          if (
                            phase.bracketType === 2 &&
                            destBracketSide === 1
                          ) {
                            for (
                              let i = 0;
                              i < phase.destPhaseLinks.length;
                              i += 1
                            ) {
                              if (phase.destPhaseLinks[i].destBracketSide > 1) {
                                destSeedOrder = i - 1;
                                break;
                              }
                            }
                          }

                          for (const newDestPhaseLink of newDestPhaseLinks) {
                            if (newDestPhaseLink.id === destPhaseLink.id) {
                              newDestPhaseLink.destBracketSide =
                                destBracketSide;
                              newDestPhaseLink.destSeedOrder = destSeedOrder;
                            }
                          }
                          putDestPhaseLinks(phase.id, newDestPhaseLinks);
                        }}
                      >
                        <MenuItem value={1}>Winners</MenuItem>
                        <MenuItem value={2}>Losers</MenuItem>
                      </Select>
                    )}
                    <IconButton
                      disabled={
                        fetching ||
                        index === 0 ||
                        phase.destPhaseLinks[index - 1].destBracketSide <
                          destPhaseLink.destBracketSide
                      }
                      onClick={() => {
                        const newDestPhaseLinks = structuredClone(
                          phase.destPhaseLinks,
                        );
                        newDestPhaseLinks[index - 1].destSeedOrder += 1;
                        newDestPhaseLinks[index].destSeedOrder -= 1;
                        putDestPhaseLinks(phase.id, newDestPhaseLinks);
                      }}
                    >
                      <ArrowUpward />
                    </IconButton>
                    <IconButton
                      disabled={
                        fetching ||
                        index === phase.destPhaseLinks.length - 1 ||
                        phase.destPhaseLinks[index + 1].destBracketSide >
                          destPhaseLink.destBracketSide
                      }
                      onClick={() => {
                        const newDestPhaseLinks = structuredClone(
                          phase.destPhaseLinks,
                        );
                        newDestPhaseLinks[index].destSeedOrder += 1;
                        newDestPhaseLinks[index + 1].destSeedOrder -= 1;
                        putDestPhaseLinks(phase.id, newDestPhaseLinks);
                      }}
                    >
                      <ArrowDownward />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            </>
          )}
          <Divider textAlign="right">
            <DialogContentText>Out</DialogContentText>
          </Divider>
          {phase.originPhaseLinks.length > 0 && (
            <List disablePadding>
              {phase.originPhaseLinks.map((originPhaseLink) => (
                <ListItem key={originPhaseLink.id} disableGutters>
                  <ListItemText>
                    {getOriginPhaseLinkTypeDesc(
                      originPhaseLink,
                      phase.bracketType,
                    )}
                  </ListItemText>
                  <Select
                    disabled={fetching}
                    size="small"
                    style={{ marginLeft: '8px' }}
                    value={`${originPhaseLink.destPhaseId}-${originPhaseLink.destBracketSide}`}
                    onChange={(event) => {
                      const [destPhaseId, destBracketSide] = event.target.value
                        .split('-')
                        .map((str) => Number.parseInt(str, 10));
                      const newOriginPhaseLinks = structuredClone(
                        phase.originPhaseLinks,
                      );

                      let destSeedOrder = 99;
                      const destPhase = idToPhase.get(destPhaseId);
                      if (
                        destPhase &&
                        destPhase.bracketType === 2 &&
                        destBracketSide === 1
                      ) {
                        for (
                          let i = 0;
                          i < destPhase.destPhaseLinks.length;
                          i += 1
                        ) {
                          if (destPhase.destPhaseLinks[i].destBracketSide > 1) {
                            destSeedOrder = i - 1;
                            break;
                          }
                        }
                      }

                      for (const newOriginPhaseLink of newOriginPhaseLinks) {
                        if (newOriginPhaseLink.id === originPhaseLink.id) {
                          newOriginPhaseLink.destPhaseId = destPhaseId;
                          newOriginPhaseLink.destBracketSide = destBracketSide;
                          newOriginPhaseLink.destSeedOrder = destSeedOrder;
                        }
                      }
                      putOriginPhaseLinks(phase.id, newOriginPhaseLinks);
                    }}
                  >
                    {originPhaseLinkMenuItems}
                  </Select>
                  <IconButton
                    disabled={fetching || showNumProgressing}
                    onClick={() => {
                      const newOriginPhaseLinks = structuredClone(
                        phase.originPhaseLinks,
                      ).filter(
                        (newOriginPhaseLink) =>
                          newOriginPhaseLink.id !== originPhaseLink.id,
                      );
                      if (newOriginPhaseLinks.length === 0) {
                        putNumProgressing(
                          phase.id,
                          phase.bracketType,
                          /* numProgressing= */ 0,
                          /* winnersTargetPhaseId= */ 0,
                        );
                      } else {
                        putOriginPhaseLinks(phase.id, newOriginPhaseLinks);
                      }
                    }}
                  >
                    <DeleteForever />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          )}
          {showNumProgressing &&
            numProgressingMenuItems.length > 0 &&
            destinationPhaseMenuItems.length > 0 && (
              <Stack
                direction="row"
                style={{
                  alignSelf: 'end',
                  gap: '8px',
                  paddingTop: '12px',
                  marginBottom: '16px',
                }}
              >
                <FormControl>
                  <InputLabel id="num-progressing-input-label">
                    Per Pool
                  </InputLabel>
                  <Select
                    disabled={fetching}
                    label="Per Pool"
                    labelId="num-progressing-input-label"
                    name="numProgressing"
                    size="small"
                    style={{ width: '126px' }}
                    value={numProgressing}
                    onChange={(ev) => {
                      setNumProgressing(ev.target.value);
                    }}
                  >
                    {numProgressingMenuItems}
                  </Select>
                </FormControl>
                <FormControl>
                  <InputLabel id="num-progressing-destination-phase-input-label">
                    Destination Phase
                  </InputLabel>
                  <Select
                    disabled={fetching}
                    label="Destination Phase"
                    labelId="num-progressing-destination-phase-input-label"
                    name="winnersTargetPhaseId"
                    size="small"
                    style={{ width: '228px' }}
                    value={normalDestinationPhaseId}
                    onChange={(ev) => {
                      setNormalDestinationPhaseId(ev.target.value);
                    }}
                  >
                    {destinationPhaseMenuItems}
                  </Select>
                </FormControl>
                <Button
                  disabled={fetching}
                  variant="contained"
                  style={{ width: '70px' }}
                  onClick={() => {
                    if (normalDestinationPhaseId === 0) {
                      return;
                    }

                    putNumProgressing(
                      phase.id,
                      phase.bracketType,
                      numProgressing,
                      normalDestinationPhaseId,
                    );
                  }}
                >
                  Save
                </Button>
              </Stack>
            )}
          {phase.numProgressing > 0 &&
            phase.originPhaseLinks.length > 0 &&
            placementMenuItems.length > 0 && (
              <>
                <Divider textAlign="right">
                  <DialogContentText variant="caption">
                    Losers Progressions
                  </DialogContentText>
                </Divider>
                <Stack
                  direction="row"
                  style={{
                    alignSelf: 'end',
                    gap: '8px',
                    paddingTop: '12px',
                  }}
                >
                  <FormControl>
                    <InputLabel id="placement-input-label">
                      Placement
                    </InputLabel>
                    <Select
                      disabled={fetching}
                      label="Placement"
                      labelId="placement-input-label"
                      name="placement"
                      size="small"
                      style={{ width: '126px' }}
                      value={placement}
                      onChange={(ev) => {
                        setPlacement(ev.target.value);
                      }}
                    >
                      {placementMenuItems}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <InputLabel id="losers-progression-destination-phase-input-label">
                      Destination Phase
                    </InputLabel>
                    <Select
                      disabled={fetching}
                      label="Destination Phase"
                      labelId="losers-progression-destination-phase-input-label"
                      name="destPhaseId"
                      size="small"
                      style={{ width: '228px' }}
                      value={losersDestinationPhaseId}
                      onChange={(ev) => {
                        setLosersDestinationPhaseId(ev.target.value);
                      }}
                    >
                      {originPhaseLinkMenuItems}
                    </Select>
                  </FormControl>
                  <Button
                    disabled={fetching}
                    variant="contained"
                    style={{ width: '70px' }}
                    onClick={() => {
                      const [destPhaseIdStr, destBracketSideStr] =
                        losersDestinationPhaseId.split('-');
                      if (!destPhaseIdStr || !destBracketSideStr) {
                        return;
                      }

                      const destPhaseId = Number.parseInt(destPhaseIdStr, 10);
                      const destBracketSide = Number.parseInt(
                        destBracketSideStr,
                        10,
                      );

                      let originLosses = null;
                      if (phase.bracketType === 1) {
                        originLosses = 1;
                      } else if (phase.bracketType === 2) {
                        originLosses = 2;
                      }

                      let destSeedOrder = 99;
                      const destPhase = idToPhase.get(destPhaseId);
                      if (
                        destPhase &&
                        destPhase.bracketType === 2 &&
                        destBracketSide === 1
                      ) {
                        for (
                          let i = 0;
                          i < destPhase.destPhaseLinks.length;
                          i += 1
                        ) {
                          if (destPhase.destPhaseLinks[i].destBracketSide > 1) {
                            destSeedOrder = i;
                            break;
                          }
                        }
                      }

                      const newOriginPhaseLinks = structuredClone(
                        phase.originPhaseLinks,
                      ) as (NewOriginPhaseLink | RendererOriginPhaseLink)[];
                      if (placement === 'remainder') {
                        const newOriginPhaseLink: NewOriginPhaseLink = {
                          cId: `${phase.id}-${destSeedOrder}`,
                          destPhaseId,
                          destBracketSide,
                          type: 2,
                          originPlacement: getNextPlacement(phase),
                          originPhaseId: phase.id,
                          originLosses,
                          maintainMatchup: false,
                          isDefault: false,
                          destSeedOrder,
                        };
                        newOriginPhaseLinks.push(newOriginPhaseLink);
                      } else {
                        const newOriginPhaseLink: NewOriginPhaseLink = {
                          cId: `${phase.id}-${destSeedOrder}`,
                          destPhaseId,
                          destBracketSide,
                          type: 1,
                          originPlacement: placement,
                          originPhaseId: phase.id,
                          originLosses,
                          maintainMatchup: false,
                          isDefault: false,
                          destSeedOrder,
                        };
                        newOriginPhaseLinks.push(newOriginPhaseLink);
                      }
                      putOriginPhaseLinks(phase.id, newOriginPhaseLinks);
                    }}
                  >
                    Add
                  </Button>
                </Stack>
              </>
            )}
        </DialogContent>
      )}
    </Dialog>
  );
}
