export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const { pageId, done } = req.body ?? {};

  if (!pageId) return res.status(400).json({ error: 'pageId is required' });

  try {
    const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          Done: { checkbox: Boolean(done) },
        },
      }),
    });

    if (!r.ok) {
      const e = await r.json();
      return res.status(r.status).json({ error: e.message ?? 'Notion PATCH failed' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, pageId, done: Boolean(done) });
  } catch (err) {
    console.error('notion-update PATCH error:', err);
    return res.status(500).json({ error: err.message });
  }
}
