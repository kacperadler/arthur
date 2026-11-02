# AR0392 - Outcome

- Merged: 2026-11-02, `5fc95d86`
- Branch: arthur/2026-11-02-worker-c822fb9b
- Reviews: review-1.md PASS
- Cost: worker $10.18, reviews $0.60; review rounds 1

## What went in

- `packages/core/src/git-config.ts`: `checkConfig(root)` returns `{ refusal, pins }`; the pins are the owner's value or Git's default for each key Git reads by a fixed name that names a program, an emptied credential-helper list refilled with the owner's helpers, and no `ext::`.
- `packages/core/src/git.ts`: the worktree check uses `checkConfig(root).refusal`.
- `packages/core/src/job-machine.ts`: `gitOver` passes the pins to the push and fetch to another machine.
- `packages/core/src/job-records.ts`: the prune check uses `checkConfig(...).refusal`.
- `packages/core/src/remote-job.ts`: the `repo` and `prune` checks use `checkConfig(...).refusal`.
- `packages/delivery/src/merge-command.ts`: the merge's `git` helper passes the pins, so the merge commit and the `spec:` commit sign as the owner's config says; the reset re-check uses `.refusal`.
- `packages/delivery/src/merge-outcome.ts`: the re-check before the `spec:` commit uses `checkConfig(root).refusal`.
- `packages/delivery/src/take-main.ts`: the check uses `checkConfig(...).refusal`.
- `packages/delivery/src/ticket-prune.ts`: the check uses `checkConfig(root).refusal`.
- `packages/github/src/github-git.ts`: `originCheck` returns the refusal and the pins; push, LFS push, ls-remote and delete on origin pass the pins.
- `packages/manage/src/health-checks.ts`: health's git calls pass the pins.
- `packages/core/test/git-config.test.ts`: pins for the default, owner, `GIT_SSH` and `SSH_ASKPASS` cases; every pinned key written after the check runs nothing with the pins and runs its program without them.
- `packages/core/test/machine.test.ts`: a `protocol.ext.allow` written after the check runs no `ext::` program in the push of a job's base.
- `packages/delivery/test/merge.test.ts`: a signing program written into main's config after the check does not run in the merge commit.
- `packages/github/test/github.test.ts`: a `core.sshCommand` written after the check does not run in push, ls-remote or delete; `git-lfs` gets the pins.
- `packages/manage/test/health-checks.test.ts`: a signature checker written after the third check does not run in `unpushed`'s `git log`; the owner's checker does.
- `test/structure.test.ts`: core line budget 7056 → 7069.
- `docs/deploy.md`: the Threat model names the pinned keys and their defaults, and says which keys can still win the race (filters, merge drivers, `core.gitProxy`).
- `docs/plugin-api.md`: `@arthur/core/git-config` exports `checkConfig`, documented, with an AR0392 entry under "Changes since entry 51".
- `spec/features/AR0392-a-job-s-program-can-still-plant-a-key-between-the-config-check-and-the-git-call/findings.md`: F1–F3 above.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1420/1491 passed.

## Left open

- Deferred (client summary): F1. A `core.gitProxy` planted after the check still runs: `-c` cannot override it
- Deferred (client summary): F2. A `protocol.allow` or `protocol.<name>.allow` planted after the check lets a push reach a folder's hooks or a URL's helper
- Deferred (client summary): F3. On another machine the push's receive-pack reads `core.alternateRefsCommand` again after `arthur remote-job repo` checked it
- Deferred (client summary): F4. the Threat model's list of keys that can still win the race leaves some out
