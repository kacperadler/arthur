# AR0341 - Review 2

- Job: 2026-10-25-review-49ab00d3
- Branch: arthur/2026-10-25-worker-da17ff9b
- Commit reviewed: 298e280b6e118ee0b09e0d2d215d18fba757129c
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The blocked notice and the wake both redact a blocked job's question, and they use the env file's values (`host.secrets`) to do it. The ticket's example key `sk-live-4f9a8b7c6d5e4f3a2b1c` becomes `[redacted]` on the phone and in the wake. The wake's final message now loses only the env file's values, so job ids, ticket folders and commit hashes stay readable, as AR-D31 asks.

## Findings

None.

## Notes

- **`packages/orchestration/src/inbox.ts:134-135`:** the first line of the final message (`Blocked: user <question>`) still gets every redaction rule. This is the exception the coordinator accepted. It is only applied when the job is blocked on the owner, and in that case the job state code (`job-state.ts:50`) always takes the reason from the final message's first line. So the right line is always the one redacted.
- **One mutation the tests don't catch, and it doesn't matter:** passing `[]` instead of `host.secrets` to that first-line `redact` still passes. The line has already been through `redactValues(message, host.secrets)` by then, so the mutated code behaves the same.
- **`inbox.ts:129-130` and `:133`, `Blocked: on` lines:** a dependency block such as `Blocked: on sk-live-…` still reaches the wake as written, both in `ended its run: blocked (dependency: …)` and in the final message's first line. Only the question of a `Blocked: user` line is covered. This falls under the risk AR-D31 accepted for lines of the final message other than the `Blocked: user` one, and the ticket names only the question.
- **`inbox.ts:133`:** `redactValues` uses `host.secrets` only. Values of process environment variables whose names look secret (`*TOKEN*`, `*KEY*` and so on), which `redact` also removes, are not removed from the wake's final message lines. The coordinator's values-only decision allows this. Before this branch the wake redacted nothing, so nothing got worse.
- The ticket asks to redact "the hand-over's message". `hand-over.ts` only quotes the wake text, so redacting inside `wake()` covers it. Leaving `hand-over.ts` unchanged is correct.
- Plugin lines in the wake that quote the final message are still unredacted. The branch records this as F2, still open.
- **Line budget:** orchestration goes from 2330 to 2337, which matches the numstat (blocked-notice +13 −13, inbox +7 −4, credential +7 −3). The comment in the structure test cites AR-D29 and AR-D31.

## Checks I ran
- `npm ci`: 22 packages installed.
- `npm run check` (`tsc`): no errors.
- `timeout 900 npm test`: 1119 tests, 1061 passed, 0 failed, 58 skipped.
- `node --test packages/orchestration/test/job-states.test.ts`: 11 passed, 0 failed, none skipped.
- **Mutations:** I ran each against `job-states.test.ts`, or the whole orchestration test folder for `credential.ts`, and restored each with `git checkout`. Afterwards `git status` was clean at 298e280b.

| Mutation | Caught? |
|---|---|
| Notice: `redact(question, host.secrets)` replaced by `question` | Yes, by the new test and the crash-path test |
| Notice: `host.secrets` replaced by `[]` | Yes, by both tests |
| Wake question: no `redact` | Yes |
| Wake question: `redact(…, [])` | Yes |
| Final message: `redactValues(message, [])` | Yes |
| Final message: `redactValues` replaced by `redact` | Yes |
| First-line `redact` removed (`if (false)`) | Yes |
| First-line condition inverted (`asks === undefined`) | Yes |
| First-line `redact(…, [])` | No, but the code behaves the same (see the second note) |
| `credential.ts`: length limit changed to `>= 9` or `>= 7` | Yes, by the env-file value test |
| `credential.ts`: longest-first sort removed | Yes, by the same test |

PASS