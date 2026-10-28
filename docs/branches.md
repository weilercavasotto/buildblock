# Branches and workflow

The repository is <https://github.com/weilercavasotto/buildblock> (`origin`). Work is organised around three kinds of branch.

| Branch | What it is | Who writes to it |
|---|---|---|
| `main` | What is published: the code behind `play.buildblock.dev` and `buildblock.dev`. Always builds and works. | Only a release merge from `develop` (see *Releasing*), never a direct commit. |
| `develop` | Where the work comes together: the next release in progress. | Direct commits for small tasks, and the merge of every task branch. |
| a task branch | One task (a feature, a fix, a doc), started from `develop`. | The task, until it is done and merged into `develop`. |

## The rules

1. **Never work on `main`.** All work, features and fixes included, happens on `develop` or on a task branch.
2. **A task branch is optional.** A small change can be done directly on `develop`. A bigger or riskier one, or one that takes several steps, goes on its own branch so `develop` stays in a working state.
3. **A task branch always ends in `develop`:** when the task is done, merge it into `develop` and delete the branch.
4. **Finishing a task always means a commit on `develop`:** the work is committed on `develop` (directly or by the merge of the task branch) before moving on to the next task. Nothing is left uncommitted at the end of a task.
5. **A branch only goes to `main` through a release**, never half done.

## Task branches

Start from an up to date `develop` and name the branch after the kind of work and what it is, in lowercase with hyphens:

| Prefix | For | Example |
|---|---|---|
| `feature/` | a new part, mode or screen | `feature/headlight`, `feature/tutorial` |
| `fix/` | a bug | `fix/wheel-overlap` |
| `docs/` | documentation only | `docs/branches` |
| `chore/` | tooling, dependencies, renames | `chore/rename-buildblock` |

```bash
git switch develop
git pull                         # when develop is on the remote
git switch -c feature/headlight  # work and commit here, as often as you like
```

Commit on the branch as the work goes (small commits are fine there). Before merging, check that `npm run build` passes and that the docs and `help-content.ts` are updated (see `AGENTS.md`).

### Finishing a task: merge into `develop`

```bash
git switch develop
git merge --no-ff feature/headlight -m "Headlight: a lamp mounted on a block face, switched by a key"
git branch -d feature/headlight
```

`--no-ff` keeps a merge commit, so the history still shows which commits belonged to which task. If the task was done directly on `develop`, there is nothing to merge: its commit is already there.

## Commit messages

One short imperative line that says what the commit does (what changed and, if it is not obvious, why), then a blank line and the details when they help. The commits made with Claude end with the `Co-Authored-By` line the tooling adds.

## The remote

- `develop` is pushed to `origin` with `git push -u origin develop` the first time and `git push` afterwards.
- A task branch can stay local, or be pushed (`git push -u origin feature/x`) to keep a copy; delete it on the remote after the merge (`git push origin --delete feature/x`).
- Nothing is pushed unless it is asked for: committing and pushing are separate steps.

## Releasing (`develop` into `main`)

Done when `develop` is ready to be published, never in the middle of a task:

```bash
git switch develop && npm run build          # it must pass
git switch main
git merge --no-ff develop -m "Release 0.2.0"
git tag v0.2.0                               # optional: the version of package.json
git push origin main --tags
npm run deploy:play                          # and npm run deploy:site when the website changed
git switch develop
```

(`docs/deploy.md` explains the deployment.) Bump `version` in `package.json` in the release commit when a version number is used: the game shows it in the main menu.

### A fix that cannot wait

For a bug that is live on `main`: start `fix/<name>` from `main`, merge it into `main` (a release as above, with the tag) **and** into `develop`, so the fix is not lost in the next release.

## Quick reference

```bash
git branch --show-current          # where am I?
git switch develop                 # go to develop
git switch -c feature/<name>       # start a task branch from where you are (develop)
git merge --no-ff feature/<name>   # on develop: finish the task
git branch -d feature/<name>       # delete the merged task branch
git log --oneline --graph -20      # see the branches and merges
```
