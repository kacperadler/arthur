# Running Arthur on a VPS

Arthur is one process, `arthur run`, in the folder that holds `arthur.config.ts`, kept running by a systemd user service. The install, from a fresh VPS to that service, is [`setup.md`](setup.md), each step with the command that checks it. This page holds the rest: another machine for jobs, the threat model, daily use and updating.

Arthur is in development. A line that names a roadmap entry describes what that entry builds; the order is [`spec/roadmap.md`](../spec/roadmap.md).

## Another machine for jobs

A job can run on another machine, such as a Mac for an iOS build (`arthur spawn --machine <name>`, roadmap entries 21 and 22; the `machines` plugin of entry 30 declares and checks them, and with entry 31 places each job on a machine that has the labels its spawn, ticket or project `requires`). Arthur reaches it only over SSH, as `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 <host>`: never with a password, never accepting a host key it does not know, giving up after 10 seconds on a machine that does not answer. The machine runs the job's worktree, agent and guards through its own `arthur`; Arthur sends it no secret, only the task, the prompt and the commits. `arthur stop`, `steer`, `continue` and `prune` of its jobs run there too. It needs:

1. Node 24, git and OMP, logged in with its own credential (`omp login` there), as in steps 2 and 3 of [`setup.md`](setup.md). With the nvm plugin on, nvm in `~/.nvm` there (or `NVM_DIR` set for a command over SSH) and each Node version the projects' `.nvmrc` name, `nvm install <version>` there: a spawn downloads none (`packages/nvm/docs/nvm.md`).
2. Arthur's core of the same version as here: clone and `npm ci` as in step 4 of [`setup.md`](setup.md), at the same commit, without a config. `arthur version` prints the version; both machines must print the same, or every spawn there is refused naming both. Update it there with every update here.
3. `node`, `omp`, `git` and `arthur` on the `PATH` of a command run over SSH, which reads no profile and returns early from Ubuntu's `~/.bashrc`: put the `PATH` line at the top of `~/.bashrc` there, before its `case $- in` line, not at its end. The `machines` plugin's check runs `node -e` there for the machine's free CPU and memory, and with `keepFree.disk` `df -Pk` for its free disk, which the `resources` plugin reads; a machine where `node -e` fails, or where `git` is not found, is offline.
4. From this host, as Arthur's user: a key the machine accepts (`ssh-copy-id <host>`), and its host key known, accepted once by hand. Then this prints the same version as `arthur version` here, without asking anything:

```sh
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes <host> arthur version
```

5. On Linux, linger there (`sudo loginctl enable-linger "$USER"`), so each job gets its scope as in step 10 of [`setup.md`](setup.md), in a slice limited to the machine's own cores minus one and 70% of its memory; without a user manager (macOS) a job runs bare, and a job's `perJob` memory cap of the `resources` plugin is held by sampling its processes every 10 seconds, its CPU not capped.
6. Here, the machine in the `list` of the `machines` plugin in `arthur.config.ts`, with its name, its `ssh` host, its `home` and its labels (see `arthur machines --help`); a host that resolves to a public address is refused at load. `arthur machines` then checks it at once: `online (<os> <arch>, arthur <version>)`, or `offline: <reason>; fix: <fix>`. `arthur run` checks it again at its start and every `check.everySeconds`.

The machine's `home`, as registered, holds the job records (`<home>/jobs/`), each project's repository (`<home>/repos/<project>.git`, created on first use) and the job worktrees (`<home>/repos/.arthur-worktrees/`).

A machine that stops answering (switched off, off the network) does not lose its jobs: they wait `blocked` here and go on there; back within `core.jobs.offlineGraceMinutes` (default 30) they go on here as there, and past it they end `failed: machine offline` here while their worktree there stays for you. A job that ended there meanwhile brings its end and branch once the machine answers again (see `arthur spawn --help`).

## Threat model

Arthur exposes nothing to the internet: no port, no webhook. Every plugin calls out (Telegram and GitHub are polled) or talks to a local process, and other machines are reached over SSH on a private network (Tailscale). A job on another machine can do there whatever that machine's user can, as below. The risk is not who reaches Arthur, but what Arthur and its jobs can reach.

- Arthur, the coordinator and every job run as your Linux user. A job runs `omp` with `bash` and can do whatever you can: read and write your files, use your SSH keys, push wherever they reach, reach the network. A deploy key per repository limits a push to that repository; an account key reaches every repository of the account.
- A channel is a shell. The coordinator acts on what the allowed Telegram chat sends (`telegram`, entry 47), so whoever holds that account holds the VPS. Turn on Telegram's two-step verification.
- Secrets stay in the env file (`core.envFile`) and in the process that needs them. The env guard (entry 19) refuses a tool call of a job or of the coordinator that names a secrets file; a program a job runs can still read any file you can.
- A job's edits stay in its own worktree: the worktree guard (entry 20) refuses a write into the main checkout, `.arthur/`, another job's worktree, another project's main checkout or its jobs' worktrees, Arthur's install (the clone of step 4 of [`setup.md`](setup.md)), the folder of `arthur.config.ts`, the env file, or your `~/.ssh`, `~/.config/systemd` and Git config, `~/.gitconfig` and `~/.config/git/` (also `$XDG_CONFIG_HOME/git/` when Arthur runs with it set elsewhere). A file your Git config includes from elsewhere (`[include] path = ~/dotfiles/gitconfig`) is not followed: a write there passes, and changes Git's identity and hooks in every checkout as a write to `~/.gitconfig` would. It parses commands, so it keeps honest mistakes apart; it is not a sandbox: a program a job runs that writes on its own (`node -e`, `python3 -c`, `tar -C`) or a path built at run time still reaches all of them. It refuses a `git config` that sets or unsets a value in the config every worktree shares, yours (`--global`) or the system's, also through `-C <main>`, `--file <main>/.git/config`, an abbreviated or a `--no-` option; a read, a worktree's own (`--worktree`) and a file outside these places pass. It does not refuse the git commands that rewrite the repository every worktree shares, `git gc`, `prune`, `repack`, `reflog expire` and `maintenance run`, a git command reached through a git alias or a `GIT_DIR` variable, nor a ref no worktree has checked out that a job moves or deletes from its own worktree. It refuses pointing a checkout at a branch another worktree holds, after which a plain commit would move it: `switch` or `checkout` with `--ignore-other-worktrees`, `checkout -B` and `switch -C` (which Git before 2.44 lets through) but for the job's own branch, `worktree add --force`, `symbolic-ref` but `HEAD` to the job's own branch, and a write of the worktree's own `.git` file; it does not see a `.git` file or a `commondir` written outside the worktree that names the repository.
- A program a job runs can write the repository's own Git config, which every worktree shares, and Git runs the programs that config names. So Arthur's own git calls in a main checkout turn off its hooks and `core.fsmonitor` (`-c` on each), and those that may run another program, a worktree's checkout for a spawn (here or on another machine), `arthur merge` (its merge, and the reset after a failed check), `github.push`, and the push and fetch of a job on another machine, are refused, running nothing, while that config (`.git/config`, the main checkout's `config.worktree`, a file either includes) sets a key outside this set: `core.` `repositoryformatversion`, `filemode`, `bare`, `worktree`, `logallrefupdates`, `ignorecase`, `precomposeunicode`, `symlinks`, `autocrlf`, `eol`, `safecrlf`, `hookspath`, `fsmonitor`, `sparsecheckout`, `sparsecheckoutcone`, `untrackedcache`; `extensions.` `objectformat`, `refstorage`, `worktreeconfig`; `remote.<name>.` `url`, `pushurl`, `fetch`, `tagopt`, `prune`, `mirror`; `branch.<name>.` `remote`, `pushremote`, `merge`, `rebase`, `description`; `submodule.<name>.` `url`, `active`; `lfs.repositoryformatversion` and `lfs.<url>.` `access`, `locksverify`; `user.` `name`, `email`; `pull.` `rebase`, `ff`; `push.` `default`, `autosetupremote`; `fetch.prune`; `maintenance.` `auto`, `strategy`; `index.sparse` (what `git init`, `git clone`, Git LFS, a branch's upstream and Arthur write). The refusal names the file and the key: `<file> sets <key>, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`. A filter, a merge driver, a credential helper, `core.sshCommand`, `gpg.program` or an alias of your own goes into `~/.gitconfig`, which the worktree guard keeps from a job (`[includeIf "gitdir:<checkout>/"]` for one repository). The check runs just before each such call, so a program a job runs that rewrites the config in that moment can still win the race; and a remote's `url` is not checked, so a transport it names (`<transport>::<address>`) runs Git's `git-remote-<transport>` from your PATH.
- A job runs only the `arthur` commands its roles need: inside a job (`ARTHUR_JOB` set by the wrapper) the CLI refuses every command not registered with `inJob: true`, so a job does not merge, spawn, stop, steer, prune, send, move the board, change the schedule or record the owner's word (`arthur help --help` lists the ones it runs). The mark is that variable, which a job's shell can clear (`env -u ARTHUR_JOB arthur merge …`): the refusal keeps a mistaken job from acting as the coordinator, not a steered one (AR0354).
- Limits: time and money per job (entry 12), one joint CPU and memory limit for all jobs (entry 13), so jobs cannot starve the coordinator, and with the `resources` plugin each job's own CPU and memory (entry 32), so one job cannot take all of it, and a new job only on a machine whose free CPU and memory keep `keepFree` after the job's reservation (entry 34).
- Nothing limits the network, and nothing confines reads.
- Text from outside (an issue, a comment, a message from someone else) that reaches a job can steer it with all of the above. Give each client, or anything you do not screen, its own Linux user with its own Arthur.
- `/stopall` (entry 15) stops every running job without the model.

## Daily use

- State and log: `systemctl --user status arthur`, `journalctl --user -u arthur -f`.
- The coordinator's session: `arthur attach` (entry 23); detach with `Ctrl-b d`.
- Stop: `systemctl --user stop arthur`. Start again: `systemctl --user start arthur`.
- `arthur run` by hand while the service runs is refused, naming the service's pid: one `arthur run` per home folder.
- After a crash the next start takes over `run.pid`, whose pid is dead; after a reboot as well, since the file names the boot it was written in; and when the new start has the crashed one's pid (a restarted container), since the file is not one it took.
- Any other command, `arthur <command>`, runs in `~/arthur` beside the service; `arthur help` lists them.

## Updating

```sh
cd ~/arthur
git pull
npm ci
arthur config check
systemctl --user restart arthur
```

A restart stops every plugin, the coordinator included. Run `arthur jobs` first and restart when none runs. Until it, once a pull or a merge changed Arthur's code, the session plugin's restart guard refuses every new job, `restart due: ...` (`packages/session/docs/session.md`, "The restart guard"). While one is due, `/restart` from the phone does this restart too, after the coordinator's handoff (`arthur restart --help`).
