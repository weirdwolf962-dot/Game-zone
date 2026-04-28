// src/lib/wordgen.js
const POLLINATIONS_KEY = 'pk_your_key_here'
const MODEL = 'gemini-search'

// Large pools per difficulty — AI is last resort, these run first for reliability
const WORD_POOLS = {
  easy: [
    {normal:'Lion',spy:'Tiger'},{normal:'Rain',spy:'Snow'},{normal:'Ship',spy:'Boat'},
    {normal:'Pen',spy:'Pencil'},{normal:'Shoe',spy:'Sandal'},{normal:'Milk',spy:'Juice'},
    {normal:'Train',spy:'Bus'},{normal:'Sofa',spy:'Chair'},{normal:'Lamp',spy:'Torch'},
    {normal:'Bread',spy:'Cake'},{normal:'River',spy:'Lake'},{normal:'Fork',spy:'Spoon'},
    {normal:'Hat',spy:'Cap'},{normal:'Shirt',spy:'Jacket'},{normal:'Dog',spy:'Wolf'},
    {normal:'Fish',spy:'Frog'},{normal:'Drum',spy:'Guitar'},{normal:'Rose',spy:'Tulip'},
  ],
  medium: [
    {normal:'Beach',spy:'Desert'},{normal:'Coffee',spy:'Tea'},{normal:'Cinema',spy:'Theatre'},
    {normal:'Rocket',spy:'Missile'},{normal:'Nurse',spy:'Doctor'},{normal:'Hotel',spy:'Motel'},
    {normal:'Skiing',spy:'Snowboarding'},{normal:'Yoga',spy:'Pilates'},{normal:'Sushi',spy:'Sashimi'},
    {normal:'Podcast',spy:'Radio'},{normal:'Telescope',spy:'Microscope'},{normal:'Violin',spy:'Cello'},
    {normal:'Mosque',spy:'Temple'},{normal:'Senator',spy:'Governor'},{normal:'Jaguar',spy:'Leopard'},
    {normal:'Espresso',spy:'Americano'},{normal:'Kayak',spy:'Canoe'},{normal:'Architect',spy:'Engineer'},
  ],
  hard: [
    {normal:'Latte',spy:'Cappuccino'},{normal:'Skateboard',spy:'Surfboard'},
    {normal:'Crocodile',spy:'Alligator'},{normal:'Cement',spy:'Concrete'},
    {normal:'Visa',spy:'Mastercard'},{normal:'Mandarin',spy:'Cantonese'},
    {normal:'Stalactite',spy:'Stalagmite'},{normal:'Burrito',spy:'Enchilada'},
    {normal:'Synthesizer',spy:'Keyboard'},{normal:'Screenplay',spy:'Script'},
    {normal:'Asteroid',spy:'Meteor'},{normal:'Sunni',spy:'Shia'},
    {normal:'Bourbon',spy:'Whiskey'},{normal:'Llama',spy:'Alpaca'},
    {normal:'Barrister',spy:'Solicitor'},{normal:'Typhoon',spy:'Hurricane'},
  ]
}

const usedPairs = new Set()

function getPoolWord(difficulty) {
  const pool = WORD_POOLS[difficulty]
  const available = pool.filter(p => !usedPairs.has(`${p.normal}|${p.spy}`))
  const list = available.length > 0 ? available : pool // reset if all used
  const pick = list[Math.floor(Math.random() * list.length)]
  usedPairs.add(`${pick.normal}|${pick.spy}`)
  if (usedPairs.size > 40) usedPairs.clear()
  return pick
}

export async function generateWords(difficulty = 'medium') {
  const ts = Date.now()
  const rnd = Math.floor(Math.random() * 999983)

  try {
    const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${POLLINATIONS_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        private: true,
        seed: rnd,
        temperature: 1.3,
        messages: [
          {
            role: 'system',
            content: `You are a creative word generator. Session: ${ts}. Always produce DIFFERENT words. Never repeat previous pairs. Respond ONLY with raw JSON.`
          },
          {
            role: 'user',
            content: `Unique token ${ts}${rnd}. Generate ONE new word pair for difficulty="${difficulty}" spy game. Rules: normal players share one word, spy gets a different but related word. ${difficulty === 'easy' ? 'Words should be clearly different.' : difficulty === 'medium' ? 'Same category, somewhat similar.' : 'Very closely related, hard to distinguish.'} Forbidden words: alarm, clock, watch, timer. Format: {"normal":"WORD","spy":"WORD"}`
          }
        ],
      })
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content || ''
    const cleaned = raw.replace(/```json|```/gi, '').trim()
    const match = cleaned.match(/\{[\s\S]*?"normal"[\s\S]*?"spy"[\s\S]*?\}/)
    if (!match) throw new Error('No JSON')

    const parsed = JSON.parse(match[0])
    if (!parsed.normal || !parsed.spy) throw new Error('Missing fields')

    // Reject if it keeps returning alarm/clock
    const banned = ['alarm','clock','watch','timer']
    if (banned.includes(parsed.normal.toLowerCase()) || banned.includes(parsed.spy.toLowerCase())) {
      throw new Error('Banned word returned')
    }

    const key = `${parsed.normal}|${parsed.spy}`
    if (usedPairs.has(key)) throw new Error('Repeat detected')
    usedPairs.add(key)

    console.log(`✅ AI Words [${difficulty}]:`, parsed)
    return { normal: parsed.normal, spy: parsed.spy }

  } catch (err) {
    console.warn('⚠️ Using pool word:', err.message)
    return getPoolWord(difficulty)
  }
}
