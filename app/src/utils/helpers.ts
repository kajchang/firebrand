export function partyToColor(party: string): string {
  const COLOR_MAP = {
    'Democratic': '#0015bc',
    'Republican': '#e91d0e',
    'Libertarian': '#fed105',
    'Green': '#508c1b'
  };

  const partyParts = party.split(/\s+/);
  const partyName = partyParts.slice(0, partyParts.length - 1).join(' ');
  return COLOR_MAP[partyName] || '#d3d3d3';
}
