import mongoose, { Schema, Document } from 'mongoose'

export type ExerciseDocType = 'exercise' | 'knowledge'

export interface IExerciseDoc extends Document {
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
  embedding: number[]
  embeddingModel: string
  textHash: string
  updatedAt: Date
}

const exerciseDocSchema = new Schema<IExerciseDoc>(
  {
    sourceId: { type: String, required: true, unique: true, index: true },
    docType: { type: String, required: true, enum: ['exercise', 'knowledge'], index: true },
    name: { type: String, required: true },
    // The exact string that was embedded. Kept so ingestion can detect drift.
    text: { type: String, required: true },
    equipment: { type: String, index: true },
    level: { type: String, index: true },
    primaryMuscles: { type: [String], default: [], index: true },
    secondaryMuscles: { type: [String], default: [] },
    category: String,
    mechanic: String,
    force: String,
    instructions: { type: [String], default: [] },
    embedding: { type: [Number], required: true },
    embeddingModel: { type: String, required: true },
    textHash: { type: String, required: true },
  },
  { timestamps: true }
)

export const ExerciseDoc = mongoose.model<IExerciseDoc>('ExerciseDoc', exerciseDocSchema)
