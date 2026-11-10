import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { temporaryFolder, until } from "@arthur/core/testing";
import handoffs from "../src/handoff-extension.ts";

const ARTHUR = "This message comes from Arthur, not the owner; your reply goes to the owner only if one of their messages joins this turn.";
type Handler = (event: unknown, ctx: unknown) => unknown;

// The message the extension `load` sends for a request of `then`, in a session folder of its own under `parent`, once omp has
// been idle with nothing queued for its 2 s; and the handoff's path in that folder.
async function asked(load: (pi: unknown) => void, then: string, parent = temporaryFolder()): Promise<{ readonly message: string; readonly handoff: string }> {
	const folder = join(parent, "session");
	mkdirSync(folder);
	writeFileSync(join(folder, "request.json"), JSON.stringify({ then, slot: "test", asked: Date.now(), waitSeconds: 60 }));
	const [handlers, sent] = [new Map<string, Handler>(), [] as string[]];
	let tick: () => unknown = () => undefined;
	const ctx = { hasUI: true, isIdle: () => true, hasPendingMessages: () => false, compact: async () => {}, setInterval: (fn: () => unknown) => (tick = fn) };
	process.env.ARTHUR_SESSION_FOLDER = folder;
	try {
		load({ on: (name: string, handler: Handler) => handlers.set(name, handler), sendUserMessage: (content: string) => sent.push(content) });
	} finally {
		delete process.env.ARTHUR_SESSION_FOLDER;
	}
	handlers.get("session_start")?.({}, ctx);
	const message = await until(`the ${then} request`, () => (tick(), sent[0]));
	return { message, handoff: join(folder, "handoff.md") };
}

test("the handoff request is today's text, word for word, for a compaction, a restart and a fresh start, the handoff's path filled in", async () => {
	const rest = (handoff: string, next: string) =>
		`First write your handoff to ${handoff}, replacing what it holds: the work in progress, the next steps, and every question to the owner still unanswered, with when you asked it. The ${next} conversation starts by reading it. ${ARTHUR}`;
	const [compact, restart, fresh] = await Promise.all(["compact", "restart", "fresh"].map((then) => asked(handoffs as (pi: unknown) => void, then)));
	assert.equal(compact?.message, `[Arthur] Your conversation is compacted after this turn. ${rest(compact?.handoff ?? "", "compacted")}`);
	assert.equal(restart?.message, `[Arthur] This conversation ends after this turn: the coordinator restarts and goes on with this one. ${rest(restart?.handoff ?? "", "next")}`);
	assert.equal(fresh?.message, `[Arthur] This conversation ends after this turn: the coordinator restarts in a fresh conversation. ${rest(fresh?.handoff ?? "", "next")}`);
});

test("the request's words are the file roles/coordinator/handoff-<then>.md beside the extension, each {handoff} filled in, a $ pattern in the path kept", async () => {
	// A copy of the extension in a package of its own, so its roles/coordinator/ holds this test's wording, not the shipped one.
	const pkg = temporaryFolder();
	mkdirSync(join(pkg, "src"));
	mkdirSync(join(pkg, "roles/coordinator"), { recursive: true });
	writeFileSync(join(pkg, "package.json"), '{ "type": "module" }\n');
	copyFileSync(new URL("../src/handoff-extension.ts", import.meta.url), join(pkg, "src/handoff-extension.ts"));
	writeFileSync(join(pkg, "roles/coordinator/handoff-restart.md"), "Write {handoff} now, then read {handoff}; {other} stays.\n");
	// Its path is known only at run time, so it cannot be a static import.
	const { default: copy } = (await import(pathToFileURL(join(pkg, "src/handoff-extension.ts")).href)) as { readonly default: (pi: unknown) => void };
	const parent = join(temporaryFolder(), "a$&b");
	mkdirSync(parent);
	const { message, handoff } = await asked(copy, "restart", parent);
	assert.equal(message, `[Arthur] Write ${handoff} now, then read ${handoff}; {other} stays. ${ARTHUR}`);
	assert.ok(handoff.includes("$&"), handoff);
});
