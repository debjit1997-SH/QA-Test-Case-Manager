---
name: QA manager build notes
description: Durable implementation constraints for the QA Test Case Manager workspace.
---

The workspace API generator currently emits Zod 4 helpers such as `z.int()` and `z.email()`, so the shared Zod catalog must stay on the Zod 4 major when regenerating contracts.

**Why:** Contract generation initially passed Orval but failed the workspace typecheck because the scaffold was pinned to Zod 3.

**How to apply:** If the API contract changes, run codegen after confirming the shared Zod version still matches the generated validator syntax.