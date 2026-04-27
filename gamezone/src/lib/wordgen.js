// src/lib/wordgen.js
// Pollinations AI — gen.pollinations.ai/v1/chat/completions

const POLLINATIONS_KEY = 'sk_tG4aWAeMieKVNdVA2GovxRBsTSapq6qy'
const MODEL = 'gemini-search'

const DIFFICULTY_PROMPTS = {
  easy:   `You are a word generator for a spy party game. Give a pair of simple common words. Normal players get word A, spy gets word B. Words should be clearly different (e.g. Cat/Dog, Apple/Orange). Reply ONLY with raw JSON, no markdown: {"normal":"word1","spy":"word2"}`,
  medium: `You are a word generator for a spy party game. Give a pair of moderately related words. Same category but different enough to confuse (e.g. Beach/Desert, Coffee/Tea). Reply ONLY with raw JSON, no markdown: {"normal":"word1","spy":"word2"}`,
  hard:   `You are a word generator for a spy party game. Give a pair of very closely related tricky words, almost indistinguishable (e.g. Latte/Cappuccino, Skateboard/Surfboard). Reply ONLY with raw JSON, no markdown: {"normal":"word1","spy":"word2"}`
}

const FALLBACKS = {
  easy:   [{ normal:'Dog',spy:'Cat' },{ normal:'Sun',spy:'Moon' },{ normal:'Apple',spy:'Orange' },{ normal:'Car',spy:'Bike' }],
  medium: [{ normal:'Beach',spy:'Desert' },{ normal:'Coffee',spy:'Tea' },{ normal:'Guitar',spy:'Violin' },{ normal:'Laptop',spy:'Tablet' }],
  hard:   [{ normal:'Latte',spy:'Cappuccino' },{ normal:'Skateboard',spy:'Surfboard' },{ normal:'Crocodile',spy:'Alligator' },{ normal:'Cement',spy:'Concrete' }]
}

export async function generateWords(difficulty = 'medium') {
  try {
    const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${POLLINATIONS_KEY}`,
      },
      body: JSON.stringify({
        model:    MODEL,
        private:  true,
        messages: [
          { role: 'system', content: 'You are a helpful word generator for a party game. Always respond with raw JSON only.' },
          { role: 'user',   content: DIFFICULTY_PROMPTS[difficulty] }
        ],
      })
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    const raw  = data?.choices?.[0]?.message?.content || ''
    const cleaned = raw.replace(/```json|```/gi, '').trim()
    const match   = cleaned.match(/\{[\s\S]*?"normal"[\s\S]*?"spy"[\s\S]*?\}/)
    if (!match) throw new Error('No JSON in response')

    const parsed = JSON.parse(match[0])
    if (!parsed.normal || !parsed.spy) throw new Error('Missing fields')

    console.log(`✅ Words [${difficulty}]:`, parsed)
    return { normal: parsed.normal, spy: parsed.spy }

  } catch (err) {
    console.warn('⚠️ Pollinations failed, using fallback:', err.message)
    const list = FALLBACKS[difficulty]
    return list[Math.floor(Math.random() * list.length)]
  }
}
