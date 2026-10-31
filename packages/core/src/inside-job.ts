import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

// A job's systemd scope at a cgroup path's end, its id the first group: `arthur-job-<id>.scope`, `arthur-job-<id>.<ms>.scope` for a continued run (job-scope.ts).
export const JOB_SCOPE = /\/arthur-job-([^/.]+)(?:\.\d+)?\.scope$/;
// The id of the job of Arthur's home `home` this process runs in, undefined outside one (AR0354). Under systemd: the job's scope
// (`JOB_SCOPE`) on the last line of `/proc/self/cgroup`, which no process of the job can change, when `home` holds that job's record;
// a test's own home in a job holds none. A job run bare: the record `ARTHUR_JOB` names (wrapper.ts), which its shell can clear (docs/deploy.md, "Threat model").
const SELF = "/proc/self/cgroup";
export function insideJob(home: string | undefined, cgroup = existsSync(SELF) ? readFileSync(SELF, "utf8") : "", env: Readonly<Record<string, string | undefined>> = process.env): string | undefined {
	const id = JOB_SCOPE.exec(cgroup.trimEnd().split("\n").at(-1) ?? "")?.[1];
	if (id !== undefined && home !== undefined && existsSync(join(home, "jobs", id))) return id;
	return env.ARTHUR_JOB ? basename(env.ARTHUR_JOB) : undefined;
}
