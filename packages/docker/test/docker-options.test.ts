import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { docker } from "../src/docker.ts";
import { checkOptions, checkPiece, table } from "../src/docker-options.ts";

test("arthur config check refuses the options as written in arthur.config.ts, each named under docker", () => {
	const folder = temporaryFolder();
	execFileSync("git", ["init", "--quiet", folder]);
	const plugin = JSON.stringify(fileURLToPath(new URL("../src/docker.ts", import.meta.url)));
	writeFileSync(join(folder, "arthur.config.ts"), `import { docker } from ${plugin};\nexport default { plugins: [{ name: "orchestration", setup() {} }, docker({ leftoverHours: 0, buildCache: "10%", sweep: { at: "24:00" } })] };\n`);
	const env = { PATH: process.env.PATH ?? "", HOME: folder, XDG_CONFIG_HOME: join(folder, ".config"), ARTHUR_JOB: "" };
	const run = spawnSync(process.execPath, [fileURLToPath(import.meta.resolve("@arthur/core/cli")), "config", "check"], { cwd: folder, encoding: "utf8", env });
	assert.notEqual(run.status, 0);
	for (const line of ["docker.buildCache: expected bytes with K", "docker.leftoverHours: expected a number of hours, 1 or more, got 0", 'docker.sweep.at: expected "HH:MM", 00:00 to 23:59, got "24:00"'])
		assert.ok(`${run.stdout}${run.stderr}`.includes(line), `${line}\n${run.stdout}${run.stderr}`);
});

test("the options at their limits pass: leftoverHours 1, buildCache 0 or bytes with K, M, G or T, sweep.at 00:00 and 23:59", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ buildCache: "10G", leftoverHours: 48, sweep: { at: "04:00" } }), []);
	for (const buildCache of [0, "1", "512K", "1.5T", "100M"]) assert.deepEqual(checkOptions({ buildCache }), [], String(buildCache));
	for (const leftoverHours of [1, 1.5, 720]) assert.deepEqual(checkOptions({ leftoverHours }), [], String(leftoverHours));
	for (const at of ["00:00", "23:59"]) assert.deepEqual(checkOptions({ sweep: { at } }), [], at);
});

test("refused at load, naming the option: leftoverHours below 1, a buildCache or sweep.at that does not parse, an unknown option or key", () => {
	for (const leftoverHours of [0.99, 0, -1, "48", Number.NaN, Number.POSITIVE_INFINITY, null])
		assert.deepEqual(checkOptions({ leftoverHours }), [{ path: "leftoverHours", problem: `expected a number of hours, 1 or more, got ${typeof leftoverHours === "string" ? `"${leftoverHours}"` : String(leftoverHours)}` }], String(leftoverHours));
	for (const buildCache of ["10%", "infinity", "0", "10 GB", "-1G", "1P", 10, -1, ""])
		assert.equal(checkOptions({ buildCache })[0]?.problem.startsWith('expected bytes with K, M, G or T ("10G"), or 0 for no cap, got '), true, String(buildCache));
	for (const at of ["24:00", "4:00", "04:60", "04:00:00", 400])
		assert.deepEqual(checkOptions({ sweep: { at } }), [{ path: "sweep.at", problem: `expected "HH:MM", 00:00 to 23:59, got ${typeof at === "string" ? `"${at}"` : at}` }], String(at));
	assert.deepEqual(checkOptions({ sweep: {} }), [{ path: "sweep.at", problem: 'expected "HH:MM", 00:00 to 23:59, got nothing' }], "sweep without at");
	assert.deepEqual(checkOptions({ sweep: "04:00" }), [{ path: "sweep", problem: 'expected { at }, got "04:00"' }]);
	assert.deepEqual(checkOptions({ sweep: { at: "04:00", every: 1 } }), [{ path: "sweep.every", problem: "unknown key; keys: at" }]);
	assert.deepEqual(checkOptions({ cache: "10G" }), [{ path: "cache", problem: "unknown option; options: buildCache, leftoverHours, sweep" }]);
});

test("a project's piece is docker.project(false) and nothing else: true, a word or a service is refused before setup, naming the project", async () => {
	assert.deepEqual(docker.project(false), { docker: false });
	assert.equal(checkPiece(false), undefined);
	for (const value of [true, "off", { service: "app" }, undefined]) assert.match(checkPiece(value) ?? "", /^expected false, the one value it takes/, String(value));
	const fake = fakeHost({ name: "docker" });
	fake.provide("projects", () => [{ name: "shop", path: "/x", prefix: "SH", pieces: { docker: true } }]);
	await assert.rejects(fake.setup(docker()), { message: /shop.*docker\.project\(\.\.\.\): expected false, the one value it takes \(its jobs then get no docker script\), got true/ });
});

test("arthur.config.example.ts gives docker every option of its table, each one it accepts", () => {
	const example = readFileSync(new URL("../../../arthur.config.example.ts", import.meta.url), "utf8");
	const call = /\n\t\tdocker\((\{[\s\S]*?\n\t\t\})\),\n/.exec(example);
	assert.ok(call, "the example calls docker({ ... })");
	const options = Function(`return (${call[1]});`)() as Record<string, unknown>;
	assert.deepEqual(checkOptions(options), []);
	assert.deepEqual(Object.keys(options), Object.keys(table));
});
