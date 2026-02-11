# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | Yes                |
| < 1.0   | No                 |

## Reporting a Vulnerability

We take security issues seriously. If you discover a vulnerability in replicant-mcp, please report it responsibly.

### Preferred: GitHub Security Advisories

Use [GitHub Security Advisories](https://github.com/thecombatwombat/replicant-mcp/security/advisories/new) to report vulnerabilities privately. This is the fastest way to reach us and keeps the report confidential until a fix is available.

### Alternative: Email

If you cannot use GitHub Security Advisories, email the maintainers directly at the address listed in the repository's package.json.

### What to Include

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- The version(s) of replicant-mcp affected
- Any suggested fix, if you have one

## Response Timeline

| Step                    | Target    |
| ----------------------- | --------- |
| Acknowledge report      | 72 hours  |
| Initial assessment      | 1 week    |
| Fix available           | 30 days   |
| Public disclosure       | After fix |

We will coordinate disclosure timing with the reporter. If a fix takes longer than 30 days, we will provide status updates.

## Scope

The following areas are in scope for security reports:

- **Command injection** via adb-shell tool input (see [adb-shell safety model](docs/security.md))
- **MCP protocol abuse** that could bypass tool safety guards or escalate access
- **Data exposure** through `.replicant/` cache artifacts (screenshots, logs, build output)
- **Dependency vulnerabilities** in replicant-mcp's direct dependencies

## Out of Scope

The following are not considered replicant-mcp vulnerabilities:

- Vulnerabilities in Android OS itself
- Vulnerabilities in adb or the Android SDK
- Vulnerabilities in apps installed on connected devices
- Issues requiring physical access to the host machine
- Social engineering attacks against users

## Disclosure Policy

- We follow coordinated disclosure. Please do not publicly disclose vulnerabilities before a fix is available.
- We will credit reporters in the release notes unless they prefer to remain anonymous.
- We will publish a security advisory on GitHub once a fix is released.
