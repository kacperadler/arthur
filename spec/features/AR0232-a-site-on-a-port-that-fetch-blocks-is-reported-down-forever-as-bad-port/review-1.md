# AR0232 - Review 1

- Job: 2026-10-20-review-ar0232-bad-port-r-46053bf2
- Branch: h/2026-10-20-ar0232-bad-port-refused-0de6efe4
- Commit reviewed: be40e88e79f0e6212a6b2d43485e5c7586b3f56b
- Verdict: PASS

## Final message

**Findings:** none — diff fully matches ticket (AR0232) and worker's description.

**Checks run** (in worktree, not main checkout):
- `npm ci`: 17 packages, no errors.
- `npm run check` (tsc): clean.
- `npm test`: 794/794 pass, 0 fail — includes `the repository keeps every rule` (structure/budget test) passing with `uptime: 292`.
- `wc -l packages/uptime/src/*.ts` → 292 total, matches `BUDGETS.uptime` and the ticket's approved 288→292 raise (Decisions entry already present on `main`'s ticket).
- Live full port sweep on this machine (Node v24.21.0, same as worker's): fetched all 65535 ports on 127.0.0.1, 82 failed with `bad port`, exact same 82-port list as `BLOCKED_PORTS` in the diff — list is correct and complete for this Node.
- Mutation: disabled the refusal (`if (false && BLOCKED_PORTS.includes(port))`) → new test fails exactly as worker reported (expects the port-9 problem, gets `[]`). Restored file afterward (`git status --short` clean).
- Manually traced `port` computation: `address(url) === undefined` (valid http/https) gates `new URL(url).port`; default ports (`http://x/`, explicit `:80`, `:443`) normalize to `""` via the URL class, never matching `BLOCKED_PORTS` — matches the "default ports never refused" requirement and the test's explicit coverage of 80/443/neighbour ports.
- Scope: only `packages/uptime/src/uptime-options.ts`, its test, `packages/uptime/docs/uptime.md`, and the root `test/structure.test.ts` budget line changed — matches ticket's Scope and the Decisions-approved budget raise; nothing else touched.
- No boundary, shape, or styleguide violation: no new file, no class/enum, no runtime dependency, plugin stays inside its own files, comment above the constant states why/source.

Worker's final message matches the diff and reproduced results exactly; no fabricated claims found.

PASS
