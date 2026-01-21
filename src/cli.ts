#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("replicant")
  .description("Android development CLI for Claude Code skills")
  .version("1.0.0");

// Subcommands will be added in subsequent tasks
program.parse();
