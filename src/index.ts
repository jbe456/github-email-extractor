#!/usr/bin/env node
import yargs from "yargs";
import { status } from "./status";
import { extract } from "./extract";

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
