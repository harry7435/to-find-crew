---
name: generate-review-package-working-tree
description: Build a task reviewer's diff package from working-tree changes (not commits) when running superpowers:subagent-driven-development in this repo, since git add/commit is forbidden here — use instead of the superpowers script `review-package`, which requires commit SHAs
---

# Generate Review Package (Working Tree)

This repo's `CLAUDE.md` ("Git Workflow") forbids `git add`/`git commit` — the user stages and
commits everything themselves. That breaks the assumption behind
`superpowers:subagent-driven-development`'s own `scripts/review-package BASE HEAD`, which needs a
commit range to diff. Implementers here leave changes as uncommitted working-tree edits, so the
task reviewer's diff package has to come from the working tree instead.

Use this skill's script anywhere that skill's docs say to run `review-package`.

## Usage

```bash
.claude/skills/generate-review-package-working-tree/scripts/review-package-working-tree \
  PLAN_FILE TASK_N [OUTFILE]
```

- `PLAN_FILE` — the implementation plan (same one `task-brief` reads from).
- `TASK_N` — task number; the script extracts that task's `**Files:**` block (lines starting
  with `- Create:` or `- Modify:`) to know which files belong to this task.
- `OUTFILE` — optional; defaults to
  `.superpowers/sdd/review-task-N-working-tree.diff` (creating the directory if needed).

The script prints the path it wrote — hand that path to the task reviewer subagent exactly as
you would the output of the superpowers `review-package` script.

## What it does

For each file the plan's Task N lists under `**Files:**`:
- **New / untracked file** (`git status --short` shows `??`): the full file content is embedded
  (there's nothing to diff against).
- **Modified / tracked file**: `git diff -U10 -- <file>` is embedded (10 lines of context, same
  as the superpowers script's default).

Output is a single markdown file: a header naming the task, a `git status --short` scoped to
just those files, then one section per file.

## When NOT to use this

- If this repo's "no commit" convention ever changes, switch back to the standard
  `superpowers:subagent-driven-development` `scripts/review-package BASE HEAD` — it's the
  more complete tool (proper commit list, `git diff --stat`) once commits exist to diff between.
- For the **final whole-branch review** covering multiple tasks' files together, don't loop this
  script per task — build one combined package by hand (list every touched file once, same
  new-vs-modified split) the way this session did, since the whole-branch reviewer needs one
  file, not N.
