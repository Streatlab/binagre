interface ItemParsed {
  nombre: string
  cantidad: number
  unidad: string
}

export async function parsearIngredientesConClaude(texto: string): Promise<ItemParsed[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) return []
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: 'Eres un parser de ingredientes de cocina. Recibes texto libre en español con ingredientes y cantidades. Devuelve SOLO un JSON array sin markdown, sin explicación, sin backticks. Formato exacto: [{"nombre":"string","cantidad":number,"unidad":"string"}] Normaliza unidades: gramos→"g", mililitros→"ml", unidades→"ud", litros→"l", kilos→"kg". Si no hay unidad clara, usa "ud".',
        messages: [{ role: 'user', content: texto }],
      }),
    })
    const data = await resp.json()
    const text: string = data.content?.[0]?.text ?? '[]'
    try { return JSON.parse(text) } catch { return [] }
  } catch { return [] }
}
