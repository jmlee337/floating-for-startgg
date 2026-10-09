import { RendererDestPhaseLink } from '../common/types';
import withOrdinalSuffix from './withOrdinalSuffix';

export default function getDestPhaseLinkOriginBracketSideDesc(
  originBracketType: number,
  destPhaseLink: RendererDestPhaseLink,
) {
  if (destPhaseLink.type === 1) {
    if (originBracketType === 1) {
      return destPhaseLink.originLosses === 0
        ? ' (W)'
        : ` (${withOrdinalSuffix(destPhaseLink.originPlacement!)})`;
    }
    if (originBracketType === 2) {
      if (destPhaseLink.originLosses === 0) {
        return ' (W)';
      }
      if (destPhaseLink.originLosses === 1) {
        return ' (L)';
      }
      return ` (${withOrdinalSuffix(destPhaseLink.originPlacement!)})`;
    }
    return ` (${withOrdinalSuffix(destPhaseLink.originPlacement!)})`;
  }
  if (destPhaseLink.type === 2) {
    return ' (Remainder)';
  }
  throw new Error(`Unexpected${destPhaseLink.type} type`);
}
