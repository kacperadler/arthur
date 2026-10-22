# AR0290 - The telegram menu test failed once in a full `npm test` and passes alone

```json
{
  "id": "AR0290",
  "title": "The telegram menu test failed once in a full `npm test` and passes alone",
  "date": "2026-10-22"
}
```

## Description

one full `npm test` on this branch (986 tests) failed this test alone, in 37 ms; the branch touches no telegram file. Run alone it passed 7/7, and six copies of the file run at once all passed (`node --import @arthur/core/testing --test packages/telegram/test/commands.test.ts`). The failure's message was not kept. [INFERENCE] a start is stopped once the fake Bot API has seen the menu call and a poll, which may be before the plugin wrote `menu.json`, so the next start sets the menu again and the count assertion fails under load.

## Goal

The telegram menu test passes in every full `npm test`, not only alone: its cause is found and fixed, so a merge is never refused by it.

- Kind: bug

Evidence:
- `packages/telegram/test/commands.test.ts:119` ("the menu is the phone commands, set at a start only when they changed since the last one set, per bot")
- Found by: 2026-10-22-ar0277-eval-turn-wording-9459b77a (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: make each start in the test wait for the very state it asserts next (the record written, not only the API call seen); reproduce first under load (the full suite) to get the message.
- `npm test` and `npm run check` pass.

## Scope

In:
- make each start in the test wait for the very state it asserts next (the record written, not only the API call seen); reproduce first under load (the full suite) to get the message.

## Decisions

- 2026-10-22: Source: F2 of AR0277
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
