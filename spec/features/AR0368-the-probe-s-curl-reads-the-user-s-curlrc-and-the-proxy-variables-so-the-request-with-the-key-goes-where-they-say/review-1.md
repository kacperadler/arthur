# AR0368 - Review 1

- Job: 2026-10-25-review-8b32bb2a
- Branch: arthur/2026-10-25-worker-57a09c12
- Commit reviewed: babbb8134f1c7ee17927e26b22cadf4ec55ec22a
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0368 asks, and the full suite passes when I run it myself.

**Findings**

None. Each Done means point is met:
- **Command:** `packages/models/src/probe.ts:70` starts curl as `["curl", "-q", "--config", "-"]`, with `-q` first.
- **Config:** `probe.ts:64` adds `noproxy = "*"` to the config lines.
- **Docs:** `packages/models/docs/models.md:29` now says `curl -q --config -` and what `-q` and `noproxy = "*"` each stop.
- **Test:** `packages/models/test/models.test.ts:154-168` sits beside `:152`. It sets `CURL_HOME` to a temporary folder holding a `.curlrc` with `proxy = "http://127.0.0.1:1"`, and sets `http_proxy` to the same address. It checks that a pick on the local Ollama fake still answers, and puts both variables back afterwards.
- **ssh test:** `models.test.ts:274` now expects `'curl' '-q' '--config' '-'`.
- **Extra header:** the worker's `header = "X-Curlrc: read"` line in the `.curlrc` goes beyond the ticket's wording, and the final message gives the reason. Without it, removing `-q` alone would not fail the test, because `noproxy = "*"` also overrides the `.curlrc` proxy. My mutation below confirms that reason.
- **Boundaries and resources:** no import outside `@arthur/core`'s exports. The test uses no production resource name; port 1 on loopback is only a refused connection.
- **Line budget:** source lines are net zero (`probe.ts` +3 −3), so models stays within its 509-line budget.

**Notes**

- To keep the line count flat, `"silent", "show-error"` now share one line. That is taste, not a finding.
- The test sets only `http_proxy`, not `HTTPS_PROXY` or `ALL_PROXY`. `noproxy = "*"` covers every proxy variable, so this is not a gap in what the fix does.

**Checks run**

- `npm ci` installed 22 packages.
- `npm run check`: `tsc` finished with no errors.
- `timeout 900 npm test`: 1109 tests, 1051 pass, 0 fail, 58 skipped, in 198 s.
- **Mutation, `-q` removed:** the new test fails with actual `[['/api/tags','read']]`, expected `[['/api/tags', undefined]]`, so the `.curlrc` was read.
- **Mutation, `noproxy` line removed:** the new test fails with `unreachable: curl: (7) Failed to connect to 127.0.0.1 port 1`.
- **Mutation, both removed:** the same `unreachable: curl: (7) …` failure the ticket predicts.
- I put every mutation back with `git checkout -- packages/models/src/probe.ts`, and `git status --short` shows a clean tree.
- The worker's claims match what I see: the before-fix failure, both of its mutations, and the files changed.

PASS