# AR0732 - Mutate kills the processes a mutant's test run left behind

```json
{
  "id": "AR0732",
  "title": "Mutate kills the processes a mutant's test run left behind",
  "date": "2026-11-20"
}
```

## Description

Mutate kills the processes a mutant's test run left behind (a job's wrapper and its fake agent in their own session), so no worker or reviewer has to find and kill them by hand after `npm run mutate`.

## Goal

three jobs had to find and kill leftover processes by hand, and AR0705 F5 is only `deferred (client summary)`, with no ticket. `stopGroup` kills only the run's own process group. A wrapper in its own session survives it, and a run cut by SIGKILL never reaches the kit's exit cleanup [INFERENCE: from `passes` and `testing.ts:34`; not traced].

Evidence:
- AR0705 findings.md, F5 (worker): after `npm run mutate`, a job wrapper and its fake agent were still running and had to be killed by hand.
- AR0705 review-2.md, notes: the same leftovers, pids 1464577 and 1464697, killed by the reviewer.
- AR0706 review-1.md, checks: pids 3943463 and 3943612, a fake job's wrapper and its fake agent, stopped by the reviewer.

- Kind: test

## Done means

- Each test run of `test/mutate.ts` gets its own TMPDIR, and on its exit every process whose working folder or command line is under it is killed and the folder removed.
- A test starts a mutant run whose test leaves a detached process in its own session, and asserts the process is gone after the run; it fails without the change.
- `npm run check && npm test` pass.

## Scope

In:
- `test/mutate.ts`, `passes`

Before:
> function passes(tests: readonly string[], end: number): Promise<boolean | undefined> {
> 	const left = end - Date.now();
> 	if (left <= 0) return Promise.resolve(undefined);
> 	const child = spawn(process.execPath, ["--import", KIT, "--test", ...tests], { cwd: root, env: { ...process.env, NODE_TEST_CONTEXT: undefined }, detached: true, stdio: "ignore", timeout: Math.min(RUN_MS, left), killSignal: "SIGKILL" });
> 	…
> 	child.on("exit", (code, signal) => {
> 		stopGroup(running);
> 		running = undefined;
> 		done(code === 0 ? true : signal === "SIGKILL" && left < RUN_MS ? undefined : false);
> 	});
> 	return promise;
> }

After:
> // Its TMPDIR is a folder of its own, under which each test kit makes its root, so what the run left (a job's wrapper and fake
> // agent in a session of their own, which the group kill misses, AR0705 F5) is found by that folder, as the kit's exit finds it.
> function passes(tests: readonly string[], end: number): Promise<boolean | undefined> {
> 	const left = end - Date.now();
> 	if (left <= 0) return Promise.resolve(undefined);
> 	const own = mkdtempSync(join(tmpdir(), "arthur-mutate-"));
> 	const child = spawn(process.execPath, ["--import", KIT, "--test", ...tests], { cwd: root, env: { ...process.env, NODE_TEST_CONTEXT: undefined, TMPDIR: own }, detached: true, stdio: "ignore", timeout: Math.min(RUN_MS, left), killSignal: "SIGKILL" });
> 	…
> 	child.on("exit", (code, signal) => {
> 		stopGroup(running);
> 		running = undefined;
> 		for (const pid of readdirSync("/proc").map(Number)) try { if (`${readlinkSync(`/proc/${pid}/cwd`)}/`.startsWith(`${own}/`) || readFileSync(`/proc/${pid}/cmdline`).includes(own)) process.kill(pid, "SIGKILL"); } catch {}
> 		rmSync(own, { recursive: true, force: true });
> 		done(code === 0 ? true : signal === "SIGKILL" && left < RUN_MS ? undefined : false);
> 	});
> 	return promise;
> }

Out:
- Any other role, criteria or script change of the retro: its own ticket.

## Decisions

- 2026-11-20: Source: retro spec/retro/2026-11-20.md
