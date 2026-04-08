import { AppError, ErrorCodes, withRetry, createErrorLogger } from './error-utils';
import { RSSValue, RSSValueRecipient } from './rss-parser';
import {
  Podcast,
  Episode,
  PodcastTranscript,
  PodcastPerson,
  PodcastSoundbite,
  PodcastChapter,
  PodcastLocation,
  PodcastLicense,
  PodcastAlternateEnclosure,
  PodcastValueTimeSplit,
} from './types/podcast';
import { PaymentRecipient } from './types/album';

const isDev = process.env.NODE_ENV === 'development';
const isVerbose = process.env.NEXT_PUBLIC_LOG_LEVEL === 'verbose';

/**
 * Get the base URL for API calls
 */
function getApiBaseUrl(): string {
  // Client-side: use relative URL
  if (typeof window !== 'undefined') {
    return '';
  }
  // Server-side: use environment variable or default
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

const devLog = (...args: any[]) => {
  if (isDev) console.log(...args);
};

const verboseLog = (...args: any[]) => {
  if (isVerbose) console.log(...args);
};

/**
 * Parse time string to seconds (supports HH:MM:SS, MM:SS, and seconds formats)
 */
function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;

  const trimmed = timeStr.trim();

  // Check if it's just a number (seconds)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Parse HH:MM:SS or MM:SS format
  const parts = trimmed.split(':').map(p => parseFloat(p));
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return 0;
}

/**
 * Format seconds to duration string (MM:SS or H:MM:SS)
 */
function formatDuration(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Clean HTML content by removing tags and decoding entities
 */
function cleanHtmlContent(content: string | null | undefined): string | undefined {
  if (!content) return undefined;
  return content
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export class PodcastParser {
  private static readonly logger = createErrorLogger('PodcastParser');

  /**
   * Detect if a feed is a podcast (vs music/other)
   */
  static async detectIfPodcast(feedUrl: string): Promise<boolean> {
    try {
      const baseUrl = getApiBaseUrl();
      const proxyUrl = `${baseUrl}/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) return false;

      const xmlText = await response.text();

      // Check for podcast indicators
      const isPodcast =
        xmlText.includes('podcast:') || // Podcasting 2.0 namespace
        xmlText.includes('<itunes:type>') ||
        xmlText.includes('<podcast:medium>podcast</podcast:medium>') ||
        (xmlText.includes('<itunes:') && !xmlText.includes('<podcast:medium>music</podcast:medium>'));

      // Check if it's explicitly music
      const isMusic = xmlText.includes('<podcast:medium>music</podcast:medium>');

      return isPodcast && !isMusic;
    } catch (error) {
      console.error('Error detecting podcast:', error);
      return false;
    }
  }

  /**
   * Parse a podcast RSS feed
   */
  static async parsePodcastFeed(feedUrl: string, preloadedXml?: string): Promise<Podcast | null> {
    return withRetry(async () => {
      verboseLog('[PodcastParser] Parsing podcast feed', { feedUrl });

      let xmlText: string;

      if (preloadedXml) {
        xmlText = preloadedXml;
      } else {
        const baseUrl = getApiBaseUrl();
        const proxyUrl = `${baseUrl}/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`;

        let response;
        try {
          response = await fetch(proxyUrl);
        } catch (error) {
          throw new AppError(
            'Failed to fetch podcast feed',
            ErrorCodes.RSS_FETCH_ERROR,
            500,
            true,
            { feedUrl, error }
          );
        }

        if (!response.ok) {
          throw new AppError(
            `Failed to fetch podcast feed: ${response.status}`,
            ErrorCodes.RSS_FETCH_ERROR,
            response.status,
            response.status >= 500,
            { feedUrl, status: response.status }
          );
        }

        xmlText = await response.text();
      }

      if (!xmlText || typeof xmlText !== 'string' || !xmlText.includes('<')) {
        throw new AppError(
          'Invalid XML response',
          ErrorCodes.RSS_INVALID_FORMAT,
          400,
          false,
          { feedUrl }
        );
      }

      // Parse XML
      let xmlDoc: any;
      if (typeof window !== 'undefined') {
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      } else {
        const { DOMParser } = await import('@xmldom/xmldom');
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      }

      const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
      if (parserError) {
        throw new AppError(
          'Invalid XML format',
          ErrorCodes.RSS_PARSE_ERROR,
          400,
          false,
          { feedUrl }
        );
      }

      const channels = xmlDoc.getElementsByTagName('channel');
      if (!channels || channels.length === 0) {
        throw new AppError(
          'Invalid RSS feed: no channel found',
          ErrorCodes.RSS_INVALID_FORMAT,
          400,
          false,
          { feedUrl }
        );
      }

      const channel = channels[0];

      // Extract channel-level data
      const title = channel.getElementsByTagName('title')[0]?.textContent?.trim() || 'Unknown Podcast';
      const description = channel.getElementsByTagName('description')[0]?.textContent?.trim() || '';
      const link = channel.getElementsByTagName('link')[0]?.textContent?.trim() || '';

      // Extract author
      let author = 'Unknown';
      const authorElements = channel.getElementsByTagName('itunes:author');
      if (authorElements.length > 0) {
        author = authorElements[0].textContent?.trim() || author;
      } else {
        const authorEl = channel.getElementsByTagName('author')[0];
        if (authorEl) {
          author = authorEl.textContent?.trim() || author;
        }
      }

      // Extract cover art
      let coverArt = '';
      const imageElement = channel.getElementsByTagName('itunes:image')[0];
      if (imageElement) {
        coverArt = imageElement.getAttribute('href') || '';
      }
      if (!coverArt) {
        const imageUrl = channel.querySelector('image url');
        if (imageUrl) {
          coverArt = imageUrl.textContent?.trim() || '';
        }
      }

      // Extract feed GUID
      const feedGuidElement = channel.getElementsByTagName('podcast:guid')[0];
      const feedGuid = feedGuidElement?.textContent?.trim();

      // Extract additional metadata
      const subtitle = channel.getElementsByTagName('itunes:subtitle')[0]?.textContent?.trim();
      const summary = channel.getElementsByTagName('itunes:summary')[0]?.textContent?.trim();
      const language = channel.getElementsByTagName('language')[0]?.textContent?.trim();
      const copyright = channel.getElementsByTagName('copyright')[0]?.textContent?.trim();
      const explicitEl = channel.getElementsByTagName('itunes:explicit')[0];
      const explicit = explicitEl?.textContent?.trim().toLowerCase() === 'true' ||
                       explicitEl?.textContent?.trim().toLowerCase() === 'yes';

      // Extract keywords
      const keywordsEl = channel.getElementsByTagName('itunes:keywords')[0];
      const keywords = keywordsEl?.textContent?.trim().split(',').map((k: string) => k.trim()).filter((k: string) => k) || [];

      // Extract categories
      const categoryElements = channel.getElementsByTagName('itunes:category');
      const categories = Array.from(categoryElements).map(cat => (cat as Element).getAttribute('text')).filter(Boolean) as string[];

      // Extract owner
      const ownerEl = channel.getElementsByTagName('itunes:owner')[0];
      const owner = ownerEl ? {
        name: ownerEl.getElementsByTagName('itunes:name')[0]?.textContent?.trim(),
        email: ownerEl.getElementsByTagName('itunes:email')[0]?.textContent?.trim()
      } : undefined;

      // Extract persons (podcast:person at channel level)
      const persons = this.parsePersons(channel);

      // Extract location
      const location = this.parseLocation(channel);

      // Extract license
      const license = this.parseLicense(channel);

      // Extract funding
      const funding = this.parseFunding(channel);

      // Extract locked status
      const locked = this.parseLocked(channel);

      // Extract value block
      const value = this.parseValue(channel);

      // Process payment recipients
      let paymentRecipients: PaymentRecipient[] | undefined;
      if (value && value.type === 'lightning' && value.recipients?.length > 0) {
        paymentRecipients = value.recipients
          .filter(r => r.type === 'node' || r.type === 'lnaddress')
          .map(r => ({
            address: r.address,
            split: r.split,
            name: r.name,
            fee: r.fee,
            type: r.type
          }));
      }

      // Extract publisher information
      const publisher = this.parsePublisher(channel);

      // Parse episodes
      const items = xmlDoc.getElementsByTagName('item');
      const episodes: Episode[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const episode = this.parseEpisode(item, feedGuid, feedUrl);
        if (episode) {
          episodes.push(episode);
        }
      }

      devLog(`📻 Parsed podcast "${title}" with ${episodes.length} episodes`);

      return {
        title,
        author,
        description: cleanHtmlContent(description) || '',
        coverArt,
        episodes,
        feedId: feedGuid || feedUrl,
        feedUrl,
        feedGuid,
        subtitle: cleanHtmlContent(subtitle),
        summary: cleanHtmlContent(summary),
        language,
        copyright,
        explicit,
        categories: categories.length > 0 ? categories : undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
        owner: owner && (owner.name || owner.email) ? owner : undefined,
        persons: persons.length > 0 ? persons : undefined,
        location,
        license,
        funding: funding.length > 0 ? funding : undefined,
        locked,
        value,
        paymentRecipients,
        publisher,
        publisherGuid: publisher?.feedGuid,
        publisherUrl: publisher?.feedUrl,
        lastBuildDate: channel.getElementsByTagName('lastBuildDate')[0]?.textContent?.trim(),
        pubDate: channel.getElementsByTagName('pubDate')[0]?.textContent?.trim(),
        medium: 'podcast' as const
      };
    }, {
      maxRetries: 3,
      delay: 1000,
      onRetry: (attempt, error) => {
        this.logger.warn(`Retrying podcast feed parse (attempt ${attempt})`, { feedUrl, error });
      }
    }).catch(error => {
      this.logger.error('Failed to parse podcast feed after retries', error, { feedUrl });
      return null;
    });
  }

  /**
   * Parse a single episode from an item element
   */
  private static parseEpisode(item: Element, feedGuid?: string, feedUrl?: string): Episode | null {
    const title = item.getElementsByTagName('title')[0]?.textContent?.trim() || 'Untitled Episode';

    // Get enclosure URL
    let url = '';
    let mimeType = '';
    const enclosure = item.getElementsByTagName('enclosure')[0];
    if (enclosure) {
      url = enclosure.getAttribute('url') || '';
      mimeType = enclosure.getAttribute('type') || '';
    }

    if (!url) {
      verboseLog(`⚠️ Episode "${title}" has no audio URL, skipping`);
      return null;
    }

    // Detect media type
    let mediaType: 'audio' | 'video' = 'audio';
    if (mimeType.startsWith('video/') || url.includes('.mp4') || url.includes('.m3u8') || url.includes('.mov')) {
      mediaType = 'video';
    }

    // Parse duration
    let duration = '0:00';
    const itunesDuration = item.getElementsByTagName('itunes:duration')[0];
    if (itunesDuration?.textContent?.trim()) {
      const durationStr = itunesDuration.textContent.trim();
      if (/^\d+$/.test(durationStr)) {
        duration = formatDuration(parseInt(durationStr));
      } else if (durationStr.includes(':')) {
        duration = durationStr;
      }
    }

    // Extract episode number and season
    const episodeEl = item.getElementsByTagName('itunes:episode')[0];
    const seasonEl = item.getElementsByTagName('itunes:season')[0];
    const episodeNumber = episodeEl?.textContent?.trim() ? parseInt(episodeEl.textContent.trim()) : undefined;
    const season = seasonEl?.textContent?.trim() ? parseInt(seasonEl.textContent.trim()) : undefined;

    // Extract episode type
    const typeEl = item.getElementsByTagName('itunes:episodeType')[0];
    let episodeType: 'full' | 'trailer' | 'bonus' | undefined;
    if (typeEl?.textContent?.trim()) {
      const type = typeEl.textContent.trim().toLowerCase();
      if (type === 'full' || type === 'trailer' || type === 'bonus') {
        episodeType = type;
      }
    }

    // Extract explicit
    const explicitEl = item.getElementsByTagName('itunes:explicit')[0];
    const explicit = explicitEl?.textContent?.trim().toLowerCase() === 'true' ||
                     explicitEl?.textContent?.trim().toLowerCase() === 'yes';

    // Extract description/summary
    const description = item.getElementsByTagName('description')[0]?.textContent?.trim();
    const subtitle = item.getElementsByTagName('itunes:subtitle')[0]?.textContent?.trim();
    const summary = item.getElementsByTagName('itunes:summary')[0]?.textContent?.trim();

    // Extract image
    const imageEl = item.getElementsByTagName('itunes:image')[0];
    const image = imageEl?.getAttribute('href') || imageEl?.getAttribute('url') || undefined;

    // Extract transcripts
    const transcripts = this.parseTranscripts(item);

    // Extract chapters URL
    const chaptersEl = item.getElementsByTagName('podcast:chapters')[0];
    const chaptersUrl = chaptersEl?.getAttribute('url') || undefined;

    // Extract persons
    const persons = this.parsePersons(item);

    // Extract soundbites
    const soundbites = this.parseSoundbites(item);

    // Extract location
    const location = this.parseLocation(item);

    // Extract alternate enclosures
    const alternateEnclosures = this.parseAlternateEnclosures(item);

    // Extract value block
    const value = this.parseValue(item);

    // Process payment recipients
    let paymentRecipients: PaymentRecipient[] | undefined;
    if (value && value.type === 'lightning' && value.recipients?.length > 0) {
      paymentRecipients = value.recipients
        .filter(r => r.type === 'node' || r.type === 'lnaddress')
        .map(r => ({
          address: r.address,
          split: r.split,
          name: r.name,
          fee: r.fee,
          type: r.type
        }));
    }

    // Extract value time splits
    const valueTimeSplits = this.parseValueTimeSplits(item);

    // Extract GUIDs
    const guidEl = item.getElementsByTagName('guid')[0];
    const guid = guidEl?.textContent?.trim();
    const podcastGuidEl = item.getElementsByTagName('podcast:guid')[0];
    const podcastGuid = podcastGuidEl?.textContent?.trim();

    // Extract publication date
    const pubDateEl = item.getElementsByTagName('pubDate')[0];
    const pubDate = pubDateEl?.textContent?.trim();

    // Extract link
    const linkEl = item.getElementsByTagName('link')[0];
    const link = linkEl?.textContent?.trim();

    return {
      title,
      duration,
      url,
      episodeNumber,
      season,
      episodeType,
      explicit,
      description: cleanHtmlContent(description),
      subtitle: cleanHtmlContent(subtitle),
      summary: cleanHtmlContent(summary),
      image,
      mediaType,
      mimeType,
      transcripts: transcripts.length > 0 ? transcripts : undefined,
      chaptersUrl,
      persons: persons.length > 0 ? persons : undefined,
      soundbites: soundbites.length > 0 ? soundbites : undefined,
      location,
      alternateEnclosures: alternateEnclosures.length > 0 ? alternateEnclosures : undefined,
      valueTimeSplits: valueTimeSplits.length > 0 ? valueTimeSplits : undefined,
      value,
      paymentRecipients,
      guid,
      podcastGuid,
      feedGuid,
      feedUrl,
      pubDate,
      link
    };
  }

  /**
   * Parse podcast:transcript elements
   */
  private static parseTranscripts(element: Element): PodcastTranscript[] {
    const transcripts: PodcastTranscript[] = [];
    const transcriptElements = Array.from(element.getElementsByTagName('podcast:transcript'));

    for (const el of transcriptElements) {
      const url = el.getAttribute('url');
      const type = el.getAttribute('type') as PodcastTranscript['type'];

      if (url && type) {
        transcripts.push({
          url,
          type,
          language: el.getAttribute('language') || undefined,
          rel: el.getAttribute('rel') === 'captions' ? 'captions' : undefined
        });
      }
    }

    return transcripts;
  }

  /**
   * Parse podcast:person elements
   */
  private static parsePersons(element: Element): PodcastPerson[] {
    const persons: PodcastPerson[] = [];
    const personElements = Array.from(element.getElementsByTagName('podcast:person'));

    for (const el of personElements) {
      const name = el.textContent?.trim();
      if (name) {
        persons.push({
          name,
          role: el.getAttribute('role') || undefined,
          group: el.getAttribute('group') || undefined,
          img: el.getAttribute('img') || undefined,
          href: el.getAttribute('href') || undefined
        });
      }
    }

    return persons;
  }

  /**
   * Parse podcast:soundbite elements
   */
  private static parseSoundbites(element: Element): PodcastSoundbite[] {
    const soundbites: PodcastSoundbite[] = [];
    const soundbiteElements = Array.from(element.getElementsByTagName('podcast:soundbite'));

    for (const el of soundbiteElements) {
      const startTimeStr = el.getAttribute('startTime');
      const durationStr = el.getAttribute('duration');

      if (startTimeStr && durationStr) {
        soundbites.push({
          startTime: parseTimeToSeconds(startTimeStr),
          duration: parseTimeToSeconds(durationStr),
          title: el.textContent?.trim() || undefined
        });
      }
    }

    return soundbites;
  }

  /**
   * Parse podcast:location element
   */
  private static parseLocation(element: Element): PodcastLocation | undefined {
    const locationEl = element.getElementsByTagName('podcast:location')[0];
    if (!locationEl) return undefined;

    const name = locationEl.textContent?.trim();
    if (!name) return undefined;

    return {
      name,
      geo: locationEl.getAttribute('geo') || undefined,
      osm: locationEl.getAttribute('osm') || undefined
    };
  }

  /**
   * Parse podcast:license element
   */
  private static parseLicense(element: Element): PodcastLicense | undefined {
    const licenseEl = element.getElementsByTagName('podcast:license')[0];
    if (!licenseEl) return undefined;

    const type = licenseEl.textContent?.trim();
    if (!type) return undefined;

    return {
      type,
      url: licenseEl.getAttribute('url') || undefined
    };
  }

  /**
   * Parse podcast:funding elements
   */
  private static parseFunding(element: Element): { url: string; message?: string }[] {
    const funding: { url: string; message?: string }[] = [];
    const fundingElements = Array.from(element.getElementsByTagName('podcast:funding'));

    for (const el of fundingElements) {
      const url = el.getAttribute('url');
      if (url) {
        funding.push({
          url,
          message: el.textContent?.trim() || undefined
        });
      }
    }

    return funding;
  }

  /**
   * Parse podcast:locked element
   */
  private static parseLocked(element: Element): { locked: boolean; owner?: string } | undefined {
    const lockedEl = element.getElementsByTagName('podcast:locked')[0];
    if (!lockedEl) return undefined;

    const locked = lockedEl.textContent?.trim().toLowerCase() === 'yes' ||
                   lockedEl.textContent?.trim().toLowerCase() === 'true';

    return {
      locked,
      owner: lockedEl.getAttribute('owner') || undefined
    };
  }

  /**
   * Parse podcast:alternateEnclosure elements
   */
  private static parseAlternateEnclosures(element: Element): PodcastAlternateEnclosure[] {
    const enclosures: PodcastAlternateEnclosure[] = [];
    const enclosureElements = Array.from(element.getElementsByTagName('podcast:alternateEnclosure'));

    for (const el of enclosureElements) {
      const type = el.getAttribute('type');
      if (!type) continue;

      const sources: { uri: string; contentType?: string }[] = [];
      const sourceElements = Array.from(el.getElementsByTagName('podcast:source'));

      for (const sourceEl of sourceElements) {
        const uri = sourceEl.getAttribute('uri');
        if (uri) {
          sources.push({
            uri,
            contentType: sourceEl.getAttribute('contentType') || undefined
          });
        }
      }

      if (sources.length > 0) {
        enclosures.push({
          type,
          length: el.getAttribute('length') ? parseInt(el.getAttribute('length')!) : undefined,
          bitrate: el.getAttribute('bitrate') ? parseInt(el.getAttribute('bitrate')!) : undefined,
          height: el.getAttribute('height') ? parseInt(el.getAttribute('height')!) : undefined,
          lang: el.getAttribute('lang') || undefined,
          title: el.getAttribute('title') || undefined,
          rel: el.getAttribute('rel') || undefined,
          codecs: el.getAttribute('codecs') || undefined,
          default: el.getAttribute('default') === 'true',
          sources
        });
      }
    }

    return enclosures;
  }

  /**
   * Parse podcast:value element
   */
  private static parseValue(element: Element): RSSValue | undefined {
    const valueElements = [
      ...Array.from(element.getElementsByTagName('podcast:value')),
      ...Array.from(element.getElementsByTagName('value'))
    ];

    if (valueElements.length === 0) return undefined;

    const valueEl = valueElements[0];
    const type = valueEl.getAttribute('type');
    const method = valueEl.getAttribute('method');

    if (!type || !method) return undefined;

    const recipients: RSSValueRecipient[] = [];
    const recipientElements = [
      ...Array.from(valueEl.getElementsByTagName('podcast:valueRecipient')),
      ...Array.from(valueEl.getElementsByTagName('valueRecipient'))
    ];

    for (const recipientEl of recipientElements) {
      const recipientType = recipientEl.getAttribute('type');
      const address = recipientEl.getAttribute('address');
      const splitStr = recipientEl.getAttribute('split');

      if (recipientType && address && splitStr) {
        recipients.push({
          type: recipientType,
          address,
          split: parseInt(splitStr, 10),
          name: recipientEl.getAttribute('name') || undefined,
          customKey: recipientEl.getAttribute('customKey') || undefined,
          customValue: recipientEl.getAttribute('customValue') || undefined,
          fee: recipientEl.getAttribute('fee') === 'true'
        });
      }
    }

    if (recipients.length === 0) return undefined;

    return {
      type,
      method,
      suggested: valueEl.getAttribute('suggested') || undefined,
      recipients
    };
  }

  /**
   * Parse podcast:valueTimeSplit elements
   */
  private static parseValueTimeSplits(element: Element): PodcastValueTimeSplit[] {
    const splits: PodcastValueTimeSplit[] = [];
    const splitElements = Array.from(element.getElementsByTagName('podcast:valueTimeSplit'));

    for (const el of splitElements) {
      const startTimeStr = el.getAttribute('startTime');
      const durationStr = el.getAttribute('duration');

      if (!startTimeStr || !durationStr) continue;

      const split: PodcastValueTimeSplit = {
        startTime: parseTimeToSeconds(startTimeStr),
        duration: parseTimeToSeconds(durationStr),
        remoteStartTime: el.getAttribute('remoteStartTime')
          ? parseTimeToSeconds(el.getAttribute('remoteStartTime')!)
          : undefined,
        remotePercentage: el.getAttribute('remotePercentage')
          ? parseInt(el.getAttribute('remotePercentage')!)
          : undefined
      };

      // Parse recipients within this time split
      const recipients: PaymentRecipient[] = [];
      const recipientElements = Array.from(el.getElementsByTagName('podcast:valueRecipient'));

      for (const recipientEl of recipientElements) {
        const address = recipientEl.getAttribute('address');
        const splitPct = recipientEl.getAttribute('split');

        if (address && splitPct) {
          recipients.push({
            address,
            split: parseInt(splitPct, 10),
            name: recipientEl.getAttribute('name') || undefined,
            fee: recipientEl.getAttribute('fee') === 'true',
            type: recipientEl.getAttribute('type') || undefined
          });
        }
      }

      if (recipients.length > 0) {
        split.recipients = recipients;
      }

      splits.push(split);
    }

    return splits;
  }

  /**
   * Parse podcast:publisher element
   */
  private static parsePublisher(element: Element): { feedGuid: string; feedUrl: string; medium: string } | undefined {
    const publisherEl = element.getElementsByTagName('podcast:publisher')[0];
    if (publisherEl) {
      const remoteItem = publisherEl.getElementsByTagName('podcast:remoteItem')[0];
      if (remoteItem && remoteItem.getAttribute('medium') === 'publisher') {
        const feedGuid = remoteItem.getAttribute('feedGuid');
        const feedUrl = remoteItem.getAttribute('feedUrl');
        const medium = remoteItem.getAttribute('medium');

        if (feedGuid && feedUrl && medium) {
          return { feedGuid, feedUrl, medium };
        }
      }
    }

    // Fallback: look for standalone remoteItem
    const remoteItems = Array.from(element.getElementsByTagName('podcast:remoteItem'));
    for (const item of remoteItems) {
      if (item.getAttribute('medium') === 'publisher') {
        const feedGuid = item.getAttribute('feedGuid');
        const feedUrl = item.getAttribute('feedUrl');
        const medium = item.getAttribute('medium');

        if (feedGuid && feedUrl && medium) {
          return { feedGuid, feedUrl, medium };
        }
      }
    }

    return undefined;
  }

  /**
   * Fetch and parse podcast chapters from a chapters URL
   */
  static async fetchChapters(chaptersUrl: string): Promise<PodcastChapter[]> {
    try {
      const baseUrl = getApiBaseUrl();
      const proxyUrl = `${baseUrl}/api/proxy-chapters?url=${encodeURIComponent(chaptersUrl)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        console.warn(`Failed to fetch chapters: ${response.status}`);
        return [];
      }

      const data = await response.json();

      if (!data.chapters || !Array.isArray(data.chapters)) {
        return [];
      }

      return data.chapters.map((ch: any) => ({
        startTime: ch.startTime || 0,
        endTime: ch.endTime,
        title: ch.title || '',
        img: ch.img,
        url: ch.url,
        toc: ch.toc !== false
      }));
    } catch (error) {
      console.error('Error fetching chapters:', error);
      return [];
    }
  }
}
