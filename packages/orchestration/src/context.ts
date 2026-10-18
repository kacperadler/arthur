import type { Host } from "@arthur/core/plugin";

// The coordinator's context (spec/roadmap.md, entry 25): what `arthur coordinator context` prints, which the context extension
// (context-extension.ts) adds to the coordinator's system prompt before every turn. Its role, read as every role is; each
// project's vision; a warning per file missing; each project's board digest; the local time and whether it is night; and each
// plugin's answer to `collect("coordinator.context")`. A vision, a board or a plugin that fails costs its own lines, named:
// docs/commands/coordinator.md, "The coordinator's context".

const firstLine = (error: unknown) => (error instanceof Error ? error.message : String(error)).split("\n")[0];

export function coordinatorContext(host: Host): string {
	const { prompt, warnings } = host.jobs.prompt("coordinator");
	const parts = [prompt.trim()];
	// Without a project list the only project is the repository Arthur runs in, which has no board.
	const projects = host.collect("projects").length > 0 ? host.board.projects().map((project) => project.name) : [undefined];
	for (const name of projects) {
		try {
			const { project, path, text = "", problem } = host.jobs.vision(name);
			if (problem !== undefined || text.trim() === "") warnings.push(`project ${project} has no vision: ${path} is ${problem ?? "empty"}; the coordinator goes without it`);
			else parts.push(`## Vision of ${project} (${path})\n\n${text.trim()}`);
		} catch (error) {
			warnings.push(`project ${name}: its vision was not read: ${firstLine(error)}`);
		}
	}
	if (warnings.length > 0) parts.push(`## Warnings\n\n${warnings.map((warning) => `- ${warning}`).join("\n")}`);
	for (const name of projects) {
		let digest: string;
		try {
			digest = host.board.digest(name);
		} catch (error) {
			digest = `the board was not read: ${firstLine(error)}`;
		}
		parts.push(`## Board${name === undefined ? "" : ` of ${name}`}\n\n${digest}`);
	}
	const { date, time, day } = host.clock.local();
	const night = host.clock.isQuiet() ? "night: within the owner's quiet hours" : "day: outside the owner's quiet hours";
	parts.push(`## Time\n\n${time} on ${day} ${date} (${host.clock.timeZone}), ${night}.`);
	for (const answer of host.collectEach("coordinator.context")) {
		const said = "error" in answer ? `coordinator.context failed: ${firstLine(answer.error)}` : answer.value;
		if (said !== undefined && typeof said !== "string") parts.push(`## ${answer.plugin}\n\ncoordinator.context answered ${typeof said}, not text`);
		else if (said !== undefined && said.trim() !== "") parts.push(`## ${answer.plugin}\n\n${said.trim()}`);
	}
	return parts.join("\n\n");
}
