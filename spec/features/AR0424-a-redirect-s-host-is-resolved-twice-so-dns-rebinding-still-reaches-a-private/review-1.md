# AR0424 - Review 1

- Job: 2026-10-25-review-0c49e9ab
- Branch: arthur/2026-10-25-worker-0eed295e
- Commit reviewed: 679927d18bfa35aa31ac0eb8ec5bacc38130c09a
- Verdict: FAIL

## Final message

I'm failing this branch. The rebinding fix works and its required test does fail on main. But the new `node:http(s)` path has two behaviours no test holds, and the branch loses a protection the base had.

## Findings

1. **`packages/uptime/src/site-check.ts:18`: no test covers how `get` turns a hop's answer into a `Response`.**
   - Mutation: `status: answer.statusCode` → `status: 200`, and `[204, 205, 304].includes(answer.statusCode ?? 0)` → `false`. All 20 uptime tests still pass.
   - This code now judges every redirect to another host, which is the common real case (`http://acme.example` → `https://www.acme.example`). With that mutation, a site that redirects to a 500 page would be reported up. It works today only by my smoke run (Checks below), not by any test.
   - The worker logged this as F2 (`Status: open`) instead of testing it. A test is possible without an outside host: replace `net.createConnection` in the process, the way the test file already replaces `dns.lookup`.

2. **`packages/uptime/src/site-check.ts:47`: the time-limit reason for the new hop is untested.** The ticket requires "the time limit, the 20-hop cap and the reasons stay as they are".
   - Mutation: put back main's check, `if (error instanceof DOMException && error.name === "TimeoutError")`, in place of `if (late)`. All 20 uptime tests still pass.
   - Smoke run of a redirect from `httpbin.org` to `postman-echo.com/delay/6` with a 2 s limit:
     - branch: `"no answer within 2 s"`;
     - with the mutation: `"The operation was aborted due to timeout"`.
   - So the reason changes and no test notices.

3. **`packages/uptime/src/site-check.ts:25` / `:18`: a redirect to a bad port is no longer refused.** This breaks "the reasons stay as they are" and drops a safeguard.
   - Smoke run of a redirect to `http://example.com:25/`:
     - main: `{"ok":false,"reason":"bad port"}`, with no connection made;
     - branch: `"AggregateError (ETIMEDOUT)"`, meaning it tried to connect to port 25 and send a GET.
   - `BLOCKED_PORTS` already exists in `uptime-options.ts`; the fix is one port check before the hop. The worker logged this as F1 (`Status: open`) instead of fixing it, although the branch itself causes it.

## Notes (not blocking)

- A connection timeout on a hop to another host now reads `AggregateError (ETIMEDOUT)` where main said `TypeError: fetch failed (ETIMEDOUT)`. Only the wording changes.
- F3 (NAT64 and 6to4 prefixes not on the refused list) was already true before this branch and is outside the ticket's scope.
- The rebinding test is reliable: a site is down only after 2 failed checks, so `asked >= 4` always holds.
- The structure-test budget raise to 296 matches AR-D29.

## Checks run

- `npm ci`: 22 packages added.
- `npm run check`: `tsc`, no errors.
- `timeout 900 npm test`: 1116 tests, 1058 pass, 0 fail, 58 skipped.
- Uptime tests (`node --import @arthur/core/testing --test packages/uptime/test/*.test.ts`): 20 pass, 0 fail, matching the worker's claim.
- The new test against main's `site-check.ts`: it fails (19 pass, 1 fail), as the ticket requires.
- Mutations, each restored afterwards; the working tree is clean:
  - remove `lookup: guarded` in `get`: caught (the rebinding test fails).
  - always use `fetch` (`at.host === named` → `true`): caught (the rebinding test fails).
  - pre-check of the redirect target disabled (`if (false)`): caught (4 tests fail).
  - remove the `late` timeout reason: caught (3 tests fail).
  - `status: 200` and no null-body statuses in `get`: **not caught** (finding 1).
  - main's timeout check in place of `if (late)`: **not caught** (finding 2).
- Smoke runs against real hosts:
  - `http://google.com/`, which redirects to `www.google.com`: `ok`; with `<html` expected: `ok`; with 404 expected: `answered 200, expected 404`.
  - `http://google.com/nope-404`: `answered 404`.
  - A redirect through `httpbin.org` to `https://example.com/` with `Example Domain` expected: `ok`.
  - `no-such-host.invalid` and `expired.badssl.com`: same reasons as on main.
  - Port 25 and the delay case: as in findings 2 and 3.

FAIL