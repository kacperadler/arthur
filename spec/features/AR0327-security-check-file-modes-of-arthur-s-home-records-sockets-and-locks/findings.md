# AR0327 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

Every entry comes from `check.md` beside this file, which holds the rows and how each was checked. Each is written as a missing check: the input the code does not cover and the check that would.

## F1. The home and everything under it take the process umask: records, logs, the event log and every lock are readable by other users of the host (AR0311 F15, confirmed)

- Kind: risk
- Severity: high
- Found by: 2026-10-23-ar0327-security-check-56de526b (worker), 2026-10-23
- Where: `packages/core/src/run.ts:45`, `packages/core/src/requirements.ts:57`, `packages/core/src/spawn-check.ts:18`, `packages/core/src/host.ts:53` (the home and the plugin folders, `mkdirSync(..., { recursive: true })` with no `mode`, an existing home's mode never changed); `packages/core/src/job-record.ts:27-28`, `:40` (the record); `packages/core/src/wrapper.ts:107`, `packages/core/src/job-scope.ts:65`, `packages/core/src/event-log.ts:21` (the logs); `packages/core/src/lock.ts:78` (every lock); `docs/setup.md:130-149` (the unit has no `UMask=`)
- Rule: Arthur's home, job records, logs and lock files are readable and writable by Arthur's user alone, whatever the process umask.
- What: no line sets a mode or the umask (`grep -rn umask packages/*/src`: 0; `grep -rn 'mode: 0o' packages/*/src`: the two `.mcp.json` lines and the test kit's fake agent), so every folder and file under the home gets `0777`/`0666` less the mask the service inherited from systemd's user manager, "typically 0022" (`man systemd.exec`, `UMask=`), or the one a PAM module set (`0002` on the machine this check ran on). Under `0002`, `mkdirSync` and `writeFileSync` as the code calls them made `775` and `664` (a probe in a `mktemp -d` folder). `docs/deploy.md:37` tells the owner to give each client its own Linux user with its own Arthur on the host, so another user there is the expected layout; such a user, or a job of theirs steered by text from outside, reads every record's `task`, `prompt` (the whole role prompt) and `log` (the agent's output), `events.jsonl` (each `message-received` of the owner, every notice), the Telegram plugin's `media/` (the owner's photos and voice notes) and the YouTrack plugin's attachments. Under a mask that leaves group write and a shared group, they also write: a lock edited to name no pid counts as a dead holder's and is taken over (`lock.ts:134-144`, proven for Arthur's own user at `packages/core/test/lock.test.ts:81`), so a second `arthur run` on the same home starts, and a record's `state` or `cost` is anyone's to change. `.mcp.json` alone holds (`0o600`, tested). Whether the user's own home folder (`adduser`, `docs/setup.md:14`) is `0750` or `0755` on the owner's distribution, which would shield `~/arthur/.arthur` from users outside the group, was not checked: [INFERENCE] the code must not depend on it.
- Suggestion: one function in the core, say `ownHome(home)` in its own file, that makes the home with `mkdirSync(home, { recursive: true, mode: 0o700 })` and then `chmodSync(home, 0o700)` (the `mode` of `mkdirSync` is masked by the umask and applies to a new folder only; `chmodSync` is not masked and fixes a home made earlier with `755`), called at `run.ts:45`, `requirements.ts:57`, `spawn-check.ts:18` and by `remote-job`'s spawn step for the home on another machine. Every record, log, lock and plugin folder lies under the home, so the home's `0700` denies another user all of them, whatever their own modes; the `.mcp.json` lines stay as they are. Tests, in `doctor.test.ts` and `run.test.ts`, each under `process.umask(0o022)` set for the test and restored after: a new home is `0700` (`statSync(home).mode & 0o777`); a home made beforehand as `0755` is `0700` once `arthur doctor` or `arthur run` ran; the refusal of a home that cannot be made (`:169`, `:264`) still fires. Second layer, in `docs/setup.md`'s unit: `UMask=0077` under `[Service]`, so what the service and its jobs write outside the home (the project checkouts, the worktrees) is theirs too; a job's own `bash` inherits it. Out: the modes of the project checkout itself, which the owner's `adduser` and Git decide, and the board's lock outside the home (F2).
- Status: open

## F2. The board's lock and temporary files in each project's checkout take the umask too, outside the home's reach

- Kind: risk
- Severity: low
- Found by: 2026-10-23-ar0327-security-check-56de526b (worker), 2026-10-23
- Where: `packages/core/src/board.ts:43-45`, `:62`, `:167-172` (`spec/.board/` made with `mkdirSync(folder, { recursive: true })`, its `.gitignore` of `*`, `build.json.lock`, `build.json.tmp` and `ticket.md.tmp` written with default modes)
- Rule: lock files are readable and writable by Arthur's user alone, whatever the process umask.
- What: the one lock outside the home lies in the project's checkout, so F1's fix, the home's `0700`, does not cover it. Under a mask that leaves group write and a shared group, another user edits `build.json.lock` to a text that names no pid, which `lock.ts:134-144` counts as a dead holder's and takes over, so two writers change the board at once and one change is lost (`arthur ticket`'s one-writer rule, `docs/commands/ticket.md:29`). Read access shows only what the repository holds. Nothing to check in a single-user layout.
- Suggestion: at `board.ts:169`, `mkdirSync(folder, { recursive: true, mode: 0o700 })` then `chmodSync(folder, 0o700)`, as F1's `ownHome` does, since every file of the folder is the lock's holder's alone. A test in `packages/core/test/board.test.ts` under `process.umask(0o022)`: `spec/.board/` is `0700` after the first write, also when it was `0755` before. Out: `spec/build.json`, `spec/features/**/ticket.md` and the rest of the checkout, which are committed and the project's own.
- Status: open

## F3. The stash refusal tells a job to write its patch to a fixed name in /tmp

- Kind: cleanup
- Severity: low
- Found by: 2026-10-23-ar0327-security-check-56de526b (worker), 2026-10-23
- Where: `packages/core/src/worktree-guard.ts:29` (`save a patch instead (git diff > /tmp/<name>.patch, then git apply /tmp/<name>.patch)`)
- Rule: no fixed shared path in /tmp.
- What: the one place Arthur's code names a path in /tmp for anyone to write is a line a job is told to follow. `/tmp` is shared by every user of the host; a name a job picks (`<name>`) is one another job of the same user, told the same line, may pick too, so a stale or a foreign patch is what `git apply` reads. The worktree guard lets a write to `/tmp` pass by design (`worktree-guard.ts:11`). The test pins the refusal's prefix only (`packages/core/test/worktree-guard.test.ts:171`), not the path.
- Suggestion: name a path of the job's own in the refusal, `git diff > .arthur-stash.patch` in its worktree (which the guard passes and the job's `.gitignore` or a `git add` decides), or `$(mktemp)`; `packages/core/test/worktree-guard.test.ts:171` compares the whole refusal text for `git stash` and `git stash pop`, so a `/tmp` in it fails the test. Out: the guard's rule that a write to `/tmp` passes.
- Status: open
