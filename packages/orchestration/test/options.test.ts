import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOptions, coordinatorOptions, roleOptions } from "../src/orchestration-options.ts";

const paths = (options: Record<string, unknown>) => checkOptions(options).map(({ path, problem }) => `${path}: ${problem}`);

test("the options of arthur.config.example.ts pass, and none at all pass with the coordinator's defaults", () => {
	const example = {
		maxAgents: 3,
		coordinator: { model: "anthropic/claude-opus-5-5", thinking: "high", tmux: { session: "arthur", socket: "arthur" }, exitWaitSeconds: 60, restartDelaySeconds: 5 },
		roles: {
			worker: { model: ["mac/qwen3-coder", "anthropic/claude-haiku-5-5"], thinking: undefined },
			reviewer: { model: "anthropic/claude-sonnet-5", thinking: "medium" },
			planner: { model: undefined, thinking: undefined },
			project: { model: "anthropic/claude-opus-5-5", thinking: "high" },
			quick: { model: "anthropic/claude-haiku-5-5" },
		},
		plan: { budgetUsd: 5 },
		autopilot: { budgetUsd: 1, budgetMaxUsd: 3 },
		morningReport: { at: "08:00" },
	};
	assert.deepEqual(paths(example), []);
	assert.deepEqual(paths({}), []);
	assert.deepEqual(coordinatorOptions({}), { model: undefined, thinking: undefined, quick: undefined, session: "arthur", socket: "arthur", exitWaitSeconds: 60, restartDelaySeconds: 5 });
	assert.deepEqual(coordinatorOptions({ coordinator: { tmux: { socket: "/tmp/x.sock" }, exitWaitSeconds: 0 } }), { model: undefined, thinking: undefined, quick: undefined, session: "arthur", socket: "/tmp/x.sock", exitWaitSeconds: 0, restartDelaySeconds: 5 });
	assert.equal(coordinatorOptions(example).quick, "anthropic/claude-haiku-5-5");
	assert.deepEqual([roleOptions(example, "reviewer"), roleOptions(example, "auditor"), roleOptions({}, "worker"), roleOptions(example, "toString")], [{ model: "anthropic/claude-sonnet-5", thinking: "medium" }, {}, {}, {}]);
});

test("each wrong option is refused, naming its path", () => {
	assert.deepEqual(
		paths({
			maxAgent: 3,
			maxAgents: 0,
			coordinator: { thinking: "huge", tmux: { session: "a:b", socket: "", port: 1 }, exitWaitSeconds: 1.5, restartDelaySeconds: 0, model: "" },
			roles: { Worker: {}, worker: { model: [], thinking: "high", budget: 1 }, reviewer: "fast", quick: { model: ["a/b"], thinking: "low" } },
			plan: { budgetUsd: -1 },
			autopilot: 3,
			morningReport: { at: "24:00" },
		}),
		[
			"maxAgent: unknown option; options: maxAgents, coordinator, roles, plan, autopilot, morningReport",
			"maxAgents: expected a whole number of at least 1, got 0",
			"coordinator.thinking: expected one of off, minimal, low, medium, high, xhigh, max, auto, got \"huge\"",
			'coordinator.tmux.session: expected letters, digits, _ and -, got "a:b"',
			'coordinator.tmux.socket: expected a non-empty string, got ""',
			"coordinator.tmux.port: unknown key; keys: session, socket",
			"coordinator.exitWaitSeconds: expected a whole number of at least 0, got 1.5",
			"coordinator.restartDelaySeconds: expected a whole number of at least 1, got 0",
			'coordinator.model: expected a non-empty string, got ""',
			"plan.budgetUsd: expected an amount in USD, 0 or more, got -1",
			"autopilot: expected an object with budgetUsd, budgetMaxUsd, got 3",
			'morningReport.at: expected "HH:MM", 00:00 to 23:59, got "24:00"',
			"roles.Worker: expected a role name of lowercase letters, digits and dashes",
			"roles.worker.model: expected a model name, or a non-empty list of them, got a list",
			"roles.worker.budget: unknown key; keys: model, thinking",
			'roles.reviewer: expected an object with model, thinking, got "fast"',
			"roles.quick.model: expected a non-empty string, got a list",
			"roles.quick.thinking: unknown key; keys: model",
		],
	);
	assert.deepEqual(paths({ roles: ["worker"] }), ["roles: expected one entry per role, e.g. { worker: { model, thinking } }, got a list"]);
});

test("the limits pass at their edge: no wait for the previous agent, a delay of one second, the last minute of the day", () => {
	assert.deepEqual(paths({ maxAgents: 1, coordinator: { exitWaitSeconds: 0, restartDelaySeconds: 1, tmux: { session: "my_coord-2" } }, plan: { budgetUsd: 0 }, morningReport: { at: "23:59" } }), []);
	assert.deepEqual(paths({ coordinator: { exitWaitSeconds: -1 } }), ["coordinator.exitWaitSeconds: expected a whole number of at least 0, got -1"]);
});
