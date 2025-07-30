#!/usr/bin/env bun

import * as core from "@actions/core";
import { detectPlatform, Platform, getPlatformToken } from "../platform/detector";

/**
 * Setup authentication token for Forgejo
 * This is a simplified version that doesn't use OIDC token exchange
 */
export async function setupForgejoToken(): Promise<string> {
  try {
    const config = detectPlatform();
    
    if (config.platform !== Platform.Forgejo) {
      throw new Error("Not running on Forgejo platform");
    }

    // Check if Forgejo token was provided
    const forgejoToken = process.env.FORGEJO_TOKEN || process.env.OVERRIDE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;

    if (!forgejoToken) {
      throw new Error(
        "No Forgejo token found. Please provide FORGEJO_TOKEN in your repository secrets."
      );
    }

    console.log("Using provided FORGEJO_TOKEN for authentication");
    core.setOutput("GITHUB_TOKEN", forgejoToken); // For compatibility
    core.setOutput("FORGEJO_TOKEN", forgejoToken);
    return forgejoToken;
  } catch (error) {
    core.setFailed(
      `Failed to setup Forgejo token: ${error}.\n\nPlease ensure you have added FORGEJO_TOKEN to your repository secrets.`
    );
    process.exit(1);
  }
}

/**
 * Unified token setup that works for both GitHub and Forgejo
 */
export async function setupPlatformToken(): Promise<string> {
  const config = detectPlatform();
  
  if (config.platform === Platform.Forgejo) {
    return setupForgejoToken();
  }
  
  // For GitHub, use the existing setupGitHubToken function
  const { setupGitHubToken } = await import("../github/token");
  return setupGitHubToken();
}