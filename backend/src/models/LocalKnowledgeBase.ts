import fs from 'fs'
import path from 'path'

class LocalKnowledgeBase {
  private readonly knowledgeFile: string

  constructor() {
    this.knowledgeFile = path.join(__dirname, '../../../knowledge-base/training-knowledge.json')
  }

  getKnowledge(): Record<string, unknown> {
    try {
      const data = fs.readFileSync(this.knowledgeFile, 'utf8')
      return JSON.parse(data) as Record<string, unknown>
    } catch (error) {
      console.error('Error loading knowledge base:', error)
      return {}
    }
  }
}

export default new LocalKnowledgeBase()
