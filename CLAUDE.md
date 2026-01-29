# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TRM-Lightning is a Next.js 15 (App Router) Value4Value music and podcast platform with Bitcoin Lightning Network payments, Nostr integration, and Podcasting 2.0 support. It's a template for artists and podcasters to monetize content through RSS feeds.

- **Repository**: https://github.com/ChadFarrow/TRM-Lightning
- **Deployment**: https://vercel.com/chadfs-projects/trm-lightning

## Commands

```bash
npm run dev              # Start development server (localhost:3000)
npm run build            # Build for production (runs prebuild RSS parsing first)
npm run lint             # Run ESLint
npm run dev:lightning    # Dev with Lightning payments enabled
npm run dev:basic        # Dev without Lightning features
npm run test-feeds       # Test RSS feed parsing
```

## Architecture

### Data Flow: RSS → Display

```
feeds.json / podcast-feeds.json (feed URLs)
    ↓
/api/fetch-rss (proxy with CORS handling, caching)
    ↓
rss-parser.ts / podcast-parser.ts (XML → objects)
    ↓
Color extraction (colorthief from album art)
    ↓
public/static-albums.json, public/data/albums-with-colors.json
    ↓
React components
```

### Key Directories

- **`/app`** - Next.js App Router pages and API routes
- **`/components`** - React components (45+)
- **`/contexts`** - State management (AudioContext, LightningContext, BitcoinConnectContext)
- **`/lib`** - Services, parsers, utilities, and type definitions
- **`/data`** - Feed configuration files (feeds.json, podcast-feeds.json)
- **`/public`** - Static assets and generated JSON data

### Core Services (`/lib`)

| Service | Purpose |
|---------|---------|
| `rss-parser.ts` | Generic RSS/Atom parsing for music albums |
| `podcast-parser.ts` | Podcasting 2.0 parsing (chapters, transcripts, persons, value splits) |
| `podcasts-service.ts` | Podcast aggregation with 5-min memory cache |
| `albums-service.ts` | Album aggregation and color extraction |
| `nwc-service.ts` | Nostr Wallet Connect (NIP-47) for Lightning payments |
| `boost-to-nostr-service.ts` | Posts boosts to Nostr network (Kind 1, 9734, 9735) |

### Context Providers

- **AudioContext** - Unified audio/video playback, playlist management, Media Session API
- **LightningContext** - Feature toggle for Lightning payments
- **BitcoinConnectContext** - NWC wallet connection state

### API Routes (`/app/api`)

- `/api/fetch-rss` - RSS proxy (security, CORS, 30s timeout)
- `/api/proxy-image`, `/api/proxy-video` - Media CORS bypass
- `/api/proxy-chapters` - Podcast chapter JSON fetching
- `/api/albums`, `/api/publishers` - Data endpoints

### Podcasting 2.0 Features Implemented

Chapters, transcripts (SRT/VTT/JSON), value splits, value time splits, persons (guests/hosts), alternate enclosures (HLS/video), GUID for Nostr tagging, location, license, funding links, soundbites.

### Payment Flow

User boost → BitcoinConnect UI → Extract podcast:value splits → NWC wallet → Lightning invoice → Payment → Nostr boost event (Kind 1) → Confetti

## Environment Variables

```bash
NEXT_PUBLIC_SITE_NAME          # Site title
NEXT_PUBLIC_SITE_URL           # Deployment URL
NEXT_PUBLIC_ENABLE_LIGHTNING   # Enable Lightning payments (true/false)
NEXT_PUBLIC_SITE_NOSTR_NSEC    # Site's Nostr private key for boost posting
```

## Key Patterns

- All external RSS fetches go through `/api/fetch-rss` for security and caching
- Color extraction happens at build time via `scripts/build-rss-data.ts`
- Track objects have `mediaType: 'audio' | 'video'` for unified playback
- HLS streams supported via hls.js
- PWA support with next-pwa (service worker currently disabled)
