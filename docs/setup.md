# Setting up Arthur on a VPS

From a fresh VPS to a running Arthur, step by step. Arthur is one process, `arthur run`, in the folder that holds `arthur.config.ts`; a systemd user service keeps it running: it starts it at boot and again whenever it ends. Commands are for Ubuntu or Debian. Each step ends with **Check:**, the command that proves the step is done and what it prints; run it before the next step.

Arthur is in development. Of what this page sets up, `arthur run`, `arthur config check`, `arthur projects`, `arthur board` and `arthur attach` exist today; a step that needs something not built yet says `Not built yet (roadmap entry N)` and gives the way to do it by hand until then. The rest comes in the order of [`spec/roadmap.md`](../spec/roadmap.md).

Jobs on another machine, the threat model, daily use and updating are in [`deploy.md`](deploy.md).

## 1. A user for Arthur, not root

Arthur, its coordinator and every job run as one Linux user and can do whatever that user can (see the threat model in [`deploy.md`](deploy.md#threat-model)), so give it a user of its own, with `sudo` for the install steps below. As root:

```sh
adduser <user>
usermod -aG sudo <user>
rsync --archive --chown=<user>:<user> ~/.ssh /home/<user>
```

The last line lets the key you log in with as root log you in as `<user>` too. Log out, then log in again as `<user>` (`ssh <user>@<vps>`), and run every following step as that user.

**Check:** `id -un` prints `<user>`, not `root`; `sudo true` asks for its password and exits 0.

## 2. Node 24, git, tmux and OMP

Each line checks first and installs only what is missing. Node comes from nvm and OMP is a standalone binary in `~/.local/bin`; both reach `PATH` through `~/.bashrc`, so run this in a normal SSH login shell.

```sh
sudo apt-get update
node -e 'process.exit(parseInt(process.versions.node) >= 24 ? 0 : 1)' 2>/dev/null || { [ -s ~/.nvm/nvm.sh ] || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash; . ~/.nvm/nvm.sh && nvm install 24 && nvm alias default 24; }
command -v git >/dev/null || sudo apt-get install -y git
command -v tmux >/dev/null || sudo apt-get install -y tmux
command -v omp >/dev/null || { curl -fsSL https://omp.sh/install | sh && export PATH="$HOME/.local/bin:$PATH"; }
```

**Check:** each prints its version: `node --version` (`v24` or newer, such as `v24.21.0`), `git --version` (`git version 2.43.0`), `tmux -V` (`tmux 3.4`), `omp --version` (`omp/18.3.0`).

## 3. `omp login`

```sh
omp login
```

`omp login` waits for the browser's OAuth callback on `localhost:54545`, which a headless VPS does not have. Either connect with `ssh -L 54545:localhost:54545 <vps>` and run `omp login` there, then open the printed URL in your local browser, so the callback travels through the tunnel; or open the URL anywhere and paste the final redirect URL into OMP when it asks.

**Check:** `omp usage` lists the account you logged in with, under its provider, with its usage limits.

## 4. Get Arthur, and `arthur` on your `PATH`

```sh
git clone https://github.com/kacperadler/arthur.git ~/arthur
cd ~/arthur
npm ci
printf 'export PATH="$HOME/arthur/node_modules/.bin:$PATH"\n' >> ~/.bashrc
export PATH="$HOME/arthur/node_modules/.bin:$PATH"
```

**Check:** `arthur version` prints the version of the core, 12 hex digits such as `c88b660134fb`.

## 5. `arthur.config.ts`

Write `~/arthur/arthur.config.ts` with the two plugins built so far: `orchestration`, which every config needs, and `projects`, with your projects. Each project names its repository: `path`, a clone already on this machine, or `repo`, a Git URL Arthur clones into `reposDir` (see `arthur projects --help`):

```ts
import { defineConfig } from "@arthur/core";
import { orchestration } from "@arthur/orchestration";
import { projects } from "@arthur/projects";

export default defineConfig({
	plugins: [orchestration({}), projects({ list: [{ name: "shop", prefix: "SH", path: "/home/<user>/shop" }] })],
});
```

Do not copy `arthur.config.example.ts`: it lists every plugin, planned ones included, and the packages of those do not exist yet, so it does not load (`Cannot find package '@arthur/commit-rules'`). Take a plugin from it once its roadmap entry is merged.

The config stays in `~/arthur`, so its `@arthur/*` imports resolve from the clone's `node_modules`. Its `core.home` (default `.arthur/` beside it) holds Arthur's state: the event log, each plugin's folder, the job records, and `run.pid`. Job worktrees go to `.arthur-worktrees/` beside the repository they start from. Git ignores `arthur.config.ts` and `.arthur/` (`.gitignore`): the config holds your own project list, which never goes to the public repository; `git pull` leaves it as it is.

**Check:** `arthur config check` exits 0, and `arthur projects` lists each project with its folder, such as:

```
SH shop
  /home/<user>/shop; 0 open tickets; install: none
```

## 6. `.env`

The config holds no secret: an option ending in `Env` names a variable, and its value comes from the shell or from `.env` beside the config (`core.envFile`). Git ignores `.env`; keep it readable by you alone:

```sh
touch .env
chmod 600 .env
arthur config check
```

`arthur config check` lists every variable the enabled plugins need, `set` or `missing`, never a value. Add each missing one to `.env` as `KEY=value` and run it again until every line says `set`. The two plugins of step 5 need none, so today it prints `no enabled plugin names an env variable`.

**Check:** every line of `arthur config check` says `set` (or it prints `no enabled plugin names an env variable`), and `stat -c %a .env` prints `600`.

## 7. Each project's board

Arthur reads a project's tickets from its board, `spec/build.json` in the project's repository. A missing board reads as an empty one, and the first `arthur ticket new <title>` writes it (see `arthur ticket --help`).

Not built yet (roadmap entry 42): `arthur init <project>`, which gives a repository the `spec/` skeleton, the criteria files and an empty board, and an onboarding job that drafts the project's vision and criteria. Until then, nothing else is needed: the board starts empty.

**Check:** `arthur board` prints `the board is empty` for a new project, or its tickets; `arthur board --project <name>` for another project.

## 8. Tell systemd where node and omp are

systemd reads neither `~/.bashrc` nor a glob such as `~/.nvm/versions/node/*`. Write the `PATH` the service uses from this login shell:

```sh
mkdir -p ~/.config
printf 'PATH=%s:%s/.local/bin:/usr/local/bin:/usr/bin:/bin\n' "$(dirname "$(which node)")" "$HOME" > ~/.config/arthur.env
cat ~/.config/arthur.env
```

It prints something like `PATH=/home/<user>/.nvm/versions/node/v24.21.0/bin:/home/<user>/.local/bin:/usr/local/bin:/usr/bin:/bin`. Run the `printf` again after `nvm install` switches Node to a new version, then restart the service. A tool a project's jobs need, such as `bun` for a project's install, goes on this `PATH` (`~/.local/bin` is on it), and at the top of `~/.bashrc` on another machine (step 3 of [Another machine for jobs](deploy.md#another-machine-for-jobs)); a project's Node version comes from its `.nvmrc` once the nvm plugin (roadmap 84) is on.

**Check:** with nothing but that file's `PATH`, both are found:

```sh
env -i "$(cat ~/.config/arthur.env)" sh -c 'node --version && omp --version'
```

It prints the two versions of step 2, such as `v24.21.0` and `omp/18.3.0`.

## 9. The service

```sh
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/arthur.service <<'EOF'
# Keeps `arthur run` alive: started at boot (with linger) and again 5 s after it ends, for any reason.
[Unit]
Description=Arthur (arthur run)

[Service]
WorkingDirectory=%h/arthur
# PATH with node and omp, written in step 8. Without the file the service does not start.
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
```

**Check:**

- `systemctl --user is-active arthur` prints `active`;
- `loginctl show-user "$USER" -p Linger` prints `Linger=yes`;
- `systemctl show "user@$(id -u)" -p Restart` prints `Restart=always`;
- `journalctl --user -u arthur -n 20` shows `arthur run: pid <pid> started <plugins>`.

## 10. CPU and memory for the jobs

Each job runs under the same manager in a scope of its own, `arthur-job-<id>.scope`, inside `arthur-jobs.slice`, whose limits are `core.jobs.cpu` and `core.jobs.memory`, so all jobs together cannot starve the coordinator; whatever a job leaves running is killed when it ends. The manager holds jobs to those limits only when the system delegates the CPU and memory controllers to it, as systemd 255 of Ubuntu 24.04 does by default. When the check below misses either, delegate them, then reboot so the manager starts with them:

```sh
printf '[Service]\nDelegate=cpu cpuset io memory pids\n' | sudo install -D -m 644 /dev/stdin /etc/systemd/system/user@.service.d/delegate.conf
sudo systemctl daemon-reload
```

`systemctl --user status arthur-jobs.slice` shows the jobs running and what they use. Without a user manager (macOS, a container) a job runs bare, with no joint limit, and the first line of its log says so.

**Check:** this prints a line with `cpu` and `memory`, such as `cpu memory pids`:

```sh
cat "/sys/fs/cgroup/user.slice/user-$(id -u).slice/user@$(id -u).service/cgroup.controllers"
```

## 11. Other machines (optional): Tailscale

Jobs on other machines ([deploy.md](deploy.md#another-machine-for-jobs), roadmap entry 30), model providers on them (82) and the panel (77) reach them over Tailscale, a private network. Only those need this step: a single VPS needs none of it, so skip it.

On the VPS and on each other machine, as that machine's user:

```sh
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

`tailscale up` prints a login URL: open it and sign in to the same account on every machine. In the Tailscale admin console, turn on MagicDNS (the DNS page), so each machine answers to its name, such as `mac`. Then, on the VPS, add each other machine to `~/.ssh/config` by that name, with the user it has there:

```
Host mac
  User <user>
```

Repeat the `Host` block for each machine. The key must already be accepted there: if `ssh mac true` asks for a password, copy the key with `ssh-copy-id mac`, as in step 4 of [Another machine for jobs](deploy.md#another-machine-for-jobs).

**Check:** `ssh <name> true` exits 0 without a password prompt, for each machine in `~/.ssh/config`:

```sh
ssh mac true
```

## 12. The coordinator

`arthur run` starts the coordinator, one `omp` in its own tmux session (roadmap entry 23). Talk to it from the terminal:

```sh
arthur attach
```

Detach with `Ctrl-b d`; the coordinator goes on.

**Check:** `arthur attach` opens the coordinator's `omp` session. When none runs, it says `arthur attach: no coordinator: tmux session <session> (socket <socket>) is not running; arthur run starts it`: go back to step 9.

## 13. A channel

Not built yet (roadmap entries 47 to 50): Telegram, which lets you talk to the coordinator from your phone. Until then the terminal of step 12 is the only way in.

**Check:** none yet.

## 14. Check everything with `arthur doctor`

Not built yet (roadmap entry 80). It is the last step of the install, and the first thing to run after an update or a reboot that went wrong:

```sh
arthur doctor
```

It checks by code, without the model, what the enabled plugins need: git, Node 24, `omp`, a writable home, the service enabled with `Restart=always` and linger on, the Telegram token and bot, `ffmpeg` for the videos you send, Docker and SSH to each machine, the disk floor. It prints one line per requirement, `ok` or `missing: <reason>; without it: <what does not work>; fix: <fix>`, and exits 1 when something critical is missing (git, `omp`, a writable home), which also refuses the start of `arthur run`. Run each fix and `arthur doctor` again until no line says `missing`. At every start the same check runs first, and the start notice begins with what is still missing, each line once a day unless it changes.

Until then, run the checks of steps 2, 8 and 9 by hand.

**Check:** no line of `arthur doctor` says `missing`. Today it answers `arthur: unknown command doctor`.

## 15. What is there and what is missing: `arthur setup`

Not built yet (roadmap entry 94). One command that runs the checks above and walks you through each missing step: the tools it finds (git, Node, omp, ssh, tmux, Docker, ffmpeg, whisper-cli, Tailscale) with their versions; each plugin, `on` or `off`, with its options set and not set and its env variables `set` or `missing`, never a value; `arthur doctor`'s lines; every plugin you could still add to `arthur.config.ts`, with each of its options and what it means; and the next steps, numbered, each with its fix. It writes nothing and installs nothing; run it again after each fix.

Until then, run each step's Check on this page.

**Check:** `arthur setup` lists nothing under Next. Today it answers `arthur: unknown command setup`.
