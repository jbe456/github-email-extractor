import { OctokitResponse, RateLimitGetResponseData } from "@octokit/types";
import Table from "cli-table";
import _ from "lodash";
import { utcToTimeString, RepoInfo } from "./utils";

export const printStatus = (
  rateLimit: OctokitResponse<RateLimitGetResponseData>
) => {
  const coreRemaining = rateLimit.data.resources.core.remaining;
  const coreLimit = rateLimit.data.resources.core.limit;
  const coreReset = rateLimit.data.resources.core.reset;

  const searchRemaining = rateLimit.data.resources.search.remaining;
  const searchLimit = rateLimit.data.resources.search.limit;
  const searchReset = rateLimit.data.resources.search.reset;

  console.log(
    `Core status: ${coreRemaining}/${coreLimit} - ${utcToTimeString(coreReset)}`
  );
  console.log(
    `Search status: ${searchRemaining}/${searchLimit} - ${utcToTimeString(
      searchReset
    )}`
  );
};

export const printReposToAnalyse = (reposToAnalyze: string[]) => {
  console.log("-----------------------------------------------");
  console.log(`Repositories to analyze                        `);
  console.log("-----------------------------------------------");
  console.log(reposToAnalyze.join(`\n`));
};

export const printExtractSummary = ({
  filePath,
  repoInfos,
}: {
  filePath: string;
  repoInfos: RepoInfo[];
}) => {
  console.log("-----------------------------------------------");
  console.log("                    SUMMARY                    ");
  console.log("-----------------------------------------------");

  console.log(`Results exported to ${filePath}`);

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
