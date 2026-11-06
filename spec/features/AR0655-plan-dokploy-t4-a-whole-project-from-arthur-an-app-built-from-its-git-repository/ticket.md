# AR0655 - Plan: Dokploy T4, a whole project from Arthur: an app built from its Git repository, and a database it connects to

```json
{
  "id": "AR0655",
  "title": "Plan: Dokploy T4, a whole project from Arthur: an app built from its Git repository, and a database it connects to",
  "date": "2026-11-06"
}
```

## Description

The owner, 2026-11-06, after approving the dokploy upload and deploy commands (AR0603): "what about setup a project with for example db and by git and not by zip?". Today an app reaches Dokploy only as an uploaded zip (AR0603), and AR0654 creates and sets up an app. Neither connects an app to its Git repository, so a push deploys it, nor creates a database beside it. This plan says how Arthur sets up a whole project on Dokploy: the app from its repository and branch, a database, and the app's connection to it.

## Goal

A plan the owner approves before any code: which Dokploy API calls (`application.saveGithubProvider` or `saveGitProvider` and their deploy-on-push setting, `postgres.create` and the other database kinds, their deploy and their internal connection URL), what Dokploy needs first (a GitHub app or deploy key in Dokploy, its own account settings), how a database password is made and handed to the app's environment without Arthur printing or keeping it, and which commands `arthur dokploy` gains, cut into worker tickets each a pull request.

- Kind: feat
- Plan: yes

## Done means

- `plan.md` covers: the Git source (GitHub provider, plain Git with a deploy key, or both; deploy on push; branch; build path), databases (which kinds, version, volume, backups if Dokploy offers them, the internal URL), the secret path (generated where, stored where, shown never), the commands and their refusals, the owner's part (what he sets up in Dokploy or GitHub once), the tests against the fake Dokploy in its documented shape, and the line budget.
- Every Dokploy call named is checked against Dokploy's own API reference or source at a version named in the plan.
- Open questions are each a decision for the owner, with a recommendation.

## Scope

In:
- `spec/features/AR0655-plan-dokploy-t4-a-whole-project-from-arthur-an-app-built-from-its-git-repository/plan.md` only.

Out:
- Code, roadmap and vision edits: the worker tickets cut from the approved plan.
- Upload and deploy (AR0603), create and setup of an app from a zip (AR0654).

## Decisions

