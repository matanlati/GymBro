const API_URL = 'https://api.groq.com/v1/chat/completions'
const DEFAULT_MODEL = 'llama3-8b-8192'

class GeminiAiService {
  private getApiKey(): string {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY environment variable is required for AI generation')
    return apiKey
  }

  private getModel(): string {
    return process.env.GROQ_MODEL || DEFAULT_MODEL
  }

  async generateResponse(prompt: string): Promise<string> {
    const apiKey = this.getApiKey()
    const model = this.getModel()

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_output_tokens: 1200,
      }),
    })

    const text = await response.text()
    console.error('Gemini response status:', response.status, response.statusText)
    console.error('Gemini response body:', text)

    let data: Record<string, unknown>
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`API returned invalid JSON: ${text}`)
    }

    if (!response.ok) {
      const err = data.error as Record<string, unknown> | undefined
      throw new Error(`API request failed: ${(err?.message as string) || JSON.stringify(data)}`)
    }

    const choices = data.choices as Array<Record<string, unknown>> | undefined
    const candidate =
      (choices?.[0]?.message as Record<string, unknown> | undefined)?.content as string ||
      (choices?.[0]?.content as string) ||
      (data.text as string) ||
      (data.result as string)

    if (!candidate) throw new Error('API returned an unexpected response format')
    return candidate
  }
}

export default new GeminiAiService()
