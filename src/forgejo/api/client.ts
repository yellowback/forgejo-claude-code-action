/**
 * Forgejo/Gitea API client implementation
 */

import { 
  IPlatformClient, 
  Issue, 
  PullRequest, 
  Comment, 
  Repository,
  CreateCommentParams,
  UpdateCommentParams,
  CreateBranchParams,
  User,
  Commit,
  PullRequestFile,
  Review,
  ReviewComment
} from '../../platform/api-interface';
import { normalizeApiUrl, Platform } from '../../platform/detector';

export class ForgejoClient implements IPlatformClient {
  private apiUrl: string;
  private token: string;
  private headers: Record<string, string>;

  constructor(apiUrl: string, token: string) {
    this.apiUrl = normalizeApiUrl(apiUrl, Platform.Forgejo);
    this.token = token;
    this.headers = {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Forgejo API error: ${response.status} ${response.statusText} - ${error}`);
    }

    return response.json();
  }

  async getIssue(owner: string, repo: string, number: number): Promise<Issue> {
    const [issue, comments] = await Promise.all([
      this.request<any>(`/repos/${owner}/${repo}/issues/${number}`),
      this.request<any[]>(`/repos/${owner}/${repo}/issues/${number}/comments`)
    ]);

    return {
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      state: issue.state,
      author: {
        login: issue.user.login,
        name: issue.user.full_name,
        id: issue.user.id,
      },
      createdAt: issue.created_at,
      comments: comments.map(c => ({
        id: c.id,
        body: c.body,
        author: {
          login: c.user.login,
          name: c.user.full_name,
          id: c.user.id,
        },
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    };
  }

  async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    const [pr, commits, files, comments, reviews] = await Promise.all([
      this.request<any>(`/repos/${owner}/${repo}/pulls/${number}`),
      this.request<any[]>(`/repos/${owner}/${repo}/pulls/${number}/commits`),
      this.request<any[]>(`/repos/${owner}/${repo}/pulls/${number}/files`),
      this.request<any[]>(`/repos/${owner}/${repo}/issues/${number}/comments`),
      this.request<any[]>(`/repos/${owner}/${repo}/pulls/${number}/reviews`)
    ]);

    // Get review comments for each review
    const reviewsWithComments = await Promise.all(
      reviews.map(async (review) => {
        const reviewComments = await this.request<any[]>(
          `/repos/${owner}/${repo}/pulls/${number}/reviews/${review.id}/comments`
        );
        return { ...review, review_comments: reviewComments };
      })
    );

    return {
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state === 'open' ? 'open' : pr.merged ? 'merged' : 'closed',
      author: {
        login: pr.user.login,
        name: pr.user.full_name,
        id: pr.user.id,
      },
      baseRefName: pr.base.ref,
      headRefName: pr.head.ref,
      headRefOid: pr.head.sha,
      createdAt: pr.created_at,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      commits: commits.map(c => ({
        oid: c.sha,
        message: c.commit.message,
        author: {
          name: c.commit.author.name,
          email: c.commit.author.email,
        },
      })),
      files: files.map(f => ({
        path: f.filename,
        additions: f.additions,
        deletions: f.deletions,
        changeType: this.mapFileStatus(f.status),
      })),
      comments: comments.map(c => ({
        id: c.id,
        body: c.body,
        author: {
          login: c.user.login,
          name: c.user.full_name,
          id: c.user.id,
        },
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
      reviews: reviewsWithComments.map(r => ({
        id: r.id,
        author: {
          login: r.user.login,
          name: r.user.full_name,
          id: r.user.id,
        },
        body: r.body || '',
        state: this.mapReviewState(r.state),
        submittedAt: r.submitted_at,
        comments: (r.review_comments || []).map((rc: any) => ({
          id: rc.id,
          body: rc.body,
          path: rc.path,
          line: rc.line || rc.original_line || 0,
          author: {
            login: rc.user.login,
            name: rc.user.full_name,
            id: rc.user.id,
          },
          createdAt: rc.created_at,
        })),
      })),
    };
  }

  async createIssueComment(params: CreateCommentParams): Promise<Comment> {
    const response = await this.request<any>(
      `/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ body: params.body }),
      }
    );

    return {
      id: response.id,
      body: response.body,
      author: {
        login: response.user.login,
        name: response.user.full_name,
        id: response.user.id,
      },
      createdAt: response.created_at,
      updatedAt: response.updated_at,
    };
  }

  async updateIssueComment(params: UpdateCommentParams): Promise<Comment> {
    const response = await this.request<any>(
      `/repos/${params.owner}/${params.repo}/issues/comments/${params.commentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ body: params.body }),
      }
    );

    return {
      id: response.id,
      body: response.body,
      author: {
        login: response.user.login,
        name: response.user.full_name,
        id: response.user.id,
      },
      createdAt: response.created_at,
      updatedAt: response.updated_at,
    };
  }

  async getRepository(owner: string, repo: string): Promise<Repository> {
    const response = await this.request<any>(`/repos/${owner}/${repo}`);
    
    return {
      owner: response.owner.login,
      name: response.name,
      defaultBranch: response.default_branch,
    };
  }

  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const repository = await this.getRepository(owner, repo);
    return repository.defaultBranch;
  }

  async createBranch(params: CreateBranchParams): Promise<void> {
    await this.request(
      `/repos/${params.owner}/${params.repo}/git/refs`,
      {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${params.branch}`,
          sha: params.sha,
        }),
      }
    );
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<{ sha: string }> {
    const response = await this.request<any>(
      `/repos/${owner}/${repo}/branches/${branch}`
    );
    
    return { sha: response.commit.id };
  }

  async getUser(login: string): Promise<User> {
    const response = await this.request<any>(`/users/${login}`);
    
    return {
      login: response.login,
      name: response.full_name,
      email: response.email,
      id: response.id,
    };
  }

  private mapFileStatus(status: string): 'added' | 'removed' | 'modified' | 'renamed' {
    switch (status) {
      case 'added':
        return 'added';
      case 'removed':
      case 'deleted':
        return 'removed';
      case 'renamed':
        return 'renamed';
      default:
        return 'modified';
    }
  }

  private mapReviewState(state: string): 'PENDING' | 'COMMENTED' | 'APPROVED' | 'CHANGES_REQUESTED' {
    switch (state.toUpperCase()) {
      case 'APPROVED':
        return 'APPROVED';
      case 'PENDING':
        return 'PENDING';
      case 'COMMENT':
      case 'COMMENTED':
        return 'COMMENTED';
      case 'REQUEST_CHANGES':
      case 'CHANGES_REQUESTED':
        return 'CHANGES_REQUESTED';
      default:
        return 'COMMENTED';
    }
  }
}