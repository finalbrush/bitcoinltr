// ─── 점수 계산 ────────────────────────────────────────
function calcScores(data) {
  const { media, policy, aiPower } = data;

  // 극도 공포 구간(fearGreedIndex < 25)에서 역발상 보정: mediaScore 보너스
  const mediaAdj = media.fearGreedIndex < 25
    ? Math.min(100, media.mediaScore * 1.25)
    : media.fearGreedIndex < 35
    ? Math.min(100, media.mediaScore * 1.1)
    : media.mediaScore;

  // 단기: 언론 70% + 정책 30%
  const short = Math.min(100, Math.round(mediaAdj * 0.70 + policy.score * 0.30));

  // 중기: 언론 35% + 정책 65%
  const mid = Math.min(100, Math.round(media.mediaScore * 0.35 + policy.score * 0.65));

  // 장기: 정책 60% + AI전력 40%
  const long = Math.min(100, Math.round(policy.score * 0.60 + aiPower.score * 0.40));

  return { short, mid, long };
}

function scoreColor(s) {
  if (s >= 60) return 'var(--green)';
  if (s >= 40) return 'var(--yellow)';
  return 'var(--red)';
}

function scoreLabel(s) {
  if (s >= 70) return '긍정적';
  if (s >= 60) return '관심';
  if (s >= 40) return '중립';
  if (s >= 25) return '주의';
  return '위험';
}

function scoreComment(s) {
  const { short, mid, long } = s;
  if (long >= 70 && mid >= 60 && short < 50)
    return '단기 조정 구간 — 중장기 관점에서 분할 매수 검토 가능';
  if (long >= 70 && mid >= 70 && short >= 60)
    return '전 구간 긍정적 — 펀더멘탈·정책 모두 우호적';
  if (long >= 70 && mid >= 70 && short < 40)
    return '단기 공포 극단 — 역발상 전략 검토, 장기 기조는 변함없음';
  if (long < 50 && mid < 50)
    return '전 구간 부정적 — 포지션 축소 및 관망 권장';
  if (short >= 60 && mid >= 60)
    return '단기·중기 긍정적 — 장기 트렌드 추가 확인 권장';
  return '복합 신호 — 섹션별 세부 내용 확인 후 판단';
}

// ─── 렌더링 ────────────────────────────────────────────
function render(data) {
  const scores = calcScores(data);
  renderHeader(data);
  renderScoreCard(scores);
  renderMediaSection(data.media);
  renderPolicySection(data.policy);
  renderAiSection(data.aiPower);
}

function renderHeader(data) {
  const { btcPrice, lastUpdated, media } = data;
  const isUp = btcPrice.change24h >= 0;
  const is7dUp = btcPrice.change7d >= 0;

  document.getElementById('price-main').textContent =
    '$' + btcPrice.current.toLocaleString('en-US');

  const changeEl = document.getElementById('price-change');
  changeEl.textContent = (isUp ? '+' : '') + btcPrice.change24h.toFixed(1) + '%';
  changeEl.className = 'price-change ' + (isUp ? 'up' : 'down');

  document.getElementById('price-7d').innerHTML =
    '7일 <span class="' + (is7dUp ? 'color-green' : 'color-red') + '">'
    + (is7dUp ? '+' : '') + btcPrice.change7d.toFixed(1) + '%</span>';

  const athDrop = ((btcPrice.ath - btcPrice.current) / btcPrice.ath * 100).toFixed(1);
  document.getElementById('price-ath').innerHTML =
    'ATH 대비 <span class="color-red">-' + athDrop + '%</span>';

  const updatedEl = document.getElementById('last-updated');
  updatedEl.textContent = lastUpdated + ' 기준';
  updatedEl.style.color = isUp ? 'var(--green)' : 'var(--red)';

  const alertEl = document.getElementById('manip-alert-header');
  if (media.manipulationAlert) {
    alertEl.classList.remove('hidden');
    document.getElementById('manip-alert-text').textContent = media.manipulationReason;
  } else {
    alertEl.classList.add('hidden');
  }
}

function renderScoreCard(scores) {
  ['short', 'mid', 'long'].forEach(k => {
    const v = scores[k];
    const color = scoreColor(v);

    const fill = document.getElementById('score-fill-' + k);
    fill.style.width = v + '%';
    fill.style.setProperty('--fill-color', color);

    const num = document.getElementById('score-num-' + k);
    num.innerHTML = v + '<span class="score-verdict" style="color:' + color + '">' + scoreLabel(v) + '</span>';
    num.style.color = color;
  });

  document.getElementById('score-comment').textContent = scoreComment(scores);
}

function fgColor(v) {
  if (v <= 25) return '#ef4444';
  if (v <= 45) return '#f97316';
  if (v <= 55) return '#eab308';
  if (v <= 75) return '#84cc16';
  return '#22c55e';
}

function fgLabelText(v) {
  if (v <= 25) return '극도의 공포';
  if (v <= 45) return '공포';
  if (v <= 55) return '중립';
  if (v <= 75) return '탐욕';
  return '극도의 탐욕';
}

function renderMediaSection(media) {
  const score = media.mediaScore;
  const color = scoreColor(score);

  document.getElementById('media-score-num').textContent = score;
  document.getElementById('media-score-num').style.color = color;
  document.getElementById('media-score-fill').style.width = score + '%';
  document.getElementById('media-score-fill').style.background = color;

  // 공포탐욕 원형
  const fg = media.fearGreedIndex;
  const fgC = fgColor(fg);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - fg / 100);

  document.getElementById('fg-circle-num').textContent = fg;
  document.getElementById('fg-circle-num').style.color = fgC;
  document.getElementById('fg-arc').setAttribute('stroke', fgC);
  document.getElementById('fg-arc').setAttribute('stroke-dashoffset', offset);
  document.getElementById('fg-arc').setAttribute('stroke-dasharray', circ);

  document.getElementById('fg-label').textContent = fgLabelText(fg);
  document.getElementById('fg-label').style.color = fgC;
  document.getElementById('fg-desc').textContent =
    fg <= 30
      ? '언론이 극단적 공포를 조장하는 구간입니다. 역발상적으로 매수 기회일 수 있습니다.'
      : fg >= 70
      ? '언론이 극단적 탐욕을 조장하는 구간입니다. 고점 인근일 가능성이 있습니다.'
      : '언론 센티멘트가 중립 또는 일반 구간입니다.';

  // F&G 30일 추세바
  const trendWrap = document.getElementById('fg-trend-bar');
  if (media.fearGreedHistory && media.fearGreedHistory.length > 1) {
    const hist = media.fearGreedHistory;
    trendWrap.style.display = 'block';
    const barsHtml = hist.map((v, i) => {
      const isToday = i === hist.length - 1;
      return `<div class="fg-trend-cell${isToday ? ' today' : ''}" style="background:${fgColor(v)}" title="${hist.length - i}일 전: ${v}"></div>`;
    }).join('');
    document.getElementById('fg-trend-cells').innerHTML = barsHtml;
    // 추세 요약
    const avg30 = Math.round(hist.reduce((a, b) => a + b, 0) / hist.length);
    const avg7 = hist.length >= 7
      ? Math.round(hist.slice(-7).reduce((a, b) => a + b, 0) / 7)
      : avg30;
    const trendDir = avg7 > avg30 ? '↑ 회복세' : avg7 < avg30 ? '↓ 하락세' : '→ 유지';
    document.getElementById('fg-trend-summary').textContent =
      `30일 평균 ${avg30} · 7일 평균 ${avg7} ${trendDir}`;
  } else {
    trendWrap.style.display = 'none';
  }

  // 커뮤니티 감정
  const socialCard = document.getElementById('social-card');
  if (media.social && media.social.upPct > 0) {
    socialCard.style.display = 'block';
    const up = media.social.upPct;
    const down = media.social.downPct;
    document.getElementById('social-bar-up').style.width = up + '%';
    document.getElementById('social-bar-down').style.width = down + '%';
    document.getElementById('social-up-pct').textContent = up.toFixed(1);
    document.getElementById('social-down-pct').textContent = down.toFixed(1);
    const users = media.social.watchlistUsers;
    document.getElementById('social-watchlist').textContent =
      users >= 1e6 ? (users / 1e6).toFixed(1) + 'M 관심' : Math.round(users / 1e3) + 'K 관심';
  }

  // 조작 경보
  const manipEl = document.getElementById('manip-alert-media');
  if (media.manipulationAlert) {
    manipEl.style.display = 'flex';
    document.getElementById('manip-alert-media-desc').textContent = media.manipulationReason;
  } else {
    manipEl.style.display = 'none';
  }

  // 뉴스 목록
  const list = document.getElementById('news-list');
  list.innerHTML = media.news.map(n => `
    <div class="news-card ${n.bias}">
      <div class="news-title">${n.title}</div>
      <div class="news-meta">
        <span class="news-source">${n.source}</span>
        <span class="news-date">${n.date}</span>
        <span class="bias-tag ${n.bias}">${biasTxt(n.bias)}</span>
      </div>
    </div>
  `).join('');
}

function biasTxt(b) {
  return { extreme_negative: '극단 부정', negative: '부정', positive: '긍정', neutral: '중립' }[b] || b;
}

function renderPolicySection(policy) {
  const score = policy.score;
  const color = scoreColor(score);

  document.getElementById('policy-score-num').textContent = score;
  document.getElementById('policy-score-num').style.color = color;
  document.getElementById('policy-score-fill').style.width = score + '%';
  document.getElementById('policy-score-fill').style.background = color;
  document.getElementById('policy-summary').textContent = policy.summary;

  // 펀더멘탈 불변 배지
  const badge = document.getElementById('fundamental-badge');
  badge.style.display = policy.noChangeConfirmed ? 'flex' : 'none';

  // 타임라인
  const tl = document.getElementById('policy-timeline');
  tl.innerHTML = policy.items.map((item, i) => `
    <div class="timeline-item">
      ${i < policy.items.length - 1 ? '<div class="timeline-line"></div>' : ''}
      <div class="timeline-dot ${item.impact}"></div>
      <div class="timeline-content">
        <div class="timeline-date">${item.date}</div>
        <div class="timeline-title">${item.title}</div>
        <div class="timeline-detail">${item.detail}</div>
      </div>
    </div>
  `).join('');
}

function renderAiSection(ai) {
  const score = ai.score;
  const color = scoreColor(score);

  document.getElementById('ai-score-num').textContent = score;
  document.getElementById('ai-score-num').style.color = color;
  document.getElementById('ai-score-fill').style.width = score + '%';
  document.getElementById('ai-score-fill').style.background = color;
  document.getElementById('ai-summary').textContent = ai.summary;

  // 온체인 지표 렌더링
  if (ai.onchain) {
    const oc = ai.onchain;
    document.getElementById('oc-hashrate').textContent = oc.hashRate;
    const htEl = document.getElementById('oc-hashrate-trend');
    htEl.textContent = oc.hashRateTrend === 'up' ? '7d ▲' : '7d ▼';
    htEl.className = 'onchain-trend ' + (oc.hashRateTrend === 'up' ? 'trend-up' : 'trend-down');

    document.getElementById('oc-addresses').textContent = oc.activeAddresses.toLocaleString();
    const atEl = document.getElementById('oc-addresses-trend');
    atEl.textContent = oc.activeAddressesTrend === 'up' ? '7d ▲' : '7d ▼';
    atEl.className = 'onchain-trend ' + (oc.activeAddressesTrend === 'up' ? 'trend-up' : 'trend-down');

    document.getElementById('oc-mempool').textContent = oc.mempoolCount.toLocaleString();
    document.getElementById('oc-fee').textContent = '수수료 ' + oc.recommendedFee + ' sat/vB';

    document.getElementById('oc-volume').textContent = oc.volume24h;
    document.getElementById('oc-difficulty').textContent = '난이도 ' + oc.difficulty;

    document.getElementById('oc-dominance').textContent = oc.btcDominance === '—' ? '—' : oc.btcDominance + '%';
    document.getElementById('oc-funding').textContent = oc.fundingRate + '%';
    const frVal = parseFloat(oc.fundingRate);
    const frSignal = document.getElementById('oc-funding-signal');
    if (frVal < -0.001) {
      frSignal.textContent = '매도 과잉 (역발상 ↑)';
      frSignal.style.color = 'var(--green)';
    } else if (frVal > 0.01) {
      frSignal.textContent = '과열 주의';
      frSignal.style.color = 'var(--red)';
    } else {
      frSignal.textContent = '중립';
      frSignal.style.color = 'var(--text2)';
    }

    document.getElementById('onchain-grid').style.display = 'grid';
  }

  const list = document.getElementById('ai-news-list');
  list.innerHTML = ai.news.map(n => `
    <div class="ai-news-card ${n.impact}">
      <div class="ai-news-title">${n.title}</div>
      <div class="ai-news-detail">${n.detail}</div>
      <div class="ai-news-meta">
        <span class="ai-news-date">${n.date}</span>
        <span class="impact-tag ${n.impact}">${impactTxt(n.impact)}</span>
      </div>
    </div>
  `).join('');
}

function impactTxt(i) {
  return { positive: 'BTC 긍정', negative: 'BTC 부정', neutral: '중립' }[i] || i;
}

// ─── 탭 전환 ───────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + target).classList.add('active');
    });
  });
}

// ─── 시간 포맷 헬퍼 ───────────────────────────────────
function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 60000);
  if (diff < 60) return diff + 'm ago';
  if (diff < 1440) return Math.floor(diff / 60) + 'h ago';
  const days = Math.floor(diff / 1440);
  if (days < 30) return days + 'd ago';
  return Math.floor(days / 30) + 'mo ago';
}

// ─── 공포탐욕 fetch (Alternative.me, 30일 히스토리 포함) ──
async function fetchFearGreed() {
  const res = await fetch('https://api.alternative.me/fng/?limit=30');
  const json = await res.json();
  const current = parseInt(json.data[0].value);
  const history = json.data.map(d => parseInt(d.value)).reverse(); // 오래된 → 최신 순
  return { current, history };
}

// ─── 뉴스 fetch (서버 프록시 경유) ────────────────────
async function fetchCryptoNews() {
  const res = await fetch('/api/news');
  const json = await res.json();
  const allNews = json.results.map(item => ({
    title: item.title,
    source: item.source.title,
    bias: item._bias || 'neutral',
    date: item._date || timeAgo(item.published_at),
    url: item.url || ''
  }));
  // _scoring: 서버가 전체 RSS 센티멘트 집계 제공
  return { allNews, _scoring: json._scoring || null };
}

// ─── 미디어 점수 계산 (전체 모수 기반) ──────────────────
function calcMediaScore(fearGreed, news, scoring, social) {
  const biasMap = { extreme_negative: 5, negative: 25, neutral: 50, positive: 80 };
  // scoring 데이터 있으면 전체 RSS 모수 사용
  let avg;
  if (scoring && scoring.total > 0) {
    const neutral = scoring.total - scoring.positive - scoring.negative;
    avg = (scoring.positive * 80 + neutral * 50 + scoring.negative * 15) / scoring.total;
  } else {
    avg = news.length
      ? news.reduce((s, n) => s + (biasMap[n.bias] || 50), 0) / news.length
      : fearGreed;
  }
  // 소셜 감정 반영 (있으면 20% 가중)
  if (social && social.upPct > 0) {
    const socialScore = social.upPct; // 0-100 스케일
    return Math.round(fearGreed * 0.4 + avg * 0.4 + socialScore * 0.2);
  }
  return Math.round(fearGreed * 0.5 + avg * 0.5);
}

// ─── 커뮤니티 감정 fetch (CoinGecko) ────────────────
async function fetchSocialSentiment() {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=false&community_data=true&developer_data=false'
  );
  const data = await res.json();
  return {
    upPct: data.sentiment_votes_up_percentage || 0,
    downPct: data.sentiment_votes_down_percentage || 0,
    watchlistUsers: data.watchlist_portfolio_users || 0
  };
}

// ─── 실시간 가격 fetch (CoinGecko) ──────────────────
async function fetchLivePrice() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin&price_change_percentage=7d'
    );
    const [coin] = await res.json();
    MOCK_DATA.btcPrice = {
      current: Math.round(coin.current_price),
      change24h: parseFloat(coin.price_change_percentage_24h.toFixed(1)),
      change7d: parseFloat((coin.price_change_percentage_7d_in_currency || 0).toFixed(1)),
      ath: Math.round(coin.ath)
    };
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    MOCK_DATA.lastUpdated = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    render(MOCK_DATA);
  } catch(e) {
    console.warn('가격 로드 실패, 목업 데이터 사용:', e);
  }
}

// ─── 언론 데이터 fetch (공포탐욕 + 뉴스 + 소셜) ──────
async function fetchMediaData() {
  // 공포탐욕 지수 (항상 실시간, 30일 히스토리 포함)
  try {
    const fg = await fetchFearGreed();
    MOCK_DATA.media.fearGreedIndex = fg.current;
    MOCK_DATA.media.fearGreedHistory = fg.history;
    MOCK_DATA.media.mediaScore = calcMediaScore(fg.current, MOCK_DATA.media.news, null, MOCK_DATA.media.social);
    render(MOCK_DATA);
  } catch(e) {
    console.warn('공포탐욕 로드 실패:', e);
  }

  // 커뮤니티 감정 (CoinGecko)
  try {
    const social = await fetchSocialSentiment();
    MOCK_DATA.media.social = social;
    MOCK_DATA.media.mediaScore = calcMediaScore(MOCK_DATA.media.fearGreedIndex, MOCK_DATA.media.news, null, social);
    render(MOCK_DATA);
  } catch(e) {
    console.warn('소셜 감정 로드 실패:', e);
  }

  // 뉴스 (서버 프록시, 전체 모수 점수 산출)
  try {
    const { allNews, _scoring } = await fetchCryptoNews();
    const displayNews = allNews.slice(0, 8);  // 표시: 최신 8건
    MOCK_DATA.media.news = displayNews;
    MOCK_DATA.media.mediaScore = calcMediaScore(MOCK_DATA.media.fearGreedIndex, displayNews, _scoring, MOCK_DATA.media.social);
    // 조작 경보: 비율 기반 (극단부정 >15% AND F&G <25)
    const extremeCount = allNews.filter(n => n.bias === 'extreme_negative').length;
    const extremeRatio = allNews.length > 0 ? extremeCount / allNews.length : 0;
    MOCK_DATA.media.manipulationAlert = extremeRatio > 0.15 && MOCK_DATA.media.fearGreedIndex < 25;
    if (MOCK_DATA.media.manipulationAlert)
      MOCK_DATA.media.manipulationReason = `극단 부정 ${(extremeRatio * 100).toFixed(0)}% (${extremeCount}/${allNews.length}건) — F&G ${MOCK_DATA.media.fearGreedIndex} 극단 공포 구간`;
    render(MOCK_DATA);
  } catch(e) {
    console.warn('뉴스 로드 실패, 목업 사용:', e);
  }
}

// ─── 정책 데이터 fetch ────────────────────────────────
async function fetchPolicyData() {
  try {
    const res = await fetch('/api/policy');
    const data = await res.json();
    MOCK_DATA.policy = data;
    render(MOCK_DATA);
  } catch(e) {
    console.warn('정책 데이터 로드 실패:', e);
  }
}

// ─── AI·전력 데이터 fetch ─────────────────────────────
async function fetchAiData() {
  try {
    const res = await fetch('/api/aipower');
    const data = await res.json();
    MOCK_DATA.aiPower = data;
    render(MOCK_DATA);
  } catch(e) {
    console.warn('AI 데이터 로드 실패:', e);
  }
}

// ─── 초기화 ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  render(MOCK_DATA);            // 목업 즉시 표시
  fetchLivePrice();             // 실시간 가격
  fetchMediaData();             // 공포탐욕 + 뉴스
  fetchPolicyData();            // 정책
  fetchAiData();                // AI·전력
  setInterval(fetchLivePrice, 60000);        // 가격: 60초
  setInterval(fetchMediaData, 60 * 60000);  // 언론: 1시간
  setInterval(fetchPolicyData, 60 * 60000); // 정책: 1시간
  setInterval(fetchAiData, 60 * 60000);     // AI: 1시간

  // 스플래시 페이드아웃
  const splash = document.getElementById('splash');
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 700);
  }, 2000);
});
