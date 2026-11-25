---
name: generate-review-package-working-tree
description: Build a reviewer's diff package from uncommitted working-tree changes (not commits) for superpowers:subagent-driven-development — only for the rare case where a task's changes are intentionally left uncommitted; the normal flow in this repo commits per task and uses the superpowers `review-package` script
---

# Generate Review Package (Working Tree)

**Status (2026-11-25):** this repo's `CLAUDE.md` ("Git Workflow") has allowed Claude to commit since
2026-11-13, so the normal flow is: implementer commits per task, then the standard
`superpowers:subagent-driven-development` `scripts/review-package BASE HEAD` builds the package.

This skill was written when commits were forbidden. Keep it only for the case where a task's changes
are deliberately left uncommitted (e.g. the user asked to review before committing): then the
reviewer's diff package has to come from the working tree instead.

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

- When the task's changes are committed (the default now) — use the standard
  `superpowers:subagent-driven-development` `scripts/review-package BASE HEAD`; it's the more
  complete tool (proper commit list, `git diff --stat`).
- For the **final whole-branch review** covering multiple tasks' files together, don't loop this
  script per task — build one combined package by hand (list every touched file once, same
  new-vs-modified split) the way this session did, since the whole-branch reviewer needs one
  file, not N.
