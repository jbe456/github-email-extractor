#!/usr/bin/env node
import yargs from "yargs";
import { status } from "./status";
import { extract } from "./extract";

yargs
  .scriptName("gee")
  .usage(
    [
      "Extract Github user emails and names from a specific repository.\n",
      "Usage:",
      "# Get Github rate limit status",
      "> $0 status",
      "# Get Github rate limit status while authenticated",
      "> $0 status --clientId XX --clientSecret YY",
      "# Extract user names & emails from jbe456/github-email-extractor",
      "> $0 extract --clientId XX --clientSecret YY --repo jbe456/github-email-extractor",
      "# Extract user names & emails from jbe456/github-email-extractor and export results into folder 'ZZ'",
      "> $0 extract --clientId XX --clientSecret YY --repo jbe456/github-email-extractor --output ZZ",
    ].join("\n")
  )
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
      yargs
        .option("repo", {
          demandOption: true,
          type: "string",
          description: "Repository to extract emails from",
        })
        .option("output", {
          type: "string",
          description:
            "Destination folder where CSV results are exported, relative or absolute path",
        });
    },
    extract
  )
  .demandCommand(1, "")
  .help().argv;
