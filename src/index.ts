#!/usr/bin/env node
import yargs from "yargs";
import { status } from "./status";
import { extract } from "./extract";

yargs
  .scriptName("gee")
  .usage(
    [
      "Extract Github user emails and names from a specific repository.\n",
      "Example:",
      "$0 status",
      "$0 status --clientId XX --clientSecret YY",
      "$0 extract --clientId XX --clientSecret YY --repo jbe456/github-email-extractor",
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
