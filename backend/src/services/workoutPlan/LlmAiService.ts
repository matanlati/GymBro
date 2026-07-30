const DEFAULT_BASE_URL = 'http://10.10.248.41'
const DEFAULT_USERNAME = 'student1'
const DEFAULT_PASSWORD = 'pass123'
const DEFAULT_MODEL = 'llama3.1:8b'
const DEFAULT_TIMEOUT_SECONDS = 30
const DEFAULT_MAX_RETRIES = 3

interface LlmGenerateResponse {
  response?: string
  error?: string
}

class LlmAiService {
  private getConfig() {
    const timeoutSeconds = Number(process.env.LLM_TIMEOUT || DEFAULT_TIMEOUT_SECONDS)
    const maxRetries = Number(process.env.LLM_MAX_RETRIES || DEFAULT_MAX_RETRIES)

    return {
      baseUrl: (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
      username: process.env.LLM_USERNAME || DEFAULT_USERNAME,
      password: process.env.LLM_PASSWORD || DEFAULT_PASSWORD,
      model: process.env.LLM_MODEL || DEFAULT_MODEL,
      timeoutMs: Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
        ? timeoutSeconds * 1000
        : DEFAULT_TIMEOUT_SECONDS * 1000,
      maxRetries: Number.isInteger(maxRetries) && maxRetries > 0
        ? maxRetries
        : DEFAULT_MAX_RETRIES,
    }
  }

  async generateResponse(prompt: string): Promise<string> {
    const config = this.getConfig()
    const authorization = Buffer.from(`${config.username}:${config.password}`).toString('base64')
    let lastError: unknown

    for (let attempt = 1; attempt <= config.maxRetries; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
      try {
        const response = await fetch(`${config.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authorization}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            prompt: prompt.trim(),
            stream: false,
            format: 'json',
            options: {
              temperature: 0.7,
              top_p: 0.9,
              num_predict: 4000,
            },
          }),
          signal: controller.signal,
        })

        const text = await response.text()
        let data: LlmGenerateResponse

        try {
          data = JSON.parse(text) as LlmGenerateResponse
        } catch {
          throw new Error(`LLM service returned invalid JSON: ${text}`)
        }

        if (!response.ok) {
          const error = new Error(`LLM service request failed (${response.status}): ${data.error || text}`)
          if (response.status === 401) throw error
          throw error
        }

        if (!data.response?.trim()) {
          throw new Error('LLM service returned an empty response')
        }

        return data.response.trim()
      } catch (error) {
        lastError = error instanceof Error && error.name === 'AbortError'
          ? new Error(`LLM service request timed out after ${config.timeoutMs / 1000}s`)
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

    throw lastError instanceof Error ? lastError : new Error('LLM service request failed')
  }
}

export default new LlmAiService()
