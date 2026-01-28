import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedUrl = searchParams.get('url');

    if (!feedUrl) {
      return NextResponse.json({
        success: false,
        error: 'Missing feed URL parameter'
      }, { status: 400 });
    }

    // Validate URL
    let url: URL;
    try {
      url = new URL(feedUrl);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid URL format'
      }, { status: 400 });
    }

    // Only allow HTTPS URLs for security (allow HTTP for localhost)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
      return NextResponse.json({
        success: false,
        error: 'Only HTTPS URLs are allowed'
      }, { status: 400 });
    }

    console.log(`[fetch-rss] Fetching feed: ${feedUrl}`);

    // Fetch the RSS feed
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': process.env.NEXT_PUBLIC_USER_AGENT || 'TRM-Lightning/1.0 (RSS Proxy)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      // Add timeout
      signal: AbortSignal.timeout(30000), // 30 second timeout for potentially large feeds
    });

    if (!response.ok) {
      console.error(`[fetch-rss] Failed to fetch feed: ${response.status} ${response.statusText}`);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch feed: ${response.status} ${response.statusText}`
      }, { status: response.status });
    }

    // Get the XML data as text
    const xmlText = await response.text();

    console.log(`[fetch-rss] Successfully fetched feed (${xmlText.length} bytes)`);

    // Return the XML with appropriate headers
    return new NextResponse(xmlText, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=600', // 5 min client, 10 min CDN
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
      }
    });

  } catch (error) {
    console.error('[fetch-rss] Error:', error);

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({
        success: false,
        error: 'Feed fetch timeout'
      }, { status: 408 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
