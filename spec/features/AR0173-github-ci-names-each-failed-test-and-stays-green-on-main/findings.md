# AR0173 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## Annotations

`test/github-annotations.ts` is a node:test reporter; the `npm test` step of `ci` adds it beside the spec reporter through `NODE_OPTIONS`. Run here as that step runs it, with a throwaway `test/zz-probe.test.ts` that fails on purpose (`assert.deepEqual({ a: 1 }, { a: 2 })`), it printed beside the spec output:

```
::error file=test/zz-probe.test.ts,line=3,title=fails on purpose::AssertionError: Expected values to be strictly deep-equal:%0A+ actual - expected%0A  {%0A+   a: 1%0A-   a: 2%0A  }
```

A parent whose subtests failed and a test cancelled because its parent failed get no line of their own; a file that fails outside its tests gets one titled with its path, with node's `test failed`.

On GitHub: commit ca43ddf on this branch added `test/zz-ci-probe.test.ts`, `assert.deepEqual({ a: 1 }, { a: 2 })`, and was pushed; ce4535e reverts it. Its `check` run 117946746326 failed, and `curl https://api.github.com/repos/kacperadler/arthur/check-runs/117946746326/annotations`, with no token, printed (abridged: the Node 20 deprecation warning, the empty and null fields, and two `blob_href`s left out):

```json
  {
    "path": ".github",
    "start_line": 644,
    "annotation_level": "failure",
    "title": "",
    "message": "Process completed with exit code 1.",
  },
  {
    "path": "test/zz-ci-probe.test.ts",
    "blob_href": "https://github.com/kacperadler/arthur/blob/ca43ddf8ad12f70791af9d1e8c6f07071e650cad/test/zz-ci-probe.test.ts",
    "start_line": 4,
    "end_line": 4,
    "annotation_level": "failure",
    "title": "fails on purpose, to show its annotation",
    "message": "AssertionError: Expected values to be strictly deep-equal:\n+ actual - expected\n  {\n+   a: 1\n-   a: 2\n  }",
  },
  {
    "path": "packages/core/test/scope.test.ts",
    "start_line": 263,
    "annotation_level": "failure",
    "title": "over a memory cap the kernel takes the agent and what it started first, never the wrapper: their oom_score_adj is 1000, the wrapper's its own",
    "message": "AssertionError: Expected values to be strictly deep-equal:\n+ actual - expected\n  [\n    '1000',\n+   '1000'\n-   '500'\n  ]",
  }
```

The third is a real failure the annotations named at once: on GitHub's runner the new oom test saw the wrapper at 1000, not the test's own 500 (see Tests fixed, item 2).

## Tests fixed

1. Every test helper that parses a JSONL file while the fake agent (or a shell fake) may still append to it (a3b2b4a): `lines` in `packages/session/test/session.test.ts`, `restart.test.ts`, `start-notice.test.ts` and `packages/orchestration/test/inbox.test.ts`; `starts` in `packages/orchestration/test/coordinator.test.ts` and `spawn-rules.test.ts`, `packages/core/test/job-control.test.ts` and `wrapper.test.ts`; `messages` and `starts` in `packages/core/test/machine.test.ts`.
   - Symptom: `SyntaxError: Unexpected end of JSON input` from the helper, reported for `session.test.ts` "a session busy for compactWaitSeconds withdraws the request with one line, and the handoff is never asked for". The helpers did `trim().split("\n").map(JSON.parse)`, which throws on an empty file and on a line read half written. They now parse only the lines that end in a line break; a line not yet ended is read at the next poll, so each `until` waits for the very line it asserts.
   - Cause: AR0167 made the fake agent create each file whole with its first line (a link), but two writes can still be seen half done: `coordinator.test.ts`'s shell fake appends its starts with `echo ... >>`, which creates the file empty before `echo` writes, and an append that crosses a 4 KiB page can be seen up to the page.
   - Found: a throwaway reader polling a file while a child appended to it, three rounds each, pinned to 2 cores. `sh -c 'echo ... >>'`, the file recreated 400 times: 342 of 15330, 351 of 15118 and 362 of 14993 reads failed to parse the old way, 0 the new way. `appendFileSync` of 3000 lines of about 1.5 KB: 0 of 35, 0 of 28 and 2 of 37 reads failed the old way, 0 the new way. `session.test.ts` alone, 12 copies at once on one core, 2 rounds: 24 of 24 passed before the fix, so this run did not show it.
2. `packages/core/test/scope.test.ts`, "a job over its memory cap ends limit: memory, and another job with a cap keeps running", and the code it tests, `packages/core/src/wrapper.ts` with `oomFirst` in `job-memory.ts` (2212782).
   - Symptom: `timed out waiting for 2026-10-16-worker-0bad8783's end` at line 253, the hog job's end, in a review's full-suite run (job 2026-10-19-review-ar0160-restart-cl-00e8ca8e, 20725 ms); the test alone passed 15 of 15.
   - Cause: the kernel log of that run (`journalctl -k`, 09:17:45, scope `arthur_test_1646b481.slice/arthur-job-2026-10-16-worker-0bad8783.scope`) shows two memory-cgroup OOM kills in a row. The first took the hog (pid 546336, 239 MB anon). The second came before the hog's memory was freed; its task list held only pid 546258 (87 MB resident) and pid 546332 (71 MB), all at `oom_score_adj` 200, and it took the larger, 546258. That was the wrapper [INFERENCE: by pid order it started before the agent 546332, which forked the hog 546336; and a killed agent would have ended the job with `limit: memory`, which did not happen]. With the wrapper gone nothing ended the job. A real job over its cap could lose its wrapper the same way.
   - Fix: the wrapper forks the agent with its own `oom_score_adj` raised to 1000 for that moment, so the agent and all it starts score 1000 and the wrapper keeps its own, and the kernel picks one of the agent's processes before the wrapper; the wrapper then ends the job with `limit: memory`. A throwaway probe in a `systemd-run --user --scope -p MemoryMax=200M -p MemorySwapMax=0 -p OOMPolicy=continue` scope: a parent holding 120 MB (the wrapper's place, about 168 MB resident) forks a child that grows 2 MB every 20 ms (the agent's place). Without the raise the kernel killed the parent, the larger, 2 runs of 2; with it, the child (about 102 MB resident, score 1000), and the parent lived, 2 runs of 2. The kernel adds `oom_score_adj` × the cgroup's limit / 1000 to each process's size, so a wrapper resident above about 80 % of the cap plus the agent's size would still go first [INFERENCE from the kernel's `oom_badness`; the failing run had a wrapper of 87 MB under a 300M cap]. The new test "over a memory cap the kernel takes the agent and what it started first, never the wrapper" reads both scores; it fails without the raise (`'200'` for `'1000'`) and without the restore. Core 11 lines more (5127), recorded in `test/structure.test.ts`.
   - Found: only by that kernel log. The test, 8 copies at once on 2 cores (2 rounds) and 16 and 32 copies on one core: 80 of 80 passed before the fix, 1.3 to 6 s each, so the double kill did not recur here.
   - The new test failed once on GitHub (run 117946746326, annotation above): the wrapper read 1000, not 500. A probe commit (d427528, reverted in d625805; run 117949103447) showed through its annotation that the runner raises and lowers the score as here, bare and in a user scope: `self 500`, `start 500, after 1 s 500, raised 1000, restored 500`. [INFERENCE] So the test had read the wrapper between the agent's fork and the wrapper's restore: on a starved CPU the agent forks its daemon first. The test now waits until the wrapper's score is back to its own (it times out when the restore is removed) and then reads the daemon's 1000.
3. `packages/core/test/doctor.test.ts`, "a check that hangs is cut after 10 s, every check at once, and the others answer".
   - Symptom: `AssertionError: took 9999 ms`, the annotation of run 39219661015 (ab1286d, an empty commit) on GitHub. The test asserted `took >= 10_000`, `took` measured with `Date.now()`.
   - Cause: [INFERENCE] the 10 s cut is a Node timer on the monotonic clock, while `Date.now()` is the wall clock, which the runner's time sync can slow by a few ms over 10 s; here 2000 timers of 10 ms never measured under 10 ms, so it did not show.
   - Fix: the lower bound is 9950 ms: a cut at 5 s still fails it, and a hang never ends the test.
4. `packages/core/test/scope.test.ts`, "a job over its memory cap ends limit: memory, and another job with a cap keeps running", again, after item 2's fix.
   - Symptom: the annotation of run 39220691635 (7fc87b9, an empty commit): the job ended `limit: memory: the job went over its memory cap of 300M`, as asserted, but its log lacked `limit: memory: stopping the agent`.
   - Cause: with item 2's fix the kernel's second kill takes the agent (score 1000) instead of the wrapper, so the agent can be gone before the wrapper's next 1 s sample; the wrapper then ends the job at the cap from `memory.events` after the run, without the stopping line, as docs/commands/spawn.md says ("a kill that ended the agent itself included").
   - Fix: the test asserts the job's end reason only.

## Stress after the fixes

Run by the coordinator on f53fc97, in a separate clone on the VPS: 10 rounds of 3 full `npm test` runs at once, each under `taskset -c 0,1`. 30 of 30 passed, each `tests 564, fail 0` (7332 s in all).
