'use client';

import { Filter, Grid3X3, List, Shuffle, Mic } from 'lucide-react';

export type FilterType = 'full_shows' | 'band_sets' | 'videos' | 'audio' | 'playlist' | 'podcasts';
export type ViewType = 'grid' | 'list';
interface ControlsBarProps {
  // Filter props
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  showFilters?: boolean;
  filterOptions?: { value: FilterType; label: string; icon?: React.ReactNode }[];

  // View props
  viewType: ViewType;
  onViewChange: (view: ViewType) => void;
  showViewToggle?: boolean;

  // Shuffle prop
  onShuffle?: () => void;
  showShuffle?: boolean;

  // Customization
  className?: string;
  resultCount?: number;
  resultLabel?: string;
}

const defaultFilters: { value: FilterType; label: string; icon?: React.ReactNode }[] = [
  { value: 'full_shows', label: 'Full Shows' },
  { value: 'band_sets', label: 'Band Sets' },
  { value: 'videos', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'podcasts', label: 'BTS', icon: <Mic className="w-3 h-3" /> },
];

export default function ControlsBar({
  activeFilter,
  onFilterChange,
  showFilters = true,
  filterOptions = defaultFilters,
  viewType,
  onViewChange,
  showViewToggle = true,
  onShuffle,
  showShuffle = false,
  className = '',
  resultCount,
  resultLabel = 'results',
}: ControlsBarProps) {
  return (
    <div className={`bg-black/40 backdrop-blur-md rounded-xl border border-white/20 shadow-lg ${className}`}>
      {/* Mobile Layout - Stacked */}
      <div className="block sm:hidden">
        {/* First Row - Filters */}
        {showFilters && (
          <div className="p-3 border-b border-white/10">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {filterOptions.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => onFilterChange(filter.value)}
                  className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-all touch-manipulation flex-shrink-0 flex items-center gap-1 ${
                    activeFilter === filter.value
                      ? filter.value === 'podcasts'
                        ? 'bg-purple-500/40 text-white shadow-sm drop-shadow-sm'
                        : 'bg-white/30 text-white shadow-sm drop-shadow-sm'
                      : 'text-gray-200 hover:text-white hover:bg-white/20 active:bg-white/25'
                  }`}
                >
                  {filter.icon}
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Second Row - Sort, Count, and Actions */}
        <div className="flex items-center justify-between p-3 gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Result count */}
            {resultCount !== undefined && (
              <div className="text-xs text-gray-200 whitespace-nowrap drop-shadow-sm">
                <span className="font-medium text-white">{resultCount}</span> {resultLabel}
              </div>
            )}
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Shuffle Button */}
            {showShuffle && onShuffle && (
              <button
                onClick={onShuffle}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white p-1.5 rounded-lg transition-all touch-manipulation shadow-lg hover:shadow-xl active:scale-95"
                title="Random Shuffle"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            )}

            {/* View Toggle */}
            {showViewToggle && (
              <div className="flex items-center bg-black/50 rounded-lg p-1 border border-white/20">
                <button
                  onClick={() => onViewChange('grid')}
                  className={`p-1 rounded transition-all touch-manipulation ${
                    viewType === 'grid' 
                      ? 'bg-white/30 text-white shadow-sm drop-shadow-sm' 
                      : 'text-gray-200 hover:text-white active:bg-white/20'
                  }`}
                  title="Grid view"
                >
                  <Grid3X3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onViewChange('list')}
                  className={`p-1 rounded transition-all touch-manipulation ${
                    viewType === 'list' 
                      ? 'bg-white/30 text-white shadow-sm drop-shadow-sm' 
                      : 'text-gray-200 hover:text-white active:bg-white/20'
                  }`}
                  title="List view"
                >
                  <List className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Layout - Single Row */}
      <div className="hidden sm:flex items-center gap-3 p-3 sm:p-4 overflow-x-auto">
        {/* Left side - Filters, Sort, and Result count */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Filters */}
          {showFilters && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-200 flex-shrink-0 drop-shadow-sm" />
              <div className="flex gap-1">
                {filterOptions.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => onFilterChange(filter.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all touch-manipulation flex items-center gap-1.5 ${
                      activeFilter === filter.value
                        ? filter.value === 'podcasts'
                          ? 'bg-purple-500/40 text-white shadow-sm drop-shadow-sm'
                          : 'bg-white/30 text-white shadow-sm drop-shadow-sm'
                        : 'text-gray-200 hover:text-white hover:bg-white/20 active:bg-white/25'
                    }`}
                  >
                    {filter.icon}
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Result count */}
          {resultCount !== undefined && (
            <div className="text-sm text-gray-200 whitespace-nowrap drop-shadow-sm">
              <span className="font-medium text-white">{resultCount}</span> {resultLabel}
            </div>
          )}
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Shuffle Button */}
          {showShuffle && onShuffle && (
            <button
              onClick={onShuffle}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white p-1.5 rounded-lg transition-all touch-manipulation shadow-lg hover:shadow-xl active:scale-95"
              title="Random Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          )}

          {/* View Toggle */}
          {showViewToggle && (
            <div className="flex items-center bg-white/15 rounded-lg p-1 border border-white/20">
              <button
                onClick={() => onViewChange('grid')}
                className={`p-1.5 rounded transition-all touch-manipulation ${
                  viewType === 'grid' 
                    ? 'bg-white/30 text-white shadow-sm drop-shadow-sm' 
                    : 'text-gray-200 hover:text-white active:bg-white/20'
                }`}
                title="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewChange('list')}
                className={`p-1.5 rounded transition-all touch-manipulation ${
                  viewType === 'list' 
                    ? 'bg-white/30 text-white shadow-sm drop-shadow-sm' 
                    : 'text-gray-200 hover:text-white active:bg-white/20'
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}