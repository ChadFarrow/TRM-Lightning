'use client';

import Link from 'next/link';
import { getVersionString } from '@/lib/version';
import { isLightningEnabled as isLightningFeatureEnabled, isNostrKeysConfigured } from '@/lib/feature-flags';
import LightningToggle from '@/components/LightningToggle';
import { DARK_SIDEBAR_BG } from '@/lib/theme-utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isLightningEnabled: boolean;
}

export default function Sidebar({ isOpen, onClose, isLightningEnabled }: SidebarProps) {
  if (!isOpen) return null;

  return (
    <>
      <div 
        className={`fixed top-0 left-0 h-full w-80 bg-neutral-900 transform transition-transform duration-300 z-30 border-r border-white/20 shadow-2xl translate-x-0`}
      >
        <div className="p-4 pt-16 flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-neutral-200">Menu</h2>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="p-2 rounded-lg hover:bg-neutral-800/80 transition-colors cursor-pointer z-40 relative pointer-events-auto text-neutral-200 hover:text-neutral-100"
              aria-label="Close menu"
              type="button"
              style={{ pointerEvents: 'auto' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="mb-4 space-y-1">
            <Link
              href="/"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-800/80 transition-colors text-neutral-200 hover:text-neutral-100 no-underline"
              onClick={onClose}
            >
              <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <span className="text-sm drop-shadow-sm text-neutral-200">Music</span>
            </Link>

            <Link
              href="/podcasts"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-800/80 transition-colors text-neutral-200 hover:text-neutral-100 no-underline"
              onClick={onClose}
            >
              <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span className="text-sm drop-shadow-sm text-neutral-200">Podcasts</span>
            </Link>

            <Link
              href="/about"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-800/80 transition-colors text-neutral-200 hover:text-neutral-100 no-underline"
              onClick={onClose}
            >
              <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm drop-shadow-sm text-neutral-200">About & Support</span>
            </Link>

            {isLightningEnabled && isNostrKeysConfigured() && (
              <Link
                href="/boosts"
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-800/80 transition-colors text-neutral-200 hover:text-neutral-100 no-underline"
                onClick={onClose}
              >
                <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm drop-shadow-sm text-neutral-200">⚡ Boosts</span>
              </Link>
            )}
          </div>
          
          {/* Lightning Toggle - only show if Lightning feature is enabled via env var */}
          {isLightningFeatureEnabled() && (
            <div className="pt-4 border-t border-neutral-700">
              <LightningToggle />
            </div>
          )}
          
          <div className="mt-auto pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-300 drop-shadow-sm">Version</span>
              <span className="text-xs text-neutral-200 font-mono drop-shadow-sm">{getVersionString()}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-20" 
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
        role="button"
        tabIndex={-1}
        aria-label="Close menu"
      />
    </>
  );
}

