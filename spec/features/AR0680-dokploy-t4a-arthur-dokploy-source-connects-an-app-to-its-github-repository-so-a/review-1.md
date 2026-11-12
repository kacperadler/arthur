# AR0680 - Review 1

- Job: 2026-11-10-review-938269b2
- Branch: arthur/2026-11-10-worker-622e3180
- Commit reviewed: 494f2596f379863b017c743713bbd4d803ea1fab
- Verdict: FAIL

## Final message

## Findings

1. **`packages/dokploy/src/dokploy-source.ts:36`: the tests don't check `sourceType` in the "same source" comparison.** The mutation `asked = { sourceType: "github", githubId, … }` → `{ githubId, … }` passes all 7 tests in `dokploy-source.test.ts`. Without that key, an app that once deployed from GitHub and was then switched to `drop` or `docker` would get through. Examples are an upload with `--replace-source`, or the panel's Docker source. If its `githubId`, `owner`, `repository` and `branch` columns are still set, it is no longer counted as moved. The `--replace-source` refusal is then skipped, and `source` prints `already set` and writes nothing, while the app still deploys from drop or docker. [INFERENCE] I assume Dokploy keeps the GitHub columns when the source type changes; I did not check its source. The worker's code is right here, but nothing pins it. The review criteria count an uncaught mutation of key behavior as a FAIL.

2. **`packages/dokploy/src/dokploy-source.ts:51`: nothing tests that the saved owner and repository use GitHub's spelling.** Two mutations each pass all 7 tests: `owner: login` → `owner` (the `--repo` text as typed), and `repository` → `repository: name`. The comment on line 29 explains why this matters: Dokploy's push webhook compares owner and name exactly as GitHub writes them. So `source app --repo ACME/Web-Shop --branch main` would save a spelling that no push matches, and the app would never deploy on push. The only mixed-case test (`ACME/Web-Shop`) runs against an app whose source is already set. It ends at `already set` and never checks the body sent to `saveGithubProvider`.

3. **`packages/dokploy/src/dokploy-source.ts:14`: no test checks that a valid branch name with `-`, `_` or `#` is accepted.** `npm run mutate -- --max 150` reported three survivors on this line: removing `_`, removing `\-` and removing `#` from `/^[a-zA-Z0-9._\-/#]+$/`. With `-` gone, `--branch feature-x` would be refused before any request and no test would fail. The tests only accept `main`, `v9` and `release/1.2`.

4. **`docs/setup.md:78`: this setup page still lists only `create|setup|env`.** It lists what `arthur dokploy` does and stops there, with no `source`. The branch updated the same sentence in `README.md:48`, `packages/dokploy/docs/dokploy.md:3` and `arthur.config.example.ts:303`. The ticket's Scope Out doesn't name this file, so it counts as a stale doc line.

## Notes
- (minor) `packages/dokploy/test/fake-dokploy.ts:88,105,109,255,258`: mutate shows 8 survivors in the fake's fixture values (status 200→201, `previewPort`, `previewHttps`, `cleanCache`, the `githubAppName` regex). These are fixture values, not behavior; the shape test only checks keys.
- (minor) `test/structure.test.ts:26`: the dokploy budget rises from 615 to 690, which is within the plan's estimate of about 695. The merge's `outcome.md` should name the raise.

## Checks (all on 494f2596)
- `npm run check && npm test`: tsc finished with no errors. A second `npm test` run with a summary filter printed tests 1723, pass 1659, fail 0, skipped 64.
- `npm run mutate`: 25 mutants, 25 caught, 0 survived; 253 not run. This matches the worker's claim.
- `npm run mutate -- --max 150`: 150 mutants, 139 caught, 11 survived. Three survivors are in `dokploy-source.ts:14` (finding 3) and eight are in `fake-dokploy.ts` (note).
- Hand mutations of `dokploy-source.ts`, each run against `node --import @arthur/core/testing --test packages/dokploy/test/dokploy-source.test.ts` and restored with `git checkout -- <file>`:
  - **Caught (16):**
    - `--replace-source` refusal disabled.
    - Always save; always send the auto-deploy update.
    - `if (saved && auto)` → `if (saved)`.
    - No-GitHub-app check removed.
    - `githubId` id check removed.
    - `..` check removed; leading `/` check removed.
    - Case-insensitive repository match → exact.
    - Trigger-type check removed; build-path check removed.
    - Watch paths → `[]`; submodules → `false`.
    - Branch-exists check removed.
    - Owner regex widened to allow `_`.
    - Empty-deployments exemption removed.
  - **Caught, other edits:** the branch lookup using the typed owner and name (1 failure); `moved &&` removed from the refusal (2 failures).
  - **Survived:** `sourceType` dropped from `asked` (finding 1); `owner: login` → `owner` and `repository` → `repository: name` in the body (finding 2); `#` dropped from the branch regex (finding 3).
  - `git status --short` printed nothing after restoring.

FAIL