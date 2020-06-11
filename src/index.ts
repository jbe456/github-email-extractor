#!/usr/bin/env node
import yargs from "yargs";
import { status } from "./status";
import { extract } from "./extract";

yargs
  .scriptName("gee")
  .usage(
    [
      "Extract Github user emails and names from one or multiple repositories.\n",
      "Usage:",
      "  # Get default Github rate limit status",
      "  $0 status",
      "  # Get authenticated Github rate limit status",
      "  $0 status --clientId XX --clientSecret YY",
      "  # Extract user names & emails from ownerA/repoA",
      "  $0 extract --clientId XX --clientSecret YY --repos ownerA/repoA",
      "  # Extract user names & emails from ownerA/repoA & ownerB/repoB",
      "  # and export results into folder 'ZZ'",
      "  $0 extract --clientId XX --clientSecret YY --repos ownerA/repoA ownerB/repoB --output ZZ",
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
    "Extract emails from one or multiple github repos",
    (yargs) => {
      yargs
        .check(function (argv) {
          if ((argv.repos && !argv.query) || (!argv.repos && argv.query)) {
            return true;
          } else {
            throw new Error(
              "Error: pass at least one of 'repos' or 'query' options but not both."
            );
          }
        })
        .option("repos", {
          type: "array",
          description:
            "A list of space-separated repositories to extract emails from",
        })
        .option("query", {
          type: "string",
          description:
            "A Github search query to select repositories to extract emails from",
        })
        .option("output", {
          type: "string",
          description:
            "Destination folder where CSV results are exported, relative or absolute path",
        })
        .option("maxEmails", {
          type: "number",
          default: 2,
          description: "Maximum number of emails to extract per Github user.",
        })
        .option("cacheExpiry", {
          type: "number",
          default: 31,
          description: "Number of days before cache entities expire.",
        })
        .option("cachePath", {
          type: "number",
          default: "gee-cache",
          description: "Path to the cache folder.",
        });
    },
    extract
  )
  .demandCommand(1, "")
  .help().argv;
