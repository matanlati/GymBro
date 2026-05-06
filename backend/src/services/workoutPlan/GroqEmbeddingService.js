class GroqEmbeddingService {
  getApiKey() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is required for Groq embeddings')
    }
    return process.env.GROQ_API_KEY
  }

  async getEmbeddings(text) {
    // Placeholder for future Groq embeddings integration.
    // This POC currently uses local knowledge retrieval with keyword matching.
    return [0.1, 0.2, 0.3]
  }

  async calculateSimilarity(vec1, vec2) {
    const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0)
    const norm1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0))
    const norm2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0))
    return dotProduct / (norm1 * norm2)
  }
}

module.exports = new GroqEmbeddingService()