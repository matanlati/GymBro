const DEFAULT_BASE_URL = 'http://10.10.248.41'
const DEFAULT_USERNAME = 'student1'
const DEFAULT_PASSWORD = 'pass123'
const DEFAULT_MODEL = 'all-minilm'
const DEFAULT_DIM = 384
const DEFAULT_TIMEOUT_SECONDS = 30
const DEFAULT_MAX_RETRIES = 3
const BATCH_SIZE = 64

interface EmbedResponse {
  embeddings?: number[][]
  error?: string
}

class EmbeddingService {
  getConfig() {
    const timeoutSeconds = Number(process.env.LLM_TIMEOUT || DEFAULT_TIMEOUT_SECONDS)
    const maxRetries = Number(process.env.LLM_MAX_RETRIES || DEFAULT_MAX_RETRIES)
    const dim = Number(process.env.EMBEDDING_DIM || DEFAULT_DIM)

    return {
      baseUrl: (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
      username: process.env.LLM_USERNAME || DEFAULT_USERNAME,
      password: process.env.LLM_PASSWORD || DEFAULT_PASSWORD,
      model: process.env.EMBEDDING_MODEL || DEFAULT_MODEL,
      dim: Number.isInteger(dim) && dim > 0 ? dim : DEFAULT_DIM,
      timeoutMs: Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
        ? timeoutSeconds * 1000
        : DEFAULT_TIMEOUT_SECONDS * 1000,
      maxRetries: Number.isInteger(maxRetries) && maxRetries > 0
        ? maxRetries
        : DEFAULT_MAX_RETRIES,
    }
  }

  /**
   * Embeds texts in batches. Throws on failure — callers that must degrade
   * gracefully (retrieval at request time) are responsible for catching.
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return []
    const config = this.getConfig()
    const vectors: number[][] = []

    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      const batch = texts.slice(start, start + BATCH_SIZE)
      vectors.push(...(await this.embedBatch(batch, config)))
    }

    return vectors
  }

  async embedOne(text: string): Promise<number[]> {
    const [vector] = await this.embed([text])
    return vector
  }

  private async embedBatch(
    batch: string[],
    config: ReturnType<EmbeddingService['getConfig']>
  ): Promise<number[][]> {
    const authorization = Buffer.from(`${config.username}:${config.password}`).toString('base64')
    let lastError: unknown

    for (let attempt = 1; attempt <= config.maxRetries; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
      try {
        const response = await fetch(`${config.baseUrl}/api/embed`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authorization}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: config.model, input: batch }),
          signal: controller.signal,
        })

        const text = await response.text()
        let data: EmbedResponse

        try {
          data = JSON.parse(text) as EmbedResponse
        } catch {
          throw new Error(`Embedding service returned invalid JSON: ${text}`)
        }

        if (!response.ok) {
          throw new Error(`Embedding service request failed (${response.status}): ${data.error || text}`)
        }

        const embeddings = data.embeddings
        if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
          throw new Error(
            `Embedding service returned ${embeddings?.length ?? 0} vectors for ${batch.length} inputs`
          )
        }
        for (const vector of embeddings) {
          if (!Array.isArray(vector) || vector.length !== config.dim) {
            throw new Error(
              `Embedding service returned dimension ${vector?.length ?? 0}, expected ${config.dim}`
            )
          }
        }

        return embeddings
      } catch (error) {
        lastError = error instanceof Error && error.name === 'AbortError'
          ? new Error(`Embedding service request timed out after ${config.timeoutMs / 1000}s`)
          : error

        if (lastError instanceof Error && lastError.message.includes('(401)')) {
          throw lastError
        }

        if (attempt < config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 1000))
        }
      } finally {
        clearTimeout(timeout)
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Embedding service request failed')
  }
}

export default new EmbeddingService()
