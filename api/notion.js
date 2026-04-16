export default async function handler(req, res) {
  // Allow requests from any origin (needed for browser fetch)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const token = process.env.NOTION_TOKEN;
  const dbId  = '5671449edc6d4ecfb72e90efa2d06498';

  if (!token) {
    return res.status(500).json({ error: 'NOTION_TOKEN not set' });
  }

  try {
    // ── Fetch all tasks from the database ──
    const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sorts: [{ property: 'Date', direction: 'ascending' }],
        page_size: 100,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const pages = data.results;

    // ── Helper to safely read properties ──
    const getText  = p => p?.title?.[0]?.plain_text  ?? p?.rich_text?.[0]?.plain_text ?? '';
    const getSelect= p => p?.select?.name ?? '';
    const getCheck = p => p?.checkbox ?? false;
    const getDate  = p => p?.date?.start ?? '';

    // ── Today's date in ET (Michigan) ──
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Detroit',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date()); // YYYY-MM-DD

    // ── Build structured task list ──
    const tasks = pages.map(page => {
      const props = page.properties;
      return {
        task:    getText(props['Task']),
        type:    getSelect(props['Type']),
        done:    getCheck(props['Done']),
        date:    getDate(props['Date']),
        est:     getText(props['Est. Time']),
        tag:     getText(props['Tag']),
        week:    getSelect(props['Week']),
      };
    });

    // ── Today's tasks ──
    const todayTasks = tasks.filter(t => t.date === todayStr && !t.done);

    // ── Progress counts ──
    const gauntletTotal    = tasks.filter(t => t.type === 'Gauntlet FRQ').length;
    const gauntletDone     = tasks.filter(t => t.type === 'Gauntlet FRQ' && t.done).length;
    const podTotal         = tasks.filter(t => t.type === 'Packet of Doom').length;
    const podDone          = tasks.filter(t => t.type === 'Packet of Doom' && t.done).length;
    const totalTasks       = tasks.length;
    const totalDone        = tasks.filter(t => t.done).length;

    // ── Countdown days ──
    const now       = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Detroit' }));
    const msPerDay  = 86400000;
    const daysTo    = dateStr => Math.ceil((new Date(dateStr + 'T00:00:00') - now) / msPerDay);
    const daysGaunt = daysTo('2026-05-01');
    const daysPOD   = daysTo('2026-05-04');
    const daysExam  = daysTo('2026-05-08');

    // ── Velocity (remaining / days left) ──
    const gauntRemaining = gauntletTotal - gauntletDone;
    const podRemaining   = podTotal - podDone;
    const gauntPace = daysGaunt > 0 ? (gauntRemaining / daysGaunt).toFixed(1) : '—';
    const podPace   = daysPOD   > 0 ? (podRemaining   / daysPOD).toFixed(1)   : '—';

    return res.status(200).json({
      todayTasks,
      stats: {
        gauntletDone, gauntletTotal,
        podDone, podTotal,
        totalDone, totalTasks,
        daysGaunt, daysPOD, daysExam,
        gauntPace, podPace,
      },
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
