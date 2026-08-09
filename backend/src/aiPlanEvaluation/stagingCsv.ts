import fs from 'fs'
import path from 'path'
import {
  CSV_COLUMNS, ValidationResult, atomicWrite, computeEquipmentAdherence, csvEscape,
  findProjectRoot, readProfiles,
} from './common'

interface ManifestRun {
  run_id: string
  profile_id: string
  repetition: number
  status: string
  evidence_path: string
}

const args = process.argv.slice(2)
const option = (flag: string) => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}
const root = findProjectRoot()
const evidenceRoot = path.join(root, 'test-evidence', 'ai-plans')
const batchId = option('--batch-id')
if (!batchId) throw new Error('--batch-id is required')
const batchDir = path.join(evidenceRoot, batchId)
const output = path.resolve(root, option('--output') || 'ai-plan-results-staging.csv')
const manifest = JSON.parse(
  fs.readFileSync(path.join(batchDir, 'run-manifest.json'), 'utf8')
) as { runs: ManifestRun[] }
const batchMetadata = JSON.parse(
  fs.readFileSync(path.join(batchDir, 'batch-metadata.json'), 'utf8')
) as Record<string, unknown>

if (fs.existsSync(output)) {
  const existingLines = fs.readFileSync(output, 'utf8').trimEnd().split(/\r?\n/)
  if (existingLines.length > 1) {
    throw new Error(`Refusing to overwrite non-empty staging CSV: ${output}`)
  }
  if (existingLines[0] !== CSV_COLUMNS.join(',')) {
    throw new Error(`Refusing to overwrite staging CSV with a different header: ${output}`)
  }
}

const profilesById = new Map(readProfiles(root).map(profile => [profile.profile_id, profile]))

const rows = [CSV_COLUMNS.join(',')]
for (const run of manifest.runs) {
  if (run.status === 'PENDING') continue
  const directory = path.join(batchDir, run.evidence_path)
  const metadataFile = path.join(directory, 'metadata.json')
  const validationFile = path.join(directory, 'validation.json')
  if (!fs.existsSync(metadataFile) || !fs.existsSync(validationFile)) {
    console.warn(`WARNING skipping incomplete evidence for ${run.run_id}`)
    continue
  }
  const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8')) as Record<string, unknown>
  const validation = JSON.parse(fs.readFileSync(validationFile, 'utf8')) as ValidationResult

  // Automated equipment adherence: computable now that a controlled
  // exercise-equipment catalog exists. Blank when the plan is unreadable.
  const responseFile = path.join(directory, 'response.json')
  const expectedEquipment = profilesById.get(run.profile_id)?.expected.equipment ?? []
  let equipmentAdherent: string = ''
  let catalogResolutionRate: string = ''
  if (fs.existsSync(responseFile)) {
    const plan = JSON.parse(fs.readFileSync(responseFile, 'utf8')) as unknown
    const adherence = computeEquipmentAdherence(plan, expectedEquipment, root)
    if (adherence.rate !== null) equipmentAdherent = adherence.rate.toFixed(3)
    if (adherence.resolution_rate !== null) {
      catalogResolutionRate = adherence.resolution_rate.toFixed(3)
    }
  }
  const values: Record<string, unknown> = {
    run_id: run.run_id,
    test_id: `${batchId}-${run.profile_id}-R${run.repetition}`,
    profile_id: run.profile_id,
    repetition: run.repetition,
    provider: batchMetadata.provider,
    model: batchMetadata.model,
    prompt_version: batchMetadata.prompt_version,
    knowledge_base_version: batchMetadata.knowledge_base_version,
    generation_time_ms: metadata.generation_time_ms,
    generation_status: run.status,
    schema_valid: validation.schema_valid,
    expected_days: validation.expected_days,
    generated_days: validation.generated_days,
    days_correct: validation.days_correct,
    equipment_adherent: equipmentAdherent,
    catalog_resolution_rate: catalogResolutionRate,
    constraint_adherent: '',
    evidence_path: path.relative(root, directory).replace(/\\/g, '/'),
  }
  rows.push(CSV_COLUMNS.map(column => csvEscape(values[column] ?? '')).join(','))
}

atomicWrite(output, `${rows.join('\n')}\n`)
console.log(`PASS wrote ${rows.length - 1} objective staging row(s) to ${output}`)
console.log('WARNING all reviewer ratings, subjective defects, and constraint adherence remain blank')
console.log('NOTE equipment_adherent is computed automatically against knowledge-base/exercises.json')
