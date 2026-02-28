const MOCK_DATA = {
  btcPrice: {
    current: 84500,
    change24h: -4.2,
    change7d: -11.8,
    ath: 108353
  },
  lastUpdated: '2026-02-27 09:30',

  media: {
    fearGreedIndex: 22,       // 0-100 (낮을수록 극도 공포)
    fearGreedHistory: [45,42,38,35,33,30,28,25,22,20,18,20,25,30,35,40,38,35,30,28,25,22,20,18,15,18,20,22,25,22],
    mediaScore: 18,           // 0-100 (낮을수록 극단적 부정 보도)
    manipulationAlert: true,  // 조작 의심 경보
    manipulationReason: '단기 급락과 동시에 주요 매체 부정 기사 집중 게재',
    social: {
      upPct: 54.4,
      downPct: 45.6,
      watchlistUsers: 2347456
    },
    news: [
      {
        title: '비트코인 급락... "10만 달러는 버블이었다" 전문가 경고',
        source: 'Bloomberg',
        bias: 'extreme_negative',
        date: '2h ago',
        url: '#'
      },
      {
        title: 'BTC 마이너 항복 신호 포착, 추가 하락 불가피',
        source: 'CoinDesk',
        bias: 'negative',
        date: '4h ago',
        url: '#'
      },
      {
        title: '암호화폐 시장 "공포" 극단... 개인 투자자 대규모 손절',
        source: 'Reuters',
        bias: 'extreme_negative',
        date: '6h ago',
        url: '#'
      },
      {
        title: '연준 금리 불확실성에 위험자산 전반 하락세',
        source: 'CNBC',
        bias: 'negative',
        date: '9h ago',
        url: '#'
      },
      {
        title: '고래 지갑, 하락 중 오히려 BTC 추가 매수',
        source: 'Glassnode',
        bias: 'positive',
        date: '12h ago',
        url: '#'
      }
    ]
  },

  policy: {
    score: 82,                  // 0-100 (높을수록 정책 우호적)
    noChangeConfirmed: true,    // 펀더멘탈 불변 확인
    summary: '트럼프 행정부 친암호화폐 기조 유지, 전략 준비금 법안 진행 중',
    items: [
      {
        date: '2026-02-20',
        title: '미국 전략 비트코인 준비금 법안 상원 금융위 통과',
        impact: 'positive',
        detail: '행정명령 13799호에 따른 국가 비트코인 준비금 구축 첫 단계'
      },
      {
        date: '2026-02-10',
        title: '트럼프, 암호화폐 규제 완화 행정명령 서명',
        impact: 'positive',
        detail: 'SEC의 과도한 규제 철폐, 친암호화폐 환경 조성 공식화'
      },
      {
        date: '2026-01-28',
        title: 'SEC 신임 의장 폴 앳킨스 취임, 비트코인 ETF 확대 방침',
        impact: 'positive',
        detail: '기관 투자자 진입 장벽 추가 완화 예고'
      },
      {
        date: '2026-01-15',
        title: '미 재무부, CBDC 개발 중단 공식 선언',
        impact: 'positive',
        detail: '달러 디지털화보다 민간 암호화폐 생태계 지원으로 정책 전환'
      },
      {
        date: '2025-12-20',
        title: '연방 준비제도, 비트코인 담보 대출 허용 검토',
        impact: 'positive',
        detail: '기관 자산으로서 BTC 지위 공식 인정 전단계'
      }
    ]
  },

  aiPower: {
    score: 68,                  // 0-100 (높을수록 BTC에 우호적)
    onchainScore: 72,           // 온체인 건강도 점수 (해시레이트+활성주소+멤풀+도미넌스+펀딩)
    aiNewsScore: 55,            // AI·에너지 뉴스 감성 점수
    summary: 'AI 데이터센터 전력 수요 급증, 단기 채굴 비용 압박 vs 장기 에너지 인프라 확대',
    news: [
      {
        title: 'MS·구글·아마존, 데이터센터 전력 확보 경쟁... 채굴업체와 충돌',
        impact: 'neutral',
        date: '1d ago',
        detail: '전력 단가 상승 → 채굴 비용 증가 → 약한 채굴자 이탈 → 장기적으로 공급 감소'
      },
      {
        title: '엔비디아 블랙웰 GPU 출하 본격화, AI 전력 수요 2배 급증 전망',
        impact: 'negative',
        date: '2d ago',
        detail: '단기적으로 BTC 채굴 전력 경쟁 심화'
      },
      {
        title: '미국 원전 르네상스... 텍사스·아이오와 핵발전 용량 확대 계획',
        impact: 'positive',
        date: '3d ago',
        detail: '2027~2028년 대규모 전력 공급 증가 예정 → 채굴 비용 하락 기대'
      },
      {
        title: '비트코인 채굴업체, 잉여 전력 AI 컴퓨팅에 임대 수익 다각화',
        impact: 'positive',
        date: '4d ago',
        detail: '채굴업체가 AI 인프라 수요를 수익화, 재무 건전성 개선'
      },
      {
        title: 'IEA 보고서: AI·암호화폐 전력 수요, 2027년 세계 전력의 3% 달할 것',
        impact: 'neutral',
        date: '5d ago',
        detail: '전력 부족 우려 vs 신재생·핵에너지 투자 가속화 유인'
      }
    ]
  }
};
