import { Octokit } from "@octokit/rest";
import { createOAuthAppAuth } from "@octokit/auth";
import _ from "lodash";
import cacheManager, { Cache } from "cache-manager";
import fsStore from "cache-manager-fs";

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
  topics,
  userInfos,
  maxEmails,
}: {
  owner: string;
  repo: string;
  topics: string[];
  userInfos: { login: string; name: string; emails: string[] }[];
  maxEmails: number;
}) => {
  const emailHeaders = Array.from(Array(maxEmails).keys()).map(
    (k) => `email-${k}`
  );

  const headers = [
    "owner",
    "repo",
    "username",
    "name",
    emailHeaders.join(","),
    "topics",
  ].join(",");

  const content = userInfos
    .map((u) =>
      [
        owner,
        repo,
        u.login,
        u.name,
        emailHeaders
          .map((e, k) => (k < u.emails.length ? u.emails[k] : undefined))
          .join(","),
        topics.join(" "),
      ].join(",")
    )
    .join(`\n`);

  return `${headers}\n${content}`;
};

export const sortByOccurence = (array: string[]) =>
  _.orderBy(
    _.map(_.countBy(array), (value, key) => ({ key, value })),
    "value",
    "desc"
  ).map((element) => element.key);

export const setupCache = async ({
  days,
  path,
}: {
  days: number;
  path: string;
}): Promise<Cache> => {
  return new Promise((resolve) => {
    const cache = cacheManager.caching({
      store: fsStore,
      ttl: days * 24 * 60 * 60 /* days in seconds */,
      maxsize: 1000 * 1000 * 1000 /* 1GB max size in bytes on disk */,
      path,
      zip: false,
      fillcallback: () => {
        resolve(cache);
      },
    });
  });
};
