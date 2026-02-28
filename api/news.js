function parseSentiment(title) {
  const t = title.toLowerCase();
  // n-gram 반전 (부정 단어 포함이지만 실제 긍정)
  const reversals = ['ban rejected','ban lifted','ban overturned','decline slows','fear subsides','loss recovered','crash averted','drop reversed'];
  let revBonus = reversals.filter(r => t.includes(r)).length;
  // n-gram 강한 신호
  const posNgram = ['rate cut','etf approved','etf approval','strategic reserve','mass adoption','all-time high','new high','bull run','price surge'];
  const negNgram = ['rate hike','ban threat','exchange hack','market crash','death cross','bank run','liquidity crisis','sell-off'];
  const posN = posNgram.filter(w => t.includes(w)).length;
  const negN = negNgram.filter(w => t.includes(w)).length;
  // 단일 키워드
  const pos = ['bullish','surge','rally','gain','soar','rise','approve','approval','launch','boost','record','growth','adoption','buy','support','adopt'];
  const neg = ['crash','drop','fall','bear','sell','ban','hack','scam','fraud','lawsuit','collapse','plunge','loss','decline','warning','fear','restrict','reject'];
  const posHit = pos.filter(w => t.includes(w)).length + posN * 2 + revBonus;
  const negHit = neg.filter(w => t.includes(w)).length + negN * 2 - revBonus;
  const finalNeg = Math.max(0, negHit);
  if (finalNeg > posHit * 1.5 && finalNeg >= 3) return 'extreme_negative';
  if (finalNeg > posHit) return 'negative';
  if (posHit > finalNeg) return 'positive';
  return 'neutral';
}

function timeAgoTs(ts) {
  const diff = Math.floor((Date.now() / 1000 - ts) / 60);
  if (diff < 60) return diff + '분 전';
  if (diff < 1440) return Math.floor(diff / 60) + '시간 전';
  const days = Math.floor(diff / 1440);
  if (days < 30) return days + '일 전';
  return Math.floor(days / 30) + '개월 전';
}

// CryptoCompare 6개월 뉴스 페이지네이션
async function fetchCCNews6m(categories) {
  const now = Math.floor(Date.now() / 1000);
  const offsets = [0, 25, 50, 75, 100, 125, 150, 180];
  const base = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=50';
  const catParam = categories ? '&categories=' + categories : '';

  const responses = await Promise.all(
    offsets.map(d =>
      fetch(base + catParam + '&lTs=' + (now - d * 86400))
        .then(r => r.json())
        .catch(() => ({ Data: [] }))
    )
  );

  const seen = new Set();
  const articles = [];
  for (const resp of responses) {
    const data = Array.isArray(resp.Data) ? resp.Data : [];
    for (const item of data) {
      if (item.title && !seen.has(item.title)) {
        seen.add(item.title);
        articles.push(item);
      }
    }
  }
  articles.sort((a, b) => b.published_on - a.published_on);
  return articles;
}

export default async function handler(req, res) {
  try {
    const allArticles = await fetchCCNews6m();

    const results = allArticles.map(item => ({
      title: item.title,
      source: { title: item.source_info?.name || item.source || '' },
      votes: {},
      published_at: new Date(item.published_on * 1000).toISOString(),
      url: item.url || '',
      _bias: parseSentiment(item.title),
      _date: timeAgoTs(item.published_on)
    }));

    const _scoring = {
      total: allArticles.length,
      positive: allArticles.filter(i => parseSentiment(i.title) === 'positive').length,
      negative: allArticles.filter(i => {
        const s = parseSentiment(i.title);
        return s === 'negative' || s === 'extreme_negative';
      }).length
    };

    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json({ results, _scoring });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
