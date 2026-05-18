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

  // Per-arg composition check (CU-2 / THE-106, follow-ups #2 and #3).
  //
  // The OLD guard joined every payload arg with spaces and ran a single
  // regex against the result. That caught real chains (`ls; rm`) but also
  // blocked any single arg containing `&`, `|`, `(`, etc. as DATA — e.g.
  // `am start ... -d "https://example.com/?foo=bar&baz=qux"`.
  //
  // Follow-up #2 added a quote-aware char walk for single `&` only,
  // while `&&`/`||`/`;`/pipe-with-whitespace stayed on raw regexes. That
  // split surface meant `'https://x/?a=1&&b=2'` (a legitimate quoted URL
  // emitted by `AdbAdapter.startIntent`) tripped the `&&` regex even though
  // the device shell sees the `&&` as literal data inside the single quotes
  // (Greptile P1 #1). The same scanner also mis-walked the POSIX
  // close-escape-reopen pattern `'\''` (emitted by `quoteForDeviceShell`
  // for embedded apostrophes), leaving the chars after the escape outside
  // any quote span (Greptile P1 #2).
  //
  // Follow-up #3 unifies everything into ONE character walk in
  // `scanArgForComposition`. Two cheap whole-arg pre-checks remain as
  // regexes (`^(.*)$` subshell wrapper and the chain-operator-at-start
  // shape `^(&&|\|\||[;&|])`); every other composition check lives in the
  // scanner so quote and POSIX-escape state stay consistent.
  private validateArgForShellComposition(arg: string): void {
    if (arg.trim() === "") return;
    if (SUBSHELL_WRAPPER.test(arg)) {
      throwShellMetacharError();
    }
    if (CHAIN_AT_START.test(arg)) {
      throwShellMetacharError();
    }
    scanArgForComposition(arg);
  }
}

function throwShellMetacharError(): never {
  throw new ReplicantError(
    ErrorCode.COMMAND_BLOCKED,
    "Shell metacharacters are not allowed in shell commands",
    "Use simple commands without chaining, pipes, or substitution",
  );
}

// Whole-arg pre-checks (cheap, regex-friendly shapes).
const SUBSHELL_WRAPPER = /^\(.*\)$/;
const CHAIN_AT_START = /^(&&|\|\||[;&|])/;

// Single source of truth for "is this character a composition operator
// outside a quoted span?". One walk, one quote+escape state machine.
//
// Quote rules (mirroring /bin/sh):
//   - Single quotes are literal; nothing escapes inside them. A `'` always
//     closes the span — `quoteForDeviceShell` relies on this and emits
//     `'\''` (close, escaped `'`, reopen) for embedded apostrophes. The
//     scanner therefore handles the backslash AFTER the close-quote, before
//     the reopen — at which point we're outside any quote span and the
//     POSIX-escape rule (advance past the next char) covers it.
//   - Double quotes allow `\` to escape; we don't try to be exhaustive
//     about which chars `\` escapes inside `"..."` because none of the
//     composition operators we check do anything special there anyway.
//
// Composition rules (only enforced OUTSIDE both quote spans):
//   - backtick, `$(`, `${`, `$IDENT` (letter/underscore)
//   - `&&` / `||` (rejected on the first char so the second isn't
//     double-processed)
//   - `;`
//   - bare `&` (not part of `&&`)
//   - `|` with whitespace neighbour (glued `a|b` allowed — matches the
//     pre-#3 loose contract and Greptile didn't flag it)
//   - POSIX escape: `\` advances past the next char so `\&` etc. don't
//     fire. Crucial for `quoteForDeviceShell`'s `'\''` pattern, which is
//     read as: close-quote, escape-`'`, then a fresh open-quote starts.
function scanArgForComposition(arg: string): void {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < arg.length; i++) {
    const ch = arg[i];
    if (!inSingle && !inDouble && ch === "\\") {
      i++;
      continue;
    }
    if (!inDouble && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (inSingle || inDouble) continue;
    if (ch === "`") throwShellMetacharError();
    if (ch === "$") {
      const next = arg[i + 1];
      if (next === "(" || next === "{") throwShellMetacharError();
      if (next !== undefined && /[a-zA-Z_]/.test(next)) throwShellMetacharError();
      continue;
    }
    if (ch === ";") throwShellMetacharError();
    if (ch === "&") {
      // `&&` is composition; throw on the FIRST `&` so the loop doesn't
      // double-process the pair. A bare `&` (any neighbour, including
      // letters/digits as in `cmd&PWNED`) is also composition — `/bin/sh`
      // treats `&` as a control operator regardless of context.
      throwShellMetacharError();
    }
    if (ch === "|") {
      // `||` chain — also caught here on the first `|`.
      if (arg[i + 1] === "|") throwShellMetacharError();
      // `cmd | other` — pipe with whitespace neighbour. Glued `a|b` is
      // allowed (URL alternates, regex literals).
      const prev = arg[i - 1];
      const next = arg[i + 1];
      if (
        (prev !== undefined && /\s/.test(prev)) ||
        (next !== undefined && /\s/.test(next))
      ) {
        throwShellMetacharError();
      }
    }
  }
}
