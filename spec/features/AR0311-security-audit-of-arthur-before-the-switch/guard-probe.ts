import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { envRefusal } from "../../../packages/core/src/env-refusal.ts";
import { worktreeRefusal } from "../../../packages/core/src/worktree-guard.ts";

// AR0311 (security-audit.md, areas 1 and 2): what the env guard and the worktree guard answer for one input of each kind the
// ticket names, in a temporary folder laid out as on the VPS: `<base>/arthur` holding `.arthur/` (the config folder, the
// default home), a project's checkout `<base>/shop`, a job's worktree in `<base>/.arthur-worktrees/`, another job's beside it,
// and a link to the checkout. It runs no command it judges; it prints `refused` or `passes` and the input.
//   node spec/features/AR0311-security-audit-of-arthur-before-the-switch/guard-probe.ts

const base = realpathSync(mkdtempSync(join(tmpdir(), "ar0311-probe-")));
const config = join(base, "arthur");
const [home, root, worktrees] = [join(config, ".arthur"), join(base, "shop"), join(base, ".arthur-worktrees")];
const [worktree, other, link] = [join(worktrees, "own"), join(worktrees, "other"), join(base, "link")];
for (const folder of [home, root, worktree, other]) mkdirSync(folder, { recursive: true });
symlinkSync(root, link);
const place = { worktree, branch: "arthur/own", home, root, worktrees, others: [] };
const show = (text: string) => text.replaceAll(base, "<base>");

const writes: readonly (readonly [string, string])[] = [
	["plain", `rm -rf ${root}/src`],
	["another job's worktree", `rm -rf ${other}/src`],
	["home folder", `echo x > ${home}/delivery/reviews/x.json`],
	["symlink made before", `rm -rf ${link}/src`],
	["symlink made now", `ln -s ${root} /tmp/r && rm -rf /tmp/r/src`],
	["cd", `cd ${root} && rm -rf src`],
	["cd -", `cd ${root} && cd /tmp && cd - && rm -rf src`],
	["git -C", `git -C ${root} checkout -- .`],
	["git -C config", `git -C ${root} config core.fsmonitor /tmp/monitor`],
	["git config", "git config receive.denyCurrentBranch ignore"],
	["git push to main", "git push . HEAD:main"],
	["GIT_DIR", `GIT_DIR=${root}/.git GIT_WORK_TREE=${root} git checkout -- .`],
	["git clone into", `git clone https://example.invalid/x ${root}/vendor`],
	["env -C", `env -C ${root} rm -rf src`],
	["glob", `rm -rf ${base}/sh*/src`],
	["quoting", `rm -rf "${root}"/s'rc'`],
	["here-doc", `bash <<'EOF'\nrm -rf ${root}/src\nEOF`],
	["eval", `eval "rm -rf ${root}/src"`],
	["eval of a substitution", `eval "$(printf 'rm -rf %s/src' ${root})"`],
	["variable", `d=${root}; rm -rf $d/src`],
	["function", `f() { rm -rf "$1"; }; f ${root}/src`],
	["awk -i inplace", `awk -i inplace 1 ${root}/a`],
	["config folder", `sed -i s/a/b/ ${config}/arthur.config.ts`],
	["Arthur's own code", `echo x > ${config}/packages/core/src/worktree-guard.ts`],
];
console.log("worktree guard (bash):");
for (const [kind, command] of writes) console.log(`  ${worktreeRefusal(place, "bash", { command }) === undefined ? "passes " : "refused"}  ${kind}: ${show(command).replaceAll("\n", "\\n")}`);
for (const path of [join(root, "a.ts"), join(link, "a.ts"), join(config, "arthur.config.ts")]) console.log(`  ${worktreeRefusal(place, "write", { path, content: "x" }) === undefined ? "passes " : "refused"}  write tool: ${show(path)}`);

const reads: readonly (readonly [string, string])[] = [
	["plain", "cat .env"],
	["glob", `cat ${config}/.e*`],
	["bracket glob", `cat ${config}/.[e]nv`],
	["brace list", `cat ${config}/.{env,x}`],
	["git", `git -C ${config} show :.env`],
	["string built at run time", `cat "${config}/.$(printf e)nv"`],
	["recursive grep", `grep -r TOKEN ${config}`],
	["find -name", `find ${config} -maxdepth 1 -name '*nv' -exec cat {} +`],
	["the job's MCP secrets", "cat $ARTHUR_JOB/mcp/.mcp.json"],
	["the environment", "env"],
	["another process's environment", "cat /proc/$PPID/environ"],
];
console.log("env guard (bash):");
for (const [kind, command] of reads) console.log(`  ${envRefusal("bash", { command }, worktree) === undefined ? "passes " : "refused"}  ${kind}: ${show(command)}`);
rmSync(base, { recursive: true, force: true });
