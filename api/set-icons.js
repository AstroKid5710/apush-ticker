export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const token = process.env.NOTION_TOKEN;
  const dbId  = '5671449edc6d4ecfb72e90efa2d06498';

  if (!token) return res.status(500).json({ error: 'NOTION_TOKEN not set' });

  const emojiMap = {
    'Gauntlet FRQ':   '📝',
    'Packet of Doom': '📖',
    'IDs / KT':       '🃏',
    'Review / Class': '🏫',
    'Exam / Due':     '🎯',
    'Other':          '📌',
  };

  try {
    // ── Fetch all pages (paginated) ──
    let pages = [];
    let cursor = undefined;
    do {
      const body = { page_size: 100, sorts: [{ property: 'Date', direction: 'ascending' }] };
      if (cursor) body.start_cursor = cursor;
      const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      pages = pages.concat(data.results);
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    // ── Set icon on each page ──
    const results = [];
    for (const page of pages) {
      const type  = page.properties['Type']?.select?.name ?? 'Other';
      const emoji = emojiMap[type] ?? '📌';
      const task  = page.properties['Task']?.title?.[0]?.plain_text ?? '(untitled)';

      await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ icon: { type: 'emoji', emoji } }),
      });

      results.push({ task, type, emoji });
    }

    return res.status(200).json({
      message: `✅ Done! Updated ${results.length} tasks.`,
      results,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
