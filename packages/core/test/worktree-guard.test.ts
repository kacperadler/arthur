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
	// A folder named `~+` in the worktree that leads to the main checkout: unquoted, `~+` is where the shell is instead.
	symlinkSync(root, join(own.worktree, "~+"));
	// A folder whose name has a space, leading to the main checkout: what an unquoted fallback `${x:-a b}` reaches when bash does not split it.
	symlinkSync(root, join(own.worktree, "a b"));
	// Folders named `~`, `'..'`, `\.\.` and `"`: a double-quoted fallback names them as written, where bash expands or removes nothing.
	for (const name of ["~", "'..'", "\\.\\.", '"']) mkdirSync(join(own.worktree, name));
	const MAIN = "the main checkout";
	const HOME = "Arthur's home folder";
	const OTHER = "another job's worktree";
	// The whole refusal: its patch saves staged and unstaged changes in a folder of the job's own worktree that ignores itself, never a name in the shared /tmp another job may pick too, nor a file a `git add -A` commits.
	const STASH = "arthur: refused: git stash keeps one stack for every worktree of the repository, so a pop may apply another job's change here; save your staged and unstaged changes in a folder your worktree ignores instead (mkdir -p .arthur-stash && echo '*' > .arthur-stash/.gitignore && git diff --binary HEAD > .arthur-stash/patch, then git apply .arthur-stash/patch)";
	const LINK = "a link to a repository";
	const UNKNOWN = "arthur: refused: the guard cannot tell where this path leads: OLDPWD is unset, where bash reads `~-` and `$OLDPWD` apart, or named by a `local`, or set at an index bash computes, by a list appended or with indexes, as an index or a list before a command, or changed by an operator of `${OLDPWD…}`; or it is built by an operator of `${PWD…}`, `${HOME…}` or `${ARTHUR_JOB…}` the guard does not read, or by a fallback (`${x:-…}`) with a blank or one of `<>;&|()#` unquoted, or with `$'…'` or `$\"…\"` in double quotes; or HOME, ARTHUR_JOB or PWD is set by the call, which the guard reads as the job started; name the folder instead";
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
		["bash", { command: `cd ${main}; cd -; cd -; rm README.md` }, MAIN],
		["bash", { command: `pushd ${main}; pushd; pushd; rm README.md` }, MAIN],
		["bash", { command: `OLDPWD=${main}; cd -; rm README.md` }, MAIN],
		["bash", { command: `OLDPWD=${main} cd - && rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; cd $OLDPWD && rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; cd "\${OLDPWD}" && rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; cd ~- && rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; rm ~-/README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; git -C $OLDPWD commit -m x` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; (cd /var); cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; pushd /tmp; popd; cd -; cd -; rm README.md` }, MAIN],
		["bash", { command: `pushd ${main}; pushd /tmp; (popd); popd; rm README.md` }, MAIN],
		["bash", { command: `export OLDPWD=${main}; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; cd -; unset -v OLDPWD; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; unset OLDPWD; rm $OLDPWD/f` }, UNKNOWN],
		["bash", { command: `cd ${main}; cd /tmp; unset -f OLDPWD; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; unset FOO; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; unset OLDPWD | true; cd -; rm README.md` }, MAIN],
		["bash", { command: `OLDPWD=; OLDPWD+=${main}; cd -; rm README.md` }, MAIN],
		["bash", { command: `OLDPWD=/; OLDPWD+=${root.slice(1)}; cd -; rm README.md` }, MAIN],
		["bash", { command: `declare OLDPWD+=${main}; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; echo x > ~-/README.md` }, MAIN],
		["bash", { command: "cd sub; cd /tmp; ln -s ../../../acme ~-/link" }, MAIN],
		["bash", { command: `X+=1 rm ${main}/README.md` }, MAIN],
		["bash", { command: `OLDPWD=${main} bash -c 'cd -; rm README.md'` }, MAIN],
		["bash", { command: `OLDPWD=${main} eval 'cd -; rm README.md'` }, MAIN],
		["bash", { command: `env OLDPWD=${main} bash -c 'cd - && rm README.md'` }, MAIN],
		["bash", { command: `OLDPWD=${main} bash -c 'cd -; rm README.md' | cat` }, MAIN],
		["bash", { command: `OLDPWD=${main} eval 'cd -; rm README.md' | cat` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; OLDPWD=$OLDPWD/; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; OLDPWD=/var eval true; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; OLDPWD=/var eval 'cd /usr'; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; eval 'cd /tmp'; cd -; rm README.md` }, MAIN],
		["bash", { command: "OLDPWD=$OLDPWD/x; cd -; rm notes.txt" }, UNKNOWN],
		["bash", { command: "cd $OLDPWD && rm README.md" }, UNKNOWN],
		["bash", { command: "rm ~-/README.md" }, UNKNOWN],
		["bash", { command: `cd ${main}; OLDPWD=; echo x > $OLDPWD/f` }, UNKNOWN],
		// AR0420: an operator of `${OLDPWD…}`, a read-only OLDPWD, `local` outside a function, `pushd -n`, the `+=` of an
		// eval's prefix, and OLDPWD's array; what the guard cannot follow is refused as unknown.
		["bash", { command: `cd ${main}; cd /tmp; cd \${OLDPWD:-/tmp} && rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; cd \${OLDPWD%/} && rm README.md` }, UNKNOWN],
		["bash", { command: `readonly OLDPWD=${root}; cd /tmp; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; declare -r OLDPWD; cd /var; cd -; rm README.md` }, MAIN],
		["bash", { command: `readonly OLDPWD=${root}; OLDPWD=/tmp cd -; rm README.md` }, MAIN],
		["bash", { command: `readonly OLDPWD=${root}; cd /tmp; unset OLDPWD; cd -; rm README.md` }, MAIN],
		["bash", { command: `readonly OLDPWD=${root}; OLDPWD=/tmp bash -c 'cd -; rm README.md'` }, MAIN],
		["bash", { command: `readonly OLDPWD=/tmp; cd ${main}; bash -c 'cd /var; cd -; rm README.md'` }, MAIN],
		["bash", { command: `(readonly OLDPWD=/tmp); cd ${main}; cd /var; cd -; rm README.md` }, MAIN],
		["bash", { command: `readonly -f OLDPWD; cd ${main}; cd /tmp; cd -; rm README.md` }, MAIN],
		// A `local` naming OLDPWD makes it unknown wherever it stands (AR-D21), until a `cd` sets it again.
		["bash", { command: `cd ${main}; cd /tmp; local OLDPWD=/tmp; cd -; rm README.md` }, UNKNOWN],
		["bash", { command: `cd ${main}; cd /tmp; local OLDPWD; rm $OLDPWD/README.md` }, UNKNOWN],
		["bash", { command: `cd ${main}; cd /tmp; local OLDPWD=/tmp; pushd -; rm README.md` }, UNKNOWN],
		["bash", { command: `f() { local x=1 OLDPWD=${main}; cd -; rm README.md; }; f` }, UNKNOWN],
		["bash", { command: `cd ${main}; cd /tmp; { local OLDPWD=/tmp; }; cd -; rm README.md` }, UNKNOWN],
		["bash", { command: `f() { :; }; cd ${main}; cd /tmp; local OLDPWD=/tmp; cd -; rm README.md` }, UNKNOWN],
		["bash", { command: `\\}; f() { local OLDPWD=${main}; cd -; rm README.md; }; f` }, UNKNOWN],
		["bash", { command: `"}"; f() { local OLDPWD=${main}; cd -; rm README.md; }; f` }, UNKNOWN],
		["bash", { command: `true || \\}; f() { local OLDPWD=${main}; cd -; rm README.md; }; f` }, UNKNOWN],
		["bash", { command: `f() if true; then local OLDPWD=${main}; cd -; rm README.md; fi; f` }, UNKNOWN],
		["bash", { command: `f() for x in 1; do local OLDPWD=${main}; cd -; rm README.md; done; f` }, UNKNOWN],
		["bash", { command: `f() while true; do local OLDPWD=${main}; cd -; rm README.md; break; done; f` }, UNKNOWN],
		["bash", { command: `f() until false; do local OLDPWD=${main}; cd -; rm README.md; break; done; f` }, UNKNOWN],
		["bash", { command: `f() case x in x) local OLDPWD=${main}; cd -; rm README.md;; esac; f` }, UNKNOWN],
		["bash", { command: `local OLDPWD=/tmp; cd ${main}; cd /tmp; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; local OLDPWDX=1; cd -; rm README.md` }, MAIN],
		["bash", { command: `readonly FOO=1; cd ${main}; cd /tmp; cd -; rm README.md` }, MAIN],
		["bash", { command: `readonly OLDPWDX; cd ${main}; cd /tmp; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd /tmp; readonly OLDPWD | true; cd ${root}; cd /var; cd -; rm README.md` }, MAIN],
		["bash", { command: `f() { local OLDPWD=${main}; cd -; rm README.md; }; f` }, UNKNOWN],
		["bash", { command: `f() ( local OLDPWD=${main}; cd -; rm README.md ); f` }, UNKNOWN],
		["bash", { command: `cd /tmp; cd \${OLDPWD:+${root}} && rm README.md` }, MAIN],
		["bash", { command: `pushd ${main}; pushd -n; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; pushd -n /tmp; rm README.md` }, MAIN],
		["bash", { command: `pushd -n ${main}; popd; rm README.md` }, MAIN],
		["bash", { command: `cd /tmp; pushd ${root}; popd -n; rm README.md` }, MAIN],
		["bash", { command: `cd /tmp; pushd ${root}; popd -n; popd; rm README.md` }, MAIN],
		["bash", { command: `cd ${root}; pushd /tmp; pushd -n; popd; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; OLDPWD+=/ eval 'cd /var'; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd /tmp; cd /var; OLDPWD[0]=${root}; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd /tmp; OLDPWD=(${root}); cd -; rm README.md` }, MAIN],
		["bash", { command: `cd /tmp; declare OLDPWD[0]=${root}; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; cd /tmp; OLDPWD[1]=/var; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd /tmp; cd ${root}; unset OLDPWD[0]; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd ${main}; OLDPWD='(/tmp'; cd -; rm README.md` }, MAIN],
		["bash", { command: `cd /tmp; OLDPWD[i]=${root}; cd -; rm README.md` }, UNKNOWN],
		["bash", { command: `OLDPWD+=(${root}); cd -; rm README.md` }, UNKNOWN],
		["bash", { command: `OLDPWD=([0]=${root}); cd -; rm README.md` }, UNKNOWN],
		["bash", { command: `cd ${main}; cd /tmp; OLDPWD[0]=/var cd -; rm README.md` }, UNKNOWN],
		["bash", { command: `cd ${main}; OLDPWD=(/tmp) cd -; rm README.md` }, UNKNOWN],
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
		// AR0429: `$ARTHUR_JOB`, the folder of `env -C` and `sudo -D`, a `~` after an assignment's `=`, `$PWD` and `~+`, as bash reads them.
		["bash", { command: "echo x > $ARTHUR_JOB/result" }, HOME],
		["bash", { command: `echo x > "$ARTHUR_JOB"/../${other.id}/result` }, HOME],
		["bash", { command: "echo x > ${ARTHUR_JOB}/result" }, HOME],
		["bash", { command: "echo $ARTHUR_JOB" }, undefined],
		["bash", { command: `env -C ${main} git checkout -- .` }, MAIN],
		["bash", { command: `env --chdir=${main} rm README.md` }, MAIN],
		["bash", { command: `sudo -D ${main} rm README.md` }, MAIN],
		["bash", { command: `env --chdir ${main} rm README.md` }, MAIN],
		["bash", { command: `sudo --chdir ${main} rm README.md` }, MAIN],
		["bash", { command: `sudo --chdir=${main} rm README.md` }, MAIN],
		["bash", { command: `env -C${main} rm README.md` }, MAIN],
		["bash", { command: `env -C ${main} bash -c 'rm README.md'` }, MAIN],
		["bash", { command: "env -C sub rm ../README.md", cwd: main }, MAIN],
		["bash", { command: "env -C /tmp true > README.md", cwd: main }, MAIN],
		["bash", { command: `env -C ${main} true > x` }, undefined],
		["bash", { command: `env -iC ${main} rm README.md` }, MAIN],
		["bash", { command: `sudo -nD ${main} rm README.md` }, MAIN],
		["bash", { command: `env --c=${main} rm README.md` }, MAIN],
		["bash", { command: `env --chd ${main} rm README.md` }, MAIN],
		["bash", { command: `sudo --chd ${main} rm README.md` }, MAIN],
		["bash", { command: `sudo -nu root rm ${main}/README.md` }, MAIN],
		["bash", { command: `env --ignore-environment rm ${main}/README.md` }, MAIN],
		["bash", { command: `sudo --preserve-env rm ${main}/README.md` }, MAIN],
		// AR0473: a long option of sudo or env that takes a value, given whole or by a prefix only it starts with, and the short ones, skip the word after them.
		...["--user", "--us", "--auth-type", "--close-from", "--login-class", "--group", "--host", "--prompt", "--chroot", "--role", "--type", "--other-user", "--command-timeout", "-a", "-c", "-r", "-t"].map((option) => ["bash", { command: `sudo ${option} root rm ${main}/README.md` }, MAIN] as const),
		...["--unset", "--u", "--argv0", "--env0-from", "--e", "--quoting-style", "--q", "-a"].map((option) => ["bash", { command: `env ${option} X rm ${main}/README.md` }, MAIN] as const),
		["bash", { command: `sudo --login rm ${main}/README.md` }, MAIN],
		["bash", { command: `sudo --user=root rm ${main}/README.md` }, MAIN],
		["bash", { command: `env --unset=X --ignore-environment rm ${main}/README.md` }, MAIN],
		["bash", { command: `cd ${main}; env -C /tmp rm $PWD/README.md` }, MAIN],
		["bash", { command: "GIT_WORK_TREE=~/acme git checkout -- ." }, MAIN],
		["bash", { command: "GIT_INDEX_FILE=~/acme/.git/index git add ." }, MAIN],
		["bash", { command: "env GIT_INDEX_FILE=~/acme/.git/index git add ." }, MAIN],
		["bash", { command: "cd $PWD; rm README.md", cwd: main }, MAIN],
		["bash", { command: 'cd "$PWD"; rm README.md', cwd: main }, MAIN],
		["bash", { command: "cd ${PWD}; rm README.md", cwd: main }, MAIN],
		["bash", { command: "cd ~+; rm README.md", cwd: main }, MAIN],
		["bash", { command: `cd ${main}; git -C /tmp --work-tree=$PWD checkout -- .` }, MAIN],
		["bash", { command: "rm '~+/README.md'" }, MAIN],
		["bash", { command: "cd ~+; rm README.md && rm ~+/README.md" }, undefined],
		["bash", { command: `cd ${main}; bash -c "cd $PWD; cd /tmp; rm $PWD/README.md"` }, MAIN],
		["bash", { command: `cd ${main}; env -C /tmp bash -c "rm \${PWD}/README.md"` }, MAIN],
		["bash", { command: `cd ${main}; bash -c 'cd /tmp; rm $PWD/README.md'` }, undefined],
		["bash", { command: `cd ${main}; git -C /tmp --work-tree=~+ checkout -- . && echo $constructor $toString` }, undefined],
		// The known variables inside `bash -c` and `eval`, and `$PWD` in a here-string or an unquoted heredoc, which the outer shell expands.
		["bash", { command: "bash -c 'echo x > $ARTHUR_JOB/result'" }, HOME],
		["bash", { command: "eval 'echo x > $ARTHUR_JOB/result'" }, HOME],
		["bash", { command: "bash -c 'rm $HOME/acme/README.md'" }, MAIN],
		["bash", { command: "eval 'rm ${HOME}/acme/README.md'" }, MAIN],
		["bash", { command: `cd ${main}; bash <<EOF\ncd /tmp; rm $PWD/README.md\nEOF` }, MAIN],
		["bash", { command: `cd ${main}; bash <<< "cd /tmp; rm \${PWD}/README.md"` }, MAIN],
		["bash", { command: `cd ${main}; env -C /tmp bash <<EOF\nrm $PWD/README.md\nEOF` }, MAIN],
		["bash", { command: `cd ${main}; bash <<EOF\ncd /tmp; rm \${PWD}/README.md\nEOF` }, MAIN],
		["bash", { command: `cd ${main}; bash <<'EOF'\ncd /tmp; rm $PWD/README.md\nEOF\nbash <<EOF\ncd /tmp; rm \\$PWD/README.md\nEOF` }, undefined],
		["bash", { command: `cd ${main}; bash <<< 'cd /tmp; rm $PWD/README.md' && bash <<< "cd /tmp; rm ~+/README.md"` }, undefined],
		// AR0472: an unquoted heredoc drops the backslash before `$`, `` ` `` and `\` and expands `$HOME` and `$ARTHUR_JOB` itself,
		// so the inner shell expands what it escaped and reads their value where it would not expand them.
		["bash", { command: "bash <<EOF\necho x > \\$ARTHUR_JOB/result\nEOF" }, HOME],
		["bash", { command: "bash <<EOF\nrm \\$HOME/acme/README.md\nEOF" }, MAIN],
		["bash", { command: `bash <<EOF\nrm \\$x${main}/README.md\nEOF` }, MAIN],
		["bash", { command: `cd ${main}; bash <<EOF\ncd /tmp; rm \\$OLDPWD/README.md\nEOF` }, MAIN],
		["bash", { command: `bash <<EOF\necho \\\`rm ${main}/README.md\\\`\nEOF` }, MAIN],
		["bash", { command: "bash <<EOF\nrm \\\\$HOME/acme/README.md\nEOF" }, MAIN],
		["bash", { command: "bash <<EOF\necho x > '${ARTHUR_JOB}'/result\nEOF" }, HOME],
		["bash", { command: "bash <<EOF\nrm \\\n$HOME/acme/README.md\nEOF" }, MAIN],
		["bash", { command: `bash <<EOF\necho x > \$toString${main}/README.md\nEOF` }, MAIN],
		["bash", { command: "bash <<'EOF'\necho x > \\$ARTHUR_JOB/result\nEOF\nbash <<EOF\necho x > \\\\\\$ARTHUR_JOB/result\nEOF" }, undefined],
		// AR0496: a call that sets HOME, ARTHUR_JOB or PWD, before a command, alone or by a declaration, is refused as unknown; the guard read every word with the values the job started with.
		["bash", { command: `HOME=${main} bash <<EOF\nrm \\$HOME/README.md\nEOF` }, UNKNOWN],
		["bash", { command: `HOME=${main} bash -c 'rm $HOME/README.md'` }, UNKNOWN],
		["bash", { command: `env HOME=${main} sh -c 'cd && rm README.md'` }, UNKNOWN],
		["bash", { command: `HOME=${main} cd && rm README.md` }, UNKNOWN],
		["bash", { command: `HOME=${main} find . -maxdepth 0 -exec sh -c 'rm $HOME/README.md' \\;` }, UNKNOWN],
		["bash", { command: `HOME=${main}; rm ~/README.md` }, UNKNOWN],
		["bash", { command: `export HOME=${main}; bash -c 'rm $HOME/README.md'` }, UNKNOWN],
		["bash", { command: `f() { local PWD=${main}; rm $PWD/README.md; }; f` }, UNKNOWN],
		["bash", { command: `PWD=${main}; rm $PWD/README.md` }, UNKNOWN],
		["bash", { command: `ARTHUR_JOB=${main} eval 'rm $ARTHUR_JOB/README.md'` }, UNKNOWN],
		["bash", { command: `bash -c 'HOME+=/acme; rm $HOME/README.md'` }, UNKNOWN],
		["bash", { command: `echo HOME=${main} PWD=${main} > notes.txt; HOMEX=${main} PWDX=1 bash -c 'rm $HOME/README.md'` }, undefined],
		// AR0471: an operator of `${PWD…}` or of a known variable the parser does not read is refused, as one of `${OLDPWD…}` is.
		["bash", { command: `echo x > \${ARTHUR_JOB%/*}/${other.id}/result` }, UNKNOWN],
		["bash", { command: `echo x > \${x:-\${ARTHUR_JOB%/*}}/${other.id}/result` }, UNKNOWN],
		["bash", { command: `echo x > "\${ARTHUR_JOB:+\${ARTHUR_JOB%/*}}"/${other.id}/result` }, UNKNOWN],
		["bash", { command: "echo x > ${x:-$ARTHUR_JOB}/result" }, HOME],
		// An unquoted fallback with an unquoted blank or one of `<>;&|()#` is refused wherever it stands; in double quotes those are text in one word.
		["bash", { command: "rm ${x:-> ../../acme/README.md}" }, UNKNOWN],
		["bash", { command: "rm ${x:-a 2> ../../acme/README.md}" }, UNKNOWN],
		["bash", { command: "rm ${x:-< ../../acme/README.md}" }, UNKNOWN],
		["bash", { command: "rm ${x:-# ../../acme/README.md}" }, UNKNOWN],
		["bash", { command: "rm y=${x:-a ../../acme/README.md}" }, UNKNOWN],
		["bash", { command: "bash <<< ${x:-rm ../../acme/README.md}" }, UNKNOWN],
		["bash", { command: "OLDPWD=${x:-a b} cd -; rm README.md" }, UNKNOWN],
		["bash", { command: "export OLDPWD=${x:-a b}; cd -; rm README.md" }, UNKNOWN],
		["bash", { command: "IFS=; rm ${x:-a b}/README.md" }, UNKNOWN],
		["bash", { command: "IFS=x; rm ${x:-a b}/README.md" }, UNKNOWN],
		["bash", { command: "time OLDPWD=${x:-a b} cd -; rm README.md" }, UNKNOWN],
		["bash", { command: "! OLDPWD=${x:-a b} cd -; rm README.md" }, UNKNOWN],
		["bash", { command: "rm ${HOME+a b}/README.md" }, UNKNOWN],
		...[..." \t\n<>;&|()#"].map((char) => ["bash", { command: `rm \${x:-a${char}b}/README.md` }, UNKNOWN] as const),
		["bash", { command: `echo \${x:-"a b"} \${x:-'a;b'} \${x:-a\\ b} \${HOME:-a b} \${PWD-a;b}` }, undefined],
		["bash", { command: 'rm "${x:-a ../../acme/README.md}"' }, undefined],
		...[..."<>;&|()#"].map((char) => ["bash", { command: `rm "\${x:-${char}}../../../../acme/README.md"` }, MAIN] as const),
		["bash", { command: 'rm "${x:-~}"/../../../acme/README.md' }, MAIN],
		["bash", { command: 'rm "${x:-~/../../../acme/README.md}"' }, MAIN],
		["bash", { command: 'rm "${x:-"~/"}../../../acme/README.md"' }, MAIN],
		["bash", { command: 'rm "${x:-\\"/../../../acme/README.md}"' }, MAIN],
		["bash", { command: `rm "\${x:-\\"$HOME${"/..".repeat(dirname(root).split("/").length)}/../../acme/README.md}"` }, MAIN],
		["bash", { command: 'rm "${x:-~+}/README.md"' }, MAIN],
		["bash", { command: `rm "\${x:-'..'}/../../../acme/README.md"` }, MAIN],
		["bash", { command: 'rm "${x:-\\.\\.}/../../../acme/README.md"' }, MAIN],
		["bash", { command: `rm "\${x:-$'..'}/../acme/README.md"` }, UNKNOWN],
		["bash", { command: 'rm "${x:-$".."}/../acme/README.md"' }, UNKNOWN],
		["bash", { command: `echo "\${x:-\\$'a'}"` }, undefined],
		["bash", { command: "rm ${x:-~}/acme/README.md" }, MAIN],
		["bash", { command: "rm ${x:-~+}/README.md ${x:-~root}/README.md" }, undefined],
		["bash", { command: `cd ${main}; bash <<EOF\ncd /tmp; echo x > \${PWD:+x}; rm \${PWD:+$PWD}/README.md\nEOF` }, MAIN],
		["bash", { command: 'rm "${HOME/x/x}/acme/README.md"' }, UNKNOWN],
		["bash", { command: "rm /${HOME#/}/acme/README.md" }, UNKNOWN],
		["bash", { command: "cd ${PWD%/x}; rm README.md", cwd: main }, UNKNOWN],
		["bash", { command: "rm ${!PWD}/README.md", cwd: main }, UNKNOWN],
		["bash", { command: "echo x > ${#HOME}" }, UNKNOWN],
		["bash", { command: `cd ${main}; bash <<EOF\ncd /tmp; rm \${PWD%/x}/README.md\nEOF` }, UNKNOWN],
		["bash", { command: `cd ${main}; bash <<EOF\ncd /tmp; rm \${PWD:-x}/README.md\nEOF` }, MAIN],
		["bash", { command: `cd ${main}; bash <<EOF\ncd /tmp; rm \${PWD:-\${x}}/README.md\nEOF` }, UNKNOWN],
		["bash", { command: "echo ${HOME+x} ${PWD:+x} ${HOME:-x} ${PWDX%/x}" }, undefined],
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
		// A rewrite of the repository every worktree shares, wherever it runs: its objects, reflogs or worktree list.
		["bash", { command: "git gc --prune=now" }, MAIN],
		["bash", { command: `git -C ${main} gc` }, MAIN],
		["bash", { command: "cd /tmp && git gc" }, MAIN],
		["bash", { command: "git prune" }, MAIN],
		["bash", { command: "git repack -ad" }, MAIN],
		["bash", { command: "git maintenance run" }, MAIN],
		["bash", { command: "git maintenance start" }, MAIN],
		["bash", { command: "git filter-repo --force" }, MAIN],
		["bash", { command: "git reflog expire --expire=now --all" }, MAIN],
		["bash", { command: "git reflog delete HEAD@{1}" }, MAIN],
		["bash", { command: "git reflog drop main" }, MAIN],
		["bash", { command: "git -c alias.tidy=gc tidy" }, MAIN],
		["bash", { command: "git worktree prune" }, MAIN],
		["bash", { command: `git -C ${main} worktree prune` }, MAIN],
		["bash", { command: "git worktree add /tmp/arthur-worktree-guard-test -b h/x" }, MAIN],
		["bash", { command: "git worktree add -b h/x -- /tmp/arthur-worktree-guard-test" }, MAIN],
		["bash", { command: "git worktree add --detach ../../outside" }, MAIN],
		["bash", { command: "cd /tmp && git worktree add wt" }, MAIN],
		["bash", { command: "git worktree add out/wt" }, MAIN],
		["bash", { command: "git worktree move wt /tmp/arthur-worktree-guard-test" }, MAIN],
		["bash", { command: "git -C /tmp worktree add x" }, MAIN],
		["bash", { command: `cd /tmp && git --git-dir=${own.worktree}/.git worktree add --detach -- -x` }, MAIN],
		["bash", { command: `cd /tmp && GIT_DIR=${own.worktree}/.git git worktree add --detach -- -x` }, MAIN],
		["bash", { command: `git -C /tmp --git-dir=${own.worktree}/.git worktree add --detach -- -x` }, MAIN],
		["bash", { command: `cd /tmp && git --git-dir=${own.worktree}/.git worktree move ${own.worktree}/wt -- -y` }, MAIN],
		["bash", { command: `cd /tmp && git --git-dir=${own.worktree}/.git worktree add --detach --end-of-options -x` }, MAIN],
		["bash", { command: `cd /tmp && git --git-dir=${own.worktree}/.git worktree move ${own.worktree}/wt --end-of-options -y` }, MAIN],
		// Config that tunes the gc Git runs by itself after a commit, merge or fetch, given with the call or written for later ones.
		["bash", { command: "git -c gc.auto=1 -c gc.pruneExpire=now -c gc.reflogExpireUnreachable=now commit --allow-empty -m c" }, MAIN],
		["bash", { command: "git --config-env=GC.pruneExpire=NOW fetch" }, MAIN],
		["bash", { command: "git -c maintenance.auto=true merge topic" }, MAIN],
		["bash", { command: "git -c alias.c='-c gc.pruneExpire=now commit' c -m x" }, MAIN],
		["bash", { command: "git config --worktree gc.pruneExpire now" }, MAIN],
		["bash", { command: "git config set --worktree maintenance.strategy incremental" }, MAIN],
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
		["bash", { command: `cd -; pushd; popd; rm notes.txt` }, undefined],
		["bash", { command: `OLDPWD=${main} true; cd -; rm notes.txt` }, undefined],
		["bash", { command: `OLDPWD=${main} bash -c true; cd -; rm notes.txt` }, undefined],
		["bash", { command: `OLDPWD=${main} | true; cd -; rm notes.txt` }, undefined],
		["bash", { command: `(OLDPWD=${main}); cd -; rm notes.txt` }, undefined],
		["bash", { command: `pushd ${main}; pushd /tmp; pushd; pushd; popd; popd; rm notes.txt` }, undefined],
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
		["bash", { command: "git worktree add wt -b topic && git worktree add --lock --reason=x sub/wt && git worktree move wt sub/moved && git worktree remove --force sub/moved" }, undefined],
		["bash", { command: "git worktree add --detach -- -x" }, undefined],
		["bash", { command: `git -C /tmp --git-dir=${own.worktree}/.git worktree add --detach ${own.worktree}/wt2` }, undefined],
		["bash", { command: `git reflog && git reflog show && git reflog -n 3 HEAD && git reflog exists HEAD && git worktree list && git -C ${main} worktree list` }, undefined],
		["bash", { command: "git config --get gc.auto; git config --worktree --get gc.pruneExpire; git -c user.name=x commit -m 'gc.auto'" }, undefined],
		["bash", { command: "git remote add -f fork /tmp/fork.git && echo x > .gitignore && git checkout -- -B" }, undefined],
		["bash", { command: `git replace && git replace -l && git replace --list 'v*' && git replace --li --format=medium && git -C ${main} replace -l` }, undefined],
		["bash", { command: `echo 'rm ${main}/README.md' > notes.txt` }, undefined],
		["bash", { command: `git commit -m "cd ${main} && rm README.md"` }, undefined],
		["bash", { command: `cat > notes.md <<'EOF'\nrm -rf ${main}\necho x > ${main}/f\nEOF\nrm notes.md` }, undefined],
		["bash", { command: `echo hi # > ${main}/f` }, undefined],
		["bash", { command: "mkdir -p .arthur-stash && echo '*' > .arthur-stash/.gitignore && git diff --binary HEAD > .arthur-stash/patch && git reset --hard && git apply .arthur-stash/patch" }, undefined],
		["bash", { command: "echo x > /tmp/arthur-worktree-guard-test && rm /tmp/arthur-worktree-guard-test" }, undefined],
		["write", { path: "notes.txt", content: "x" }, undefined],
		["write", { path: "local://plan.md", content: "x" }, undefined],
		["edit", { input: "[notes.txt#1A2B]\nPUT 1.=1:\n+x" }, undefined],
		["read", { path: `${main}/README.md` }, undefined],
		["grep", { pattern: "acme", path: main }, undefined],
	];
	// `~` and `$HOME` are the user's home; here the folder that holds the main checkout. OLDPWD starts unset, as in a job's shell;
	// `ARTHUR_JOB` names the job's record, as the wrapper sets it.
	const saved = { HOME: process.env.HOME, OLDPWD: process.env.OLDPWD, ARTHUR_JOB: process.env.ARTHUR_JOB };
	process.env.HOME = dirname(root);
	process.env.ARTHUR_JOB = join(home, "jobs", own.id);
	delete process.env.OLDPWD;
	try {
		for (const [toolName, input, expected] of calls) {
			const reason = worktreeRefusal(place, toolName, input);
			const named = reason === undefined ? undefined : reason === STASH || reason === UNKNOWN ? reason : reason.includes("which Git reads as a link to a repository") ? LINK : (/writes into (.+?) \(/.exec(reason)?.[1] ?? reason);
			assert.equal(named, expected, `${toolName} ${JSON.stringify(input)}: ${reason}`);
		}
		// An OLDPWD the agent's env gives is where `cd -` goes first.
		process.env.OLDPWD = root;
		assert.ok(worktreeRefusal(place, "bash", { command: "cd - && rm README.md" })?.includes("into the main checkout"));
		// Without `ARTHUR_JOB` in the agent's env, `$ARTHUR_JOB` is nothing and `${ARTHUR_JOB:-word}` the word, as in bash.
		delete process.env.ARTHUR_JOB;
		assert.equal(worktreeRefusal(place, "bash", { command: "echo x > $ARTHUR_JOB/result" }), undefined);
		assert.ok(worktreeRefusal(place, "bash", { command: `echo x > \${ARTHUR_JOB:-${root}}/README.md` })?.includes("into the main checkout"));
	} finally {
		for (const [name, value] of Object.entries(saved)) value === undefined ? delete process.env[name] : (process.env[name] = value);
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

test("a git write through an alias given by -c, or GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE or GIT_OBJECT_DIRECTORY set before git, is refused; config the guard does not read, or an alias or include written, refuses the call", async () => {
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
		[`GIT_INDEX_FILE=${main}/.git/index git add .`, MAIN, `${main}/.git/index`],
		[`env -u X GIT_OBJECT_DIRECTORY=${main}/.git/objects git commit -m x`, MAIN, `${main}/.git/objects`],
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
		"GIT_AUTHOR_NAME=x git commit -m y",
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
		["bash", { command: `cd ${z}; cd /tmp; git --git-dir=~-/.git --work-tree=~- commit -m x` }, MAIN],
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
	// Git reads the user's config from `$XDG_CONFIG_HOME/git/` when it is set, and `~/.config/git/` when it is not; systemd's
	// user manager its units from `$XDG_CONFIG_HOME/systemd/user` or `~/.config/systemd/user` alike.
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
		["write", { path: join(xdg, "systemd", "user", "arthur.service"), content: "x" }, "the user's systemd folder"],
		["bash", { command: `cp unit.service ${join(xdg, "systemd", "user")}/` }, "the user's systemd folder"],
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
	// `~/.config/git/` and `~/.config/systemd` are guarded always, `$XDG_CONFIG_HOME/git/` and `$XDG_CONFIG_HOME/systemd` once
	// more only when it is set and elsewhere.
	const homeLines = [`systemd ${join(linked, ".config", "systemd")}`, `gitxdg ${join(linked, ".config", "git")}`];
	for (const [value, expected] of [[xdg, [...homeLines, `systemd ${join(xdg, "systemd")}`, `gitxdg ${join(xdg, "git")}`]], ["", homeLines], [join(linked, ".config"), homeLines], [join(linked, ".config") + "/", homeLines], [undefined, homeLines]] as const) {
		value === undefined ? delete process.env.XDG_CONFIG_HOME : (process.env.XDG_CONFIG_HOME = value);
		assert.deepEqual(guardedPlaces().split("\n").filter((line) => /^(?:systemd|gitxdg) /.test(line)), expected, `XDG_CONFIG_HOME=${value}`);
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
		["bash", { command: `cd ${arthur} && node_modules/.bin/arthur plugin new acme --budget 100 --root ${own.worktree}` }, undefined],
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
