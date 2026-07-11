export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = '5671449edc6d4ecfb72e90efa2d06498';

  try {
    // ── Timezone-safe "today" in America/New_York ──────────────────────────
    const todayEastern = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date()); // yields "YYYY-MM-DD"

    // ── Pull all pages from Notion ─────────────────────────────────────────
    let allResults = [];
    let cursor = undefined;
    do {
      const body = {
        sorts: [{ property: 'Date', direction: 'ascending' }],
        page_size: 100,
      };
      if (cursor) body.start_cursor = cursor;

      const r = await fetch(
        `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.message || `Notion API ${r.status}`);
      }
      const data = await r.json();
      allResults = allResults.concat(data.results);
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    // ── Parse tasks ────────────────────────────────────────────────────────
    // Schema: Task (title), Subject (select), Priority (select), Done (checkbox),
    // Date (date), Completed On (date), Est. Time (text), Tag (text)
    const tasks = allResults.map((page) => {
      const p = page.properties;
      return {
        pageId: page.id,
        task:     p.Task?.title?.[0]?.plain_text ?? '(untitled)',
        subject:  p.Subject?.select?.name ?? 'Other',
        priority: p.Priority?.select?.name ?? '',
        done:        p.Done?.checkbox ?? false,
        date:        p.Date?.date?.start ?? null,
        completedOn: p['Completed On']?.date?.start ?? null,
        est:         p['Est. Time']?.rich_text?.[0]?.plain_text ?? '',
        tag:         p.Tag?.rich_text?.[0]?.plain_text ?? '',
      };
    });

    // ── Today filter (Eastern time) ────────────────────────────────────────
    // Include ALL today tasks — done ones will show with strikethrough on FE
    const todayTasks = tasks.filter((t) => t.date === todayEastern);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      todayTasks,
      allTasks: tasks,
      todayEastern,
    });
  } catch (err) {
    console.error('notion GET error:', err);
    return res.status(500).json({ error: err.message });
  }
}
