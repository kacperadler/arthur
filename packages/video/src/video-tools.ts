import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { Requirement } from "@arthur/core/plugin";

// What cutting a video needs on this server (AR0551): `ffmpeg` and its `ffprobe`, one package, on PATH. `arthur doctor` lists
// them as one requirement, not critical; a video is cut only when neither is missing. docs/video.md.

// The tools of `ffmpeg` and `ffprobe` that are not an executable file in a folder of PATH, as the shell finds them.
export function absent(): string[] {
	return ["ffmpeg", "ffprobe"].filter(
		(name) =>
			!(process.env.PATH ?? "").split(delimiter).some((dir) => {
				try {
					accessSync(join(dir, name), constants.X_OK);
					return statSync(join(dir, name)).isFile();
				} catch {
					return false;
				}
			}),
	);
}

export const requirements = (): Requirement[] => [
	{
		name: "ffmpeg",
		check() {
			const gone = absent();
			return gone.length === 0 ? "ok" : `missing: ${gone.join(" and ")} not found on PATH`;
		},
		costs: "videos reach the coordinator as paths, without their frames or words",
		fix: "sudo apt-get install -y ffmpeg",
		critical: false,
	},
];
