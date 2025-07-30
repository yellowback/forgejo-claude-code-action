/**
 * Forgejo-specific context utilities
 */

import type { Context } from "@actions/github/lib/context";

/**
 * Check if an issue_comment event is for a PR in Forgejo
 * Forgejo might have different payload structure than GitHub
 */
export function isForgejoIssuePR(context: Context): boolean {
  if (context.eventName !== "issue_comment") {
    return false;
  }

  const payload = context.payload as any;
  const issue = payload.issue;

  if (!issue) {
    return false;
  }

  // Debug log to understand Forgejo's payload structure
  console.log("Forgejo issue_comment payload structure:");
  console.log("issue.pull_request:", issue.pull_request);
  console.log("issue.pr:", issue.pr);
  console.log("issue.html_url:", issue.html_url);
  console.log("issue.is_pull:", issue.is_pull);
  console.log("issue.is_pr:", issue.is_pr);
  console.log("issue.pull_request_url:", issue.pull_request_url);

  // Forgejo/Gitea specific checks
  // Check if it has pull_request field (GitHub compatible)
  if (issue.pull_request) {
    return true;
  }

  // Check if it has pr field (possible Forgejo structure)
  if (issue.pr) {
    return true;
  }

  // Check if the issue number matches a PR pattern in the HTML URL
  // Forgejo URLs: /org/repo/pulls/123
  if (issue.html_url && issue.html_url.includes("/pulls/")) {
    return true;
  }

  // Check if there's a PR-specific field in the issue
  if (issue.is_pull || issue.is_pr || issue.pull_request_url) {
    return true;
  }

  // If none of the above, it's likely an issue
  return false;
}

/**
 * Get the entity type (PR or Issue) from Forgejo context
 */
export function getForgejoEntityType(context: Context): "pr" | "issue" {
  switch (context.eventName) {
    case "pull_request":
    case "pull_request_review":
    case "pull_request_review_comment":
      return "pr";
    case "issues":
      return "issue";
    case "issue_comment":
      return isForgejoIssuePR(context) ? "pr" : "issue";
    default:
      return "issue";
  }
}