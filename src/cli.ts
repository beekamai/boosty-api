#!/usr/bin/env node
/* Entry point of the `boosty-api` command; the logic lives in cli/run.ts. */
import { runCli } from "./cli/run";

runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
});
