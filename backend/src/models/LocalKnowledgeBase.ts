import fs from 'fs'
import path from 'path'

class LocalKnowledgeBase {
  private readonly knowledgeFile: string
  private cache: Record<string, unknown> | null = null

  constructor() {
    this.knowledgeFile = path.join(__dirname, '../../../knowledge-base/training-knowledge.json')
  }

  /** Parsed once and cached — this used to hit the disk on every request. */
  getKnowledge(): Record<string, unknown> {
    if (this.cache) return this.cache

    try {
      const data = fs.readFileSync(this.knowledgeFile, 'utf8')
      this.cache = JSON.parse(data) as Record<string, unknown>
    } catch (error) {
      console.error('Error loading knowledge base:', error)
      this.cache = {}
    }

    return this.cache
  }

  /** Test seam — drops the cached parse. */
  clearCache(): void {
    this.cache = null
  }
}

export default new LocalKnowledgeBase()
