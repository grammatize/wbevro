const ENDPOINT = 'https://api.tavily.com/search';

export async function search(query, limit = 10) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('search() requires a non-empty query string');
  }

  if (!process.env.TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY must be set in the environment');
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: query.trim(),
      search_depth: 'basic',
      max_results: Math.min(limit, 20),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tavily search request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const items = data.results || [];

  return items.map((item) => ({
    title: item.title || '',
    url: item.url || '',
    snippet: item.content || '',
  }));
}
