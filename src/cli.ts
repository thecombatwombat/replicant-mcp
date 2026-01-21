#!/usr/bin/env node
import { Command } from "commander";
import {
  createGradleCommand,
  createAdbCommand,
  createEmulatorCommand,
  createUiCommand,
  createCacheCommand,
} from "./cli/index.js";

const program = new Command();

program
  .name("replicant")
  .description("Android development CLI for Claude Code skills")
  .version("1.0.0");

program.addCommand(createGradleCommand());
program.addCommand(createAdbCommand());
program.addCommand(createEmulatorCommand());
program.addCommand(createUiCommand());
program.addCommand(createCacheCommand());

program.parse();
