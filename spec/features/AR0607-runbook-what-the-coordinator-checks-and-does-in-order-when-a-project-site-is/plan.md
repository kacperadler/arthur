# AR0607 - Plan

- Job: 2026-11-04-plan-bbee91ba
- Planned at: 81cce87a39494cea47def4a747c79a032f06ae4d

## Approach
When a site goes down, the uptime plugin will wake the coordinator. It keeps its notices as they are and also sends the coordinator a message (`coordinator-message`), the same way github, delivery and schedule already wake it (`packages/orchestration/src/inbox.ts`, `host.events.on("coordinator-message", …)`). The message names the project, the site, since when, the reason, and the path of the runbook to work through. When the site answers again, a second message names the runbook again, so the coordinator finishes with its last step and tells the owner how it ended. Nothing else changes in uptime: the 2-failure rule, the notices, the offline-machine case (no site message, so no wake), the restart behaviour and the state file stay as they are.

- **The boilerplate runbook** is a Markdown file shipped with the plugin at `packages/uptime/roles/coordinator/site-down.md`. That is where every plugin keeps its coordinator procedures (delivery's `after-merge.md`, manage's `audit-ended.md`), so retro and review already pick it up. Its steps, in order, each with the command to run and what each result means:
  1. Confirm from this machine: `curl` the site's URL once, with a timeout. If it answers now, it came back by itself; wait for the up message.
  2. Check that this machine is online: `curl` one well-known address. If that fails too, nothing else can run; tell the owner in one line and stop.
  3. Check that the Dokploy server is reachable: `arthur dokploy app --project <p>`.
     - `unknown command dokploy` or `has no dokploy.project(...)`: the site is not on Dokploy; go to the report.
     - A timeout or no connection: the server or its panel is down, and a redeploy cannot run.
     - 401 or 403: the key needs the owner.
  4. Read the application's status and its last deployments: `arthur dokploy status --project <p>`.
     - A deployment still `running`: wait; no redeploy.
     - The last deployment `error`, the app `idle` or `error`, or the app `done` while the site gives no answer or a 502/503: these point to a redeploy.
     - A reason that a redeploy does not fix (host name not found, a TLS error, a redirect to a private address): no redeploy; go to the report.
  5. The action: a redeploy only when step 4 points to one.
     - First `arthur decision ask --kind question --project <p> --question 'Redeploy project <p>'s Dokploy app <app>? …' --option 'Redeploy now' --option 'Leave it to me' --recommend 1`.
     - If that prints `answered by policy (<id>)`: run `arthur dokploy deploy --project <p>` (AR0603), then `status` once.
     - Otherwise ask the owner and stop there (in silent mode, `arthur silent ask`).
     - Never upload, never ssh, and never deploy without that answer.
  6. The report: one message to the owner, with one line per check and what was done or asked; one line at night.
  7. When `[Arthur: uptime]` says the site answers again: say how it ended (how long it was down, and what brought it back), and close the redeploy question if it is still open (`arthur decision close <id> 'the site answers again'`).

  There is no container step, because `arthur dokploy` cannot read containers (see Not available directly).
- **Reads go without asking. A redeploy needs the owner's word.** He can approve a decision class once for one project, using the decision log that exists today: the question always starts `Redeploy project <p>'s …` and goes into that project's own log (`--project <p>`). So a class approved for, say, kacperadler.pl (`--kind question --match 'redeploy kacperadler'`) answers later questions by policy. There is no new gate and no code in orchestration. One limit of today's classes: a class needs at least one earlier answer of his to back it (`docs/commands/decision.md`, "Refused"), so the first redeploy of a project always waits for him.
- **A project's own runbook.** The helper gets an optional second argument, `uptime.project([...sites], { runbook: "site-down.md" })`. The path counts from the project's folder, beside `project.config.ts`. It is refused at load when it is absolute or climbs out with `..`, as commit-rules' `file` is.
  - Only the helper changes how the piece is stored: `{ sites, runbook? }` instead of the bare list. Every existing `uptime.project([...])` call keeps working unchanged.
  - Whether the file exists is checked when the message is written, not at setup. Setup also runs inside jobs, whose sandbox may hide the project folder.
  - If the project's own runbook is missing or is not a regular file (a symlink counts as no file), the message names the boilerplate and says the project's own runbook is missing.
- **Left alone:**
  - the dokploy package (AR0603 builds `deploy`);
  - orchestration and the coordinator role, since the message carries its own instruction and AR0603 edits the role;
  - the `uptime-down` and `uptime-up` events and their data;
  - Sentry and server-load stimuli (AR0216).
- **The order of work:** AR0607 is already set `after AR0603` on the board. The worker starts once `arthur dokploy deploy` is merged and words the deploy step after `arthur dokploy --help` as it is then.
- **Tests:** this plan follows Option 1 under Not available directly. The plugin's behaviour is tested against the fake host. How the coordinator follows the runbook is proven by a live drill after the merge, not by an eval scenario.

## Not available directly
- **The container's state.** Dokploy's API has container reads (`docker.getContainers` and `docker.getContainersByAppNameMatch` on https://docs.dokploy.com/docs/api/docker). But `arthur dokploy` only has `apps`, `app` and `status` (`packages/dokploy/src/dokploy-command.ts`, `USAGE`), and the coordinator may not call Dokploy with the token itself. The dokploy package is outside this ticket's scope.
  - Option 1: leave the container step out of the runbook and judge by `applicationStatus` and the last deployment. Cost: none. Risk: a crash-looping container under an app marked `done` is told apart only by the site's 502/503.
  - Option 2: add `arthur dokploy containers [<app>]` here (`docker.getContainersByAppNameMatch`), with its fake shapes and tests. Cost: about 30 lines of the dokploy budget plus tests, outside this ticket's Scope. Risk: it collides with AR0603's edits to the same files.
  - Option 3: a separate ticket for that verb after AR0603, with a runbook step added once it is merged. Cost: one more ticket. Risk: none to this one.
  - Recommendation: Option 1 now, with Option 3 as the follow-up ticket if the owner wants the container state.
- **A test against a fake Dokploy of the coordinator's steps.** The uptime plugin never calls Dokploy, so its tests need no fake Dokploy (that fake is `packages/dokploy/test/fake-dokploy.ts`, and a plugin's tests may not import another plugin's). The coordinator's behaviour (reads first, no deploy without his word) can only be tested as an eval scenario, with stubs for `arthur dokploy` and `arthur decision ask`. But:
  - `packages/develop/test/scenarios.test.ts` requires `evals/baseline.json` to hold a measured rate for every scenario.
  - `arthur eval` is refused inside a job (it declares no `inJob`; `packages/core/src/cli.ts:49`), so a worker cannot measure it.
  - The scenarios load from the running install, so the coordinator can measure one only after the merge, and the merge's `npm test` fails until then.

  The options:
  - Option 1: no scenario. The uptime tests cover the plugin, and a live drill after the merge covers the coordinator. Cost: none. Risk: a later change of the runbook's words is not measured.
  - Option 2: add `uptime/site-down` (no class: the deploy is asked, never run) and `uptime/site-down-by-policy` (a class answers: `deploy` is run), with their right and wrong turns, and change the scenarios test to accept a scenario with no baseline yet; the coordinator saves it with `arthur eval … --save-baseline` after the merge. Cost: about 2 scenario folders plus a change to develop's test. Risk: a scenario left unmeasured goes unnoticed.
  - Option 3: Option 2 as its own ticket after this one. Cost: one ticket. Risk: as Option 2, later.
  - Recommendation: Option 1.

## Files
- `packages/uptime/roles/coordinator/site-down.md` (new): the boilerplate runbook, the 7 steps above.
- `packages/uptime/src/uptime-options.ts`:
  - `Piece = { sites, runbook? }`;
  - `checkPiece(value)`, which runs `checkSites` on `sites` unchanged (problems keep their `[i].url` places) and checks `runbook`: a non-empty string, not absolute, no leading `..`, and no other key;
  - the refusal for something that is not `{ sites, runbook? }`.
- `packages/uptime/src/uptime.ts`:
  - `piece: checkPiece`;
  - setup reads `folder` and `pieces.uptime.sites` / `.runbook` from `collect("projects")`;
  - a `runbook(site)` line: the project's own file when `lstat` finds a regular file, else the boilerplate (`fileURLToPath(new URL("../roles/coordinator/site-down.md", import.meta.url))`) with the note;
  - one `host.events.emit("coordinator-message", { text })` next to the down notice and one next to the up notice in `apply`;
  - `uptime.project(sites, more?)` builds `{ uptime: { sites, ...more } }`.
- `packages/uptime/test/uptime.test.ts`:
  - `host()` gives each project a `folder`;
  - the tests listed under How to test;
  - the expected message of the piece refusal test updated if its wording moves.
- `packages/uptime/test/uptime-options.test.ts`: the `checkPiece` refusals and the passing shapes.
- `packages/uptime/docs/uptime.md`:
  - "Its piece" gains `runbook` and its refusal;
  - a new section "The coordinator's runbook": both messages word for word, the boilerplate's path, how to start a project's own runbook (copy the boilerplate beside `project.config.ts`), what goes without asking and what needs the owner's word, and how a class pre-approves redeploys for one project;
  - the intro no longer says the plugin only sends notices.
- `test/structure.test.ts`: `uptime: 312` raised to the new count. The package is at 312 of 312 today (measured with the 160-column rule), so the worker names the raise in outcome.md.
- `spec/roadmap.md`: a new entry, the next free number after AR0603's, under `## Uptime`: Package uptime; Delivers; Done means with the edge cases below; Depends on 98 and AR0603's entry. Plus one line in the order notes explaining its place.
- `spec/vision.md` (the uptime row), `README.md` line 44, `arthur.mmd` (the uptime node's text), `arthur.config.example.ts` (lines 270–274 and the project-file example at 486): mention that the coordinator works through a runbook, and the `{ runbook }` argument.
- `CHANGELOG.md`: untouched; `arthur changelog` writes it at the merge.

## Risks
- **The coordinator redeploys without the owner's word.**
  - The runbook allows `arthur dokploy deploy` only after `decision ask` printed `answered by policy`, or after his recorded answer.
  - The coordinator role, after AR0603, already says writes go only on his word.
  - The live drill checks it. Without an eval (see Not available directly), nothing automatic measures it.
- **A runbook is an instruction to the coordinator, so it must be the owner's own file.**
  - A path outside the project's folder is refused at load.
  - A symlink is taken as no file and falls back to the boilerplate, so the path cannot point into a client repository or anything a job writes.
- **The piece's shape changes.**
  - Every project file uses the helper, which builds the new shape, so the owner's files load unchanged.
  - A hand-written bare-list piece is refused, naming the shape.
  - The projects and core tests that use `{ uptime: [] }` treat it as opaque data, with no uptime check, so they stay valid [INFERENCE: read at `packages/projects/test/projects.test.ts:42-89` and `packages/core/test/host.test.ts:409-440`; neither loads the uptime plugin].
- **Setup also runs inside jobs.** The file is looked at only when a message is written, which happens only in `arthur run`'s rounds, never at setup, so a job's sandbox cannot break a load.
- **Usage and noise.**
  - Each down and each up is now one coordinator turn (a model call). Each is still sent once per state change, never repeated.
  - The owner gets the immediate notice and then the coordinator's report: two messages per event (see Open questions).
- **A redeploy that fails leaves the site down, with no further message.** The runbook has the coordinator check `status` once and say so in its report. The up message, or its absence, tells the rest. No polling with sleep, as the role forbids.
- **A down state from before a restart is not sent again.** The coordinator's inbox keeps a message queued before the restart (`inbox/queued/`), so nothing is lost.
- **The line budget.** It goes over 312. The raise is explicit in `test/structure.test.ts` and outcome.md, with no file near yellow (`uptime.ts` is at 137).
- **AR0603's syntax.** If its `deploy` differs from AR0588's plan (`deploy [<app>]`, `--project`), the worker words the step after `arthur dokploy --help` as merged.

## How to test
- **The boilerplate runbook, the place of a project's own, and its path in the project file** (`uptime-options.test.ts` and `uptime.test.ts`):
  - `checkPiece` accepts sites alone, and sites with `{ runbook: "site-down.md" }` or `{ runbook: "ops/site-down.md" }`.
  - It refuses, each named:
    - a runbook that is absolute, `../x.md`, empty, or not a string;
    - an unknown key beside `runbook`;
    - a bare list or a non-object;
    - a piece whose sites are bad, with the `[i].url` messages as today.
  - A test asserts that the boilerplate path named in the message is a file that exists.
- **`uptime-down` and `uptime-up` wake the coordinator with the project, site, reason and runbook path** (`uptime.test.ts`, fake host, local HTTP server):
  - After 2 failed checks: exactly one `coordinator-message`, its text naming the URL, the project, `since`, the reason and the boilerplate's path. Once the site answers: exactly one more, with how long it was down and the same path.
  - A project with its own runbook as a real file: its absolute path in both messages.
  - Own runbook missing, or a symlink: the boilerplate's path, with the note naming the missing file.
  - A down site that keeps failing: no second message.
  - The offline machine: no message.
  - A restart while a site is down: no second down message (assertions added to the existing offline and restart tests, so removing a guard fails a test).
- **Which steps go without asking and which need the owner's word, or a class:**
  - The runbook's text and the doc's section; `arthur decision class propose --kind question --match 'redeploy <p>'` works as it does today.
  - After the merge, with the owner's ok, a live drill: a project site that fails for real (the owner stops its app in Dokploy for a minute, or adds a site at a `.invalid` host for the reads-only path). The coordinator should run steps 1–4 as reads, ask the redeploy as `decision ask`, and run no `deploy` without his answer; then the up message brings the closing report.
- **Tests, doc page, roadmap entry:** run `npm run check` and `npm test` (each with a `timeout` of 1800), including `test/structure.test.ts` with the raised budget; `docs/uptime.md` and the roadmap entry as listed in Files. The uptime suite passes today: `node --import @arthur/core/testing --test packages/uptime/test/*.test.ts` gave 23 of 23 passing in this checkout.

## Open questions
- The plan keeps the immediate notice and adds the coordinator's report, so the owner gets two messages per down and per up. Keep both, or drop the notice for a site on the coordinator's runbook and let the report be the one message? The notice needs no model and arrives even when the coordinator is stuck. Recommendation: keep both.
- The container state (Not available directly, first item): leave the step out now, and open a ticket for an `arthur dokploy containers` verb after AR0603?
- The eval scenario (Not available directly, second item): no scenario now with a live drill after the merge (recommended), or two scenarios with a baseline measured after the merge?