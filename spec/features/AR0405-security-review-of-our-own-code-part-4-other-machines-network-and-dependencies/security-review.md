# AR0405 - Security review, part 4: other machines, network and dependencies

Reviewed at main `5041e54d` (`git log --oneline -1`: `5041e54d AR-D177, AR-D178: complete AR0402, AR0404 and AR0405`), by job 2026-10-27-worker-03ddbe1b. No code changed. Probes ran in temporary folders and on loopback, and were removed; none touched the VPS's other machines, the owner's bot, a real secret or a client repository. The findings are in `findings.md` beside this file: 1 high, 1 medium, 2 low.

| Finding | Severity | Area |
| --- | --- | --- |
| F1. A sandboxed job reads Arthur's SSH private key, and with it gets an unconfined shell on every other machine and a push to origin | high | 1 |
| F2. The sweep's copy from another machine has no size or time bound, so one machine stalls every job on it, or all of `arthur run` | medium | 1 |
| F3. The GitHub, Telegram and YouTrack API addresses take `http://` for any host, sending the token in the clear | low | 2 |
| F4. The github plugin's docs offer a classic token with `repo`, which writes every repository of the account | low | 3 |

## AR0311's findings named by the ticket

Each is a ticket already, merged; not filed again.

- **F3** (a copy from another machine writes files outside the job's record): **fixed on main** by AR0346 (`8516f33a`). `packages/core/src/machine-sync.ts:59` refuses the whole answer when a file name is not `^[a-z][a-z0-9-]*$`, before anything is written; `:26` and `:65` write only the run's files (`pid`, `active`, `cost`, `tool-calls`, `activity`, `result`, `commits`, `budget`, `continue`, the caps), never `branch`, `worktree`, `task`, `kind` or `project`; `:60` refuses a record here whose `branch` is not `arthur/<id>`, so the forced fetch (`:71`) takes only the job's own branch. `pid` is still copied, against AR0311's suggestion, but a job there is stopped and steered over SSH (`packages/core/src/job-records.ts:37-39`, `:62-63`), and the local stop signals a pid only when it is a local wrapper of that job (`packages/core/src/job-control.ts:41-43`), so a copied `pid` signals nothing here. `node --import @arthur/core/testing --test --test-name-pattern="a copy refuses a record file|a copy writes only the run's files|a record here whose branch" packages/core/test/machine.test.ts`: `ℹ tests 3`, `ℹ pass 3`, `ℹ fail 0`.
- **F14** (installs and merge checks outside every job scope): **fixed on main** by AR0373 (`e8c574f1`, the install in the job's scope and each merge step in a scope of its own) and AR0449 (`42419925`, both in the sandbox): `packages/core/src/job-install.ts:6-13`, `packages/delivery/src/merge-checks.ts:20-25`. `--ignore-scripts` is not used; lifecycle scripts run, confined as the agent is, so they share F1's reach to `~/.ssh` and the network.
- **F16** (the workflows' token permissions, actions pinned by tag): **fixed on main** by AR0375 (`1f772099`). Both workflows set `permissions: contents: read` at the top (`.github/workflows/ci.yml:7-8`, `site.yml:8-9`); only `site.yml`'s `deploy` job gets `pages: write` and `id-token: write`, which `actions/deploy-pages` needs, and runs only on a push to main. Every action is pinned to a commit with its tag as a comment (`actions/checkout@11d5960a… # v4.4.0`, `actions/setup-node@49933ea5… # v4.4.0`, `actions/upload-pages-artifact@fc324d35… # v5.0.0`, `actions/deploy-pages@368f8252… # v5.0.1`). The runner is `ubuntu-24.04`, not `-latest`.
- **F18** (the models plugin's private network takes two cloud metadata addresses): **fixed on main** by AR0366 (`7b94a261`). `packages/models/src/model-options.ts:27-31` checks `100.100.100.200` and `fd00:ec2::254` before the private ranges. Probe, `isPrivate` on each address:

```
169.254.169.254          refused
100.100.100.200          refused
fd00:ec2::254            refused
::ffff:169.254.169.254   refused
::ffff:a9fe:a9fe         refused
::ffff:100.100.100.200   refused
0.0.0.0                  refused
::                       refused
fe80::1                  refused
fd7a:115c:a1e0::1        taken
100.64.0.1               taken
127.0.0.1                taken
::ffff:127.0.0.1         taken
```

`node --import @arthur/core/testing --test packages/models/test/*.test.ts`: `ℹ tests 18`, `ℹ pass 18`, `ℹ fail 0`.

## 1. Machines and SSH

What was checked: every `ssh` Arthur runs, the host key policy, how a command line for the shell there is built, what the VPS takes back from a machine, and what a job on either side can do to the other. How: `packages/core/src/job-machine.ts`, `machine-sync.ts`, `remote-job.ts`, `job-control.ts`, `job-records.ts`, `job-sandbox.ts`, `packages/machines/src/*.ts`, `docs/deploy.md`, `docs/setup.md` step 11, read whole; the probes below.

### SSH options and host keys: holds

Every ssh Arthur starts carries `-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10` (`job-machine.ts:21`): `ssh` (`:115`), `sshAsync` (`:124`), `host.jobs.run` (`:82`, which the machines plugin's check and the models plugin's probe use) and Git's `GIT_SSH_COMMAND` for the push and fetch (`:146`). Options given with `-o` win over `~/.ssh/config` (ssh takes the first value it obtains, the command line first), so a `StrictHostKeyChecking no` in the config does not weaken it. `ssh -G` (`machine-check.ts:47`) only prints the config's resolution and opens no connection. A host key is never accepted on its own; the docs have the owner accept it by hand (`docs/deploy.md:14`), and the offline fix says to compare `ssh-keyscan` with the key the machine shows (`machine-check.ts:57`). The connection runs over Tailscale, which authenticates each peer, so a first key taken without comparing is a weak spot only inside a compromised tailnet [INFERENCE: not tested].

### Commands built for ssh: holds

Each word is quoted for a POSIX shell there (`job-machine.ts:23`) and the host name must match `^[A-Za-z0-9_][A-Za-z0-9_.@-]*$` (`:22`, `:49`), so it is never an ssh option; the task, the prompt, a continue's instruction and the prepares' variables go as JSON on stdin (`:166`, `job-control.ts:97`, `machine-sync.ts:108`). AR0403 reviewed this argv in its area 1 ("ssh"); nothing changed since.

### Private network of the machines: holds

`machine-check.ts:33-37` takes loopback, RFC 1918, `100.64.0.0/10` and Tailscale's `fd7a:115c:a1e0::/48`, less `100.100.100.200`; a machine whose name resolves to any other address is refused at load (`machines.ts:41-43`) and offline at each check (`machine-check.ts:67`). ssh resolves the name again when it connects, so the check and the connection may see different answers; within MagicDNS the tailnet answers both [INFERENCE: not tested].

### What a machine sends back: holds, except its size and time (F2)

The VPS takes from a machine: the `records` answer (above, AR0311 F3), the job's branch by a fetch run with hooks, `core.fsmonitor` and replacements off and `GIT_PROTOCOL_FROM_USER=0` (`job-machine.ts:143-149`), after `configRefusal` of the main checkout; `arthur version`, compared, not run; and the lines `remote-job launch` and `continue` print, which become a notice or a failure reason (`machine-sync.ts:113-119`). A job there can write its own record there (the sandbox lets it, `job-sandbox.ts:74`), so `cost`, `result` or `state` there are the job's word, as they are for a job here (AR0402's area). What is not bound is the answer's size and its time (F2). Probe of Node's default for `spawnSync`, which `ssh` uses with no `maxBuffer` (`job-machine.ts:115`):

```
$ node -e 'const {spawnSync}=require("node:child_process"); const r=spawnSync("node",["-e","process.stdout.write(\"x\".repeat(2*1024*1024))"],{encoding:"utf8",input:""}); console.log("status",r.status,"signal",r.signal,"error",r.error&&r.error.code,"stdout bytes",r.stdout.length)'
status null signal SIGTERM error ENOBUFS stdout bytes 1059776
```

Then the real `ssh()` of `job-machine.ts`, with a fake `ssh` first on `PATH` (in a temporary folder, removed) that prints 2 MiB, as a copy's `remote-job records` would: `thrown: machine mac: ssh: spawnSync ssh ENOBUFS | cause: undefined`. The cause is not 255, so `syncMachines` (`machine-sync.ts:41-45`) counts it as a failure, not as a machine offline.

The log a copy sends from the byte last asked holds the agent's stream and the install's output (`wrapper.ts:123`, `:137`), so a job that writes more than 1 MiB between two sweeps leaves that machine's every job uncopied from then on, since `synced` (`machine-sync.ts:68`) never moves past it.

### What a job can do on the other side: F1

- A job on another machine runs there in that machine's sandbox on Linux, and bare on macOS (`job-sandbox.ts:91-97`: `darwin has no Landlock`), where it can do whatever that machine's user can, as `docs/deploy.md:29` says. What it reaches here is only the copy above: holds, within F2.
- A job here reaches every machine Arthur's key opens. The sandbox hides only the env file (`job-sandbox.ts:79-82`), `~/.ssh` is readable (`packages/core/docs/commands/spawn.md:116`), and the network is open (`docs/deploy.md:44`). Probe, the real `sandboxed()` over a temporary folder with a fake key and a fake env file (removed after):

```
note: sandbox: the agent writes only in /tmp/ar0405-jxxwnU/work, reads every file but /tmp/ar0405-jxxwnU/env, and opens no Unix socket but a datagram one
stdout: "FAKE PRIVATE KEY\n" stderr: "cat: <tmp>/env: Permission denied\nsh: 1: cannot create <tmp>/home/.ssh/config: Permission denied\n"
```

The key `ssh <machine> true` uses with no prompt under `BatchMode=yes` is such a file (an ssh agent's socket is out of reach: the sandbox opens no Unix stream socket). With it a job gets a shell there as Arthur's user, outside that machine's sandbox and scope, and, where the key also opens GitHub, a push to origin past `arthur merge` (F1). Hiding `~/.ssh` would also refuse an install whose dependencies come over `git+ssh://` [INFERENCE: none of Arthur's projects is known to need that].

## 2. Network: URLs Arthur fetches, SSRF, the models' public-host refusal

What was checked: every outbound request in the packages' sources (`rg -n --no-heading 'fetch\(|https?\.request|node:https|node:http\b|"node:net"|node:dns|redirect' packages/*/src`), where its URL comes from, whether a redirect or a name can lead it to loopback, link-local (the metadata address) or a private address, and where a credential goes.

| Request | URL from | Guard | Verdict |
| --- | --- | --- | --- |
| Uptime check (`packages/uptime/src/site-check.ts`) | config; then each `Location` | the config's host is fetched as named; a hop to another host goes through `node:http(s)` whose socket's own lookup refuses `0/8`, `127/8`, `169.254/16`, RFC 1918, `100.64/10`, `::/127`, `fe80::/10`, `fc00::/7` (`:16-18`), so a name that changes between check and connection is caught (AR0424); at most 20 hops; bad ports refused | holds |
| Model probe (`packages/models/src/probe.ts`) | config | resolved here, every address private and not metadata (F18 above), curl pinned to the address with `resolve`, `noproxy = "*"`, no `--location`, the key on curl's stdin (`:50-77`) | holds |
| Model calls by the agent | config, to the job as `OLLAMA_BASE_URL` / `LM_STUDIO_BASE_URL` (`models.ts:67-74`) | the load refuses a name that resolves to a public address (`models.ts:31-39`); the agent resolves again at each call | holds within the tailnet [INFERENCE: not tested] |
| GitHub API (`packages/github/src/github-api.ts:45`) | `apiUrl` (config) + paths built from a checked `owner/name` (`github.ts:164`) | a redirect is followed; the Authorization header is dropped at a cross-origin hop (probe below) | holds; `http:` taken (F3) |
| YouTrack API (`packages/youtrack/src/youtrack-api.ts:48`) | `urlEnv` (env file) | no user, query or fragment (`youtrack.ts:57-59`); an attachment is downloaded only from the instance's own origin (`youtrack-attachments.ts:16-19`) | holds; `http:` taken (F3) |
| Telegram Bot API (`packages/telegram/src/bot-api.ts:30`) | `apiUrl` (config), default `https://api.telegram.org`; `file_path` from Telegram's answer | Telegram's own answer | holds; `http:` taken (F3) |

Probe of a redirect from the GitHub client to another origin, two loopback servers on different ports, the real `ask`:

```
ask ok: true | Authorization at the cross-origin hop: (none)
```

Probe of the uptime check on a site that redirects to mapped and metadata addresses (the real `checkSite`, a loopback server listening on `::` that counts requests):

```
http://[::ffff:127.0.0.1]/ {"ok":false,"reason":"redirected to [::ffff:7f00:1]:39257, a private address the config does not name","answered":true}
http://[::ffff:7f00:1]/ {"ok":false,"reason":"redirected to [::ffff:7f00:1]:39257, a private address the config does not name","answered":true}
http://[fd00:ec2::254]/ {"ok":false,"reason":"redirected to [fd00:ec2::254], a private address the config does not name","answered":true}
http://100.100.100.200/ {"ok":false,"reason":"redirected to 100.100.100.200, a private address the config does not name","answered":true}
requests reaching the loopback server: 0
```

`node --import @arthur/core/testing --test --test-name-pattern="redirect" packages/uptime/test/*.test.ts`: `ℹ tests 7`, `ℹ pass 7`, `ℹ fail 0`.

The public-host refusal of models: holds (F18 above). A URL must be `http`/`https`, its host an address in the private set, `localhost` or a `*.ts.net` name (`model-options.ts:37-45`); a name is resolved at load and at each probe.

Probe of the API address checks (F3):

```
github http apiUrl problems: []
telegram http apiUrl problems: []
```

## 3. Dependencies and the supply chain

What was checked: both lockfiles, the install commands the docs give, the CI workflows, and the GitHub token's permissions the docs ask for.

- **Arthur's own lockfile: holds.** `package.json` has no `dependencies`, two dev dependencies (`@types/node`, `typescript`). A script over `package-lock.json`: `lockfileVersion 3 | packages 23 | without integrity 0 | hosts registry.npmjs.org | hasInstallScript none | dev-only true` (the 23: `@types/node`, `undici-types`, `typescript` and 20 per-platform `@typescript/typescript-*` binaries). No `.npmrc` in the repository (`ls .npmrc site/.npmrc`: `No such file or directory`). `npm audit --omit=optional`: `found 0 vulnerabilities`.
- **`npm ci`: holds.** The VPS installs with `npm ci` (`docs/setup.md` step 4, `docs/deploy.md:62`), which installs the lockfile exactly and fails when it disagrees with `package.json`; no package of it has an install script.
- **The site's npm project: holds, not on the VPS.** `site/package-lock.json`: `packages 466 | without integrity 0 | hosts registry.npmjs.org | hasInstallScript fsevents` (macOS only, optional). It is installed only by the `site` workflow, whose build job has `contents: read`. `npm audit` in `site/`: 10 moderate, all one advisory, `postcss-selector-parser` "Quadratic complexity in flat selector parsing allows CPU exhaustion" (GHSA-rj75-hqrm-r3gf), via `@astrojs/starlight` → expressive-code → `postcss-nested`, no fix available; it parses only the repository's own CSS at build time, so it is not a finding.
- **GitHub Actions: holds** (AR0311 F16 above). The `pull_request` trigger runs a fork's code with a read-only token and no secret; `setup-node`'s npm cache of a pull request is kept under its own ref [INFERENCE: GitHub's cache scoping, not tested].
- **The token's scopes: F4.** `packages/github/docs/github.md:23` asks for a fine-grained token with Actions: read (read and write for `arthur ci --rerun`) and Pull requests: read, which is the least the plugin needs, but offers "a classic one with `repo`" beside it. The token is used only as a `Bearer` to the API (`github-api.ts:44`); `github.push` uses Git's own credentials (`github-git.ts:63-80`), which is where F1's key comes in.

## Checks run

- `node --import @arthur/core/testing --test --test-name-pattern="a copy refuses a record file|a copy writes only the run's files|a record here whose branch" packages/core/test/machine.test.ts`: 3 tests, 3 pass, 0 fail.
- `node --import @arthur/core/testing --test packages/models/test/*.test.ts`: 18 tests, 18 pass, 0 fail.
- `node --import @arthur/core/testing --test --test-name-pattern="redirect" packages/uptime/test/*.test.ts`: 7 tests, 7 pass, 0 fail.
- The probes quoted above: `isPrivate`, the sandbox over a fake `~/.ssh`, `spawnSync` past 1 MiB, the GitHub client across a cross-origin redirect, `checkSite` against mapped and metadata redirects, the option checks with `http://`, the lockfile script, `npm audit` in both projects.
- `npx tsc` (what `npm run check` runs): exit 0. `npm test`: `ℹ tests 1206`, `ℹ pass 1145`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 61`.
