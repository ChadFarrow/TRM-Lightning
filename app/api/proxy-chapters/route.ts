import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chaptersUrl = searchParams.get('url');

    if (!chaptersUrl) {
      return NextResponse.json({
        success: false,
        error: 'Missing chapters URL parameter'
      }, { status: 400 });
    }

    // Validate URL
    let url: URL;
    try {
      url = new URL(chaptersUrl);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid URL format'
      }, { status: 400 });
    }

    // Only allow HTTPS URLs for security
    if (url.protocol !== 'https:') {
      return NextResponse.json({
        success: false,
        error: 'Only HTTPS URLs are allowed'
      }, { status: 400 });
    }

    // Fetch the chapters JSON
    const response = await fetch(chaptersUrl, {
      headers: {
        'User-Agent': process.env.NEXT_PUBLIC_USER_AGENT || 'TRM-Lightning/1.0 (Chapters Proxy)',
        'Accept': 'application/json, application/json+chapters',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      // Add timeout
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch chapters: ${response.status} ${response.statusText}`
      }, { status: response.status });
    }

    // Get the JSON data
    const chaptersData = await response.json();

    // Return the chapters with CORS headers
    return NextResponse.json(chaptersData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400', // 1 hour client, 24 hours CDN
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
      }
    });

  } catch (error) {
    console.error('Chapters proxy error:', error);

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({
        success: false,
        error: 'Chapters fetch timeout'
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
