# AR0680 - Review 2

- Job: 2026-11-10-review-93d0211c
- Branch: arthur/2026-11-10-worker-622e3180
- Commit reviewed: 05f61b3b02b50e6e4ed6a9867d004470bdc36c44
- Verdict: PASS

## Final message

No finding blocks the merge. `arthur dokploy source <app> --repo owner/name --branch <branch>` does what AR0680 and the approved AR0655 T4a plan ask:

- **Reads, in order:** `application.one`, `github.githubProviders`, `github.getGithubRepositories?githubId=`, then `github.getGithubBranches?repo=&owner=&githubId=`.
- **Writes:** it sends `application.saveGithubProvider` with every key the plan lists and `triggerType: "push"`. It sends `application.update { autoDeploy: true }` only when auto-deploy is not already true. When nothing would change it prints `already set` and writes nothing.
- **Refusals:** every one the plan names has a test. Each refusal that comes before a request is checked to send none, and each that comes after the reads to write nothing.
- **Upstream match (Dokploy v0.30.10, fetched from GitHub):** the branch regex is Dokploy's `VALID_BRANCH_REGEX`, `/^[a-zA-Z0-9._\-/#]+$/`. The body matches `apiSaveGithubProvider` (`schema/application.ts:453`) and the router at `application.ts:536`. The query keys match `apiFindGithubBranches` and `apiFindOneGithub`, and Dokploy pages through both GitHub lists itself (`octokit.paginate`).
- **Docs and budget:** the docs, README, `docs/setup.md`, the config example, the coordinator role and roadmap entry 113 are updated. The dokploy budget goes from 615 to 690, inside the plan's estimate of about 695. The worker's final message names the raise for outcome.md.
- **Vision:** the `spec/vision.md` row is left for T4c, as the plan says, and is logged as F1.

## Notes
- (minor) `packages/dokploy/src/dokploy-source.ts:41`: the success line prints `buildPath` without `text()`. A `--build-path` with a control character in it passes the check and reaches the terminal as given. It is the owner's own input, so the risk is low.
- (minor) `packages/dokploy/src/dokploy-api.ts:16`: the `ID` comment says the query carries the owner and repository checked as `--repo`. The code actually sends GitHub's own `login` and `name`, which match that input only when case is ignored. `URLSearchParams` encodes them either way, so this is about accuracy only.
- (minor) `packages/dokploy/src/dokploy-source.ts:12`: the `--repo` owner pattern accepts a leading or trailing `-`, and a repository named `..`. Neither does harm: the repository must still be in the list the GitHub app's installation returns before anything is sent.
- (risk) the success and refusal lines were never run against a real CLI. The command is refused inside a job, and this checkout has no `arthur.config.ts`: `npx arthur dokploy --help` printed `unknown command dokploy` because the config did not load. Someone outside a job still needs to run `arthur dokploy source --help` and the command itself once.

## Checks (all on 05f61b3b)
- `npm run check`: tsc finished with no errors.
- `npm test`: 1724 tests, 1660 passed, 0 failed, 64 skipped.
- `npm run mutate`: 25 mutants, 25 caught, 0 survived; 253 not run (it stops at 25 by default).
- **Hand mutations:** I mutated 24 key behaviors and ran `node --test packages/dokploy/test/dokploy-source.test.ts` after each one; at least one test failed every time. I restored each mutation with `git checkout --`, and `git status --short` is clean. The mutations:
  - In `dokploy-source.ts`:
    - removed `!replace`, the deployments-length check, `sourceType` from the same-source keys, and the `triggerType` and `buildPath` parts of the already-set check;
    - turned the case-insensitive repository match into an exact one, and dropped the owner match;
    - made `if (!saved)` always send and `if (!auto)` never send;
    - removed the `..` check and the leading-`/` check on `--build-path`;
    - made any branch name pass;
    - disabled the GitHub app id check;
    - made it pick the first GitHub app when there are several;
    - read a `null` auto-deploy as on;
    - hard-coded `enableSubmodules` and `watchPaths`;
    - widened the `--repo` and `--branch` patterns.
  - In `dokploy-command.ts`:
    - dropped the `--repo` requirement and the `--branch` requirement;
    - hard-coded `--replace-source` to off.
- `dokploy-source.test.ts` on its own: 8 passed, 0 failed.

PASS