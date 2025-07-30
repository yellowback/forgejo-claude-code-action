import { GITHUB_SERVER_URL } from "../../api/config";
import { detectPlatform, Platform } from "../../../platform/detector";
import { getExternalBaseUrl } from "../../../platform/url-utils";

export const SPINNER_HTML =
  '<img src="https://github.com/user-attachments/assets/5ac382c7-e004-429b-8e35-7feb3e8f9c6f" width="14px" height="14px" style="vertical-align: middle; margin-left: 4px;" />';

export function createJobRunLink(
  owner: string,
  repo: string,
  runId: string,
): string {
  const platformConfig = detectPlatform();
  const baseUrl = platformConfig.platform === Platform.Forgejo ? getExternalBaseUrl() : GITHUB_SERVER_URL;
  
  // Both GitHub and Forgejo use the same URL pattern for actions
  const jobRunUrl = `${baseUrl}/${owner}/${repo}/actions/runs/${runId}`;
  return `[View job run](${jobRunUrl})`;
}

export function createBranchLink(
  owner: string,
  repo: string,
  branchName: string,
): string {
  const platformConfig = detectPlatform();
  const baseUrl = platformConfig.platform === Platform.Forgejo ? getExternalBaseUrl() : GITHUB_SERVER_URL;
  
  let branchUrl: string;
  if (platformConfig.platform === Platform.Forgejo) {
    // Forgejo uses 'src/branch' instead of 'tree'
    branchUrl = `${baseUrl}/${owner}/${repo}/src/branch/${branchName}`;
  } else {
    // GitHub format
    branchUrl = `${baseUrl}/${owner}/${repo}/tree/${branchName}`;
  }
  
  return `\n[View branch](${branchUrl})`;
}

export function createCommentBody(
  jobRunLink: string,
  branchLink: string = "",
): string {
  return `Claude Code is working… ${SPINNER_HTML}

I'll analyze this and get back to you.

${jobRunLink}${branchLink}`;
}
