import { Track, Album } from '@/lib/types/album';

/**
 * Extended track with album context for display
 */
export interface TrackWithContext extends Track {
  albumTitle: string;
  albumArtist: string;
  albumCoverArt: string;
  albumFeedId: string;
}

/**
 * Band information aggregated from tracks
 */
export interface Band {
  name: string;
  tracks: TrackWithContext[];
  trackCount: number;
  shows: string[]; // Album titles this band appeared in
  coverArt: string; // First track's image or album cover
}

/**
 * Band set - one band's performance at one specific show
 */
export interface BandSet {
  bandName: string;
  showName: string; // Album title
  tracks: TrackWithContext[];
  trackCount: number;
  coverArt: string;
  videoCount: number;
  audioCount: number;
}

/**
 * Parse band name from track title
 * Expected format: "Band Name - Song Title"
 * Returns null if no band name pattern is found
 */
export function parseBandName(title: string): string | null {
  if (!title) return null;

  // Pattern: "Band Name - Song Title"
  // Use a non-greedy match to get the first part before " - "
  const match = title.match(/^(.+?)\s+-\s+.+$/);
  return match ? match[1].trim() : null;
}

/**
 * Parse duration string to seconds
 * Supports formats: "HH:MM:SS", "MM:SS", "SS"
 */
export function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;

  const parts = duration.split(':').map(Number);

  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    // SS
    return parts[0];
  }

  return 0;
}

/**
 * Determine if a track is a full show
 * Full shows are identified by:
 * - No band name pattern (no " - " in title) OR
 * - Very long duration (> 1 hour)
 */
export function isFullShow(track: Track): boolean {
  const hasBandPattern = parseBandName(track.title) !== null;
  const durationSeconds = parseDurationToSeconds(track.duration);
  const isLongDuration = durationSeconds > 3600; // > 1 hour

  // It's a full show if it doesn't have the "Band - Song" pattern
  // OR if it's very long (even if it has a hyphen for other reasons)
  return !hasBandPattern || isLongDuration;
}

/**
 * Determine if a track is a band set (individual band performance)
 * Band sets have the "Band Name - Song Title" format and are shorter than 1 hour
 */
export function isBandSet(track: Track): boolean {
  const hasBandPattern = parseBandName(track.title) !== null;
  const durationSeconds = parseDurationToSeconds(track.duration);
  const isShortEnough = durationSeconds <= 3600; // <= 1 hour

  return hasBandPattern && isShortEnough;
}

/**
 * Extract all tracks with album context from albums
 */
export function extractAllTracks(albums: Album[]): TrackWithContext[] {
  const tracks: TrackWithContext[] = [];

  albums.forEach(album => {
    album.tracks.forEach(track => {
      tracks.push({
        ...track,
        albumTitle: album.title,
        albumArtist: album.artist,
        albumCoverArt: album.coverArt,
        albumFeedId: album.feedId,
      });
    });
  });

  return tracks;
}

/**
 * Extract all video tracks from albums
 */
export function extractVideoTracks(albums: Album[]): TrackWithContext[] {
  return extractAllTracks(albums).filter(track => track.mediaType === 'video');
}

/**
 * Extract all audio tracks from albums
 */
export function extractAudioTracks(albums: Album[]): TrackWithContext[] {
  return extractAllTracks(albums).filter(track =>
    track.mediaType === 'audio' || !track.mediaType
  );
}

/**
 * Extract full show tracks from albums
 */
export function extractFullShowTracks(albums: Album[]): TrackWithContext[] {
  return extractAllTracks(albums).filter(track => isFullShow(track));
}

/**
 * Extract individual band set tracks (not grouped)
 * Sorted alphabetically by band name (parsed from title)
 */
export function extractBandSetTracks(albums: Album[]): TrackWithContext[] {
  return extractAllTracks(albums)
    .filter(track => isBandSet(track))
    .sort((a, b) => {
      const bandA = parseBandName(a.title) || a.title;
      const bandB = parseBandName(b.title) || b.title;
      return bandA.localeCompare(bandB);
    });
}

/**
 * Extract band sets grouped by band name + show name
 * Each entry represents one band's complete performance at one show
 * Sorted alphabetically by band name, then by show name
 */
export function extractBandSets(albums: Album[]): BandSet[] {
  const bandSetMap = new Map<string, BandSet>();

  albums.forEach(album => {
    album.tracks.forEach(track => {
      const bandName = parseBandName(track.title);

      if (bandName && isBandSet(track)) {
        // Create unique key for band + show combination
        const key = `${bandName}|||${album.title}`;

        const trackWithContext: TrackWithContext = {
          ...track,
          albumTitle: album.title,
          albumArtist: album.artist,
          albumCoverArt: album.coverArt,
          albumFeedId: album.feedId,
        };

        if (bandSetMap.has(key)) {
          const bandSet = bandSetMap.get(key)!;
          bandSet.tracks.push(trackWithContext);
          bandSet.trackCount++;
          if (track.mediaType === 'video') {
            bandSet.videoCount++;
          } else {
            bandSet.audioCount++;
          }
        } else {
          bandSetMap.set(key, {
            bandName,
            showName: album.title,
            tracks: [trackWithContext],
            trackCount: 1,
            coverArt: track.image || album.coverArt,
            videoCount: track.mediaType === 'video' ? 1 : 0,
            audioCount: track.mediaType === 'video' ? 0 : 1,
          });
        }
      }
    });
  });

  // Sort by band name, then by show name
  return Array.from(bandSetMap.values()).sort((a, b) => {
    const bandCompare = a.bandName.localeCompare(b.bandName);
    if (bandCompare !== 0) return bandCompare;
    return a.showName.localeCompare(b.showName);
  });
}

/**
 * Extract and group bands from all albums
 */
export function extractBands(albums: Album[]): Band[] {
  const bandMap = new Map<string, Band>();

  albums.forEach(album => {
    album.tracks.forEach(track => {
      const bandName = parseBandName(track.title);

      if (bandName && isBandSet(track)) {
        const trackWithContext: TrackWithContext = {
          ...track,
          albumTitle: album.title,
          albumArtist: album.artist,
          albumCoverArt: album.coverArt,
          albumFeedId: album.feedId,
        };

        if (bandMap.has(bandName)) {
          const band = bandMap.get(bandName)!;
          band.tracks.push(trackWithContext);
          band.trackCount++;
          if (!band.shows.includes(album.title)) {
            band.shows.push(album.title);
          }
        } else {
          bandMap.set(bandName, {
            name: bandName,
            tracks: [trackWithContext],
            trackCount: 1,
            shows: [album.title],
            coverArt: track.image || album.coverArt,
          });
        }
      }
    });
  });

  // Sort bands alphabetically by name
  return Array.from(bandMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}
