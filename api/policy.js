function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return diff + '분 전';
  if (diff < 1440) return Math.floor(diff / 60) + '시간 전';
  const days = Math.floor(diff / 1440);
  if (days < 30) return days + '일 전';
  return Math.floor(days / 30) + '개월 전';
}

function timeAgoTs(ts) {
  const diff = Math.floor((Date.now() / 1000 - ts) / 60);
  if (diff < 60) return diff + '분 전';
  if (diff < 1440) return Math.floor(diff / 60) + '시간 전';
  const days = Math.floor(diff / 1440);
  if (days < 30) return days + '일 전';
  return Math.floor(days / 30) + '개월 전';
}

function parseSentiment(title) {
  const t = title.toLowerCase();
  const reversals = ['ban rejected','ban lifted','ban overturned','decline slows','fear subsides','loss recovered','crash averted','drop reversed'];
  let revBonus = reversals.filter(r => t.includes(r)).length;
  const posNgram = ['rate cut','etf approved','etf approval','strategic reserve','mass adoption','bill passed','bill signed','executive order'];
  const negNgram = ['rate hike','ban threat','exchange hack','market crash','crackdown on','liquidity crisis','subpoena issued'];
  const posN = posNgram.filter(w => t.includes(w)).length;
  const negN = negNgram.filter(w => t.includes(w)).length;
  const pos = ['approve','support','favorable','sign','pass','adopt','ease','bullish','boost','growth','launch','endorse'];
  const neg = ['ban','restrict','reject','warn','investigate','enforce','penalty','hike','crash','collapse','crackdown','suspend','subpoena'];
  const posHit = pos.filter(w => t.includes(w)).length + posN * 2 + revBonus;
  const negHit = neg.filter(w => t.includes(w)).length + negN * 2 - revBonus;
  const finalNeg = Math.max(0, negHit);
  if (finalNeg > posHit) return 'negative';
  if (posHit > finalNeg) return 'positive';
  return 'neutral';
}

function parseRss(xml) {
  const items = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  for (const block of blocks) {
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate><!\[CDATA\[(.*?)\]\]><\/pubDate>/) || block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
    items.push({ title: title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim(), pubDate });
  }
  return items;
}

const AGENCY_RULES = [
  { label: '재정부', keywords: ['treasury', 'yellen', 'bessent', 'debt ceiling', 'bonds', 'fiscal'] },
  { label: '백악관', keywords: ['white house', 'president', 'executive order', 'trump', 'biden', 'administration'] },
  { label: 'CFTC',  keywords: ['cftc', 'commodities', 'futures trading'] },
  { label: '주정부', keywords: ['state law', 'governor', 'state bill', 'state legislation', 'minnesota', 'texas', 'california', 'new york', 'florida', 'wyoming', 'colorado'] },
];

function matchAgency(title) {
  const t = title.toLowerCase();
  for (const rule of AGENCY_RULES) {
    if (rule.keywords.some(k => t.includes(k))) return rule.label;
  }
  return null;
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
    // 연준 RSS + CoinTelegraph RSS + CC Regulation 동시 fetch
    const [fedRes, ctRes, ccRegArticles] = await Promise.all([
      fetch('https://www.federalreserve.gov/feeds/press_all.xml', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }),
      fetch('https://cointelegraph.com/rss', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, text/xml' }
      }),
      fetchCCNews6m('Regulation')
    ]);

    const fedXml = await fedRes.text();
    const ctXml = await ctRes.text();

    const now = Math.floor(Date.now() / 1000);

    // 연준 RSS → 전체 아이템 (타임스탬프 포함)
    const allFedItems = parseRss(fedXml).map(i => ({
      date: timeAgo(i.pubDate),
      title: i.title,
      detail: '연준',
      impact: parseSentiment(i.title),
      _ts: Math.floor(new Date(i.pubDate).getTime() / 1000) || now
    }));

    // CoinTelegraph → 기관 매칭
    const ctItems = parseRss(ctXml);
    const allAgencyItems = [];
    const seenTitles = new Set();

    for (const item of ctItems) {
      const agency = matchAgency(item.title);
      if (agency) {
        seenTitles.add(item.title);
        allAgencyItems.push({
          date: timeAgo(item.pubDate),
          title: item.title,
          detail: agency,
          impact: parseSentiment(item.title),
          _ts: Math.floor(new Date(item.pubDate).getTime() / 1000) || now
        });
      }
    }

    // CC Regulation → 기관 매칭 (6개월, 중복 제거)
    for (const item of ccRegArticles) {
      if (!seenTitles.has(item.title)) {
        const agency = matchAgency(item.title);
        if (agency) {
          seenTitles.add(item.title);
          allAgencyItems.push({
            date: timeAgoTs(item.published_on),
            title: item.title,
            detail: agency,
            impact: parseSentiment(item.title),
            _ts: item.published_on
          });
        }
      }
    }

    // 표시용: 최신 8건
    const displayItems = [...allFedItems.slice(0, 4), ...allAgencyItems.slice(0, 4)].slice(0, 8);
    const items = displayItems.length > 0 ? displayItems : allFedItems.slice(0, 6);

    // 점수: 시간 가중치 적용 (최신 기사일수록 비중 ↑)
    // weight = exp(-days/60): 7일=0.89, 30일=0.61, 90일=0.22, 180일=0.05
    const allForScore = [...allFedItems, ...allAgencyItems];
    let weightedPos = 0, weightedNeg = 0, totalWeight = 0;
    for (const item of allForScore) {
      const days = Math.max(0, (now - item._ts) / 86400);
      const w = Math.exp(-days / 60);
      totalWeight += w;
      if (item.impact === 'positive') weightedPos += w;
      if (item.impact === 'negative') weightedNeg += w;
    }

    const totalForScore = allForScore.length || 1;
    const rawScore = totalWeight > 0
      ? 50 + (weightedPos - weightedNeg) / totalWeight * 35
      : 50;
    const confidence = Math.min(1, totalForScore / 20);
    const score = Math.min(100, Math.max(0,
      Math.round(rawScore * confidence + 50 * (1 - confidence))
    ));

    const agencies = [...new Set(allForScore.map(i => i.detail))];
    const summary = `${agencies.join('·')} ${totalForScore}건 기반 6개월 정책 분석`;

    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json({ score, summary, noChangeConfirmed: false, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
