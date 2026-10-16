# AR0002 - Roadmap: job state, several machines, and resource-based limits

```json
{
  "id": "AR0002",
  "title": "Roadmap: job state, several machines, and resource-based limits",
  "date": "2026-10-16",
  "after": [
    "AR0001"
  ]
}
```

## Description

Add three capabilities the owner asked for to `spec/vision.md`, the diagrams and `spec/roadmap.md`, as features with their own tickets in the right place of the order.

## Goal

The owner (2026-10-16), after looking at herdr.dev:

1. A clear state for every job: working, blocked (waiting on the user or a dependency), idle, ended; shown by the coordinator and the channels.
2. Several machines: Arthur runs on one machine and starts work on others reachable over SSH on a private network (Tailscale), e.g. Linux for most jobs and a Mac for what needs macOS (a macOS CI run, iOS builds). Each machine has labels (os, arch, tools); a project or a ticket can require a label, and the coordinator places the job on a machine that has it. Nothing is exposed to the internet.
3. Resources: a plugin that caps what one agent job, or one feature (a ticket's jobs together), may use (CPU, memory, time, money), and in the end lets the coordinator decide how many jobs to run from the free resources of each machine instead of a fixed `maxAgents`, which stays as an upper bound.

- Kind: feature

## Done means

- `spec/vision.md` describes the three, with their plugin or core home and the interface each exposes; `docs/architecture/core-and-plugins.mmd` shows them; the example config shows their options (machines with labels and SSH host names, resource caps per job and per feature).
- `spec/roadmap.md` has the tickets for them, each half a day to a day of work, with edge cases to test (a machine offline mid-job, a label no machine has, SSH key refused, a job that exceeds its cap, free resources too low to start anything), placed after the job runner and before or with orchestration as their dependencies require.
- English only. No feature code.

## Scope

In:
- `spec/vision.md`, `docs/architecture/*.mmd`, `arthur.config.example.ts`, `spec/roadmap.md`.

Out:
- Implementing them (their own tickets).

## Decisions

- 2026-10-16: The owner asked for job state, several machines over SSH/Tailscale with work placed by OS, and a resources plugin leading to resource-based concurrency.
- 2026-10-16: Coordinator on F1 (macOS-only checks at merge): `arthur merge` runs a project's checks on a machine that has the project's required labels, not only on local; with no such machine online, the merge waits and says so. CI stays a second signal. Goes into roadmap entry 54 (`arthur merge`, after the AR0002 renumbering) when the tickets are cut.
