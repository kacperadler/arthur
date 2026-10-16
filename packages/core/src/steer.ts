import { appendFileSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { waiting } from "./steer-inbox.ts";

// The steer extension (spec/roadmap.md, entry 14): an OMP extension the wrapper loads into every job with `-e`, `ARTHUR_JOB`
// naming the job's record. `tool_result` fires after each tool call; there it hands the agent every steer waiting in the
// record's `steer/inbox/`, oldest first, each as a user message delivered as `steer`, which reaches the model before its
// next step while the run goes on, and moves it to `steer/done/` with one line in the job's log.

type ExtensionApi = {
	on(event: "tool_result", handler: () => void): void;
	sendUserMessage(content: string, options: { readonly deliverAs: "steer" }): void;
};

export default function steer(pi: ExtensionApi): void {
	const record = process.env.ARTHUR_JOB;
	if (record === undefined || record === "") return;
	const folder = join(record, "steer");
	pi.on("tool_result", () => {
		for (const name of waiting(folder, "inbox")) {
			let text: string;
			try {
				text = readFileSync(join(folder, "inbox", name), "utf8").trim();
				mkdirSync(join(folder, "done"), { recursive: true });
				renameSync(join(folder, "inbox", name), join(folder, "done", name));
			} catch (error) {
				// Moved aside by the wrapper at the job's end.
				if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
				throw error;
			}
			pi.sendUserMessage(text, { deliverAs: "steer" });
			appendFileSync(join(record, "log"), `[arthur ${new Date().toISOString()}] steered ${name}: ${text.split("\n")[0]}\n`);
		}
	});
}
