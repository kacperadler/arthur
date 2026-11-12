import { call, field, ID, type Instance, NOTHING, text } from "./dokploy-api.ts";

// `arthur dokploy source` (AR0680): an app's source, its GitHub repository and branch through Dokploy's GitHub app, with
// auto-deploy on, so a push to the branch deploys it (Dokploy's own webhook, /api/deploy/github): docs/commands/dokploy.md.

export type Source = { readonly repo: string; readonly branch: string; readonly buildPath?: string; readonly github?: string; readonly replace: boolean };

const listed = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export async function sourceApp(instance: Instance, id: string, { repo, branch, buildPath = "/", github, replace }: Source, next: (then: string) => string): Promise<number> {
	if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo)) throw new Error(`--repo ${text(repo)} is not <owner>/<name>: an owner of letters, digits and -, a name of letters, digits, ., _ and -; ${NOTHING}`);
	// Dokploy's VALID_BRANCH_REGEX, which its saveGithubProvider holds a branch to.
	if (!/^[a-zA-Z0-9._\-/#]+$/.test(branch)) throw new Error(`--branch ${text(branch)} is not a branch Dokploy takes: letters, digits, ., _, -, / and #; ${NOTHING}`);
	if (!buildPath.startsWith("/") || buildPath.split("/").includes("..")) throw new Error(`--build-path ${text(buildPath)} is not a folder of the repository: a path from /, without a .. part; ${NOTHING}`);
	const [owner, name] = repo.split("/") as [string, string];
	const item = await call(instance, "application.one", { applicationId: id }, `app ${id}`);
	const heading = `${text(field(item, "name"))} (${id}) on instance ${instance.label}`;
	const nothing = "nothing was changed";
	const providers = listed(await call(instance, "github.githubProviders", {}, "the GitHub apps"));
	const named = (provider: unknown) => text(field(field(provider, "gitProvider"), "name"));
	const known = providers.map(named).join(", ");
	if (providers.length === 0) throw new Error(`instance ${instance.label} has no GitHub app the token's user may use: the owner adds one in Dokploy's panel, Settings, Git providers, and installs it on ${repo}; ${nothing}`);
	const chosen = github === undefined ? (providers.length === 1 ? providers[0] : undefined) : providers.find((each) => named(each) === github);
	if (chosen === undefined) throw new Error(`instance ${instance.label} ${github === undefined ? `has ${providers.length} GitHub apps: add --github <name>` : `has no GitHub app ${text(github)}`}; its GitHub apps: ${known}; ${nothing}`);
	const [app, githubId] = [named(chosen), field(chosen, "githubId")];
	if (typeof githubId !== "string" || !ID.test(githubId)) throw new Error(`instance ${instance.label}: GitHub app ${app} has no Dokploy id; ${nothing}`);
	const repositories = listed(await call(instance, "github.getGithubRepositories", { githubId }, `the repositories of GitHub app ${app}`));
	// GitHub's names ignore case; the push webhook compares the owner and name as GitHub writes them.
	const same = (value: unknown, given: string) => text(value).toLowerCase() === given.toLowerCase();
	const found = repositories.find((each) => same(field(field(each, "owner"), "login"), owner) && same(field(each, "name"), name));
	if (found === undefined) throw new Error(`GitHub app ${app} cannot see ${repo}: install the GitHub app on it (GitHub, Settings, GitHub Apps, Configure), then run this again; ${nothing}`);
	const [login, repository] = [text(field(field(found, "owner"), "login")), text(field(found, "name"))];
	const branches = listed(await call(instance, "github.getGithubBranches", { repo: repository, owner: login, githubId }, `the branches of ${login}/${repository}`));
	if (!branches.some((each) => field(each, "name") === branch)) throw new Error(`${login}/${repository} has no branch ${branch}; ${nothing}`);
	const asked = { sourceType: "github", githubId, owner: login, repository, branch };
	const moved = Object.entries(asked).some(([key, value]) => field(item, key) !== value);
	const ran = field(item, "deployments");
	const from = field(item, "sourceType") === "github" ? `github ${text(field(item, "owner"))}/${text(field(item, "repository"))}, branch ${text(field(item, "branch"))}` : text(field(item, "sourceType"));
	if (moved && !(Array.isArray(ran) && ran.length === 0) && !replace) throw new Error(`${heading} deploys from ${from} and has deployments; this makes it deploy from github ${login}/${repository}, branch ${branch}: add --replace-source for that; ${nothing}`);
	const saved = !moved && field(item, "buildPath") === buildPath && field(item, "triggerType") === "push";
	// The push webhook deploys only an app whose autoDeploy is true.
	const auto = field(item, "autoDeploy") === true;
	const said = `${heading}: source github ${login}/${repository}, branch ${branch}, build path ${buildPath}, GitHub app ${app}`;
	if (saved && auto) {
		console.log(`${said}: already set`);
		return 0;
	}
	// saveGithubProvider writes every field it takes; the watch paths and submodules go back as the app has them.
	const watchPaths = field(item, "watchPaths");
	const body = { applicationId: id, githubId, owner: login, repository, branch, buildPath, triggerType: "push", watchPaths: Array.isArray(watchPaths) ? watchPaths : [], enableSubmodules: field(item, "enableSubmodules") === true };
	if (!saved) await call(instance, "application.saveGithubProvider", {}, `the source of app ${id}`, body);
	if (!auto) await call(instance, "application.update", {}, `the auto-deploy of app ${id}`, { applicationId: id, autoDeploy: true });
	console.log(`${said}: set\na push to ${branch} deploys it; the first deploy: ${next("deploy")}`);
	return 0;
}
