import { closeSync, constants, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { waiting } from "./steer-inbox.ts";

// The steer extension the wrapper loads into every job with `-e`: docs/commands/steer.md.

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
			// Appended without creating `log`: a record a `rm -r` is emptying gets no new file, and the wrapper ends the job.
			try {
				const fd = openSync(join(record, "log"), constants.O_WRONLY | constants.O_APPEND);
				writeFileSync(fd, `[arthur ${new Date().toISOString()}] steered ${name}: ${text.split("\n")[0]}\n`);
				closeSync(fd);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			}
		}
	});
}
