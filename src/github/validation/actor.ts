#!/usr/bin/env bun

/**
 * Check if the action trigger is from a human actor
 * Prevents automated tools or bots from triggering Claude
 */

import type { Octokit } from "@octokit/rest";
import type { ParsedGitHubContext } from "../context";
import { detectPlatform, Platform } from "../../platform/detector";

export async function checkHumanActor(
  octokit: Octokit,
  githubContext: ParsedGitHubContext,
) {
  const platformConfig = detectPlatform();
  
  try {
    // Fetch user information from API
    const { data: userData } = await octokit.users.getByUsername({
      username: githubContext.actor,
    });

    // For Forgejo, the user type field might not exist or have different values
    // GitHub uses: User, Organization, Bot
    // Forgejo might not have a type field at all
    const actorType = userData.type;
    
    console.log(`Actor type: ${actorType}`);
    console.log(`Platform: ${platformConfig.platform}`);
    
    if (platformConfig.platform === Platform.Forgejo) {
      // For Forgejo, we'll be more lenient since the type field might not exist
      // We'll consider it a human if:
      // 1. Type is undefined (field doesn't exist)
      // 2. Type is "User" 
      // 3. Type is not explicitly "Bot" or "Organization"
      if (actorType && actorType !== "User" && (actorType === "Bot" || actorType === "Organization")) {
        throw new Error(
          `Workflow initiated by non-human actor: ${githubContext.actor} (type: ${actorType}).`,
        );
      }
      // If we get here, assume it's a human user
      console.log(`Verified actor for Forgejo: ${githubContext.actor}`);
    } else {
      // GitHub standard check
      if (actorType !== "User") {
        throw new Error(
          `Workflow initiated by non-human actor: ${githubContext.actor} (type: ${actorType}).`,
        );
      }
      console.log(`Verified human actor: ${githubContext.actor}`);
    }
  } catch (error: any) {
    // If the API call fails (e.g., endpoint not available), handle gracefully for Forgejo
    if (error.status === 404 && platformConfig.platform === Platform.Forgejo) {
      console.log(`User info endpoint not available for Forgejo. Assuming human actor: ${githubContext.actor}`);
      return;
    }
    throw error;
  }
}
