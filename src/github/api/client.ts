import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import { GITHUB_API_URL } from "./config";

export type Octokits = {
  rest: Octokit;
  graphql: typeof graphql;
};

export function createOctokit(token: string, baseUrl?: string): Octokits {
  const apiUrl = baseUrl || GITHUB_API_URL;
  return {
    rest: new Octokit({
      auth: token,
      baseUrl: apiUrl,
    }),
    graphql: graphql.defaults({
      baseUrl: apiUrl,
      headers: {
        authorization: `token ${token}`,
      },
    }),
  };
}

// Create a simplified Octokit for Forgejo that only uses REST API
export function createForgejoOctokit(token: string, baseUrl: string): Octokits {
  return {
    rest: new Octokit({
      auth: token,
      baseUrl: baseUrl,
    }),
    // Forgejo doesn't support GraphQL, so we'll provide a stub that throws
    graphql: (() => {
      throw new Error("GraphQL API is not supported on Forgejo");
    }) as any,
  };
}
