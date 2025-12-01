'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getBoostToNostrService } from '@/lib/boost-to-nostr-service';
import { type Event } from 'nostr-tools';
import { nip19, SimplePool, getPublicKey } from 'nostr-tools';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { isBoostsEnabled, isNostrKeysConfigured } from '@/lib/feature-flags';

interface ParsedBoost {
  id: string;
  author: string;
  authorNpub: string;
  authorName?: string;  // Display name of the user
  content: string;
  userMessage?: string;  // User's custom message/comment
  amount?: string;
  trackTitle?: string;
  trackArtist?: string;
  trackAlbum?: string;
  timestamp: number;
  tags: string[][];
  url?: string;
  replies?: ParsedReply[];
  isFromApp?: boolean;  // Flag to indicate if this boost is from the app's account
  repliesLoading?: boolean;  // Indicates if replies are being fetched
  repliesError?: string;  // Error message if reply fetching failed
}

interface ParsedReply {
  id: string;
  author: string;
  authorNpub: string;
  authorName?: string;
  authorPicture?: string;
  content: string;
  timestamp: number;
  replies?: ParsedReply[];  // Nested replies for threading
  depth?: number;          // Depth level for indentation
}

function parseBoostFromEvent(event: Event): ParsedBoost | null {
  try {
    // Extract amount from content (looking for "⚡ X sats")
    const amountMatch = event.content.match(/⚡\s*([\d.]+[MkK]?)\s*sats/);
    const amount = amountMatch ? amountMatch[1] : undefined;

    // Extract track info from content
    const titleMatch = event.content.match(/"([^"]+)"/);
    const trackTitle = titleMatch ? titleMatch[1] : undefined;

    // Look for track artist after "by" (but not "Sent by")
    let trackArtist: string | undefined;
    const artistMatches = event.content.match(/\sby:?\s+([^\n]+)/g);
    if (artistMatches) {
      for (const match of artistMatches) {
        if (!match.includes('Sent by')) {
          const artistMatch = match.match(/by:?\s+(.+?)(?=\n|$)/);
          if (artistMatch) {
            trackArtist = artistMatch[1].trim();
            break;
          }
        }
      }
    }

    // Look for sender after "Sent by" - be more flexible with whitespace and line endings
    const sentByMatch = event.content.match(/Sent\s+by:?\s+(.+?)(?=\n|$|🎧|nostr:)/i);
    const trackAlbum = sentByMatch ? sentByMatch[1].trim() : undefined;

    // Extract URL from content
    const urlMatch = event.content.match(/🎧\s*(https?:\/\/[^\s]+)/);
    const url = urlMatch ? urlMatch[1] : undefined;

    // Extract user message (text that isn't metadata)
    let userMessage: string | undefined = event.content;

    // Remove the standard boost formatting to get user's custom message
    userMessage = userMessage.replace(/⚡\s*[\d.]+[MkK]?\s*sats/, '').trim();
    // Remove bullet point that comes after the amount
    userMessage = userMessage.replace(/^•\s*/, '').trim();
    if (trackTitle) {
      userMessage = userMessage.replace(new RegExp(`"${trackTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'), '').trim();
    }
    if (trackArtist) {
      userMessage = userMessage.replace(new RegExp(`by\\s+${trackArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), '').trim();
    }
    if (trackAlbum) {
      userMessage = userMessage.replace(new RegExp(`Sent\\s+by:?\\s*${trackAlbum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '').trim();
    }
    // Remove "From: [album name]" line completely
    userMessage = userMessage.replace(/^From:\s*[^\n]+/gm, '').trim();
    userMessage = userMessage.replace(/🎧\s*https?:\/\/[^\s]+/, '').trim();
    userMessage = userMessage.replace(/nostr:[a-zA-Z0-9]+/, '').trim();
    userMessage = userMessage.replace(/\n+/g, ' ').trim();
    // Remove any remaining bullet points and formatting artifacts
    userMessage = userMessage.replace(/^[•·\-\*\s]+|[•·\-\*\s]+$/g, '').trim();

    // If there's no meaningful message left, set to undefined
    if (!userMessage || userMessage.length < 3) {
      userMessage = undefined;
    }

    // Create npub from pubkey
    const authorNpub = nip19.npubEncode(event.pubkey);

    // Try to get author name from profile tags (this would need to be fetched separately in a real implementation)
    const authorName = event.pubkey.substring(0, 8) + '...'; // Fallback to truncated pubkey


    return {
      id: event.id,
      author: event.pubkey,
      authorNpub,
      authorName,
      content: event.content,
      userMessage,
      amount,
      trackTitle,
      trackArtist,
      trackAlbum,
      timestamp: event.created_at,
      tags: event.tags,
      url
    };
  } catch (error) {
    console.error('Error parsing boost event:', error);
    return null;
  }
}

interface UserProfile {
  name?: string;
  picture?: string;
}

// Shared pool and cache for profile fetching
let profilePool: SimplePool | null = null;
const profileCache = new Map<string, UserProfile>();

function getProfilePool(): SimplePool {
  if (!profilePool) {
    profilePool = new SimplePool();
  }
  return profilePool;
}

const profileRelays = [
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://relay.nostr.band',
  'wss://relay.fountain.fm',
  'wss://relay.damus.io',
  'wss://chadf.nostr1.com'
];

// Batch fetch multiple profiles at once for better performance
async function fetchUserProfilesBatch(pubkeys: string[]): Promise<Map<string, UserProfile>> {
  const results = new Map<string, UserProfile>();
  const uncachedPubkeys: string[] = [];

  if (!pubkeys || pubkeys.length === 0) {
    return results;
  }

  // Check cache first
  for (const pubkey of pubkeys) {
    if (!pubkey) continue;
    const cached = profileCache.get(pubkey);
    if (cached) {
      results.set(pubkey, cached);
    } else {
      uncachedPubkeys.push(pubkey);
    }
  }

  if (uncachedPubkeys.length === 0) {
    return results;
  }

  try {
    const pool = getProfilePool();
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
    );

    // Fetch all uncached profiles in a single query with timeout
    const profiles = await Promise.race([
      pool.querySync(profileRelays, {
        kinds: [0], // Metadata events
        authors: uncachedPubkeys,
        limit: uncachedPubkeys.length
      }),
      timeoutPromise
    ]);

    // Process results
    for (const profile of profiles) {
      try {
        const metadata = JSON.parse(profile.content);
        const userProfile: UserProfile = {
          name: metadata.display_name || metadata.name || undefined,
          picture: metadata.picture || undefined
        };
        results.set(profile.pubkey, userProfile);
        profileCache.set(profile.pubkey, userProfile);
      } catch (e) {
        console.warn('Failed to parse profile metadata:', e);
      }
    }

    // Set empty profiles for pubkeys that weren't found (to avoid refetching)
    for (const pubkey of uncachedPubkeys) {
      if (!results.has(pubkey)) {
        const emptyProfile: UserProfile = {};
        results.set(pubkey, emptyProfile);
        profileCache.set(pubkey, emptyProfile);
      }
    }
  } catch (error) {
    console.warn('Failed to fetch user profiles batch:', error);
    // Return empty profiles for failed fetches
    for (const pubkey of uncachedPubkeys) {
      if (!results.has(pubkey)) {
        results.set(pubkey, {});
      }
    }
  }

  return results;
}

// Single profile fetch (uses batch internally for efficiency)
async function fetchUserProfile(pubkey: string): Promise<UserProfile> {
  const results = await fetchUserProfilesBatch([pubkey]);
  return results.get(pubkey) || {};
}

function buildThreadedReplies(events: any[], rootEventId: string): ParsedReply[] {
  // Create a map of event ID to reply object
  const replyMap = new Map<string, ParsedReply>();
  const childrenMap = new Map<string, string[]>(); // parent ID -> child IDs

  // First pass: create all reply objects
  for (const event of events) {
    const reply: ParsedReply = {
      id: event.id,
      author: event.pubkey,
      authorNpub: nip19.npubEncode(event.pubkey),
      content: event.content,
      timestamp: event.created_at,
      replies: [],
      depth: 0
    };
    replyMap.set(event.id, reply);
  }

  // Second pass: build parent-child relationships
  for (const event of events) {
    const eTags = event.tags.filter((tag: string[]) => tag[0] === 'e');

    // Find the parent this reply is responding to
    let parentId = rootEventId; // Default to root

    // Look for the most recent 'e' tag which usually indicates the direct parent
    if (eTags.length > 0) {
      // The last e tag is typically the direct parent being replied to
      parentId = eTags[eTags.length - 1][1];
    }

    // Add this reply as a child of its parent
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(event.id);
  }

  // Third pass: build the threaded structure recursively
  function buildChildren(parentId: string, depth: number): ParsedReply[] {
    const children = childrenMap.get(parentId) || [];
    const result: ParsedReply[] = [];

    for (const childId of children) {
      const reply = replyMap.get(childId);
      if (reply) {
        reply.depth = depth;
        reply.replies = buildChildren(childId, depth + 1);
        result.push(reply);
      }
    }

    // Sort by timestamp (oldest first for chronological order)
    result.sort((a, b) => a.timestamp - b.timestamp);
    return result;
  }

  // Start with direct replies to the root event
  return buildChildren(rootEventId, 0);
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (days > 7) {
    return date.toLocaleDateString();
  } else if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return 'just now';
  }
}

// Recursive component for displaying threaded replies
function ThreadedReply({ reply, maxDepth = 3 }: { reply: ParsedReply; maxDepth?: number }) {
  const indentLevel = Math.min(reply.depth || 0, maxDepth);
  const marginLeft = indentLevel * 16; // 16px per level

  return (
    <div
      style={{ marginLeft: `${marginLeft}px` }}
      className={reply.depth && reply.depth > 0 ? 'border-l border-gray-700 pl-4' : ''}
    >
      <div className="bg-gray-900/50 rounded-lg p-4 mb-3">
        <div className="flex flex-col gap-2">
          {/* Reply header with profile picture and name */}
          <div className="flex items-center gap-2 mb-2">
            {reply.authorPicture ? (
              <img
                src={reply.authorPicture}
                alt={reply.authorName || 'User'}
                className="w-8 h-8 rounded-full object-cover border border-gray-700"
                onError={(e) => {
                  // Hide image on error
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-xs font-medium">
                {(reply.authorName || reply.authorNpub).charAt(0).toUpperCase()}
              </div>
            )}
            <a
              href={`https://primal.net/p/${reply.author}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition text-sm font-medium"
            >
              {reply.authorName || `${reply.authorNpub.slice(0, 12)}...`}
            </a>
            <span className="text-gray-500 text-xs">
              {formatTimestamp(reply.timestamp)}
            </span>
          </div>

          {/* Reply content */}
          <div className="text-gray-300 text-sm break-words">
            {reply.content}
          </div>

          {/* Reply metadata */}
          <div className="flex flex-wrap gap-3 text-xs">
            <a
              href={`https://primal.net/e/${reply.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition"
            >
              View reply
            </a>
            {reply.depth !== undefined && reply.depth < maxDepth && (
              <span className="text-gray-600 text-xs">
                Level {reply.depth + 1}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {reply.replies && reply.replies.length > 0 && (
        <div className="mt-2">
          {reply.replies.map((nestedReply) => (
            <ThreadedReply
              key={nestedReply.id}
              reply={nestedReply}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BoostsPage() {
  const [boosts, setBoosts] = useState<ParsedBoost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBoosts, setExpandedBoosts] = useState<Set<string>>(new Set());
  const [isRealTimeActive, setIsRealTimeActive] = useState(false);
  const [lastCacheTime, setLastCacheTime] = useState<number | null>(null);
  const [replyFetchAttempts, setReplyFetchAttempts] = useState<Map<string, number>>(new Map());
  const replyFetchAttemptsRef = useRef<Map<string, number>>(new Map());
  
  // Sync ref with state
  useEffect(() => {
    replyFetchAttemptsRef.current = replyFetchAttempts;
  }, [replyFetchAttempts]);
  
  // Check if Lightning/Boosts are enabled - store in state to avoid conditional hooks
  const boostsEnabled = isBoostsEnabled();
  const nostrKeysConfigured = isNostrKeysConfigured();

  // Helper function to fetch replies for a boost
  const fetchRepliesForBoost = useCallback(async (boostId: string, maxRetries: number = 2): Promise<void> => {
    const service = getBoostToNostrService();
    let attempt = replyFetchAttemptsRef.current.get(boostId) || 0;
    
    try {
      console.log(`Fetching replies for boost: ${boostId.substring(0, 8)}... (attempt ${attempt + 1}/${maxRetries + 1})`);
      
      // Use a longer timeout for reply fetching (15 seconds)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Reply fetch timeout')), 15000)
      );

      // Use fetchThreadedReplies for better reply detection
      const replies = await Promise.race([
        service.fetchThreadedReplies(boostId, 3, 20), // maxDepth 3, limit 20
        timeoutPromise
      ]);

      if (replies.length > 0) {
        console.log(`✅ Found ${replies.length} replies for boost ${boostId.substring(0, 8)}`);
        
        // Build threaded structure
        const mappedReplies = buildThreadedReplies(replies, boostId);
        console.log(`📋 Built ${mappedReplies.length} threaded replies`);
        
        // Recursively enrich replies with user profiles (batched for performance)
        const enrichRepliesWithProfiles = async (replies: ParsedReply[]): Promise<ParsedReply[]> => {
          if (!replies || replies.length === 0) {
            return replies;
          }
          try {
            // Collect all unique pubkeys from replies and nested replies
            const collectPubkeys = (replies: ParsedReply[]): string[] => {
              const pubkeys = new Set<string>();
              for (const reply of replies) {
                pubkeys.add(reply.author);
                if (reply.replies && reply.replies.length > 0) {
                  collectPubkeys(reply.replies).forEach(pk => pubkeys.add(pk));
                }
              }
              return Array.from(pubkeys);
            };

            // Fetch all profiles in one batch with timeout
            const allPubkeys = collectPubkeys(replies);
            let profilesMap: Map<string, UserProfile> = new Map();
            
            try {
              // Add timeout to profile fetching to prevent blocking
              const profileFetchPromise = fetchUserProfilesBatch(allPubkeys);
              const profileTimeoutPromise = new Promise<Map<string, UserProfile>>((resolve) => {
                setTimeout(() => {
                  console.warn('Profile fetch taking too long, using empty profiles');
                  resolve(new Map());
                }, 5000); // 5 second timeout for profiles
              });
              
              profilesMap = await Promise.race([profileFetchPromise, profileTimeoutPromise]);
            } catch (profileError) {
              console.warn('Failed to fetch profiles, continuing without profiles:', profileError);
              // Continue with empty profiles map - replies will show without profile data
              profilesMap = new Map();
            }

            // Enrich replies with profiles
            const enrichReplies = (replies: ParsedReply[]): ParsedReply[] => {
              return replies.map(reply => {
                const profile = profilesMap.get(reply.author) || {};
                const enrichedReply: ParsedReply = { 
                  ...reply, 
                  authorName: profile.name || reply.authorName,
                  authorPicture: profile.picture || reply.authorPicture
                };

                // Recursively enrich nested replies
                if (reply.replies && reply.replies.length > 0) {
                  enrichedReply.replies = enrichReplies(reply.replies);
                }

                return enrichedReply;
              });
            };

            return enrichReplies(replies);
          } catch (error) {
            console.error('Error enriching replies with profiles:', error);
            // Return replies without profile enrichment if enrichment fails
            return replies;
          }
        };

        let enrichedReplies: ParsedReply[];
        try {
          enrichedReplies = await enrichRepliesWithProfiles(mappedReplies);
        } catch (enrichError) {
          console.error('Error during reply enrichment, showing replies without profiles:', enrichError);
          // If enrichment fails, show replies without profile data
          enrichedReplies = mappedReplies;
        }

        // Update the specific boost with replies
        setBoosts(prev => prev.map(b =>
          b.id === boostId ? { ...b, replies: enrichedReplies, repliesLoading: false, repliesError: undefined } : b
        ));
        
        // Clear retry attempt on success
        setReplyFetchAttempts(prev => {
          const newMap = new Map(prev);
          newMap.delete(boostId);
          return newMap;
        });
      } else {
        console.log(`No replies found for boost ${boostId.substring(0, 8)}`);
        // Update to mark as not loading (no replies found, not an error)
        setBoosts(prev => prev.map(b =>
          b.id === boostId ? { ...b, repliesLoading: false } : b
        ));
        
        // Clear retry attempt
        setReplyFetchAttempts(prev => {
          const newMap = new Map(prev);
          newMap.delete(boostId);
          return newMap;
        });
      }
    } catch (error) {
      console.warn(`Failed to fetch replies for boost ${boostId.substring(0, 8)} (attempt ${attempt + 1}):`, error);
      
      attempt++;
      setReplyFetchAttempts(prev => {
        const newMap = new Map(prev);
        newMap.set(boostId, attempt);
        return newMap;
      });
      
      // Retry if we haven't exceeded max retries
      if (attempt <= maxRetries) {
        console.log(`Retrying reply fetch for boost ${boostId.substring(0, 8)}...`);
        // Wait 2 seconds before retry
        setTimeout(() => fetchRepliesForBoost(boostId, maxRetries), 2000);
      } else {
        // Max retries exceeded, mark as error
        console.error(`Failed to fetch replies for boost ${boostId.substring(0, 8)} after ${maxRetries + 1} attempts`);
        setBoosts(prev => prev.map(b =>
          b.id === boostId ? { 
            ...b, 
            repliesLoading: false, 
            repliesError: 'Failed to load replies. Click to retry.' 
          } : b
        ));
      }
    }
  }, []);

  const loadBoosts = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first (cache for 10 minutes)
      const cacheKey = 'boosts_cache';
      const cacheTimeKey = 'boosts_cache_time';
      const cacheValidDuration = 10 * 60 * 1000; // 10 minutes

      if (!forceRefresh) {
        const cachedData = localStorage.getItem(cacheKey);
        const cachedTime = localStorage.getItem(cacheTimeKey);

        if (cachedData && cachedTime) {
          const timeSinceCache = Date.now() - parseInt(cachedTime);
          if (timeSinceCache < cacheValidDuration) {
            console.log('✅ Loading boosts from cache - data is fresh');
            const parsedBoosts = JSON.parse(cachedData);
            setBoosts(parsedBoosts);
            setLastCacheTime(parseInt(cachedTime));
            setLoading(false);
            return;
          }
        }
      }

      const service = getBoostToNostrService();

      // Get the site's Nostr account from environment - derive npub from nsec
      const siteNsec = process.env.NEXT_PUBLIC_SITE_NOSTR_NSEC;
      let appPubkey: string | undefined;

      if (siteNsec) {
        try {
          // Decode nsec to get the secret key
          const { data: secretKey } = nip19.decode(siteNsec);
          if (secretKey instanceof Uint8Array) {
            // Derive public key from secret key
            appPubkey = getPublicKey(secretKey);
            console.log(`Using site account derived from nsec: ${nip19.npubEncode(appPubkey)}`);
          } else {
            console.error('Failed to decode nsec: secret key is not Uint8Array');
            setError('Site Nostr account not configured');
            return;
          }
        } catch (error) {
          console.error('Failed to decode nsec:', error);
          setError('Site Nostr account not configured');
          return;
        }
      } else {
        console.error('NEXT_PUBLIC_SITE_NOSTR_NSEC not configured');
        setError('Site Nostr account not configured');
        return;
      }

      // Fetch boosts from the historical account
      let allBoosts: any[] = [];

      try {
        console.log(`Fetching boosts from account: ${appPubkey.substring(0, 8)}...`);

        // Add timeout to prevent hanging
        const fetchWithTimeout = Promise.race([
          service.fetchUserBoosts(appPubkey, 200), // Fetch up to 200 most recent boosts
          new Promise<[]>((_, reject) =>
            setTimeout(() => reject(new Error('Fetch timeout after 10 seconds')), 10000)
          )
        ]);

        allBoosts = await fetchWithTimeout;
        console.log(`Found ${allBoosts.length} total events from this account`);
      } catch (error) {
        console.warn(`Failed to fetch boosts:`, error);
        allBoosts = [];
      }

      // Parse boosts and fetch replies progressively
      const parsedBoosts: ParsedBoost[] = [];
      let actualBoostCount = 0;

      // Process each boost and immediately fetch its replies
      for (let i = 0; i < allBoosts.length; i++) {
        const event = allBoosts[i];
        const parsedBoost = parseBoostFromEvent(event);

        if (parsedBoost) {
          // Check if this looks like an actual boost (has amount and track info)
          if (parsedBoost.amount && (parsedBoost.trackTitle || parsedBoost.trackArtist)) {
            actualBoostCount++;
          }

          parsedBoost.isFromApp = true;
          parsedBoost.replies = []; // Start with empty replies
          parsedBoost.repliesLoading = true; // Mark as loading
          parsedBoosts.push(parsedBoost);

          // Sort and update the display immediately after adding each boost
          const sortedBoosts = [...parsedBoosts].sort((a, b) => {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            return timeB - timeA;
          });

          setBoosts(sortedBoosts);
          setLoading(false); // Set loading to false after first boost

          // Fetch replies for all boosts in the background (staggered to avoid overwhelming relays)
          // Don't await - fetch replies in background
          setTimeout(() => {
            // Start fetching replies with retry logic
            fetchRepliesForBoost(parsedBoost.id);
          }, i * 200); // Stagger requests by 200ms each to avoid overwhelming relays
        }
      }

      // Cache the results after processing
      const currentTime = Date.now();

      // Wait a bit for replies to be fetched before caching
      setTimeout(() => {
        setBoosts(currentBoosts => {
          // Cache the current state with any replies that have been loaded
          localStorage.setItem(cacheKey, JSON.stringify(currentBoosts));
          localStorage.setItem(cacheTimeKey, currentTime.toString());
          setLastCacheTime(currentTime);
          console.log(`Cached ${currentBoosts.length} boosts with replies`);
          return currentBoosts;
        });
      }, 5000); // Wait 5 seconds for replies to load

      console.log(`Processed ${parsedBoosts.length} total events, ${actualBoostCount} actual boosts with caching enabled`);
    } catch (err) {
      console.error('Error loading boosts:', err);
      setError('Failed to load boosts from Nostr relays');
    } finally {
      setLoading(false);
    }
  }, [fetchRepliesForBoost]);

  useEffect(() => {
    // Only load boosts if feature is enabled
    if (!boostsEnabled) {
      return;
    }

    loadBoosts();

    // Set up real-time subscription for new boosts
    const service = getBoostToNostrService();

    // Get the site's Nostr account from environment - derive npub from nsec
    const siteNsec = process.env.NEXT_PUBLIC_SITE_NOSTR_NSEC;
    let appPubkey: string | undefined;

    if (siteNsec) {
      try {
        // Decode nsec to get the secret key
        const { data: secretKey } = nip19.decode(siteNsec);
        if (secretKey instanceof Uint8Array) {
          // Derive public key from secret key
          appPubkey = getPublicKey(secretKey);
          console.log(`Using site account derived from nsec for real-time subscription: ${nip19.npubEncode(appPubkey)}`);

          // Subscribe to new boosts from this account
          const subscription = service.subscribeToBoosts(
            { authors: [appPubkey] },
          {
            onBoost: async (event) => {
              const parsedBoost = parseBoostFromEvent(event);
              if (parsedBoost) {
                parsedBoost.isFromApp = true;

                // Fetch threaded replies for real-time boost
                try {
                  const threadedReplies = await service.fetchThreadedReplies(event.id, 3, 20);
                  const mappedReplies = buildThreadedReplies(threadedReplies, event.id);

                  // Recursively enrich replies with user profiles
                  const enrichRepliesWithProfiles = async (replies: ParsedReply[]): Promise<ParsedReply[]> => {
                    return Promise.all(replies.map(async reply => {
                      const profile = await fetchUserProfile(reply.author);
                      const enrichedReply = { 
                        ...reply, 
                        authorName: profile.name || reply.authorName,
                        authorPicture: profile.picture || reply.authorPicture
                      };

                      // Recursively enrich nested replies
                      if (reply.replies && reply.replies.length > 0) {
                        enrichedReply.replies = await enrichRepliesWithProfiles(reply.replies);
                      }

                      return enrichedReply;
                    }));
                  };

                  const enrichedReplies = await enrichRepliesWithProfiles(mappedReplies);

                  parsedBoost.replies = enrichedReplies;
                } catch (error) {
                  console.warn('Failed to fetch threaded replies for real-time boost:', event.id, error);
                  parsedBoost.replies = [];
                }

                setBoosts(prev => {
                  // Check if boost already exists
                  const exists = prev.some(b => b.id === parsedBoost.id);
                  if (exists) return prev;

                  // Add new boost to the beginning and sort by timestamp
                  const updated = [parsedBoost, ...prev];
                  return updated.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                });
              }
            },
            onError: (err) => {
              console.error('Real-time boost subscription error:', err);
              setIsRealTimeActive(false);
            }
          }
        );

          setIsRealTimeActive(true);

          // Cleanup subscription on unmount
          return () => {
            if (subscription && typeof subscription.close === 'function') {
              subscription.close();
            }
            setIsRealTimeActive(false);
          };
        } else {
          console.error('Failed to decode nsec: secret key is not Uint8Array');
        }
      } catch (error) {
        console.error('Failed to set up real-time subscription:', error);
      }
    } else {
      console.warn('NEXT_PUBLIC_SITE_NOSTR_NSEC not configured, skipping real-time subscription');
    }
  }, [boostsEnabled, loadBoosts]);

  // Check if Lightning/Boosts are enabled - show error message if not
  if (!boostsEnabled) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-2xl font-bold mb-4">Boosts Not Available</h1>
          <p className="text-gray-400 mb-6">
            Lightning Network features are not enabled for this site. To enable boosts, set the environment variable:
          </p>
          <code className="block bg-gray-800 p-4 rounded-lg text-sm mb-6">
            NEXT_PUBLIC_ENABLE_LIGHTNING=true
          </code>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Home</span>
          </Link>
        </div>
      </div>
    );
  }

  const filteredBoosts = boosts;

  // Calculate statistics
  const totalBoosts = boosts.length;
  // Since we're only pulling from the app's npub, all events should be boosts
  const actualBoosts = boosts.length;
  const totalSats = boosts.reduce((sum, boost) => {
    if (!boost.amount) return sum;

    let sats = 0;
    const amount = boost.amount;

    if (amount.endsWith('M')) {
      sats = parseFloat(amount.slice(0, -1)) * 1000000;
    } else if (amount.endsWith('k') || amount.endsWith('K')) {
      sats = parseFloat(amount.slice(0, -1)) * 1000;
    } else {
      sats = parseFloat(amount);
    }

    // Debug: Log unusual amounts for verification
    if (sats > 100000 || isNaN(sats)) {
      console.log(`Unusual sats amount: "${amount}" -> ${sats} for boost:`, boost.id.substring(0, 8));
    }

    return sum + (isNaN(sats) ? 0 : sats);
  }, 0);

  const toggleBoostExpansion = (boostId: string) => {
    setExpandedBoosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(boostId)) {
        newSet.delete(boostId);
      } else {
        newSet.add(boostId);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Override parent layout background */}
      <style jsx global>{`
        body {
          background: linear-gradient(to bottom, rgb(17, 24, 39), rgb(0, 0, 0)) !important;
        }
        .min-h-screen.bg-gray-50 {
          background: transparent !important;
        }
      `}</style>
        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-start mb-4">
            <Link 
              href="/" 
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
              <span>Back</span>
            </Link>
          </div>
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              ⚡ Boosts
            </h1>
          </div>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <p className="text-gray-400">
                Recent boosts sent from this site and their replies from the Nostr network
              </p>
              {isRealTimeActive && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  Live Updates
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
            <button
              onClick={() => loadBoosts(true)}
              className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition"
            >
              🔄 Refresh
            </button>
            {lastCacheTime && (
              <div className="text-xs text-gray-500">
                Cached {formatTimestamp(Math.floor(lastCacheTime / 1000))}
              </div>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800/50 rounded-lg p-6 backdrop-blur-sm">
            <div className="text-2xl font-bold text-yellow-400">{actualBoosts}</div>
            <div className="text-gray-400">Actual Boosts</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-6 backdrop-blur-sm">
            <div className="text-2xl font-bold text-orange-400">
              {totalSats.toLocaleString()} sats
            </div>
            <div className="text-gray-400">Total Value</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-6 backdrop-blur-sm">
            <div className="text-xl font-bold text-gray-400">{totalBoosts}</div>
            <div className="text-gray-500 text-sm">Total Events</div>
          </div>
        </div>


        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-400">Loading boosts from Nostr relays...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => loadBoosts(true)}
              className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Try Again
            </button>
          </div>
        ) : filteredBoosts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-xl mb-2">No boosts found</p>
            <p className="text-sm">
              Be the first to send a boost!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBoosts.map((boost) => (
              <div
                key={boost.id}
                className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 hover:bg-gray-800/70 transition"
              >
                <div className="flex flex-col gap-4">
                  {/* Boost Info */}
                  <div className="flex-1">
                    {/* Amount - Always on its own line for mobile */}
                    {boost.amount && (
                      <div className="mb-3">
                        <span className="text-2xl font-bold text-yellow-400">
                          ⚡ {boost.amount} sats
                        </span>
                      </div>
                    )}

                    {/* Track Title - On its own line */}
                    {boost.trackTitle && (
                      <div className="mb-2">
                        <span className="text-lg text-white font-medium">
                          &ldquo;{boost.trackTitle}&rdquo;
                        </span>
                      </div>
                    )}

                    {/* Artist and Album - Better spacing */}
                    {(boost.trackArtist || boost.trackAlbum) && (
                      <div className="text-gray-400 mb-4 space-y-1">
                        {boost.trackArtist && (
                          <div className="text-base">by {boost.trackArtist}</div>
                        )}
                        {boost.trackAlbum && (
                          <div className="text-sm">Sent by: {boost.trackAlbum}</div>
                        )}
                      </div>
                    )}

                    {/* User Message */}
                    {boost.userMessage && (
                      <div className="mb-3">
                        <div className="text-gray-300 italic bg-gray-800/30 rounded-lg p-3 border-l-2 border-blue-400/50">
                          &ldquo;{boost.userMessage}&rdquo;
                        </div>
                      </div>
                    )}

                    {/* Links and Actions - Mobile-optimized */}
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 items-center">
                      {boost.url && (
                        <a
                          href={boost.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300 transition text-sm font-medium py-1"
                        >
                          🎧 Listen
                        </a>
                      )}
                      <a
                        href={`https://primal.net/e/${boost.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 transition text-sm py-1"
                      >
                        View on Nostr
                      </a>
                      <a
                        href={`https://primal.net/p/${boost.author}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition text-sm py-1"
                      >
                        Profile
                      </a>

                      {/* Show replies button if there are replies, loading, or error */}
                      {(boost.replies && boost.replies.length > 0) || boost.repliesLoading || boost.repliesError ? (
                        <button
                          onClick={() => {
                            if (boost.repliesError) {
                              // Retry fetching replies on error
                              setBoosts(prev => prev.map(b =>
                                b.id === boost.id ? { ...b, repliesLoading: true, repliesError: undefined } : b
                              ));
                              setReplyFetchAttempts(prev => {
                                const newMap = new Map(prev);
                                newMap.delete(boost.id);
                                return newMap;
                              });
                              // Trigger retry
                              setTimeout(() => fetchRepliesForBoost(boost.id), 100);
                            } else {
                              toggleBoostExpansion(boost.id);
                            }
                          }}
                          className="text-gray-400 hover:text-gray-300 transition flex items-center gap-1 text-sm py-1"
                        >
                          {boost.repliesLoading ? (
                            <>
                              <span className="animate-spin">⏳</span> Loading replies...
                            </>
                          ) : boost.repliesError ? (
                            <>
                              ⚠️ {boost.repliesError}
                            </>
                          ) : (
                            <>
                              💬 {boost.replies?.length ?? 0} {(boost.replies?.length ?? 0) === 1 ? 'reply' : 'replies'}
                              <span className="text-xs ml-1">
                                {expandedBoosts.has(boost.id) ? '▼' : '▶'}
                              </span>
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>

                    {/* Timestamp - Below actions on mobile */}
                    <div className="text-gray-500 text-sm mt-3 pt-2 border-t border-gray-700/50">
                      {formatTimestamp(boost.timestamp)}
                    </div>
                  </div>
                </div>

                {/* Threaded Replies Section */}
                {expandedBoosts.has(boost.id) && (
                  <div className="mt-4 border-l-2 border-gray-700 pl-4">
                    {boost.repliesLoading && (
                      <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                        <span className="animate-spin">⏳</span>
                        Loading replies...
                      </div>
                    )}
                    {boost.repliesError && !boost.repliesLoading && (
                      <div className="text-sm text-yellow-400 mb-3">
                        ⚠️ {boost.repliesError}
                      </div>
                    )}
                    {boost.replies && boost.replies.length > 0 && !boost.repliesLoading && (
                      <>
                        <div className="text-sm text-gray-400 font-semibold mb-3">
                          Replies ({boost.replies.length}):
                        </div>
                        <div className="space-y-2">
                          {boost.replies.map((reply) => (
                            <ThreadedReply
                              key={reply.id}
                              reply={reply}
                              maxDepth={3}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {!boost.repliesLoading && !boost.repliesError && (!boost.replies || boost.replies.length === 0) && (
                      <div className="text-sm text-gray-500 mb-3">
                        No replies yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}