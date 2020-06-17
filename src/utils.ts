import { Octokit } from "@octokit/rest";
import { createOAuthAppAuth } from "@octokit/auth";
import _ from "lodash";
import cacheManager, { Cache } from "cache-manager";
import fsStore from "cache-manager-fs";
import fs from "fs";
import path from "path";

export type ExtractOptions = {
  clientId: string;
  clientSecret: string;
  repos?: string[];
  query?: string;
  output: string;
  maxEmails: number;
  cacheExpiry: number;
  cachePath: string;
};

export type RepositoryExtractOptions = {
  cache: Cache;
  octokit: Octokit;
  owner: string;
  repo: string;
  maxEmails: number;
  output: string;
};

type UserInfo = { login: string; name: string; emails: string[] };

export type RepoInfo = {
  repo: string;
  owner: string;
  emailsCount: number;
  usersCount: number;
  emailRate: number;
  userInfos: UserInfo[];
  topics: string[];
};

export type RepoInfoAndExport = RepoInfo & { csvContent: string };

export type SearchReposOptions = {
  cache: Cache;
  octokit: Octokit;
  query: string;
};

type ExportOptions = {
  content: string;
  filePath: string;
};

export const utcToTimeString = (utcSeconds: number) => {
  const date = new Date(0);
  date.setUTCSeconds(utcSeconds);
  return date.toLocaleTimeString();
};

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

export const exportRepoData = ({ content, filePath }: ExportOptions) => {
  const parsedPath = path.parse(filePath);

  if (parsedPath.dir) {
    fs.mkdir(parsedPath.dir, { recursive: true }, (err) => {
      if (err) throw err;
    });
  }

  fs.writeFileSync(filePath, content);
};

export const getCSVHeaders = ({ maxEmails }: { maxEmails: number }) => {
  const emailHeaders = Array.from(Array(maxEmails).keys()).map(
    (k) => `email-${k}`
  );
  return [
    "owner",
    "repo",
    "username",
    "name",
    emailHeaders.join(","),
    "topics",
  ].join(",");
};

export const toCSVContent = ({
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
  const content = userInfos
    .map((u) =>
      [
        owner,
        repo,
        u.login,
        u.name,
        Array.from(Array(maxEmails).keys())
          .map((e, k) => (k < u.emails.length ? u.emails[k] : undefined))
          .join(","),
        topics.join(" "),
      ].join(",")
    )
    .join(`\n`);

  return content;
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
