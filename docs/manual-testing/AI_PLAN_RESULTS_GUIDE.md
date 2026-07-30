# AI Workout-Plan Results — Stage 1 Guide

This workflow prepares `ai-plan-results.csv` evaluation evidence. It does not replace or bypass production generation. The runner calls the real `POST /api/plans/generate` endpoint sequentially with concurrency 1.

## Confirmed production flow

1. `POST /api/plans/generate` is mounted by `backend/src/server.ts` and protected by cookie authentication.
2. Login is `POST /api/auth/login`. The backend sets 15-minute `accessToken` and 7-day `refreshToken` HTTP-only cookies. The runner keeps cookie values only in memory and calls `POST /api/auth/refresh` after a 401.
3. The generation controller reads the authenticated MongoDB user’s `role` and `coachId`. A trainee with a coach is blocked. No stored demographic or fitness field is included in generation.
4. Required backend body fields are `fitnessGoal`, `trainingLevel`, and `trainingDays`. The complete accepted type also contains `age`, `gender`, `height`, `weight`, `injuries`, `preferredWorkoutType`, and `equipmentAvailable`. Test profiles explicitly send all ten.
5. Frontend-controlled values are documented in `AI_PLAN_PROFILE_CATALOGUE.md`. The backend currently validates presence only, not enums or numeric ranges.
6. `WorkoutPlanService` builds a RAG query from level, goal, days, and injuries. `RagRetrieverService` loads `knowledge-base/training-knowledge.json`, performs case-insensitive substring matching, and returns at most five chunks.
7. `PromptBuilder` inserts the complete questionnaire and retrieved context, requires exactly the requested number of non-rest workout days, and specifies the JSON shape.
8. `LlmAiService` sends an authenticated Ollama-compatible `/api/generate` request with model configuration from `LLM_*`. Current fixed parameters are temperature 0.7, top_p 0.9, num_predict 4000, stream false, and JSON format. Timeout uses seconds and retries use bounded exponential backoff.
9. `ResponseValidator` parses JSON and checks the generated core fields. If it rejects the first output, the production service makes one correction call containing the prompt and invalid response.
10. The saved response adds MongoDB identity/ownership fields, derived title and exercise keys, stored questionnaire data, `isActive`, and timestamps. The response fields containing generated content are `summary`, `weeklyPlan`, `safetyNotes`, and `progressionNotes`.
11. Saving a plan deletes the user’s previous active plan. External response evidence is therefore authoritative.

The production API does not expose internal LLM retry count, first invalid output, or correction count. Evidence records those fields as unavailable rather than guessing.

## CSV structure

`ai-plan-results.csv` contains 33 columns and its order is preserved.

Automatically populated per generated output:

- `run_id`, `test_id`, `profile_id`, `repetition`
- `provider`, `model`, `prompt_version`, `knowledge_base_version`
- `generation_time_ms`, `generation_status`
- `schema_valid`, `expected_days`, `generated_days`, `days_correct`
- `evidence_path`

Left blank for human review:

- `equipment_adherent`, `constraint_adherent`
- all eight rating fields from `goal_relevance_rating` through `overall_rating`
- all six subjective defect fields
- `reviewer_id`, `review_notes`

There is no controlled exercise-to-equipment mapping and injury handling is natural language, so the tooling does not infer adherence.

Staging initially has one row per generated output (maximum 90). During finalization, duplicate each objective row twice. Both reviewer rows retain the same run/test/profile/repetition/configuration/evidence values; set reviewer IDs to R01 and R02 and fill ratings, defects, and notes independently. Never overwrite reviewed rows with the staging generator.

## Preparation on the main computer

From `backend/`:

```powershell
$env:AI_PLAN_TEST_PASSWORD='a-test-only-password'
npm run ai-plans:generate -- --dry-run
npm run build
npm test -- --runInBand tests/aiPlanEvaluation.test.ts
```

Dry-run reads and validates profiles, CSV header, knowledge JSON, runtime files, environment configuration, and evidence-directory writability. It makes no HTTP or database request.

Inspect:

- Machine catalogue: `test-data/ai-plan-profiles.json`
- Readable catalogue: `docs/manual-testing/AI_PLAN_PROFILE_CATALOGUE.md`
- Runner: `backend/src/aiPlanEvaluation/runner.ts`

No separate portable application is required because the weak computer already runs the full project. Transfer the Git changes or copy the files listed under “Transfer list.”

## Setup on the weak computer

The weak computer must already have Node.js 20+, npm dependencies, MongoDB, the knowledge-base file, the backend, and access to the configured LLM server.

Configure `backend/.env` without committing it:

```dotenv
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/gymbro
JWT_SECRET=...
REFRESH_TOKEN_SECRET=...
LLM_BASE_URL=...
LLM_USERNAME=...
LLM_PASSWORD=...
LLM_MODEL=llama3.1:8b
LLM_TIMEOUT=30
LLM_MAX_RETRIES=3
AI_PLAN_API_BASE_URL=http://localhost:3001
AI_PLAN_TEST_EMAIL=ai.plan.tester@gymbro.test
AI_PLAN_TEST_PASSWORD=...
AI_PLAN_ENVIRONMENT_ID=weak-computer-local
AI_PLAN_PROVIDER=ollama-compatible
```

Never copy a real `.env` into evidence or source control.

Seed exactly one dedicated user:

```powershell
cd backend
npm run ai-plans:seed-user
```

The command refuses `NODE_ENV=production`, uses the real bcrypt hashing service, creates only `ai.plan.tester@gymbro.test`, sets role `trainee`, removes `coachId`, and safely verifies/updates that reserved user on reruns.

Start the backend:

```powershell
npm run dev
```

In a separate shell with the same AI-plan variables, repeat dry-run. Then Stage 2 commands are:

One profile, all three repetitions:

```powershell
npm run ai-plans:generate -- --profile PLAN-PROFILE-001 --confirm-real-ai
```

One exact repetition:

```powershell
npm run ai-plans:generate -- --profile PLAN-PROFILE-001 --repetition 1 --batch-id AI-PLAN-BATCH-20260730-001 --confirm-real-ai
```

Full 90-output sequential batch:

```powershell
npm run ai-plans:generate -- --batch-id AI-PLAN-BATCH-20260730-001 --confirm-real-ai
```

Resume the latest batch, or name one explicitly:

```powershell
npm run ai-plans:generate -- --resume --confirm-real-ai
npm run ai-plans:generate -- --resume --batch-id AI-PLAN-BATCH-20260730-001 --confirm-real-ai
```

`--confirm-real-ai` is intentionally mandatory. Do not use it during Stage 1.

Evidence is written under:

```text
test-evidence/ai-plans/<batch-id>/
```

Each response is written through a temporary file, flushed, closed, and atomically renamed before metadata, validation, and manifest advancement. Incomplete directories are archived on resume. Successful, failed, timeout, and inconclusive executions remain visible. Recorded failed repetitions are not silently replaced.

## Return to the main computer

Copy the complete directory:

```text
test-evidence/ai-plans/<batch-id>/
```

Place it at the same relative path on the main computer. Validate imported files with resume in a non-network review context by inspecting `run-manifest.json` and `batch-summary.json`; do not add `--confirm-real-ai` unless intentionally continuing Stage 2.

Generate objective staging rows:

```powershell
cd backend
npm run ai-plans:staging-csv -- --batch-id AI-PLAN-BATCH-20260730-001
```

Output:

```text
ai-plan-results-staging.csv
```

The generator refuses to overwrite a staging CSV containing rows. Use `--output <new-file.csv>` for another batch. Human ratings are never invented.

## Resume semantics

The manifest is created with all 90 profile/repetition pairs and stable run IDs. Resume:

- verifies metadata, validation, and response/error evidence;
- skips complete successful or recorded terminal evidence;
- archives and reruns only incomplete evidence using the same run identity;
- never treats a directory alone as completion;
- reports pending and status counts.

## Why one user is sufficient

All generation content inputs come from each questionnaire, RAG, and LLM configuration. The authenticated user controls authorization and ownership only. Previous plans and sessions are not read. One dedicated trainee without `coachId` therefore executes all 30 profiles without changing the evaluated generation behavior.

Only the latest plan remains in MongoDB because active-plan replacement is unchanged. This does not invalidate the experiment: every API response is persisted externally before the next request, and external evidence is the permanent record.

## Transfer list

Copy or commit:

- `backend/src/aiPlanEvaluation/common.ts`
- `backend/src/aiPlanEvaluation/runner.ts`
- `backend/src/aiPlanEvaluation/seedUser.ts`
- `backend/src/aiPlanEvaluation/stagingCsv.ts`
- `backend/tests/aiPlanEvaluation.test.ts`
- `backend/package.json` and lockfile if regenerated
- `test-data/ai-plan-profiles.json`
- `docs/manual-testing/AI_PLAN_PROFILE_CATALOGUE.md`
- `docs/manual-testing/AI_PLAN_RESULTS_GUIDE.md`
- `ai-plan-results.csv`
- `ai-plan-results-staging.csv`
- `.env.example`
- `.gitignore`

Must already exist:

- full backend source and installed dependencies;
- `knowledge-base/training-knowledge.json`;
- local MongoDB and the real backend configuration;
- network access to the LLM service.

Do not transfer `.env`, `node_modules`, frontend builds, pose-analysis dependencies, screenshots, or old evidence.

## Limitations and Stage 2 warnings

- The backend has no questionnaire enum/range validator; dry-run follows frontend controls and checks only positive numeric body values.
- The current RAG retriever matches the complete constructed query as a substring, so many profiles may retrieve zero chunks. Production behavior is intentionally unchanged.
- Internal LLM retries and correction calls are not observable from the API.
- Equipment and injury adherence require two human reviewers.
- Ensure the weak computer’s date/time and Git commit are correct before creating the batch.
- Review the 30 profiles and dry-run output before enabling `--confirm-real-ai`.
