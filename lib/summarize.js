const MODEL = 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are an OSINT research assistant. You are given raw web
search results (title, url, snippet) for a query about a person, username, or
entity. Your job is to organize these into a structured, skimmable summary.

Rules:
- Only use information present in the provided results. Never invent facts.
- Group findings into categories where they fit: "Professional / Employment",
  "Social Media Presence", "Public Records / Mentions", "Security-Relevant"
  (data breaches, exposed credentials, domains), and "Other".
- For each finding, include a one-sentence summary and a confidence label:
  "high" (multiple corroborating results or clearly definitive), "medium"
  (a single plausible result), or "low" (ambiguous, could refer to a
  different person/entity with the same name).
- If results seem to describe more than one distinct person/entity sharing
  a name, note that explicitly rather than merging them.
- Do not include highly sensitive personal data (home address, phone number,
  exact real-time location) even if present in the snippets — reference that
  such information appears in a source without repeating the raw value.
- Respond ONLY with valid JSON, no markdown fences, no preamble, matching
  this shape:
{
  "query": string,
  "ambiguity_note": string | null,
  "categories": [
    {
      "name": string,
      "findings": [
        { "summary": string, "confidence": "high" | "medium" | "low", "source_url": string }
      ]
    }
  ]
}`;

export async function summarize(query, results) {
  if (!results || results.length === 0) {
    return {
      query,
      ambiguity_note: null,
      categories: [],
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in the environment');
  }

  const resultsBlock = results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet || '(none)'}`
    )
    .join('\n\n');

  const res = await fetch(`${ENDPOINT}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: `Query: ${query}\n\nRaw results:\n\n${resultsBlock}` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';

  try {
    return JSON.parse(raw);
  } catch (err) {
    const cleaned = raw.replace(/^```json\s*|```$/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new Error(
        `Failed to parse summarization response as JSON: ${err.message}`
      );
    }
  }
}
