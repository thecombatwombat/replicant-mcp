#!/usr/bin/env node
import { Command } from "commander";
import { createGradleCommand } from "./cli/gradle.js";
import { createAdbCommand } from "./cli/adb.js";

const program = new Command();

program
  .name("replicant")
  .description("Android development CLI for Claude Code skills")
  .version("1.0.0");

program.addCommand(createGradleCommand());
program.addCommand(createAdbCommand());

program.parse();
