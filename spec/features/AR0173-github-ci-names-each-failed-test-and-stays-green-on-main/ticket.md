# AR0173 - GitHub CI names each failed test and stays green on main

```json
{
  "id": "AR0173",
  "title": "GitHub CI names each failed test and stays green on main",
  "date": "2026-10-19"
}
```

## Description

GitHub CI on main must always be green, and when a run fails we must be able to read which test failed and why without a GitHub token.

## Goal

After AR0167, 1 of the last 20 ci runs on main still failed: 6b1acdb at 2026-10-19 06:02. That commit changed only a ticket, so its code matched a green run. Reading the job log needs a token we do not have. Annotations are public, but this one says only "Process completed with exit code 1". GitHub is also moving `ubuntu-latest` to Ubuntu 26 from 2026-10-19, and the move may change timings. Vision: work runs unattended, so a red CI must name its cause.

- Kind: bug
- Budget: 10

## Done means

- When a test fails, its name and the first lines of its error appear in the run's annotations. Prove it on a throwaway commit with a test that fails on purpose, and read the annotations with `curl https://api.github.com/repos/kacperadler/arthur/check-runs/<id>/annotations` (no token). Revert that commit before the review, and record the curl output in findings.md.
- Each flaky test that is found gets fixed at its cause: wait for the very state the test asserts, never a longer sleep. findings.md names the test and its symptom.
- The full suite passes 30 times in a row under `taskset -c 0,1`, 3 runs at once, with the counts in findings.md. 5 pushes of the branch in a row are green on `ci` on GitHub. An empty commit for each push is fine.
- `npm test` and `npm run check` pass.

## Scope

In:
- `.github/workflows/ci.yml`:
  - pin `runs-on: ubuntu-24.04`;
  - split `npm ci`, `npm run check` and `npm test` into separate steps;
  - when `npm test` fails, print one `::error title=<test name>::<first lines of its error>` line per failed test, from node's own output, with no new dependency.
- Any test the annotations or the stress runs show to be flaky.

Out:
- Other CI providers, and a macOS runner.

## Decisions

- 2026-10-19: Owner, on red CI: "zanim coś wjedzie do main to musi mieć zielone CI". This approves the ticket.
- 2026-10-19: Coordinator (owner delegated Arthur calls): core 5116 -> 5127 (+11, oomFirst in the wrapper) accepted. Merge waits for the coordinator's 30-run stress on f53fc97 and green ci on the tip.
