import { createOctokit } from "./utils";

export const status = async (options: {
  clientId: string;
  clientSecret: string;
}) => {
  const octokit = createOctokit(options);
  const rateLimit = await octokit.rateLimit.get();

  const remaining = rateLimit.data.resources.core.remaining;
  const limit = rateLimit.data.resources.core.limit;
  const resetTimestamp = rateLimit.data.resources.core.reset;

  console.log(`Status: ${remaining}/${limit}`);
  console.log(`Reset: ${new Date(resetTimestamp).toTimeString()}`);
};
