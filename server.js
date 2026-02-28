const http = require('http'), fs = require('fs'), p = require('path');
const BASE = p.join(__dirname);

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
    const source = 'CoinTelegraph';
    items.push({ title: title.trim(), pubDate, source });
  }
  return items;
}

async function fetchRssItems() {
  const r = await fetch('https://cointelegraph.com/rss', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml' }
  });
  const xml = await r.text();
  return parseRss(xml);
}

async function handleApi(pathname, res) {
  try {
    const items = await fetchRssItems();

    let data;

    if (pathname === '/api/news') {
      const news = items.slice(0, 8).map(item => ({
        title: item.title,
        source: item.source,
        bias: parseSentiment(item.title),
        date: timeAgo(item.pubDate),
      }));
      data = { results: news.map(n => ({
        title: n.title,
        source: { title: n.source },
        votes: {},
        published_at: new Date().toISOString(),
        _bias: n.bias,
        _date: n.date,
      }))};

    } else if (pathname === '/api/policy') {
      const keywords = ['regulation','regulatory','sec','etf','law','ban','legal','congress','government','policy','fed','treasury','legislation','approval','reserve','compliance'];
      const filtered = items.filter(i => keywords.some(k => i.title.toLowerCase().includes(k)));
      const src = (filtered.length >= 3 ? filtered : items).slice(0, 6);
      const policyItems = src.map(i => ({
        date: timeAgo(i.pubDate),
        title: i.title,
        detail: i.source,
        impact: parseSentiment(i.title) === 'extreme_negative' ? 'negative' : parseSentiment(i.title)
      }));
      const posCount = policyItems.filter(i => i.impact === 'positive').length;
      const negCount = policyItems.filter(i => i.impact === 'negative').length;
      const score = Math.min(100, Math.max(0, Math.round(50 + (posCount - negCount) / (policyItems.length || 1) * 35)));
      data = { score, summary: `규제·정책 관련 뉴스 ${policyItems.length}건 분석`, noChangeConfirmed: false, items: policyItems };

    } else if (pathname === '/api/aipower') {
      const keywords = ['ai','artificial intelligence','energy','mining','electricity','power','nvidia','data center','gpu','hashrate','miner','compute'];
      const filtered = items.filter(i => keywords.some(k => i.title.toLowerCase().includes(k)));
      const src = (filtered.length >= 3 ? filtered : items).slice(0, 6);
      const news = src.map(i => ({
        title: i.title,
        detail: i.source,
        date: timeAgo(i.pubDate),
        impact: parseSentiment(i.title) === 'extreme_negative' ? 'negative' : parseSentiment(i.title)
      }));
      const posCount = news.filter(n => n.impact === 'positive').length;
      const negCount = news.filter(n => n.impact === 'negative').length;
      const score = Math.min(100, Math.max(0, Math.round(50 + (posCount - negCount) / (news.length || 1) * 35)));
      data = { score, summary: `AI·에너지 관련 뉴스 ${news.length}건 분석`, news };
    }

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

http.createServer(async (q, r) => {
  const pathname = decodeURIComponent(q.url.split('?')[0]);

  if (pathname.startsWith('/api/')) {
    return handleApi(pathname, r);
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
