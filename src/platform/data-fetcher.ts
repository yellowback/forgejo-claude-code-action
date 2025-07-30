/**
 * Platform-agnostic data fetcher that uses the common API interface
 */

import { IPlatformClient, PullRequest, Issue, Comment } from './api-interface';
import { detectPlatform, Platform } from './detector';
import { createPlatformClient } from '../forgejo/api/rest-adapter';
import type { 
  GitHubPullRequest, 
  GitHubIssue, 
  GitHubComment,
  GitHubFile,
  GitHubReview 
} from '../github/types';
import type { CommentWithImages } from '../github/utils/image-downloader';
import { downloadCommentImages } from '../github/utils/image-downloader';

export type PlatformFileWithSHA = GitHubFile & {
  sha: string;
};

export type FetchDataResult = {
  contextData: GitHubPullRequest | GitHubIssue;
  comments: GitHubComment[];
  changedFiles: GitHubFile[];
  changedFilesWithSHA: PlatformFileWithSHA[];
  reviewData: { nodes: GitHubReview[] } | null;
  imageUrlMap: Map<string, string>;
  triggerDisplayName?: string | null;
};

type FetchDataParams = {
  client?: IPlatformClient;
  repository: string;
  prNumber: string;
  isPR: boolean;
  triggerUsername?: string;
  token?: string;
};

/**
 * Fetches data from the platform (GitHub or Forgejo)
 */
export async function fetchPlatformData({
  client,
  repository,
  prNumber,
  isPR,
  triggerUsername,
  token,
}: FetchDataParams): Promise<FetchDataResult> {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error("Invalid repository format. Expected 'owner/repo'.");
  }

  const platformClient = client || createPlatformClient(token);
  const config = detectPlatform();
  
  let contextData: GitHubPullRequest | GitHubIssue | null = null;
  let comments: GitHubComment[] = [];
  let changedFiles: GitHubFile[] = [];
  let changedFilesWithSHA: PlatformFileWithSHA[] = [];
  let reviewData: { nodes: GitHubReview[] } | null = null;
  let imageUrlMap = new Map<string, string>();
  let triggerDisplayName: string | null = null;

  try {
    if (isPR) {
      const pr = await platformClient.getPullRequest(owner, repo, parseInt(prNumber));
      
      // Convert to GitHub format for compatibility
      contextData = {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        author: { login: pr.author.login },
        baseRefName: pr.baseRefName,
        headRefName: pr.headRefName,
        headRefOid: pr.headRefOid,
        createdAt: pr.createdAt,
        additions: pr.additions,
        deletions: pr.deletions,
        state: pr.state.toUpperCase(),
        commits: {
          totalCount: pr.commits.length,
          nodes: pr.commits.map(c => ({
            commit: {
              oid: c.oid,
              message: c.message,
              author: c.author,
            },
          })),
        },
        files: {
          nodes: pr.files.map(f => ({
            path: f.path,
            additions: f.additions,
            deletions: f.deletions,
            changeType: f.changeType.toUpperCase(),
          })),
        },
      } as GitHubPullRequest;

      // Extract comments
      comments = pr.comments.map(c => ({
        id: c.nodeId || `${c.id}`,
        databaseId: c.id,
        body: c.body,
        author: { login: c.author.login },
        createdAt: c.createdAt,
      }));

      // Extract changed files
      changedFiles = pr.files.map(f => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        changeType: f.changeType.toUpperCase(),
      }));

      // For Forgejo, we need to fetch file SHAs separately
      if (config.platform === Platform.Forgejo) {
        changedFilesWithSHA = await Promise.all(
          changedFiles.map(async (file) => {
            try {
              // This would require additional API calls to get file SHA
              // For now, use empty SHA as placeholder
              return { ...file, sha: '' };
            } catch {
              return { ...file, sha: '' };
            }
          })
        );
      }

      // Convert reviews to GitHub format
      if (pr.reviews.length > 0) {
        reviewData = {
          nodes: pr.reviews.map(r => ({
            id: r.nodeId || `${r.id}`,
            databaseId: r.id,
            author: { login: r.author.login },
            body: r.body,
            state: r.state,
            submittedAt: r.submittedAt,
            comments: {
              nodes: r.comments.map(rc => ({
                id: rc.nodeId || `${rc.id}`,
                databaseId: rc.id,
                body: rc.body,
                path: rc.path,
                line: rc.line,
                author: { login: rc.author.login },
                createdAt: rc.createdAt,
              })),
            },
          })),
        };
      }
    } else {
      const issue = await platformClient.getIssue(owner, repo, parseInt(prNumber));
      
      // Convert to GitHub format for compatibility
      contextData = {
        number: issue.number,
        title: issue.title,
        body: issue.body,
        author: { login: issue.author.login },
        createdAt: issue.createdAt,
        state: issue.state.toUpperCase(),
      } as GitHubIssue;

      // Extract comments
      comments = issue.comments.map(c => ({
        id: c.nodeId || `${c.id}`,
        databaseId: c.id,
        body: c.body,
        author: { login: c.author.login },
        createdAt: c.createdAt,
      }));
    }

    // Handle image downloads (GitHub only for now)
    if (config.platform === Platform.GitHub) {
      const allComments: CommentWithImages[] = [
        { body: contextData.body, images: [] },
        ...comments.map(c => ({ body: c.body, images: [] })),
      ];

      if (reviewData) {
        reviewData.nodes.forEach(review => {
          allComments.push({ body: review.body, images: [] });
          review.comments.nodes.forEach(comment => {
            allComments.push({ body: comment.body, images: [] });
          });
        });
      }

      imageUrlMap = await downloadCommentImages(allComments);
    }

    // Get trigger user display name
    if (triggerUsername) {
      try {
        const user = await platformClient.getUser(triggerUsername);
        triggerDisplayName = user.name || user.login;
      } catch (error) {
        console.warn(`Failed to fetch user details for ${triggerUsername}:`, error);
        triggerDisplayName = triggerUsername;
      }
    }

    return {
      contextData,
      comments,
      changedFiles,
      changedFilesWithSHA,
      reviewData,
      imageUrlMap,
      triggerDisplayName,
    };
  } catch (error) {
    console.error("Error fetching platform data:", error);
    throw error;
  }
}