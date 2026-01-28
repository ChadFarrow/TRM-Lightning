'use client';

import { memo } from 'react';
import Image from 'next/image';
import { User, ExternalLink, Mic, Users } from 'lucide-react';
import type { PodcastPerson } from '@/lib/types/podcast';
import { DARK_CARD_CLASSES } from '@/lib/theme-utils';

interface PersonDisplayProps {
  persons: PodcastPerson[];
  variant?: 'compact' | 'full' | 'grid';
  maxDisplay?: number;
  className?: string;
}

function PersonDisplay({
  persons,
  variant = 'compact',
  maxDisplay = 10,
  className = ''
}: PersonDisplayProps) {
  if (!persons || persons.length === 0) {
    return null;
  }

  // Group persons by role/group
  const groupedPersons = persons.reduce((acc, person) => {
    const group = person.group || person.role || 'Contributors';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(person);
    return acc;
  }, {} as Record<string, PodcastPerson[]>);

  // Get role icon
  const getRoleIcon = (role?: string) => {
    const lowerRole = role?.toLowerCase() || '';
    if (lowerRole.includes('host')) return <Mic className="w-3 h-3" />;
    if (lowerRole.includes('guest')) return <User className="w-3 h-3" />;
    return null;
  };

  // Get role color
  const getRoleColor = (role?: string) => {
    const lowerRole = role?.toLowerCase() || '';
    if (lowerRole.includes('host')) return 'text-purple-400';
    if (lowerRole.includes('guest')) return 'text-blue-400';
    if (lowerRole.includes('producer')) return 'text-green-400';
    if (lowerRole.includes('editor')) return 'text-orange-400';
    return 'text-gray-400';
  };

  if (variant === 'compact') {
    // Show avatars in a row with overlap
    const displayedPersons = persons.slice(0, maxDisplay);
    const remaining = persons.length - maxDisplay;

    return (
      <div className={`flex items-center ${className}`}>
        <div className="flex -space-x-2">
          {displayedPersons.map((person, index) => (
            <div
              key={index}
              className="relative"
              style={{ zIndex: maxDisplay - index }}
            >
              {person.href ? (
                <a
                  href={person.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${person.name}${person.role ? ` (${person.role})` : ''}`}
                  className="block"
                >
                  {person.img ? (
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-gray-900">
                      <Image
                        src={person.img}
                        alt={person.name}
                        fill
                        className="object-cover"
                        sizes="32px"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </a>
              ) : (
                <div title={`${person.name}${person.role ? ` (${person.role})` : ''}`}>
                  {person.img ? (
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-gray-900">
                      <Image
                        src={person.img}
                        alt={person.name}
                        fill
                        className="object-cover"
                        sizes="32px"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {remaining > 0 && (
            <div className="w-8 h-8 rounded-full bg-gray-600 border-2 border-gray-900 flex items-center justify-center text-xs text-white font-medium">
              +{remaining}
            </div>
          )}
        </div>
        {persons.length <= 2 && (
          <div className="ml-3 text-sm text-gray-300">
            {displayedPersons.map(p => p.name).join(', ')}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 ${className}`}>
        {persons.slice(0, maxDisplay).map((person, index) => (
          <PersonCard key={index} person={person} />
        ))}
      </div>
    );
  }

  // Full variant - grouped by role
  return (
    <div className={`space-y-6 ${className}`}>
      {Object.entries(groupedPersons).map(([group, groupPersons]) => (
        <div key={group}>
          <h4 className="text-gray-400 text-sm font-medium mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            {group}
          </h4>
          <div className="space-y-3">
            {groupPersons.map((person, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                {/* Avatar */}
                {person.img ? (
                  <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={person.img}
                      alt={person.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{person.name}</p>
                  {person.role && (
                    <p className={`text-sm flex items-center gap-1 ${getRoleColor(person.role)}`}>
                      {getRoleIcon(person.role)}
                      {person.role}
                    </p>
                  )}
                </div>

                {/* External link */}
                {person.href && (
                  <a
                    href={person.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-700 rounded-full transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Individual person card component
function PersonCard({ person }: { person: PodcastPerson }) {
  const content = (
    <div className={`${DARK_CARD_CLASSES} p-4 text-center hover:bg-white/5 transition-colors`}>
      {/* Avatar */}
      {person.img ? (
        <div className="relative w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden">
          <Image
            src={person.img}
            alt={person.name}
            fill
            className="object-cover"
            sizes="64px"
          />
        </div>
      ) : (
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-700 flex items-center justify-center">
          <User className="w-8 h-8 text-gray-400" />
        </div>
      )}

      {/* Name */}
      <p className="text-white font-medium truncate">{person.name}</p>

      {/* Role */}
      {person.role && (
        <p className="text-gray-400 text-sm truncate mt-1">{person.role}</p>
      )}

      {/* Group */}
      {person.group && person.group !== person.role && (
        <p className="text-purple-400 text-xs truncate mt-1">{person.group}</p>
      )}

      {/* External link indicator */}
      {person.href && (
        <div className="mt-2 flex items-center justify-center gap-1 text-gray-500 text-xs">
          <ExternalLink className="w-3 h-3" />
          <span>View profile</span>
        </div>
      )}
    </div>
  );

  if (person.href) {
    return (
      <a
        href={person.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {content}
      </a>
    );
  }

  return content;
}

export default memo(PersonDisplay);
