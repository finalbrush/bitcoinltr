const http = require('http'), fs = require('fs'), p = require('path');
const BASE = p.join(__dirname);

// ─── 공용 유틸 ───────────────────────────────────────────
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
  const posNgram = ['rate cut','etf approved','etf approval','strategic reserve','mass adoption','all-time high','new high','bull run','price surge'];
  const negNgram = ['rate hike','ban threat','exchange hack','market crash','death cross','bank run','liquidity crisis','sell-off'];
  const posN = posNgram.filter(w => t.includes(w)).length;
  const negN = negNgram.filter(w => t.includes(w)).length;
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

function parseSentimentPolicy(title) {
  const t = title.toLowerCase();
  const reversals = ['ban rejected','ban lifted','ban overturned','decline slows','crash averted'];
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

// ─── CryptoCompare 6개월 뉴스 페이지네이션 ──────────────
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

// ─── 온체인 유틸 ─────────────────────────────────────────
function formatHashRate(thps) {
  if (thps >= 1e9) return (thps / 1e9).toFixed(2) + ' EH/s';
  if (thps >= 1e6) return (thps / 1e6).toFixed(2) + ' PH/s';
  return thps.toFixed(0) + ' TH/s';
}

function formatVolume(satoshis) {
  const btc = satoshis / 1e8;
  if (btc >= 1e6) return (btc / 1e6).toFixed(1) + 'M BTC';
  if (btc >= 1e3) return (btc / 1e3).toFixed(1) + 'K BTC';
  return btc.toFixed(0) + ' BTC';
}

function formatDifficulty(d) {
  if (d >= 1e12) return (d / 1e12).toFixed(1) + 'T';
  if (d >= 1e9) return (d / 1e9).toFixed(1) + 'B';
  return d.toString();
}

function multiPeriodTrendScore(values) {
  if (values.length < 2) return 50;
  const last = values[values.length - 1].y;
  const getVal = (daysAgo) => {
    const idx = Math.max(0, values.length - 1 - daysAgo);
    return values[idx].y;
  };
  const pct = (cur, prev) => prev > 0 ? (cur - prev) / prev : 0;
  const w = pct(last, getVal(7)) * 0.1
          + pct(last, getVal(30)) * 0.2
          + pct(last, getVal(90)) * 0.3
          + pct(last, getVal(180)) * 0.4;
  return Math.min(80, Math.max(20, Math.round(50 + w * 60)));
}

// ─── 정책 기관 매칭 ─────────────────────────────────────
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

// ─── API 핸들러 ──────────────────────────────────────────
async function handleNews(res) {
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

  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ results, _scoring }));
}

async function handlePolicy(res) {
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
    impact: parseSentimentPolicy(i.title),
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
        impact: parseSentimentPolicy(item.title),
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
          impact: parseSentimentPolicy(item.title),
          _ts: item.published_on
        });
      }
    }
  }

  // 표시용: 최신 8건
  const displayItems = [...allFedItems.slice(0, 4), ...allAgencyItems.slice(0, 4)].slice(0, 8);
  const items = displayItems.length > 0 ? displayItems : allFedItems.slice(0, 6);

  // 점수: 시간 가중치 적용 (최신 기사일수록 비중 ↑)
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

  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ score, summary, noChangeConfirmed: false, items }));
}

async function handleAipower(res) {
  // CC 6개월 AI·에너지 뉴스 + 온체인 + 시장 구조 데이터 병렬 fetch
  const [ccArticles, hashData, addrData, mempoolData, feeData, statsData, globalData, fundingData] = await Promise.all([
    fetchCCNews6m('Mining|Technology'),
    fetch('https://api.blockchain.info/charts/hash-rate?timespan=180days&format=json').then(r => r.json()),
    fetch('https://api.blockchain.info/charts/n-unique-addresses?timespan=180days&format=json').then(r => r.json()),
    fetch('https://mempool.space/api/mempool').then(r => r.json()),
    fetch('https://mempool.space/api/v1/fees/recommended').then(r => r.json()),
    fetch('https://api.blockchair.com/bitcoin/stats').then(r => r.json()),
    fetch('https://api.coingecko.com/api/v3/global').then(r => r.json()).catch(() => null),
    fetch('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1').then(r => r.json()).catch(() => null)
  ]);

  // ─── AI·에너지 뉴스 필터링 (6개월) ───
  const keywords = ['ai','artificial intelligence','energy','mining','electricity','power','nvidia','data center','gpu','hashrate','miner','compute'];
  const filtered = ccArticles.filter(i => keywords.some(k => i.title.toLowerCase().includes(k)));
  const allForNewsScore = filtered.length >= 10 ? filtered : ccArticles;

  const src = allForNewsScore.slice(0, 6);
  const news = src.map(i => ({
    title: i.title,
    detail: i.source_info?.name || i.source || '',
    date: timeAgoTs(i.published_on),
    impact: parseSentiment(i.title)
  }));

  const posCount = allForNewsScore.filter(n => parseSentiment(n.title) === 'positive').length;
  const negCount = allForNewsScore.filter(n => parseSentiment(n.title) === 'negative').length;
  const newsScore = Math.min(100, Math.max(0, Math.round(50 + (posCount - negCount) / (allForNewsScore.length || 1) * 35)));

  // ─── 온체인 데이터 (180일) ───
  const hashValues = hashData.values || [];
  const addrValues = addrData.values || [];
  const stats = statsData.data || {};

  const lastHash = hashValues.length ? hashValues[hashValues.length - 1].y : 0;
  const lastAddr = addrValues.length ? addrValues[addrValues.length - 1].y : 0;

  const hash7d = hashValues.length > 7 ? hashValues[hashValues.length - 8].y : (hashValues[0]?.y || 0);
  const addr7d = addrValues.length > 7 ? addrValues[addrValues.length - 8].y : (addrValues[0]?.y || 0);
  const hashRateTrend = lastHash >= hash7d ? 'up' : 'down';
  const activeAddressesTrend = lastAddr >= addr7d ? 'up' : 'down';

  // BTC 도미넌스 + 펀딩레이트
  const btcDominance = globalData?.data?.market_cap_percentage?.btc || 0;
  const fundingRate = Array.isArray(fundingData) && fundingData[0]
    ? parseFloat(fundingData[0].fundingRate) : 0;

  const onchain = {
    hashRate: formatHashRate(lastHash),
    hashRateTrend,
    activeAddresses: Math.round(lastAddr),
    activeAddressesTrend,
    mempoolCount: mempoolData.count || 0,
    recommendedFee: feeData.halfHourFee || 0,
    volume24h: formatVolume(stats.volume_24h || 0),
    difficulty: formatDifficulty(stats.difficulty || 0),
    btcDominance: btcDominance ? btcDominance.toFixed(1) : '—',
    fundingRate: fundingRate ? (fundingRate * 100).toFixed(4) : '0.0000'
  };

  // ─── 온체인 + 시장 구조 점수 ───
  const hashScore = multiPeriodTrendScore(hashValues);
  const addrScore = multiPeriodTrendScore(addrValues);
  const mempoolScore = (mempoolData.count || 0) < 30000 ? 65
                     : (mempoolData.count || 0) < 60000 ? 50 : 30;
  const domScore = btcDominance > 55 ? 65 : btcDominance > 45 ? 50 : 35;
  const frScore = fundingRate < -0.0001 ? 70
                : fundingRate < 0.0001 ? 55
                : fundingRate < 0.001 ? 40 : 25;
  const onchainScore = Math.round(
    hashScore * 0.30 + addrScore * 0.25 + mempoolScore * 0.15 + domScore * 0.15 + frScore * 0.15
  );

  const score = Math.round(newsScore * 0.2 + onchainScore * 0.8);
  const summary = `AI·에너지·온체인·시장구조 6개월 종합 (뉴스${allForNewsScore.length}건+180d)`;

  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ score, summary, onchain, news }));
}

// ─── 서버 ────────────────────────────────────────────────
http.createServer(async (q, r) => {
  const pathname = decodeURIComponent(q.url.split('?')[0]);

  if (pathname === '/api/news') {
    try { await handleNews(r); }
    catch(e) { r.writeHead(500, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ error: e.message })); }
    return;
  }
  if (pathname === '/api/policy') {
    try { await handlePolicy(r); }
    catch(e) { r.writeHead(500, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ error: e.message })); }
    return;
  }
  if (pathname === '/api/aipower') {
    try { await handleAipower(r); }
    catch(e) { r.writeHead(500, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ error: e.message })); }
    return;
  }

  let u = pathname === '/' ? '/index.html' : pathname;
  let f = p.join(BASE, u);
  const ext = p.extname(f).slice(1).toLowerCase();
  const mime = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', html:'text/html', js:'application/javascript', css:'text/css' }[ext] || 'application/octet-stream';
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); r.end('Not found'); }
    else { r.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' }); r.end(d); }
  });
}).listen(8766, () => console.log('OK http://localhost:8766'));
