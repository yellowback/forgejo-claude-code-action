#!/usr/bin/env bun

/**
 * Setup the appropriate branch for Forgejo based on the event type:
 * - For PRs: Checkout the PR branch
 * - For Issues: Create a new branch
 */

import { $ } from "bun";
import * as core from "@actions/core";
import type { ParsedGitHubContext } from "../../github/context";
import type { FetchDataResult } from "../../platform/data-fetcher";

export type BranchInfo = {
  baseBranch: string;
  claudeBranch?: string;
  currentBranch: string;
};

export async function setupForgejoBranch(
  githubData: FetchDataResult,
  context: ParsedGitHubContext,
): Promise<BranchInfo> {
  const entityNumber = context.entityNumber;
  const { baseBranch, branchPrefix } = context.inputs;
  const isPR = context.isPR;

  try {
    if (isPR) {
      const prData = githubData.contextData as any;
      const prState = prData.state;

      // Check if PR is closed or merged
      if (prState === "CLOSED" || prState === "MERGED") {
        console.log(
          `PR #${entityNumber} is ${prState}, creating new branch from source...`,
        );
        // Fall through to create a new branch like we do for issues
      } else {
        // Handle open PR: Checkout the PR branch
        console.log("This is an open PR, checking out PR branch...");

        const branchName = prData.headRefName;
        const prBaseBranch = prData.baseRefName;

        // For Forgejo, we can't determine optimal fetch depth, so use a reasonable default
        const fetchDepth = 50;

        console.log(
          `PR #${entityNumber}: using fetch depth ${fetchDepth}`,
        );

        // Execute git commands to checkout PR branch
        await $`git fetch origin --depth=${fetchDepth} ${branchName}`;
        await $`git checkout ${branchName} --`;

        console.log(`Successfully checked out PR branch for PR #${entityNumber}`);

        return {
          baseBranch: prBaseBranch,
          currentBranch: branchName,
        };
      }
    }

    // Determine source branch - use baseBranch if provided, otherwise default to 'main'
    let sourceBranch: string;

    if (baseBranch) {
      // Use provided base branch for source
      sourceBranch = baseBranch;
    } else {
      // For Forgejo, default to 'main' if no base branch provided
      // In the future, we could make an API call to get the default branch
      sourceBranch = 'main';
      console.log("No base branch provided, defaulting to 'main'");
    }

    // Generate branch name for either an issue or closed/merged PR
    const entityType = isPR ? "pr" : "issue";

    // Create Kubernetes-compatible timestamp: lowercase, hyphens only, shorter format
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

    // Ensure branch name is Kubernetes-compatible:
    // - Lowercase only
    // - Alphanumeric with hyphens
    // - No underscores
    // - Max 50 chars (to allow for prefixes)
    const branchName = `${branchPrefix}${entityType}-${entityNumber}-${timestamp}`;
    const newBranch = branchName.toLowerCase().substring(0, 50);

    // For commit signing, defer branch creation to the file ops server
    if (context.inputs.useCommitSigning) {
      console.log(
        `Branch name generated: ${newBranch} (will be created by file ops server on first commit)`,
      );

      // Ensure we're on the source branch
      console.log(`Fetching and checking out source branch: ${sourceBranch}`);
      await $`git fetch origin ${sourceBranch} --depth=1`;
      await $`git checkout ${sourceBranch}`;

      // Set outputs for GitHub Actions
      core.setOutput("CLAUDE_BRANCH", newBranch);
      core.setOutput("BASE_BRANCH", sourceBranch);
      return {
        baseBranch: sourceBranch,
        claudeBranch: newBranch,
        currentBranch: sourceBranch, // Stay on source branch for now
      };
    }

    // For non-signing case, create and checkout the branch locally only
    console.log(
      `Creating local branch ${newBranch} for ${entityType} #${entityNumber} from source branch: ${sourceBranch}...`,
    );

    // Fetch and checkout the source branch first to ensure we branch from the correct base
    console.log(`Fetching and checking out source branch: ${sourceBranch}`);
    await $`git fetch origin ${sourceBranch} --depth=1`;
    await $`git checkout ${sourceBranch}`;

    // Create and checkout the new branch from the source branch
    await $`git checkout -b ${newBranch}`;

    console.log(
      `Successfully created and checked out local branch: ${newBranch}`,
    );

    // Set outputs for GitHub Actions
    core.setOutput("CLAUDE_BRANCH", newBranch);
    core.setOutput("BASE_BRANCH", sourceBranch);
    return {
      baseBranch: sourceBranch,
      claudeBranch: newBranch,
      currentBranch: newBranch,
    };
  } catch (error) {
    console.error("Error in Forgejo branch setup:", error);
    // Fallback to main branch if something goes wrong
    return {
      baseBranch: 'main',
      currentBranch: 'main',
      claudeBranch: undefined,
    };
  }
}