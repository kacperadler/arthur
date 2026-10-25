# AR0340 - Review 2

- Job: 2026-10-25-review-3c2d06da
- Branch: arthur/2026-10-25-worker-f639b3da
- Commit reviewed: d4fb49eed0dd8364672485488ea677a96b11999c
- Verdict: PASS

## Final message

## Review of AR0340, branch `arthur/2026-10-25-worker-f639b3da` at `d4fb49ee`

Both findings from review 1 are fixed, and I found nothing that blocks the merge. `redact(text, secrets)` takes the values to replace as an argument. The host gives every plugin `host.secrets`: the values only, from every enabled plugin, whether they come from the env file or the shell. Every caller named in the ticket now passes `host.secrets`, and each has a test where the value is only in the env file, not in `process.env`.

## Findings

None that block the merge.

## Notes (not blocking)

- **Part of a secret can still reach the phone through the two-step paths.** These are `inbox-extension.ts:116` followed by `inbox.ts:182`, and `turn-extension.ts:44` followed by `start-notice.ts:96`. The extension first redacts with `[]`, so its pattern rules can rewrite part of a secret from the env file. After that, the plugin can no longer match the whole value.
  - I reproduced it: `redact(redact("401 pass-word-sk-live-4f9a8b7c", []), [s])` gives `401 pass-word-[redacted]`. A single pass gives `401 [redacted]`.
  - The same happens with a Telegram bot token: the `<bot id>:` part stays visible.
  - What leaks is only the part before a vendor-style key or a long token, never the whole value. A fix: the extensions leave the raw text, and the plugin side does all the redaction.
- **`decision-class.ts:42`:** switching `propose` back to `redact(…, [])` breaks no test. In practice this code is close to unreachable. `propose` requires `--decided` to be the same as the backing answers and the `--match` words to appear in the backing questions. Both of those are read from the log, which is already redacted, so a raw secret there gets refused. I tried it: putting the secret in `--decided` made `propose` refuse.
- **The `secrets` array is shared.** `host.ts:42` gives the same array object to every plugin. The `readonly` type only exists at compile time, so a plugin that mutates the array changes what every other plugin redacts.
- **Short values are never redacted.** Env values under 8 characters are skipped on purpose, and the docs say so.
- **The blocked-job notice is still unredacted** (`findings.md` F1, `open`). Whether that fix comes with this ticket is your call.
- **Unredacted copies stay on disk** in `turn-failed/` and `outbox/sent/`, both inside the home folder. Review 1 already noted this; it is unchanged.

## Checks run

- `npm ci`: added 22 packages.
- `npm run check` (tsc): no errors.
- `timeout 900 npm test`: 1115 tests, 1057 pass, 0 fail, 58 skipped. The structure tests (line budgets, 200-line file limit, plugin boundaries) passed.
- Mutations, run in a scratch copy under a `mktemp` folder that was then deleted (my checkout's `git status` is clean). The worker's claims match what I got:

| Mutation | Result |
|---|---|
| `>= 8` → `>= 9` in both `credential.ts` copies | caught: 2 fail (`decisions` env-file test, `start-notice` no-LLM test) |
| `>= 8` → `>= 7` in both | caught: 2 fail (same tests) |
| longest-first sort removed, session only | caught: 1 fail (`start-notice`) |
| longest-first sort removed, orchestration only | caught: 1 fail (`decisions`) |
| `decision-class.ts:42` `propose` → `[]` | not caught: 126 pass, 0 fail, 37 skipped (see the note above) |

- A `node -e` call to `redact` reproduced the two-step partial leak described in the first note.

PASS