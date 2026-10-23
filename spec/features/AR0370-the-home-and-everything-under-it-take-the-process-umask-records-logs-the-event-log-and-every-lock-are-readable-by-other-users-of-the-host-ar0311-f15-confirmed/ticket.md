# AR0370 - The home and everything under it take the process umask: records, logs, the event log and every lock are readable by other users of the host (AR0311 F15, confirmed)

```json
{
  "id": "AR0370",
  "title": "The home and everything under it take the process umask: records, logs, the event log and every lock are readable by other users of the host (AR0311 F15, confirmed)",
  "date": "2026-10-23"
}
```

## Description

no line sets a mode or the umask (`grep -rn umask packages/*/src`: 0; `grep -rn 'mode: 0o' packages/*/src`: the two `.mcp.json` lines and the test kit's fake agent), so every folder and file under the home gets `0777`/`0666` less the mask the service inherited from systemd's user manager, "typically 0022" (`man systemd.exec`, `UMask=`), or the one a PAM module set (`0002` on the machine this check ran on). Under `0002`, `mkdirSync` and `writeFileSync` as the code calls them made `775` and `664` (a probe in a `mktemp -d` folder). `docs/deploy.md:37` tells the owner to give each client its own Linux user with its own Arthur on the host, so another user there is the expected layout; such a user, or a job of theirs steered by text from outside, reads every record's `task`, `prompt` (the whole role prompt) and `log` (the agent's output), `events.jsonl` (each `message-received` of the owner, every notice), the Telegram plugin's `media/` (the owner's photos and voice notes) and the YouTrack plugin's attachments. Under a mask that leaves group write and a shared group, they also write: a lock edited to name no pid counts as a dead holder's and is taken over (`lock.ts:134-144`, proven for Arthur's own user at `packages/core/test/lock.test.ts:81`), so a second `arthur run` on the same home starts, and a record's `state` or `cost` is anyone's to change. `.mcp.json` alone holds (`0o600`, tested). Whether the user's own home folder (`adduser`, `docs/setup.md:14`) is `0750` or `0755` on the owner's distribution, which would shield `~/arthur/.arthur` from users outside the group, was not checked: [INFERENCE] the code must not depend on it.

## Goal

Arthur's home and everything under it (records, logs, the event log, locks, Telegram media, YouTrack attachments) is readable and writable by Arthur's user alone (0700/0600) whatever the umask, with `UMask=0077` in the unit as a second layer; tested under umask 022.

- Kind: security

Evidence:
- `packages/core/src/run.ts:45`, `packages/core/src/requirements.ts:57`, `packages/core/src/spawn-check.ts:18`, `packages/core/src/host.ts:53` (the home and the plugin folders, `mkdirSync(..., { recursive: true })` with no `mode`, an existing home's mode never changed); `packages/core/src/job-record.ts:27-28`, `:40` (the record); `packages/core/src/wrapper.ts:107`, `packages/core/src/job-scope.ts:65`, `packages/core/src/event-log.ts:21` (the logs); `packages/core/src/lock.ts:78` (every lock); `docs/setup.md:130-149` (the unit has no `UMask=`)
- Found by: 2026-10-23-ar0327-security-check-56de526b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: one function in the core, say `ownHome(home)` in its own file, that makes the home with `mkdirSync(home, { recursive: true, mode: 0o700 })` and then `chmodSync(home, 0o700)` (the `mode` of `mkdirSync` is masked by the umask and applies to a new folder only; `chmodSync` is not masked and fixes a home made earlier with `755`), called at `run.ts:45`, `requirements.ts:57`, `spawn-check.ts:18` and by `remote-job`'s spawn step for the home on another machine. Every record, log, lock and plugin folder lies under the home, so the home's `0700` denies another user all of them, whatever their own modes; the `.mcp.json` lines stay as they are. Tests, in `doctor.test.ts` and `run.test.ts`, each under `process.umask(0o022)` set for the test and restored after: a new home is `0700` (`statSync(home).mode & 0o777`); a home made beforehand as `0755` is `0700` once `arthur doctor` or `arthur run` ran; the refusal of a home that cannot be made (`:169`, `:264`) still fires. Second layer, in `docs/setup.md`'s unit: `UMask=0077` under `[Service]`, so what the service and its jobs write outside the home (the project checkouts, the worktrees) is theirs too; a job's own `bash` inherits it. Out: the modes of the project checkout itself, which the owner's `adduser` and Git decide, and the board's lock outside the home (F2).
- `npm test` and `npm run check` pass.

## Scope

In:
- one function in the core, say `ownHome(home)` in its own file, that makes the home with `mkdirSync(home, { recursive: true, mode: 0o700 })` and then `chmodSync(home, 0o700)` (the `mode` of `mkdirSync` is masked by the umask and applies to a new folder only; `chmodSync` is not masked and fixes a home made earlier with `755`), called at `run.ts:45`, `requirements.ts:57`, `spawn-check.ts:18` and by `remote-job`'s spawn step for the home on another machine. Every record, log, lock and plugin folder lies under the home, so the home's `0700` denies another user all of them, whatever their own modes; the `.mcp.json` lines stay as they are. Tests, in `doctor.test.ts` and `run.test.ts`, each under `process.umask(0o022)` set for the test and restored after: a new home is `0700` (`statSync(home).mode & 0o777`); a home made beforehand as `0755` is `0700` once `arthur doctor` or `arthur run` ran; the refusal of a home that cannot be made (`:169`, `:264`) still fires. Second layer, in `docs/setup.md`'s unit: `UMask=0077` under `[Service]`, so what the service and its jobs write outside the home (the project checkouts, the worktrees) is theirs too; a job's own `bash` inherits it. Out: the modes of the project checkout itself, which the owner's `adduser` and Git decide, and the board's lock outside the home (F2).

## Decisions

- 2026-10-23: Source: F1 of AR0327
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
- 2026-10-23: The owner: weekly cap raised to 40%; fixes one at a time to avoid conflicts, criticals first (AR0329, AR0346), then highs (AR0330, AR0331, AR0347, AR0349, AR0353, AR0370).
- 2026-10-23: Coordinator accepted: chmod with mode & 0o700 instead of a plain 0o700 (keeps a read-only home read-only, so the doctor refusal still fires); the extra call in host.ts loadPlugins; core budget 5889 -> 5905 (+16, own-home.ts and its callers).
