const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
const apiKey = process.env.GROQ_API_KEY
console.log('GROQ_API_KEY present:', Boolean(apiKey))

const API_URL = 'https://api.groq.com/v1/chat/completions'
const MODEL = 'llama3-8b-8192'

async function run() {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: 'Say hello' }],
      temperature: 0.7,
      max_output_tokens: 100
    })
  })
  console.log('status', response.status, response.statusText)
  const text = await response.text()
  console.log('body:', JSON.stringify(text))
  try {
    const data = JSON.parse(text)
    console.log('parsed', data)
  } catch (err) {
    console.error('parse error', err.message)
  }
}

run().catch(err => {
  console.error('error', err)
})