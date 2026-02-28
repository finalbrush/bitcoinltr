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
    // CC 6개월 AI·에너지 뉴스 + 온체인 + 시장 구조 데이터 병렬 fetch
    const [ccArticles, hashData, addrData, mempoolData, feeData, statsData, globalData, fundingData] = await Promise.all([
      fetchCCNews6m('Mining|Technology'),
      fetch('https://api.blockchain.info/charts/hash-rate?timespan=180days&format=json').then(r => r.json()),
      fetch('https://api.blockchain.info/charts/n-unique-addresses?timespan=180days&format=json').then(r => r.json()),
      fetch('https://mempool.space/api/mempool').then(r => r.json()),
      fetch('https://mempool.space/api/v1/fees/recommended').then(r => r.json()),
      fetch('https://api.blockchair.com/bitcoin/stats').then(r => r.json()),
      fetch('https://api.coingecko.com/api/v3/global').then(r => r.json()).catch(() => null),
      fetch('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1')
        .then(r => r.json())
        .then(d => Array.isArray(d) ? d : null)
        .catch(() =>
          // Binance 차단 시 Bybit → CoinGecko 순차 폴백
          fetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT')
            .then(r => r.json())
            .then(d => {
              const fr = d?.result?.list?.[0]?.fundingRate;
              return fr ? [{ fundingRate: fr }] : null;
            })
            .catch(() =>
              fetch('https://api.coingecko.com/api/v3/derivatives/exchanges/binance_futures?include_tickers=unexpired')
                .then(r => r.json())
                .then(d => {
                  const t = (d.tickers || []).find(t => t.symbol === 'BTCUSDT');
                  return t ? [{ fundingRate: String(t.funding_rate) }] : null;
                })
                .catch(() => null)
            )
        )
    ]);

    // ─── AI·에너지 뉴스 필터링 (6개월) ───
    const keywords = ['ai','artificial intelligence','energy','mining','electricity','power','nvidia','data center','gpu','hashrate','miner','compute'];
    const filtered = ccArticles.filter(i => keywords.some(k => i.title.toLowerCase().includes(k)));
    const allForNewsScore = filtered.length >= 10 ? filtered : ccArticles;

    // 표시용: 최신 6건
    const src = allForNewsScore.slice(0, 6);
    const news = src.map(i => ({
      title: i.title,
      detail: i.source_info?.name || i.source || '',
      date: timeAgoTs(i.published_on),
      impact: parseSentiment(i.title)
    }));

    // 뉴스 점수: 6개월 전체 모수
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
      fundingRate: fundingRate !== 0 ? (fundingRate * 100).toFixed(4) : '—'
    };

    // ─── 온체인 + 시장 구조 점수 ───
    const hashScore = multiPeriodTrendScore(hashValues);
    const addrScore = multiPeriodTrendScore(addrValues);
    const mempoolScore = (mempoolData.count || 0) < 30000 ? 65
                       : (mempoolData.count || 0) < 60000 ? 50 : 30;
    // 도미넌스: >55 강세, >45 중립, <45 약세
    const domScore = btcDominance > 55 ? 65 : btcDominance > 45 ? 50 : 35;
    // 펀딩레이트: 음수=과냉(역발상 강세), 0근처=중립, 강한양수=과열
    const frScore = fundingRate < -0.0001 ? 70
                  : fundingRate < 0.0001 ? 55
                  : fundingRate < 0.001 ? 40 : 25;
    const onchainScore = Math.round(
      hashScore * 0.30 + addrScore * 0.25 + mempoolScore * 0.15 + domScore * 0.15 + frScore * 0.15
    );

    const score = Math.round(newsScore * 0.2 + onchainScore * 0.8);
    const summary = `AI·에너지·온체인·시장구조 6개월 종합 (뉴스${allForNewsScore.length}건+180d)`;

    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json({ score, summary, onchain, news });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
