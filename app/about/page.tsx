'use client';

import Link from 'next/link';
import Image from 'next/image';
import { getSiteName } from '@/lib/site-config';

export default function AboutPage() {
  const siteName = getSiteName();
  
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b backdrop-blur-sm bg-black/30 pt-safe-plus pt-12" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Back to home"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
              <h1 className="text-4xl font-bold">{siteName}</h1>
            </Link>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-8 text-center">
              About This Site
            </h1>
            
            {/* Main Description */}
            <div className="bg-gray-900/50 rounded-lg p-8 mb-8">
              <p className="text-lg leading-relaxed mb-4">
                This is a Value4Value music platform powered by the Lightning Network. All music comes from RSS feeds with Podcasting 2.0 value tags, enabling direct Lightning payments to artists.
              </p>
              <p className="text-gray-400">
                This platform template can be used by any band or artist with existing V4V RSS feeds.
              </p>
            </div>

            {/* Add to Home Screen Instructions */}
            <div className="bg-gray-900/50 rounded-lg p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">
                📱 Add to Your Home Screen
              </h2>
              <p className="text-gray-300 mb-6">
                Get quick access to this music platform by adding it to your phone&apos;s home screen. 
                It will work like a native app with offline support!
              </p>
              
              <div className="grid md:grid-cols-2 gap-8">
                {/* iOS Instructions */}
                <div className="bg-black/40 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="text-2xl">🍎</span> iPhone/iPad (Safari)
                  </h3>
                  <ol className="space-y-3 text-gray-300 text-sm">
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">1.</span>
                      <span>Open this site in Safari browser</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">2.</span>
                      <span>Tap the Share button <span className="inline-block bg-gray-700 px-2 py-0.5 rounded text-xs">⎙</span> (square with arrow)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">3.</span>
                      <span>Scroll down and tap &quot;Add to Home Screen&quot;</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">4.</span>
                      <span>Name it (or keep the default)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">5.</span>
                      <span>Tap &quot;Add&quot; in the top right corner</span>
                    </li>
                  </ol>
                  <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-500/20">
                    <p className="text-xs text-blue-300">
                      💡 The app icon will appear on your home screen and open in full-screen mode!
                    </p>
                  </div>
                </div>

                {/* Android Instructions */}
                <div className="bg-black/40 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="text-2xl">🤖</span> Android (Chrome)
                  </h3>
                  <ol className="space-y-3 text-gray-300 text-sm">
                    <li className="flex gap-2">
                      <span className="text-green-400 font-bold">1.</span>
                      <span>Open this site in Chrome browser</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400 font-bold">2.</span>
                      <span>Tap the menu button <span className="inline-block bg-gray-700 px-2 py-0.5 rounded text-xs">⋮</span> (three dots)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400 font-bold">3.</span>
                      <span>Select &quot;Add to Home screen&quot; or &quot;Install app&quot;</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400 font-bold">4.</span>
                      <span>Name it (or keep the default)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400 font-bold">5.</span>
                      <span>Tap &quot;Add&quot; or &quot;Install&quot;</span>
                    </li>
                  </ol>
                  <div className="mt-4 p-3 bg-green-900/30 rounded-lg border border-green-500/20">
                    <p className="text-xs text-green-300">
                      💡 You might see an &quot;Install&quot; banner at the bottom of the screen - just tap it!
                    </p>
                  </div>
                </div>
              </div>

              {/* Other Browsers */}
              <div className="mt-6 p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/20">
                <p className="text-sm text-yellow-300">
                  <span className="font-semibold">Other browsers:</span> Firefox, Edge, Brave, and Samsung Internet also support this feature. 
                  Look for &quot;Add to Home Screen&quot; or &quot;Install&quot; in the browser menu (usually in the ⋮ or ≡ menu).
                </p>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-8 mb-12">
              <h2 className="text-2xl font-semibold mb-6">
                Features
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Value4Value Music</h3>
                  <p className="text-gray-400">
                    Support artists directly with Lightning Network payments. Stream music with built-in micropayment support.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-3">RSS Integration</h3>
                  <p className="text-gray-400">
                    Built on open standards using RSS feeds with Podcasting 2.0 value tags. Decentralized music distribution.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Lightning Payments</h3>
                  <p className="text-gray-400">
                    Instant Bitcoin payments to artists via Lightning Network. Manual boost support.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Progressive Web App</h3>
                  <p className="text-gray-400">
                    Install as a native app on mobile devices. Offline support and push notifications.
                  </p>
                </div>
              </div>
            </div>

            {/* Support Section */}
            <div className="bg-gray-900/50 rounded-lg p-8 mb-12">
              <h2 className="text-2xl font-semibold mb-6 text-center">
                💝 Support the Creator
              </h2>
              <p className="text-gray-300 mb-6 text-center">
                Support the creator of the template this site is made from
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                {/* PayPal Donate Button */}
                <a
                  href="https://www.paypal.com/donate/?business=NYCRNVFP4X3DY&no_recurring=0&currency_code=USD"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.367 1.52 1.125 3.544.835 4.857-.197.9-.414 1.584-.414 1.584s.266-.19.703-.45c1.44-.832 3.13-1.624 4.91-1.624.576 0 1.12.09 1.61.27v.27h-1.22c-1.35 0-2.58.6-3.74 1.5-.44.34-.86.7-1.24 1.08-.38.38-.72.78-1.02 1.2-.3.42-.55.87-.75 1.34-.2.47-.35.97-.45 1.5-.1.53-.15 1.08-.15 1.68v.75c0 .42.03.84.08 1.26.05.42.13.82.24 1.2.11.38.25.73.42 1.05.17.32.38.6.62.85.24.25.52.45.84.6.32.15.67.25 1.05.3.38.05.78.05 1.22 0 .44-.05.9-.15 1.37-.3.47-.15.94-.35 1.4-.6.46-.25.9-.55 1.32-.9.42-.35.8-.75 1.14-1.2.34-.45.63-.95.87-1.5.24-.55.42-1.15.54-1.8.12-.65.18-1.35.18-2.1 0-.75-.06-1.5-.18-2.25-.12-.75-.3-1.45-.54-2.1-.24-.65-.53-1.2-.87-1.65-.34-.45-.72-.85-1.14-1.2-.42-.35-.86-.65-1.32-.9-.46-.25-.93-.45-1.4-.6-.47-.15-.93-.25-1.37-.3-.44-.05-.84-.05-1.22 0-.38.05-.73.15-1.05.3-.32.15-.6.35-.84.6-.24.25-.45.53-.62.85-.17.32-.31.67-.42 1.05-.11.38-.19.78-.24 1.2-.05.42-.08.84-.08 1.26v.75c0 .6.05 1.15.15 1.68.1.53.25 1.03.45 1.5.2.47.45.92.75 1.34.3.42.64.82 1.02 1.2.38.38.8.74 1.24 1.08 1.16.9 2.39 1.5 3.74 1.5h1.22v-.27c-.49-.18-1.03-.27-1.61-.27-1.78 0-3.47.792-4.91 1.624-.437.26-.703.45-.703.45s.217-.684.414-1.584c.29-1.313.532-3.337-.835-4.857-1.112-1.267-3.12-1.81-5.69-1.81H5.998L3.437 21.337z"/>
                  </svg>
                  <span>Donate with PayPal</span>
                </a>

                {/* Alby Link */}
                <a
                  href="https://getalby.com/p/chadf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-3 rounded-lg transition-colors font-medium"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <span>⚡ Support on Alby</span>
                </a>
              </div>
            </div>

            <div className="text-center">
              <Link 
                href="/" 
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg transition-colors font-medium text-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Music
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}