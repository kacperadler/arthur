# AR0046 - Roadmap: arthur doctor checks what Arthur needs at every start

```json
{
  "id": "AR0046",
  "title": "Roadmap: arthur doctor checks what Arthur needs at every start",
  "date": "2026-10-16"
}
```

## Description

A new roadmap entry, `arthur doctor`: code, not the agent, checks that everything Arthur needs to run as intended is in place, and the first message after every start lists what is missing, what it costs and how to fix it. Docs only; the entry is built later.

## Goal

After download and install, and after every restart, the owner learns at once what is missing for full function, from a deterministic check rather than the model's judgment.

- Kind: feat

## Done means

- `spec/roadmap.md`: a new entry after 38 (numbered so that entries 1 to 79 keep their numbers: the next free number after 79, placed in the Session section, with Depends on naming 38 and the plugin host), in the existing entry shape. It delivers:
  - `collect("doctor")`: each plugin provides its requirements as `{ name, check(): ok | missing reason, costs: what does not work without it, fix: one command or step, critical?: boolean }`. Examples to list: core (git, Node version, the agent binary `omp`, writable home), session (the systemd user service installed, enabled, `Restart=always`, linger on), telegram (token present, bot reachable), media (ffmpeg, for videos the human sends), docker (docker reachable, on machines labelled `tools: docker`), machines (SSH to each machine, its labels' tools), resources (the disk floor).
  - `arthur doctor`: one line per requirement, `ok` or `missing: <reason>; without it: <costs>; fix: <fix>`; exit 1 when anything critical is missing. It runs no model.
  - At every `arthur run` start, doctor runs before the LLM probe (38); missing lines go first in the start notice. A critical miss (no git, no agent binary, home not writable) refuses the start with those lines; anything else starts with reduced function.
  - Edge cases: a check that throws costs its line only, named; a check that hangs is cut after a timeout; a plugin disabled in the config is not checked; the same missing line is not sent again at each start within a day unless it changed.
- The coverage table and `docs/deploy.md` mention `arthur doctor` as the step after install.
- `npm test` and `npm run check` pass. English only.

## Scope

In:
- `spec/roadmap.md`, `docs/deploy.md`.

Out:
- Code.

## Decisions

- 2026-10-16: The owner asked for it: a check by code, not by the agent, of everything Arthur needs (installed tools, the systemd service that comes back after a reboot, ffmpeg for videos), shown to the user first when something is missing.
