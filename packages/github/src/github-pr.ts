import { ask, CUT, field, pages, type Repository } from "./github-api.ts";
import { day, quoted, text } from "./github-command.ts";
import { comments } from "./github-comments.ts";

// `arthur github pr list [--all]|get <n>|merge <n>` (AR0557): a repository's pull requests, newest update first, and one of
// them with its comments and reviews, each text people wrote on GitHub after `> `; `pr merge` only refuses, since a merge
// on GitHub would put a commit on origin's main that no `arthur merge` review or CI check covered. docs/commands/github-pr.md.

const NEEDS = "Pull requests: read";

// Writes its output; a refusal throws.
export async function pr(each: Repository, verb: string, words: readonly string[], all: boolean): Promise<number> {
	if (verb === "merge") throw new Error("a merge is arthur merge <job>; the push of main marks the pull request merged; nothing was asked of GitHub");
	const { repo, instance } = each;
	const signal = new AbortController().signal;
	if (verb === "list") {
		const listed = await pages(instance, `/repos/${repo}/pulls?state=${all ? "all" : "open"}&sort=updated&direction=desc`, `the pull requests of ${repo}`, NEEDS, signal);
		if (!("items" in listed)) throw new Error(listed.text);
		if (listed.items.length === 0) return (console.log(`no ${all ? "" : "open "}pull requests in ${repo}`), 0);
		const lines = listed.items.flatMap((item) => [`#${text(field(item, "number"))} ${state(item)}, ${refs(item)}, by ${login(item)}, updated ${day(field(item, "updated_at"))}`, ...quoted(field(item, "title"))]);
		console.log([...lines, ...(listed.cut ? [`the pull requests ${CUT}`] : [])].join("\n"));
		return 0;
	}
	const [number = ""] = words;
	if (!/^[1-9]\d*$/.test(number)) throw new Error(`${number} is not a pull request number such as 12; nothing was asked of GitHub`);
	const what = `pull request #${number} of ${repo}`;
	const got = await ask(instance, `/repos/${repo}/pulls/${number}`, what, NEEDS, signal);
	if (!("body" in got)) throw new Error(got.text);
	const item = got.body;
	const said = await comments(each, number, what, NEEDS, signal);
	const reviews = await pages(instance, `/repos/${repo}/pulls/${number}/reviews`, `the reviews of ${what}`, NEEDS, signal);
	if (!("items" in reviews)) throw new Error(reviews.text);
	// A pending review is a draft its author has not submitted.
	const submitted = reviews.items.filter((review) => field(review, "state") !== "PENDING");
	const dates = (["created", "updated", "closed", "merged"] as const).flatMap((word) => (typeof field(item, `${word}_at`) === "string" ? [`${word} ${day(field(item, `${word}_at`))}`] : []));
	const body = quoted(field(item, "body"));
	console.log(
		[
			...[`pull request #${number} of ${repo}: ${state(item)}`, `${refs(item)}, by ${login(item)}; ${dates.join(", ")}`, text(field(item, "html_url")), "title:", ...quoted(field(item, "title"))],
			...(body.length === 0 ? ["body: none"] : ["body:", ...body]),
			...said,
			...(submitted.length === 0 ? ["no reviews"] : []),
			...submitted.flatMap((review) => [`review ${text(field(review, "id"))} by ${login(review)}: ${text(field(review, "state"))} on ${day(field(review, "submitted_at"))}`, ...quoted(field(review, "body"))]),
			...(reviews.cut ? [`the reviews ${CUT}`] : []),
		].join("\n"),
	);
	return 0;
}

// `open`, `closed` or `merged`, and `, draft` for a draft.
function state(item: unknown): string {
	return `${typeof field(item, "merged_at") === "string" ? "merged" : text(field(item, "state"))}${field(item, "draft") === true ? ", draft" : ""}`;
}

// `<head> -> <base>`, each a branch's name.
function refs(item: unknown): string {
	return `${text(field(field(item, "head"), "ref"))} -> ${text(field(field(item, "base"), "ref"))}`;
}

function login(item: unknown): string {
	return text(field(field(item, "user"), "login"));
}
