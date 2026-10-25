# AR0340 - Review 1

- Job: 2026-10-25-review-ed206968
- Branch: arthur/2026-10-25-worker-f639b3da
- Commit reviewed: cac91193fddd23e07a873c7a4dfb59065a1d251e
- Verdict: FAIL

## Final message

**Review: AR0340, branch `arthur/2026-10-25-worker-f639b3da` at `cac91193`**

The fix works, but I'm failing it because one boundary isn't tested: you can move the 8-character limit by one and every test still passes.

## Findings

1. **`packages/session/src/credential.ts:8` and `packages/orchestration/src/credential.ts:9`: the new length limit on `secrets` has no boundary test.** This range now applies `.filter((value) => value.length >= 8)` to `host.secrets` too. The new tests only check values well under the limit: `Drop` (4 characters) in `decisions.test.ts:367` and `401` (3 characters) in `start-notice.test.ts:73`.
   - I changed `>= 8` to `>= 9` in both files and ran `start-notice`, `decisions`, `inbox` and `job-states`: 51 pass, 0 fail.
   - Any limit from 5 to 21 passes the suite, because the only long value is the 21-character `correct-horse-battery`.
   - With `>= 9`, an 8-character password from the env file reaches the phone and `spec/decisions.jsonl`, which is exactly what this ticket is about. The review criteria count an uncaught "limit moved by one" as a FAIL.
   - Fix: add a test with an exactly 8-character env value that must come out `[redacted]`, and a 7-character one that must stay.

2. **`packages/orchestration/src/credential.ts:9-11` (same in session's copy): part of a secret leaks when one secret starts with another.** Values are replaced in load order, not longest first. If one configured value is a prefix of another, the longer one is only partly replaced. I reproduced it with `redact("token abcdefgh-longer-tail and x", ["abcdefgh", "abcdefgh-longer-tail"])`, which returns `token [redacted]-longer-tail and x`. Sorting the values by length, longest first, before the `reduce` closes it.

## Notes (not blocking)

- **Unredacted copies stay on disk.** `turn-extension.ts:44` and `inbox-extension.ts:116` pass `[]` and rely on the plugin side to redact later, in `turnFailures` and the inbox's `sweep`. Each test I mutated caught the downstream redaction. Until then, though, a value from the env file sits unredacted in `<home>/session/turn-failed/*.txt`. In the outbox it stays unredacted for good, because `sweep` moves the raw file to `outbox/sent/`. Both folders are under the home folder, which is 0700.
- **`inbox.ts:182` now redacts every outbox notice with the full rules.** That includes the "could not hand N message(s)" notice from `inbox-extension.ts:89`, which was never redacted before. It's protective, but a side change that the worker never explained (it left no final message).
- **The blocked-job notice is still unredacted** (findings.md F1, status open). The ticket's Description names "a job's question … reaches a Telegram notice". The worker scoped it out because the Done means only lists the callers of `redact`. Whether F1 ships with this ticket is the owner's call.
- **Other ways a secret gets past exact-value matching:** a value that is JSON-escaped, URL-encoded or base64-wrapped in an error text isn't matched. This is how the redaction works already, not something this range introduced.
- **`decision-class.ts:42`** (`propose`: the class's `match` and `decided` texts) has no test with a value from the env file. It isn't in the ticket's evidence list.

## Checks run

- `npm ci`: added 22 packages.
- `npm run check` (tsc): no errors.
- `timeout 900 npm test`: 1115 tests, 1057 pass, 0 fail, 58 skipped. The structure test passed, including the 200-line file limit and the line budgets. `decision-log.ts` is at exactly 200 lines.
- Mutations; every file was restored with `git checkout --` and `git status` is clean:

| Mutation | Result |
|---|---|
| `inbox.ts:182` notice redaction removed | caught: `inbox.test` "a notice the inbox extension left…" |
| session `.concat(secrets)` removed | caught: 2 `start-notice` tests |
| `start-notice.ts`: `line(reason, [])` and probe given `[]` | caught: probe test and turn-failure test |
| orchestration `.concat(secrets)` removed | caught: 3 tests (`decisions`, `inbox`, `job-states`) |
| `decision-hooks.ts:53` → `[]` | caught: `decisions` env-file test |
| `decision-hooks.ts:27` → `[]` | caught: `decisions` env-file test |
| `decision-log.ts:169,170,190,197` and `decision-class.ts:58` → `[]` | caught: `decisions` env-file test |
| `host.ts` `secrets = []` | caught: `host.test` "host.secrets hands every plugin…" |
| `length >= 8` → `>= 9` in both `credential.ts` | **not caught**: 51 pass, 0 fail |

- `node -e` call to `redact` with one secret that starts with another: printed `token [redacted]-longer-tail and x`.

FAIL