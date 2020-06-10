#!/usr/bin/env node
import yargs from "yargs";
import { Octokit } from "@octokit/rest";
import { createOAuthAppAuth } from "@octokit/auth";
import _ from "lodash";
import fs from "fs";
import path from "path";

const createOctokit = (options: {
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

const status = async (options: { clientId: string; clientSecret: string }) => {
  const octokit = createOctokit(options);
  const rateLimit = await octokit.rateLimit.get();

  const remaining = rateLimit.data.resources.core.remaining;
  const limit = rateLimit.data.resources.core.limit;
  const resetTimestamp = rateLimit.data.resources.core.reset;

  console.log(`Status: ${remaining}/${limit}`);
  console.log(`Reset: ${new Date(resetTimestamp).toTimeString()}`);
};

const multiPagePull = async function <T>(
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

const extractUsers = async ({
  octokit,
  owner,
  repo,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
}) => {
  console.log(`Fetching users from ${owner}/${repo}...`);

  let users = [];
  let userCount = 0;

  // Stargazers
  const stargazers = await multiPagePull(async (options) => {
    const stargazersResult = await octokit.activity.listStargazersForRepo({
      ...options,
      owner,
      repo,
    });

    return (stargazersResult.data as any).map(
      (s: { login: string }) => s.login
    ) as string[];
  });

  users.push(...stargazers);
  console.log(
    `Found ${stargazers.length} stargazers and ${
      users.length - userCount
    } additional users.`
  );
  userCount = users.length;

  // Watchers
  const watchers = await multiPagePull(async (options) => {
    const watchersResult = await octokit.activity.listWatchersForRepo({
      ...options,
      owner,
      repo,
    });

    return watchersResult.data.map((w) => w.login);
  });

  users.push(...watchers);
  users = _.uniq(users);
  console.log(
    `Found ${watchers.length} watchers and ${
      users.length - userCount
    } additional users.`
  );
  userCount = users.length;

  // Forks
  const forkOwners = await multiPagePull(async (options) => {
    const forksResult = await octokit.repos.listForks({
      ...options,
      owner,
      repo,
    });

    return forksResult.data.map((w) => w.owner.login);
  });
  const uniqueForkOwners = _.uniq(forkOwners);

  users.push(...uniqueForkOwners);
  users = _.uniq(users);
  console.log(
    `Found ${uniqueForkOwners.length} fork owners and ${
      users.length - userCount
    } additional users.`
  );
  userCount = users.length;

  // Issues reporters and assignees
  const issueUsers = await multiPagePull(async (options) => {
    const forksResult = await octokit.issues.listForRepo({
      ...options,
      owner,
      repo,
    });

    return forksResult.data.map((w) => ({
      reporter: w.user.login,
      assignees: w.assignees.map((a) => a.login),
    }));
  });
  const uniqueIssueReporters = _.uniq(issueUsers.map((i) => i.reporter));
  const uniqueIssueAssignees = _.uniq(
    _.flattenDeep(issueUsers.map((i) => i.assignees))
  );

  users.push(...uniqueIssueReporters);
  users = _.uniq(users);
  console.log(
    `Found ${uniqueIssueReporters.length} issue reporters and ${
      users.length - userCount
    } additional users.`
  );
  userCount = users.length;

  users.push(...uniqueIssueAssignees);
  users = _.uniq(users);
  console.log(
    `Found ${uniqueIssueAssignees.length} issue assignees and ${
      users.length - userCount
    } additional users.`
  );
  userCount = users.length;

  // Issues commenters
  const issueCommenters = await multiPagePull(async (options) => {
    const commentsResult = await octokit.issues.listCommentsForRepo({
      ...options,
      owner,
      repo,
    });

    return commentsResult.data.map((c) => c.user.login);
  });
  const uniqueIssueCommenters = _.uniq(issueCommenters);

  users.push(...uniqueIssueCommenters);
  users = _.uniq(users);
  console.log(
    `Found ${uniqueIssueCommenters.length} issue commenters and ${
      users.length - userCount
    } additional users.`
  );
  userCount = users.length;

  return {
    users,
    stargazers,
    watchers,
    forkOwners: uniqueForkOwners,
    issueAssignees: uniqueIssueAssignees,
    issueCommenters: uniqueIssueCommenters,
    issueReporters: uniqueIssueReporters,
  };
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

        const extraEmails = _.uniq(
          (_.flattenDeep(
            pushEvents.map((e: any) =>
              e.payload.commits.map((c: any) => c.author.email)
            )
          ) as string[]).filter((x) => !x.includes("noreply"))
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

const toCSV = ({
  owner,
  repo,
  userInfos,
  forkOwners,
  issueAssignees,
  issueCommenters,
  issueReporters,
  stargazers,
  watchers,
}: {
  owner: string;
  repo: string;
  userInfos: { login: string; name: string; emails: string[] }[];
  forkOwners: string[];
  issueAssignees: string[];
  issueCommenters: string[];
  issueReporters: string[];
  stargazers: string[];
  watchers: string[];
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
    "stargazer",
    "watcher",
    "forkOwner",
    "issueAssignee",
    "issueReporter",
    "issueCommenter",
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
        stargazers.includes(u.login),
        watchers.includes(u.login),
        forkOwners.includes(u.login),
        issueAssignees.includes(u.login),
        issueReporters.includes(u.login),
        issueCommenters.includes(u.login),
      ].join(", ")
    )
    .join(`\n`);

  return `${headers}\n${content}`;
};

const extract = async (argv: {
  clientId: string;
  clientSecret: string;
  repo: string;
}) => {
  const octokit = createOctokit(argv);
  const [owner, repo] = argv.repo.split("/");

  const {
    users,
    forkOwners,
    issueAssignees,
    issueCommenters,
    issueReporters,
    stargazers,
    watchers,
  } = await extractUsers({ ...argv, octokit, owner, repo });

  const allUsers = users.concat([owner]);
  console.log(`Found ${allUsers.length} total users. Fetching user infos...`);

  const userInfos = await getUserInfos({
    octokit,
    users: allUsers,
  });

  console.log(
    `Found ${userInfos.filter((u) => u.emails.length > 0).length} emails.`
  );

  const csv = toCSV({
    owner,
    repo,
    userInfos,
    forkOwners,
    issueAssignees,
    issueCommenters,
    issueReporters,
    stargazers,
    watchers,
  });
  const filePath = path.join(process.cwd(), `${owner}-${repo}.csv`);
  fs.writeFileSync(filePath, csv);

  console.log(`Exported results to ${filePath}.`);
};

yargs
  .scriptName("github-email-extractor")
  .usage("$0 <cmd> [args]")
  .option("clientId", {
    description: "Github app client id",
    type: "string",
  })
  .option("clientSecret", {
    description: "Github app client secret",
    type: "string",
  })
  .command("status", "Get Github rate limit status", () => {}, status)
  .command(
    "extract",
    "Extract emails from a github repo",
    (yargs) => {
      yargs.option("repo", {
        demandOption: true,
        type: "string",
        description: "Repository to extract emails from",
      });
    },
    extract
  )
  .demandCommand(1, "")
  .help().argv;
