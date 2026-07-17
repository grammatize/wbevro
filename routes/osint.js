import { Router } from 'express';
import { search } from '../lib/duckduckgo.js';
import { summarize } from '../lib/summarize.js';

const router = Router();

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 6;
  const timestamps = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= max) {
    hits.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  hits.set(ip, timestamps);
  return false;
}

router.post('/search', async (req, res) => {
  const ip = req.ip;
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many searches. Please wait a moment and try again.' });
  }

  const { query } = req.body || {};

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'A non-empty "query" string is required.' });
  }
  if (query.length > 200) {
    return res.status(400).json({ error: 'Query is too long (max 200 characters).' });
  }

  try {
    const rawResults = await search(query.trim(), 12);
    const summary = await summarize(query.trim(), rawResults);
    return res.json({
      query: query.trim(),
      result_count: rawResults.length,
      summary,
      raw_results: rawResults,
    });
  } catch (err) {
    console.error('OSINT search error:', err);
    return res.status(502).json({ error: 'Search or summarization failed. Please try again shortly.' });
  }
});

export default router;
