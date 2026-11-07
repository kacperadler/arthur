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

A job cannot read a Git or GitHub credential kept outside `~/.ssh` and the env file, so it cannot push to origin past `arthur merge`.

Evidence: `packages/core/src/job-sandbox.ts:79-82` (`hidden`) hides only the env file and `~/.ssh`; `docs/deploy.md:44` names other stores as still readable: `~/.git-credentials` (Git's `store` helper), `$XDG_CONFIG_HOME/git/credentials` (default `~/.config/git/credentials`) and `gh`'s token in `~/.config/gh/hosts.yml`. AR0508 showed a readable credential lets a job push over the network.

- Kind: security

## Done means

- The job sandbox also hides `~/.git-credentials`, `$XDG_CONFIG_HOME/git/credentials` (or `~/.config/git/credentials`) and `~/.config/gh`, each whether it exists or not.
- A test per store, as the AR0508 one: a job cannot read it; each fails when its entry is removed.
- `docs/deploy.md:44` says these are hidden, and names what stays readable (a key an `IdentityFile` names outside `~/.ssh`) with the advice to keep none for Arthur's user.
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- `packages/core/src/job-sandbox.ts`: the `hidden` list.
- Its test in `packages/core/test/`.
- `docs/deploy.md`.

Out:
- The network: a job's outgoing connections stay as they are.
- The coordinator's own access (AR0483).

## Decisions

- 2026-10-27: Source: F2 of AR0508
