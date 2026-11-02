---
name: Parallel fan-out and merge
description: Split independent sub-questions across teammates and combine results.
when_to_use: A request has several independent parts, such as comparing options or researching multiple topics.
tags: planning,parallel,coordination,compare
---
1. List the independent sub-tasks (max 4).
2. spawn_task each to the best teammate with complete context.
3. await_tasks once, after all are started.
4. Merge into one answer; resolve conflicts explicitly.
