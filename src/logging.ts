import { OctokitResponse, RateLimitGetResponseData } from "@octokit/types";
import Table from "cli-table";
import _ from "lodash";
import { RepoInfoAndExport } from "./utils";

export const printStatus = (
  rateLimit: OctokitResponse<RateLimitGetResponseData>
) => {
  const coreRemaining = rateLimit.data.resources.core.remaining;
  const coreLimit = rateLimit.data.resources.core.limit;

  const searchRemaining = rateLimit.data.resources.search.remaining;
  const searchLimit = rateLimit.data.resources.search.limit;

  console.log(`Core status: ${coreRemaining}/${coreLimit}`);
  console.log(`Search status: ${searchRemaining}/${searchLimit}`);
};

export const printReposToAnalyse = (reposToAnalyze: string[]) => {
  console.log("-----------------------------------------------");
  console.log(`Repositories to analyze                        `);
  console.log("-----------------------------------------------");
  console.log(reposToAnalyze.join(`\n`));
};

export const printExtractSummary = ({
  exportIntoOneFile,
  output,
  repoInfos,
}: {
  exportIntoOneFile: boolean;
  output: string;
  repoInfos: RepoInfoAndExport[];
}) => {
  console.log("-----------------------------------------------");
  console.log("                    SUMMARY                    ");
  console.log("-----------------------------------------------");

  if (exportIntoOneFile) {
    console.log(`Results exported to ${output}`);
  }

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
