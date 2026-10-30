# AR0587 - The report check tests skip on this server since the test kit moved HOME

```json
{
  "id": "AR0587",
  "title": "The report check tests skip on this server since the test kit moved HOME",
  "date": "2026-10-30",
  "budget": 3
}
```

## Description

Since AR0577 the test kit sets `HOME` to its own folder, so the report check's tests no longer find this server's only browser, which lives under the real home, and all of them skip here. After this, they run again on this server, in every worker's, reviewer's and merge's `npm test`, not only on GitHub's runner.

## Goal

The merge of AR0577 (4b974151) ran `npm test` with 1254 of 1335 passed and 81 skipped; the merge before it (AR0575, 7431ebe0) had 1264 of 1332 and 68 skipped. The 13 more are the report-check tests.

Evidence:
- This server has no `chromium`, `chromium-browser` or `google-chrome` on `PATH`; its browser is `~/.cache/ms-playwright/chromium_headless_shell-*` (`which` finds none; `ls` finds 1243 and 1248).
- `test/report-check.test.ts:75`: `BROWSER` looks under `join(homedir(), ".cache/ms-playwright/...")`, and `homedir()` follows `HOME`, which `packages/core/src/test-env.ts` (AR0577) sets to the kit's root; with none found, `skip` skips every test.
- `.agents/arthur/criteria/report.md:179`: the check looks under `homedir()` the same way, and the tests run it with the kit's `HOME`.

- Kind: test

## Done means

- The report-check tests find the browser under the real user's home (for example `os.userInfo().homedir`, which reads the user database, not `HOME`) and hand it to the check they run as `CHROME`, so they run on this server again; the check itself stays as it is.
- `npm test` here shows the report-check tests run, not skipped, named in the final message with the skipped count before and after.
- `npm run check` and `npm test` pass.

## Scope

In:
- `test/report-check.test.ts`.

Out:
- The test kit's `HOME` stays its own (AR0577).
- `.agents/arthur/criteria/report.md` stays as it is.

## Decisions
- 2026-10-30: AR0587 approved with $3, next in the queue, under the owner delegation to go with my recommendations; the owner: "i have to focus on my work, go with recomendations and do not cross 70% of weekly usage, do to silent mode" (AR-D371)
- 2026-10-30: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)

