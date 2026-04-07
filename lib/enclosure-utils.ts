import { PodcastAlternateEnclosure } from '@/lib/types/podcast';

/**
 * Get a human-readable label for an alternate enclosure
 */
export function getEnclosureLabel(enclosure: PodcastAlternateEnclosure): string {
  if (enclosure.title) return enclosure.title;

  const parts: string[] = [];

  // Determine format name from MIME type
  if (enclosure.type.startsWith('video/')) {
    parts.push('Video');
  } else if (enclosure.type.startsWith('audio/')) {
    parts.push('Audio');
  }

  // Add format detail
  const formatMap: Record<string, string> = {
    'audio/mpeg': 'MP3',
    'audio/mp4': 'AAC',
    'audio/aac': 'AAC',
    'audio/ogg': 'OGG',
    'audio/opus': 'Opus',
    'audio/flac': 'FLAC',
    'audio/wav': 'WAV',
    'video/mp4': 'MP4',
    'video/webm': 'WebM',
    'application/x-mpegURL': 'HLS',
  };
  const format = formatMap[enclosure.type];
  if (format) {
    parts.push(`(${format})`);
  }

  if (enclosure.height) {
    parts.push(`${enclosure.height}p`);
  }
  if (enclosure.bitrate) {
    parts.push(`${enclosure.bitrate}kbps`);
  }

  return parts.join(' ') || enclosure.type;
}

/**
 * Get the best HTTP(S) source URI from an enclosure, filtering out non-HTTP transports
 */
export function selectBestSource(enclosure: PodcastAlternateEnclosure): string | null {
  for (const source of enclosure.sources) {
    if (source.uri.startsWith('http://') || source.uri.startsWith('https://')) {
      return source.uri;
    }
  }
  return enclosure.sources[0]?.uri || null;
}

/**
 * Determine the mediaType for an enclosure based on its MIME type
 */
export function getMediaType(mimeType: string): 'audio' | 'video' {
  if (mimeType.startsWith('video/') || mimeType === 'application/x-mpegURL') {
    return 'video';
  }
  return 'audio';
}
