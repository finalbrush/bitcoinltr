function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return diff + '분 전';
  if (diff < 1440) return Math.floor(diff / 60) + '시간 전';
  return Math.floor(diff / 1440) + '일 전';
}

function parseSentiment(title) {
  const t = title.toLowerCase();
  const pos = ['bullish','surge','rally','gain','approve','approval','launch','boost','growth','support','pass','sign'];
  const neg = ['crash','drop','ban','hack','fraud','lawsuit','collapse','loss','decline','reject','block','restrict'];
  const posHit = pos.filter(w => t.includes(w)).length;
  const negHit = neg.filter(w => t.includes(w)).length;
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
    const all = parseRss(xml);

    const keywords = ['regulation','regulatory','sec','etf','law','ban','legal','congress','government','policy','fed','treasury','legislation','approval','reserve','compliance','bill','senate'];
    const filtered = all.filter(i => keywords.some(k => i.title.toLowerCase().includes(k)));
    const src = (filtered.length >= 3 ? filtered : all).slice(0, 6);

    const items = src.map(i => ({
      date: timeAgo(i.pubDate),
      title: i.title,
      detail: 'CoinTelegraph',
      impact: parseSentiment(i.title)
    }));

    const posCount = items.filter(i => i.impact === 'positive').length;
    const negCount = items.filter(i => i.impact === 'negative').length;
    const score = Math.min(100, Math.max(0, Math.round(50 + (posCount - negCount) / (items.length || 1) * 35)));
    const summary = filtered.length >= 3
      ? `규제·정책 관련 뉴스 ${items.length}건 분석`
      : `최근 BTC 주요 뉴스 ${items.length}건 분석`;

    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json({ score, summary, noChangeConfirmed: false, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
