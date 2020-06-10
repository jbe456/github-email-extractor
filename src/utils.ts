import { Octokit } from "@octokit/rest";
import { createOAuthAppAuth } from "@octokit/auth";

export const createOctokit = (options: {
  clientId?: string;
  clientSecret?: string;
}) => {
  return options.clientId && options.clientSecret
    ? new Octokit({
        authStrategy: createOAuthAppAuth,
        auth: {
          clientId: options.clientId,
          clientSecret: options.clientSecret,
        },
      })
    : new Octokit();
};

export const multiPagePull = async function <T>(
  fetch: (options: { page: number; per_page: number }) => Promise<T[]>
) {
  const allResults = [];
  let page = 1;
  let keepFetching = true;

  while (keepFetching) {
    const result = await fetch({
      per_page: 100,
      page: page,
    });

    allResults.push(...result);
    keepFetching = result.length === 100;
    page++;
  }
  return allResults;
};
