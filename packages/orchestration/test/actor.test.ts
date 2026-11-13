import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";

// AR0528: who acts in the coordinator's session, as the core's stamp asks it of `actor` at each event.
test("actor answers coordinator only in its session's process, on the event numbers of the turn in progress", async (t) => {
	const fake = fakeHost({ name: "orchestration" });
	await fake.setup(orchestration());
	t.after(() => delete process.env.ARTHUR_ORCHESTRATION_FOLDER);
	assert.deepEqual(fake.collect("actor"), [undefined], "outside the coordinator's session");
	process.env.ARTHUR_ORCHESTRATION_FOLDER = temporaryFolder();
	assert.deepEqual(fake.collect("actor"), [undefined], "another orchestration's session");
	process.env.ARTHUR_ORCHESTRATION_FOLDER = fake.host.folder;
	assert.deepEqual(fake.collect("actor"), [{ actor: "coordinator", on: [] }], "no turn in progress");
	const turn = join(fake.host.folder, "inbox", "turn");
	mkdirSync(turn, { recursive: true });
	for (const name of ["12-1762425600000", "3-1762425500000", ".draft-1-4-1762425600000", "x-1", "5"]) writeFileSync(join(turn, name), "{}");
	assert.deepEqual(fake.collect("actor"), [{ actor: "coordinator", on: [3, 12] }], "a message's file alone counts, in number order");
});

// AR0705: a project agent's session is `agent:<project>`, on its own turn's messages.
test("actor answers agent:<project> in a project agent's session, on its own turn's event numbers", async (t) => {
	const fake = fakeHost({ name: "orchestration" });
	fake.provide("projects", () => [{ name: "shop", path: temporaryFolder(), prefix: "SH", pieces: { orchestration: { chat: { plugin: "telegram", place: "4" } } } }]);
	await fake.setup(orchestration());
	t.after(() => delete process.env.ARTHUR_ORCHESTRATION_FOLDER);
	const folder = join(fake.host.folder, "agents", "shop");
	mkdirSync(join(folder, "inbox", "turn"), { recursive: true });
	writeFileSync(join(folder, "inbox", "turn", "8-1762425600000"), "{}");
	mkdirSync(join(fake.host.folder, "inbox", "turn"), { recursive: true });
	writeFileSync(join(fake.host.folder, "inbox", "turn", "3-1762425500000"), "{}");
	process.env.ARTHUR_ORCHESTRATION_FOLDER = folder;
	assert.deepEqual(fake.collect("actor"), [{ actor: "agent:shop", on: [8] }]);
	process.env.ARTHUR_ORCHESTRATION_FOLDER = fake.host.folder;
	assert.deepEqual(fake.collect("actor"), [{ actor: "coordinator", on: [3] }]);
	process.env.ARTHUR_ORCHESTRATION_FOLDER = join(fake.host.folder, "agents", "blog");
	assert.deepEqual(fake.collect("actor"), [undefined], "no agent of that name");
});
