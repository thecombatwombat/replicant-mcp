# Wireless ADB Roadmap

Five-stage rollout of wireless ADB support for `replicant-mcp`. The end goal is unattended, network-resilient Android device control — a phone can be left at home (powered, unlocked) and remain reliably accessible to an agent without human intervention through Wi-Fi blips, DHCP renewals, deep-sleep cycles, and adb-server hiccups.

Stage 1 makes wireless ADB *work*. Stages 2-5 make it *survive*.

## Status

| Stage | Theme                                  | Status     | Plan |
|-------|----------------------------------------|------------|------|
| 1     | Foundations                            | Planned    | [STAGE-1-foundations.md](./STAGE-1-foundations.md) |
| 2     | On-demand recovery                     | Sketched   | [STAGE-2-on-demand-recovery.md](./STAGE-2-on-demand-recovery.md) |
| 3     | Endpoint persistence & smart discovery | Sketched   | [STAGE-3-endpoint-persistence.md](./STAGE-3-endpoint-persistence.md) |
| 4     | Background supervisor                  | Sketched   | [STAGE-4-background-supervisor.md](./STAGE-4-background-supervisor.md) |
| 5     | Observability                          | Sketched   | [STAGE-5-observability.md](./STAGE-5-observability.md) |

## Cross-cutting design principles

These hold for every stage. They are agent-first: the MCP consumer is always an AI agent, sometimes a small one.

1. **Try the fast, usually-works path first.** No defensive scanning before the first attempt.
2. **On failure, the server runs deterministic recovery.** The agent never decides how to recover.
3. **The agent never sees ADB.** Tool descriptions, errors, and `nextSteps` use domain terms (*device*, *address*, *pairing code*).
4. **Failure responses tell the agent exactly what to do.** Structured `nextSteps` mark steps as *required* or *suggestion*, with operation and ready-to-use arguments.
5. **One call, one decision.** Each operation does one job end-to-end; optional parameters that force the agent to think are minimised.

## Stage dependencies

```
Stage 1: Foundations
  ↓
Stage 2: On-demand recovery   (uses Stage 1's adapter primitives)
  ↓
Stage 3: Endpoint persistence (uses Stage 2's verify primitive)
  ↓
Stage 4: Background supervisor (uses Stage 3's persistent endpoints)
  ↓
Stage 5: Observability (cross-cuts; can be partial-built earlier)
```

Stage 5 (observability) can be built incrementally alongside any stage but is sketched separately so it doesn't get squeezed out.

## What's NOT here

- Linear backlog items — those live in Linear per `CLAUDE.md`.
- Detailed implementation plans for Stages 2-5 — those will be authored when each stage starts.
- The decision log — that lives in the repo's top-level `DECISIONS.md`.
