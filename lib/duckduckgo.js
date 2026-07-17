import * as cheerio from 'cheerio';

const ENDPOINT = 'https://lite.duckduckgo.com/lite/';

export async function search(query, limit = 10) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('search() requires a non-empty query string');
  }

  const params = new URLSearchParams({ q: query.trim() });

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed with status ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const results = [];

  $('a.result-link').each((_, el) => {
    if (results.length >= limit) return;
    const title = $(el).text().trim();
    let url = $(el).attr('href') || '';

    try {
      const parsed = new URL(url, ENDPOINT);
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) url = decodeURIComponent(uddg);
    } catch {}

    const row = $(el).closest('tr');
    const snippetRow = row.next('tr');
    const snippet = snippetRow.find('.result-snippet').text().trim();

    if (title && url) {
      results.push({ title, url, snippet });
    }
  });

  return results;
}
