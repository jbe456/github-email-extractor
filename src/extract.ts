import {
  createOctokit,
  sortByOccurence,
  setupCache,
  exportRepoData,
  toCSVContent,
  getCSVHeaders,
  RepositoryExtractOptions,
  RepoInfo,
  ExtractOptions,
  RepoInfoAndExport,
  SearchReposOptions,
  ExecOptions,
  ExtractUsersOptions,
  PushEvents,
} from "./utils";
import { Octokit } from "@octokit/rest";
import { ActivityListStargazersForRepoResponseData } from "@octokit/types";
import path from "path";
import _ from "lodash";
import { Cache } from "cache-manager";
import { printExtractSummary, printReposToAnalyse } from "./logging";

const getOwners = async ({ owner }: ExecOptions) => [owner];
const getStargazers = async ({ octokit, owner, repo }: ExecOptions) => {
  const stargazers = await octokit.paginate(
    octokit.activity.listStargazersForRepo,
    {
      per_page: 100,
      owner,
      repo,
    }
  );

  return (stargazers as ActivityListStargazersForRepoResponseData).map(
    (s) => s.login
  );
};

const getWatchers = async ({ octokit, owner, repo }: ExecOptions) => {
  const watchers = await octokit.paginate(
    octokit.activity.listWatchersForRepo,
    {
      per_page: 100,
      owner,
      repo,
    }
  );

  return watchers.map((w) => w.login);
};

const getForkOwners = async ({ octokit, owner, repo }: ExecOptions) => {
  const forks = await octokit.paginate(octokit.repos.listForks, {
    per_page: 100,
    owner,
    repo,
  });

  return _.uniq(forks.map((f) => f.owner.login));
};

const getIssueReportersAndAssignees = async ({
  octokit,
  owner,
  repo,
}: ExecOptions) => {
  const issues = await octokit.paginate(octokit.issues.listForRepo, {
    per_page: 100,
    owner,
    repo,
  });

  const reporters = issues.map((i) => i.user.login);
  const assignees = _.flattenDeep(
    issues.map((i) => i.assignees.map((a) => a.login))
  );

  return _.uniq([...reporters, ...assignees]);
};

const getIssueCommenters = async ({ octokit, owner, repo }: ExecOptions) => {
  const comments = await octokit.paginate(octokit.issues.listCommentsForRepo, {
    per_page: 100,
    owner,
    repo,
  });

  return _.uniq(comments.map((c) => c.user.login));
};

const extractUsers = async ({
  cache,
  octokit,
  owner,
  repo,
  callback,
}: ExtractUsersOptions) => {
  let users: string[] = [];
  let userCount = 0;

  const steps = [
    { type: "owner", exec: getOwners },
    { type: "stargazer(s)", exec: getStargazers },
    { type: "watcher(s)", exec: getWatchers },
    { type: "fork owner(s)", exec: getForkOwners },
    {
      type: "issue reporter(s) and assignee(s)",
      exec: getIssueReportersAndAssignees,
    },
    { type: "issue commenter(s)", exec: getIssueCommenters },
  ];

  await Promise.all(
    steps.map(async (step) => {
      const result = await cache.wrap(`${step.type}-${owner}-${repo}`, () =>
        step.exec({ octokit, owner, repo })
      );

      users.push(...result);
      users = _.uniq(users);

      callback({
        step: step.type,
        resultCount: result.length,
        newUsers: users.length - userCount,
      });
      userCount = users.length;
    })
  );

  return users;
};

const getUserInfos = async ({
  cache,
  octokit,
  users,
}: {
  cache: Cache;
  octokit: Octokit;
  users: string[];
}) => {
  const githubUserInfos = (
    await Promise.all(
      users.map((user) =>
        cache.wrap(`info-${user}`, () =>
          octokit.users.getByUsername({ username: user })
        )
      )
    )
  ).map((u) => u.data);

  const userInfos = await Promise.all(
    githubUserInfos.map(async (u) => {
      if (u.email) {
        return { ...u, emails: [u.email] };
      } else {
        const pushEvents: PushEvents[] = await cache.wrap(
          `push-events-${u.login}`,
          async () => {
            const events = await octokit.paginate(
              octokit.activity.listPublicEventsForUser,
              {
                per_page: 100,
                username: u.login,
              }
            );

            return events.filter((e: any) => e.type === "PushEvent");
          }
        );

        const emailsFromPushEvents = _.flattenDeep(
          pushEvents.map((e) => e.payload.commits.map((c) => c.author.email))
        );
        const extraEmails = sortByOccurence(
          emailsFromPushEvents.filter((x) => !x.includes("noreply"))
        );

        return {
          ...u,
          emails: extraEmails,
        };
      }
    })
  );

  return userInfos;
};

const fetchTopics = async (options: {
  cache: Cache;
  octokit: Octokit;
  owner: string;
  repo: string;
}) =>
  options.cache.wrap(`topics-${options.owner}-${options.repo}`, async () => {
    const topicsResult = await options.octokit.repos.getAllTopics({
      owner: options.owner,
      repo: options.repo,
    });
    return topicsResult.data.names;
  });

const repositoryExtract = async ({
  cache,
  octokit,
  owner,
  repo,
}: RepositoryExtractOptions): Promise<RepoInfo> => {
  console.log("-----------------------------------------------");
  console.log(`* ${owner}/${repo}                             `);
  console.log("-----------------------------------------------");

  console.log(`Fetching ${owner}/${repo} topics...`);
  const topics = await fetchTopics({ cache, octokit, owner, repo });
  console.log(`Topics: ${topics.join(" ")}`);

  console.log(`Extracting users from ${owner}/${repo}...`);

  const users = await extractUsers({
    cache,
    octokit,
    owner,
    repo,
    callback: ({ resultCount, step, newUsers }) => {
      console.log(
        `- Found ${resultCount} ${step} and ${newUsers} additional user(s).`
      );
    },
  });

  const usersCount = users.length;
  console.log(`Extracted ${usersCount} users total.`);
  console.log(`Extracting user infos...`);

  const userInfos = await getUserInfos({
    cache,
    octokit,
    users: users,
  });

  const emailsCount = userInfos.filter((u) => u.emails.length > 0).length;
  const emailRate = Math.round((emailsCount / usersCount) * 100);
  console.log(`Extracted ${emailsCount}/${usersCount} emails (${emailRate}%).`);

  return { owner, repo, emailsCount, usersCount, emailRate, userInfos, topics };
};

const searchRepos = async ({ cache, octokit, query }: SearchReposOptions) =>
  await cache.wrap(`search-repo-${query}`, async () => {
    const results = await octokit.paginate(octokit.search.repos, {
      per_page: 100,
      q: query,
    });

    return results.items.map((item) => item.full_name);
  });

export const extract = async ({
  maxEmails,
  output,
  clientId,
  clientSecret,
  cacheExpiry,
  cachePath,
  repos,
  query,
}: ExtractOptions) => {
  const repoInfos: RepoInfoAndExport[] = [];
  const octokit = createOctokit({ clientId, clientSecret });
  const cache = await setupCache({
    days: cacheExpiry,
    path: cachePath,
  });

  const exportIntoOneFile = output && path.parse(output).ext !== "";

  let reposToAnalyze: string[];
  if (query) {
    reposToAnalyze = await searchRepos({ cache, octokit, query });
  } else {
    reposToAnalyze = repos;
  }

  printReposToAnalyse(reposToAnalyze);

  await reposToAnalyze.reduce(async (promise, repoUrl) => {
    await promise;

    const [owner, repo] = repoUrl.split("/");
    const repoInfo = await repositoryExtract({
      cache,
      octokit,
      repo,
      owner,
      maxEmails,
    });

    const csvContent = toCSVContent({
      owner,
      repo,
      topics: repoInfo.topics,
      userInfos: repoInfo.userInfos,
      maxEmails,
    });

    if (!exportIntoOneFile) {
      const csvHeaders = getCSVHeaders({ maxEmails });

      const fileName = `${owner}-${repo}.csv`;
      const filePath =
        output !== undefined ? path.join(output, fileName) : fileName;

      exportRepoData({
        content: `${csvHeaders}\n${csvContent}`,
        filePath,
      });

      console.log(`Results exported to ${filePath}`);
    }

    repoInfos.push({ ...repoInfo, csvContent });
  }, Promise.resolve());

  if (exportIntoOneFile) {
    const csvHeaders = getCSVHeaders({ maxEmails });
    exportRepoData({
      content: `${csvHeaders}\n${repoInfos
        .map((info) => info.csvContent)
        .join("\n")}`,
      filePath: output,
    });
  }

  printExtractSummary({ exportIntoOneFile, output, repoInfos });
};
