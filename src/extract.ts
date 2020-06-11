import { createOctokit, multiPagePull, toCSV, sortByOccurence } from "./utils";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";
import _ from "lodash";
import Table from "cli-table";

const extractUsers = async ({
  octokit,
  owner,
  repo,
  callback,
}: {
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
      const result = await step.exec();

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
  octokit,
  users,
}: {
  octokit: Octokit;
  users: string[];
}) => {
  const githubUserInfos = (
    await Promise.all(
      users.map((user) => octokit.users.getByUsername({ username: user }))
    )
  ).map((u) => u.data);

  const userInfos = await Promise.all(
    githubUserInfos.map(async (u) => {
      if (u.email) {
        return { ...u, emails: [u.email] };
      } else {
        const pushEvents = await multiPagePull(async (options) => {
          const watchersResult = await octokit.activity.listPublicEventsForUser(
            {
              ...options,
              username: u.login,
            }
          );

          return watchersResult.data.filter((e: any) => e.type === "PushEvent");
        });

        const emailsFromPushEvents = _.flattenDeep(
          pushEvents.map((e: any) =>
            e.payload.commits.map((c: any) => c.author.email)
          )
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

export const extract = async (argv: {
  clientId: string;
  clientSecret: string;
  repos: string[];
  output: string;
  maxEmails: number;
}) => {
  const octokit = createOctokit(argv);

  const stats: {
    repoUrl: string;
    emailsCount: number;
    usersCount: number;
    emailRate: number;
    userInfos: { login: string; name: string; emails: string[] }[];
  }[] = [];

  await argv.repos.reduce(async (promise, repoUrl) => {
    await promise;

    const [owner, repo] = repoUrl.split("/");

    console.log("-----------------------------------------------");
    console.log(`* ${owner}/${repo}                             `);
    console.log("-----------------------------------------------");

    console.log(`Extracting users from ${owner}/${repo}...`);

    const users = await extractUsers({
      ...argv,
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
      octokit,
      users: users,
    });

    const emailsCount = userInfos.filter((u) => u.emails.length > 0).length;
    const emailRate = Math.round((emailsCount / usersCount) * 100);
    console.log(
      `Extracted ${emailsCount}/${usersCount} emails (${emailRate}%).`
    );

    const csv = toCSV({
      owner,
      repo,
      userInfos,
      maxEmails: argv.maxEmails,
    });

    const folderPath = path.join(
      ...[process.cwd(), argv.output].filter((x) => x !== undefined)
    );
    fs.mkdir(folderPath, { recursive: true }, (err) => {
      if (err) throw err;
    });

    const filePath = path.join(folderPath, `${owner}-${repo}.csv`);
    fs.writeFileSync(filePath, csv);

    console.log(`Results exported to ${filePath}`);

    stats.push({ repoUrl, emailsCount, usersCount, emailRate, userInfos });
  }, Promise.resolve());

  console.log("-----------------------------------------------");
  console.log("                    SUMMARY                    ");
  console.log("-----------------------------------------------");

  const table = new Table({
    head: ["repo", "emails", "users", "rate"],
  });

  stats.forEach((stat) => {
    table.push([
      stat.repoUrl,
      stat.emailsCount,
      stat.usersCount,
      `${stat.emailRate}%`,
    ]);
  });

  const totalEmailsCount = _.sumBy(stats, "emailsCount");
  const totalUsersCount = _.sumBy(stats, "usersCount");
  table.push(["* TOTAL", totalEmailsCount, totalUsersCount, "-"]);

  const allUserInfos = _.uniqBy(
    _.flatten(stats.map((stat) => stat.userInfos)),
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
