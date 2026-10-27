# AR0516 - Since AR0508 hides ~/.ssh, a job and a merge step cannot sign a commit when Git signs with a key there

```json
{
  "id": "AR0516",
  "title": "Since AR0508 hides ~/.ssh, a job and a merge step cannot sign a commit when Git signs with a key there",
  "date": "2026-10-27"
}
```

## Description

Found 2026-10-27 by the AR0509 worker (2026-10-27-worker-61d50fad), the first job after AR0508 went live.

- The user's global Git config signs every commit (`commit.gpgsign=true`, `gpg.format=ssh`, `user.signingkey` a key under `~/.ssh`). AR0508 hides `~/.ssh` from a job's agent, its install and a merge's checks (`packages/core/src/job-sandbox.ts`).
- So a job's `git commit` fails with `Couldn't load public key <home>/.ssh/<key>.pub`; the AR0509 worker committed 1f42ab03 with `git -c commit.gpgsign=false`, unsigned (`%G?` = `N`), where every commit before it is signed.
- Every test that makes a temporary repository and commits fails the same way inside a job, before reaching any code; the worker ran `npm test` with `GIT_CONFIG_GLOBAL=/dev/null` to get past it. A merge's `npm test` step runs in the same sandbox [INFERENCE: from `stepSandbox`, not yet seen in a merge].

## Goal

A job and a merge step commit and run the tests again while `~/.ssh` stays hidden, without a job ever reading a signing key.

- Kind: fix

## Done means

- A job's `git commit` succeeds on a host whose global Git config signs with a key under `~/.ssh`, without the agent passing any flag; a test over a temporary home with such a config fails before the change and passes after.
- The tests that commit in a temporary repository pass inside a job and in a merge's `npm test` step on that host.
- What a job's commit carries (unsigned, or signed by Arthur) is as the owner decides in this ticket's Decisions; the merge commit Arthur makes outside the sandbox stays signed.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/job-sandbox.ts` or the job's and the step's environment (`GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_n`): commit and tag signing off inside the sandbox.
- `packages/core/test/sandbox.test.ts`: the test above.
- `packages/core/docs/commands/spawn.md`, `docs/deploy.md`: say a job's commits are not signed, and that the merge commit is.

Out:
- Making the signing key readable to jobs: that undoes AR0508.
- Signing a branch's commits at the merge: a separate decision if the owner asks for it.

## Decisions

- 2026-10-27: Jobs commit unsigned: Arthur turns commit signing off inside every job and merge step; the merge commit Arthur makes stays signed; AR0516 approved to build it; the owner: "AR-D184 1" (AR-D184)
- 2026-10-27: Merge AR0516 once with commit and tag signing off in the merge environment (its one merge commit unsigned); then restart, and every later merge commit is signed again; the owner: "AR-D188 1" (AR-D188)
