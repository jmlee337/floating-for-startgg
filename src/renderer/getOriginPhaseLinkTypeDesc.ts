import {
  losersPlacementToTopN,
  singleElimPlacementToTopN,
} from '../common/constants';
import { RendererOriginPhaseLink } from '../common/types';
import withOrdinalSuffix from './withOrdinalSuffix';

export default function getOriginPhaseLinkTypeDesc(
  originPhaseLink: RendererOriginPhaseLink,
  bracketType: number,
) {
  if (originPhaseLink.type === 1) {
    if (originPhaseLink.originPlacement === null) {
      throw new Error('Unexpected null originPlacement');
    }
    if (bracketType === 1) {
      if (originPhaseLink.originLosses === 0) {
        if (originPhaseLink.originPlacement === 1) {
          return `First`;
        }
        const topN = singleElimPlacementToTopN.get(
          originPhaseLink.originPlacement,
        );
        if (topN === undefined) {
          throw new Error(
            `Unexpected: ${withOrdinalSuffix(originPhaseLink.originPlacement)} place`,
          );
        }
        return `Top ${topN}`;
      }
      return withOrdinalSuffix(originPhaseLink.originPlacement);
    }
    if (bracketType === 2) {
      if (originPhaseLink.originLosses === 0) {
        if (originPhaseLink.originPlacement <= 2) {
          return `1st (W)`;
        }
        return `Top ${originPhaseLink.originPlacement - 1} (W)`;
      }
      if (originPhaseLink.originLosses === 1) {
        if (originPhaseLink.originPlacement === 2) {
          return '2nd (L)';
        }
        const topN = losersPlacementToTopN.get(originPhaseLink.originPlacement);
        if (topN === undefined) {
          throw new Error(
            `Unexpected: ${withOrdinalSuffix(originPhaseLink.originPlacement)} place`,
          );
        }
        return `Top ${topN} (L)`;
      }
      return withOrdinalSuffix(originPhaseLink.originPlacement);
    }
    return withOrdinalSuffix(originPhaseLink.originPlacement);
  }
  if (originPhaseLink.type === 2) {
    return 'Remainder';
  }
  throw new Error(`Unexpected${originPhaseLink.type} type`);
}
