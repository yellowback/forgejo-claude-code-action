/**
 * Utility functions for handling platform URLs
 */

import { detectPlatform, Platform } from "./detector";
import { GITHUB_SERVER_URL } from "../github/api/config";

/**
 * Get the external base URL for the current platform
 * For Forgejo, this tries to use the extracted URL from the payload, 
 * then falls back to configured external URL, then API URL
 */
export function getExternalBaseUrl(): string {
  const platformConfig = detectPlatform();
  
  if (platformConfig.platform === Platform.Forgejo) {
    // Priority order for Forgejo URLs:
    // 1. Extracted from payload (most accurate)
    // 2. Explicitly configured external URL
    // 3. API URL with /api/v1 removed
    // 4. Default GitHub server URL
    
    if (process.env.FORGEJO_EXTRACTED_URL) {
      return process.env.FORGEJO_EXTRACTED_URL;
    }
    
    if (process.env.FORGEJO_EXTERNAL_URL) {
      try {
        const url = new URL(process.env.FORGEJO_EXTERNAL_URL);
        return url.origin;
      } catch (e) {
        console.warn("Failed to parse FORGEJO_EXTERNAL_URL:", process.env.FORGEJO_EXTERNAL_URL, e);
      }
    }
    
    if (process.env.FORGEJO_API_URL) {
      try {
        const url = new URL(process.env.FORGEJO_API_URL);
        // Remove /api/v1 path if present
        return `${url.protocol}//${url.host}`;
      } catch (e) {
        console.warn("Failed to parse FORGEJO_API_URL:", process.env.FORGEJO_API_URL, e);
      }
    }
  }
  
  // Default to GitHub server URL
  return GITHUB_SERVER_URL;
}