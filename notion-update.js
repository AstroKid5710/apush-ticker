export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const { pageId, done } = req.body ?? {};

  if (!pageId) return res.status(400).json({ error: 'pageId is required' });

  // Stamp today's Eastern date on completion; clear when unchecking
  const todayEastern = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const patchNotion = (properties) =>
    fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });

  try {
    // Attempt: update Done + Completed On together
    let r = await patchNotion({
      Done:           { checkbox: Boolean(done) },
      'Completed On': done ? { date: { start: todayEastern } } : { date: null },
    });

    if (!r.ok) {
      // Capture the real Notion error so the frontend can show it
      const notionErr = await r.json().catch(() => ({}));
      console.error('notion-update: full PATCH failed:', JSON.stringify(notionErr));

      // Fallback: update only Done so the checkbox still works
      const r2 = await patchNotion({ Done: { checkbox: Boolean(done) } });
      if (!r2.ok) {
        const e = await r2.json().catch(() => ({}));
        return res.status(r2.status).json({ error: e.message ?? 'Notion PATCH failed' });
      }

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        success: true, pageId, done: Boolean(done), completedOn: null,
        // Surface the real Notion error so the client can log/display it
        note: `"Completed On" was NOT saved. Notion error: ${notionErr.message ?? notionErr.code ?? 'unknown'}. Make sure: (1) the property exists in Notion, (2) it is a Date type, (3) the name is exactly "Completed On".`,
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true, pageId, done: Boolean(done),
      completedOn: done ? todayEastern : null,
    });
  } catch (err) {
    console.error('notion-update PATCH error:', err);
    return res.status(500).json({ error: err.message });
  }
}
