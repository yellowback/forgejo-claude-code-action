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
  // Check if explicitly set to use Forgejo
  if (process.env.USE_FORGEJO === 'true') {
    return {
      platform: Platform.Forgejo,
      apiUrl: process.env.FORGEJO_API_URL || process.env.GITHUB_API_URL || 'https://api.github.com',
      apiVersion: 'v1',
      isGraphQLSupported: false,
    };
  }

  // Check if FORGEJO_* environment variables are set
  if (process.env.FORGEJO_API_URL || process.env.FORGEJO_TOKEN) {
    return {
      platform: Platform.Forgejo,
      apiUrl: process.env.FORGEJO_API_URL || process.env.GITHUB_API_URL || 'https://api.github.com',
      apiVersion: 'v1',
      isGraphQLSupported: false,
    };
  }

  // Check API URL pattern for Forgejo/Gitea
  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
  if (apiUrl.includes('/api/v1') || apiUrl.includes('forgejo') || apiUrl.includes('gitea')) {
    return {
      platform: Platform.Forgejo,
      apiUrl,
      apiVersion: 'v1',
      isGraphQLSupported: false,
    };
  }

  // Default to GitHub
  return {
    platform: Platform.GitHub,
    apiUrl,
    isGraphQLSupported: true,
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