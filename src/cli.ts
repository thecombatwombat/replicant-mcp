#!/usr/bin/env node
import { Command } from "commander";
import {
  createGradleCommand,
  createAdbCommand,
  createEmulatorCommand,
  createUiCommand,
  createCacheCommand,
  createDoctorCommand,
} from "./cli/index.js";
import { VERSION } from "./version.js";

const program = new Command();

program
  .name("replicant-mcp")
  .description("Android development CLI")
  .version(VERSION);

program.addCommand(createGradleCommand());
program.addCommand(createAdbCommand());
program.addCommand(createEmulatorCommand());
program.addCommand(createUiCommand());
program.addCommand(createCacheCommand());
program.addCommand(createDoctorCommand());

program.parse();
