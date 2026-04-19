const BASE_URL = "https://openrouter.ai/api/v1";

export async function callModel({
  model,
  systemPrompt,
  messages,
  temperature = 0.7,
}: {
  model?: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  temperature?: number;
}): Promise<string> {
  const resolvedModel = model ?? process.env.COUNCIL_MODEL ?? "openai/gpt-4o-mini";

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "AI Council",
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}
