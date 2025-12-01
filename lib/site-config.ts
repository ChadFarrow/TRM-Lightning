/**
 * Site Configuration
 * 
 * Centralized configuration for site-specific values.
 * These can be customized via environment variables or will use generic placeholders.
 */

export interface SiteConfig {
  siteName: string;
  siteUrl: string;
  apiUrl: string;
  defaultFeedUrl?: string;
  userAgent?: string;
}

/**
 * Get site configuration from environment variables with fallbacks
 */
export function getSiteConfig(): SiteConfig {
  return {
    siteName: process.env.NEXT_PUBLIC_SITE_NAME || 'Music Site',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    apiUrl: process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000/api',
    defaultFeedUrl: process.env.NEXT_PUBLIC_DEFAULT_FEED_URL,
    userAgent: process.env.NEXT_PUBLIC_USER_AGENT || 'TRM-Lightning/1.0',
  };
}

/**
 * Get site name for branding
 */
export function getSiteName(): string {
  return getSiteConfig().siteName;
}

/**
 * Get site URL
 */
export function getSiteUrl(): string {
  return getSiteConfig().siteUrl;
}

/**
 * Get API URL
 */
export function getApiUrl(): string {
  return getSiteConfig().apiUrl;
}

/**
 * Get user agent string
 */
export function getUserAgent(): string {
  return getSiteConfig().userAgent || 'TRM-Lightning/1.0';
}

