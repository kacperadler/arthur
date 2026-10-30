# AR0578 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The structure check reads a quote or backtick inside a regex literal as the start of a string

- Kind: test
- Found by: 2026-10-30-worker-f9e3eee7 (worker), 2026-10-30
- Where: `test/structure.ts:16` (`TOKENS`)
- What: `TOKENS` knows strings and comments, not regex literals. `/^```mermaid\n/` in `test/structure.test.ts` (then lines 130 and 132) opened a template string that ran to the next backtick, so the rest of the file was read with strings and code swapped: the new until rule then saw fixture strings as code and refused the file. This branch replaced those backticks with `\x60`. Any other file with a quote or backtick in a regex literal is read the same wrong way, by every rule (class, enum, imports, until, fixed waits), which can hide a problem or invent one.
- Suggestion: let `TOKENS` also match a regex literal (a `/` after `(`, `,`, `=`, `:`, `[`, `!`, `&`, `|`, `?`, `{`, `}`, `;` or a line start, up to its closing unescaped `/` outside a class), kept as is by `strip`; with a structure test of a regex literal holding `"`, `'` and a backtick.
- Status: open

## F2. The fixed-wait baseline only refuses growth, so a file can climb back to its old count

- Kind: test
- Found by: 2026-10-30-worker-f9e3eee7 (worker), 2026-10-30
- Where: `test/structure.ts` (`checkTestFile`), `test/structure.test.ts` (`FIXED_WAITS`)
- What: a file whose fixed waits drop below its `FIXED_WAITS` number passes, and a later change may add waits back up to the old number unrefused; the comment asks to lower the number, nothing checks it. A loop whose sleep is on a line after its header, or a synchronous `Atomics.wait` poll (`packages/core/test/job-control.test.ts:500`, inside a mocked synchronous function where the async `until` cannot run), is refused only through that count, not as a loop.
- Suggestion: refuse a count under the baseline too (`has N fixed waits, under its baseline of M; lower it`), so the numbers only go down. Out: reading loops over several lines.
- Status: open
