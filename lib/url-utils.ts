/**
 * Generate a simple, clean URL-friendly slug from any string
 * This is the most common pattern used throughout the codebase
 */
export function generateSlug(text: string): string {
  if (!text) return '';

  return text
    .toLowerCase()
    // Normalize Unicode lookalikes to ASCII equivalents
    .replace(/[\u018e\u01dd\u0258\u2203\u2208\u2209]/gi, 'e') // Ǝ ǝ ɘ ∃ ∈ ∉ → e
    .replace(/[\u0251\u0252\u0430]/gi, 'a') // ɑ ɒ а → a
    .replace(/[\u03b1]/gi, 'a') // α → a
    .replace(/[\u0455]/gi, 's') // ѕ → s
    .replace(/[\u043e\u03bf]/gi, 'o') // о ο → o
    .replace(/[^\w\s-]/g, '')       // Remove punctuation except spaces and hyphens
    .replace(/\s+/g, '-')           // Replace spaces with dashes
    .replace(/-+/g, '-')            // Replace multiple consecutive dashes with single dash
    .replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes
}

/**
 * Generate a clean URL-friendly slug from a title
 * Preserves more information to avoid collisions
 */
export function generateAlbumSlug(title: string): string {
  // Special case handling for known problematic titles
  const specialCases: { [key: string]: string } = {
    'bitpunk.fm': 'bitpunkfm',
    'dead time(live 2016)': 'dead-timelive-2016',
    'let go (what\'s holding you back)': 'let-go-whats-holding-you-back',
    'they don\'t know': 'they-dont-know',
    'underwater - single': 'underwater-single',
    'unsound existence (self-hosted version)': 'unsound-existence-self-hosted-version',
    'you feel like home(single)': 'you-feel-like-homesingle',
    'the kid, the dad, the mom & the tiny window': 'the-kid-the-dad-the-mom-and-the-tiny-window',
    'don\'t worry, you still have time to ruin it - demo': 'dont-worry-you-still-have-time-to-ruin-it-demo',
    'fake love - demo': 'fake-love-demo',
    'roommates - demo': 'roommates-demo',
    'orange pill, pink pill, white pill - demo': 'orange-pill-pink-pill-white-pill-demo',
    'strangers to lovers - live from sloe flower studio': 'strangers-to-lovers-live-from-sloe-flower-studio',
    'can\'t promise you the world - live from sloe flower studio': 'cant-promise-you-the-world-live-from-sloe-flower-studio',
    'heycitizen\'s lo-fi hip-hop beats to study and relax to': 'heycitizens-lo-fi-hip-hop-beats-to-study-and-relax-to',
    'fountain artist takeover - nate johnivan': 'fountain-artist-takeover-nate-johnivan',
    'rock\'n\'roll breakheart': 'rocknroll-breakheart',
    'thankful (feat. witt lowry)': 'thankful-feat-witt-lowry',
    'bitpunk.fm unwound': 'bitpunkfm-unwound',
    'aged friends & old whiskey': 'aged-friends-and-old-whiskey'
  };
  
  const lowerTitle = title.toLowerCase().trim();
  if (specialCases[lowerTitle]) {
    return specialCases[lowerTitle];
  }
  
  // First, normalize the title
  let slug = title
    .toLowerCase()
    .trim()
    // Replace common special characters with their word equivalents
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .replace(/@/g, 'at')
    // Keep alphanumeric, spaces, and hyphens
    .replace(/[^a-z0-9\s-]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Replace spaces with hyphens
    .replace(/\s/g, '-')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '');
  
  // If the slug is empty after processing, use a fallback
  if (!slug) {
    slug = 'album-' + Date.now();
  }
  
  return slug;
}

/**
 * Generate album URL path
 */
export function generateAlbumUrl(title: string): string {
  return `/album/${generateAlbumSlug(title)}`;
}

/**
 * Generate a clean publisher slug from publisher info
 * Uses title/artist name if available, otherwise falls back to a shortened ID
 */
export function generatePublisherSlug(publisherInfo: { title?: string; artist?: string; feedGuid?: string }): string {
  // Try to use title or artist name first
  const name = publisherInfo.title || publisherInfo.artist;
  if (name) {
    return generateAlbumSlug(name);
  }
  
  // Fall back to a shortened version of the feedGuid
  if (publisherInfo.feedGuid) {
    return publisherInfo.feedGuid.split('-')[0]; // Use first part of UUID
  }
  
  // Last resort: use the full feedGuid
  return publisherInfo.feedGuid || 'unknown';
}

/**
 * Generate publisher URL path
 */
export function generatePublisherUrl(publisherInfo: { title?: string; artist?: string; feedGuid?: string }): string {
  return `/publisher/${generatePublisherSlug(publisherInfo)}`;
}

/**
 * Create a mapping of clean slugs to feedGuids for publisher routing
 * This allows us to use clean URLs while still being able to look up the original feedGuid
 */
export function createPublisherSlugMap(publishers: Array<{ title?: string; artist?: string; feedGuid?: string }>): Map<string, string> {
  const slugMap = new Map<string, string>();
  
  publishers.forEach(publisher => {
    if (publisher.feedGuid) {
      const slug = generatePublisherSlug(publisher);
      slugMap.set(slug, publisher.feedGuid);
    }
  });
  
  return slugMap;
}

/**
 * Extract a clean slug from a URL path
 */
export function extractSlugFromPath(path: string): string {
  return path.split('/').pop() || '';
}

/**
 * Generate a more readable URL for any entity
 */
export function generateCleanUrl(type: 'album' | 'publisher', identifier: string | { title?: string; artist?: string; feedGuid?: string }): string {
  if (type === 'album') {
    return generateAlbumUrl(identifier as string);
  } else {
    return generatePublisherUrl(identifier as { title?: string; artist?: string; feedGuid?: string });
  }
}

/**
 * Known publisher mappings for routing
 * Maps clean slugs to their corresponding feed URLs
 * Add your own publishers here for clean URL routing
 */
export const KNOWN_PUBLISHERS: { [slug: string]: { feedGuid: string; feedUrl: string; name?: string } } = {
  // Example publisher mapping - add your own publishers here for clean URL routing
  // 'your-band': {
  //   feedGuid: 'your-feed-guid',
  //   feedUrl: 'https://example.com/feeds/your-feed.xml',
  //   name: 'Your Band Name'
  // },
  
  // Add your publisher mappings here
  // This is optional - the site will work without it by using artist names from RSS feeds
};

/**
 * Get publisher info from a slug (clean URL or UUID)
 */
export function getPublisherInfo(slug: string): { feedGuid: string; feedUrl: string; name?: string } | null {
  // First try exact match
  if (KNOWN_PUBLISHERS[slug]) {
    return KNOWN_PUBLISHERS[slug];
  }
  
  // Try to find by partial UUID match
  for (const [, publisher] of Object.entries(KNOWN_PUBLISHERS)) {
    if (publisher.feedGuid.startsWith(slug) || slug.startsWith(publisher.feedGuid.split('-')[0])) {
      return publisher;
    }
  }
  
  return null;
} 