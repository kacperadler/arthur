# AR0368 - Outcome

- Merged: 2026-10-25, `a43f13dd`
- Branch: arthur/2026-10-25-worker-57a09c12
- Reviews: review-1.md PASS
- Cost: worker $0.60, reviews n/a; review rounds 1

## What went in

- `packages/models/src/probe.ts`: the probe starts `curl -q --config -` and its config holds `noproxy = "*"`, so no `.curlrc` and no proxy variable decide where the request with the key goes.
- `packages/models/docs/models.md`: says what `-q` and `noproxy` each stop.
- `packages/models/test/models.test.ts`: with a `.curlrc` (a proxy and a header) under `CURL_HOME` and `http_proxy` set, a pick on the local fake still answers and the fake never sees the header; the ssh test expects the new command.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1109/1109 passed.

## Left open

- Findings: F1, F2, review notes, dropped (see findings.md).
