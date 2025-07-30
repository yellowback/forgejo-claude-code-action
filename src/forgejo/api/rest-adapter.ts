/**
 * Adapter to use ForgejoClient through the existing GitHub API interface
 */

import { createOctokit, Octokits } from '../../github/api/client';
import { ForgejoClient } from './client';
import { detectPlatform, Platform, getPlatformToken } from '../../platform/detector';
import { 
  IPlatformClient,
  Issue,
  PullRequest,
  Comment,
  Repository,
  User
} from '../../platform/api-interface';

/**
 * Creates a platform-specific client based on the detected platform
 */
export function createPlatformClient(token?: string): IPlatformClient {
  const config = detectPlatform();
  const authToken = token || getPlatformToken();
  
  if (config.platform === Platform.Forgejo) {
    return new ForgejoClient(config.apiUrl, authToken);
  }
  
  // For GitHub, wrap the existing Octokit client
  const octokit = createOctokit(authToken);
  return new GitHubClientAdapter(octokit);
}

/**
 * Adapts the existing GitHub Octokit client to the common interface
 */
class GitHubClientAdapter implements IPlatformClient {
  constructor(private octokit: Octokits) {}

  async getIssue(owner: string, repo: string, number: number): Promise<Issue> {
    const { data: issue } = await this.octokit.rest.issues.get({
      owner,
      repo,
      issue_number: number,
    });

    const { data: comments } = await this.octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: number,
      per_page: 100,
    });

    return {
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      state: issue.state as 'open' | 'closed',
      author: {
        login: issue.user?.login || '',
        id: issue.user?.id || 0,
      },
      createdAt: issue.created_at,
      comments: comments.map(c => ({
        id: c.id,
        nodeId: c.node_id,
        body: c.body || '',
        author: {
          login: c.user?.login || '',
          id: c.user?.id || 0,
        },
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    };
  }

  async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    // Use the existing GraphQL query through the octokit client
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            number
            title
            body
            author {
              login
            }
            baseRefName
            headRefName
            headRefOid
            createdAt
            additions
            deletions
            state
            commits(first: 100) {
              nodes {
                commit {
                  oid
                  message
                  author {
                    name
                    email
                  }
                }
              }
            }
            files(first: 100) {
              nodes {
                path
                additions
                deletions
                changeType
              }
            }
            comments(first: 100) {
              nodes {
                id
                databaseId
                body
                author {
                  login
                }
                createdAt
              }
            }
            reviews(first: 100) {
              nodes {
                id
                databaseId
                author {
                  login
                }
                body
                state
                submittedAt
                comments(first: 100) {
                  nodes {
                    id
                    databaseId
                    body
                    path
                    line
                    author {
                      login
                    }
                    createdAt
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.octokit.graphql(query, { owner, repo, number });
    const pr = (result as any).repository.pullRequest;

    return {
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state.toLowerCase() as 'open' | 'closed' | 'merged',
      author: {
        login: pr.author.login,
        id: 0, // GraphQL doesn't return numeric ID
      },
      baseRefName: pr.baseRefName,
      headRefName: pr.headRefName,
      headRefOid: pr.headRefOid,
      createdAt: pr.createdAt,
      additions: pr.additions,
      deletions: pr.deletions,
      commits: pr.commits.nodes.map((n: any) => ({
        oid: n.commit.oid,
        message: n.commit.message,
        author: {
          name: n.commit.author.name,
          email: n.commit.author.email,
        },
      })),
      files: pr.files.nodes.map((f: any) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        changeType: f.changeType.toLowerCase() as any,
      })),
      comments: pr.comments.nodes.map((c: any) => ({
        id: c.databaseId,
        nodeId: c.id,
        body: c.body,
        author: {
          login: c.author.login,
          id: 0,
        },
        createdAt: c.createdAt,
      })),
      reviews: pr.reviews.nodes.map((r: any) => ({
        id: r.databaseId,
        nodeId: r.id,
        author: {
          login: r.author.login,
          id: 0,
        },
        body: r.body || '',
        state: r.state,
        submittedAt: r.submittedAt,
        comments: r.comments.nodes.map((rc: any) => ({
          id: rc.databaseId,
          nodeId: rc.id,
          body: rc.body,
          path: rc.path,
          line: rc.line,
          author: {
            login: rc.author.login,
            id: 0,
          },
          createdAt: rc.createdAt,
        })),
      })),
    };
  }

  async createIssueComment(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
  }): Promise<Comment> {
    const { data } = await this.octokit.rest.issues.createComment({
      owner: params.owner,
      repo: params.repo,
      issue_number: params.issueNumber,
      body: params.body,
    });

    return {
      id: data.id,
      nodeId: data.node_id,
      body: data.body || '',
      author: {
        login: data.user?.login || '',
        id: data.user?.id || 0,
      },
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateIssueComment(params: {
    owner: string;
    repo: string;
    commentId: number;
    body: string;
  }): Promise<Comment> {
    const { data } = await this.octokit.rest.issues.updateComment({
      owner: params.owner,
      repo: params.repo,
      comment_id: params.commentId,
      body: params.body,
    });

    return {
      id: data.id,
      nodeId: data.node_id,
      body: data.body || '',
      author: {
        login: data.user?.login || '',
        id: data.user?.id || 0,
      },
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getRepository(owner: string, repo: string): Promise<Repository> {
    const { data } = await this.octokit.rest.repos.get({
      owner,
      repo,
    });

    return {
      owner: data.owner.login,
      name: data.name,
      defaultBranch: data.default_branch,
    };
  }

  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const repository = await this.getRepository(owner, repo);
    return repository.defaultBranch;
  }

  async createBranch(params: {
    owner: string;
    repo: string;
    branch: string;
    sha: string;
  }): Promise<void> {
    await this.octokit.rest.git.createRef({
      owner: params.owner,
      repo: params.repo,
      ref: `refs/heads/${params.branch}`,
      sha: params.sha,
    });
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<{ sha: string }> {
    const { data } = await this.octokit.rest.repos.getBranch({
      owner,
      repo,
      branch,
    });

    return { sha: data.commit.sha };
  }

  async getUser(login: string): Promise<User> {
    const { data } = await this.octokit.rest.users.getByUsername({
      username: login,
    });

    return {
      login: data.login,
      name: data.name || undefined,
      email: data.email || undefined,
      id: data.id,
    };
  }
}