# AR0329 - A job is not isolated from Arthur's code, config and the user's own files (AR0311 F1, confirmed)

```json
{
  "id": "AR0329",
  "title": "A job is not isolated from Arthur's code, config and the user's own files (AR0311 F1, confirmed)",
  "date": "2026-10-23"
}
```

## Description

in the layout of `docs/setup.md` (config and `.env` in `~/arthur`, home `~/arthur/.arthur`), a tool call that writes `~/arthur/arthur.config.ts`, a file under `~/arthur/packages/`, `~/arthur/.env`, `~/.gitconfig`, `~/.ssh/authorized_keys` or `~/.config/systemd/user/arthur.service` passes the worktree guard, since none of them is in a guarded place unless Arthur's own repository happens to be a declared project; and the job's process, as Arthur's Linux user, can do the same through any program the parser does not read (`node -e`, `python3 -c`, `tar -C`, a path in a variable), which the guard documents as its limit (`worktree-guard.ts:55-60`).

## Goal

A job's writes cannot reach Arthur's code, config, env file or the user's own files (`~/.gitconfig`, `~/.ssh`, systemd units): the guard names those places, with a test per place.

- Kind: security

Evidence:
- `packages/core/src/job-place.ts:40` (the guarded places: the home folder, the worktrees folder, the main checkout, the other projects), `packages/core/src/job-scope.ts:63-68` (the scope caps CPU and memory only), `docs/deploy.md:30`
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: two steps. First, in the guard: the runner writes into the record a `guarded` file with the folder of the config, Arthur's install (the package root of `import.meta.dirname`), `~/.ssh`, `~/.config/systemd` and `~/.gitconfig`, and `jobPlace` adds them to the places with their own names ("Arthur's config folder", "Arthur's install", "the user's SSH folder"); a test in `worktree-guard.test.ts` with a write into each. Second, the real bound, its own ticket: run each job's agent under a sandbox (bubblewrap or Landlock, or a Linux user per job) with the worktree and `/tmp` writable and the home folder, the config folder, `~/.ssh` and the other checkouts read-only or hidden, and without the user manager's bus (`systemd-run --user` from a job starts a process outside its scope). Out: the parser stays the mistake guard it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- two steps. First, in the guard: the runner writes into the record a `guarded` file with the folder of the config, Arthur's install (the package root of `import.meta.dirname`), `~/.ssh`, `~/.config/systemd` and `~/.gitconfig`, and `jobPlace` adds them to the places with their own names ("Arthur's config folder", "Arthur's install", "the user's SSH folder"); a test in `worktree-guard.test.ts` with a write into each. Second, the real bound, its own ticket: run each job's agent under a sandbox (bubblewrap or Landlock, or a Linux user per job) with the worktree and `/tmp` writable and the home folder, the config folder, `~/.ssh` and the other checkouts read-only or hidden, and without the user manager's bus (`systemd-run --user` from a job starts a process outside its scope). Out: the parser stays the mistake guard it is.

## Decisions

- 2026-10-23: Source: F1 of AR0320
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
- 2026-10-23: The owner: Arthur must keep developing itself (new plugins and fixes). The fix blocks a job writing straight into the running installation (live checkout, arthur.config.ts, the env file, ~/.ssh, systemd units); it must not block the path a job uses today: its own worktree and branch (`arthur plugin new --root <worktree>`), review, merge, then the coordinator (not a job) turns the plugin on in arthur.config.ts and restarts. A test proves that path still works.
- 2026-10-23: The owner: weekly cap raised to 40%; fixes one at a time to avoid conflicts, criticals first (AR0329, AR0346), then highs (AR0330, AR0331, AR0347, AR0349, AR0353, AR0370).
- 2026-10-23: Coordinator accepted core's line budget raise 5787 -> 5815 (+28: the guarded places in the record, jobPlace reading them, the env file as a place).
