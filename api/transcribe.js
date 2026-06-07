export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
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
    const { audio, mimeType } = req.body ?? {}
    if (!audio) return res.status(400).json({ error: 'audio is required' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'audio',
              source: {
                type:       'base64',
                media_type: mimeType || 'audio/webm',
                data:       audio,
              },
            },
            {
              type: 'text',
              text: 'Transcribe this audio recording exactly as spoken. It is a voice note from a yacht race — may contain sailing terminology, boat names, sail numbers, competitor names, or race observations. Return only the transcription, no commentary.',
            },
          ],
        }],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' })
    }

    const transcript = data.content?.map(c => c.text || '').join('').trim() || ''
    return res.status(200).json({ transcript })

  } catch (err) {
    console.error('transcribe error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
