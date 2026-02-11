# adb-shell Safety Model

This document describes how replicant-mcp protects against dangerous commands executed through the `adb-shell` tool. The safety model is implemented in the process runner layer (`src/services/process-runner.ts`) and applies to all shell commands before they reach a connected device.

## Command Denylist

All commands are validated against two layers of blocked patterns before execution.

### Blocked Commands (Exact Match)

The following commands are blocked outright when they appear as the first token in a shell payload:

| Command    | Reason                    |
| ---------- | ------------------------- |
| `reboot`   | Reboots the device        |
| `shutdown` | Shuts down the device     |
| `halt`     | Halts the device          |
| `poweroff` | Powers off the device     |

### Blocked Shell Patterns (Regex Match)

Shell payloads are tested against patterns that catch destructive and privilege-escalating commands:

| Pattern                              | What it catches                                   |
| ------------------------------------ | ------------------------------------------------- |
| `rm -rf /` or `rm /`                 | Deleting the root filesystem                      |
| `rm` on system partitions            | Deleting `/system`, `/vendor`, `/oem`, `/product` |
| `su`                                 | Privilege escalation to root                      |
| `sudo`                               | Privilege escalation                              |
| `format`                             | Formatting storage                                |
| `setprop persist.*`                  | Persistent system property changes                |
| `dd`                                 | Raw disk operations                               |
| `mkfs`                               | Filesystem creation                               |
| `flash`                              | Flash operations                                  |
| `wipe`                               | Wiping data or cache partitions                   |
| `recovery`                           | Entering recovery mode                            |

When a blocked command is detected, a `ReplicantError` is thrown with error code `COMMAND_BLOCKED`. The error includes a suggestion to use safe commands only.

## Shell Metacharacter Prevention

Beyond the denylist, replicant-mcp blocks shell metacharacters that could be used to chain commands or perform substitutions:

- **Blocked characters**: `;`, `&`, `|`, `` ` ``, `(`, `)`
- **Blocked expansions**: `$VAR`, `$(cmd)`, `${var}` (variable and command substitution)
- **Allowed**: `$` followed by digits (e.g., `$100` in input text) is permitted since it does not trigger expansion

Shell wrapper commands (`sh -c`, `bash -c`, `dash -c`, `zsh -c`) are also blocked to prevent bypassing the denylist through an intermediate shell interpreter.

### Why Arrays, Not Strings

Commands are passed to the underlying process runner as arrays of arguments (via `execa`), not as shell strings. This means the OS receives each argument separately without shell interpretation. Even if a user crafts a payload like `ls; rm -rf /`, the semicolon is treated as a literal character in the argument, not as a command separator. The metacharacter regex check is an additional defense layer on top of this structural protection.

## Error Handling

All blocked commands produce the same error shape:

```json
{
  "error": "COMMAND_BLOCKED",
  "message": "Command '...' is not allowed",
  "suggestion": "Use safe commands only"
}
```

For shell metacharacters:

```json
{
  "error": "COMMAND_BLOCKED",
  "message": "Shell metacharacters are not allowed in shell commands",
  "suggestion": "Use simple commands without chaining, pipes, or substitution"
}
```

These errors are surfaced to the AI client through the standard MCP error response mechanism.

## Validation Flow

1. The `adb-shell` tool receives a command string from the MCP client.
2. The command is passed to `ProcessRunner.runAdb()`, which calls `validateCommand()`.
3. `validateCommand()` checks the command against exact-match blocked commands, then against general blocked patterns.
4. `validateShellPayload()` extracts the shell payload (everything after `adb shell`) and:
   - Blocks shell metacharacters
   - Blocks shell wrapper commands (`sh -c`, etc.)
   - Checks the first token against the blocked commands set
   - Tests the full payload against the blocked shell patterns
5. Only if all checks pass does the command execute.

This validation was strengthened in [PR #68](https://github.com/ABresting/replicant-mcp/pull/68), which added payload-level validation for shell commands to close a gap where previously only top-level command validation was performed.

## Threat Boundaries

### What replicant-mcp protects against

- Accidental destructive commands from AI agents (e.g., an LLM generating `rm -rf /`)
- Command chaining attempts via shell metacharacters
- Privilege escalation through `su`/`sudo`
- System partition modification
- Device state changes (reboot, wipe, flash)

### What is out of scope

- **Malicious MCP clients**: If the MCP client itself is compromised, it could bypass the tool layer entirely. Replicant trusts the MCP transport.
- **On-device security**: Replicant does not enforce Android permissions or SELinux policies. A command like `cat /sdcard/private-file.txt` will succeed if the adb user has access.
- **Network-level attacks**: Replicant does not encrypt or authenticate the adb connection. USB debugging and ADB over TCP security are the user's responsibility.
- **Exhaustive coverage**: The denylist is a best-effort safety net, not a sandbox. It blocks known-dangerous patterns but cannot anticipate every possible destructive command. Users should not rely on it as a sole security control.
