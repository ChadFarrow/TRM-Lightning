import { PodcastParser } from './podcast-parser';
import type { Podcast, Episode } from './types/podcast';
import { generateSlug } from './url-utils';

// Import podcast feeds from configuration file
import podcastFeedsConfig from '@/data/podcast-feeds.json';

// In-memory cache for podcasts
interface PodcastCache {
  podcasts: Podcast[];
  lastUpdated: number;
  ttl: number;
}

let podcastCache: PodcastCache | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Podcast feed URLs loaded from configuration
const PODCAST_FEEDS: string[] = [...podcastFeedsConfig];

/**
 * Get podcast feed URLs
 */
export function getPodcastFeedUrls(): string[] {
  return [...PODCAST_FEEDS];
}

/**
 * Add a podcast feed URL
 */
export function addPodcastFeed(feedUrl: string): void {
  if (!PODCAST_FEEDS.includes(feedUrl)) {
    PODCAST_FEEDS.push(feedUrl);
    // Invalidate cache when feeds change
    podcastCache = null;
  }
}

/**
 * Remove a podcast feed URL
 */
export function removePodcastFeed(feedUrl: string): void {
  const index = PODCAST_FEEDS.indexOf(feedUrl);
  if (index > -1) {
    PODCAST_FEEDS.splice(index, 1);
    // Invalidate cache when feeds change
    podcastCache = null;
  }
}

/**
 * Fetch all podcasts from configured feeds
 */
export async function fetchPodcasts(options?: {
  forceRefresh?: boolean;
  feedUrls?: string[];
}): Promise<Podcast[]> {
  const { forceRefresh = false, feedUrls } = options || {};
  const urls = feedUrls || PODCAST_FEEDS;

  // Check cache
  if (!forceRefresh && podcastCache && Date.now() - podcastCache.lastUpdated < podcastCache.ttl) {
    console.log('📻 Returning cached podcasts (cache hit)');
    return podcastCache.podcasts;
  }

  const startTime = performance.now();
  console.log(`📻 Fetching ${urls.length} podcast feed(s)...`);

  const podcasts: Podcast[] = [];

  // Fetch all feeds in parallel
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const feedStart = performance.now();
      try {
        const podcast = await PodcastParser.parsePodcastFeed(url);
        const feedTime = (performance.now() - feedStart).toFixed(0);
        console.log(`📻 Parsed "${podcast?.title || url}" in ${feedTime}ms (${podcast?.episodes.length || 0} episodes)`);
        return podcast;
      } catch (error) {
        const feedTime = (performance.now() - feedStart).toFixed(0);
        console.error(`📻 Error fetching podcast ${url} after ${feedTime}ms:`, error);
        return null;
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      podcasts.push(result.value);
    }
  }

  const totalTime = (performance.now() - startTime).toFixed(0);
  console.log(`📻 Total podcast fetch time: ${totalTime}ms`);

  // Sort podcasts by last update date (most recent first)
  podcasts.sort((a, b) => {
    const dateA = new Date(a.lastBuildDate || a.pubDate || 0).getTime();
    const dateB = new Date(b.lastBuildDate || b.pubDate || 0).getTime();
    return dateB - dateA;
  });

  // Update cache
  podcastCache = {
    podcasts,
    lastUpdated: Date.now(),
    ttl: CACHE_TTL
  };

  console.log(`📻 Loaded ${podcasts.length} podcast(s) with ${podcasts.reduce((sum, p) => sum + p.episodes.length, 0)} total episodes`);

  return podcasts;
}

/**
 * Fetch a single podcast by slug or feed URL
 */
export async function fetchPodcast(identifier: string): Promise<Podcast | null> {
  // First try to find in cache
  if (podcastCache) {
    const cached = podcastCache.podcasts.find(
      p => generateSlug(p.title) === identifier || p.feedUrl === identifier || p.feedGuid === identifier
    );
    if (cached) {
      return cached;
    }
  }

  // If identifier looks like a URL, try to fetch it directly
  if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
    return PodcastParser.parsePodcastFeed(identifier);
  }

  // Otherwise, fetch all podcasts and find by slug
  const podcasts = await fetchPodcasts();
  return podcasts.find(
    p => generateSlug(p.title) === identifier || p.feedGuid === identifier
  ) || null;
}

/**
 * Get all episodes across all podcasts, sorted by publication date
 */
export async function fetchAllEpisodes(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ episodes: (Episode & { podcast: Podcast })[]; total: number }> {
  const { limit = 50, offset = 0 } = options || {};

  const podcasts = await fetchPodcasts();

  // Flatten all episodes with podcast reference
  const allEpisodes: (Episode & { podcast: Podcast })[] = [];

  for (const podcast of podcasts) {
    for (const episode of podcast.episodes) {
      allEpisodes.push({
        ...episode,
        podcast
      });
    }
  }

  // Sort by publication date (most recent first)
  allEpisodes.sort((a, b) => {
    const dateA = new Date(a.pubDate || 0).getTime();
    const dateB = new Date(b.pubDate || 0).getTime();
    return dateB - dateA;
  });

  return {
    episodes: allEpisodes.slice(offset, offset + limit),
    total: allEpisodes.length
  };
}

/**
 * Search podcasts and episodes
 */
export async function searchPodcasts(query: string): Promise<{
  podcasts: Podcast[];
  episodes: (Episode & { podcast: Podcast })[];
}> {
  const podcasts = await fetchPodcasts();
  const lowerQuery = query.toLowerCase();

  // Search podcasts
  const matchingPodcasts = podcasts.filter(
    p =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.author.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery) ||
      p.categories?.some(c => c.toLowerCase().includes(lowerQuery))
  );

  // Search episodes
  const matchingEpisodes: (Episode & { podcast: Podcast })[] = [];

  for (const podcast of podcasts) {
    for (const episode of podcast.episodes) {
      if (
        episode.title.toLowerCase().includes(lowerQuery) ||
        episode.description?.toLowerCase().includes(lowerQuery) ||
        episode.persons?.some(p => p.name.toLowerCase().includes(lowerQuery))
      ) {
        matchingEpisodes.push({
          ...episode,
          podcast
        });
      }
    }
  }

  return {
    podcasts: matchingPodcasts,
    episodes: matchingEpisodes
  };
}

/**
 * Clear the podcast cache
 */
export function clearPodcastCache(): void {
  podcastCache = null;
  console.log('📻 Podcast cache cleared');
}

/**
 * Convert an Episode to a Track-compatible object for the audio player
 */
export function episodeToTrack(episode: Episode, podcast: Podcast) {
  return {
    title: episode.title,
    duration: episode.duration,
    url: episode.url,
    trackNumber: episode.episodeNumber || 1,
    image: episode.image || podcast.coverArt,
    artist: podcast.author,
    album: podcast.title,
    mediaType: episode.mediaType,
    mimeType: episode.mimeType,
    value: episode.value || podcast.value,
    paymentRecipients: episode.paymentRecipients || podcast.paymentRecipients,
    guid: episode.guid,
    podcastGuid: episode.podcastGuid,
    feedGuid: episode.feedGuid || podcast.feedGuid,
    feedUrl: episode.feedUrl || podcast.feedUrl,
    publisherGuid: episode.publisherGuid || podcast.publisherGuid,
    publisherUrl: episode.publisherUrl || podcast.publisherUrl,
    imageUrl: episode.image || podcast.coverArt,
    chaptersUrl: episode.chaptersUrl,
    alternateEnclosures: episode.alternateEnclosures
  };
}

/**
 * Convert a Podcast to an Album-compatible object for the audio player
 */
export function podcastToAlbum(podcast: Podcast) {
  return {
    title: podcast.title,
    artist: podcast.author,
    description: podcast.description,
    coverArt: podcast.coverArt,
    tracks: podcast.episodes.map(ep => episodeToTrack(ep, podcast)),
    releaseDate: podcast.pubDate || podcast.lastBuildDate || new Date().toISOString(),
    feedId: podcast.feedId,
    feedUrl: podcast.feedUrl,
    funding: podcast.funding,
    value: podcast.value,
    paymentRecipients: podcast.paymentRecipients,
    publisher: podcast.publisher,
    feedGuid: podcast.feedGuid,
    publisherGuid: podcast.publisherGuid,
    publisherUrl: podcast.publisherUrl,
    imageUrl: podcast.coverArt
  };
}
