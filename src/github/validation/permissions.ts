import * as core from "@actions/core";
import type { ParsedGitHubContext } from "../context";
import type { Octokit } from "@octokit/rest";

/**
 * Check if the actor has write permissions to the repository
 * @param octokit - The Octokit REST client
 * @param context - The GitHub context
 * @returns true if the actor has write permissions, false otherwise
 */
export async function checkWritePermissions(
  octokit: Octokit,
  context: ParsedGitHubContext,
): Promise<boolean> {
  const { repository, actor } = context;

  try {
    core.info(`Checking permissions for actor: ${actor}`);

    // Check permissions directly using the permission endpoint
    const response = await octokit.repos.getCollaboratorPermissionLevel({
      owner: repository.owner,
      repo: repository.repo,
      username: actor,
    });

    const permissionLevel = response.data.permission;
    core.info(`Permission level retrieved: ${permissionLevel}`);

    // Accept various permission levels that indicate write access
    // GitHub uses: admin, write, read
    // Forgejo uses: owner, admin, write, read
    const writePermissions = ["admin", "write", "owner", "maintain"];
    
    if (writePermissions.includes(permissionLevel)) {
      core.info(`Actor has write access: ${permissionLevel}`);
      return true;
    } else {
      core.warning(`Actor has insufficient permissions: ${permissionLevel}`);
      return false;
    }
  } catch (error: any) {
    // Special handling for Forgejo - if the API endpoint is not available,
    // we might want to skip the check
    if (error.status === 404) {
      core.warning(`Permission check endpoint not available (404). This might be expected for Forgejo.`);
      // For Forgejo, we might want to allow the action to proceed
      // if the permission check endpoint is not implemented
      const platformConfig = (await import("../../platform/detector")).detectPlatform();
      if (platformConfig.platform === "forgejo") {
        core.info(`Skipping permission check for Forgejo platform due to missing endpoint`);
        return true;
      }
    }
    
    core.error(`Failed to check permissions: ${error}`);
    throw new Error(`Failed to check permissions for ${actor}: ${error}`);
  }
}
