# The github plugin

Roadmap entries 57 and 58: while `arthur run` runs, Arthur asks GitHub for the CI runs of the branches in play and emits `ci-finished` once per run attempt, and, when `wakeOn` names them, the reviews of open pull requests as `pull-request-review`; either wakes the coordinator when `wakeOn` names it. Nothing listens for GitHub: the plugin polls, so there is no endpoint to expose and no webhook secret. `arthur ci <branch>` tells why a branch's run failed and reruns it once (`arthur ci --help`), and a branch a review passed and main after a merge are pushed to origin.

```ts
plugins: [
	orchestration({}),
	projects({ list: [{ name: "shop", prefix: "SH", repo: "git@github.com:acme/shop.git", ci: { workflow: "ci.yml" } }] }),
	github({
		instances: [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }, { name: "acme", tokenEnv: "ARTHUR_GITHUB_ACME_TOKEN" }],
		poll: { everySeconds: 120 },
		wakeOn: ["ci-finished", "pull-request-review"],
	}),
],
```

It needs `projects` in the list (`requires`), which sets up first.

## Options

- `instances`: the GitHub accounts, at least one, each `{ name?, tokenEnv, apiUrl? }`, at most one without a name.
- `name`: a GitHub owner, user or organization, in lowercase (letters, digits, single dashes): the instance reads that owner's repositories. Left out: the unnamed instance, which reads every repository whose owner no instance is named after.
- `tokenEnv`: the variable holding the token, a fine-grained one with Actions: read on the repositories (a classic one with `repo`); Actions: read and write for `arthur ci --rerun`, Pull requests: read for `pull-request-review`. Its value never goes into an error, a notice, an event or a file.
- `apiUrl`: the REST API's address; default `https://api.github.com`. GitHub Enterprise Server's is `https://<host>/api/v3`.
- `poll.everySeconds`: a whole number of seconds, 1 or more, between two polls; default 120. A poll asks once per project with a `ci.workflow`, and GitHub allows a token 5000 requests an hour.
- `wakeOn`: the events that wake the coordinator, each at most once, among `ci-finished` and `pull-request-review`; default `["ci-finished"]`, and `[]` wakes it on nothing. `pull-request-review` also turns on the polling of pull request reviews, which costs a request per project and one per pull request updated since the poll before.

Refused at load, with the option's path: an unknown option or key, no instances, a `name` that is not a lowercase owner, two unnamed instances or one name twice, an `apiUrl` that is not http or https, a `poll.everySeconds` below 1 or not whole, a `wakeOn` that is no list, names another event, or names one twice. At setup, naming the option or the project:

- a token that is empty or that a header cannot carry: `instances[<n>].tokenEnv: <variable> is empty or holds a space or a character outside ASCII, which a header cannot carry`;
- a project with a `ci.workflow` whose checkout has no `origin`: `project <name>: ci.workflow is set, but its checkout has no origin remote to name its GitHub repository`; one whose `origin` ends in no `<owner>/<repository>`: `project <name>: its origin remote names no <owner>/<repository>` (the remote's URL is never said: it may hold a credential);
- a project whose owner no instance is named after, with no unnamed instance: `project <name>: no instance of github is named <owner>, the owner of <owner>/<repository>, and none is unnamed; github's instances: <names>`.

A project without `ci` is not polled.

## The runs

A project's repository is its checkout's `origin`, `git@github.com:<owner>/<repository>.git` or `https://github.com/<owner>/<repository>`; its workflow is `ci.workflow`, the file name in `.github/workflows/` (`ci.yml`) or the workflow's id. At the start of `arthur run`, then every `poll.everySeconds`, each such project's 100 newest runs of that workflow are asked for (`GET /repos/<owner>/<repository>/actions/workflows/<workflow>/runs`), one project after the other.

The branches in play are the checkout's own branch (main) and the branch of every job of the project (`host.jobs.list()`), in any state, while it still exists in the checkout. A branch's run is the newest run on the nearest commit of its first-parent line, from its tip back at most 1000 commits, that has one: a commit that touches no path the workflow watches has no run, so the run before it counts. A job's branch not pushed yet has the run of the commit it started from on main.

Once a branch's run is `completed`, and that attempt of it was not told before, the plugin emits `ci-finished`:

`{ project, repo, workflow, run, attempt, sha, branch, branches, conclusion, url }`

with `run` the run's id and `attempt` its `run_attempt`, `sha` and `branch` the commit and the branch GitHub ran it on, `branches` the branches in play whose run it is (a job's branch fresh from main shares main's run: one event), `conclusion` GitHub's (`success`, `failure`, `cancelled`, `timed_out`, `skipped`, ...) and `url` the run's page. A run attempt is told once, however many polls see it. A rerun keeps the run's id and raises its attempt, so its end is told again, once (AR0238). A branch deleted while in play leaves it at the next poll: its run is not told and nothing is said.

With `ci-finished` in `wakeOn`, each one also reaches the coordinator as a `coordinator-message`: `[github] CI run <id>, attempt <n>, of <workflow> in <project> ended <conclusion> on <branches> (<commit>): <url>`, and for a run that failed or was cancelled a second line, `Why: arthur ci <branch> --project <project>; rerun it once: arthur ci <branch> --project <project> --rerun`.

## Pull request reviews

With `pull-request-review` in `wakeOn`, each poll also asks, per project with a `ci.workflow`, for its repository's 100 open pull requests most recently updated, and for the reviews of each one that is new or whose `updated_at` changed since the poll before (submitting a review updates it). Each submitted review not told before (a pending one is a draft, not submitted) is emitted as `pull-request-review`:

`{ project, repo, pull, title, branch, review, user, state, body, url }`

with `pull` the pull request's number, `branch` its head branch, `review` the review's id, `state` GitHub's (`APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`, `DISMISSED`) and `url` the review's page; and the coordinator gets `[github] <user> reviewed pull request #<n> of <repo>, <title> (branch <branch>): <state>: <url>`, then the review's text, its first 1000 characters, when it has one. A project's first poll of them tells none: what was reviewed before is taken as told. A pull request closed and reopened has its reviews told again.

## Pushes

The plugin provides `github.push`, `{ project, branch }`, which delivery asks after a review's `PASS` (the reviewed branch, `arthur review --help`) and after `arthur merge` went in (main, `arthur merge --help`); with github not loaded, nothing is pushed. It runs `git push --porcelain origin refs/heads/<branch>:refs/heads/<branch>` in the project's checkout, with git's own credentials (an SSH key, a credential helper), and answers one line: `github: pushed <branch> to origin: <old>..<new>` (`[new branch]`, `[up to date]`), or one warning line, `github: <branch> not pushed to origin: <why>`. `<why>` is git's for a rejected push, `[rejected] (non-fast-forward)` or `[rejected] (fetch first)`, origin left as it was; `<folder> has no origin remote`; or git's first error line, a quoted remote URL said as `origin`, as it may hold a credential. A push never asks for anything: git's terminal prompt is off (`GIT_TERMINAL_PROMPT=0`), no askpass program is run (`GIT_ASKPASS` empty, which also keeps git from `core.askPass` and `SSH_ASKPASS`; `SSH_ASKPASS_REQUIRE=never` for ssh), Git Credential Manager is told never to ask, and the push runs in a session of its own, with no terminal; one that has not ended in 60 s is killed. A push that would need a password fails instead: `fatal: could not read Username for origin: terminal prompts disabled`. Nothing is retried; the next PASS or merge pushes again.

## CI for an auto-merge

Roadmap entry 59. The plugin provides `github.ci` and `github.cancel`, which delivery's `arthur merge --auto` and its CI waits ask through `call` (`arthur merge --help`, "--auto"); with github not loaded, `--auto` is refused unless the owner gives `--no-ci`. `github.ci`, `{ project, branch }`, asks GitHub for the workflow's 100 newest runs as `arthur ci` does and answers the run that built the branch, `{ id, attempt, sha, branch, status, conclusion, url, startedAt, below }` (`startedAt` the attempt's `run_started_at`, else `created_at`; `below` the commits from the branch's tip to the one it ran on), or nothing when none did; a project without `ci.workflow`, a branch not in its checkout, and each refusal of GitHub's reject with the line `arthur ci` prints for it. `github.cancel`, `{ project, run }`, asks GitHub to cancel the run (`POST /repos/<owner>/<repository>/actions/runs/<id>/cancel`, which needs Actions: read and write) and answers `github: cancel of run <id> of <owner>/<repository> asked`; GitHub's refusal, a 409 for a run already finished included, rejects.

## Across a restart

`.arthur/github/state.json` holds, for each project, the run attempts already told that GitHub still lists, each `<run id>/<run_attempt>`, and, when pull request reviews are polled, each open pull request's `updated_at` and the reviews told; written to a temporary name and renamed when they change. A run that finished while `arthur run` was down is told at the first poll after it; one told before is not. A project's first poll, with nothing in the file for it, tells nothing: what finished before Arthur watched it is taken as told. A file that is not what the plugin writes (broken, edited by hand, or entry 57's list of run ids) is taken as no project polled yet, so nothing is told twice. `.arthur/github/reruns` holds the ids of the runs `arthur ci --rerun` reran, one a line.

## Failures

- A refusal the owner must fix is said once, as a notice, `github: instance <name>: <reason>; polling goes on and says this again only after GitHub answered`: `401: the token in <variable> was refused: <GitHub's message>`, `403 for workflow <workflow> of <owner>/<repository>: <GitHub's message>; the token in <variable> needs Actions: read on it`, `404: workflow <workflow> of <owner>/<repository> not found, or the token in <variable> cannot see it`; for pull requests, `403 for the pull requests of <owner>/<repository>: ...; the token in <variable> needs Pull requests: read on it`, said apart from the runs' own. A 401 of an instance with several projects is one notice; it is said again once each of them was answered and is refused anew.
- GitHub out of reach, no answer in 30 s, any other status, or an answer that holds no runs (no list of pull requests): one line on stderr, `github: instance <name>: <reason>`, likewise once until an answer. A failed request for pull requests or reviews leaves the poll's state of them as it was, so the next poll asks again and nothing is lost.
- A rate limit, as GitHub's "Rate limits for the REST API" says: a refusal with `retry-after` (a 403 or 429) waits that many seconds; with `x-ratelimit-remaining: 0`, until `x-ratelimit-reset`; a 429, or a 403 that names a rate limit, without either, one minute. Until then the instance asks nothing, its other projects included, and one line goes to stderr: `github: instance <name>: <status>, rate limited: <GitHub's message>; no request until <ISO time>`. An answer with runs that says 0 requests left is used, and the instance waits for `x-ratelimit-reset` likewise, without a line.
