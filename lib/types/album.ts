import { RSSValue, RSSValueRecipient } from '@/lib/rss-parser';

/**
 * Payment recipient interface for Lightning Network payments
 */
export interface PaymentRecipient {
  address: string;
  split: number;
  name?: string;
  fee?: boolean;
  type?: string;
  fixedAmount?: number;
}

/**
 * RSS funding information
 */
export interface RSSFunding {
  url: string;
  message?: string;
}

/**
 * Publisher information
 */
export interface PublisherInfo {
  feedGuid: string;
  feedUrl: string;
  medium: string;
}

/**
 * Track interface - represents a single track/song
 */
export interface Track {
  title: string;
  duration: string;
  url: string;
  trackNumber: number;
  image?: string;
  artist?: string; // Artist name (often added when tracks are played from albums)
  album?: string; // Album name (often added when tracks are played from albums)
  mediaType?: 'audio' | 'video'; // Type of media (default: audio)
  mimeType?: string; // MIME type from RSS enclosure
  value?: RSSValue; // Track-level podcast:value data
  paymentRecipients?: PaymentRecipient[]; // Pre-processed track payment recipients
  // Podcast GUIDs for Nostr boost tagging
  guid?: string; // Standard item GUID
  podcastGuid?: string; // podcast:guid at item level
  feedGuid?: string; // Feed-level GUID
  feedUrl?: string; // Feed URL for this track
  publisherGuid?: string; // Publisher GUID
  publisherUrl?: string; // Publisher URL
  imageUrl?: string; // Track artwork URL
}

/**
 * Album interface - represents a complete album/collection
 */
export interface Album {
  title: string;
  artist: string;
  description: string;
  coverArt: string;
  tracks: Track[];
  releaseDate: string;
  feedId: string;
  feedUrl?: string;
  funding?: RSSFunding[];
  value?: RSSValue; // Album-level podcast:value data
  paymentRecipients?: PaymentRecipient[]; // Pre-processed album payment recipients
  publisher?: PublisherInfo;
  // Podcast GUIDs for Nostr boost tagging
  feedGuid?: string; // Feed-level GUID
  publisherGuid?: string; // Publisher GUID
  publisherUrl?: string; // Publisher URL
  imageUrl?: string; // Album artwork URL
}

/**
 * Publisher interface - represents a music publisher/feed
 */
export interface Publisher {
  name: string;
  guid: string;
  feedUrl: string;
  medium: string;
  albums: Album[];
  albumCount?: number;
  firstAlbumCover?: string;
}

