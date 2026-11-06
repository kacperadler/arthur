# AR0603 - Review 2

- Job: 2026-11-06-review-310dc999
- Branch: arthur/2026-11-06-worker-8af99dd8
- Commit reviewed: c8c132bc81d05dc3fa3eb44669468da414f10959
- Verdict: PASS

## Final message

The branch can be merged. Nothing blocks it: it does everything the ticket's Done means and the AR0588 plan's "Ticket 2 (writes)" ask for, and the one finding from review 1 is fixed.

## Findings

None that block the merge.

- **Review 1's finding is fixed.** `README.md:27` no longer lists "dokploy's upload and deploy" under "Next". I searched the repo for leftover wording ("upload and deploy planned", "to come", "partly built", "reads as") and found none in the README, `arthur.mmd`, the docs, the config example or the roadmap.
- **`spec/vision.md` and `CHANGELOG.md` are unchanged, and that is right.** `spec/vision.md:77` has said that dokploy uploads and deploys since AR0601. The first lines of `CHANGELOG.md` say it is "Generated from the merged tickets … a hand edit is overwritten at the next merge", and every recent change to it is a "spec: X merged" commit.
- **Ticket and plan, point by point:**
  - `upload` reads the app first, then sends a multipart form to `application.dropDeployment` with `applicationId`, `zip` and the current `dropBuildPath`.
  - It refuses to switch an app that has deployments and another source unless `--replace-source` is given.
  - `deploy` posts JSON to `application.deploy`.
  - Every refusal of a path or an ambiguous instance or app comes before any request. Swapping `zipOf` to run after `application.one` is caught by a test.
  - The fake checks the Content-Type of each request and parses its body; `readZip` reads every zip back in full.
  - The new routes are in `dokploy-shapes.json`.
  - The coordinator role has the two lines the plan asks for.
- **Size and boundaries:** `dokploy-command.ts` is 152 lines, `dokploy-zip.ts` 59 and `dokploy-api.ts` 69, all green. The structure test, which holds dokploy's 450-line budget, passes. Nothing is imported across a boundary, and no dependency was added.
- **Bypasses I tried on the zip and source guards:**
  - a symlink to a folder inside the folder (refused, since the recursive listing does not follow it);
  - a dangling symlink;
  - a top-level symlink;
  - a FIFO, both inside the folder and as the path itself;
  - a folder named `.zip`;
  - a `.zip` that is not a zip;
  - a zip under another name;
  - `--instance --replace-source`, `--replace-source` given twice or to another verb, and `--` (all usage errors).

  None gets through. The only ways around are the ready-`.zip` path, already F1 in `findings.md`, and the race in the second note below.

## Notes
- (minor) `packages/dokploy/src/dokploy-zip.ts:31`: Dokploy reads `deployments` from `application.one` without checking it. If a later Dokploy drops that field, every non-drop app is refused even with no deployments. That is the safe direction, and a test covers it.
- (minor) `packages/dokploy/src/dokploy-zip.ts:36`: the file is read after the folder is listed. A file swapped for a symlink in between would be followed. It is the owner's own local folder and the coordinator picks the path.

## Checks (all on c8c132bc)
- `npm run check && npm test` (one call, 1800 s timeout): tsc passes. 1588 tests: 1524 pass, 0 fail, 64 skipped. This matches the worker's message.
- `npm run mutate`: 25 mutants, 24 caught, 1 survived; 617 were not run because of the 25 cap. The survivor is `packages/dokploy/src/dokploy-options.ts:42`, "hunk reverted to the base", which only changes the wording of the `tokenEnv` description. Not a finding.
- Hand mutations, each run against `packages/dokploy/test/dokploy.test.ts` (15 tests, all pass before mutating) and restored with `git checkout -- packages/dokploy/src`. The checkout is clean afterwards. Every one was caught, each with exactly one failing test:
  - `if (odd !== undefined)` → `false`, so a symlink or special file inside the folder is no longer refused;
  - `names.length > ENTRIES` → `>=`, the 65535-file limit moved by one;
  - `&& replace === 0` removed, so `--replace-source` is no longer needed;
  - the `dropBuildPath` line disabled;
  - `send !== undefined` removed from the empty-answer check, so a read would accept an empty answer;
  - the top-level symlink and special-file refusal disabled;
  - the 4 GiB check disabled;
  - the usage error for `upload` without a path removed;
  - `zipOf` moved after `application.one`;
  - the empty-folder refusal disabled;
  - the ready-zip check forced to `true`;
  - the "no deployments" exception removed.
- I could not smoke-test the real CLI. A throwaway config in a temporary folder did not load, because this review runs as a job: `plugin projects: setup failed: job 2026-11-06-review-310dc999 is of project ""…`. Commands run inside a job are refused by design, and I did not try to get around that. The command path is covered only by the fake-host tests above.

PASS