import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import type { Board } from "../src/board.ts";
import type { OwnerRequest } from "../src/host.ts";
import type { JobRunner } from "../src/jobs.ts";
import { ticketCommand } from "../src/ticket-command.ts";

// AR0665: `arthur ticket status` without the CLI's load, so each refusal and pass is quick to hold: a board that notes each
// move, after and filing; `decision.owner` passing DM-D1 alone and noting each request; console lines and the exit code.

function load(t: TestContext) {
	const [moved, asked, out, err] = [[] as string[][], [] as OwnerRequest[], [] as string[], [] as string[]];
	const board = {
		move: (id: string, to: string) => (moved.push(["move", id, to]), { id, status: to }),
		after: (id: string, ids: readonly string[]) => (moved.push(["after", id, ...ids]), { id, after: ids }),
	} as unknown as Board;
	const jobs = { file: (_: Board, id: string | undefined, job: string) => (moved.push(["file", id ?? "-", job]), `filed ${job}`) } as unknown as JobRunner;
	const owner = (request: OwnerRequest) => (asked.push(request), request.id === "DM-D1" ? "" : request.id === "" ? `${request.what} needs the owner's decision` : `${request.id} is not the owner's`);
	const command = ticketCommand(() => board, () => jobs, () => () => "autopilot", () => owner);
	t.mock.method(console, "log", (text: string) => void out.push(text));
	t.mock.method(console, "error", (text: string) => void err.push(text));
	const run = async (...args: string[]) => {
		[out.length, err.length] = [0, 0];
		const code = await Promise.try(() => command.run({ args, project: undefined })).catch((error: Error) => `threw ${error.message}`);
		return [code, out.join("\n"), err.join("\n")];
	};
	return { run, moved, asked };
}

test("a move to any other status asks no decision; after and file go on as before", async (t) => {
	const { run, moved, asked } = load(t);
	assert.deepEqual(await run("status", "DM0001", "planning"), [0, "DM0001 planning", ""]);
	assert.deepEqual(await run("status", "DM0002", "dropped"), [0, "DM0002 dropped", ""]);
	assert.deepEqual(await run("after", "DM0002", "DM0001"), [0, "DM0002 after DM0001", ""]);
	assert.deepEqual(await run("file", "DM0001", "j1"), [0, "filed j1", ""]);
	assert.deepEqual(await run("file", "j2"), [0, "filed j2", ""]);
	assert.deepEqual(asked, []);
	assert.deepEqual(moved, [["move", "DM0001", "planning"], ["move", "DM0002", "dropped"], ["after", "DM0002", "DM0001"], ["file", "DM0001", "j1"], ["file", "-", "j2"]]);
});
