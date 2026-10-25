# AR0367 - Review 1

- Job: 2026-10-25-review-126f54b1
- Branch: arthur/2026-10-25-worker-f58f2f36
- Commit reviewed: 0ab348cb860e90bd5517d4369867f7b9db4d4707
- Verdict: FAIL

## Final message

The branch does the main job and every check passes. It still fails because nearly all of the refusal's address list can be deleted without any test noticing.

## Findings

1. **`packages/uptime/src/site-check.ts:14`: most of the list of refused address ranges is untested.** I deleted each range below on its own and ran `packages/uptime/test/uptime.test.ts`. The suite still passed every time:
   - `["fe80::", 10]`
   - `["::", 127]` (this covers `::1`)
   - `["fc00::", 7]`
   - `["10.0.0.0", 8]`
   - `["172.16.0.0", 12]`
   - `["192.168.0.0", 16]`
   - `["100.64.0.0", 10]`
   - `["0.0.0.0", 8]`

   The ticket's Done means names these ranges: link-local `fe80::/10`, loopback, and the private ranges of `model-options.ts:27-30`. The tests only reach `127.0.0.0/8` (directly and as `::ffff:127.0.0.1`) and `169.254.0.0/16`. So the refusal can be switched off for IPv6 loopback, IPv6 link-local and all private ranges and nothing fails. The review criteria count an uncaught mutation of a key behavior as a FAIL.

   The tests would be cheap to add. A redirect to a literal address (`http://[::1]:<b>/`, `http://[fe80::1]/`, `http://10.0.0.1/`, `http://192.168.0.1/`, `http://172.16.0.1/`, `http://100.100.100.200/`, `http://[fd00:ec2::254]/`) is refused before `fetch` runs, so it never opens a connection.

2. **`packages/uptime/src/site-check.ts:24`: changing `.some(` to `.every(` is not caught.** The ticket says a host is refused if any of its addresses is private. Every host in the tests resolves to a single address, so a host with one public and one private address would get through with no test failing. This needs a name that resolves to mixed addresses, which is harder to build into a test. I note it rather than counting it as a separate reason to fail.

## Notes (not blocking)

- **DNS rebinding (F1 in the worker's findings):** `lookup` and `fetch` each resolve the host. The ticket asked for the `dns.lookup` approach, and the worker recorded this as an open finding, which is correct.
- **`site-check.ts:21`, 3xx without a `Location`:** removing `!response.headers.has("location") ||` is not caught. A 3xx with no `Location` would then be followed to `/null`.
- **Redirect statuses:** dropping 303 and 308 from the list is also not caught.
- **`lookup` ignores the time limit:** it does not use the check's `signal`, so a slow resolver can run past `limitSeconds`.
- **`data:` redirects:** a redirect to a `data:` URL has an empty host. `lookup("")` returns `[]`, so it is followed and its contents are judged. No request goes out, so this is not a way around the refusal.
- **`uptime.ts`:** four blocks were folded onto single lines only to stay under the 292-line budget. Behavior is unchanged, but this buys room instead of asking for a budget raise.

## Checks run

- `npm ci`: added 22 packages.
- `npm run check`: tsc clean.
- `timeout 900 npm test`: 1110 tests, 1052 pass, 0 fail, 58 skipped.
- Mutations on `packages/uptime/src/site-check.ts`, each followed by a run of `packages/uptime/test/uptime.test.ts` and restored with `git checkout --`. All 11 survived: the 8 range deletions above, `.some` → `.every`, the status list cut to `[301, 302, 307]`, and the `Location` check removed. `git status` is clean afterwards.
- `dns.promises.lookup("", { all: true })` returns `[]`, which is why the `data:` redirect is followed.
- The ticket's own test case (`localhost:<a>` → `127.0.0.1:<b>` is refused and `<b>` gets no request), the same-host redirect, and the 20/21-hop limit are all covered. The worker's claims match what I saw: the docs at line 24 and in the failure-reason list, the `url` text in `uptime-options.ts`, and the line count within the 292 budget (the structure test passes).

FAIL