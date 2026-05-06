const EmbeddingService = require('./EmbeddingService')
const LocalKnowledgeBase = require('../../models/LocalKnowledgeBase')

class RagRetrieverService {
  async retrieve(query) {
    // For POC, use simple text search instead of embeddings.
    // In production, use GroqEmbeddingService and vector similarity.

    const knowledge = LocalKnowledgeBase.getKnowledge()
    const queryLower = query.toLowerCase()

    const relevantChunks = []

    // Simple keyword matching
    for (const [key, value] of Object.entries(knowledge)) {
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'string' && item.toLowerCase().includes(queryLower)) {
            relevantChunks.push(item)
          } else if (typeof item === 'object') {
            // For exercise examples
            const itemStr = JSON.stringify(item).toLowerCase()
            if (itemStr.includes(queryLower)) {
              relevantChunks.push(JSON.stringify(item))
            }
          }
        })
      } else if (typeof value === 'object') {
        for (const [subKey, subValue] of Object.entries(value)) {
          if (Array.isArray(subValue)) {
            subValue.forEach(item => {
              if (typeof item === 'string' && item.toLowerCase().includes(queryLower)) {
                relevantChunks.push(item)
              }
            })
          }
        }
      }
    }

    // Return top 5 relevant chunks
    return relevantChunks.slice(0, 5)
  }
}

module.exports = new RagRetrieverService()