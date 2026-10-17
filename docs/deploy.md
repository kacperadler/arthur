# Running Arthur on a VPS

Arthur is one process, `arthur run`, in the folder that holds `arthur.config.ts`. A systemd user service keeps it running: it starts it at boot and again whenever it ends. Commands are for Ubuntu or Debian; run them as the user who will own Arthur, not as root.

Arthur is in development. Of what this page sets up, `arthur run` and `arthur config check` exist today, `arthur spawn` starts a job with its limits (time, budget, and the joint CPU and memory of all jobs), `arthur stop`, `arthur continue` and `arthur steer` act on it, and `arthur jobs`, `arthur prune` and `arthur stopall` list, free and stop jobs; the plugins and the rest of the job runner come in the order of [`spec/roadmap.md`](../spec/roadmap.md). A line that names a roadmap entry describes what that entry builds.

## 1. Install Node, git, tmux and OMP

Each line checks first and installs only what is missing. Node comes from nvm and OMP is a standalone binary in `~/.local/bin`; both reach `PATH` through `~/.bashrc`, so run this in a normal SSH login shell.

```sh
sudo apt-get update
node -e 'process.exit(parseInt(process.versions.node) >= 24 ? 0 : 1)' 2>/dev/null || { [ -s ~/.nvm/nvm.sh ] || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash; . ~/.nvm/nvm.sh && nvm install 24 && nvm alias default 24; }
command -v git >/dev/null || sudo apt-get install -y git
command -v tmux >/dev/null || sudo apt-get install -y tmux
command -v omp >/dev/null || { curl -fsSL https://omp.sh/install | sh && export PATH="$HOME/.local/bin:$PATH"; }
omp login
```

`omp login` waits for the browser's OAuth callback on `localhost:54545`, which a headless VPS does not have. Either connect with `ssh -L 54545:localhost:54545 <vps>` and run `omp login` there, then open the printed URL in your local browser, so the callback travels through the tunnel; or open the URL anywhere and paste the final redirect URL into OMP when it asks.

## 2. Get Arthur and write its config

```sh
git clone https://github.com/kacperadler/arthur.git ~/arthur
cd ~/arthur
npm ci
printf 'export PATH="$HOME/arthur/node_modules/.bin:$PATH"\n' >> ~/.bashrc
export PATH="$HOME/arthur/node_modules/.bin:$PATH"
cp arthur.config.example.ts arthur.config.ts
```

Edit `arthur.config.ts`: keep the plugins you want (`orchestration` is required) and remove the rest. It stays in `~/arthur`, so its `@arthur/*` imports resolve from the clone's `node_modules`. Its `core.home` (default `.arthur/` beside it) holds Arthur's state: the event log, each plugin's folder, the job records, and `run.pid`. Job worktrees go to `.arthur-worktrees/` beside the repository they start from, here `~/.arthur-worktrees/`. Git ignores `arthur.config.ts` (`.gitignore`): it holds your own project list, which never goes to the public repository; `git pull` leaves it as it is.

## 3. `.env`

The config holds no secret: an option ending in `Env` names a variable, and its value comes from the shell or from `.env` beside the config (`core.envFile`). Git ignores `.env`; keep it readable by you alone:

```sh
touch .env
chmod 600 .env
arthur config check
```

`arthur config check` lists every variable the enabled plugins need, `set` or `missing`, never a value. Add each missing one to `.env` as `KEY=value` and run it again until every line says `set`.

## 4. Tell systemd where node and omp are

systemd reads neither `~/.bashrc` nor a glob such as `~/.nvm/versions/node/*`. Write the `PATH` the service uses from this login shell:

```sh
mkdir -p ~/.config
printf 'PATH=%s:%s/.local/bin:/usr/local/bin:/usr/bin:/bin\n' "$(dirname "$(which node)")" "$HOME" > ~/.config/arthur.env
cat ~/.config/arthur.env
```

It prints something like `PATH=/home/<user>/.nvm/versions/node/v24.21.0/bin:/home/<user>/.local/bin:/usr/local/bin:/usr/bin:/bin`. Run the `printf` again after `nvm install` switches Node to a new version, then restart the service. A tool a project's jobs need, such as `bun` for a project's install, goes on this `PATH` (`~/.local/bin` is on it), and at the top of `~/.bashrc` on another machine (step 3 there); a project's Node version comes from its `.nvmrc` once the nvm plugin (roadmap 84) is on.

## 5. The service

```sh
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/arthur.service <<'EOF'
# Keeps `arthur run` alive: started at boot (with linger) and again 5 s after it ends, for any reason.
[Unit]
Description=Arthur (arthur run)

[Service]
WorkingDirectory=%h/arthur
# PATH with node and omp, written in step 4. Without the file the service does not start.
EnvironmentFile=%h/.config/arthur.env
ExecStart=%h/arthur/node_modules/.bin/arthur run
Restart=always
RestartSec=5
# A stop sends SIGTERM to `arthur run` alone, which stops its plugins in reverse order; what is left in the unit then gets
# SIGKILL, and so does everything once TimeoutStopSec has passed.
KillMode=mixed
TimeoutStopSec=60

[Install]
WantedBy=default.target
EOF
sudo loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable --now arthur
systemctl --user status arthur
```

`status` shows `active (running)`, and its log ends with `arthur run: pid <pid> started <plugins>`.

The service runs under systemd's user manager, `user@<uid>.service`, and dies with it. `enable-linger` starts the manager at boot but does not start it again after it dies, so Arthur would stay down until someone logs in. A drop-in for the system's `user@.service` starts the manager again 5 s after it ends, and the manager starts Arthur. It applies to every user on the host:

```sh
printf '[Service]\nRestart=always\nRestartSec=5\n' | sudo install -D -m 644 /dev/stdin /etc/systemd/system/user@.service.d/restart.conf
sudo systemctl daemon-reload
systemctl show "user@$(id -u)" -p Restart
```

The last command prints `Restart=always`.

Each job runs under the same manager in a scope of its own, `arthur-job-<id>.scope`, inside `arthur-jobs.slice`, whose limits are `core.jobs.cpu` and `core.jobs.memory`, so all jobs together cannot starve the coordinator; whatever a job leaves running is killed when it ends. The manager holds jobs to those limits only when the system delegates the CPU and memory controllers to it, as systemd 255 of Ubuntu 24.04 does by default. Check:

```sh
cat "/sys/fs/cgroup/user.slice/user-$(id -u).slice/user@$(id -u).service/cgroup.controllers"
```

It prints a line with `cpu` and `memory`, such as `cpu memory pids`. When either is missing, delegate them, then reboot so the manager starts with them:

```sh
printf '[Service]\nDelegate=cpu cpuset io memory pids\n' | sudo install -D -m 644 /dev/stdin /etc/systemd/system/user@.service.d/delegate.conf
sudo systemctl daemon-reload
```

`systemctl --user status arthur-jobs.slice` shows the jobs running and what they use. Without a user manager (macOS, a container) a job runs bare, with no joint limit, and the first line of its log says so.

## 6. Check everything with `arthur doctor`

The last step of the install, and the first thing to run after an update or a reboot that went wrong (entry 80):

```sh
arthur doctor
```

It checks by code, without the model, what the enabled plugins need: git, Node 24, `omp`, a writable home, the service enabled with `Restart=always` and linger on, the Telegram token and bot, `ffmpeg` for the videos you send, Docker and SSH to each machine, the disk floor. It prints one line per requirement, `ok` or `missing: <reason>; without it: <what does not work>; fix: <fix>`, and exits 1 when something critical is missing (git, `omp`, a writable home), which also refuses the start of `arthur run`. Run each fix and `arthur doctor` again until no line says `missing`. At every start the same check runs first, and the start notice begins with what is still missing, each line once a day unless it changes.

## Another machine for jobs

A job can run on another machine, such as a Mac for an iOS build (`arthur spawn --machine <name>`, roadmap entries 21 and 22; the `machines` plugin of entry 30 lists them). Arthur reaches it only over SSH, as `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 <host>`: never with a password, never accepting a host key it does not know, giving up after 10 seconds on a machine that does not answer. The machine runs the job's worktree, agent and guards through its own `arthur`; Arthur sends it no secret, only the task, the prompt and the commits. `arthur stop`, `steer`, `continue` and `prune` of its jobs run there too. It needs:

1. Node 24, git and OMP, logged in with its own credential (`omp login` there), as in step 1.
2. Arthur's core of the same version as here: clone and `npm ci` as in step 2, at the same commit, without a config. `arthur version` prints the version; both machines must print the same, or every spawn there is refused naming both. Update it there with every update here.
3. `node`, `omp`, `git` and `arthur` on the `PATH` of a command run over SSH, which reads no profile and returns early from Ubuntu's `~/.bashrc`: put the `PATH` line at the top of `~/.bashrc` there, before its `case $- in` line, not at its end.
4. From this host, as Arthur's user: a key the machine accepts (`ssh-copy-id <host>`), and its host key known, accepted once by hand. Then this prints the same version as `arthur version` here, without asking anything:

```sh
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes <host> arthur version
```

5. On Linux, linger there (`sudo loginctl enable-linger "$USER"`), so each job gets its scope as in step 5, in a slice limited to the machine's own cores minus one and 70% of its memory; without a user manager (macOS) a job runs bare.

The machine's `home`, as registered, holds the job records (`<home>/jobs/`), each project's repository (`<home>/repos/<project>.git`, created on first use) and the job worktrees (`<home>/repos/.arthur-worktrees/`).

A machine that stops answering (switched off, off the network) does not lose its jobs: they wait `blocked` here and go on there; back within `core.jobs.offlineGraceMinutes` (default 30) they go on here as there, and past it they end `failed: machine offline` here while their worktree there stays for you. A job that ended there meanwhile brings its end and branch once the machine answers again (see `arthur spawn --help`).

## Threat model

Arthur exposes nothing to the internet: no port, no webhook. Every plugin calls out (Telegram and GitHub are polled) or talks to a local process, and other machines are reached over SSH on a private network (Tailscale). A job on another machine can do there whatever that machine's user can, as below. The risk is not who reaches Arthur, but what Arthur and its jobs can reach.

- Arthur, the coordinator and every job run as your Linux user. A job runs `omp` with `bash` and can do whatever you can: read and write your files, use your SSH keys, push wherever they reach, reach the network. A deploy key per repository limits a push to that repository; an account key reaches every repository of the account.
- A channel is a shell. The coordinator acts on what the allowed Telegram chat sends (`telegram`, entry 47), so whoever holds that account holds the VPS. Turn on Telegram's two-step verification.
- Secrets stay in `.env` and in the process that needs them. The env guard (entry 19) refuses a job's tool call that names `.env`; a program a job runs can still read any file you can.
- A job's edits stay in its own worktree: the worktree guard (entry 20) refuses a write into the main checkout, `.arthur/`, another job's worktree, or another project's main checkout or its jobs' worktrees. It parses commands, so it keeps honest mistakes apart; it is not a sandbox. It does not refuse the git commands that rewrite the repository every worktree shares, `git gc`, `prune`, `repack`, `reflog expire`, `maintenance run` and `config`, nor a ref a job moves or deletes from its own worktree.
- Limits: time and money per job (entry 12), and one joint CPU and memory limit for all jobs (entry 13), so jobs cannot starve the coordinator.
- Nothing limits the network, and nothing confines reads.
- Text from outside (an issue, a comment, a message from someone else) that reaches a job can steer it with all of the above. Give each client, or anything you do not screen, its own Linux user with its own Arthur.
- `/stopall` (entry 15) stops every running job without the model.

## Daily use

- State and log: `systemctl --user status arthur`, `journalctl --user -u arthur -f`.
- The coordinator's session: `arthur attach` (entry 23); detach with `Ctrl-b d`.
- Stop: `systemctl --user stop arthur`. Start again: `systemctl --user start arthur`.
- `arthur run` by hand while the service runs is refused, naming the service's pid: one `arthur run` per home folder.
- After a crash the next start takes over `run.pid`, whose pid is dead; after a reboot as well, since the file names the boot it was written in.
- Any other command, `arthur <command>`, runs in `~/arthur` beside the service; `arthur help` lists them.

## Updating

```sh
cd ~/arthur
git pull
npm ci
arthur config check
systemctl --user restart arthur
```

A restart stops every plugin, the coordinator included. Run `arthur jobs` first and restart when none runs.
