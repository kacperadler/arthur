import type { Host } from "@arthur/core/plugin";
import type { Project } from "./commit-rules.ts";

// The `commit-msg` hook of a project's `commitRules.regex` (spec/roadmap.md, entry 43): docs/commit-rules.md, "The hook". It goes
// into the job's own worktree only: a hooks folder in the worktree's Git folder, named by `core.hooksPath` in that worktree's
// `config.worktree`, which Git reads once `extensions.worktreeConfig` is on, and which goes with the worktree.

type Prepare = Parameters<Host["jobs"]["prepare"]>[0];

// The client-side hooks Git runs in a worktree, beside `commit-msg`: each forwards to the project's own, so a job keeps them.
const FORWARDED = [
	"applypatch-msg",
	"pre-applypatch",
	"post-applypatch",
	"pre-commit",
	"pre-merge-commit",
	"prepare-commit-msg",
	"post-commit",
	"pre-rebase",
	"post-checkout",
	"post-merge",
	"pre-push",
	"post-rewrite",
	"reference-transaction",
	"pre-auto-gc",
	"post-index-change",
	"sendemail-validate",
];

// Run in the worktree: $1 the worktree, $2 to $4 the scripts, $5 the regex, then the forwarded names. `own` is the hooks folder
// the project uses without Arthur: its `core.hooksPath` as Git reads it there (relative to the worktree, as Git takes it), else `hooks`.
// Once `extensions.worktreeConfig` is on, a `core.bare` or `core.worktree` in the shared config holds for every worktree (a bare
// repository's, as on another machine, would all fail), so each moves first into the main one's `config.worktree`, as Git's own
// `git sparse-checkout init` does (`git help worktree`, CONFIGURATION FILE); the repository itself reads the same value there.
const INSTALL = `set -e
cd "$1"
dir="$(git rev-parse --absolute-git-dir)/arthur-hooks"
common="$(git rev-parse --path-format=absolute --git-common-dir)"
own="$(git config --type=path --get core.hooksPath || true)"
[ -n "$own" ] || own="$common/hooks"
mkdir -p "$dir"
printf '%s\\n' "$own" > "$dir/own"
printf '%s' "$2" > "$dir/check.mjs"
printf '%s' "$3" > "$dir/commit-msg"
printf '%s' "$4" > "$dir/forward"
printf '%s' "$5" > "$dir/rule"
chmod +x "$dir/commit-msg" "$dir/forward"
shift 5
for name in "$@"; do ln -sf forward "$dir/$name"; done
if [ "$(git config --file "$common/config" --type=bool --get core.bare || true)" = true ]; then
	git config --file "$common/config.worktree" core.bare true
	git config --file "$common/config" --unset core.bare
fi
main="$(git config --file "$common/config" --get core.worktree || true)"
if [ -n "$main" ]; then
	git config --file "$common/config.worktree" core.worktree "$main"
	git config --file "$common/config" --unset core.worktree
fi
git config extensions.worktreeConfig true
git config --worktree core.hooksPath "$dir"
`;

// A merge's subject is Git's (`Merge branch ...`), so it is not checked; the project's own `commit-msg` runs after the check.
const COMMIT_MSG = `#!/bin/sh
# Arthur's commit-rules plugin: this job's commit subjects follow the project's commitRules.regex.
here="$(dirname "$0")"
[ -e "$(git rev-parse --git-path MERGE_HEAD)" ] || node "$here/check.mjs" "$1" || exit 1
hook="$(cat "$here/own")/commit-msg"
[ -x "$hook" ] || exit 0
exec "$hook" "$@"
`;

const FORWARD = `#!/bin/sh
# Arthur's commit-rules plugin: the project's own hook of this name, as without Arthur.
hook="$(cat "$(dirname "$0")/own")/$(basename "$0")"
[ -x "$hook" ] || exit 0
exec "$hook" "$@"
`;

// The subject is the message's first line that is neither blank nor a comment, as Git keeps it; the rule is the file beside.
const CHECK = `// Arthur's commit-rules plugin: the subject of a commit in this job's worktree must match the project's commitRules.regex.
import { readFileSync } from "node:fs";
const rule = readFileSync(new URL("rule", import.meta.url), "utf8");
const subject = readFileSync(process.argv[2], "utf8").split("\\n").find((line) => line.trim() !== "" && !line.startsWith("#"))?.trimEnd() ?? "";
if (!new RegExp(rule).test(subject)) {
	console.error(\`commit refused: the subject \${JSON.stringify(subject)} does not match this project's commit rule, the regex \${rule}\`);
	process.exitCode = 1;
}
`;

// The `prepare` of every kind: the hook of the job's project, when its rule is a regex; one that cannot be installed refuses the spawn.
export function hookStep(host: Host, projects: readonly Project[]): Prepare {
	return async (job) => {
		const rule = projects.find((project) => project.name === job.project)?.commitRules;
		if (rule === undefined || !("regex" in rule)) return;
		const ran = await host.jobs.run(job.machine, ["sh", "-c", INSTALL, "commit-rules", job.worktree, CHECK, COMMIT_MSG, FORWARD, rule.regex, ...FORWARDED]);
		if (ran.code === 0) return;
		const last = (ran.stderr.trim() || ran.stdout.trim()).split("\n").at(-1);
		throw new Error(`project ${job.project}: the commit-msg hook was not installed: exit ${ran.code ?? "on a signal"}${last ? `: ${last}` : ""}`);
	};
}
