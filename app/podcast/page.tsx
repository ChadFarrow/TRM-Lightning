'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PodcastPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the podcasts page
    router.push('/podcasts');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-lg text-white">Redirecting to podcasts...</p>
      </div>
    </div>
  );
}

 