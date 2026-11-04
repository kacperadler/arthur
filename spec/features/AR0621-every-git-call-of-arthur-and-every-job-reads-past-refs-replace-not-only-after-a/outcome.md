# AR0621 - Outcome

- Merged: 2026-11-04, `7e25c5ab`
- Branch: arthur/2026-11-04-worker-a5aa7883
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $5.21, reviews $0.99; review rounds 2

## What went in

- `docs/deploy.md`: the pins list includes `core.useReplaceRefs` false; the replacement section keeps main's `git fast-import` sentence and says the checked calls pin `core.useReplaceRefs` false and every job's install and agent run with `GIT_NO_REPLACE_OBJECTS=1`.
- `packages/core/docs/commands/spawn.md`: says a job's agent and install run with `GIT_NO_REPLACE_OBJECTS=1`, so their git, a reviewer's included, reads past `refs/replace`.
- `packages/core/src/git-config.ts`: `checkConfig`'s pins include `-c core.useReplaceRefs=false` (with `protocol.ext.allow=never`, ahead of the credential helpers).
- `packages/core/src/test-env.ts`: the test kit also clears `GIT_NO_REPLACE_OBJECTS`, so a job's own tests can read a replacement.
- `packages/core/src/wrapper.ts`: the job's install and agent run with `GIT_NO_REPLACE_OBJECTS=1`.
- `packages/core/test/git-config.test.ts`: covers a value set back to true between `checkConfig` and the call, read past by the pins, for each way of undoing it; expected pin lists updated.
- `packages/core/test/sandbox.test.ts`: new test that a job's install and agent read the real commit despite a replace ref and `core.useReplaceRefs true` written after the spawn.
- `packages/core/test/testing.test.ts`: the kit test also checks that `GIT_NO_REPLACE_OBJECTS` is cleared.
- `packages/github/test/github.test.ts`: git-lfs's pinned config is matched in the new order, including `core.useReplaceRefs=false`.
- `spec/features/AR0621-every-git-call-of-arthur-and-every-job-reads-past-refs-replace-not-only-after-a/findings.md`: new, with F1 (the decision log names another project of the owner).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1471/1542 passed.

## Left open

- Deferred (client summary): F1. The committed decision log names another project of the owner and what is built for it
- Deferred (client summary): F2. F1, about `spec/decisions.jsonl` (AR-D486) naming another project of the owner, is still `Status: open`
