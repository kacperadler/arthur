# AR0403 - Security review of our own code, part 2: injection into shell, git, ssh and tmux, and prompt injection

```json
{
  "id": "AR0403",
  "title": "Security review of our own code, part 2: injection into shell, git, ssh and tmux, and prompt injection",
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
  1. Injection: every place a ticket title, branch, label, file name, Telegram text, YouTrack/GitHub content or a model's output reaches a shell, `git`, `ssh`, `tmux` or a file path (`execFileSync` vs a shell string).
  2. Prompt injection: content from tickets, issues, YouTrack, web pages, CI logs or a client repository steering the coordinator or a job to run commands, leak secrets, merge or approve; which safeguards exist today and where they are missing.
- AR0311's findings (F4, F6, F12, in `spec/features/AR0311-security-audit-of-arthur-before-the-switch/findings.md`) are already tickets: say for each whether main now fixes it, and do not file it again.
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
