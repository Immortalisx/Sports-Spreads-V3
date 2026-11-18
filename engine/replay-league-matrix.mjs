/** Manual research replay selection; no provider access or production writes. */
export function replayLeagueMatrix(selection) {
  switch (selection) {
    case 'nfl': return {league:['nfl']};
    case 'nhl': return {league:['nhl']};
    case 'both': return {league:['nfl','nhl']};
    default: throw new Error('Invalid replay league: expected nfl, nhl or both');
  }
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const matrix = JSON.stringify(replayLeagueMatrix(process.argv[2]));
  console.log('matrix=' + matrix);
}
