import { createOctokit } from "./utils";

export const status = async (options: {
  clientId: string;
  clientSecret: string;
}) => {
  const octokit = createOctokit(options);
  const rateLimit = await octokit.rateLimit.get();

  const coreRemaining = rateLimit.data.resources.core.remaining;
  const coreLimit = rateLimit.data.resources.core.limit;

  const searchRemaining = rateLimit.data.resources.search.remaining;
  const searchLimit = rateLimit.data.resources.search.limit;

  console.log(`Core status: ${coreRemaining}/${coreLimit}`);
  console.log(`Search status: ${searchRemaining}/${searchLimit}`);
};
