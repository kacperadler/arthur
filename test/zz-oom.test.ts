import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const SCRIPT = `a=$(cat /proc/self/oom_score_adj); sleep 1; b=$(cat /proc/self/oom_score_adj); echo 1000 > /proc/self/oom_score_adj; c=$(cat /proc/self/oom_score_adj); echo "$a" > /proc/self/oom_score_adj 2>&1 || echo lower-refused; d=$(cat /proc/self/oom_score_adj); echo "start $a, after 1 s $b, raised $c, restored $d"`;
test("probe of oom_score_adj on this runner", () => {
	const self = readFileSync("/proc/self/oom_score_adj", "utf8").trim();
	const bare = execFileSync("sh", ["-c", SCRIPT + " 2>&1"], { encoding: "utf8" });
	const scoped = execFileSync("systemd-run", ["--user", "--scope", "--quiet", "--", "sh", "-c", SCRIPT + " 2>&1"], { encoding: "utf8" });
	assert.equal(`self ${self}\nbare: ${bare}scoped: ${scoped}`, "");
});
