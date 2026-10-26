# Setting up Arthur on a VPS

From a fresh VPS to a running Arthur, step by step. Arthur is one process, `arthur run`, in the folder that holds `arthur.config.ts`; a systemd user service keeps it running: it starts it at boot and again whenever it ends. Commands are for Ubuntu or Debian. Each step ends with **Check:**, the command that proves the step is done and what it prints; run it before the next step.

Every command this page runs exists. A line that names a roadmap entry describes what that entry builds; the order is [`spec/roadmap.md`](../spec/roadmap.md).

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

Each line checks first, as in step 2: a clone already in `~/arthur` is kept as it is (update it as [`deploy.md`](deploy.md#updating) says), and the `PATH` line goes into `~/.bashrc` once.

```sh
[ -d ~/arthur/.git ] || git clone https://github.com/kacperadler/arthur.git ~/arthur
cd ~/arthur
npm ci
grep -qs 'arthur/node_modules/.bin' ~/.bashrc || printf 'export PATH="$HOME/arthur/node_modules/.bin:$PATH"\n' >> ~/.bashrc
export PATH="$HOME/arthur/node_modules/.bin:$PATH"
```

**Check:** `arthur version` prints the version of the core, 12 hex digits such as `c88b660134fb`.

## 5. `arthur.config.ts`

Write `~/arthur/arthur.config.ts` with the plugins that take a ticket from a job to its merge, each documented on its page:

- `orchestration`, which every config needs: the coordinator, jobs and `maxAgents`, planning (`arthur coordinator --help`);
- `projects`, with your projects (`arthur projects --help`). Each project names its repository: `path`, a clone already on this machine, or `repo`, a Git URL Arthur clones into `reposDir`. Its `ci.workflow` names the workflow file the `github` plugin watches, in the GitHub repository of the checkout's `origin` remote (`git@github.com:<owner>/<repository>.git` or `https://github.com/<owner>/<repository>`); a project with `ci.workflow` and no such `origin` refuses the setup (`packages/github/docs/github.md`);
- `session`: the coordinator's conversation, compacted by day and fresh at night, `/restart`, and the restart guard (`packages/session/docs/session.md`);
- `schedule`: actions and jobs at set times, and the entries other plugins register from their options, such as `manage`'s audit (`arthur schedule --help`);
- `delivery`: the review of a worker's branch and `arthur merge` (`arthur review --help`, `arthur merge --help`);
- `github`: the CI runs of the branches in play, and the push of a branch a review passed and of main after a merge (`packages/github/docs/github.md`);
- `commit-rules`: each project's `commitRules` (`packages/commit-rules/docs/commit-rules.md`);
- `findings`: what `arthur merge` makes of a ticket's open findings (`packages/findings/docs/findings.md`);
- `manage`: health, stats, the audit, the retro and pruning (`packages/manage/docs/manage.md`).

The channel, `telegram`, comes in step 13, and other machines for jobs with the `machines` plugin of step 11.

```ts
import { defineConfig } from "@arthur/core";
import { commitRules } from "@arthur/commit-rules";
import { delivery } from "@arthur/delivery";
import { findings } from "@arthur/findings";
import { github } from "@arthur/github";
import { manage } from "@arthur/manage";
import { orchestration } from "@arthur/orchestration";
import { projects } from "@arthur/projects";
import { schedule } from "@arthur/schedule";
import { session } from "@arthur/session";

export default defineConfig({
	plugins: [
		orchestration({}),
		session({}),
		schedule({}),
		projects({ list: [{ name: "shop", prefix: "SH", path: "/home/<user>/shop", ci: { workflow: "ci.yml" } }] }),
		commitRules(),
		findings({}),
		delivery({}),
		github({ instances: [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }] }),
		manage({}),
	],
});
```

Do not copy `arthur.config.example.ts`: it lists every plugin, planned ones included, and the packages of those do not exist yet, so it does not load (`Cannot find package '@arthur/discord'`). Take a plugin from it once its roadmap entry is merged.

Every option the core and each built plugin take, with its meaning and its default, is in one table per package, the same one its check walks: the core's in `packages/core/src/core-options.ts`, each plugin's in the file its `package.json` exports as `./options` (for example `packages/orchestration/src/orchestration-options.ts`), with the plugin's one-line summary and the tools it runs.

The config stays in `~/arthur`, so its `@arthur/*` imports resolve from the clone's `node_modules`. Its `core.home` (default `.arthur/` beside it) holds Arthur's state: the event log, each plugin's folder, the job records and `run.pid`. Job worktrees go to `.arthur-worktrees/` beside the repository they start from. Git ignores `arthur.config.ts` and `.arthur/` (`.gitignore`), so your project list never reaches the public repository, and `git pull` leaves both as they are.

**Check:** `arthur config check` refuses nothing and lists the one variable step 6 sets, which `github` names, as `missing`; until step 6 sets it, it exits 1, which here means that variable only, not a broken config:

```
missing ARTHUR_GITHUB_TOKEN (github.instances[0].tokenEnv)
/home/<user>/.config/arthur/.env does not exist; a missing variable must come from the shell
```

## 6. The env file

The config holds no secret: an option ending in `Env` names a variable, whose value comes from the shell or from the env file, `~/.config/arthur/.env` (`core.envFile`; `$XDG_CONFIG_HOME/arthur/.env` when that is set), next to the `arthur.env` of step 8. It lies outside `~/arthur` on purpose. The coordinator works in the config's folder and each job in a project's checkout, and a recursive search there for a variable's name (`grep -r ARTHUR_ .`) would print its value into the agent's transcript, which the model provider keeps. `arthur doctor` warns of an env file inside the config's folder or a project's checkout (`core env`). Keep it readable by you alone:

```sh
mkdir -p ~/.config/arthur
touch ~/.config/arthur/.env
chmod 600 ~/.config/arthur/.env
arthur config check
```

An install whose `.env` still lies beside the config, the old default, moves it with `mv ~/arthur/.env ~/.config/arthur/.env` and leaves `core.envFile` out of `arthur.config.ts`. Until then every variable it holds is missing, and `arthur run` refuses to start.

`arthur config check` lists every variable the enabled plugins need, `set` or `missing`, never a value. Add each missing one to the env file as `KEY=value`, and run it again until every line says `set`. For the plugins of step 5 that is `ARTHUR_GITHUB_TOKEN`, a token as `packages/github/docs/github.md`, "Options", says. A variable's name is the plugin's, `ARTHUR_<PLUGIN>_<WHAT>`, or `ARTHUR_<PLUGIN>_<INSTANCE>_<WHAT>` for a named instance. The config refuses any other name (`github.instances[0].tokenEnv: expected ARTHUR_GITHUB_<WHAT>, got GITHUB_TOKEN`), so a token you already have as `GITHUB_TOKEN` goes into the env file under the plugin's name. Until every variable is set, the config does not load: a plugin's command, such as `arthur projects`, is unknown, and the missing variable is named.

**Check:** every line of `arthur config check` says `set`, it exits 0, and `stat -c %a ~/.config/arthur/.env` prints `600`. `arthur projects` lists each project with its folder, such as:

```
SH shop
  /home/<user>/shop; 0 open tickets; install: none
```

## 7. Each project's board

Arthur reads a project's tickets from its board, `spec/build.json` in the project's repository, and its roles read the project's vision and criteria files. For a repository without a board, `arthur init <project>` writes them: the vision and criteria skeletons, an `.nvmrc` and an empty board, each only where nothing is there yet (see `arthur init --help`); `arthur doctor` lists every project without a board, with that fix. Commit what it wrote, then `arthur spawn --kind onboarding --project <project> 'Onboard <project>.'` starts the onboarding: it reads the repository, asks the owner up to 10 questions through the coordinator, and drafts the vision and criteria on its branch. A repository with tickets already has its board: `arthur init` refuses it.

**Check:** `arthur doctor` prints `projects <project> board: ok` for each project, and `arthur board` prints `the board is empty` for a new project, or its tickets; `arthur board --project <name>` for another project.

## 8. Tell systemd where node and omp are

systemd reads neither `~/.bashrc` nor a glob such as `~/.nvm/versions/node/*`. Write the `PATH` the service uses from this login shell:

```sh
mkdir -p ~/.config
printf 'PATH=%s:%s/.local/bin:/usr/local/bin:/usr/bin:/bin\n' "$(dirname "$(which node)")" "$HOME" > ~/.config/arthur.env
cat ~/.config/arthur.env
```

It prints something like `PATH=/home/<user>/.nvm/versions/node/v24.21.0/bin:/home/<user>/.local/bin:/usr/local/bin:/usr/bin:/bin`. Run the `printf` again after `nvm install` switches Node to a new version, then restart the service.

A tool a project's jobs need, such as `bun` for its install, goes on this `PATH` (`~/.local/bin` is on it); on another machine, at the top of `~/.bashrc` (step 3 of [Another machine for jobs](deploy.md#another-machine-for-jobs)). With the nvm plugin, a project's Node version comes from its `.nvmrc`: each of its jobs and their install run on the Node nvm installed for that version, on each machine (`nvm()` in the plugin list before `projects`, else the load is refused; `packages/nvm/docs/nvm.md`).

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
# What the service and its jobs write, the worktrees outside the home folder included, is readable by this user alone;
# the home folder itself is made so by `arthur run` whatever the umask.
UMask=0077

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

Each job runs under the same manager in a scope of its own, `arthur-job-<id>.scope`, inside `arthur-jobs.slice`, whose limits are `core.jobs.cpu` and `core.jobs.memory`, so all jobs together cannot starve the coordinator. A job's install runs in its scope, and each check of `arthur merge` on main in a scope of its own in the same slice (`arthur merge --help`). Whatever a job or a check leaves running is killed when it ends. The manager holds jobs to those limits only when the system delegates the CPU and memory controllers to it, as systemd 255 of Ubuntu 24.04 does by default. When the check below misses either, delegate them, then reboot so the manager starts with them:

```sh
printf '[Service]\nDelegate=cpu cpuset io memory pids\n' | sudo install -D -m 644 /dev/stdin /etc/systemd/system/user@.service.d/delegate.conf
sudo systemctl daemon-reload
```

`systemctl --user status arthur-jobs.slice` shows the jobs running and what they use. With the `resources` plugin, each job's scope also gets its own `perJob` caps. Without a user manager (macOS, a container) a job runs bare, with no joint limit, and the first line of its log says so; a job with caps there has its memory sampled every 10 seconds instead, its CPU is not capped, and a ticket's CPU and memory caps are not held; a `notice` says so once per machine.

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

Then add each machine to the `machines` plugin in `arthur.config.ts`, as in step 6 of [Another machine for jobs](deploy.md#another-machine-for-jobs); `arthur machines` says `online` for each, or why not and the fix.

## 12. The coordinator

`arthur run` starts the coordinator, one `omp` in its own tmux session (roadmap entry 23). Talk to it from the terminal:

```sh
arthur attach
```

Detach with `Ctrl-b d`; the coordinator goes on.

**Check:** `arthur attach` opens the coordinator's `omp` session. When none runs, it says `arthur attach: no coordinator: tmux session <session> (socket <socket>) is not running; arthur run starts it`: go back to step 9.

## 13. A channel

Telegram lets you talk to the coordinator from your phone, send it photos and files, and run the phone commands from the bot's command menu (roadmap entries 47 to 50). Make a bot and give Arthur its token and your chat id, as `packages/telegram/docs/telegram.md`, "Setting it up", says:

```ts
import { telegram } from "@arthur/telegram";
// in plugins:
telegram({ bots: [{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" }] }),
```

Then restart the service (step 9). Without a channel, the terminal of step 12 is the only way in.

**Check:** `arthur config check` says `set` for both variables, and a message you write to the bot gets the coordinator's answer within a minute.

## 14. Check everything with `arthur doctor`

The last step of the install, and the first thing to run after an update or a reboot that went wrong:

```sh
arthur doctor
```

It checks by code, without the model, what Arthur and the enabled plugins need: git, Node 24, `omp`, a writable home, the CPU and memory controllers delegated (step 10), the env file outside the config's folder and every project's checkout (step 6), no model provider's key in Arthur's environment, `tmux`, the service enabled with `Restart=always` and linger on (step 9), SSH to each machine, each project's `about` and board (step 7), and git's identity in each project's checkout for a merge commit. It prints one line per requirement, `ok` or `missing: <reason>; without it: <what does not work>; fix: <fix>`. It exits 1 when something critical is missing (git, Node 24, `omp`, a writable home, `tmux`), which also refuses the start of `arthur run`. Run each fix and `arthur doctor` again until no line says `missing`. At every start the same check runs first, and the start notice begins with what is still missing, each line once a day unless it changes.

**Check:** no line of `arthur doctor` says `missing`, and it exits 0.

## 15. What is there and what is missing: `arthur setup`

Run it once `arthur` is on your `PATH` (step 4), and again after each fix:

```sh
arthur setup
```

One report of the steps above (`arthur setup --help`): the tools it finds (git, Node, omp, ssh, systemd-run, Tailscale, and each installed plugin's, such as tmux) with their versions or `not found`; the config, each plugin `on` or `off`, with its options set and not set and its env variables `set` or `missing`, never a value; `arthur doctor`'s lines; each installed plugin you could still add to `arthur.config.ts`, with each of its options, what it means and its default; and Next, the steps still to do, numbered, each with its fix: the config first, then the env file, then what refuses the start, then the rest. It installs nothing, runs no model and writes nothing beyond what `arthur doctor` does. Without `arthur.config.ts` its first step is writing it (step 5). It exits 1 while a step in Next would refuse `arthur run`.

**Check:** `arthur setup` says `nothing` under Next, and exits 0.
