function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 60000);
  if (diff < 60) return diff + '분 전';
  if (diff < 1440) return Math.floor(diff / 60) + '시간 전';
  return Math.floor(diff / 1440) + '일 전';
}

export default async function handler(req, res) {
  const key = process.env.CRYPTOPANIC_KEY;
  if (!key) { res.status(500).json({ error: 'no key' }); return; }

  try {
    const r = await fetch(
      `https://cryptopanic.com/api/free/v1/posts/?auth_token=${key}&currencies=BTC&kind=news`
    );
    const json = await r.json();
    const all = json.results || [];

    const keywords = [
      'regulation', 'regulatory', 'sec', 'etf', 'law', 'ban', 'legal',
      'congress', 'government', 'policy', 'fed', 'treasury', 'legislation',
      'approval', 'reserve', 'compliance', 'crypto bill', 'crypto law'
    ];

    const filtered = all.filter(item =>
      keywords.some(kw => item.title.toLowerCase().includes(kw))
    );
    const src = (filtered.length >= 3 ? filtered : all).slice(0, 6);

    const items = src.map(item => {
      const pos = (item.votes?.positive || 0) + (item.votes?.bullish || 0);
      const neg = (item.votes?.negative || 0) + (item.votes?.bearish || 0);
      let impact = 'neutral';
      if (neg > pos * 1.5) impact = 'negative';
      else if (pos > neg * 1.2) impact = 'positive';
      return {
        date: timeAgo(item.published_at),
        title: item.title,
        detail: item.source?.title || '',
        impact
      };
    });

    const posCount = items.filter(i => i.impact === 'positive').length;
    const negCount = items.filter(i => i.impact === 'negative').length;
    const total = items.length || 1;
    const score = Math.min(100, Math.max(0,
      Math.round(50 + (posCount - negCount) / total * 35)
    ));

    const summary = filtered.length >= 3
      ? `규제·정책 관련 뉴스 ${items.length}건 분석`
      : `최근 BTC 주요 뉴스 ${items.length}건 분석`;

    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json({ score, summary, noChangeConfirmed: false, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
