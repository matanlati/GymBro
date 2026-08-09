import EmbeddingService from '../src/services/workoutPlan/EmbeddingService'

const originalFetch = global.fetch
const originalEnv = { ...process.env }

const mockFetch = (impl: jest.Mock) => {
  global.fetch = impl as unknown as typeof fetch
  return impl
}

const okResponse = (embeddings: number[][]) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ embeddings }),
})

const vector = (fill: number) => new Array(384).fill(fill)

describe('EmbeddingService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, LLM_MAX_RETRIES: '2', LLM_TIMEOUT: '5' }
  })

  afterAll(() => {
    global.fetch = originalFetch
    process.env = originalEnv
  })

  it('returns an empty array without calling the endpoint for no input', async () => {
    const fetchMock = mockFetch(jest.fn())
    expect(await EmbeddingService.embed([])).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts to /api/embed with Basic auth and the configured model', async () => {
    const fetchMock = mockFetch(jest.fn().mockResolvedValue(okResponse([vector(0.1)])))
    process.env.LLM_BASE_URL = 'http://llm.test'
    process.env.LLM_USERNAME = 'user'
    process.env.LLM_PASSWORD = 'pass'
    process.env.EMBEDDING_MODEL = 'all-minilm'

    await EmbeddingService.embed(['hello'])

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://llm.test/api/embed')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('user:pass').toString('base64')}`
    )
    expect(JSON.parse(init.body)).toEqual({ model: 'all-minilm', input: ['hello'] })
  })

  it('splits input into batches of 64', async () => {
    const fetchMock = mockFetch(
      jest.fn().mockImplementation(async (_url: string, init: { body: string }) => {
        const { input } = JSON.parse(init.body)
        return okResponse(input.map(() => vector(0.2)))
      })
    )

    const result = await EmbeddingService.embed(new Array(150).fill('text'))

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input).toHaveLength(64)
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).input).toHaveLength(22)
    expect(result).toHaveLength(150)
  })

  it('rejects a dimension mismatch', async () => {
    mockFetch(jest.fn().mockResolvedValue(okResponse([[1, 2, 3]])))
    await expect(EmbeddingService.embed(['x'])).rejects.toThrow(/dimension 3, expected 384/)
  })

  it('rejects a vector-count mismatch', async () => {
    mockFetch(jest.fn().mockResolvedValue(okResponse([vector(0.1)])))
    await expect(EmbeddingService.embed(['a', 'b'])).rejects.toThrow(/returned 1 vectors for 2 inputs/)
  })

  it('throws immediately on 401 without retrying', async () => {
    const fetchMock = mockFetch(
      jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: 'unauthorized' }),
      })
    )

    await expect(EmbeddingService.embed(['x'])).rejects.toThrow(/401/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries then surfaces the error when the endpoint keeps failing', async () => {
    const fetchMock = mockFetch(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    await expect(EmbeddingService.embed(['x'])).rejects.toThrow('ECONNREFUSED')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('embedOne returns a single vector', async () => {
    mockFetch(jest.fn().mockResolvedValue(okResponse([vector(0.5)])))
    const result = await EmbeddingService.embedOne('hello')
    expect(result).toHaveLength(384)
  })
})
