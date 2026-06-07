export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // Health check — visit /api/parse-signup in a browser to confirm deployment
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      keyConfigured: !!process.env.ANTHROPIC_API_KEY,
    })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { base64, mediaType } = req.body ?? {}
    if (!base64) return res.status(400).json({ error: 'base64 is required' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server' })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: base64 },
            },
            {
              type: 'text',
              text: 'Parse this sailing race signup sheet. Extract each competitor\'s name, sail number, and class (ILCA 4, ILCA 6, ILCA 7, or Other). Return ONLY a valid JSON array, no markdown or backticks. Format: [{"name":"John Smith","sailNo":"209876","class":"ILCA 7"}]. Use "Unknown" for unreadable fields. Return [] if unreadable.',
            },
          ],
        }],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' })
    }

    const text = data.content?.map(c => c.text || '').join('') || '[]'
    return res.status(200).json({ text })

  } catch (err) {
    console.error('parse-signup error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
