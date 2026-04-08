import { Album } from '@/lib/types/album';

/**
 * Fetch albums with automatic fallback chain
 * Tries sources in priority order and returns albums from first successful source
 * 
 * @param options - Configuration options
 * @param options.useCache - Whether to check localStorage cache first (default: true)
 * @param options.sources - Array of source priorities (default: ['static-file', 'api-auto', 'api-dynamic', 'api-static-cached'])
 * @returns Promise resolving to array of albums (empty array if all sources fail)
 */
export async function fetchAlbumsWithFallback(options?: {
  useCache?: boolean;
  sources?: string[];
}): Promise<Album[]> {
  const { useCache = true, sources = ['static-file', 'api-auto', 'api-dynamic', 'api-static-cached'] } = options || {};

  // 1. Check localStorage cache first if enabled
  if (useCache && typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('cachedAlbums');
      const cacheTime = localStorage.getItem('albumsCacheTimestamp');
      
      if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 10 * 60 * 1000) {
        console.log('📦 Using cached albums');
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('⚠️ Failed to read cache:', error);
    }
  }

  // 2. Try each source in priority order
  for (const source of sources) {
    try {
      let albums: Album[] = [];

      switch (source) {
        case 'static-file':
          // Try to fetch static file directly (fastest, no serverless function)
          console.log('🔄 Trying to load static album file directly...');
          try {
            const staticResponse = await fetch('/static-albums.json');
            
            if (staticResponse.ok) {
              const staticData = await staticResponse.json();
              if (staticData.albums && staticData.albums.length > 0) {
                console.log(`📦 Loaded ${staticData.albums.length} albums from static file`);
                albums = staticData.albums;
              }
            }
          } catch (staticError) {
            console.warn('⚠️ Failed to load static file:', staticError);
          }
          break;

        case 'api-auto':
          console.log('🔄 Loading albums from API (auto source)...');
          const autoResponse = await fetch('/api/albums?source=auto');
          if (autoResponse.ok) {
            const autoData = await autoResponse.json();
            albums = autoData.albums || [];
            if (albums.length > 0) {
              console.log(`📡 Loaded ${albums.length} albums from API (auto)`);
            }
          }
          break;

        case 'api-dynamic':
          console.log('🔄 Loading albums from API (dynamic source)...');
          const dynamicResponse = await fetch('/api/albums?source=dynamic');
          if (dynamicResponse.ok) {
            const dynamicData = await dynamicResponse.json();
            albums = dynamicData.albums || [];
            if (albums.length > 0) {
              console.log(`⚡ Loaded ${albums.length} albums from API (dynamic)`);
            }
          }
          break;

        case 'api-static-cached':
          console.log('🔄 Loading albums from API (static-cached source)...');
          const staticCachedResponse = await fetch('/api/albums?source=static-cached');
          if (staticCachedResponse.ok) {
            const staticCachedData = await staticCachedResponse.json();
            albums = staticCachedData.albums || [];
            if (albums.length > 0) {
              console.log(`📦 Loaded ${albums.length} albums from API (static-cached)`);
            }
          }
          break;
      }

      // If we got albums from this source, deduplicate and cache them
      if (albums.length > 0) {
        // Deduplicate albums
        const albumMap = new Map<string, Album>();
        albums.forEach((album: Album) => {
          const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
          if (!albumMap.has(key)) {
            albumMap.set(key, album);
          }
        });
        
        const uniqueAlbums = Array.from(albumMap.values());
        
        // Cache in localStorage
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('cachedAlbums', JSON.stringify(uniqueAlbums));
            localStorage.setItem('albumsCacheTimestamp', Date.now().toString());
            console.log(`📦 Cached ${uniqueAlbums.length} albums`);
          } catch (error) {
            console.warn('⚠️ Failed to cache albums:', error);
          }
        }
        
        return uniqueAlbums;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to fetch from ${source}:`, error);
      // Continue to next source
    }
  }

  // All sources failed, return empty array
  console.warn('⚠️ All album sources failed, returning empty array');
  return [];
}

