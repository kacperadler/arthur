# AR0532 - A job final message naming @<path> makes the coordinator read that file into its own context

```json
{
  "id": "AR0532",
  "title": "A job final message naming @<path> makes the coordinator read that file into its own context",
  "date": "2026-10-27"
}
```

## Description

Found by the coordinator, 2026-10-27, at about 22:00: the wake for job 2026-10-27-worker-6c7b3978 (AR0487) quoted the worker's final message, which named the test input `@/etc/passwd`. The coordinator's next turn carried the whole of `/etc/passwd` as an attached file block right after that message. Nothing asked for it: omp expanded the `@<path>` mention in the message text that `packages/orchestration/src/inbox-extension.ts:95` hands to `pi.sendUserMessage`, as it expands an `@` mention a human types.

So any text that reaches the coordinator as a message (a job's final message or question, a review, a CI log line, an owner's forwarded text, an issue) can name a file, and omp reads it with the owner's rights, outside every job's sandbox and the env guard: the env file, `~/.ssh` keys, another project's files. The coordinator could then quote it in a reply that a channel sends.

## Goal

Text the coordinator receives as a message never makes omp read a file. Evidence: the turn above; the delivery at `packages/orchestration/src/inbox-extension.ts:95`.

- Kind: security

## Done means

- A message whose text holds `@<path>` (at the start, after a space, inside a quoted line, after `> `) reaches the coordinator as that text, with no file attached; a test through the inbox extension with a fake `pi` shows the exact content handed over, and fails without the fix.
- How omp 18 expands `@` in `sendUserMessage` is stated in the ticket's findings, with the source it was read from; if an option of `sendUserMessage` turns the expansion off, it is used, else the text is escaped so omp does not see a mention, and the doc says how.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/orchestration/src/inbox-extension.ts` (or `inbox.ts`, where the message text is built) and its test.
- `packages/orchestration/docs/` where the inbox is described.

Out:
- The coordinator's sandbox: AR0483.
- Marking outside text in the system prompt: AR0485.

## Decisions

- 2026-10-27: Source: the coordinator's own turn on AR0487's wake (an `@/etc/passwd` in a job's message was read into the coordinator's context)
- 2026-10-27: AR0532 approved; start it in the next free slot, ahead of the rest of Q2-Q4; the owner: "AR-D208 1" (AR-D208)
- 2026-10-28: AR0532 another round: the worker adds test cases for the less common spaces before an at-sign, then review round 3; the owner: "AR-D219 1 AR-D220 1" (AR-D219)
