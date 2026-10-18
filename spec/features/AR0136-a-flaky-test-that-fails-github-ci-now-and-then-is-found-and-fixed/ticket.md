# AR0136 - A flaky test that fails GitHub CI now and then is found and fixed

```json
{
  "id": "AR0136",
  "title": "A flaky test that fails GitHub CI now and then is found and fixed",
  "date": "2026-10-18"
}
```

## Description

GitHub's `ci` workflow (`npm ci && npm run check && npm test` on ubuntu-latest) fails now and then on code that passes elsewhere: on main 66a6a42 (passed on the next commit), on 849397e and f4b76a2 of AR0126 (the same code passed on bb40d22). The logs cannot be read here (no GitHub token). One suspect: the inbox test `[Arthur] Job … ended its run` failed once on this server and passed on rerun.

## Goal

`npm test` passes every time on a slow runner; no test depends on timing luck.

- Kind: bug

## Done means

- The flaky test is found by running the suite many times under load (for example `stress` or several runs in parallel, with `--test-concurrency` as CI uses it), and the failing assertion and its cause are named in the ticket's findings.
- Its fix waits for the very state it asserts, never a fixed sleep or an earlier signal; a gap it must land in is held open; its deadline is a ceiling sized for a slow CI runner.
- Every other test with the same pattern (a fixed sleep, a short deadline, a race on a file or a process) gets the same fix.
- Proof: the fixed tests pass 20 runs in a row under the same load that made them fail before; `npm run check` and `npm test` pass.

## Scope

In:
- Test files, and the test kit in `packages/core/testing`.

Out:
- Production code, unless the race is a real bug there; then name it in findings first.

## Decisions

- 2026-10-18: The owner: a flaky test must be found and fixed; approved past the 58% usage stop.
