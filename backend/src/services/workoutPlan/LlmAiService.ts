const DEFAULT_BASE_URL = 'http://10.10.248.41'
const DEFAULT_MODEL = 'llama3.1:8b'
const DEFAULT_TIMEOUT_MS = 30_000

interface LlmGenerateResponse {
  response?: string
  error?: string
}

class LlmAiService {
  private getConfig() {
    const username = process.env.LLM_USERNAME
    const password = process.env.LLM_PASSWORD

    if (!username || !password) {
      throw new Error('LLM_USERNAME and LLM_PASSWORD environment variables are required for AI generation')
    }

    return {
      baseUrl: (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
      username,
      password,
      model: process.env.LLM_MODEL || DEFAULT_MODEL,
      timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    }
  }

  async generateResponse(prompt: string): Promise<string> {
    const config = this.getConfig()
    const authorization = Buffer.from(`${config.username}:${config.password}`).toString('base64')
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
        throw new Error(`LLM service request failed (${response.status}): ${data.error || text}`)
      }

      if (!data.response?.trim()) {
        throw new Error('LLM service returned an empty response')
      }

      return data.response.trim()
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`LLM service request timed out after ${config.timeoutMs}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
}

export default new LlmAiService()
