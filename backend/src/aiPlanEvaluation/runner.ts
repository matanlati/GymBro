import childProcess from 'child_process'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import {
  AiPlanProfile, CSV_COLUMNS, atomicWrite, findProjectRoot, readProfiles,
  sha256File, validateGeneratedPlan, validateProfiles,
} from './common'

type RunStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'INCONCLUSIVE'
interface ManifestRun {
  run_id: string
  profile_id: string
  repetition: number
  status: RunStatus
  evidence_path: string
}
interface Manifest {
  batch_id: string
  created_at: string
  runs: ManifestRun[]
}

const args = process.argv.slice(2)
const has = (flag: string) => args.includes(flag)
const option = (flag: string) => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}
const root = findProjectRoot()
const profiles = readProfiles(root)
const evidenceRoot = path.join(root, 'test-evidence', 'ai-plans')
const apiBaseUrl = (process.env.AI_PLAN_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '')
const environmentId = process.env.AI_PLAN_ENVIRONMENT_ID || 'local-unspecified'
const testEmail = process.env.AI_PLAN_TEST_EMAIL || 'ai.plan.tester@gymbro.test'
const password = process.env.AI_PLAN_TEST_PASSWORD
const sourceCsv = path.join(root, 'ai-plan-results.csv')
const knowledgeFile = path.join(root, 'knowledge-base', 'training-knowledge.json')
const promptFile = path.join(root, 'backend', 'src', 'services', 'workoutPlan', 'PromptBuilder.ts')

function report(level: 'PASS' | 'FAIL' | 'WARNING', message: string) {
  console.log(`${level} ${message}`)
}

function validateCsvHeader(): string | null {
  if (!fs.existsSync(sourceCsv)) return 'ai-plan-results.csv is missing'
  const header = fs.readFileSync(sourceCsv, 'utf8').split(/\r?\n/, 1)[0]
  return header === CSV_COLUMNS.join(',') ? null : 'ai-plan-results.csv header differs from the required 33-column structure'
}

function dryRun(): number {
  let failures = 0
  const profileErrors = validateProfiles(profiles)
  if (profileErrors.length) {
    profileErrors.forEach(error => report('FAIL', error))
    failures += profileErrors.length
  } else report('PASS', '30 unique questionnaire profiles and payloads are valid')

  const csvError = validateCsvHeader()
  if (csvError) {
    report('FAIL', csvError)
    failures += 1
  } else report('PASS', 'ai-plan-results.csv header is readable and unchanged')

  try {
    JSON.parse(fs.readFileSync(knowledgeFile, 'utf8'))
    report('PASS', 'RAG knowledge-base file exists and contains valid JSON')
  } catch (error) {
    report('FAIL', `RAG knowledge-base validation failed: ${error instanceof Error ? error.message : error}`)
    failures += 1
  }

  const runtimeFiles = [
    'backend/src/controllers/plans.controller.ts',
    'backend/src/services/workoutPlan/PromptBuilder.ts',
    'backend/src/services/workoutPlan/LlmAiService.ts',
    'backend/src/services/workoutPlan/ResponseValidator.ts',
    'backend/src/server.ts',
  ]
  const missing = runtimeFiles.filter(file => !fs.existsSync(path.join(root, file)))
  if (missing.length) {
    missing.forEach(file => report('FAIL', `Required runtime file is missing: ${file}`))
    failures += missing.length
  } else report('PASS', 'Required production runtime files are present')

  if (/^https?:\/\//.test(apiBaseUrl)) report('PASS', `Backend base URL configured as ${apiBaseUrl}`)
  else {
    report('FAIL', 'AI_PLAN_API_BASE_URL must be an HTTP(S) URL')
    failures += 1
  }
  if (testEmail && password) report('PASS', 'Login email and password configuration are present')
  else {
    report('FAIL', 'AI_PLAN_TEST_PASSWORD is required; the default dedicated test email is configured')
    failures += 1
  }

  try {
    fs.mkdirSync(evidenceRoot, { recursive: true })
    const probe = path.join(evidenceRoot, `.write-probe-${process.pid}`)
    fs.writeFileSync(probe, 'dry-run')
    fs.unlinkSync(probe)
    report('PASS', `Evidence directory is writable: ${path.relative(root, evidenceRoot)}`)
  } catch (error) {
    report('FAIL', `Evidence directory is not writable: ${error instanceof Error ? error.message : error}`)
    failures += 1
  }
  report('PASS', 'Dry-run made no HTTP, AI-generation, plan, or database request')
  report('WARNING', 'Age, height, and weight have no enforced application ranges; dry-run validates only positive finite values')
  report('WARNING', 'Equipment and injury adherence remain human-review fields')
  console.log(failures ? `FAIL dry-run completed with ${failures} failure(s)` : 'PASS dry-run completed successfully')
  return failures ? 1 : 0
}

function todayCompact() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

function nextBatchId(): string {
  fs.mkdirSync(evidenceRoot, { recursive: true })
  const prefix = `AI-PLAN-BATCH-${todayCompact()}-`
  const indexes = fs.readdirSync(evidenceRoot)
    .filter(name => name.startsWith(prefix))
    .map(name => Number(name.slice(prefix.length)))
    .filter(Number.isInteger)
  return `${prefix}${String((indexes.length ? Math.max(...indexes) : 0) + 1).padStart(3, '0')}`
}

function latestBatchId(): string | undefined {
  if (!fs.existsSync(evidenceRoot)) return undefined
  return fs.readdirSync(evidenceRoot)
    .filter(name => /^AI-PLAN-BATCH-\d{8}-\d{3}$/.test(name))
    .sort()
    .at(-1)
}

function gitValue(command: string[]): string {
  try {
    return childProcess.execFileSync('git', command, { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return 'unavailable'
  }
}

function createManifest(batchId: string): Manifest {
  const batchSequence = Number(batchId.slice(-3))
  let runNumber = 0
  const runs = profiles.flatMap(profile => [1, 2, 3].map(repetition => {
    runNumber += 1
    return {
      run_id: `RUN-${todayCompact()}-${String((batchSequence - 1) * 90 + runNumber).padStart(4, '0')}`,
      profile_id: profile.profile_id,
      repetition,
      status: 'PENDING' as const,
      evidence_path: `${profile.profile_id}/repetition-${repetition}`,
    }
  }))
  return { batch_id: batchId, created_at: new Date().toISOString(), runs }
}

function evidenceComplete(batchDir: string, run: ManifestRun): boolean {
  const directory = path.join(batchDir, run.evidence_path)
  const metadata = path.join(directory, 'metadata.json')
  const validation = path.join(directory, 'validation.json')
  if (!fs.existsSync(metadata) || !fs.existsSync(validation)) return false
  if (run.status === 'SUCCESS') return fs.existsSync(path.join(directory, 'response.json'))
    || fs.existsSync(path.join(directory, 'response.txt'))
  if (['FAILED', 'TIMEOUT', 'INCONCLUSIVE'].includes(run.status)) {
    return fs.existsSync(path.join(directory, 'error.txt'))
  }
  return false
}

function readSetCookies(headers: Headers): Record<string, string> {
  const values = typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
    ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
    : [headers.get('set-cookie') || '']
  const cookies: Record<string, string> = {}
  for (const value of values) {
    for (const match of value.matchAll(/\b(accessToken|refreshToken)=([^;,\s]+)/g)) cookies[match[1]] = match[2]
  }
  return cookies
}

class ApiSession {
  private cookies: Record<string, string> = {}

  private cookieHeader() {
    return Object.entries(this.cookies).map(([key, value]) => `${key}=${value}`).join('; ')
  }

  async login() {
    const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password }),
    })
    if (!response.ok) throw new Error(`Authentication failed with HTTP ${response.status}`)
    Object.assign(this.cookies, readSetCookies(response.headers))
    if (!this.cookies.accessToken || !this.cookies.refreshToken) {
      throw new Error('Authentication response did not provide access and refresh cookies')
    }
  }

  private async refresh() {
    const response = await fetch(`${apiBaseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: this.cookieHeader() },
    })
    if (!response.ok) throw new Error(`Token refresh failed with HTTP ${response.status}`)
    Object.assign(this.cookies, readSetCookies(response.headers))
  }

  async generate(questionnaire: AiPlanProfile['questionnaire']): Promise<Response> {
    let response = await fetch(`${apiBaseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: this.cookieHeader() },
      body: JSON.stringify(questionnaire),
    })
    if (response.status === 401) {
      await this.refresh()
      response = await fetch(`${apiBaseUrl}/api/plans/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: this.cookieHeader() },
        body: JSON.stringify(questionnaire),
      })
    }
    return response
  }
}

async function execute() {
  if (has('--dry-run')) {
    process.exitCode = dryRun()
    return
  }
  if (!has('--confirm-real-ai')) {
    throw new Error('Real generation is disabled unless --confirm-real-ai is supplied explicitly')
  }
  if (!password) throw new Error('AI_PLAN_TEST_PASSWORD is required')
  const profileFilter = option('--profile')
  const repetitionOption = option('--repetition')
  const repetitionFilter = repetitionOption === undefined ? undefined : Number(repetitionOption)
  if (profileFilter && !profiles.some(profile => profile.profile_id === profileFilter)) {
    throw new Error(`Unknown profile: ${profileFilter}`)
  }
  if (repetitionFilter !== undefined && ![1, 2, 3].includes(repetitionFilter)) {
    throw new Error('--repetition must be 1, 2, or 3')
  }

  const resume = has('--resume')
  const batchId = option('--batch-id') || (resume ? latestBatchId() : undefined) || nextBatchId()
  if (!/^AI-PLAN-BATCH-\d{8}-\d{3}$/.test(batchId)) throw new Error('Invalid batch ID format')
  const batchDir = path.join(evidenceRoot, batchId)
  const manifestFile = path.join(batchDir, 'run-manifest.json')
  let manifest: Manifest
  if (fs.existsSync(manifestFile)) {
    if (!resume) throw new Error(`Batch ${batchId} already exists; use --resume to inspect/continue it`)
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as Manifest
  } else {
    if (resume) throw new Error(`Cannot resume missing batch ${batchId}`)
    fs.mkdirSync(batchDir, { recursive: false })
    manifest = createManifest(batchId)
    atomicWrite(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
    atomicWrite(path.join(batchDir, 'batch-metadata.json'), `${JSON.stringify({
      batch_id: batchId,
      created_at: manifest.created_at,
      tested_commit: gitValue(['rev-parse', 'HEAD']),
      knowledge_base_git_commit: gitValue(['log', '-1', '--format=%H', '--', 'knowledge-base/training-knowledge.json']),
      environment_id: environmentId,
      api_base_url: apiBaseUrl,
      concurrency: 1,
      repetitions: 3,
      profile_count: profiles.length,
      provider: process.env.AI_PLAN_PROVIDER || 'ollama-compatible',
      model: process.env.LLM_MODEL || 'llama3.1:8b',
      llm_base_url: sanitizeUrl(process.env.LLM_BASE_URL || 'http://10.10.248.41'),
      timeout_seconds: Number(process.env.LLM_TIMEOUT || 30),
      max_retries: Number(process.env.LLM_MAX_RETRIES || 3),
      temperature: 0.7,
      top_p: 0.9,
      num_predict: 4000,
      stream: false,
      output_format: 'json',
      prompt_version: sha256File(promptFile),
      knowledge_base_version: sha256File(knowledgeFile),
      node_version: process.version,
    }, null, 2)}\n`)
  }

  const selected = manifest.runs.filter(run =>
    (!profileFilter || run.profile_id === profileFilter)
    && (repetitionFilter === undefined || run.repetition === repetitionFilter)
  )
  const pending = selected.filter(run => !evidenceComplete(batchDir, run))
  const completed = selected.length - pending.length
  console.log(`Batch ${batchId}: selected=${selected.length}, complete=${completed}, pending=${pending.length}`)
  if (!pending.length) {
    writeSummary(batchDir, manifest)
    return
  }

  const session = new ApiSession()
  await session.login()
  for (const run of pending) {
    if (run.status !== 'PENDING') run.status = 'PENDING'
    const profile = profiles.find(item => item.profile_id === run.profile_id)!
    const directory = path.join(batchDir, run.evidence_path)
    if (fs.existsSync(directory)) {
      const archived = `${directory}.incomplete-${Date.now()}`
      fs.renameSync(directory, archived)
      console.log(`WARNING archived incomplete evidence to ${path.basename(archived)}`)
    }
    fs.mkdirSync(directory, { recursive: false })
    atomicWrite(path.join(directory, 'request.json'), `${JSON.stringify({
      batch_id: batchId,
      run_id: run.run_id,
      profile_id: run.profile_id,
      repetition: run.repetition,
      questionnaire: profile.questionnaire,
    }, null, 2)}\n`)
    const started = Date.now()
    let status: RunStatus = 'INCONCLUSIVE'
    let httpStatus: number | null = null
    let validation = validateGeneratedPlan(null, profile.expected.training_days)
    let technicalError = ''
    try {
      const response = await session.generate(profile.questionnaire)
      httpStatus = response.status
      const raw = await response.text()
      if (!response.ok) {
        status = response.status === 408 || response.status === 504 ? 'TIMEOUT' : 'FAILED'
        technicalError = `HTTP ${response.status}: ${raw}`
        atomicWrite(path.join(directory, 'error.txt'), `${technicalError}\n`)
      } else {
        try {
          const parsed = JSON.parse(raw) as unknown
          atomicWrite(path.join(directory, 'response.json'), `${JSON.stringify(parsed, null, 2)}\n`)
          validation = validateGeneratedPlan(parsed, profile.expected.training_days)
          status = 'SUCCESS'
        } catch {
          atomicWrite(path.join(directory, 'response.txt'), raw)
          status = 'INCONCLUSIVE'
          technicalError = 'Successful HTTP response was not valid JSON'
          atomicWrite(path.join(directory, 'error.txt'), `${technicalError}\n`)
        }
      }
    } catch (error) {
      technicalError = error instanceof Error ? error.message : String(error)
      status = /timed out|timeout|aborted/i.test(technicalError) ? 'TIMEOUT' : 'FAILED'
      atomicWrite(path.join(directory, 'error.txt'), `${technicalError}\n`)
    }
    const duration = Date.now() - started
    atomicWrite(path.join(directory, 'metadata.json'), `${JSON.stringify({
      batch_id: batchId,
      run_id: run.run_id,
      profile_id: run.profile_id,
      repetition: run.repetition,
      timestamp: new Date().toISOString(),
      tested_commit: gitValue(['rev-parse', 'HEAD']),
      environment_id: environmentId,
      api_base_url: apiBaseUrl,
      http_status: httpStatus,
      generation_time_ms: duration,
      generation_status: status,
      runner_generation_requests: 1,
      internal_llm_attempts: null,
      correction_performed: null,
      technical_error: technicalError || null,
    }, null, 2)}\n`)
    atomicWrite(path.join(directory, 'validation.json'), `${JSON.stringify(validation, null, 2)}\n`)
    run.status = status
    atomicWrite(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`${status} ${run.run_id} ${run.profile_id} repetition ${run.repetition} (${duration}ms)`)
  }
  writeSummary(batchDir, manifest)
}

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return 'invalid-or-unavailable'
  }
}

function writeSummary(batchDir: string, manifest: Manifest) {
  const counts = manifest.runs.reduce<Record<string, number>>((result, run) => {
    result[run.status] = (result[run.status] || 0) + 1
    return result
  }, {})
  atomicWrite(path.join(batchDir, 'batch-summary.json'), `${JSON.stringify({
    batch_id: manifest.batch_id,
    updated_at: new Date().toISOString(),
    expected_runs: manifest.runs.length,
    counts,
  }, null, 2)}\n`)
  console.log(`Summary: ${JSON.stringify(counts)}`)
}

execute().catch(error => {
  console.error(`FAIL ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})
