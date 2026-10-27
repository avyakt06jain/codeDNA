# Review Workspace

**Status:** Verified live on 2026-10-27.

The G3 React client reads repositories, pull requests, decisions, review results, and evidence from FastAPI. It never receives credentials or arbitrary Hindsight bank IDs. The primary view shows a bounded stored diff, actual added-line numbers, review mode, model, elapsed time, validated findings, and an evidence drawer. Team DNA shows authoritative decision state and source references.

Memory and baseline actions call the same backend review contract with only `memory_enabled` changed. Loading disables duplicate review actions; API failures produce a visible error; an empty validated result explicitly avoids claiming the code is bug-free.

Verification includes one component test, a strict TypeScript production build, and a live browser run that displayed the real line-18 `DEC-0042` finding and PR #42 provenance.
