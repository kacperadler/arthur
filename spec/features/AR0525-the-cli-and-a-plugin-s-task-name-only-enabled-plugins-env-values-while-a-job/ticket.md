# AR0525 - The CLI and a plugin's task name only enabled plugins' env values, while a job names every value in the env file

```json
{
  "id": "AR0525",
  "title": "The CLI and a plugin's task name only enabled plugins' env values, while a job names every value in the env file",
  "date": "2026-10-27"
}
```

## Description

F5 of AR0518 (spec/features/AR0518-a-token-from-the-env-file-never-appears-in-a-job-record-log-error-or-channel/findings.md). The loading process builds its namer from the `...Env` variables of enabled plugins only, so a value in the env file that belongs to a disabled plugin or no plugin is named in a job's own log but printed raw by the CLI or a plugin's task (reviews 1, 2, 4 and 5 of AR0518).

## Goal

Every process Arthur runs names the same set of values: every value in the env file, as the job's wrapper does. Evidence: `packages/core/src/host.ts:44` builds `hide` from enabled plugins' variables; the wrapper's `envFileNames` reads the whole file.

- Kind: security

## Done means

- A value set in the env file under a name no enabled plugin reads never appears raw in the CLI's output or a task's error; a test sets one and checks.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/host.ts`, `packages/core/src/secret-names.ts`, their tests.

Out:
- Values set only in the shell, not the env file: unchanged.

## Decisions

- 2026-10-27: Source: F5 of AR0518
