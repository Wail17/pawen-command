---
active: true
iteration: 1
session_id: 
max_iterations: 0
completion_promise: "PHASE_U4_DONE"
started_at: "2026-04-24T22:40:43Z"
---

Execute Phase U.4 from spec.md Phase U.4 section and TEST_PLAN.md Section 12 autonomously until done. The user does NOT have API keys yet for the new providers Exa BrightData TikAPI Rainforest. Build everything assuming keys will be added later. Use mock test data for adapter unit tests. Skip any live integration test that requires keys but document in TODO_TESTS.md exactly what live test command to run for each adapter once keys arrive. Iterations: U.4.1 abstraction interfaces, then U.4.2 adapters Exa Brave BrightData TikAPI Rainforest YouTube Reddit MetaGraph, then U.4.3 source files refactor, then U.4.4 Meta Graph Ad Library rewrite, then U.4.5 Firecrawl cache, then U.4.6 quality scoring, then U.4.7 embeddings dedup, then U.4.8 health dashboard, then U.4.9 feedback loop, then U.4.10 cleanup plan, then U.4.11 migration safety. Run npm run build after each iteration. Only stop if build fails or truly blocking question arises. Update progress.txt after each iteration. Goal: when the user wakes up tomorrow, all code should be ready and the only remaining task should be adding API keys to Vercel and running the live tests from TODO_TESTS.md.
