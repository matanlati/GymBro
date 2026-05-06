const API_URL = 'https://api.groq.com/v1/chat/completions'
const DEFAULT_MODEL = 'llama3-8b-8192'

class GroqAiService {
  getApiKey() {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is required for Groq AI generation')
    }
    return apiKey
  }

  getModel() {
    return process.env.GROQ_MODEL || DEFAULT_MODEL
  }

  async generateResponse(prompt) {
    const apiKey = this.getApiKey()
    const model = this.getModel()

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_output_tokens: 1200
      })
    })

    const text = await response.text()
    console.error('Groq response status:', response.status, response.statusText)
    console.error('Groq response body:', text)

    let data
    try {
      data = JSON.parse(text)
    } catch (parseError) {
      throw new Error(`Groq API returned invalid JSON: ${text}`)
    }

    if (!response.ok) {
      const message = data.error?.message || JSON.stringify(data)
      throw new Error(`Groq API request failed: ${message}`)
    }

    const candidate =
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.content ||
      data.output?.[0]?.content ||
      data.text ||
      data.result

    if (!candidate) {
      throw new Error('Groq API returned an unexpected response format')
    }

    return candidate
  }
}

module.exports = new GroqAiService()