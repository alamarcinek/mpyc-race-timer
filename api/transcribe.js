export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { rawText } = req.body ?? {}
    if (!rawText) return res.status(400).json({ error: 'rawText is required' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5',
        max_tokens: 512,
        messages: [{
          role:    'user',
          content: `Clean up this voice note transcript from a yacht race. Fix speech recognition errors, correct sailing terminology (boat names, sail numbers, race observations), and format it naturally. Return only the cleaned transcript with no commentary:\n\n${rawText}`,
        }],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' })
    }

    const transcript = data.content?.map(c => c.text || '').join('').trim() || rawText
    return res.status(200).json({ transcript })

  } catch (err) {
    console.error('transcribe error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
