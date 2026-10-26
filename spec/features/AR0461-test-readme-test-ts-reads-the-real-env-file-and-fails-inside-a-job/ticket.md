# AR0461 - test/readme.test.ts reads the real env file, and fails inside a job

```json
{
  "id": "AR0461",
  "title": "test/readme.test.ts reads the real env file, and fails inside a job",
  "date": "2026-10-26"
}
```

## Description

F1 of AR0460 (spec/features/AR0460-a-plugins-page-on-the-site-with-a-page-for-each-plugin/findings.md).

- Kind: test
- Found by: 2026-10-26-worker-b6154019 (worker), 2026-10-26
- Where: `test/readme.test.ts:24-28`
- What: the status-line test runs `arthur config check` with `XDG_CONFIG_HOME` passed through from the caller, so without it set the CLI reads the production env file, `~/.config/arthur/.env`. Inside a job the sandbox denies that file, and the test fails with exit 1 and `/home/kacper/.config/arthur/.env: cannot be read (EACCES)` on stdout, whatever the branch changed. Reproduced: `node --test test/readme.test.ts` in this job fails; `XDG_CONFIG_HOME=<a temporary folder> node --test test/readme.test.ts` passes.
- Suggestion: give the spawned CLI its own `XDG_CONFIG_HOME` under the test's temporary folder in place of the caller's, so the test never touches the owner's env file. Nothing else in the test changes.

## Goal

`test/readme.test.ts:28` runs `arthur config check` with the caller's `XDG_CONFIG_HOME`; without it set, the CLI reads the owner's env file. Inside a job the sandbox hides that file, so the test fails in every job whatever the branch changed (seen by the AR0460 worker; `XDG_CONFIG_HOME=<a temporary folder>` makes it pass).

- Kind: test

## Done means

- The test gives the CLI its own `XDG_CONFIG_HOME` under its temporary folder, never the caller's, so it never reads the owner's env file.
- `node --test test/readme.test.ts` passes inside a job and on the host; it still fails when the README's config example stops passing `config check` (checked once by breaking it).
- The ticket's checks pass.

## Scope

In:
- `test/readme.test.ts`.

Out:
- Any other test.

## Decisions

- 2026-10-26: Source: F1 of AR0460
- 2026-10-26: Merge a ticket once its review passed, without asking the owner (AR-D73); the owner: "If there is something that you can merge, just merge, do not ask me abut it" (AR-D93)
