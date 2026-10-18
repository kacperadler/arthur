# AR0157 - Outcome

- Merged: 2026-10-19, `289fa48`
- Branch: h/2026-10-18-ar0157-0be32dff
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $5.80, reviews $1.28; review rounds 2

## What went in

- `packages/session/src/start-notice.ts`: at every `arthur run` start asks the coordinator's model for one word (`omp -p --no-session --no-tools ... --model <coordinator model>`, cut at 60 s) and sends `coordinator up on <host>` or `no LLM access on <host>: <reason>; run omp login`; `probeLlm: false` skips it.
- `turn-extension.ts`: a coordinator turn that fails before any text writes its failure, credentials removed, into `.arthur/session/turn-failed/`; `arthur run` sends each as `turn failed on <host>: <reason>` within 500 ms; failures from before this start are dropped.
- `credential.ts`: removes values of env variables named like KEY, TOKEN, SECRET, PASSWORD, CREDENTIAL, AUTH, Bearer tokens, vendor-prefixed keys and long mixed runs, replacing each with `[redacted]`.
- Session budget 691; docs, README, `arthur.mmd`: entry 38 built, the session plugin complete (35 to 38).

## Checks on main

- `npm run check`: passed.
- `npm test`: 540/540 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0164 (F1), AR0165 (F2).
