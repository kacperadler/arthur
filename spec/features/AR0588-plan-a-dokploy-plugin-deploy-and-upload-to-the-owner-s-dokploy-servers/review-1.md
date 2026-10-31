# AR0588 - Review 1

- Job: 2026-10-31-review-4bc87546
- Branch: arthur/2026-10-31-worker-c2342d8c
- Commit reviewed: 8496942a21f3319c2c805bf4a91d327d5bf0b1e0
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch builds ticket 1 of the approved plan: the read-only `arthur dokploy apps|app|status`. It differs from the plan in two places, and the worker's final message gives a reason for both:
- **How the package was made.** `arthur plugin new` failed with `unknown command plugin`, because the checkout's `arthur.config.ts` does not load `develop`. The worker ran `develop`'s `pluginCommand` through `fakeHost` instead, which writes the same files.
- **Where a project's app is set.** The plan's `FIELDS` line in `projects` became `dokploy.project({ instance?, app })`. The approved AR0589 plan calls for that change: its line 66 under AR-D391 and AR-D393, both on main. So `packages/projects` and its 482 budget are untouched.

The 450 budget matches AR-D390. The command declares no `inJob`, and `test/job-gate.test.ts` checks that `dokploy apps` and `dokploy status` are refused inside a job.

## Notes
- (minor) `packages/dokploy/src/dokploy-options.ts:24`: `isPrivate` accepts `http://[::ffff:127.0.0.1]` and `http://0x7f000001`. Both are loopback, so the token still cannot leave the owner's server. `http://[::ffff:8.8.8.8]`, `http://169.254.169.254` and `http://[fd00:ec2::254]` are refused, and so is a URL with a user (`https://a:b@x/`).
- (minor) `spec/features/AR0588-…/findings.md`: F1 is still open: `--instance` has no word for the unnamed instance when several are set. The worker filed it for the owner.
- (minor) The upload and deploy commands, the zip writer, the coordinator role lines, the README, `arthur.mmd`, the vision and the roadmap are all left for ticket 2, as the plan's Files section splits them.

## Checks
- `npm ci`, then `npm run check` and `npm test` in one bash call (timeout 1800 s): tsc clean; 1419 tests, 1357 passed, 0 failed, 62 skipped. This matches the worker's numbers.
- The dokploy tests alone (`node --import @arthur/core/testing --test packages/dokploy/test/*.test.ts`): 15 passed, 0 failed.
- I broke 15 key behaviors one at a time, and a test failed for each one:
  - redirects followed instead of refused;
  - the token no longer redacted in errors;
  - a query or fragment in the URL accepted;
  - the cloud metadata addresses no longer excluded;
  - a user or password in the URL accepted;
  - `--instance` allowed to differ from the instance the project names;
  - an ambiguous call sent to the first instance;
  - the app id check in the command removed;
  - `status` showing 6 deployments instead of 5;
  - `timeoutSeconds` allowed up to 601;
  - deployments sorted oldest first;
  - the project piece's id check removed;
  - the project piece's instance check removed;
  - the token's header check removed.
- I restored every change with `git checkout -- packages/dokploy/src`, and `git status --short` came back clean.

PASS