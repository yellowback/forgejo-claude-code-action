/**
 * Platform detection utility to determine if running on GitHub or Forgejo
 */

export enum Platform {
  GitHub = 'github',
  Forgejo = 'forgejo',
}

export interface PlatformConfig {
  platform: Platform;
  apiUrl: string;
  apiVersion?: string;
  isGraphQLSupported: boolean;
}

/**
 * Detects the current platform based on environment variables and API endpoints
 */
export function detectPlatform(): PlatformConfig {
  // This is a Forgejo-specific branch, always return Forgejo configuration
  const apiUrl = process.env.FORGEJO_API_URL || process.env.GITHUB_API_URL || 'https://api.github.com';
  
  return {
    platform: Platform.Forgejo,
    apiUrl,
    apiVersion: 'v1',
    isGraphQLSupported: false,
  };
}

/**
 * Gets the authentication token for the detected platform
 */
export function getPlatformToken(): string {
  const config = detectPlatform();
  
  if (config.platform === Platform.Forgejo) {
    return process.env.FORGEJO_TOKEN || process.env.GITHUB_TOKEN || '';
  }
  
  return process.env.GITHUB_TOKEN || '';
}

/**
 * Normalizes API URL to ensure it has the correct format
 */
export function normalizeApiUrl(url: string, platform: Platform): string {
  // Remove trailing slash
  url = url.replace(/\/$/, '');
  
  if (platform === Platform.Forgejo) {
    // Ensure Forgejo URLs end with /api/v1
    if (!url.endsWith('/api/v1')) {
      if (url.endsWith('/api')) {
        return `${url}/v1`;
      }
      return `${url}/api/v1`;
    }
  }
  
  return url;
}