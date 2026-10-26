# AR0450 - Polish the docs and make the README shorter

```json
{
  "id": "AR0450",
  "title": "Polish the docs and make the README shorter",
  "date": "2026-10-26"
}
```

## Description

The README is 355 lines (2026-10-26) and the owner finds it too long. It becomes a short front page a newcomer reads in a few minutes, and the detail it holds moves to the docs that already exist; the docs get one polishing pass so they stay current after the day's changes.

## Goal

Evidence: `wc -l README.md` gives 355; its sections are What Arthur is, What Arthur is not, Status, Features, Commands, Try it, Read more, What Arthur is built from, Licence. `docs/setup.md` (307 lines), `docs/plugin-api.md` (298), `docs/deploy.md` (65) and each command's page (`arthur <cmd> --help`) already hold the detail. Today's merges changed the env file's place (AR0339), the guard (AR0335), installs and merges in a scope (AR0373), outside text as data (AR0350), the provider-key warning (AR0439), the sandbox's process reads (AR0440) and `arthur take-main` (AR0441).

- Kind: docs

## Done means

- `README.md` is at most 120 lines: what Arthur is and is not, its status, a short feature list (one line each), how to try it, and links to the docs; the long command list and the parts that repeat `spec/vision.md` or the docs move there or go, with a link left behind.
- Every fact the README drops still lives in a doc it links to; no doc says the opposite of the code after today's merges (env file place, guard, scopes, outside text as data, provider-key warning, take-main).
- One pass over `docs/setup.md`, `docs/deploy.md`, `docs/plugin-api.md`: shorter sentences, no repeats, no stale names or paths; no behaviour changes and no source file changed.
- `test/readme.test.ts` and the other doc tests pass, updated only where they pin README text that moves (the README still names what they require); `npm run check` passes.

## Scope

In:
- `README.md`, `docs/setup.md`, `docs/deploy.md`, `docs/plugin-api.md`, and `test/readme.test.ts` where it pins moved text.

Out:
- `spec/vision.md` and `spec/roadmap.md` (the owner's), the roles, and the command pages under `packages/*/docs/` beyond a fix of a stale fact.

## Decisions
- 2026-10-26: AR0450 approved: shorten the README and polish the docs, after AR0441, AR0440, AR0443, AR0442, AR0449; the owner: "ok so after this 5 tasks, prepare a task for polishing the docs and readme and to make the readme chorter bcs right now is too long" (AR-D75)
- 2026-10-26: AR0450: short README with a small diagram (core and plugin groups, about 30 lines) on the front page, the full diagram by link; the owner: "AR-D87 3" (AR-D87)

