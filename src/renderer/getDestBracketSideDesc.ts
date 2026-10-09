export default function getDestBracketSideDesc(
  destBracketSide: number,
  destBracketType: number | undefined,
) {
  let destBracketSideDesc = '';
  if (destBracketType === 2) {
    if (destBracketSide === 1) {
      destBracketSideDesc = ' (W)';
    } else {
      destBracketSideDesc = ' (L)';
    }
  }
  return destBracketSideDesc;
}
