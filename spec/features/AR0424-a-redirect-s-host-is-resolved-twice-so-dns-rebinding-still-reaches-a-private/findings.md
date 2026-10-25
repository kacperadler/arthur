# AR0424 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A redirect past the config's host reaches the Fetch standard's bad ports again

- Kind: security
- Found by: 2026-10-25-worker-0eed295e (worker), 2026-10-25
- Where: `packages/uptime/src/site-check.ts:18` (`get`), `packages/uptime/src/uptime-options.ts:23` (`BLOCKED_PORTS`)
- What: before AR0424 every hop went through `fetch`, which refuses a bad port (25, 6667 and the others) without a connection. A hop to another host now goes through `node:http`/`node:https`, which has no such list, so a Location such as `http://mail.example:25/` is connected to and sent a GET. [INFERENCE] from the code: no test redirects to a bad port.
- Suggestion: refuse a Location whose port is on `BLOCKED_PORTS` (exported from `uptime-options.ts`) before the hop, with its own reason; a test with a redirect to port 25 of a fake public name. Out: the config URL, already refused at load.
- Status: fixed in b045905b

## F2. No test reaches an allowed host through the node:http hop

- Kind: test
- Found by: 2026-10-25-worker-0eed295e (worker), 2026-10-25
- Where: `packages/uptime/src/site-check.ts:18` (`get`), `packages/uptime/test/uptime.test.ts`
- What: every test server listens on 127.0.0.1, which the check refuses past the config's host, so no test sees a hop through `get` answer: the `Response` built from it (status, headers, a 204/205/304 with no body), the text judged, `no answer within <n> s` for a node:http hop cut by the time limit (the `/public` case only asserts it is not a refusal, as 192.0.2.1 may be unreachable rather than silent), and `agent: false`, without which a pooled keep-alive socket kept a smoke process alive 10 s after its checks. Only a smoke run against `example.com` covered them.
- Suggestion: a test seam for the connection, such as a `createConnection` the test can replace in this process the way it replaces `dns.lookup`, so a fake public address reaches a local server; then tests for those cases. Out: tests against a real outside host.
- Status: fixed in b045905b

## F3. Embedded-IPv4 IPv6 prefixes are not in the refused ranges

- Kind: security
- Found by: 2026-10-25-worker-0eed295e (worker), 2026-10-25
- Where: `packages/uptime/src/site-check.ts:16` (`PRIVATE`)
- What: NAT64 `64:ff9b::/96` (and `64:ff9b:1::/48`) and 6to4 `2002::/16` carry an IPv4 address inside an IPv6 one; `64:ff9b::a9fe:a9fe` is `169.254.169.254` through a NAT64 gateway. `PRIVATE` refuses IPv4-mapped `::ffff:0:0/96` only, so on a host with NAT64 a redirect to such an address passes the check. [INFERENCE] from the ranges: no test, and no NAT64 here.
- Suggestion: add those prefixes to `PRIVATE`, or extract the embedded IPv4 and check it, with a test per prefix as the refused-ranges test does.
- Status: ticket AR0435

## F4. No test sends a redirect hop over https

- Kind: test
- Found by: 2026-10-25-review-d1076f4c (reviewer, non-blocking note), 2026-10-26
- Where: `packages/uptime/src/site-check.ts`
- What: `node:https` is chosen by the URL's scheme; the smoke runs of review 1 went over https.
- Status: dropped (same code path as http but the module; seen working against real hosts)
