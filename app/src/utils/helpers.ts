export function partyToColor(party: string): string {
  const COLOR_MAP = {
    'Democratic': '#0015bc',
    'Republican': '#e91d0e',
    'Libertarian': '#fed105',
    'Green': '#508c1b'
  };

  for (let [partyId, color] of Object.entries(COLOR_MAP)) {
    if (new RegExp(partyId, 'g').test(party)) {
      return color;
    }
  }

  return '#d3d3d3';
}
