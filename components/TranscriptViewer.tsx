'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { FileText, Search, X, Loader2, Download, ChevronDown, ChevronUp } from 'lucide-react';
import type { PodcastTranscript } from '@/lib/types/podcast';
import { DARK_CARD_CLASSES } from '@/lib/theme-utils';

interface TranscriptSegment {
  startTime: number;
  endTime?: number;
  text: string;
  speaker?: string;
}

interface TranscriptViewerProps {
  transcripts?: PodcastTranscript[];
  currentTime: number;
  onSeek: (time: number) => void;
  variant?: 'compact' | 'full' | 'inline';
  className?: string;
}

function TranscriptViewer({
  transcripts,
  currentTime,
  onSeek,
  variant = 'compact',
  className = ''
}: TranscriptViewerProps) {
  const [selectedTranscript, setSelectedTranscript] = useState<PodcastTranscript | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Select first transcript on mount
  useEffect(() => {
    if (transcripts && transcripts.length > 0 && !selectedTranscript) {
      setSelectedTranscript(transcripts[0]);
    }
  }, [transcripts, selectedTranscript]);

  // Fetch and parse transcript
  useEffect(() => {
    if (!selectedTranscript) return;

    setIsLoading(true);
    setError(null);

    fetchAndParseTranscript(selectedTranscript)
      .then(setSegments)
      .catch((err) => {
        console.error('Error loading transcript:', err);
        setError('Failed to load transcript');
        setSegments([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [selectedTranscript]);

  // Auto-scroll to current segment
  useEffect(() => {
    if (activeSegmentRef.current && transcriptRef.current && isExpanded) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentTime, isExpanded]);

  // Fetch and parse transcript from URL
  async function fetchAndParseTranscript(transcript: PodcastTranscript): Promise<TranscriptSegment[]> {
    const isServer = typeof window === 'undefined';

    let response;
    if (isServer) {
      response = await fetch(transcript.url, {
        headers: { 'User-Agent': 'TRM-Lightning/1.0' },
      });
    } else {
      const proxyUrl = `/api/proxy-chapters?url=${encodeURIComponent(transcript.url)}`;
      response = await fetch(proxyUrl);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.status}`);
    }

    const content = await response.text();

    // Parse based on type
    switch (transcript.type) {
      case 'application/json':
        return parseJsonTranscript(content);
      case 'application/srt':
        return parseSrtTranscript(content);
      case 'text/vtt':
        return parseVttTranscript(content);
      case 'text/plain':
        return parsePlainTextTranscript(content);
      default:
        // Try to detect format
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
          return parseJsonTranscript(content);
        } else if (content.includes('WEBVTT')) {
          return parseVttTranscript(content);
        } else if (/^\d+\r?\n\d{2}:\d{2}:\d{2}/.test(content.trim())) {
          return parseSrtTranscript(content);
        }
        return parsePlainTextTranscript(content);
    }
  }

  // Parse JSON transcript (Podcast 2.0 format)
  function parseJsonTranscript(content: string): TranscriptSegment[] {
    const data = JSON.parse(content);
    const segments: TranscriptSegment[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        segments.push({
          startTime: item.startTime || 0,
          endTime: item.endTime,
          text: item.body || item.text || '',
          speaker: item.speaker
        });
      }
    } else if (data.segments) {
      for (const item of data.segments) {
        segments.push({
          startTime: item.startTime || 0,
          endTime: item.endTime,
          text: item.body || item.text || '',
          speaker: item.speaker
        });
      }
    }

    return segments;
  }

  // Parse SRT transcript
  function parseSrtTranscript(content: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const blocks = content.trim().split(/\r?\n\r?\n/);

    for (const block of blocks) {
      const lines = block.split(/\r?\n/);
      if (lines.length >= 3) {
        const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
        if (timeMatch) {
          const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
          const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
          const text = lines.slice(2).join(' ').replace(/<[^>]*>/g, '');

          segments.push({ startTime, endTime, text });
        }
      }
    }

    return segments;
  }

  // Parse VTT transcript
  function parseVttTranscript(content: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const lines = content.split(/\r?\n/);
    let currentSegment: Partial<TranscriptSegment> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip header and notes
      if (trimmed === 'WEBVTT' || trimmed.startsWith('NOTE')) continue;

      // Parse timestamp line
      const timeMatch = trimmed.match(/(\d{2}):(\d{2}):(\d{2})[.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.](\d{3})/);
      if (timeMatch) {
        if (currentSegment && currentSegment.text) {
          segments.push(currentSegment as TranscriptSegment);
        }
        const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
        const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
        currentSegment = { startTime, endTime, text: '' };
        continue;
      }

      // Also check for MM:SS format
      const shortTimeMatch = trimmed.match(/(\d{2}):(\d{2})[.](\d{3})\s*-->\s*(\d{2}):(\d{2})[.](\d{3})/);
      if (shortTimeMatch) {
        if (currentSegment && currentSegment.text) {
          segments.push(currentSegment as TranscriptSegment);
        }
        const startTime = parseInt(shortTimeMatch[1]) * 60 + parseInt(shortTimeMatch[2]) + parseInt(shortTimeMatch[3]) / 1000;
        const endTime = parseInt(shortTimeMatch[4]) * 60 + parseInt(shortTimeMatch[5]) + parseInt(shortTimeMatch[6]) / 1000;
        currentSegment = { startTime, endTime, text: '' };
        continue;
      }

      // Add text to current segment
      if (currentSegment && trimmed) {
        currentSegment.text = currentSegment.text
          ? currentSegment.text + ' ' + trimmed.replace(/<[^>]*>/g, '')
          : trimmed.replace(/<[^>]*>/g, '');
      }
    }

    // Add last segment
    if (currentSegment && currentSegment.text) {
      segments.push(currentSegment as TranscriptSegment);
    }

    return segments;
  }

  // Parse plain text transcript
  function parsePlainTextTranscript(content: string): TranscriptSegment[] {
    // For plain text, we create a single segment
    return [{
      startTime: 0,
      text: content.trim()
    }];
  }

  // Find current segment index
  const getCurrentSegmentIndex = (): number => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (currentTime >= segments[i].startTime) {
        return i;
      }
    }
    return 0;
  };

  const currentSegmentIndex = getCurrentSegmentIndex();

  // Filter segments by search query
  const filteredSegments = searchQuery
    ? segments.filter(s => s.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : segments;

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!transcripts || transcripts.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`${DARK_CARD_CLASSES} p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading transcript...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${DARK_CARD_CLASSES} p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-400">
          <FileText className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    // Inline mode - shows current segment only
    const currentSegment = segments[currentSegmentIndex];
    if (!currentSegment) return null;

    return (
      <div className={`text-gray-300 text-sm ${className}`}>
        <span className="text-gray-500">{formatTime(currentSegment.startTime)}</span>
        {' '}
        {currentSegment.speaker && (
          <span className="text-purple-400 font-medium">{currentSegment.speaker}: </span>
        )}
        {currentSegment.text}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`${DARK_CARD_CLASSES} ${className}`}>
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <span className="text-white text-sm font-medium">Transcript</span>
            {selectedTranscript?.language && (
              <span className="text-gray-400 text-xs">({selectedTranscript.language})</span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {/* Current segment preview */}
        {!isExpanded && segments[currentSegmentIndex] && (
          <div className="px-3 pb-3">
            <p className="text-gray-300 text-sm line-clamp-2">
              {segments[currentSegmentIndex].text}
            </p>
          </div>
        )}

        {/* Expanded view */}
        {isExpanded && (
          <div className="border-t border-gray-800">
            {/* Search bar */}
            <div className="p-3 border-b border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search transcript..."
                  className="w-full pl-9 pr-9 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Transcript segments */}
            <div ref={transcriptRef} className="max-h-64 overflow-y-auto p-3 space-y-2">
              {filteredSegments.map((segment, index) => {
                const isActive = index === currentSegmentIndex && !searchQuery;

                return (
                  <div
                    key={index}
                    ref={isActive ? activeSegmentRef : null}
                    onClick={() => onSeek(segment.startTime)}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-purple-500/20 border border-purple-500/50'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="text-gray-500 text-xs">{formatTime(segment.startTime)}</span>
                    {segment.speaker && (
                      <span className="text-purple-400 text-xs ml-2">{segment.speaker}</span>
                    )}
                    <p className={`text-sm mt-1 ${isActive ? 'text-white' : 'text-gray-300'}`}>
                      {segment.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={`${DARK_CARD_CLASSES} ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          Transcript
        </h3>

        <div className="flex items-center gap-2">
          {/* Transcript selector */}
          {transcripts.length > 1 && (
            <select
              value={transcripts.indexOf(selectedTranscript!)}
              onChange={(e) => setSelectedTranscript(transcripts[parseInt(e.target.value)])}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
            >
              {transcripts.map((t, i) => (
                <option key={i} value={i}>
                  {t.language || `Transcript ${i + 1}`}
                  {t.rel === 'captions' ? ' (Captions)' : ''}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 hover:bg-gray-800 rounded transition-colors"
          >
            <Search className="w-4 h-4 text-gray-400" />
          </button>

          {selectedTranscript && (
            <a
              href={selectedTranscript.url}
              download
              className="p-2 hover:bg-gray-800 rounded transition-colors"
            >
              <Download className="w-4 h-4 text-gray-400" />
            </a>
          )}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="p-4 border-b border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcript..."
              className="w-full pl-9 pr-9 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-gray-400 text-sm mt-2">
              {filteredSegments.length} result{filteredSegments.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Transcript content */}
      <div ref={transcriptRef} className="max-h-96 overflow-y-auto p-4 space-y-3">
        {filteredSegments.map((segment, index) => {
          const actualIndex = searchQuery
            ? segments.indexOf(segment)
            : index;
          const isActive = actualIndex === currentSegmentIndex;

          return (
            <div
              key={index}
              ref={isActive ? activeSegmentRef : null}
              onClick={() => onSeek(segment.startTime)}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                isActive
                  ? 'bg-purple-500/20 border border-purple-500/50'
                  : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-purple-400 text-xs font-mono">
                  {formatTime(segment.startTime)}
                </span>
                {segment.speaker && (
                  <span className="text-gray-400 text-xs font-medium">
                    {segment.speaker}
                  </span>
                )}
              </div>
              <p className={`${isActive ? 'text-white' : 'text-gray-300'}`}>
                {segment.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(TranscriptViewer);
