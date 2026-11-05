# AR0605 - arthur config check type-checks arthur.config.ts and every project file with tsc

```json
{
  "id": "AR0605",
  "title": "arthur config check type-checks arthur.config.ts and every project file with tsc",
  "date": "2026-11-02"
}
```

## Description

`arthur config check` (and the check at `arthur run`'s start) also runs `tsc` on `arthur.config.ts` and every project folder's `project.config.ts`, and prints every type error, so the owner learns all mistakes of a hand-edited project file at once, with file and line, not one plugin at a time.

## Goal

The owner asked, 2026-11-02, how he knows a project file he writes is correct. Today two layers exist, measured on `projects/landing.example/project.config.ts` the same day:

- Each plugin checks its piece at load: a misspelt key (`ulr`, `ap`) or a bad prefix (`K-A`) makes `arthur config check` exit 1 with the project, the helper and the key. But it stops at the first plugin that fails, so three mistakes take three runs.
- The helpers are typed (`DokployPiece`, uptime's `Site`): `tsc` on the file reports both misspelt keys at once (`TS2353 ... 'ulr' does not exist in type 'Site'`). But nothing runs it: the root `tsconfig.json` includes only `test/` and `packages/`, and `projects/` and `arthur.config.ts` are ignored by Git, so `npm run check` never sees them.

- Plan: yes

- Kind: feat

## Done means

- `arthur config check` reports every type error of `arthur.config.ts` and each listed project file, file:line and message, and exits 1 on any; a correct config still exits 0. A test with a project file holding two misspelt keys sees both in one run.
- No runtime dependency: `tsc` is the toolchain's dev dependency; where it is missing (an install without dev dependencies), the check says so in one line and goes on with the load checks.

## Scope

In:
- The config check command in the core, and its doc page; a test beside its tests. The plan names the files.

Out:
- Collecting every plugin's load error in one run, instead of the first: its own ticket if the plan finds it worth it.

## Decisions

- 2026-11-02: AR0605 approved: plan first, after Group 2; the owner: "arthur config check - ok" (AR-D459)
- 2026-11-05: Plan approved by the owner: plan.md at 76432365 (by its recommendations, AR-D500); the owner: "do not ask me about them; always go with the recommendation (AR-D500)" (AR-D506)
