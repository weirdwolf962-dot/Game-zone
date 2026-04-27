// src/lib/wordgen.js
// Uses Pollinations AI to generate spy game words per difficulty

const DIFFICULTY_PROMPTS = {
  easy: `Give me a pair of very simple, common words suitable for a spy game. 
    Normal players get word A, the spy gets word B. 
    Words should be related but clearly different (e.g. Cat / Dog, Apple / Orange).
    Respond ONLY with JSON: {"normal": "word1", "spy": "word2"}`,

  medium: `Give me a pair of moderately related words for a spy game. 
    Normal players get the normal word, the spy gets the spy word. 
    Words should be somewhat similar (same category, could confuse people).
    Example: Beach / Desert, Coffee / Tea.
    Respond ONLY with JSON: {"normal": "word1", "spy": "word2"}`,

  hard: `Give me a pair of very closely related, tricky words for a spy game. 
    The spy's word should be almost the same category and hard to distinguish.
    Example: Latte / Cappuccino, Skateboard / Surfboard.
    Respond ONLY with JSON: {"normal": "word1", "spy": "word2"}`
}

export async function generateWords(difficulty = 'medium') {
  try {
    const prompt = encodeURIComponent(DIFFICULTY_PROMPTS[difficulty])
    const url = `https://text.pollinations.ai/${prompt}?model=openai&seed=${Date.now()}&json=true`
    
    const res = await fetch(url)
    const text = await res.text()
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*"normal"[\s\S]*"spy"[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return { normal: parsed.normal, spy: parsed.spy }
    }
    throw new Error('Invalid response format')
  } catch (err) {
    console.error('Word gen failed, using fallback:', err)
    // Fallback word pairs per difficulty
    const fallbacks = {
      easy: [
        { normal: 'Dog', spy: 'Cat' },
        { normal: 'Sun', spy: 'Moon' },
        { normal: 'Apple', spy: 'Orange' },
      ],
      medium: [
        { normal: 'Beach', spy: 'Desert' },
        { normal: 'Coffee', spy: 'Tea' },
        { normal: 'Guitar', spy: 'Violin' },
      ],
      hard: [
        { normal: 'Latte', spy: 'Cappuccino' },
        { normal: 'Skateboard', spy: 'Surfboard' },
        { normal: 'Crocodile', spy: 'Alligator' },
      ]
    }
    const list = fallbacks[difficulty]
    return list[Math.floor(Math.random() * list.length)]
  }
}
