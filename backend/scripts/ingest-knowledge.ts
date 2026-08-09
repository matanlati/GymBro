/**
 * One-off/idempotent ingestion of the RAG corpus.
 *
 *   npm run rag:ingest
 *
 * Loads both corpora (free-exercise-db + the hand-written training knowledge),
 * builds one embedding text per document, and upserts keyed on `sourceId`.
 * Documents are re-embedded only when their text or the embedding model changes.
 */
import 'dotenv/config'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import { ExerciseDoc, ExerciseDocType } from '../src/models/ExerciseDoc.model'
import EmbeddingService from '../src/services/workoutPlan/EmbeddingService'

const KNOWLEDGE_DIR = path.join(__dirname, '../../knowledge-base')
const EXERCISES_FILE = path.join(KNOWLEDGE_DIR, 'exercises.json')
const TRAINING_FILE = path.join(KNOWLEDGE_DIR, 'training-knowledge.json')

interface RawExercise {
  id?: string
  name: string
  force?: string | null
  level?: string
  mechanic?: string | null
  equipment?: string | null
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
  instructions?: string[]
  category?: string
}

interface PendingDoc {
  sourceId: string
  docType: ExerciseDocType
  name: string
  text: string
  equipment?: string
  level?: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  category?: string
  mechanic?: string
  force?: string
  instructions: string[]
}

const hash = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex')

function buildExerciseDocs(): PendingDoc[] {
  const raw = JSON.parse(fs.readFileSync(EXERCISES_FILE, 'utf8')) as RawExercise[]

  return raw.map(exercise => {
    const primaryMuscles = exercise.primaryMuscles || []
    const text = [
      `${exercise.name}.`,
      `${exercise.category || 'strength'} exercise targeting ${primaryMuscles.join(', ') || 'general'}.`,
      `Equipment: ${exercise.equipment || 'none'}.`,
      `Level: ${exercise.level || 'beginner'}.`,
      exercise.instructions?.[0] || '',
    ].join(' ').trim()

    return {
      sourceId: `exercise:${exercise.id || exercise.name}`,
      docType: 'exercise' as const,
      name: exercise.name,
      text,
      equipment: exercise.equipment || undefined,
      level: exercise.level,
      primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles || [],
      category: exercise.category,
      mechanic: exercise.mechanic || undefined,
      force: exercise.force || undefined,
      instructions: exercise.instructions || [],
    }
  })
}

/**
 * Flattens training-knowledge.json. Unlike the old substring retriever, this
 * reaches `injuryLimitations` (string values) and `examples` (object values),
 * which were structurally unreachable before.
 */
function buildKnowledgeDocs(): PendingDoc[] {
  const raw = JSON.parse(fs.readFileSync(TRAINING_FILE, 'utf8')) as Record<string, unknown>
  const docs: PendingDoc[] = []

  const push = (section: string, key: string, text: string) => {
    if (!text.trim()) return
    docs.push({
      sourceId: `knowledge:${section}:${key}`,
      docType: 'knowledge',
      name: `${section}/${key}`,
      text,
      primaryMuscles: [],
      secondaryMuscles: [],
      instructions: [],
    })
  }

  for (const [section, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        push(section, String(index), typeof item === 'string' ? item : JSON.stringify(item))
      })
    } else if (value && typeof value === 'object') {
      for (const [key, subValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof subValue === 'string') {
          // injuryLimitations — previously unreachable.
          push(section, key, `${key}: ${subValue}`)
        } else if (Array.isArray(subValue)) {
          const rendered = subValue
            .map(item => (typeof item === 'string' ? item : JSON.stringify(item)))
            .join(' ')
          push(section, key, `${key}: ${rendered}`)
        }
      }
    }
  }

  return docs
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')

  const { model: embeddingModel, dim } = EmbeddingService.getConfig()
  const pending = [...buildExerciseDocs(), ...buildKnowledgeDocs()]
  console.log(`Corpus: ${pending.length} documents (model=${embeddingModel}, dim=${dim})`)

  await mongoose.connect(uri)

  const existing = await ExerciseDoc.find({}, { sourceId: 1, textHash: 1, embeddingModel: 1 }).lean()
  const existingBySourceId = new Map(
    existing.map(doc => [doc.sourceId, doc as unknown as { textHash: string; embeddingModel: string }])
  )

  const stale = pending.filter(doc => {
    const previous = existingBySourceId.get(doc.sourceId)
    return !previous
      || previous.textHash !== hash(doc.text)
      || previous.embeddingModel !== embeddingModel
  })

  console.log(`${pending.length - stale.length} up to date, ${stale.length} to (re-)embed`)

  if (stale.length) {
    const started = Date.now()
    const vectors = await EmbeddingService.embed(stale.map(doc => doc.text))
    console.log(`Embedded ${vectors.length} documents in ${((Date.now() - started) / 1000).toFixed(1)}s`)

    const operations = stale.map((doc, index) => ({
      updateOne: {
        filter: { sourceId: doc.sourceId },
        update: {
          $set: {
            ...doc,
            embedding: vectors[index],
            embeddingModel,
            textHash: hash(doc.text),
          },
        },
        upsert: true,
      },
    }))

    for (let start = 0; start < operations.length; start += 200) {
      await ExerciseDoc.bulkWrite(operations.slice(start, start + 200))
    }
  }

  // Drop documents that no longer exist in the source corpora.
  const currentIds = pending.map(doc => doc.sourceId)
  const removed = await ExerciseDoc.deleteMany({ sourceId: { $nin: currentIds } })
  if (removed.deletedCount) console.log(`Removed ${removed.deletedCount} stale documents`)

  const total = await ExerciseDoc.countDocuments()
  const exercises = await ExerciseDoc.countDocuments({ docType: 'exercise' })
  const knowledge = await ExerciseDoc.countDocuments({ docType: 'knowledge' })
  const wrongDim = await ExerciseDoc.countDocuments({ embedding: { $size: dim } })

  console.log(`\nIngestion complete: ${total} docs (${exercises} exercise, ${knowledge} knowledge)`)
  console.log(`Documents with embedding.length === ${dim}: ${wrongDim}/${total}`)

  await mongoose.disconnect()

  if (wrongDim !== total) {
    throw new Error(`${total - wrongDim} documents have an unexpected embedding dimension`)
  }
}

main().catch(error => {
  console.error('Ingestion failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
