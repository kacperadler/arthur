# AR0311 - Security audit of Arthur before the switch

```json
{
  "id": "AR0311",
  "title": "Security audit of Arthur before the switch",
  "date": "2026-10-23"
}
```

## Description

Before Arthur replaces the harness and runs unattended on the VPS with shell, SSH, GitHub and Telegram access, one full security review of our own code: where a check is missing or too weak, and what fix closes it. The result is a report and findings, each one a ticket after the merge; this ticket fixes nothing itself.

## Goal

- Kind: risk
- Model: anthropic/claude-opus-5-5 (the owner, 2026-10-23, after two Fable refusals); its review stays on the reviewer's default model.

Arthur at the switch (AR0307) runs agents that execute shell commands, merge to main, reach other machines over SSH, read `.env` secrets and take instructions from Telegram, tickets, YouTrack and GitHub. A hole there is a hole on the VPS and in every client repository Arthur will work on.

## Done means

- `security-audit.md` in this folder: the threat model in one page (who can send Arthur input, what each role and job can reach), then every area below with what was checked, how (file:line, a command and its output) and the verdict.
- Each weakness found is a `findings.md` entry with Kind, a severity (critical / high / medium / low), Where (file:line), which input reaches it and why the existing check does not stop it, and a suggested fix; `h merge` turns each into a ticket. A suspicion that could not be confirmed says so in its entry.
- Areas, each covered in the report:
  1. Secrets: `.env` and tokens never reach a log, a job record, an error, a prompt, Telegram, a commit or the site; whether the env guard covers every way our own jobs read files (other paths, child processes, `/proc/*/environ`).
  2. The worktree guard and its shell parser: whether it keeps a job's writes inside its worktree for symlinks, `cd`, `git -C`, globs, quoting, here-docs and `eval`, and never on main or another job's worktree.
  3. Injection: every place a ticket title, branch, label, file name, Telegram text, YouTrack/GitHub content or a model's output reaches a shell, `git`, `ssh`, `tmux` or a file path (`execFileSync` vs a shell string).
  4. Prompt injection: content from tickets, issues, YouTrack, web pages, CI logs or a client repository steering the coordinator or a job to run commands, leak secrets, merge or approve; which safeguards exist today and where they are missing.
  5. Channels: Telegram (and the Discord plan) answer only the owner's id; commands that stop, merge, restart or spend money from the phone; how a message from someone else is rejected.
  6. Machines and SSH: what a job on another machine can do on the VPS and back; host key checks; commands built for `ssh`.
  7. Network: URLs Arthur fetches (uptime sites, model providers, GitHub) and SSRF to loopback or the cloud metadata address; the public-host refusal of models.
  8. Merge and delivery: anything that lets unreviewed or failing code reach main (`--unreviewed`, CI verdict reading, review PASS of another tip, branch name tricks).
  9. Files and processes: permissions of records, logs, sockets and locks (`/tmp`, tmux sockets other users could reach), races, pids.
  10. Dependencies and the supply chain: `package-lock.json`, `npm ci`, the site's npm project, GitHub Actions versions and permissions, the token's scopes.
- No exploit code: a critical or high weakness is shown at most as a failing unit test of the guard in a temporary folder (the guard lets an input through that it should refuse), never against the live VPS, the owner's bot, real secrets or a client repository.
- Nothing outside `spec/features/<this ticket>/` changes on the branch; `npm test` and `npm run check` still pass.

## Scope

In:
- The whole repository (`packages/`, `test/`, `docs/setup.md`, `docs/deploy.md`, `.github/`, `site/`); reading only.

Out:
- Fixes: each finding becomes its own ticket after the merge.
- The harness (`/home/kacper/harness`) and the live VPS configuration.

## Decisions

- 2026-10-23: The owner: a large security audit of Arthur before the switch, run on the Fable model.
- 2026-10-23: The switch (AR0307) waits for this ticket.
- 2026-10-23: The owner: "AR0311 ok bez limitu" — approved, no cost limit (--budget 0), model anthropic/claude-fable-5-1.
- 2026-10-23: The first run on Fable ended with a model refusal (cyber) before writing anything; the ticket is reframed as a defensive review of our own code with no exploit code, same areas, and run once more on Fable.
- 2026-10-23: Fable refused twice (cyber), ~$20, nothing written. The owner: run it on Opus ("Dobra to pusc na opus"), no cost limit.
- 2026-10-23: The Opus run was refused (cyber) too, nothing written; no further run without the owner.
