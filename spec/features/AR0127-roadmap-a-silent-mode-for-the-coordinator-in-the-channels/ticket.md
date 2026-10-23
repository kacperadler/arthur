# AR0127 - Roadmap: a silent mode for the coordinator in the channels

```json
{
  "id": "AR0127",
  "title": "Roadmap: a silent mode for the coordinator in the channels",
  "date": "2026-10-18"
}
```

## Description

The owner wants to delegate a stretch of work and be notified only when it is done, its stop condition is met, or a decision is needed. The roadmap has quiet hours (entry 7) but no silent mode the owner turns on.

## Goal

The plan for the telegram plugin (entry 47 or 48) includes a silent mode before it is built.

- Kind: feat


## Done means

- `spec/roadmap.md`: entry 48 (or 47, whichever owns sending) gains a silent mode. `/silent` toggles it and answers with the new state (`silent: on` or `silent: off, <summary of what happened meanwhile>`); it also turns on by itself when the owner delegates work with a stop condition, and off when that work ends. The state is stored under the home folder and survives a restart. While on, the coordinator sends nothing on its own wakes (job ends, reviews, schedule entries) except one message when the work is done, its stop condition is met (a limit reached), or the owner must decide; a message from the owner gets an answer to that message only. Edge cases: a job blocked on the owner is a decision and is sent; quiet hours still send without a sound; the coordinator's role says what counts as done, met, or a decision.
- The same change in every place the plan shows: `spec/vision.md` (the telegram plugin's row and the channels bullet), the README (feature table, telegram row), `docs/setup.md` if it lists the phone commands, `arthur.config.example.ts` if an option is added, and `arthur.mmd` with its README copy if a box changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- `spec/roadmap.md`, `spec/vision.md`, `README.md`, and any doc that lists the phone commands.

Out:
- Any code: the telegram plugin is not built yet.

## Decisions

- 2026-10-18: The owner asked for a silent mode for the coordinator and for Arthur; proposed by the coordinator.
- 2026-10-18: The owner: silent mode only in Arthur, and not switched by commands such as /quiet and /loud; it follows from who started the turn.
- 2026-10-18: The owner: one command, `/silent`, which toggles (Telegram allows no hyphen, so no `/non-silent`); it also turns on by itself with delegated work that has a stop condition; while on, nothing but the end, the stop condition, a decision, or the answer to his own question.
- 2026-10-18: The owner: `/silent` it is; update the roadmap, the vision, the docs and the README with it.
- 2026-10-18: Coordinator (owner delegated Arthur calls): the four choices accepted: wake-up replies go to every channel; the mechanism lives in orchestration (call coordinator.silent), Discord follows it; arthur silent on/off/ask for the coordinator; a broken state file counts as on.
