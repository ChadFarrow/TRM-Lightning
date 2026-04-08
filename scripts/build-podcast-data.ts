#!/usr/bin/env tsx

/**
 * Build-time Podcast Feed Parser
 * Parses podcast RSS feeds during build and generates static podcast data
 * This runs before Next.js build to ensure static data is available
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PodcastParser } from '../lib/podcast-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findProjectRoot(): string {
  let currentDir = __dirname;
  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return currentDir;
}

async function buildPodcastData(): Promise<void> {
  console.log('🎙️ Building podcast feed data during build...');

  const projectRoot = findProjectRoot();
  process.chdir(projectRoot);

  // Load podcast feeds config
  const feedsPath = path.join(projectRoot, 'data', 'podcast-feeds.json');
  if (!fs.existsSync(feedsPath)) {
    console.log('⚠️ No podcast-feeds.json found, skipping podcast pre-parse');
    return;
  }

  const feedUrls: string[] = JSON.parse(fs.readFileSync(feedsPath, 'utf-8'));
  console.log(`📡 Found ${feedUrls.length} podcast feed(s) to parse`);

  const podcasts: any[] = [];
  const errors: { feedUrl: string; error: string }[] = [];

  for (const feedUrl of feedUrls) {
    console.log(`  📻 Fetching: ${feedUrl}`);
    try {
      // Fetch RSS directly (no proxy needed at build time)
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'TRM-Lightning/1.0 (RSS Parser)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const xmlText = await response.text();

      // Parse using existing parser with pre-loaded XML
      const podcast = await PodcastParser.parsePodcastFeed(feedUrl, xmlText);

      if (podcast) {
        console.log(`  ✅ ${podcast.title} - ${podcast.episodes.length} episodes`);
        podcasts.push(podcast);
      } else {
        console.log(`  ⚠️ No podcast data returned for ${feedUrl}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Failed to parse ${feedUrl}: ${msg}`);
      errors.push({ feedUrl, error: msg });
    }
  }

  // Trim episode data to reduce file size — keep only what's needed for display and playback
  const trimmedPodcasts = podcasts.map((podcast: any) => ({
    ...podcast,
    episodes: podcast.episodes.map((ep: any) => ({
      title: ep.title,
      url: ep.url,
      duration: ep.duration,
      pubDate: ep.pubDate,
      image: ep.image,
      episodeNumber: ep.episodeNumber,
      mediaType: ep.mediaType,
      mimeType: ep.mimeType,
      guid: ep.guid,
      chaptersUrl: ep.chaptersUrl,
      description: ep.description || '',
      alternateEnclosures: ep.alternateEnclosures,
      transcripts: ep.transcripts,
      persons: ep.persons,
      location: ep.location,
    })),
  }));

  // Write static podcasts JSON
  const outputPath = path.join(projectRoot, 'public', 'static-podcasts.json');
  const outputData = {
    podcasts: trimmedPodcasts,
    count: trimmedPodcasts.length,
    timestamp: new Date().toISOString(),
    source: 'build-time-rss-parse',
    generated: true,
    generatedAt: new Date().toISOString(),
    ...(errors.length > 0 ? { errors } : {}),
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData));
  console.log(`\n✅ Wrote ${podcasts.length} podcast(s) to ${outputPath}`);

  if (errors.length > 0) {
    console.log(`⚠️ ${errors.length} feed(s) had errors`);
  }
}

buildPodcastData().catch((error) => {
  console.error('❌ Podcast build failed:', error);
  process.exit(1);
});
