import { ExerciseDoc, ExerciseDocType, IExerciseDoc } from '../../models/ExerciseDoc.model'

export interface StoredDoc {
  sourceId: string
  docType: ExerciseDocType
  name: string
  text: string
  equipment: string
  level: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  category: string
  mechanic: string
  instructions: string[]
}

export interface SearchFilter {
  docType?: ExerciseDocType
  /** Keep only docs whose equipment is in this set (lowercased). */
  equipment?: Set<string>
  /** Keep only docs whose level is in this set (lowercased). */
  levels?: Set<string>
  /** Drop docs whose sourceId is in this set. */
  excludeSourceIds?: Set<string>
  /** Keep only docs targeting at least one of these primary muscles. */
  primaryMuscles?: Set<string>
}

export interface ScoredDoc extends StoredDoc {
  score: number
}

/**
 * Cosine similarity between a query vector and a slice of the packed matrix.
 * Vectors are L2-normalized at load time, so this is a plain dot product.
 */
export function cosine(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

class VectorStore {
  private docs: StoredDoc[] = []
  /** Packed, L2-normalized vectors: doc i occupies [i*dim, (i+1)*dim). */
  private matrix: Float32Array = new Float32Array(0)
  private dim = 0
  private loaded = false
  private loading: Promise<void> | null = null

  /** Loads vectors once. Concurrent callers share the same in-flight load. */
  async load(force = false): Promise<void> {
    if (this.loaded && !force) return
    if (this.loading && !force) return this.loading

    this.loading = (async () => {
      const rows = (await ExerciseDoc.find({}).lean()) as unknown as IExerciseDoc[]
      this.dim = rows[0]?.embedding?.length ?? 0
      this.matrix = new Float32Array(rows.length * this.dim)
      this.docs = []

      rows.forEach((row, index) => {
        const embedding = row.embedding || []
        // Normalize once so search() is a dot product.
        let norm = 0
        for (const value of embedding) norm += value * value
        norm = Math.sqrt(norm) || 1
        const offset = index * this.dim
        for (let i = 0; i < this.dim; i += 1) {
          this.matrix[offset + i] = (embedding[i] ?? 0) / norm
        }
        this.docs.push({
          sourceId: row.sourceId,
          docType: row.docType,
          name: row.name,
          text: row.text,
          equipment: (row.equipment || '').toLowerCase(),
          level: (row.level || '').toLowerCase(),
          primaryMuscles: (row.primaryMuscles || []).map(m => m.toLowerCase()),
          secondaryMuscles: (row.secondaryMuscles || []).map(m => m.toLowerCase()),
          category: (row.category || '').toLowerCase(),
          mechanic: (row.mechanic || '').toLowerCase(),
          instructions: row.instructions || [],
        })
      })

      this.loaded = true
    })()

    try {
      await this.loading
    } finally {
      this.loading = null
    }
  }

  /** Test/ingestion seam: populate the cache without touching Mongo. */
  setDocs(docs: StoredDoc[], embeddings: number[][]): void {
    this.dim = embeddings[0]?.length ?? 0
    this.matrix = new Float32Array(docs.length * this.dim)
    embeddings.forEach((embedding, index) => {
      let norm = 0
      for (const value of embedding) norm += value * value
      norm = Math.sqrt(norm) || 1
      const offset = index * this.dim
      for (let i = 0; i < this.dim; i += 1) {
        this.matrix[offset + i] = (embedding[i] ?? 0) / norm
      }
    })
    this.docs = docs
    this.loaded = true
  }

  reset(): void {
    this.docs = []
    this.matrix = new Float32Array(0)
    this.dim = 0
    this.loaded = false
  }

  size(): number {
    return this.docs.length
  }

  isLoaded(): boolean {
    return this.loaded
  }

  private passes(doc: StoredDoc, filter: SearchFilter): boolean {
    if (filter.docType && doc.docType !== filter.docType) return false
    if (filter.excludeSourceIds?.has(doc.sourceId)) return false
    if (filter.equipment && !filter.equipment.has(doc.equipment)) return false
    if (filter.levels && !filter.levels.has(doc.level)) return false
    if (filter.primaryMuscles && !doc.primaryMuscles.some(m => filter.primaryMuscles!.has(m))) {
      return false
    }
    return true
  }

  /** Hard-filters first, then ranks the survivors by cosine similarity. */
  search(queryVector: number[], filter: SearchFilter = {}, k = 5): ScoredDoc[] {
    if (!this.docs.length || !this.dim) return []

    let queryNorm = 0
    for (const value of queryVector) queryNorm += value * value
    queryNorm = Math.sqrt(queryNorm) || 1

    const scored: ScoredDoc[] = []
    for (let index = 0; index < this.docs.length; index += 1) {
      const doc = this.docs[index]
      if (!this.passes(doc, filter)) continue

      const offset = index * this.dim
      let dot = 0
      for (let i = 0; i < this.dim; i += 1) {
        dot += this.matrix[offset + i] * ((queryVector[i] ?? 0) / queryNorm)
      }
      scored.push({ ...doc, score: dot })
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, k)
  }

  /** Number of docs surviving a filter, without scoring. Used for diagnostics. */
  countMatching(filter: SearchFilter): number {
    return this.docs.reduce((total, doc) => total + (this.passes(doc, filter) ? 1 : 0), 0)
  }
}

export default new VectorStore()
