import * as fs from 'fs';

const json = JSON.parse(fs.readFileSync('./public/static-albums.json', 'utf8'));
const data = json.albums || json;

function parseBandName(title: string): string | null {
  if (!title) return null;
  const match = title.match(/^(.+?)\s+-\s+.+$/);
  return match ? match[1].trim() : null;
}

function parseDuration(duration: string): number {
  if (!duration) return 0;
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

data.forEach((album: any) => {
  console.log('\n=== ' + album.title + ' ===');
  console.log('Tracks: ' + album.tracks.length);

  let fullShows = 0, bandSets = 0, videos = 0, audio = 0;

  album.tracks.slice(0, 5).forEach((t: any, i: number) => {
    const hasBand = parseBandName(t.title) !== null;
    const duration = parseDuration(t.duration);
    const isLong = duration > 3600;
    const isFS = !hasBand || isLong;
    const isBS = hasBand && !isLong;

    console.log(`  ${i+1}. "${t.title}" - ${t.duration} (${duration}s) | mediaType: ${t.mediaType || 'undefined'} | band: ${hasBand} | fullShow: ${isFS} | bandSet: ${isBS}`);
  });

  album.tracks.forEach((t: any) => {
    const hasBand = parseBandName(t.title) !== null;
    const isLong = parseDuration(t.duration) > 3600;
    const isFS = !hasBand || isLong;
    const isBS = hasBand && !isLong;

    if (isFS) fullShows++;
    if (isBS) bandSets++;
    if (t.mediaType === 'video') videos++;
    if (t.mediaType === 'audio' || !t.mediaType) audio++;
  });

  console.log(`TOTALS - Full Shows: ${fullShows}, Band Sets: ${bandSets}, Videos: ${videos}, Audio: ${audio}`);
});
