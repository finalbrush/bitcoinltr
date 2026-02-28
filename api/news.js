function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return diff + '분 전';
  if (diff < 1440) return Math.floor(diff / 60) + '시간 전';
  return Math.floor(diff / 1440) + '일 전';
}

function parseSentiment(title) {
  const t = title.toLowerCase();
  const pos = ['bullish','surge','rally','gain','soar','rise','high','buy','adoption','approve','approval','launch','boost','record','growth'];
  const neg = ['crash','drop','fall','bear','sell','ban','hack','scam','fraud','lawsuit','collapse','plunge','loss','decline','warning','fear'];
  const posHit = pos.filter(w => t.includes(w)).length;
  const negHit = neg.filter(w => t.includes(w)).length;
  if (negHit > posHit * 1.5) return 'extreme_negative';
  if (negHit > posHit) return 'negative';
  if (posHit > negHit) return 'positive';
  return 'neutral';
}

function parseRss(xml) {
  const items = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  for (const block of blocks) {
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
    items.push({ title: title.trim(), pubDate });
  }
  return items;
}

export default async function handler(req, res) {
  try {
    const r = await fetch('https://cointelegraph.com/rss', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, text/xml' }
    });
    const xml = await r.text();
    const items = parseRss(xml).slice(0, 8);

    const results = items.map(item => ({
      title: item.title,
      source: { title: 'CoinTelegraph' },
      votes: { positive: parseSentiment(item.title) === 'positive' ? 5 : 0, negative: parseSentiment(item.title).includes('negative') ? 5 : 0 },
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      url: ''
    }));

    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
