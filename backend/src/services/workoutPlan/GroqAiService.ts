const API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama3-8b-8192'

class GroqAiService {
  private getApiKey(): string {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY environment variable is required for Groq AI generation')
    return apiKey
  }

  private getModel(): string {
    return process.env.GROQ_MODEL || DEFAULT_MODEL
  }

  async generateResponse(prompt: string): Promise<string> {
    const apiKey = this.getApiKey()
    const model = this.getModel()

    console.error('Groq prompt preview:', prompt.slice(0, 280))

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    })

    const text = await response.text()
    console.error('Groq response status:', response.status, response.statusText)
    console.error('Groq response body:', text)

    let data: Record<string, unknown>
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`Groq API returned invalid JSON: ${text}`)
    }

    if (!response.ok) {
      const err = data.error as Record<string, unknown> | undefined
      throw new Error(`Groq API request failed: ${(err?.message as string) || JSON.stringify(data)}`)
    }

    const choices = data.choices as Array<Record<string, unknown>> | undefined
    const message = choices?.[0]?.message as Record<string, unknown> | undefined
    const candidate =
      (message?.content as string | undefined) ||
      (choices?.[0]?.content as string | undefined) ||
      (data.text as string | undefined) ||
      (data.result as string | undefined)

    if (!candidate) {
      console.error('Groq response data structure:', JSON.stringify(data, null, 2))
      throw new Error('Groq API returned an unexpected response format')
    }

    let cleaned = candidate.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    console.error('Cleaned Groq response:', cleaned.slice(0, 3500))
    return cleaned
  }
}

export default new GroqAiService()
