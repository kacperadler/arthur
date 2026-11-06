# AR0128 - Plan

- Job: 2026-11-06-plan-51cb5dd2
- Planned at: 4ac7c441238f0075e9b89745d207fc1c5ff3d641

## Approach
This ticket delivers this plan and nothing else. No code, doc, roadmap or vision file changes here; the roadmap and vision edits are a follow-up ticket's job once the owner picks. Where npm is not available directly (see below), the plan follows Option 1 there: Git tags and GitHub releases.

How things stand at HEAD 4ac7c441:
- No package has a `version`, and every package is `private`. There is no Git tag in this checkout.
- `arthur version` prints `coreVersion()` (`packages/core/src/job-machine.ts:31`): the first 12 hex digits of a hash over `packages/core/src/`, `8b0c9ebef9ca` today.
- A spawn on another machine (`job-machine.ts:158-159`) and the machines check (`packages/machines/src/machine-check.ts:88`) both need that hash to be the same on both machines.
- Installing is `git clone` plus `npm ci` (`docs/setup.md` step 4). The service runs `%h/arthur/node_modules/.bin/arthur run`, and the config's `@arthur/*` imports resolve from the clone's `node_modules`. Updating is `git pull`, `npm ci` and a restart (`docs/deploy.md`, "Updating").
- The session plugin's restart guard already holds new jobs once Arthur's code in the core's checkout changed, and under the service restarts `arthur run` once no job runs (`packages/session/docs/session.md`, "The restart guard", steps 1-6).
- Entry 51 (the API freeze, AR0228) and entry 56 (the changelog, AR0252) are both merged.

The design in one line: one version for everything, released as a Git tag plus a GitHub release. A workflow makes the release when a merged release ticket changes the version. Arthur is installed and updated as a checkout of that tag.

1. **Versions**
   - Option A: one version for the core and every first-party plugin, set in every `package.json`.
   - Option B: a version per package.
   - Recommendation: A. The packages live in one repository, are tested together and ship together, so one number says what a machine runs.
   - `npm version <v> --workspaces --include-workspace-root --no-git-tag-version` sets them all, the lockfile included. I tried it on a copy of the package files: the root, core and youtrack packages and the lockfile all became `0.1.0`.
   - Semver. While on 0.x: the minor goes up for a breaking change (the host API, an option removed or renamed, a file format that needs a manual step); the patch goes up for anything else. Start at `0.1.0`; see Open questions.
   - A release is a ticket, "Release 0.2.0", kind `chore`, whose worker runs only that command. It goes through `arthur merge` like any ticket. A version bump by hand on main would block the next merge, because a `package.json` counts as code for the merge's check of main (`packages/delivery/docs/commands/merge.md:23`).
2. **Channel**
   - Option A: npm (`arthur`, `@arthur/*`). Not available directly; see below.
   - Option B: a Git tag `v<version>` and a GitHub release.
   - Option C: both.
   - Recommendation: B.
   - Who publishes: a new `.github/workflows/release.yml`. It runs on a push to `main` that changes `package.json`. If the tag `v<version>` does not exist yet, it runs `npm ci`, `npm run check` and `npm test`, then `gh release create v<version> --target <sha>`, with that release's section of `CHANGELOG.md` as the notes.
   - Its token is the workflow's own `GITHUB_TOKEN` with `contents: write`, so there is no secret to keep. The owner approves a release by approving its ticket.
   - The alternative, a workflow on a tag the owner pushes by hand, adds a step outside Arthur and needs the owner's push key, so I do not recommend it.
3. **Install**
   - Option A: `npm i -g arthur` plus the plugins. Not available (see below). Even with JavaScript packages, the config imports `@arthur/*` from its own folder, not from the global install, so the plugins would have to be installed in `~/arthur` anyway [INFERENCE: from how Node resolves imports; not run].
   - Option B: a clone, the newest release tag checked out, then `npm ci`.
   - Recommendation: B. Step 4 of `docs/setup.md` becomes the clone line as today, then `cd ~/arthur`, then `git checkout --quiet "$(git tag --list 'v*' --sort=-v:refname | head -n 1)"`, then `npm ci`. The `PATH` lines stay.
   - Its check: `arthur version` prints something like `0.1.0 8b0c9ebef9ca`.
   - A full clone, not a shallow one (`.git` is 47 MB today). The restart guard runs `git diff` against the commit it noted, which a shallow fetch might lack [INFERENCE].
   - Steps 5 to 9 stay as they are. The owner's VPS stays a checkout of `main`.
4. **`arthur version`**
   - It prints `<version> <hash>`: the version from the core's `package.json`, and the hash as today.
   - What machines compare. Option A: the hash. Option B: the release version only, which lets two different builds of main between releases through. Option C: a new protocol number. Recommendation: A. Both comparisons above compare the last word, and a refusal names both whole lines. A machine on today's Arthur prints the hash only and is refused, naming both, which is the intended result.
   - A plugin built for another core version. Option A: refuse it at load. Option B: warn. Option C: do nothing. Recommendation: B.
     - A plugin's `package.json` may name `peerDependencies["@arthur/core"]`, npm's own field.
     - At load the host reads it from the package folder it already finds (`packageOf`, `packages/core/src/host.ts:64,161`).
     - When the core is outside that range, `arthur doctor` gets one line that does not stop the start: `core plugin <name>: built for @arthur/core <range>, this core is <version>`.
     - Only `^x.y.z`, `~x.y.z` and an exact `x.y.z` are read; any other range is reported as unread.
     - First-party plugins name no range, since they ship in the same release.
     - Refusing would be wrong on 0.x, where a minor release may not touch what a given plugin uses.
5. **Updating**
   - Option A: an `arthur update` command. Option B: `npm i -g arthur@latest`, not available. Option C: the commands typed by hand from the doc.
   - Recommendation: A, a core command that does not run inside a job. It works in the core's own checkout, found as the restart guard finds it.
     - It refuses a core outside a Git checkout, and changed tracked files (naming them).
     - With no argument it refuses a checkout on a branch: `<branch> is a development checkout; update it with git pull`.
     - It runs `git fetch --tags origin` and takes the newest `v*` tag, or the tag or commit it is given. If that is already HEAD it prints `up to date: <version>`.
     - Otherwise it runs `git checkout`, then `npm ci`. If `npm ci` fails, it goes back to the previous version and runs `npm ci` again, and says so.
     - It prints `updated <old> to <new>`.
   - Restart once no job runs: nothing new to build. The restart guard does it (steps 2-6). Without the session plugin, the output names `systemctl --user restart arthur`.
   - Notice of a new release: in the manage plugin, as a daily entry through `schedule.register`, the way its prune is registered (`packages/manage/src/manage.ts:70-71`).
     - It runs `git ls-remote --tags --refs origin 'v*'` in the core's folder (`host.code[0]`), cut after 30 s.
     - A newer tag sends one notice per release: `Arthur 0.3.0 is out; this one runs 0.2.0: arthur update`. What was already told is kept in `.arthur/manage/`.
     - A checkout that is not at a tag, like the owner's `main`, is not checked. There is no option for it, and nothing is checked without the schedule plugin.
   - Machines over SSH: a new command, `arthur machines update [<name>]`. It runs `arthur update <this core's HEAD commit>` on each machine through `host.jobs.run` (`packages/core/src/host-jobs.ts:19`). The target is the version here, not the newest release; an offline machine is named and skipped. The fix texts in `machine-check.ts:77,88` will name this command.
6. **CHANGELOG per release**
   - Option A: release notes only, built from the `Merge <id>: <title>` commit subjects since the previous tag.
   - Option B: `arthur changelog` (`packages/delivery/src/changelog.ts`) puts the days under releases.
   - Recommendation: B.
     - A release is a commit on `main`'s first-parent line that changes the root `package.json` `version`.
     - A ticket belongs to the first such commit at or after its merge hash, read from `outcome.md`; one `git log --first-parent` gives all of it.
     - The headings become `## 0.2.0 (<date>)` for the release, `###` for each day and `####` for each kind, with `## Unreleased` on top.
     - A project whose root version never changed gets the same file it gets today, byte for byte.
     - The release ticket's own merge writes its section, and the workflow uses that section as the release notes.
7. **Roadmap.** New entries take the numbers after 103 (99 to 101 are held by AR0527's plan; I found no plan holding 104 or more):
   - 104. Versions: one release version, `arthur version` with the hash, the plugin check. Packages: core, machines, every `package.json`. Depends on 21, 30, 80. Half a day.
   - 105. The release workflow and the changelog per release. Packages: repository root, delivery. Depends on 56, 104. Half a day to a day.
   - 106. `arthur update`, installing a release, `arthur machines update`, and the setup and deploy docs. Packages: core, machines. Depends on 37, 104, 105. A day.
   - 107. A notice when a new release exists. Package: manage. Depends on 39, 106. Half a day.
   - In entry 30, the doctor fix that says `npm i -g arthur` changes to `arthur machines update` (from 106).

## Not available directly
- **What is missing, and where I checked.**
  - Node does not strip TypeScript types for files under `node_modules`. I gave a copy of the core package a version, packed it, installed it into a temporary folder and ran `arthur version`: it failed with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. Every package ships `.ts` that Node runs as written; inside the repository this works only because `node_modules/@arthur/*` are links into `packages/`. So Arthur installed from npm, globally or locally, does not start.
  - The npm name `arthur` is taken: `npm view arthur` answers version 0.1.1, maintainer arthurfigueiredo, last changed 2022.
  - Whether the owner holds the `@arthur` scope I could not confirm. The registry search lists no package under it, and the npmjs.com org page answered 403.
  - The packages have no `version` (`npm pack` refuses: `must have name and version`), and the core's tarball also held its 35 test files.
- **Options.**
  - Option 1: Git tags and GitHub releases, no npm. Cost: no build step, no secret, a few doc lines. Risk: there is no `npm i`, and a third-party plugin installed from npm must ship JavaScript.
  - Option 2: publish JavaScript compiled by `tsc` at release time. Cost: a compile step, an exception to the styleguide's "nothing is compiled", file names in code made to work in both forms (`job-scope.ts:49` `wrapper.ts`, `testing.ts:65` `fake-agent.ts`, the hash over `src/`), a new package name and `files` fields. Risk: users run code the tests never ran.
  - Option 3: publish the `.ts` with a JavaScript launcher that uses Node's `module.registerHooks` and `module.stripTypeScriptTypes`, plus `--import` on every Node process Arthur starts. Cost: about 20 lines, plus every place that starts a `.ts` file with `process.execPath`. Risk: `stripTypeScriptTypes` is experimental. I tried it on Node 24.21.0: it works, and prints an ExperimentalWarning on every run.
- Recommendation: Option 1.

## Files
- `spec/features/AR0128-plan-releases-installing-and-updating-arthur/plan.md`: this plan, filed with `arthur ticket file`. No other file changes in this ticket.

## Risks
- Until the follow-up ticket, the roadmap (entry 30 and the machine fix) still says `npm i -g arthur`, which cannot work. The follow-up ticket changes that text.
- Entries 104 and 106 add code to the core, and its line budget may need raising. A raise is the owner's decision, recorded in those tickets.
- The API freeze is respected: no new host member is needed, since `host.code`, `host.jobs.run` and `schedule.register` already exist, and `coreVersion()` stays the hash.
- Machines on today's Arthur are refused after entry 104 until they are updated; the first update of each is by hand (`docs/deploy.md`).
- `npm ci` while `arthur run` is running carries the same risk as an update today. The restart guard holds new jobs meanwhile.
- Release headings would appear in the changelog of any project, a client's included, whose root `version` changes.
- The workflow also runs on any other `package.json` change; the check that the tag already exists makes that run do nothing.

## How to test
- Each "Done means" point is a numbered section of Approach: versions (1), channel and who publishes (2), install and step 4 (3), `arthur version`, what machines compare and the plugin check (4), updating, the notice and machines over SSH (5), the changelog per release (6), roadmap entries, numbers and dependencies (7).
- No code: the ticket's branch changes only `plan.md`.
- `npm run check` and `npm test` pass: I ran both on HEAD 4ac7c441 in this checkout. The check exited 0. The tests: 1574 run, 1510 pass, 0 fail, 64 skipped, exit 0. Since only `plan.md` changes, the result still holds.

## Open questions
- The first release number: `0.1.0` (recommended) or `1.0.0`? The ticket says "0.x until the plugin API freezes", and entry 51 already froze it (AR0228, 2026-10-20). If 0.x, what event moves Arthur to 1.0?
- Is the `@arthur` npm scope the owner's? This only matters if Option 2 or 3 is picked later; the name `arthur` itself is taken.