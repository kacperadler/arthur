# AR0656 - A worker is told before its run ends that its checks did not pass on its clean committed tip

```json
{
  "id": "AR0656",
  "title": "A worker is told before its run ends that its checks did not pass on its clean committed tip",
  "date": "2026-11-06"
}
```

## Description

A worker whose run ends before check, test and mutate passed on its clean committed tip gets one reminder from the checks extension, so it fixes that itself instead of the coordinator continuing it by hand after `arthur review` refuses the tip.

## Goal

each miss costs a coordinator turn, a second worker run and often a third: about 22 times in a week. Telling the worker before it ends works the same way the processes reminder AR0585 does, so the miss is caught while the worker is still running.

Evidence:
- Corrections, each a hand-written continue after `arthur review` refused the tip:
  - "check and test ran on ef9c19a", not the tip 6960ba5
  - "dirty tree (mutate had files changed while they ran)"
  - "dirty tree at e43db3f (… a measuring script)"
  - "latest test record on the tip 36a4dce is a fail"
  - "dirty tree at 3cf3d73"
  - "mutate is recorded on 3cf3d73, not the tip 0535553c"
  - "dirty tree at 6447f00"
  - "again … dirty tree at 71d2bb9"
  - "refused your tip f8a47c0: check ran on a dirty tree"
  - "still refuses f8a47c0"
  - "needs a mutate line on the clean tip fac1ae5f"
  - "needs a mutate line on the clean tip 9974806"
  - "refuses the tip 9f48817a until mutate runs there"
  - "Your last commit 4104779 (docs) came after check and test ran"
  - "checks record on your tip 21d730a1 says test fail … and mutate fail"
  - "Delivery needs npm run mutate on the clean tip"
  - "recorded your last checks on c8c132b (dirty), not on the merge commit"
  - "On the clean tip b5476e1e / 987b4a45 / fafa3715 run npm run check and npm test" (3 continues)
  - "On the clean tip d4d367f3 run npm run mutate once"
  - "Correction to your checks at the end"
- The rule exists only in code. `review-command.ts:126` (`untested`) refuses such a tip. `hand-back.ts:82` sends the fix text only after a FAIL. Neither `worker.md` nor `verify.md` says that the checks must run on the committed tip and that nothing may change after them.

- Kind: chore

## Done means

- A worker run that ends with no clean check, test or mutate line on its committed tip gets one `[Arthur] Before your run ends` reminder naming what is missing; a test in the delivery package shows it, and fails when the handler is removed.
- A run whose tip has all three clean lines, a run of another kind, and a second end of the same run get no reminder; each has a test.
- `npm run check` and `npm test` pass.

## Scope

In:
`packages/delivery/src/checks-extension.ts`, function `checks`, which gains a `session_stop` handler (its `ExtensionApi` type gains `session_stop`, as in `processes-extension.ts`). The worker reads the reminder as its run ends.

Before:
> ```ts
> 	pi.on("tool_result", (event, ctx) => {
> 		const before = began.get(event.toolCallId);
> 		began.delete(event.toolCallId);
> 		const lines = event.toolName === "bash" ? ran(event, ctx.cwd) : [];
> 		const after = lines.length === 0 ? undefined : tree(ctx.cwd);
> 		if (after === undefined) return;
> 		// The same commit and the same untouched files: …
> 		const clean = (line: string) => before !== undefined && before.head === after.head && after.clean && (line.startsWith("mutate") ? before.clean : before.files === after.files);
> 		mkdirSync(dirname(file), { recursive: true });
> 		appendFileSync(file, lines.map((line) => `${line} ${(before ?? after).head} ${clean(line) ? "clean" : "dirty"}\n`).join(""));
> 	});
> }
> ```

After:
> ```ts
> 	pi.on("tool_result", (event, ctx) => { /* unchanged */ });
> 	// A worker whose run ends before its checks passed on its clean committed tip is told once, as processes-extension.ts tells
> 	// leftovers (AR0585): `arthur review` refuses that tip (AR0580), and the coordinator continued the worker by hand.
> 	let reminded = false;
> 	pi.on("session_stop", () => {
> 		if (reminded || readFileSync(join(record, "kind"), "utf8").trim() !== "worker") return undefined;
> 		// The tip read with tree()'s git flags and judged by tipChecks (review-command.ts), as `untested` does.
> 		const missing = gap(file, process.cwd());
> 		if (missing === undefined) return undefined;
> 		reminded = true;
> 		return { continue: true, additionalContext: `[Arthur] Before your run ends: Arthur starts no review yet: ${missing}. Commit your work, then run npm run check && npm test in one bash call and npm run mutate in another, on the committed tip; change nothing after them, name each mutant that survives, and end with your final message again, whole. A run that stopped with a Blocked: line ends again with it.` };
> 	});
> }
> ```

Out:
- Anything past the file this proposal names; a larger change is a new ticket.

## Decisions

- 2026-11-06: Source: retro spec/retro/2026-11-06.md
