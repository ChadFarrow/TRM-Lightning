import { RSSValue } from '@/lib/rss-parser';
import { PaymentRecipient, PublisherInfo } from './album';

/**
 * Podcast transcript interface (podcast:transcript)
 */
export interface PodcastTranscript {
  url: string;
  type: 'application/srt' | 'application/json' | 'text/vtt' | 'text/plain' | 'text/html';
  language?: string;
  rel?: 'captions';
}

/**
 * Podcast person interface (podcast:person)
 */
export interface PodcastPerson {
  name: string;
  role?: string;
  group?: string;
  img?: string;
  href?: string;
}

/**
 * Podcast soundbite interface (podcast:soundbite)
 */
export interface PodcastSoundbite {
  startTime: number;
  duration: number;
  title?: string;
}

/**
 * Podcast chapter interface (from podcast:chapters JSON)
 */
export interface PodcastChapter {
  startTime: number;
  endTime?: number;
  title: string;
  img?: string;
  url?: string;
  toc?: boolean;
}

/**
 * Podcast location interface (podcast:location)
 */
export interface PodcastLocation {
  name: string;
  geo?: string;
  osm?: string;
}

/**
 * Podcast license interface (podcast:license)
 */
export interface PodcastLicense {
  type: string;
  url?: string;
}

/**
 * Podcast alternate enclosure interface (podcast:alternateEnclosure)
 */
export interface PodcastAlternateEnclosure {
  type: string;
  length?: number;
  bitrate?: number;
  height?: number;
  lang?: string;
  title?: string;
  rel?: string;
  codecs?: string;
  default?: boolean;
  sources: {
    uri: string;
    contentType?: string;
  }[];
}

/**
 * Podcast value time split interface (podcast:valueTimeSplit)
 */
export interface PodcastValueTimeSplit {
  startTime: number;
  duration: number;
  remoteStartTime?: number;
  remotePercentage?: number;
  recipients?: PaymentRecipient[];
}

/**
 * Episode interface - represents a single podcast episode
 */
export interface Episode {
  // Core fields (shared with Track)
  title: string;
  duration: string;
  url: string;
  episodeNumber?: number;

  // Podcast-specific metadata
  season?: number;
  episodeType?: 'full' | 'trailer' | 'bonus';
  explicit?: boolean;

  // Description content
  description?: string;
  subtitle?: string;
  summary?: string;

  // Media details
  image?: string;
  mediaType: 'audio' | 'video';
  mimeType?: string;

  // Podcasting 2.0 features
  transcripts?: PodcastTranscript[];
  chapters?: PodcastChapter[];
  chaptersUrl?: string;
  persons?: PodcastPerson[];
  soundbites?: PodcastSoundbite[];
  location?: PodcastLocation;
  alternateEnclosures?: PodcastAlternateEnclosure[];
  valueTimeSplits?: PodcastValueTimeSplit[];

  // Lightning payment
  value?: RSSValue;
  paymentRecipients?: PaymentRecipient[];

  // GUIDs for identification and Nostr boost tagging
  guid?: string;
  podcastGuid?: string;
  feedGuid?: string;
  feedUrl?: string;
  publisherGuid?: string;
  publisherUrl?: string;

  // Publication date
  pubDate?: string;

  // Link to episode page
  link?: string;
}

/**
 * Podcast interface - represents a complete podcast show
 */
export interface Podcast {
  // Core fields
  title: string;
  author: string;
  description: string;
  coverArt: string;
  episodes: Episode[];

  // Feed metadata
  feedId: string;
  feedUrl: string;
  feedGuid?: string;

  // Podcast metadata
  subtitle?: string;
  summary?: string;
  language?: string;
  copyright?: string;
  explicit?: boolean;

  // Categories
  categories?: string[];
  keywords?: string[];

  // Owner information
  owner?: {
    name?: string;
    email?: string;
  };

  // Podcasting 2.0 features
  persons?: PodcastPerson[];
  location?: PodcastLocation;
  license?: PodcastLicense;
  funding?: {
    url: string;
    message?: string;
  }[];
  locked?: {
    locked: boolean;
    owner?: string;
  };

  // Lightning payment
  value?: RSSValue;
  paymentRecipients?: PaymentRecipient[];

  // Publisher information
  publisher?: PublisherInfo;
  publisherGuid?: string;
  publisherUrl?: string;

  // Timestamps
  lastBuildDate?: string;
  pubDate?: string;

  // Medium type (for distinguishing from music)
  medium: 'podcast';
}

/**
 * Type guard to check if content is a Podcast
 */
export function isPodcast(content: any): content is Podcast {
  return content && content.medium === 'podcast' && Array.isArray(content.episodes);
}

/**
 * Type guard to check if content is an Episode
 */
export function isEpisode(content: any): content is Episode {
  return content && typeof content.title === 'string' && typeof content.url === 'string' && content.mediaType !== undefined;
}
