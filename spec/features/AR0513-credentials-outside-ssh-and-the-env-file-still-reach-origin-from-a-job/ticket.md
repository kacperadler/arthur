# AR0513 - Credentials outside `~/.ssh` and the env file still reach origin from a job

```json
{
  "id": "AR0513",
  "title": "Credentials outside `~/.ssh` and the env file still reach origin from a job",
  "date": "2026-10-27"
}
```

## Description

F2 of AR0508 (spec/features/AR0508-a-sandboxed-job-reads-arthur-s-ssh-private-key-and-with-it-gets-an-unconfined/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-6355f513 (worker), 2026-10-27
- Where: `packages/core/src/job-sandbox.ts:79-82` (`hidden`), `docs/deploy.md:44`
- What: the sandbox hides only the env file and `~/.ssh` [INFERENCE from the code: every other file is granted a read]. A Git credential kept elsewhere, `~/.git-credentials` (Git's `store` helper), `gh`'s token in `~/.config/gh/hosts.yml`, or a key an `IdentityFile` in `~/.ssh/config` names outside `~/.ssh`, is still readable, so a job holding one can `git push` to origin over HTTPS past `arthur merge`, as AR0508 describes for an SSH key. `docs/deploy.md` now names these as still readable.
- Suggestion: hide the known credential stores as well (`~/.git-credentials`, `$XDG_CONFIG_HOME/git/credentials`, `~/.config/gh`), or tell in `docs/setup.md` to keep no such credential for Arthur's user; a test per store as the AR0508 one. Out: the network.

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

- 2026-10-27: Source: F2 of AR0508
