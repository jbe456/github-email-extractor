import { createOctokit } from "./utils";
import { printStatus } from "./logging";

export const status = async (options: {
  clientId: string;
  clientSecret: string;
}) => {
  const octokit = createOctokit(options);
  const rateLimit = await octokit.rateLimit.get();

  printStatus(rateLimit);
};
