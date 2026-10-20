# The github plugin

Roadmap entry 57: while `arthur run` runs, Arthur asks GitHub for the CI runs of the branches in play and emits `ci-finished` once per run. Nothing listens for GitHub: the plugin polls, so there is no endpoint to expose and no webhook secret. It has no command yet (`arthur ci` is entry 58); what it finds goes on the event stream.

```ts
plugins: [
	orchestration({}),
	projects({ list: [{ name: "shop", prefix: "SH", repo: "git@github.com:acme/shop.git", ci: { workflow: "ci.yml" } }] }),
	github({
		instances: [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }, { name: "acme", tokenEnv: "ARTHUR_GITHUB_ACME_TOKEN" }],
		poll: { everySeconds: 120 },
	}),
],
```

It needs `projects` in the list (`requires`), which sets up first.

## Options

- `instances`: the GitHub accounts, at least one, each `{ name?, tokenEnv, apiUrl? }`, at most one without a name.
- `name`: a GitHub owner, user or organization, in lowercase (letters, digits, single dashes): the instance reads that owner's repositories. Left out: the unnamed instance, which reads every repository whose owner no instance is named after.
- `tokenEnv`: the variable holding the token, a fine-grained one with Actions: read on the repositories (a classic one with `repo`). Its value never goes into an error, a notice, an event or a file.
- `apiUrl`: the REST API's address; default `https://api.github.com`. GitHub Enterprise Server's is `https://<host>/api/v3`.
- `poll.everySeconds`: a whole number of seconds, 1 or more, between two polls; default 120. A poll asks once per project with a `ci.workflow`, and GitHub allows a token 5000 requests an hour.

Refused at load, with the option's path: an unknown option or key, no instances, a `name` that is not a lowercase owner, two unnamed instances or one name twice, an `apiUrl` that is not http or https, a `poll.everySeconds` below 1 or not whole. At setup, naming the option or the project:

- a token that is empty or that a header cannot carry: `instances[<n>].tokenEnv: <variable> is empty or holds a space or a character outside ASCII, which a header cannot carry`;
- a project with a `ci.workflow` whose checkout has no `origin`: `project <name>: ci.workflow is set, but its checkout has no origin remote to name its GitHub repository`; one whose `origin` ends in no `<owner>/<repository>`: `project <name>: its origin remote names no <owner>/<repository>` (the remote's URL is never said: it may hold a credential);
- a project whose owner no instance is named after, with no unnamed instance: `project <name>: no instance of github is named <owner>, the owner of <owner>/<repository>, and none is unnamed; github's instances: <names>`.

A project without `ci` is not polled.

## The runs

A project's repository is its checkout's `origin`, `git@github.com:<owner>/<repository>.git` or `https://github.com/<owner>/<repository>`; its workflow is `ci.workflow`, the file name in `.github/workflows/` (`ci.yml`) or the workflow's id. At the start of `arthur run`, then every `poll.everySeconds`, each such project's 100 newest runs of that workflow are asked for (`GET /repos/<owner>/<repository>/actions/workflows/<workflow>/runs`), one project after the other.

The branches in play are the checkout's own branch (main) and the branch of every job of the project (`host.jobs.list()`), in any state, while it still exists in the checkout. A branch's run is the newest run on the nearest commit of its first-parent line, from its tip back at most 1000 commits, that has one: a commit that touches no path the workflow watches has no run, so the run before it counts. A job's branch not pushed yet has the run of the commit it started from on main.

Once a branch's run is `completed`, and its id was not told before, the plugin emits `ci-finished`:

`{ project, repo, workflow, run, sha, branch, branches, conclusion, url }`

with `run` the run's id, `sha` and `branch` the commit and the branch GitHub ran it on, `branches` the branches in play whose run it is (a job's branch fresh from main shares main's run: one event), `conclusion` GitHub's (`success`, `failure`, `cancelled`, `timed_out`, `skipped`, ...) and `url` the run's page. A run is told once, however many polls see it. A branch deleted while in play leaves it at the next poll: its run is not told and nothing is said.

## Across a restart

`.arthur/github/state.json` holds, for each project, the ids of its runs already told that GitHub still lists, written to a temporary name and renamed when they change. A run that finished while `arthur run` was down is told at the first poll after it; one told before is not. A project's first poll, with nothing in the file for it, tells nothing: what finished before Arthur watched it is taken as told. A file that is not what the plugin writes (broken, edited by hand) is taken as no project polled yet, so nothing is told twice.

## Failures

- A refusal the owner must fix is said once, as a notice, `github: instance <name>: <reason>; polling goes on and says this again only after GitHub answered`: `401: the token in <variable> was refused: <GitHub's message>`, `403 for workflow <workflow> of <owner>/<repository>: <GitHub's message>; the token in <variable> needs Actions: read on it`, `404: workflow <workflow> of <owner>/<repository> not found, or the token in <variable> cannot see it`. A 401 of an instance with several projects is one notice; it is said again once each of them was answered and is refused anew.
- GitHub out of reach, no answer in 30 s, any other status, or an answer that holds no runs: one line on stderr, `github: instance <name>: <reason>`, likewise once until an answer.
- A rate limit, as GitHub's "Rate limits for the REST API" says: a refusal with `retry-after` (a 403 or 429) waits that many seconds; with `x-ratelimit-remaining: 0`, until `x-ratelimit-reset`; a 429, or a 403 that names a rate limit, without either, one minute. Until then the instance asks nothing, its other projects included, and one line goes to stderr: `github: instance <name>: <status>, rate limited: <GitHub's message>; no request until <ISO time>`. An answer with runs that says 0 requests left is used, and the instance waits for `x-ratelimit-reset` likewise, without a line.
