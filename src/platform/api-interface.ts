/**
 * Common API interface for both GitHub and Forgejo platforms
 */

export interface User {
  login: string;
  name?: string;
  email?: string;
  id: number;
}

export interface Repository {
  owner: string;
  name: string;
  defaultBranch: string;
}

export interface Comment {
  id: number;
  nodeId?: string;
  body: string;
  author: User;
  createdAt: string;
  updatedAt?: string;
}

export interface Issue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  author: User;
  createdAt: string;
  comments: Comment[];
}

export interface PullRequestFile {
  path: string;
  additions: number;
  deletions: number;
  changeType: 'added' | 'removed' | 'modified' | 'renamed';
}

export interface Commit {
  oid: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
}

export interface PullRequest {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  author: User;
  baseRefName: string;
  headRefName: string;
  headRefOid: string;
  createdAt: string;
  additions: number;
  deletions: number;
  commits: Commit[];
  files: PullRequestFile[];
  comments: Comment[];
  reviews: Review[];
}

export interface ReviewComment {
  id: number;
  nodeId?: string;
  body: string;
  path: string;
  line: number;
  author: User;
  createdAt: string;
}

export interface Review {
  id: number;
  nodeId?: string;
  author: User;
  body: string;
  state: 'PENDING' | 'COMMENTED' | 'APPROVED' | 'CHANGES_REQUESTED';
  submittedAt: string;
  comments: ReviewComment[];
}

export interface CreateCommentParams {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}

export interface UpdateCommentParams {
  owner: string;
  repo: string;
  commentId: number;
  body: string;
}

export interface CreateBranchParams {
  owner: string;
  repo: string;
  branch: string;
  sha: string;
}

/**
 * Platform-agnostic API client interface
 */
export interface IPlatformClient {
  // Issue operations
  getIssue(owner: string, repo: string, number: number): Promise<Issue>;
  createIssueComment(params: CreateCommentParams): Promise<Comment>;
  updateIssueComment(params: UpdateCommentParams): Promise<Comment>;
  
  // Pull request operations
  getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest>;
  
  // Repository operations
  getRepository(owner: string, repo: string): Promise<Repository>;
  getDefaultBranch(owner: string, repo: string): Promise<string>;
  
  // Branch operations
  createBranch(params: CreateBranchParams): Promise<void>;
  getBranch(owner: string, repo: string, branch: string): Promise<{ sha: string }>;
  
  // User operations
  getUser(login: string): Promise<User>;
}