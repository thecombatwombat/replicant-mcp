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
  private readonly maxTimeoutMs = 600_000;

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

    this.validateShellPayload(command, args);
  }

  private validateShellPayload(command: string, args: string[]): void {
    // Only validate shell payloads for adb commands
    const basename = command.split("/").pop() ?? command;
    if (basename !== "adb") return;
    const shellIndex = args.indexOf("shell");
    if (shellIndex === -1 || shellIndex >= args.length - 1) return;

    let payloadArgs = args.slice(shellIndex + 1);
    // Strip leading "--" (end-of-options marker)
    if (payloadArgs[0] === "--") {
      payloadArgs = payloadArgs.slice(1);
    }

    const shellPayload = payloadArgs.join(" ").trim();
    if (!shellPayload) return;

    // CU-2 (THE-106): argv-aware metacharacter check. Each arg is scanned
    // individually for shell composition patterns. This is a TIGHTENING of the
    // previous joined-string check, which over-blocked any URL or quoted
    // string containing a literal `&`, `|`, etc. — even though execa never
    // hands the joined string to a shell. The contract is: a single arg may
    // contain literal `&`/`|` as data (URL query strings, content), but no
    // arg may START with a chain operator or contain unbalanced shell
    // structure that would let a payload split into multiple commands if it
    // were ever passed through `sh -c`.
    for (const arg of payloadArgs) {
      this.validateArgForShellComposition(arg);
    }

    // Block shell wrapper commands (sh -c, bash -c)
    if (/^(sh|bash|dash|zsh)\s+-c\b/.test(shellPayload)) {
      throw new ReplicantError(
        ErrorCode.COMMAND_BLOCKED,
        "Shell interpreters with -c are not allowed",
        "Run the command directly without a shell wrapper"
      );
    }

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

  // Per-arg composition check (CU-2 / THE-106).
  //
  // The OLD guard joined every payload arg with spaces and ran a single regex
  // against the result. That caught real chains (`ls; rm`) but also blocked
  // any single arg containing `&`, `|`, `(`, etc. as DATA — e.g.
  // `am start ... -d "https://example.com/?foo=bar&baz=qux"`. URLs with
  // multi-key query strings, JSON extras, etc. became un-passable.
  //
  // The NEW guard runs per-arg via SHELL_COMPOSITION_PATTERNS, looking for
  // patterns that only make sense as composition (not as data inside a
  // token). Bare `$` followed by a digit and embedded `&` inside a longer
  // token are PERMITTED — the typed-intent path needs the latter.
  private validateArgForShellComposition(arg: string): void {
    if (arg.trim() === "") return;
    for (const { pattern, description: _description } of SHELL_COMPOSITION_PATTERNS) {
      if (pattern.test(arg)) {
        throw new ReplicantError(
          ErrorCode.COMMAND_BLOCKED,
          "Shell metacharacters are not allowed in shell commands",
          "Use simple commands without chaining, pipes, or substitution",
        );
      }
    }
  }
}

// Each entry documents the shell-composition shape it catches. The matchers
// are deliberately conservative — embedded `&` and `|` (no whitespace, not
// at start) flow through because URLs and content data legitimately use
// those characters.
const SHELL_COMPOSITION_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  description: string;
}> = [
  // Command substitution — always composition, never data we want to pass.
  { pattern: /`/, description: "backtick command substitution" },
  { pattern: /\$\(/, description: "$() command substitution" },
  // Variable expansion: ${VAR} or $IDENT (letter/underscore-led).
  // $123 is allowed (common in text input like `$100`).
  { pattern: /\$\{/, description: "${VAR} expansion" },
  { pattern: /\$[a-zA-Z_]/, description: "$IDENT expansion" },
  // Subshell wrapper.
  { pattern: /^\(.*\)$/, description: "parenthesised subshell" },
  // Chain operator at the START of an arg (or the arg IS the operator).
  { pattern: /^(&&|\|\||[;&|])/, description: "chain operator at start" },
  // `;` anywhere is composition (no legitimate adb data use).
  { pattern: /;/, description: "semicolon chain" },
  // `&&` / `||` anywhere is composition.
  { pattern: /&&|\|\|/, description: "&& or || chain" },
  // Pipe with whitespace on either side: `cmd | other`. Glued `a|b` slips
  // through deliberately (regex/URL alternates).
  { pattern: /\s\|\s|\|\s|\s\|/, description: "pipe with whitespace" },
];
