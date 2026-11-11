# AR0647 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The vision still says the sweep removes unlabelled stopped containers and anonymous volumes

- Kind: docs
- Found by: 2026-11-11-worker-5f2781a0 (worker), 2026-11-11
- Where: `spec/vision.md:167`, and `spec/vision.md:161` ("unlabelled and left to the sweep")
- What: "The sweep" in the vision lists "stopped containers, unused networks, dangling images, unused anonymous volumes, build cache unused that long" as the unlabelled leftovers it removes. The owner approved AR0604's plan with every recommendation (AR-D520), which limits the unlabelled part to dangling images, unused networks and the build cache, so his own stopped stacks keep their containers and data; this branch builds that limit and states it in `packages/docker/docs/docker.md`, the roadmap's entry 72 and `arthur.config.example.ts`. The vision is the owner's, so the worker leaves its line as it is.
- Suggestion: the owner rewords the vision's sentence to the approved limit, for example "unlabelled leftovers older than `leftoverHours`: unused networks, dangling images, build cache unused that long; the owner's own stopped containers and volumes stay", and line 161's "left to the sweep" as roadmap entry 70 now says it: of what a job made unlabelled, the sweep takes only dangling images, unused networks and old build cache. Nothing else changes.
- Status: open

## F2. herdr's start-up test fails under a loaded machine, against the 5 s limit of each herdr call

- Kind: test
- Found by: 2026-11-11-worker-5f2781a0 (worker), 2026-11-11
- Where: `packages/herdr/test/herdr.test.ts:137`, `packages/herdr/src/herdr-cli.ts:9`
- What: in three full `npm test` runs on this branch, which does not touch herdr, "before start nothing reaches herdr; start opens a tab for each job in a run…" failed with `waited 20 s for the start-up pass` (once also "a prune in a process that never started…"), while `uptime` showed a load average of 21 on 3 CPUs. Run alone (`node --import @arthur/core/testing --test packages/herdr/test/herdr.test.ts`) and beside the docker tests it passes, 11 of 11. [INFERENCE] each herdr call is the test's fake herdr started as a process and killed after `LIMIT_SECONDS` (5 s); under that load a start can take longer, the call is given up, and the start-up pass never completes.
- Suggestion: let the test give the plugin a longer limit, or make the fake herdr start faster, so the test asserts the pass and not the machine's load; the production limit stays 5 s.
- Status: dropped (AR0692 fixed the herdr start-up test on main; npm test on this branch's merge of main passed, 1693 of 1757, 0 fail)

## F3. A sweep's lock held past its 12-minute wait stops the sweep of every machine after it

- Kind: fix
- Found by: 2026-11-11-review-7ad0a87d (review), 2026-11-11
- Where: `packages/docker/src/docker-sweep.ts:123`
- What: `sweep` takes each machine's lock with `queueLock(..., WAIT_MS)` outside the `try` that turns a machine's failure into its line, so a lock another process holds past 12 minutes rejects the whole call: the daily sweep stops before the other machines and sends no notice. The comment above `sweep` says so.
- Suggestion: take the lock inside the `try`, so a wait that runs out is that machine's line (`<machine>: the sweep failed: <lock path>: held by pid <pid> for over 720 s`), and pass `WAIT_MS` in so a test can hold the lock for a moment instead of 12 minutes.
- Status: open

## F4. An image with several tags is listed once per tag and removed by its ID, which Docker refuses

- Kind: fix
- Found by: 2026-11-11-review-7ad0a87d (review), 2026-11-11
- Where: `packages/docker/src/docker-look.ts:69`, `packages/docker/src/docker-cleanup.ts:68`
- What: `docker image ls` prints one row per tag, all with the same ID, so a gone job's image tagged twice gives the word `image:<id>` twice, and `docker image rm <id>` is refused as referenced in multiple repositories: the sweep and the cleanup at each prune name it as kept, every time.
- Suggestion: remove a tagged image by each `<repository>:<tag>` (the last untag deletes it), and a dangling one by its ID; count it once in `arthur docker`.
- Status: open

## F5. A label value with a comma splits into extra keys

- Kind: fix
- Found by: 2026-11-11-review-7ad0a87d (review), 2026-11-11
- Where: `packages/docker/src/docker-look.ts:43`
- What: the listings print labels as `k=v,k=v`, and `pairs` splits on every comma, so a value holding one (compose's `com.docker.compose.project.config_files` with two files) makes a bogus key. Harmless for `arthur.job`, `arthur.keep` and the compose project today, unless such a bogus key is `arthur.keep`.
- Suggestion: read the labels of containers, networks and volumes as JSON, as images' are (`docker inspect --format '{{json .Config.Labels}}'` and the like), or join a piece without `=` to the value before it.
- Status: open
