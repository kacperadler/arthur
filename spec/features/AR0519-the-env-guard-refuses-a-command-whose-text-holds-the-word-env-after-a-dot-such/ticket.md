# AR0519 - The env guard refuses a command whose text holds the word env after a dot, such as a regex on Node's environment object

```json
{
  "id": "AR0519",
  "title": "The env guard refuses a command whose text holds the word env after a dot, such as a regex on Node's environment object",
  "date": "2026-10-27"
}
```

## Description

F7 of AR0516 (spec/features/AR0516-since-ar0508-hides-ssh-a-job-and-a-merge-step-cannot-sign-a-commit-when-git/findings.md). The env guard reads the text `env` after a dot as the secrets file's name, so a command that only mentions Node's environment object (a regex in `sed` or `grep` on source code) is refused. Workers, reviewers and the coordinator hit it while working on Arthur's own code.

## Goal

The guard refuses a command that names the secrets file and lets a command through that only mentions an object property called env. Evidence: on 2026-10-27 the coordinator's `grep -iE '...process\\.env...'` on the board was refused with `this call names the secrets file process\\.env`.

- Kind: fix

## Done means

- A test of the guard: a command whose only match is a property access (a dot, `env`, then no path end) is allowed; the real secrets file named by its path or its bare dotted name is still refused, as every existing guard test asserts.
- `npm run check` and `npm test` pass.

## Scope

In:
- The env guard's name match in `packages/core/src/` and its test in `packages/core/test/`.

Out:
- Which files the guard hides: unchanged.

## Decisions

- 2026-10-27: Source: F7 of AR0516
