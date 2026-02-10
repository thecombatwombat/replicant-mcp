import { execa, ExecaError } from "execa";
import { ReplicantError, ErrorCode } from "../types/index.js";
import type { EnvironmentService } from "./environment.js";

export interface RunOptions {
  timeoutMs?: number;
  cwd?: string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const BLOCKED_COMMANDS = new Set(["reboot", "shutdown", "halt", "poweroff"]);

const BLOCKED_PATTERNS = [
  /^rm\s+(-[rf]+\s+)*\//, // rm -rf /
  /^su(\s|$)/, // su
  /^sudo(\s|$)/, // sudo
  /\bformat\b/, // format commands
];

const BLOCKED_SHELL_PATTERNS = [
  /^rm\s+(-[rf]+\s+)*\/\s*$/, // rm -rf / (root itself)
  /^rm\s+(-[rf]+\s+)*\/(system|vendor|oem|product)(\/|\s|$)/, // rm on system partitions
  /^su(\s|$)/, // su
  /^sudo(\s|$)/, // sudo
  /\bformat\b/, // format commands
  /^setprop\s+persist\./, // persistent property changes
  /^dd\s/, // raw disk operations
  /^mkfs/, // filesystem creation
  /^flash/, // flash operations
  /^wipe/, // wipe data/cache
  /^recovery\b/, // recovery mode
  /^reboot\b/, // reboot device (also in BLOCKED_COMMANDS)
];

export class ProcessRunner {
  private readonly defaultTimeoutMs = 30_000;
  private readonly maxTimeoutMs = 120_000;

  constructor(private environment?: EnvironmentService) {}

  async run(
    command: string,
    args: string[],
    options: RunOptions = {}
  ): Promise<RunResult> {
    this.validateCommand(command, args);

    const timeoutMs = Math.min(
      options.timeoutMs ?? this.defaultTimeoutMs,
      this.maxTimeoutMs
    );

    try {
      const result = await execa(command, args, {
        timeout: timeoutMs,
        cwd: options.cwd,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode ?? 0,
      };
    } catch (error: unknown) {
      if (error instanceof ExecaError) {
        if (error.timedOut) {
          throw new ReplicantError(
            ErrorCode.TIMEOUT,
            `Command timed out after ${timeoutMs}ms`,
            "Try increasing the timeout or simplifying the command"
          );
        }
        return {
          stdout: (error.stdout ?? "") as string,
          stderr: (error.stderr ?? "") as string,
          exitCode: error.exitCode ?? 1,
        };
      }
      throw error;
    }
  }

  async runAdb(args: string[], options: RunOptions = {}): Promise<RunResult> {
    if (!this.environment) {
      // Fallback to bare "adb" if no environment service
      return this.run("adb", args, options);
    }

    const adbPath = await this.environment.getAdbPath();
    return this.run(adbPath, args, options);
  }

  async runEmulator(args: string[], options: RunOptions = {}): Promise<RunResult> {
    if (!this.environment) {
      return this.run("emulator", args, options);
    }

    const emulatorPath = await this.environment.getEmulatorPath();
    return this.run(emulatorPath, args, options);
  }

  async runAvdManager(args: string[], options: RunOptions = {}): Promise<RunResult> {
    if (!this.environment) {
      return this.run("avdmanager", args, options);
    }

    const avdManagerPath = await this.environment.getAvdManagerPath();
    return this.run(avdManagerPath, args, options);
  }

  private validateCommand(command: string, args: string[]): void {
    if (BLOCKED_COMMANDS.has(command)) {
      throw new ReplicantError(
        ErrorCode.COMMAND_BLOCKED,
        `Command '${command}' is not allowed`,
        "Use safe commands only"
      );
    }

    const fullCommand = `${command} ${args.join(" ")}`;
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(fullCommand)) {
        throw new ReplicantError(
          ErrorCode.COMMAND_BLOCKED,
          `Command '${fullCommand}' is not allowed`,
          "Use safe commands only"
        );
      }
    }

    this.validateShellPayload(args);
  }

  private validateShellPayload(args: string[]): void {
    const shellIndex = args.indexOf("shell");
    if (shellIndex === -1 || shellIndex >= args.length - 1) return;

    const shellPayload = args.slice(shellIndex + 1).join(" ").trim();
    if (!shellPayload) return;

    const shellCommand = shellPayload.split(/\s+/)[0];
    if (BLOCKED_COMMANDS.has(shellCommand)) {
      throw new ReplicantError(
        ErrorCode.COMMAND_BLOCKED,
        `Shell command '${shellPayload}' is not allowed`,
        "Use safe commands only"
      );
    }

    for (const pattern of BLOCKED_SHELL_PATTERNS) {
      if (pattern.test(shellPayload)) {
        throw new ReplicantError(
          ErrorCode.COMMAND_BLOCKED,
          `Shell command '${shellPayload}' is not allowed`,
          "Use safe commands only"
        );
      }
    }
  }
}
