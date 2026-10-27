# AR0508 - A sandboxed job reads Arthur's SSH private key, and with it gets an unconfined shell on every other machine and a push to origin

```json
{
  "id": "AR0508",
  "title": "A sandboxed job reads Arthur's SSH private key, and with it gets an unconfined shell on every other machine and a push to origin",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0405 (spec/features/AR0405-security-review-of-our-own-code-part-4-other-machines-network-and-dependencies/findings.md).

- Kind: security
- Severity: high
- Found by: 2026-10-27-worker-03ddbe1b (worker), 2026-10-27
- Where: `packages/core/src/job-sandbox.ts:79-82` (`hidden`: only the env file), `:67-74` (`writable`), `packages/core/src/job-machine.ts:21` (the key `ssh` uses with `BatchMode=yes`, so one that needs no passphrase), `packages/core/docs/commands/spawn.md:116` (`~/.ssh` can be read), `docs/deploy.md:31`, `:44`
- Input: any program a job runs in its sandbox: the agent steered by outside text, the branch's own code, a dependency's install script (`packages/core/src/job-install.ts`, run in the same sandbox).
- Why the check misses it: the sandbox hides only the env file (`hidden`), and nothing limits the network (`docs/deploy.md:44`). Probe (`security-review.md`, area 1): the real `sandboxed()` over a temporary folder printed a fake `home/.ssh/id_fake` whole, while the hidden env file and a write into `home/.ssh/` gave `Permission denied`. The key that `ssh <machine> true` uses without a prompt (`docs/setup.md:251-256`, `docs/deploy.md:14`) is such a file. The worktree guard and the sandbox bound only what a job writes here.
- What: one job, on the VPS, runs `ssh <machine> <anything>` as Arthur's user there, outside that machine's sandbox and job scope: it rewrites `repos/<project>.git` there (hooks, other jobs' branches), Arthur's install there, `~/.ssh/authorized_keys` there; and where the same key is a GitHub key (a deploy key with write access or an account key), `git push` to origin's main straight from the worktree, which `arthur merge`'s review and its stray-commit check never see (`docs/deploy.md:42` checks the main checkout, not origin). `docs/deploy.md:31` names "use your SSH keys" in general; it does not say this undoes the sandbox's bound on other machines and on origin.
- Suggestion: hide `~/.ssh` from every job's agent, its install and a merge's checks, the way the env file is hidden: add it to `hidden()` and to `stepSandbox`'s hidden list (an ssh agent's socket is already out of reach: the sandbox opens no Unix stream socket); a job needs no SSH key, since Arthur itself pushes and fetches. Then `docs/deploy.md` and `spawn.md:116` say `~/.ssh` is hidden. A test: a sandboxed `cat ~/.ssh/<file>` of a temporary home answers `Permission denied`. Out: the network itself (a separate decision).

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F1 of AR0405
