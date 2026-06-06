import LocalKnowledgeBase from '../../models/LocalKnowledgeBase'

class RagRetrieverService {
  async retrieve(query: string): Promise<string[]> {
    const knowledge = LocalKnowledgeBase.getKnowledge()
    const queryLower = query.toLowerCase()
    const relevantChunks: string[] = []

    for (const value of Object.values(knowledge)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.toLowerCase().includes(queryLower)) {
            relevantChunks.push(item)
          } else if (typeof item === 'object' && item !== null) {
            const itemStr = JSON.stringify(item).toLowerCase()
            if (itemStr.includes(queryLower)) relevantChunks.push(JSON.stringify(item))
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const subValue of Object.values(value as Record<string, unknown>)) {
          if (Array.isArray(subValue)) {
            for (const item of subValue) {
              if (typeof item === 'string' && item.toLowerCase().includes(queryLower)) {
                relevantChunks.push(item)
              }
            }
          }
        }
      }
    }

    return relevantChunks.slice(0, 5)
  }
}

export default new RagRetrieverService()
