import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { getSiteName } from '@/lib/site-config'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import ErrorBoundary from '@/components/ErrorBoundary'
import ClientErrorBoundary from '@/components/ClientErrorBoundary'
import { ToastContainer } from '@/components/Toast'
import PerformanceMonitor from '@/components/PerformanceMonitor'
import { AudioProvider } from '@/contexts/AudioContext'
import { BitcoinConnectProvider } from '@/contexts/BitcoinConnectContext'
import { LightningProvider } from '@/contexts/LightningContext'
import GlobalNowPlayingBar from '@/components/GlobalNowPlayingBar'
import dynamic from 'next/dynamic'

// Dynamic import for the BoostGoat component (client-side only)
const BoostGoat = dynamic(() => import('@/components/BoostGoat'), { ssr: false })



const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true
})

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_SITE_TITLE || getSiteName() || 'Music Platform',
  description: 'Value4Value music platform powered by Lightning Network',
  manifest: '/manifest.json',
  // Icons removed - add your own favicon and PWA icons
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: getSiteName() || 'Music Platform',
    // startupImage removed - add your own when ready
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': getSiteName() || 'Music Platform',
    'mobile-web-app-capable': 'yes',
    'format-detection': 'telephone=no',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1f2937',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* CRITICAL: Polyfill must run FIRST before any other scripts - use blocking script */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              // CRITICAL: Define chrome IMMEDIATELY - no function wrapper, execute directly
              // This must be the absolute first thing to run
              (function() {
                'use strict';
                var chromePolyfill = {
                  runtime: { 
                    onConnect: { addListener: function() {}, removeListener: function() {} }, 
                    onMessage: { addListener: function() {}, removeListener: function() {} }, 
                    connect: function() { return { onMessage: { addListener: function() {} }, postMessage: function() {}, disconnect: function() {} }; }, 
                    sendMessage: function() { return Promise.resolve(); }, 
                    getURL: function() { return ''; }, 
                    getManifest: function() { return {}; } 
                  },
                  storage: { local: { get: function() { return Promise.resolve({}); }, set: function() { return Promise.resolve(); }, remove: function() { return Promise.resolve(); }, clear: function() { return Promise.resolve(); } }, sync: { get: function() { return Promise.resolve({}); }, set: function() { return Promise.resolve(); } } },
                  tabs: { query: function() { return Promise.resolve([]); }, create: function() { return Promise.resolve({}); }, update: function() { return Promise.resolve(); }, get: function() { return Promise.resolve({}); } },
                  windows: { create: function() { return Promise.resolve({}); }, get: function() { return Promise.resolve({}); }, getAll: function() { return Promise.resolve([]); } },
                  extension: { getURL: function() { return ''; }, getBackgroundPage: function() { return null; } }
                };
                
                try {
                  if (typeof globalThis !== 'undefined') {
                    globalThis.chrome = globalThis.chrome || chromePolyfill;
                    globalThis.browser = globalThis.browser || globalThis.chrome;
                  }
                } catch (e) {}
                
                try {
                  if (typeof window !== 'undefined') {
                    window.chrome = window.chrome || chromePolyfill;
                    window.browser = window.browser || window.chrome;
                  }
                } catch (e) {}
                
                try {
                  if (typeof self !== 'undefined') {
                    self.chrome = self.chrome || chromePolyfill;
                    self.browser = self.browser || self.chrome;
                  }
                } catch (e) {}
                
                try {
                  if (typeof global !== 'undefined') {
                    global.chrome = global.chrome || chromePolyfill;
                    global.browser = global.browser || global.chrome;
                  }
                } catch (e) {}
              })();
              
              // Now define the comprehensive polyfill
              (function() {
                'use strict';
                // Prevent re-execution
                if (typeof window !== 'undefined' && window.chrome && window.chrome.runtime) {
                  return;
                }
                // Create a comprehensive chrome polyfill object
                var chromePolyfill = {
                  runtime: {
                    onConnect: { addListener: function() {}, removeListener: function() {} },
                    onMessage: { addListener: function() {}, removeListener: function() {} },
                    connect: function() { return { onMessage: { addListener: function() {} }, postMessage: function() {}, disconnect: function() {} }; },
                    sendMessage: function() { return Promise.resolve(); },
                    getURL: function() { return ''; },
                    getManifest: function() { return {}; }
                  },
                  storage: {
                    local: {
                      get: function() { return Promise.resolve({}); },
                      set: function() { return Promise.resolve(); },
                      remove: function() { return Promise.resolve(); },
                      clear: function() { return Promise.resolve(); }
                    },
                    sync: {
                      get: function() { return Promise.resolve({}); },
                      set: function() { return Promise.resolve(); },
                      remove: function() { return Promise.resolve(); },
                      clear: function() { return Promise.resolve(); }
                    }
                  },
                  tabs: {
                    query: function() { return Promise.resolve([]); },
                    create: function() { return Promise.resolve({}); },
                    update: function() { return Promise.resolve({}); },
                    get: function() { return Promise.resolve({}); }
                  },
                  windows: {
                    create: function() { return Promise.resolve({}); },
                    get: function() { return Promise.resolve({}); },
                    getAll: function() { return Promise.resolve([]); }
                  },
                  extension: {
                    getURL: function() { return ''; },
                    getBackgroundPage: function() { return null; }
                  }
                };
                
                // Define on ALL possible global scopes immediately
                try {
                  if (typeof globalThis !== 'undefined') {
                    globalThis.chrome = chromePolyfill;
                    globalThis.browser = chromePolyfill;
                  }
                } catch (e) {}
                
                try {
                  if (typeof window !== 'undefined') {
                    window.chrome = chromePolyfill;
                    window.browser = chromePolyfill;
                  }
                } catch (e) {}
                
                try {
                  if (typeof self !== 'undefined') {
                    self.chrome = chromePolyfill;
                    self.browser = chromePolyfill;
                  }
                } catch (e) {}
                
                try {
                  if (typeof global !== 'undefined') {
                    global.chrome = chromePolyfill;
                    global.browser = chromePolyfill;
                  }
                } catch (e) {}
                
                // Make sure chrome is available in all contexts
                // This ensures it's available even if code tries to access it before window is ready
                try {
                  Object.defineProperty(window, 'chrome', {
                    value: chromePolyfill,
                    writable: false,
                    configurable: true
                  });
                } catch (e) {
                  try {
                    window.chrome = chromePolyfill;
                  } catch (e2) {}
                }
                
                try {
                  Object.defineProperty(globalThis, 'chrome', {
                    value: chromePolyfill,
                    writable: false,
                    configurable: true
                  });
                } catch (e) {
                  try {
                    globalThis.chrome = chromePolyfill;
                  } catch (e2) {}
                }
              })();
              
              // Also define chrome directly in the global scope (not in a function)
              // This ensures it's available even if code runs before the IIFE
              try {
                if (typeof globalThis !== 'undefined' && !globalThis.chrome) {
                  globalThis.chrome = {
                    runtime: { onConnect: {}, onMessage: {}, connect: function() {}, sendMessage: function() {}, getURL: function() { return ''; }, getManifest: function() { return {}; } },
                    storage: { local: {}, sync: {} },
                    tabs: { query: function() {}, create: function() {}, update: function() {}, get: function() {} },
                    windows: { create: function() {}, get: function() {}, getAll: function() {} },
                    extension: { getURL: function() { return ''; }, getBackgroundPage: function() { return null; } }
                  };
                  globalThis.browser = globalThis.chrome;
                }
              } catch (e) {}
            `
          }}
        />
        {/* Global error handler to suppress chrome errors - must run immediately */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              // Global error handler to catch and suppress chrome errors
              // This must run immediately, before any other code
              (function() {
                // Suppress console errors for chrome FIRST
                var originalError = console.error;
                console.error = function() {
                  var args = Array.prototype.slice.call(arguments);
                  var message = args.join(' ');
                  if (message && (message.includes('chrome is not defined') || message.includes('ReferenceError: chrome'))) {
                    return; // Suppress chrome errors
                  }
                  originalError.apply(console, args);
                };
                
                // Catch uncaught ReferenceErrors for chrome
                var originalOnError = window.onerror;
                window.onerror = function(msg, url, line, col, error) {
                  var msgStr = String(msg || '');
                  if (msgStr.includes('chrome is not defined') || msgStr.includes('ReferenceError: chrome')) {
                    return true; // Suppress the error
                  }
                  if (error && error.message && (error.message.includes('chrome is not defined') || error.message.includes('ReferenceError: chrome'))) {
                    return true; // Suppress the error
                  }
                  if (originalOnError) {
                    return originalOnError.apply(this, arguments);
                  }
                  return false;
                };
                
                // Also catch unhandled promise rejections
                window.addEventListener('unhandledrejection', function(event) {
                  var reason = event.reason;
                  if (reason) {
                    var msg = (reason.message || String(reason) || '');
                    if (msg.includes('chrome is not defined') || msg.includes('ReferenceError: chrome')) {
                      event.preventDefault();
                      event.stopPropagation();
                      return;
                    }
                  }
                }, true); // Use capture phase
              })();
            `
          }}
        />
        {/* Resource hints for performance */}
        {/* Preconnect hints will be added based on your actual RSS feed domains */}
        <link rel="prefetch" href="/api/albums?source=static-cached" as="fetch" crossOrigin="anonymous" />
        
        {/* Global Error Handler Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Ensure chrome polyfill exists before error handlers
                if (typeof chrome === 'undefined') {
                  var chrome = window.chrome || globalThis.chrome || {};
                }
                if (typeof browser === 'undefined') {
                  var browser = window.browser || globalThis.browser || chrome;
                }
                
                window.addEventListener("error", function(event) {
                  // Suppress "chrome is not defined" errors as they're harmless
                  if (event.error && event.error.message && 
                      event.error.message.includes("chrome is not defined")) {
                    event.preventDefault();
                    return;
                  }
                  console.error("Layout error caught:", event.error);
                  if (event.error && event.error.stack) {
                    console.error("Stack trace:", event.error.stack);
                  }
                });
                
                window.addEventListener("unhandledrejection", function(event) {
                  // Suppress "chrome is not defined" errors
                  if (event.reason && event.reason.message && 
                      (event.reason.message.includes("_balanceSats is null") ||
                       event.reason.message.includes("chrome is not defined"))) {
                    event.preventDefault();
                    return;
                  }
                  console.error("Layout promise rejection caught:", event.reason);
                });
              })();
            `
          }}
        />
      </head>
      <body className={inter.className}>
        {/* Chrome polyfill using Next.js Script for better execution order */}
        <Script
          id="chrome-polyfill"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // CRITICAL: Define chrome/browser polyfills IMMEDIATELY before any other code
              (function() {
                'use strict';
                try {
                  var chromePolyfill = {
                    runtime: {
                      onConnect: { addListener: function() {}, removeListener: function() {} },
                      onMessage: { addListener: function() {}, removeListener: function() {} },
                      connect: function() { return { onMessage: { addListener: function() {} }, postMessage: function() {}, disconnect: function() {} }; },
                      sendMessage: function() {},
                      getURL: function() { return ''; },
                      getManifest: function() { return {}; }
                    },
                    storage: {
                      local: { get: function() {}, set: function() {}, remove: function() {}, clear: function() {} },
                      sync: { get: function() {}, set: function() {}, remove: function() {}, clear: function() {} }
                    },
                    tabs: { query: function() {}, create: function() {}, update: function() {}, get: function() {} },
                    windows: { create: function() {}, get: function() {}, getAll: function() {} },
                    extension: { getURL: function() { return ''; }, getBackgroundPage: function() { return null; } }
                  };
                  
                  if (typeof globalThis !== 'undefined') {
                    globalThis.chrome = globalThis.chrome || chromePolyfill;
                    globalThis.browser = globalThis.browser || chromePolyfill;
                  }
                  if (typeof window !== 'undefined') {
                    window.chrome = window.chrome || chromePolyfill;
                    window.browser = window.browser || chromePolyfill;
                  }
                  if (typeof self !== 'undefined') {
                    self.chrome = self.chrome || chromePolyfill;
                    self.browser = self.browser || chromePolyfill;
                  }
                  if (typeof global !== 'undefined') {
                    global.chrome = global.chrome || chromePolyfill;
                    global.browser = global.browser || chromePolyfill;
                  }
                } catch (e) {}
              })();
            `
          }}
        />
        <ClientErrorBoundary>
          <ErrorBoundary>
            <LightningProvider>
              <AudioProvider>
                <BitcoinConnectProvider>
                  <div className="min-h-screen bg-gray-50 relative">
                    {/* Content overlay with iOS safe area padding */}
                    <div className="relative z-10 pt-ios">
                      {children}
                    </div>
                  </div>
                  <GlobalNowPlayingBar />
                  <BoostGoat />
                  <ToastContainer />
                </BitcoinConnectProvider>
              </AudioProvider>
            </LightningProvider>
          </ErrorBoundary>
          <ServiceWorkerRegistration />
          <PWAInstallPrompt />
          <PerformanceMonitor />
        </ClientErrorBoundary>
      </body>
    </html>
  )
} 