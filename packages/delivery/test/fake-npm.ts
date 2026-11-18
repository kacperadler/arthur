import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// A fake `npm` for the project a test merges (AR0723): the real one costs about 0.2 CPU-s a start, and a merge starts two. It
// is written into `bin`, to go first on the PATH the merge's steps get, and answers what a merge runs as npm does
// (fake-npm.test.ts holds it against the real one): `npm test`, `npm run <script>`, `npm run --silent <script> -- <arguments>`.
// It prints npm's two lines before the script unless --silent, then becomes `sh -c <script>` (exec), so the exit status, a death
// by a signal and what a signal sent to npm does are the script's own. The answer reads the calls it noted, a line each.
export function fakeNpm(bin: string): () => string {
	const log = join(bin, "npm.log");
	const lines = [
		"#!/bin/sh",
		`echo "$*" >> '${log}'`,
		'[ "$1" != run ] || shift',
		"silent=",
		'[ "$1" != --silent ] || { silent=1; shift; }',
		"name=$1",
		"shift",
		'[ "$1" != -- ] || shift',
		`script=$('${process.execPath}' -p 'require("./package.json").scripts[process.argv[1]]' "$name")`,
		`[ -n "$silent" ] || printf '\\n> %s\\n> %s\\n\\n' "$name" "$script"`,
		'[ $# -eq 0 ] || script="$script \\"\\$@\\""',
		'exec sh -c "$script" sh "$@"',
	];
	writeFileSync(join(bin, "npm"), `${lines.join("\n")}\n`, { mode: 0o755 });
	return () => (existsSync(log) ? readFileSync(log, "utf8") : "");
}
