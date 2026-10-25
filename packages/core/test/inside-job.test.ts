import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { insideJob } from "../src/inside-job.ts";
import { temporaryFolder } from "../src/testing.ts";

const ID = "2026-10-23-worker-0a1b2c3d";
const SCOPE = `0::/user.slice/user-1000.slice/user@1000.service/arthur.slice/arthur-jobs.slice/arthur-job-${ID}.scope\n`;
const RECORD = { ARTHUR_JOB: "/home/arthur/.arthur/jobs/2026-10-24-worker-ffff0000" };

// A home folder holding the record of job ID, as a spawn makes it.
function home(): string {
	const folder = temporaryFolder();
	mkdirSync(join(folder, "jobs", ID), { recursive: true });
	return folder;
}

test("the scope on the last line of /proc/self/cgroup names the job when the home holds its record: ARTHUR_JOB cleared, set empty, or naming another job changes nothing", () => {
	for (const env of [{}, { ARTHUR_JOB: "" }, RECORD]) assert.equal(insideJob(home(), SCOPE, env), ID, JSON.stringify(env));
	// cgroup v1 beside v2 (systemd's hybrid mode): the v2 line is the last.
	assert.equal(insideJob(home(), `12:pids:/user.slice\n1:name=systemd:/user.slice/arthur-job-${ID}.scope\n${SCOPE}`, {}), ID);
});

test("without a job's scope, or with one whose record the home does not hold, only ARTHUR_JOB marks a job, by its record's folder name", () => {
	const others = {
		"another unit": "0::/user.slice/user-1000.slice/user@1000.service/app.slice/tmux-spawn-1.scope\n",
		"a job's scope, not on the last line": `${SCOPE}1:name=systemd:/user.slice\n`,
		"the scope's name inside a longer unit": `0::/arthur.slice/arthur-job-${ID}.scope/sub\n`,
		"no cgroup (no /proc)": "",
	};
	for (const [what, cgroup] of Object.entries(others)) {
		assert.equal(insideJob(home(), cgroup, {}), undefined, what);
		assert.equal(insideJob(home(), cgroup, { ARTHUR_JOB: "" }), undefined, what);
		assert.equal(insideJob(home(), cgroup, RECORD), "2026-10-24-worker-ffff0000", what);
		assert.equal(insideJob(home(), cgroup, { ARTHUR_JOB: `${RECORD.ARTHUR_JOB}/` }), "2026-10-24-worker-ffff0000", what);
	}
	for (const at of [temporaryFolder(), undefined]) {
		assert.equal(insideJob(at, SCOPE, {}), undefined, `home ${at}: a test's own home in a job holds no record of it`);
		assert.equal(insideJob(at, SCOPE, RECORD), "2026-10-24-worker-ffff0000", `home ${at}`);
	}
});
