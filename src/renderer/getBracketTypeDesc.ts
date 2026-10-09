export default function getBracketTypeDesc(bracketType: number) {
  switch (bracketType) {
    case 1:
      return 'Single Elimination';
    case 2:
      return 'Double Elimination';
    case 3:
      return 'Round Robin';
    case 4:
      return 'Swiss';
    case 5:
      // idk
      return 'Exhibition';
    case 6:
      return 'Custom Schedule';
    case 7:
      return 'Matchmaking Ladder';
    case 8:
      return 'Elimination Rounds';
    case 9:
      // idk
      return 'Race';
    case 10:
      // idk
      return 'Circuit';
    default:
      return 'UNKNOWN';
  }
}
