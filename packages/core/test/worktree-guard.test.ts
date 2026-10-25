import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { type Job, jobRunner } from "../src/jobs.ts";
import { jobSlice, temporaryFolder } from "../src/testing.ts";
import { guardedPlaces, jobPlace } from "../src/job-place.ts";
import worktreeGuard, { worktreeRefusal } from "../src/worktree-guard.ts";

type Call = readonly [string, Record<string, unknown>];
const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

// Waits until `predicate` holds, at most 20 seconds.
async function until<T>(what: string, predicate: () => T | undefined): Promise<T> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) {
		const value = predicate();
		if (value !== undefined) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

// A new repository `<temporary folder>/<name>` with one commit.
function repository(name: string): string {
	const root = join(temporaryFolder(), name);
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), `${name}\n`);
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	return root;
}

// The repository `acme` with its home folder `acme/.arthur`, and two worker jobs the runner spawned from it, `own` and
// `other`, ended. Their agent is an `omp` stand-in that loads each `-e` extension as omp does, asks it about each of
// `calls`, and writes what was refused, in order, to `<its worktree's name>.json` beside itself.
async function jobs(calls: readonly Call[] = []): Promise<{ readonly root: string; readonly home: string; readonly own: Job; readonly other: Job; readonly agent: string }> {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "acme\n");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	const home = join(root, ".arthur");
	const agent = join(temporaryFolder(), "omp");
	writeFileSync(
		agent,
		`#!${process.execPath}
		import { writeFileSync } from "node:fs";
		import { basename, join } from "node:path";
		const args = process.argv.slice(2);
		const handlers = [];
		for (const [index, arg] of args.entries()) if (arg === "-e") (await import(args[index + 1])).default({ on: (event, handler) => handlers.push(handler) });
		const refused = ${JSON.stringify(calls)}.map(([toolName, input]) => handlers.map((handler) => handler({ toolName, input })).find(Boolean)?.reason ?? null);
		writeFileSync(join(import.meta.dirname, basename(process.cwd()) + ".json"), JSON.stringify(refused));\n`,
		{ mode: 0o755 },
	);
	const runner = jobRunner(home, root, join(root, "env"), { timeoutMinutes: 5, budgetUsd: 1, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, clock("UTC", undefined), eventBus(home), () => []);
	const own = await runner.spawn({ task: "own" });
	const other = await runner.spawn({ task: "other" });
	await until("both jobs ended", () => (readEvents(home, 1).filter((event) => event.name === "job-ended").length === 2 ? true : undefined));
	return { root, home, own, other, agent };
}

test("in a job, each call that writes into the main checkout, the home folder or another job's worktree is refused; the rest pass", async () => {
	const { root, home, own, other } = await jobs();
	const place = jobPlace(join(home, "jobs", own.id));
	const [main, otherJob] = [`../../acme`, `../${other.id}`];
	writeFileSync(join(own.worktree, "notes.txt"), "notes\n");
	// A symlink inside the worktree that points out of it, one whose target in the main checkout does not exist yet, and a
	// folder from which a link's relative target reaches the main checkout while from the worktree it does not.
	symlinkSync(root, join(own.worktree, "out"));
	symlinkSync(join(root, "new.txt"), join(own.worktree, "dangling"));
	mkdirSync(join(own.worktree, "sub"));
	const MAIN = "the main checkout";
	const HOME = "Arthur's home folder";
	const OTHER = "another job's worktree";
	// The whole refusal: its patch path is the job's own, never a name in the shared /tmp another job may pick too.
	const STASH = "arthur: refused: git stash keeps one stack for every worktree of the repository, so a pop may apply another job's change here; save a patch in your own worktree instead (git diff > .arthur-stash.patch, then git apply .arthur-stash.patch)";
	const LINK = "a link to a repository";
	// Each call, and the place its refusal names: undefined when it passes.
	const calls: ReadonlyArray<readonly [string, Record<string, unknown>, string | undefined]> = [
		["bash", { command: `echo x > ${main}/README.md` }, MAIN],
		["bash", { command: `echo x 2>>${otherJob}/a.txt` }, OTHER],
		["bash", { command: `rm ${otherJob}/README.md` }, OTHER],
		["bash", { command: `touch ${main}/.arthur/x` }, HOME],
		["bash", { command: `rm ${join(home, "jobs", own.id, "state")}` }, HOME],
		["bash", { command: `cd ${main} && rm README.md` }, MAIN],
		["bash", { command: `cd ${main}\necho x > f` }, MAIN],
		["bash", { command: `pushd ${otherJob} && touch y` }, OTHER],
		["bash", { command: "rm README.md", cwd: main }, MAIN],
		["bash", { command: `cat > ${main}/notes.md <<'EOF'\nhello\nEOF` }, MAIN],
		["bash", { command: `bash <<EOF\nrm ${main}/README.md\nEOF` }, MAIN],
		["bash", { command: `cat <<EOF\n$(rm ${main}/README.md)\nEOF` }, MAIN],
		["bash", { command: `bash <<< 'rm ${main}/README.md'` }, MAIN],
		["bash", { command: "echo x > out/README.md" }, MAIN],
		["bash", { command: "echo x > dangling" }, MAIN],
		["bash", { command: `cp README.md ${main}/` }, MAIN],
		["bash", { command: `mv ${main}/README.md .` }, MAIN],
		["bash", { command: `sed -i s/a/b/ ${main}/README.md` }, MAIN],
		["bash", { command: `ln -s ${main} link` }, MAIN],
		["bash", { command: `ln -s README.md ${main}/link` }, MAIN],
		["bash", { command: "ln -s ../../../acme out/x" }, MAIN],
		["bash", { command: "ln -s ../../../acme sub/link" }, MAIN],
		["bash", { command: "rm ~/acme/README.md" }, MAIN],
		["bash", { command: 'rm "${HOME}/acme/README.md"' }, MAIN],
		["bash", { command: "rm '~/acme/README.md'" }, undefined],
		["bash", { command: `git -C ${main} commit -m x` }, MAIN],
		["bash", { command: `git --work-tree=${otherJob} checkout -- .` }, OTHER],
		["bash", { command: `cd ${otherJob} && git reset --hard` }, OTHER],
		["bash", { command: `git worktree remove ${otherJob}` }, OTHER],
		["bash", { command: `git -C ${main} fetch` }, MAIN],
		["bash", { command: `git -C ${main} push origin main` }, MAIN],
		["bash", { command: `git -C ${main} tag newtag` }, MAIN],
		["bash", { command: `git --git-dir=${main}/.git tag -d v1` }, MAIN],
		["bash", { command: `git -C ${main} branch newbranch` }, MAIN],
		["bash", { command: `git -C ${main} branch -D stale` }, MAIN],
		["bash", { command: `cd ${otherJob} && git branch --set-upstream-to=origin/main` }, OTHER],
		["bash", { command: `git -C ${main} remote add fork ../fork.git` }, MAIN],
		["bash", { command: `git -C ${main} notes add -m x` }, MAIN],
		["bash", { command: "git update-ref refs/heads/main HEAD" }, MAIN],
		// A checkout pointed at a branch another worktree holds: its next plain commit moves that branch.
		["bash", { command: "git switch --ignore-other-worktrees main" }, MAIN],
		["bash", { command: "git checkout --ignore-other-worktrees main" }, MAIN],
		["bash", { command: "git switch --ignore-o main" }, MAIN],
		["bash", { command: "git symbolic-ref HEAD refs/heads/main" }, MAIN],
		["bash", { command: "git symbolic-ref -m x HEAD refs/heads/main" }, MAIN],
		["bash", { command: "git symbolic-ref refs/heads/x refs/heads/main" }, MAIN],
		["bash", { command: `git symbolic-ref refs/heads/x refs/heads/${own.branch}` }, MAIN],
		["bash", { command: "git checkout -B main" }, MAIN],
		["bash", { command: "git checkout -qB main" }, MAIN],
		["bash", { command: "git switch -C main HEAD" }, MAIN],
		["bash", { command: "git switch -qC main" }, MAIN],
		["bash", { command: "git switch --force-c main" }, MAIN],
		["bash", { command: `git checkout -Bmain ${own.branch}` }, MAIN],
		["bash", { command: `git switch --force-create=main ${own.branch}` }, MAIN],
		["bash", { command: "git worktree add -f /tmp/arthur-worktree-guard-test main" }, MAIN],
		["bash", { command: "git worktree add --forc /tmp/arthur-worktree-guard-test main" }, MAIN],
		// A replacement under refs/replace, which every worktree reads main's commits through.
		["bash", { command: "git replace main HEAD" }, MAIN],
		["bash", { command: "git replace -f main HEAD" }, MAIN],
		["bash", { command: "git replace -d main" }, MAIN],
		["bash", { command: "git replace --delete main" }, MAIN],
		["bash", { command: "git replace --edit main" }, MAIN],
		["bash", { command: "git replace --graft main HEAD" }, MAIN],
		["bash", { command: "git replace --convert-graft-file" }, MAIN],
		["bash", { command: "git replace main -- -l" }, MAIN],
		["bash", { command: "git replace - main" }, MAIN],
		["bash", { command: `git -C ${main} replace main HEAD` }, MAIN],
		["bash", { command: "git -c alias.r=replace r main HEAD" }, MAIN],
		["bash", { command: `echo "gitdir: ${root}/.git" > .git` }, MAIN],
		["bash", { command: "rm .git", cwd: "sub" }, LINK],
		["bash", { command: "rm ../.git", cwd: "sub" }, MAIN],
		["write", { path: ".git", content: `gitdir: ${root}/.git` }, MAIN],
		["edit", { input: "[out/../.git#1A2B]\nPUT 1.=1:\n+x" }, MAIN],
		["bash", { command: "git stash" }, STASH],
		["bash", { command: "git stash pop" }, STASH],
		["bash", { command: `timeout 60 sudo -u x rm -rf ${main}` }, MAIN],
		["bash", { command: `find ${main} -name '*.log' -delete` }, MAIN],
		["bash", { command: `find ${otherJob} -name x -exec rm {} +` }, OTHER],
		["bash", { command: `sh -c 'echo x > ${main}/f'` }, MAIN],
		["bash", { command: `eval "rm ${main}/f"` }, MAIN],
		["bash", { command: `echo $(cd ${main} && touch f)` }, MAIN],
		["bash", { command: `true | tee ${main}/log` }, MAIN],
		["bash", { command: `dd if=/dev/zero of=${main}/f` }, MAIN],
		["write", { path: `${main}/README.md`, content: "x" }, MAIN],
		["write", { path: "out/x.txt", content: "x" }, MAIN],
		["write", { path: join(home, "jobs", own.id, "result"), content: "x" }, HOME],
		["edit", { input: `[${otherJob}/README.md#1A2B]\nPUT 1.=1:\n+x` }, OTHER],
		["edit", { input: `[README.md#1A2B]\nMV ${main}/moved.md` }, MAIN],
		["bash", { command: "echo x > notes.txt && rm notes.txt" }, undefined],
		["bash", { command: `rm ../${own.id}/notes.txt` }, undefined],
		["bash", { command: `cat ${main}/README.md > copy.md` }, undefined],
		["bash", { command: `cp ${otherJob}/README.md .` }, undefined],
		["bash", { command: `cd ${main} && git log --oneline && cat README.md` }, undefined],
		["bash", { command: `(cd ${main} && ls) && rm notes.txt` }, undefined],
		["bash", { command: `cd ${main} | true; rm notes.txt` }, undefined],
		["bash", { command: `cd ${main}; cd -P ../.arthur-worktrees/${own.id} && rm notes.txt` }, undefined],
		["bash", { command: `ls`, cwd: main }, undefined],
		["bash", { command: "git commit -am x && git update-ref refs/heads/" + own.branch + " HEAD" }, undefined],
		["bash", { command: `git -C ${main} log && git stash list` }, undefined],
		["bash", { command: `git -C ${main} branch && git -C ${main} branch -a -v && git -C ${main} branch --contains HEAD` }, undefined],
		["bash", { command: `git -C ${main} tag && git -C ${main} tag -l 'v*' && git -C ${main} remote -v && git -C ${main} notes` }, undefined],
		["bash", { command: "git fetch && git tag v1 && git branch tmp && git branch -D tmp && git push origin HEAD" }, undefined],
		["bash", { command: "git switch -c topic && git checkout -- . && git checkout - && git switch --force topic && git switch -f -c x && git checkout -b y" }, undefined],
		["bash", { command: `git symbolic-ref -qm x HEAD refs/heads/${own.branch} && git symbolic-ref HEAD && git symbolic-ref -q --short HEAD` }, undefined],
		["bash", { command: "git symbolic-ref --short refs/remotes/origin/HEAD" }, undefined],
		["bash", { command: `git checkout -B ${own.branch} HEAD~1 && git switch -C ${own.branch} && git switch --no-ignore-other-worktrees topic` }, undefined],
		["bash", { command: "git worktree add /tmp/arthur-worktree-guard-test -b topic && git worktree remove --force /tmp/arthur-worktree-guard-test" }, undefined],
		["bash", { command: "git remote add -f fork /tmp/fork.git && echo x > .gitignore && git checkout -- -B" }, undefined],
		["bash", { command: `git replace && git replace -l && git replace --list 'v*' && git replace --li --format=medium && git -C ${main} replace -l` }, undefined],
		["bash", { command: `echo 'rm ${main}/README.md' > notes.txt` }, undefined],
		["bash", { command: `git commit -m "cd ${main} && rm README.md"` }, undefined],
		["bash", { command: `cat > notes.md <<'EOF'\nrm -rf ${main}\necho x > ${main}/f\nEOF\nrm notes.md` }, undefined],
		["bash", { command: `echo hi # > ${main}/f` }, undefined],
		["bash", { command: "git diff > .arthur-stash.patch && git checkout . && git apply .arthur-stash.patch" }, undefined],
		["bash", { command: "echo x > /tmp/arthur-worktree-guard-test && rm /tmp/arthur-worktree-guard-test" }, undefined],
		["write", { path: "notes.txt", content: "x" }, undefined],
		["write", { path: "local://plan.md", content: "x" }, undefined],
		["edit", { input: "[notes.txt#1A2B]\nPUT 1.=1:\n+x" }, undefined],
		["read", { path: `${main}/README.md` }, undefined],
		["grep", { pattern: "acme", path: main }, undefined],
	];
	// `~` and `$HOME` are the user's home; here the folder that holds the main checkout.
	const user = process.env.HOME;
	process.env.HOME = dirname(root);
	try {
		for (const [toolName, input, expected] of calls) {
			const reason = worktreeRefusal(place, toolName, input);
			const named = reason === undefined ? undefined : reason === STASH ? STASH : reason.includes("which Git reads as a link to a repository") ? LINK : /writes into (.+?) \(/.exec(reason)?.[1];
			assert.equal(named, expected, `${toolName} ${JSON.stringify(input)}: ${reason}`);
		}
	} finally {
		if (user === undefined) delete process.env.HOME;
		else process.env.HOME = user;
	}
	// The refusal shows the path as the call gave it, and names the job's own worktree, where the write would go instead.
	const reason = worktreeRefusal(place, "bash", { command: `rm ${main}/README.md` }) ?? "";
	assert.ok(reason.includes(`(${main}/README.md)`) && reason.includes(` own worktree ${own.worktree}`), reason);
	const replaced = worktreeRefusal(place, "bash", { command: "git replace -d main" }) ?? "";
	assert.ok(replaced.includes("into the main checkout (git replace -d main)"), replaced);
});

test("git config that changes the config every worktree shares, the user's or the system's is refused naming its key; reads, a worktree's own and a file elsewhere pass", async () => {
	const { root, home, own, other } = await jobs();
	const place = jobPlace(join(home, "jobs", own.id));
	const [main, otherJob, elsewhere] = ["../../acme", `../${other.id}`, join(temporaryFolder(), "x.cfg")];
	const [MAIN, OTHER] = ["the main checkout", "another job's worktree"];
	// Each refused call, the place its refusal names and what it shows; undefined to show for a path resolved there.
	const refused: ReadonlyArray<readonly [string, string, string | undefined]> = [
		["git config core.hooksPath /tmp/hooks", MAIN, "git config core.hooksPath"],
		["git config core.fsmonitor /tmp/monitor", MAIN, "git config core.fsmonitor"],
		[`git -C ${main} config receive.denyCurrentBranch ignore`, MAIN, "git config receive.denyCurrentBranch"],
		[`git config --file ${main}/.git/config core.hooksPath /tmp/hooks`, MAIN, `${main}/.git/config`],
		[`git config --file=${main}/.git/config core.hooksPath /tmp/hooks`, MAIN, `${main}/.git/config`],
		[`git config -f${main}/.git/config core.fsmonitor /tmp/monitor`, MAIN, `${main}/.git/config`],
		[`git config --file ${elsewhere} --file ${main}/.git/config core.hooksPath /tmp/hooks`, MAIN, `${main}/.git/config`],
		[`git config --file ${otherJob}/x.cfg a.b c`, OTHER, `${otherJob}/x.cfg`],
		["git config --global core.hooksPath /tmp/hooks", MAIN, "git config --global core.hooksPath"],
		["git config --system core.fsmonitor /tmp/monitor", MAIN, "git config --system core.fsmonitor"],
		["git config --local --unset core.hooksPath", MAIN, "git config core.hooksPath"],
		["git config --unset-a core.hooksPath", MAIN, "git config core.hooksPath"],
		["git config --bool core.bare false", MAIN, "git config core.bare"],
		["git config --type bool core.bare false", MAIN, "git config core.bare"],
		["git config --remove-section core", MAIN, "git config core"],
		["git config unset core.hooksPath", MAIN, "git config core.hooksPath"],
		["git config set core.fsmonitor /tmp/monitor", MAIN, "git config core.fsmonitor"],
		["git config rename-section core old", MAIN, "git config core"],
		["git config remove-section core", MAIN, "git config core"],
		["git config -e", MAIN, "git config"],
		["git config edit", MAIN, "git config"],
		["git config --worktree --no-worktree core.hooksPath /tmp/hooks", MAIN, "git config core.hooksPath"],
		[`git config --file ${elsewhere} --no-file core.hooksPath /tmp/hooks`, MAIN, "git config core.hooksPath"],
		["git config --list --no-list --add core.hooksPath /tmp/hooks", MAIN, "git config core.hooksPath"],
		[`git -C ${main} config --worktree core.hooksPath /tmp/hooks`, MAIN, undefined],
		[`cd ${main} && git config --worktree core.hooksPath /tmp/hooks`, MAIN, undefined],
	];
	for (const [command, name, shown] of refused) {
		const reason = worktreeRefusal(place, "bash", { command }) ?? "";
		const [, named, said] = /writes into (.+?) \((.*?)\);/.exec(reason) ?? [];
		assert.deepEqual([named, shown === undefined ? undefined : said], [name, shown], `${command}: ${reason}`);
	}
	// Each passing call; a read with each option that neither reads nor changes by itself, in the main checkout.
	const plain = ["--global", "--system", "--local", "--worktree", "--file .git/config", "-f .git/config", "--blob HEAD:x", "--type bool", "--type=bool", "-t bool", "--bool", "--int"];
	plain.push("--bool-or-int", "--bool-or-str", "--path", "--expiry-date", "--null", "-z", "--name-only", "--includes", "--show-origin", "--show-scope", "--default x", "--fixed-value", "--comment x", "--value x", "--all", "--regexp", "--url https://example.com");
	const passing = [
		"git config --get user.name",
		"git config --get core.bare true",
		"git config --get-all remote.origin.fetch x",
		"git config --get-regexp core bare",
		"git config --get-urlmatch http https://example.com",
		"git config --get-color color.diff.old red",
		"git config --get-colorbool color.ui true",
		"git config -l",
		"git config --list",
		`git -C ${main} config --show-origin -l`,
		"git config get user.name",
		"git config list",
		"git config user.name",
		"git config --worktree core.hooksPath /tmp/hooks",
		`git config --file ${elsewhere} core.hooksPath /tmp/hooks`,
		"git config --file x.cfg core.hooksPath /tmp/hooks",
		...plain.map((option) => `git -C ${main} config ${option} user.name`),
	];
	for (const command of passing) assert.equal(worktreeRefusal(place, "bash", { command }), undefined, command);
	// Run in the job's worktree, the passing calls leave the shared config and the user's as they were.
	git(root, "config", "extensions.worktreeConfig", "true");
	const [shared, user] = [readFileSync(join(root, ".git", "config"), "utf8"), temporaryFolder()];
	for (const command of passing) spawnSync("sh", ["-c", command], { cwd: own.worktree, env: { ...process.env, HOME: user, GIT_CONFIG_NOSYSTEM: "1" }, stdio: "ignore" });
	assert.deepEqual([readFileSync(join(root, ".git", "config"), "utf8"), existsSync(join(user, ".gitconfig"))], [shared, false]);
	assert.equal(git(own.worktree, "config", "--worktree", "core.hooksPath"), "/tmp/hooks", "the worktree's own config took it");
});

test("a git write through an alias given by -c, or GIT_DIR or GIT_WORK_TREE set before git, is refused; config the guard does not read, or an alias or include written, refuses the call", async () => {
	const { root, home, own, other } = await jobs();
	const place = jobPlace(join(home, "jobs", own.id));
	const [main, otherJob] = ["../../acme", `../${other.id}`];
	const [MAIN, OTHER] = ["the main checkout", "another job's worktree"];
	// Each call refused naming a place, and what the refusal shows; undefined to show for a path resolved there.
	const refused: ReadonlyArray<readonly [string, string, string | undefined]> = [
		["git -c alias.c=config c a.c d", MAIN, "git config a.c"],
		["git -c alias.C=config c a.c d", MAIN, "git config a.c"],
		["git -c alias.c=config C a.c d", MAIN, "git config a.c"],
		["git -c alias.c=status -c alias.c=config c a.c d", MAIN, "git config a.c"],
		["git -c alias.c=config -c alias.x=c x a.c d", MAIN, "git config a.c"],
		["git -c alias.config=status config a.c d", MAIN, "git config a.c"],
		[`git -c 'alias.k="checkout" -- .' -C ${main} k`, MAIN, undefined],
		[`sh -c "git -c alias.k='checkout -- .' -C ${main} k"`, MAIN, undefined],
		[`git --attr-source HEAD -C ${main} commit -m x`, MAIN, undefined],
		[`GIT_DIR=${main}/.git git config --worktree a.c c`, MAIN, `${main}/.git`],
		[`GIT_WORK_TREE=${main} git checkout -- .`, MAIN, main],
		[`GIT_AUTHOR_NAME=x GIT_DIR=${main}/.git GIT_WORK_TREE=${main} git reset --hard`, MAIN, `${main}/.git`],
		[`env GIT_WORK_TREE=${main} git checkout -- .`, MAIN, main],
		[`GIT_WORK_TREE=${otherJob} git -c alias.co=checkout co -- .`, OTHER, otherJob],
	];
	for (const [command, name, shown] of refused) {
		const reason = worktreeRefusal(place, "bash", { command }) ?? "";
		const [, named, said] = /writes into (.+?) \((.*?)\);/.exec(reason) ?? [];
		assert.deepEqual([named, shown === undefined ? undefined : said], [name, shown], `${command}: ${reason}`);
	}
	assert.match(worktreeRefusal(place, "bash", { command: "git -c alias.s=stash s" }) ?? "", /^arthur: refused: git stash/);
	const unseen = [
		"git -c 'alias.c=!echo x > ../../acme/README.md' c",
		"git -c 'alias.d=!echo x' -c alias.c=d c",
		"git -c INCLUDE.path=/tmp/x.cfg c a.c d",
		"git -c include.path=/tmp/x.cfg c a.c d",
		"git -c includeIf.onbranch:main.path=/tmp/x.cfg status",
		"X=config git --config-env=alias.c=X c a.c d",
		"X=config git --config-env alias.c=X c a.c d",
		"X=/tmp/x.cfg git --config-env=include.path=X status",
		"GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.c GIT_CONFIG_VALUE_0=config git c a.c d",
		"GIT_CONFIG_PARAMETERS=\"'alias.c'='config'\" git c a.c d",
		"GIT_CONFIG_GLOBAL=/tmp/x.cfg git c a.c d",
		"GIT_CONFIG_SYSTEM=/tmp/x.cfg git c a.c d",
		"HOME=/tmp/h git c a.c d",
		"XDG_CONFIG_HOME=/tmp/h git c a.c d",
		"git config --worktree alias.c config",
		"git config --worktree Alias.c config",
		"git config --worktree --add alias.c config",
		"git config --worktree set alias.c config",
		"git config --worktree include.path /tmp/x.cfg",
		"git config --worktree includeIf.onbranch:main.path /tmp/x.cfg",
		"git config --file /tmp/x.cfg alias.c config",
		"git config --worktree --rename-section x alias",
		"git config --worktree --rename x alias",
		"git config --worktree rename-section x alias",
		"git config --worktree -e",
		"git config --worktree edit",
	];
	for (const command of unseen) assert.match(worktreeRefusal(place, "bash", { command }) ?? "", /^arthur: refused: this git call reads config the guard does not/, command);
	const passing = [
		"git -c alias.st=status st",
		"git -c alias.c=config c --get user.name",
		"git -c alias.c=config c --worktree a.c d",
		"git -c 'alias.l=log --oneline -1' l",
		"git -c 'alias.x=!echo x > ../../acme/README.md' status",
		"git -c alias.a=b -c alias.b=a a",
		"git -c alias.a=a a",
		"GIT_WORK_TREE=. git checkout -- .",
		"GIT_AUTHOR_NAME=x GIT_CONFIG_NOSYSTEM=1 git commit --allow-empty -m y",
		"git --attr-source HEAD status",
		"git config --worktree user.name Aliasing",
		"git config --worktree core.editor include-me",
	];
	for (const command of passing) assert.equal(worktreeRefusal(place, "bash", { command }), undefined, command);
	// Run in the job's worktree, the passing calls leave the main checkout and its shared config as they were.
	git(root, "config", "extensions.worktreeConfig", "true");
	const [shared, readme] = [readFileSync(join(root, ".git", "config"), "utf8"), readFileSync(join(root, "README.md"), "utf8")];
	for (const command of passing) spawnSync("sh", ["-c", command], { cwd: own.worktree, env: { ...process.env, GIT_COMMITTER_NAME: "x", GIT_COMMITTER_EMAIL: "x@example.com", GIT_AUTHOR_EMAIL: "x@example.com" }, stdio: "ignore" });
	assert.deepEqual([readFileSync(join(root, ".git", "config"), "utf8"), readFileSync(join(root, "README.md"), "utf8")], [shared, readme]);
	assert.equal(git(own.worktree, "config", "--worktree", "a.c"), "d", "the alias ran git config in the worktree's own config");
});

test("a call writing a .git or commondir is refused, and a git write through one that links to the main checkout's repository; a worktree's own link and other repositories pass", async () => {
	const { root, home, own } = await jobs();
	const place = jobPlace(join(home, "jobs", own.id));
	const [MAIN, LINK] = ["the main checkout", "a link"];
	const elsewhere = temporaryFolder();
	const plain = repository("plain");
	const [z, file, g, gdir, viaG, twin, made, odd] = [join(elsewhere, "z"), join(elsewhere, "link"), join(elsewhere, "g"), join(elsewhere, "gdir"), join(elsewhere, "via-g"), join(elsewhere, "twin"), join(elsewhere, "made"), join(elsewhere, "odd")];
	// As a program the guard does not see may leave them: a folder whose `.git` file names the repository, with a repository
	// of its own inside, such a file under another name, a repository folder whose `commondir` names it, a `.git` folder
	// holding one, a `.git` file naming such a folder, one naming the folder of a worktree Git made, which does not name it
	// back, and a `.git` file that is no link.
	mkdirSync(join(z, "sub"), { recursive: true });
	writeFileSync(join(z, ".git"), `gitdir: ${root}/.git\n`);
	mkdirSync(join(z, "inner"));
	git(join(z, "inner"), "init", "--quiet");
	writeFileSync(file, `gitdir: ${root}/.git\n`);
	for (const folder of [g, join(gdir, ".git")]) {
		for (const each of ["refs", "objects"]) mkdirSync(join(folder, each), { recursive: true });
		writeFileSync(join(folder, "commondir"), `${root}/.git\n`);
		writeFileSync(join(folder, "HEAD"), "ref: refs/heads/main\n");
	}
	mkdirSync(viaG);
	writeFileSync(join(viaG, ".git"), `gitdir: ${g}\n`);
	git(root, "worktree", "add", "--quiet", "-b", "made", made);
	mkdirSync(twin);
	writeFileSync(join(twin, ".git"), `gitdir: ${root}/.git/worktrees/made\n`);
	mkdirSync(odd);
	writeFileSync(join(odd, ".git"), `gitdur: ${root}/.git\n`);
	// A link named otherwise to a `.git` not there yet, and a `.git` that is a link to a file named otherwise.
	symlinkSync(join(elsewhere, ".git"), join(elsewhere, "alias"));
	mkdirSync(join(elsewhere, "shown"));
	writeFileSync(join(elsewhere, "x.txt"), "");
	symlinkSync(join(elsewhere, "x.txt"), join(elsewhere, "shown", ".git"));
	mkdirSync(join(own.worktree, "sub"));
	const calls: ReadonlyArray<readonly [string, Record<string, unknown>, string]> = [
		["bash", { command: "git commit --allow-empty -m x", cwd: z }, MAIN],
		["bash", { command: `cd ${z}/sub && git add -A` }, MAIN],
		["bash", { command: `git -C ${z} init` }, MAIN],
		["bash", { command: `git -C ${z} config --worktree user.name x` }, MAIN],
		["bash", { command: `git --git-dir=${file} --work-tree=. commit -m x` }, MAIN],
		["bash", { command: `GIT_DIR=${file} git reset --hard` }, MAIN],
		["bash", { command: `git --git-dir=${g} --work-tree=. commit -m x` }, MAIN],
		["bash", { command: `git --git-dir=${g} branch -f main HEAD` }, MAIN],
		["bash", { command: `git -C ${gdir} commit -m x` }, MAIN],
		["bash", { command: `git -C ${viaG} commit -m x` }, MAIN],
		["bash", { command: `git -C ${twin} commit -m x` }, MAIN],
		["bash", { command: `GIT_COMMON_DIR=${root}/.git GIT_DIR=${elsewhere}/h git commit -m x` }, MAIN],
		["bash", { command: `git init --separate-git-dir=${root}/.git ${elsewhere}/new` }, MAIN],
		["bash", { command: `git init --separate-git-dir ${root}/.git ${elsewhere}/new` }, MAIN],
		["bash", { command: `mkdir ${elsewhere}/y && cd ${elsewhere}/y && echo "gitdir: ${root}/.git" > .git && git commit --allow-empty -m x` }, LINK],
		["bash", { command: `echo ${root}/.git > ${g}/commondir` }, LINK],
		["bash", { command: `printf x | tee ${elsewhere}/commondir` }, LINK],
		["bash", { command: `cp ${file} ${elsewhere}/y/.git` }, LINK],
		["bash", { command: `mv ${file} ${elsewhere}/y/commondir` }, LINK],
		["bash", { command: `ln -s ${file} ${elsewhere}/y/.git` }, LINK],
		["bash", { command: `echo x > ${elsewhere}/alias` }, LINK],
		["bash", { command: `echo x > ${elsewhere}/shown/.git` }, LINK],
		["bash", { command: `rm -rf ${plain}/.git` }, LINK],
		["write", { path: `${elsewhere}/y/.git`, content: `gitdir: ${root}/.git` }, LINK],
		["write", { path: "sub/.git", content: `gitdir: ${root}/.git` }, LINK],
		["edit", { input: `[${g}/commondir#1A2B]\nPUT 1.=1:\n+${root}/.git` }, LINK],
	];
	for (const [toolName, input, expected] of calls) {
		const reason = worktreeRefusal(place, toolName, input) ?? "";
		const named = reason.includes("which Git reads as a link to a repository") ? LINK : /writes into (.+?) \(/.exec(reason)?.[1];
		assert.equal(named, expected, `${toolName} ${JSON.stringify(input)}: ${reason}`);
	}
	// The refusal shows the folder of the call and the repository folder it links to.
	const shown = worktreeRefusal(place, "bash", { command: `git -C ${z} commit -m x` }) ?? "";
	assert.ok(shown.includes(`(${z}, a link to ${root}/.git);`), shown);
	const passing: readonly { readonly command: string; readonly cwd?: string }[] = [
		{ command: "git commit --allow-empty -m x && git add -A && echo x > .gitignore" },
		{ command: "git commit --allow-empty -m x", cwd: "sub" },
		{ command: `git -C ${made} commit --allow-empty -m x` },
		{ command: `git -C ${z}/inner commit --allow-empty -m x` },
		{ command: `git -C ${plain} commit --allow-empty -m x && git --git-dir=${plain}/.git --work-tree=${plain} commit --allow-empty -m y` },
		{ command: `git -C ${plain}/.git branch tmp` },
		{ command: `git -C ${odd} commit --allow-empty -m x` },
		{ command: `git -C ${z} log --oneline && git -C ${z} status` },
		{ command: `git init --quiet ${elsewhere}/fresh && git clone --quiet ${root} ${elsewhere}/clone && echo x > ${elsewhere}/.github` },
		{ command: `git init --quiet --separate-git-dir=${elsewhere}/separate ${elsewhere}/apart && rm -rf ${elsewhere}/apart` },
	];
	for (const input of passing) assert.equal(worktreeRefusal(place, "bash", input), undefined, input.command);
	// Run, the passing calls leave main where it was; a plain commit through each kind of link the guard refuses moves it.
	const env = { ...process.env, GIT_AUTHOR_NAME: "x", GIT_AUTHOR_EMAIL: "x@example.com", GIT_COMMITTER_NAME: "x", GIT_COMMITTER_EMAIL: "x@example.com" };
	const tip = git(root, "rev-parse", "main");
	for (const { command, cwd } of passing) spawnSync("sh", ["-c", command], { cwd: join(own.worktree, cwd ?? "."), env, stdio: "ignore" });
	assert.deepEqual([git(root, "rev-parse", "main"), git(made, "log", "-1", "--format=%s")], [tip, "x"]);
	for (const command of [`git -C ${z} commit --allow-empty -m z`, `git --git-dir=${file} --work-tree=. commit --allow-empty -m file`, `git --git-dir=${g} --work-tree=. commit --allow-empty -m g`, `git -C ${gdir} commit --allow-empty -m gdir`, `git -C ${viaG} commit --allow-empty -m via-g`]) {
		spawnSync("sh", ["-c", command], { cwd: own.worktree, env, stdio: "ignore" });
		assert.equal(git(root, "log", "-1", "--format=%s", "main"), command.split(" ").at(-1), command);
	}
});

test("the wrapper loads the guard into the job's agent, which then refuses its writes outside its worktree and lets the rest through", async () => {
	const calls: Call[] = [
		["bash", { command: "echo x > ../../acme/README.md" }],
		["write", { path: "notes.txt", content: "x" }],
	];
	const { agent, own, other } = await jobs(calls);
	for (const job of [own, other]) {
		const refused = JSON.parse(readFileSync(join(agent, "..", `${job.id}.json`), "utf8")) as (string | null)[];
		assert.match(refused[0] ?? "", /^arthur: refused: this call writes into the main checkout \(\.\.\/\.\.\/acme\/README\.md\)/);
		assert.equal(refused[1], null);
	}
});

test("a job of one project refuses writes into another project's main checkout and its jobs' worktrees, naming it", async () => {
	// Two repositories in folders of their own, so their jobs' worktrees do not share a folder.
	const [alpha, beta] = [repository("alpha"), repository("beta")];
	const home = join(alpha, ".arthur");
	const list = [{ name: "alpha", prefix: "AL", path: alpha }, { name: "beta", prefix: "BE", path: beta }];
	const agent = join(temporaryFolder(), "omp");
	writeFileSync(agent, "#!/bin/sh\n", { mode: 0o755 });
	const collect = (name: string) => (name === "projects" ? [list] : []);
	const runner = jobRunner(home, alpha, join(alpha, "env"), { timeoutMinutes: 5, budgetUsd: 1, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, clock("UTC", undefined), eventBus(home), collect);
	const own = await runner.spawn({ task: "own" });
	const theirs = await runner.spawn({ task: "theirs", project: "beta" });
	await until("both jobs ended", () => (readEvents(home, 1).filter((event) => event.name === "job-ended").length === 2 ? true : undefined));
	assert.equal(dirname(theirs.worktree), join(dirname(beta), ".arthur-worktrees"));
	const record = join(home, "jobs", own.id);
	const place = jobPlace(record);
	const calls: ReadonlyArray<readonly [string, Record<string, unknown>, string | undefined]> = [
		["write", { path: join(beta, "README.md"), content: "x" }, "the main checkout of project beta"],
		["edit", { input: `[${join(theirs.worktree, "README.md")}#1A2B]\nPUT 1.=1:\n+x` }, "a job worktree of project beta"],
		["bash", { command: `rm ${join(theirs.worktree, "README.md")}` }, "a job worktree of project beta"],
		["bash", { command: "touch x", cwd: beta }, "the main checkout of project beta"],
		["bash", { command: `git -C ${beta} commit -m x` }, "the main checkout of project beta"],
		["write", { path: join(alpha, "README.md"), content: "x" }, "the main checkout"],
		["write", { path: "README.md", content: "x" }, undefined],
		["bash", { command: "touch x" }, undefined],
		["bash", { command: `cat ${join(beta, "README.md")} > /dev/null` }, undefined],
	];
	for (const [toolName, input, expected] of calls) {
		const reason = worktreeRefusal(place, toolName, input);
		assert.equal(/writes into (.+?) \(/.exec(reason ?? "")?.[1], expected, `${toolName} ${JSON.stringify(input)}: ${reason}`);
	}
	// A record written before `projects` was, or one a human broke, names no other project.
	writeFileSync(join(record, "projects"), `beta\nbeta relative/path\n`);
	assert.equal(worktreeRefusal(jobPlace(record), "write", { path: join(beta, "README.md"), content: "x" }), undefined);
	rmSync(join(record, "projects"));
	assert.equal(worktreeRefusal(jobPlace(record), "write", { path: join(beta, "README.md"), content: "x" }), undefined);
});

test("a job refuses writes into Arthur's install, config folder and env file, and the user's SSH folder, systemd units and Git config", async (t) => {
	const alpha = repository("alpha");
	// The config's folder apart from the project, and an env file outside it.
	const [config, secrets, user, agent, xdg] = [temporaryFolder(), join(temporaryFolder(), "secrets"), temporaryFolder(), join(temporaryFolder(), "omp"), temporaryFolder()];
	// The user's home as the runner sees it is a link to the folder, as a home on another mount may be.
	const linked = join(temporaryFolder(), "user");
	symlinkSync(user, linked);
	const saved = { HOME: process.env.HOME, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
	t.after(() => {
		for (const [name, value] of Object.entries(saved)) value === undefined ? delete process.env[name] : (process.env[name] = value);
	});
	// Git reads the user's config from `$XDG_CONFIG_HOME/git/` when it is set, and `~/.config/git/` when it is not.
	Object.assign(process.env, { HOME: linked, XDG_CONFIG_HOME: xdg });
	const home = join(config, ".arthur");
	writeFileSync(agent, "#!/bin/sh\n", { mode: 0o755 });
	const collect = (name: string) => (name === "projects" ? [[{ name: "alpha", prefix: "AL", path: alpha }]] : []);
	const runner = jobRunner(home, config, secrets, { timeoutMinutes: 5, budgetUsd: 1, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, clock("UTC", undefined), eventBus(home), collect);
	const own = await runner.spawn({ task: "own" });
	await until("the job ended", () => (readEvents(home, 1).some((event) => event.name === "job-ended") ? true : undefined));
	const record = join(home, "jobs", own.id);
	const place = jobPlace(record);
	// The clone that holds the core under test, as `arthur` runs from it.
	const install = join(import.meta.dirname, "..", "..", "..");
	// A link in the worktree to the user's `~/.ssh`, which does not exist yet.
	symlinkSync(join(user, ".ssh"), join(own.worktree, "keys"));
	const calls: ReadonlyArray<readonly [string, Record<string, unknown>, string | undefined]> = [
		["write", { path: join(config, "arthur.config.ts"), content: "x" }, "Arthur's config folder"],
		["bash", { command: `echo X=1 >> ${secrets}` }, "Arthur's env file"],
		["bash", { command: `touch ${join(home, "x")}` }, "Arthur's home folder"],
		["edit", { input: `[${join(install, "packages", "core", "src", "jobs.ts")}#1A2B]\nPUT 1.=1:\n+x` }, "Arthur's install"],
		["bash", { command: `rm -rf ${join(install, "packages")}` }, "Arthur's install"],
		["write", { path: join(install, "package.json"), content: "x" }, "Arthur's install"],
		["bash", { command: "echo key >> ~/.ssh/authorized_keys" }, "the user's SSH folder"],
		["bash", { command: "echo key > keys/authorized_keys" }, "the user's SSH folder"],
		["write", { path: "~/.config/systemd/user/arthur.service", content: "x" }, "the user's systemd folder"],
		["bash", { command: 'cp unit.service "$HOME/.config/systemd/user/"' }, "the user's systemd folder"],
		["bash", { command: "echo '[user]' >> ~/.gitconfig" }, "the user's Git config"],
		["write", { path: "~/.config/git/config", content: "[core]\n\thooksPath = /tmp/hooks\n" }, "the user's Git config"],
		["bash", { command: "git config --file ~/.config/git/config core.hooksPath /tmp/hooks" }, "the user's Git config"],
		["bash", { command: `echo '*.log' > ${join(xdg, "git", "ignore")}` }, "the user's Git config"],
		["bash", { command: `echo x > ~/notes.txt && touch ~/.config/other ~/.config/gitk ~/.gitconfig.d ${join(xdg, "other")} ${join(xdg, "gitk")}` }, undefined],
		["write", { path: join(dirname(secrets), "other"), content: "x" }, undefined],
		["write", { path: "README.md", content: "x" }, undefined],
	];
	for (const [toolName, input, expected] of calls) {
		const reason = worktreeRefusal(place, toolName, input);
		assert.equal(/writes into (.+?) \(/.exec(reason ?? "")?.[1], expected, `${toolName} ${JSON.stringify(input)}: ${reason}`);
	}
	// `~/.config/git/` is guarded always, `$XDG_CONFIG_HOME/git/` once more only when it is set and elsewhere.
	const homeGit = `gitxdg ${join(linked, ".config", "git")}`;
	for (const [value, expected] of [[xdg, [homeGit, `gitxdg ${join(xdg, "git")}`]], ["", [homeGit]], [join(linked, ".config"), [homeGit]], [undefined, [homeGit]]] as const) {
		value === undefined ? delete process.env.XDG_CONFIG_HOME : (process.env.XDG_CONFIG_HOME = value);
		assert.deepEqual(guardedPlaces().split("\n").filter((line) => line.startsWith("gitxdg ")), expected, `XDG_CONFIG_HOME=${value}`);
	}
	// A record written before `guarded` was, or a line a human broke (a relative path, taken from no folder; a key that is
	// none, as an Object property is not), names no such place.
	const ssh = { command: "echo key >> ~/.ssh/authorized_keys" };
	writeFileSync(join(record, "guarded"), `ssh .ssh\nconstructor ${join(user, ".ssh")}\n`);
	assert.equal(worktreeRefusal(jobPlace(record), "bash", ssh), undefined);
	assert.equal(worktreeRefusal(jobPlace(record), "write", { path: join(process.cwd(), ".ssh", "x"), content: "x" }), undefined);
	rmSync(join(record, "guarded"));
	assert.equal(worktreeRefusal(jobPlace(record), "bash", ssh), undefined);
});

test("a job of Arthur's own repository still builds a plugin in its worktree, running arthur plugin new from the checkout", async () => {
	// As in docs/setup.md: the clone is the project, Arthur's install and the config's folder, with the env file in it.
	const arthur = repository("arthur");
	const [home, secrets, agent] = [join(arthur, ".arthur"), join(arthur, "env"), join(temporaryFolder(), "omp")];
	writeFileSync(agent, "#!/bin/sh\n", { mode: 0o755 });
	const runner = jobRunner(home, arthur, secrets, { timeoutMinutes: 5, budgetUsd: 1, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, clock("UTC", undefined), eventBus(home), () => []);
	const own = await runner.spawn({ task: "own" });
	await until("the job ended", () => (readEvents(home, 1).some((event) => event.name === "job-ended") ? true : undefined));
	const record = join(home, "jobs", own.id);
	writeFileSync(join(record, "guarded"), readFileSync(join(record, "guarded"), "utf8").replace(/^install .*$/m, `install ${arthur}`));
	const place = jobPlace(record);
	const calls: ReadonlyArray<readonly [string, Record<string, unknown>, string | undefined]> = [
		["bash", { command: `cd ${arthur} && arthur plugin new acme --budget 100 --root ${own.worktree}` }, undefined],
		["write", { path: "packages/acme/src/acme.ts", content: "x" }, undefined],
		["edit", { input: "[packages/acme/package.json#1A2B]\nPUT 1.=1:\n+x" }, undefined],
		["bash", { command: "npm ci && npm test && git add -A && git commit -m 'feat(AR0001): the acme plugin'" }, undefined],
		["write", { path: join(arthur, "arthur.config.ts"), content: "x" }, "the main checkout"],
		["bash", { command: `rm -r ${join(arthur, "packages", "acme")}` }, "the main checkout"],
		["bash", { command: `cd ${arthur} && git merge ${own.branch}` }, "the main checkout"],
		["bash", { command: `echo X=1 >> ${secrets}` }, "Arthur's env file"],
	];
	for (const [toolName, input, expected] of calls) {
		const reason = worktreeRefusal(place, toolName, input);
		assert.equal(/writes into (.+?) \(/.exec(reason ?? "")?.[1], expected, `${toolName} ${JSON.stringify(input)}: ${reason}`);
	}
});

test("a project declared while a job runs is refused to it at once; an unreadable list falls back to the record's, said once", async (t) => {
	const [alpha, beta] = [repository("alpha"), repository("beta")];
	const home = join(alpha, ".arthur");
	const agent = join(temporaryFolder(), "omp");
	writeFileSync(agent, "#!/bin/sh\n", { mode: 0o755 });
	const collect = (name: string) => (name === "projects" ? [[{ name: "alpha", prefix: "AL", path: alpha }]] : []);
	const runner = jobRunner(home, alpha, join(alpha, "env"), { timeoutMinutes: 5, budgetUsd: 1, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, clock("UTC", undefined), eventBus(home), collect);
	const own = await runner.spawn({ task: "own" });
	await until("the job ended", () => (readEvents(home, 1).some((event) => event.name === "job-ended") ? true : undefined));
	const record = join(home, "jobs", own.id);
	t.after(() => delete process.env.ARTHUR_JOB);
	process.env.ARTHUR_JOB = record;
	let handler: ((event: { toolName: string; input: Record<string, unknown> }) => { reason: string } | undefined) | undefined;
	worktreeGuard({ on: (_, registered) => (handler = registered) });
	const write = () => handler?.({ toolName: "write", input: { path: join(beta, "README.md"), content: "x" } })?.reason;
	const said = () => readFileSync(join(record, "log"), "utf8").split("\n").filter((line) => line.includes("worktree guard: the project list is unreadable"));
	assert.equal(write(), undefined, "beta is not declared yet");
	assert.match(said()[0] ?? "", /\(ENOENT: .*projects\/checkouts.*\); guarding the projects this job's record lists$/);
	// The projects plugin rewrites its list as the config loads with beta added.
	mkdirSync(join(home, "projects"));
	writeFileSync(join(home, "projects", "checkouts"), `alpha ${alpha}\nbeta ${beta}\n`);
	assert.match(write() ?? "", /writes into the main checkout of project beta \(/);
	rmSync(join(home, "projects", "checkouts"));
	mkdirSync(join(home, "projects", "checkouts"));
	assert.equal(write(), undefined, "a list that cannot be read: the record's, which names alpha only");
	assert.equal(said().length, 1);
	// A job whose record names beta is guarded from it while the list cannot be read.
	writeFileSync(join(record, "projects"), `alpha ${alpha}\nbeta ${beta}\n`);
	worktreeGuard({ on: (_, registered) => (handler = registered) });
	assert.match(write() ?? "", /writes into the main checkout of project beta \(/);
});

test("the fallback line never creates the record's log, as while a rm -r empties it; another error of it blocks the call", (t) => {
	const alpha = repository("alpha");
	const record = join(temporaryFolder(), "home", "jobs", "2026-10-23-worker-00000000");
	mkdirSync(record, { recursive: true });
	const fields = { worktree: join(alpha, "..", ".arthur-worktrees", "job"), root: alpha, branch: "job" };
	for (const [name, value] of Object.entries(fields)) writeFileSync(join(record, name), value);
	t.after(() => delete process.env.ARTHUR_JOB);
	process.env.ARTHUR_JOB = record;
	let handler: ((event: { toolName: string; input: Record<string, unknown> }) => { reason: string } | undefined) | undefined;
	worktreeGuard({ on: (_, registered) => (handler = registered) });
	assert.match(handler?.({ toolName: "write", input: { path: join(alpha, "README.md"), content: "x" } })?.reason ?? "", /writes into the main checkout \(/);
	assert.equal(existsSync(join(record, "log")), false);
	mkdirSync(join(record, "log"));
	worktreeGuard({ on: (_, registered) => (handler = registered) });
	assert.throws(() => handler?.({ toolName: "write", input: { path: "/tmp/x", content: "x" } }), { code: "EISDIR" });
});

test("outside a job, without ARTHUR_JOB, the extension refuses nothing", () => {
	let registered = false;
	worktreeGuard({ on: () => (registered = true) });
	assert.equal(registered, false);
});
