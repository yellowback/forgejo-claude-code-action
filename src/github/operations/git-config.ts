#!/usr/bin/env bun

/**
 * Configure git authentication for non-signing mode
 * Sets up git user and authentication to work with GitHub App tokens
 */

import { $ } from "bun";
import type { ParsedGitHubContext } from "../context";
import { GITHUB_SERVER_URL } from "../api/config";

type GitUser = {
  login: string;
  id: number;
};

export async function configureGitAuth(
  githubToken: string,
  context: ParsedGitHubContext,
  user: GitUser | null,
) {
  console.log("Configuring git authentication for non-signing mode");

  // Determine the noreply email domain based on GITHUB_SERVER_URL
  const serverUrl = new URL(GITHUB_SERVER_URL);
  const noreplyDomain =
    serverUrl.hostname === "github.com"
      ? "users.noreply.github.com"
      : `users.noreply.${serverUrl.hostname}`;

  // Configure git user based on the comment creator
  console.log("Configuring git user...");
  if (user) {
    const botName = user.login;
    const botId = user.id;
    console.log(`Setting git user as ${botName}...`);
    await $`git config user.name "${botName}"`;
    await $`git config user.email "${botId}+${botName}@${noreplyDomain}"`;
    console.log(`✓ Set git user as ${botName}`);
  } else {
    console.log("No user data in comment, using default bot user");
    await $`git config user.name "github-actions[bot]"`;
    await $`git config user.email "41898282+github-actions[bot]@${noreplyDomain}"`;
  }

  // Remove the authorization header that actions/checkout sets
  console.log("Removing existing git authentication headers...");
  try {
    await $`git config --unset-all http.${GITHUB_SERVER_URL}/.extraheader`;
    console.log("✓ Removed existing authentication headers");
  } catch (e) {
    console.log("No existing authentication headers to remove");
  }

  // Update the remote URL to include the token for authentication
  console.log("Updating remote URL with authentication...");
  
  // Get the current remote URL to preserve the protocol and host
  const currentRemoteUrl = await $`git config --get remote.origin.url`.text();
  const trimmedUrl = currentRemoteUrl.trim();
  console.log(`Current remote URL: ${trimmedUrl}`);
  
  // Parse the current URL to extract protocol and host
  const urlMatch = trimmedUrl.match(/^(https?):\/\/([^\/]+)\//);
  if (!urlMatch) {
    console.error(`Failed to parse remote URL: ${trimmedUrl}`);
    console.log("Note: SSH URLs are not supported for token authentication");
    throw new Error("Invalid remote URL format - only HTTP(S) URLs are supported");
  }
  
  const protocol = urlMatch[1];
  const host = urlMatch[2];
  
  const remoteUrl = `${protocol}://x-access-token:${githubToken}@${host}/${context.repository.owner}/${context.repository.repo}.git`;
  await $`git remote set-url origin ${remoteUrl}`;
  console.log(`✓ Updated remote URL with authentication token (using ${protocol}://${host})`);

  console.log("Git authentication configured successfully");
}
