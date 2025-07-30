#!/usr/bin/env bun

/**
 * Prepare the Claude action by checking trigger conditions, verifying human actor,
 * and creating the initial tracking comment
 */

import * as core from "@actions/core";
import { setupGitHubToken } from "../github/token";
import { setupPlatformToken } from "../forgejo/token";
import { checkHumanActor } from "../github/validation/actor";
import { checkWritePermissions } from "../github/validation/permissions";
import { createInitialComment } from "../github/operations/comments/create-initial";
import { setupBranch } from "../github/operations/branch";
import { configureGitAuth } from "../github/operations/git-config";
import { prepareMcpConfig } from "../mcp/install-mcp-server";
import { createOctokit, createForgejoOctokit } from "../github/api/client";
import { fetchGitHubData } from "../github/data/fetcher";
import { fetchPlatformData } from "../platform/data-fetcher";
import { parseGitHubContext } from "../github/context";
import { getMode } from "../modes/registry";
import { createPrompt } from "../create-prompt";
import { detectPlatform, Platform } from "../platform/detector";

async function run() {
  try {
    // Set Forgejo environment variables if configured
    if (process.env.INPUT_USE_FORGEJO === 'true') {
      process.env.USE_FORGEJO = 'true';
    }
    if (process.env.INPUT_FORGEJO_URL) {
      process.env.FORGEJO_API_URL = process.env.INPUT_FORGEJO_URL;
    }
    if (process.env.INPUT_FORGEJO_EXTERNAL_URL) {
      process.env.FORGEJO_EXTERNAL_URL = process.env.INPUT_FORGEJO_EXTERNAL_URL;
    }
    if (process.env.INPUT_FORGEJO_TOKEN) {
      process.env.FORGEJO_TOKEN = process.env.INPUT_FORGEJO_TOKEN;
    }

    // Detect platform
    const platformConfig = detectPlatform();
    console.log(`Detected platform: ${platformConfig.platform}`);

    // Step 1: Setup platform token
    const token = await setupPlatformToken();
    
    // Create appropriate client based on platform
    let octokit;
    if (platformConfig.platform === Platform.GitHub) {
      octokit = createOctokit(token);
    } else {
      // For Forgejo, use the appropriate API URL
      const forgejoApiUrl = process.env.FORGEJO_API_URL || 
                           process.env.FORGEJO_URL || 
                           process.env.FORGEJO_EXTRACTED_URL;
      
      if (forgejoApiUrl) {
        // Ensure the API URL has the correct format
        const apiUrl = forgejoApiUrl.endsWith('/api/v1') 
          ? forgejoApiUrl 
          : `${forgejoApiUrl}/api/v1`;
        console.log(`Creating Octokit for Forgejo with API URL: ${apiUrl}`);
        // Use Forgejo-specific Octokit that doesn't use GraphQL
        octokit = createForgejoOctokit(token, apiUrl);
      } else {
        throw new Error("Forgejo API URL not found in environment variables");
      }
    }

    // Step 2: Parse GitHub context (once for all operations)
    const context = parseGitHubContext();
    
    // For Forgejo, extract external URL from payload if available
    if (platformConfig.platform === Platform.Forgejo) {
      const payload = context.payload as any;
      let htmlUrl: string | undefined;
      
      // Try to extract URL from various payload locations
      if (payload?.issue?.html_url) {
        htmlUrl = payload.issue.html_url;
      } else if (payload?.pull_request?.html_url) {
        htmlUrl = payload.pull_request.html_url;
      } else if (payload?.comment?.html_url) {
        htmlUrl = payload.comment.html_url;
      }
      
      if (htmlUrl) {
        try {
          const url = new URL(htmlUrl);
          process.env.FORGEJO_EXTRACTED_URL = `${url.protocol}//${url.host}`;
          console.log(`Extracted Forgejo external URL: ${process.env.FORGEJO_EXTRACTED_URL}`);
        } catch (e) {
          console.warn("Failed to extract URL from payload:", e);
        }
      }
    }

    // Step 3: Check write permissions
    const hasWritePermissions = await checkWritePermissions(
      octokit!.rest,
      context,
    );
    if (!hasWritePermissions) {
      throw new Error(
        "Actor does not have write permissions to the repository",
      );
    }

    // Step 4: Get mode and check trigger conditions
    const mode = getMode(context.inputs.mode);
    const containsTrigger = mode.shouldTrigger(context);

    // Set output for action.yml to check
    core.setOutput("contains_trigger", containsTrigger.toString());

    if (!containsTrigger) {
      console.log("No trigger found, skipping remaining steps");
      return;
    }

    // Step 5: Check if actor is human
    await checkHumanActor(octokit!.rest, context);

    // Step 6: Create initial tracking comment (mode-aware)
    // Some modes (e.g., agent mode) may not need tracking comments
    let commentId: number | undefined;
    let commentData:
      | Awaited<ReturnType<typeof createInitialComment>>
      | undefined;
    
    // Create initial tracking comment for both GitHub and Forgejo
    if (mode.shouldCreateTrackingComment()) {
      commentData = await createInitialComment(octokit!, context);
      commentId = commentData.id;
      console.log(`Created initial comment with ID: ${commentId}`);
    }

    // Step 7: Fetch platform data (once for both branch setup and prompt creation)
    let githubData;
    if (platformConfig.platform === Platform.GitHub) {
      githubData = await fetchGitHubData({
        octokits: octokit!,
        repository: `${context.repository.owner}/${context.repository.repo}`,
        prNumber: context.entityNumber.toString(),
        isPR: context.isPR,
        triggerUsername: context.actor,
      });
    } else {
      // For Forgejo, use platform-agnostic fetcher
      githubData = await fetchPlatformData({
        repository: `${context.repository.owner}/${context.repository.repo}`,
        prNumber: context.entityNumber.toString(),
        isPR: context.isPR,
        triggerUsername: context.actor,
        token: token,
      });
    }

    // Step 8: Setup branch
    const branchInfo = await setupBranch(octokit!, githubData, context);

    // Step 9: Configure git authentication if not using commit signing
    if (!context.inputs.useCommitSigning) {
      try {
        await configureGitAuth(token, context, commentData?.user || null);
      } catch (error) {
        console.error("Failed to configure git authentication:", error);
        throw error;
      }
    }

    // Step 10: Create prompt file
    const modeContext = mode.prepareContext(context, {
      commentId: commentId,
      baseBranch: branchInfo.baseBranch,
      claudeBranch: branchInfo.claudeBranch,
    });

    await createPrompt(mode, modeContext, githubData, context);

    // Step 11: Get MCP configuration
    const additionalMcpConfig = process.env.MCP_CONFIG || "";
    const mcpConfig = await prepareMcpConfig({
      githubToken: token,
      owner: context.repository.owner,
      repo: context.repository.repo,
      branch: branchInfo.claudeBranch || branchInfo.currentBranch,
      baseBranch: branchInfo.baseBranch,
      additionalMcpConfig,
      claudeCommentId: commentId?.toString() || "",
      allowedTools: context.inputs.allowedTools,
      context,
    });
    core.setOutput("mcp_config", mcpConfig);
    
    // Output comment ID if available
    if (commentId) {
      core.setOutput("claude_comment_id", commentId.toString());
    }
    
    // Output Forgejo extracted URL if available
    if (process.env.FORGEJO_EXTRACTED_URL) {
      core.setOutput("FORGEJO_EXTRACTED_URL", process.env.FORGEJO_EXTRACTED_URL);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Prepare step failed with error: ${errorMessage}`);
    // Also output the clean error message for the action to capture
    core.setOutput("prepare_error", errorMessage);
    process.exit(1);
  }
}

if (import.meta.main) {
  run();
}
