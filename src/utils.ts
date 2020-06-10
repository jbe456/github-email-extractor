import { Octokit } from "@octokit/rest";
import { createOAuthAppAuth } from "@octokit/auth";
import _ from "lodash";

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

export const toCSV = ({
  owner,
  repo,
  userInfos,
}: {
  owner: string;
  repo: string;
  userInfos: { login: string; name: string; emails: string[] }[];
}) => {
  const maxEmails = _.max(userInfos.map((u) => u.emails.length));
  const emailHeaders = Array.from(Array(maxEmails).keys()).map(
    (k) => `email-${k}`
  );

  const headers = [
    "owner",
    "repo",
    "username",
    "name",
    emailHeaders.join(", "),
  ].join(", ");

  const content = userInfos
    .map((u) =>
      [
        owner,
        repo,
        u.login,
        u.name,
        emailHeaders
          .map((e, k) => (k < u.emails.length ? u.emails[k] : undefined))
          .join(", "),
      ].join(", ")
    )
    .join(`\n`);

  return `${headers}\n${content}`;
};
