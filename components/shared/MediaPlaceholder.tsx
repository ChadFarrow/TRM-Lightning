'use client';

import { Music, Users, Video, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type PlaceholderType = 'music' | 'users' | 'video' | 'audio';

interface MediaPlaceholderProps {
  type?: PlaceholderType;
  isLoading?: boolean;
  isError?: boolean;
  className?: string;
}

const iconMap: Record<PlaceholderType, LucideIcon> = {
  music: Music,
  users: Users,
  video: Video,
  audio: Volume2,
};

/**
 * Shared loading/error placeholder for card components.
 * Shows animated icon for loading state, static icon for error state.
 */
export default function MediaPlaceholder({
  type = 'music',
  isLoading = false,
  isError = false,
  className = '',
}: MediaPlaceholderProps) {
  const Icon = iconMap[type];

  if (!isLoading && !isError) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center ${className}`}
    >
      <Icon className={`w-8 h-8 text-gray-400 ${isLoading ? 'animate-pulse' : ''}`} />
    </div>
  );
}
