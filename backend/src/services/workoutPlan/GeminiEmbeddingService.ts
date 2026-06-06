class GeminiEmbeddingService {
  private getApiKey(): string {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY environment variable is required for embeddings')
    return process.env.GROQ_API_KEY
  }

  async getEmbeddings(_text: string): Promise<number[]> {
    this.getApiKey()
    return [0.1, 0.2, 0.3]
  }

  calculateSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0)
    const norm1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0))
    const norm2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0))
    return dotProduct / (norm1 * norm2)
  }
}

export default new GeminiEmbeddingService()
