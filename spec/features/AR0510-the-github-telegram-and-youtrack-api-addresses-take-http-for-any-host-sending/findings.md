# AR0510 - Findings

Notes from the reviews of AR0510, settled at the merge.

## F1. `arthur youtrack --help` still words the URL refusal the old way

- Kind: docs
- Found by: 2026-10-29-review-401ad53a (reviewer), 2026-10-29
- Where: `packages/youtrack/docs/commands/youtrack.md:72`
- What: it says the refusal is for a URL variable that does not hold an `http` or `https` URL, which reads as if `http` were fine on any host; `docs/youtrack.md` was updated.
- Status: deferred (client summary)

## F2. Weaker scheme checks the telegram and youtrack tests do not catch

- Kind: test
- Found by: 2026-10-29-review-401ad53a (reviewer), 2026-10-29
- Where: `packages/telegram/src/telegram-options.ts`, `packages/youtrack/src/youtrack.ts`
- What: `protocol === "http:"` turned into `protocol !== "ftp:"` still passes their tests (github's catch it); the `{2,3}` and `/i` changes cannot change behaviour.
- Status: dropped (fetch refuses other schemes and the host stays loopback)
