import {
  createOctokit,
  multiPagePull,
  toCSV,
  sortByOccurence,
  setupCache,
} from "./utils";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";
import _ from "lodash";
import Table from "cli-table";
import { Cache } from "cache-manager";

type ExtractOptions = {
  clientId: string;
  clientSecret: string;
  repos: string[];
  output: string;
  maxEmails: number;
  cacheExpiry: number;
  cachePath: string;
};

type RepositoryExtractOptions = {
  cache: Cache;
  octokit: Octokit;
  owner: string;
  repo: string;
  maxEmails: number;
  output: string;
};

type UserInfo = { login: string; name: string; emails: string[] };

type RepoInfo = {
  repo: string;
  owner: string;
  emailsCount: number;
  usersCount: number;
  emailRate: number;
  userInfos: UserInfo[];
  topics: string[];
};

type ExportOptions = {
  owner: string;
  repo: string;
  topics: string[];
  userInfos: UserInfo[];
  maxEmails: number;
  output: string;
};

const extractUsers = async ({
  cache,
  octokit,
  owner,
  repo,
  callback,
}: {
  cache: Cache;
  octokit: Octokit;
  owner: string;
  repo: string;
  callback: (options: {
    step: string;
    resultCount: number;
    newUsers: number;
  }) => void;
}) => {
  let users: string[] = [];
  let userCount = 0;

  const steps = [
    { type: "owner", exec: () => [owner] },
    {
      type: "stargazer(s)",
      exec: () =>
        multiPagePull(async (options) => {
          const stargazersResult = await octokit.activity.listStargazersForRepo(
            {
              ...options,
              owner,
              repo,
            }
          );

          return (stargazersResult.data as any).map(
            (s: { login: string }) => s.login
          ) as string[];
        }),
    },
    {
      type: "watcher(s)",
      exec: () =>
        multiPagePull(async (options) => {
          const watchersResult = await octokit.activity.listWatchersForRepo({
            ...options,
            owner,
            repo,
          });

          return watchersResult.data.map((w) => w.login);
        }),
    },
    {
      type: "fork owner(s)",
      exec: () =>
        multiPagePull(async (options) => {
          const forksResult = await octokit.repos.listForks({
            ...options,
            owner,
            repo,
          });

          return forksResult.data.map((w) => w.owner.login);
        }).then((results) => _.uniq(results)),
    },
    {
      type: "issue reporter(s) and assignee(s)",
      exec: () =>
        multiPagePull(async (options) => {
          const forksResult = await octokit.issues.listForRepo({
            ...options,
            owner,
            repo,
          });

          return forksResult.data.map((w) => ({
            reporter: w.user.login,
            assignees: w.assignees.map((a) => a.login),
          }));
        }).then((results) => {
          const reporters = results.map((i) => i.reporter);
          const assignees = _.flattenDeep(results.map((i) => i.assignees));

          return _.uniq([...reporters, ...assignees]);
        }),
    },
    {
      type: "issue commenter(s)",
      exec: () =>
        multiPagePull(async (options) => {
          const commentsResult = await octokit.issues.listCommentsForRepo({
            ...options,
            owner,
            repo,
          });

          return commentsResult.data.map((c) => c.user.login);
        }).then((results) => _.uniq(results)),
    },
  ];

  await Promise.all(
    steps.map(async (step) => {
      const result = await cache.wrap(`${step.type}-${owner}-${repo}`, () =>
        step.exec()
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
        const pushEvents: {
          payload: { commits: { author: { email: string } }[] };
        }[] = await cache.wrap(`push-events-${u.login}`, () =>
          multiPagePull(async (options) => {
            const watchersResult = await octokit.activity.listPublicEventsForUser(
              {
                ...options,
                username: u.login,
              }
            );

            return watchersResult.data.filter(
              (e: any) => e.type === "PushEvent"
            );
          })
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
  const topics = await cache.wrap(`topics-${owner}-${repo}`, () =>
    fetchTopics({ cache, octokit, owner, repo })
  );
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

const exportRepoData = ({
  owner,
  repo,
  topics,
  userInfos,
  maxEmails,
  output,
}: ExportOptions) => {
  const csv = toCSV({
    owner,
    repo,
    topics,
    userInfos,
    maxEmails,
  });

  const folderPath = path.join(
    ...[process.cwd(), output].filter((x) => x !== undefined)
  );
  fs.mkdir(folderPath, { recursive: true }, (err) => {
    if (err) throw err;
  });

  const filePath = path.join(folderPath, `${owner}-${repo}.csv`);
  fs.writeFileSync(filePath, csv);

  console.log(`Results exported to ${filePath}`);
};

export const extract = async ({
  maxEmails,
  output,
  clientId,
  clientSecret,
  cacheExpiry,
  cachePath,
  repos,
}: ExtractOptions) => {
  const repoInfos: RepoInfo[] = [];
  const octokit = createOctokit({ clientId, clientSecret });
  const cache = await setupCache({
    days: cacheExpiry,
    path: cachePath,
  });

  await repos.reduce(async (promise, repoUrl) => {
    await promise;

    const [owner, repo] = repoUrl.split("/");
    const repoInfo = await repositoryExtract({
      cache,
      octokit,
      repo,
      owner,
      maxEmails,
      output,
    });

    exportRepoData({
      owner,
      repo,
      topics: repoInfo.topics,
      userInfos: repoInfo.userInfos,
      maxEmails,
      output,
    });

    repoInfos.push(repoInfo);
  }, Promise.resolve());

  console.log("-----------------------------------------------");
  console.log("                    SUMMARY                    ");
  console.log("-----------------------------------------------");

  const table = new Table({
    head: ["repo", "emails", "users", "rate"],
  });

  repoInfos.forEach((stat) => {
    table.push([
      `${stat.owner}/${stat.repo}`,
      stat.emailsCount,
      stat.usersCount,
      `${stat.emailRate}%`,
    ]);
  });

  const totalEmailsCount = _.sumBy(repoInfos, "emailsCount");
  const totalUsersCount = _.sumBy(repoInfos, "usersCount");
  table.push(["* TOTAL", totalEmailsCount, totalUsersCount, "-"]);

  const allUserInfos = _.uniqBy(
    _.flatten(repoInfos.map((stat) => stat.userInfos)),
    "login"
  );
  const uniqueEmailsCount = allUserInfos.filter((u) => u.emails.length > 0)
    .length;
  const uniqueUsersCount = allUserInfos.length;
  const avgUniqueEmailRate = Math.round(
    (totalEmailsCount / totalUsersCount) * 100
  );
  table.push([
    "* UNIQUE",
    uniqueEmailsCount,
    uniqueUsersCount,
    `${avgUniqueEmailRate}%`,
  ]);

  console.log(table.toString());
};
