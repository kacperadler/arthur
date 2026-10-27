# AR0402 - Security review of our own code, part 1: secrets, file permissions and processes

```json
{
  "id": "AR0402",
  "title": "Security review of our own code, part 1: secrets, file permissions and processes",
  "date": "2026-10-25"
}
```

## Description

One part of the security review of our own code that AR0311 began before the switch and did not finish. The owner asked to split it into smaller reviews, one or two areas each, so each fits one job. The result is a report and findings, not code changes.

## Goal

Know where Arthur's own code is weak in these areas before Arthur runs client work on the VPS, so each weakness becomes a ticket. This keeps the vision's promise that the harness answers for the code being good.

- Kind: security

## Done means

- `security-review.md` in this folder: the areas below, each with what was checked, how (file:line, a command and its output) and the verdict.
  1. Secrets: the `.env` file and tokens never reach a log, a job record, an error, a prompt, Telegram, a commit or the site; whether the env guard covers every way our own jobs read files (other paths, child processes, `/proc/*/environ`).
  2. Files and processes: permissions of records, logs, sockets and locks (`/tmp`, tmux sockets other users could reach), races, pids.
- AR0311's findings (F1, F8, F9, F10, F15, F17, in `spec/features/AR0311-security-audit-of-arthur-before-the-switch/findings.md`) are already tickets: say for each whether main now fixes it, and do not file it again.
- Each new weakness is a `findings.md` entry with Kind, a severity (critical / high / medium / low), Where (file:line), which input reaches it and why the existing check does not stop it, and a suggested fix. A suspicion that could not be confirmed says so.
- This is a review of our own code for its defences: no exploit code. A weakness is shown at most as a failing unit test of the check in a temporary folder, never against the live VPS, the owner's bot, real secrets or a client repository.
- Nothing outside this ticket's folder changes on the branch; `npm test` and `npm run check` still pass.

## Scope

In:
- The areas above, in Arthur's packages and docs at main.

Out:
- Fixing what is found: each finding becomes its own ticket.
- The worktree guard: AR0377 to AR0384 hardened it and AR0376 put each job in an OS sandbox.

## Decisions

- 2026-10-25: The owner: split AR0311 into smaller reviews; this is one of AR0402 to AR0405.
- 2026-10-27: AR0402 approved by the owner (morning of 2026-10-27, one list of 18); the owner: "apprvoed: AR0467, AR0466, AR0471-AR0473, AR0464, AR0465, AR0468-AR0470, AR0474-AR0477, AR0402-AR0405" (AR-D138)
- 2026-10-27: AR0402 held for the owner: no retry around the provider refusal; the worker is left as it is; the owner: "keep going till 88% of Claude 7 Day limit, go silent and always go with recommendations" (AR-D152)
