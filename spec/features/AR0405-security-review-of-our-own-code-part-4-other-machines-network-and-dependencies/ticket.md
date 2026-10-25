# AR0405 - Security review of our own code, part 4: other machines, network and dependencies

```json
{
  "id": "AR0405",
  "title": "Security review of our own code, part 4: other machines, network and dependencies",
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
  1. Machines and SSH: what a job on another machine can do on the VPS and back; host key checks; commands built for `ssh`.
  2. Network: URLs Arthur fetches (uptime sites, model providers, GitHub) and SSRF to loopback or the cloud metadata address; the public-host refusal of models.
  3. Dependencies and the supply chain: `package-lock.json`, `npm ci`, the site's npm project, GitHub Actions versions and permissions, the token's scopes.
- AR0311's findings (F3, F14, F16, F18, in `spec/features/AR0311-security-audit-of-arthur-before-the-switch/findings.md`) are already tickets: say for each whether main now fixes it, and do not file it again.
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
