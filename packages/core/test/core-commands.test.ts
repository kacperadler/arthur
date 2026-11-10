import assert from "node:assert/strict";
import { test } from "node:test";
import { coreCommands, type Loaded } from "../src/core-commands.ts";

// AR0665: `arthur ticket` takes the board and the owner's decision from the load: a move to planned asks the load's `owner`.
test("arthur ticket status <id> planned asks the loaded owner, then moves on the loaded board", async (t) => {
	const [asked, moved] = [[] as unknown[], [] as unknown[]];
	const board = { move: (id: string, to: string) => (moved.push([id, to]), { id, status: to }) };
	const loaded = { board, owner: (request: unknown) => (asked.push(request), ""), autopilot: () => "", home: "" } as unknown as Loaded;
	t.mock.method(console, "log", () => {});
	const ticket = coreCommands(undefined, () => loaded).find("ticket");
	assert.equal(await ticket?.run({ args: ["status", "DM0001", "planned", "--decision", "DM-D1"], project: undefined }), 0);
	assert.deepEqual(asked, [{ id: "DM-D1", what: "arthur ticket status DM0001 planned", kind: "plan", ticket: "DM0001", use: "planned DM0001" }]);
	assert.deepEqual(moved, [["DM0001", "planned"]]);
});
