process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');

// ============================================================================
// 1. Threads API 인증 정보
// ============================================================================
const THREADS_USER_ID = (process.env.THREADS_USER_ID && process.env.THREADS_USER_ID.trim() !== "")
  ? process.env.THREADS_USER_ID.trim()
  : "29066378143019292";

const THREADS_ACCESS_TOKEN = (process.env.THREADS_ACCESS_TOKEN && process.env.THREADS_ACCESS_TOKEN.trim() !== "")
  ? process.env.THREADS_ACCESS_TOKEN.trim()
  : "THAAXRloFIEjRBYmJQdW5rZAVZA3MlhDcjlrY2E3dktSYlJSZAERJdXdqYi1vc3Q0TDNiVDFGZAkZAFZAUlUdFBINXNNZAzhrZAHRBYXA4ZA2pJbDloVnV4NmR6c01BYjU5X0JEVDZASSnNPeXM5dlVrZAUpEa3JpelRfNFpYVXlJenVnemdGZAVlVZAwZDZD";

// ============================================================================
// 2. 야후 파이낸스 실시간 데이터 수집기 (일봉 + 주봉 멀티 타임프레임)
// ============================================================================
function fetchYahooJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ① Wilder's RSI (14일)
function calculateWilderRSI(prices, period = 14) {
  if (prices.length <= period) return 50.0;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + (diff >= 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100.0;
  return 100.0 - (100.0 / (1.0 + avgGain / avgLoss));
}

// ② 볼린저밴드 %B (20일, 2.0 표준편차)
function calculateBollingerBandPctB(prices, period = 20, numStd = 2.0) {
  if (prices.length < period) return 50.0;
  const slice = prices.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period);
  const upper = sma + numStd * std, lower = sma - numStd * std;
  if (upper === lower) return 50.0;
  return ((prices[prices.length - 1] - lower) / (upper - lower)) * 100.0;
}

// ③ 스토캐스틱 슬로우 %D (20, 3, 3)
function calculateStochasticSlow(highs, lows, closes, n = 20, m = 3, t = 3) {
  if (closes.length < n + m + t) return 50.0;
  let fastKs = [];
  for (let i = n - 1; i < closes.length; i++) {
    const hSlice = highs.slice(i - n + 1, i + 1);
    const lSlice = lows.slice(i - n + 1, i + 1);
    const highest = Math.max(...hSlice);
    const lowest = Math.min(...lSlice);
    const fastK = highest === lowest ? 50 : ((closes[i] - lowest) / (highest - lowest)) * 100;
    fastKs.push(fastK);
  }
  let slowKs = [];
  for (let i = m - 1; i < fastKs.length; i++) {
    const slice = fastKs.slice(i - m + 1, i + 1);
    slowKs.push(slice.reduce((a, b) => a + b, 0) / m);
  }
  if (slowKs.length < t) return 50.0;
  const lastT = slowKs.slice(-t);
  return lastT.reduce((a, b) => a + b, 0) / t;
}

// ============================================================================
// 3. 5대 지표별 실시간 상태 해석기 (주봉 60주·120주 + 일봉 200일 통합)
// ============================================================================
function getIndicatorDescs(disp, rsi, bb, stoch, vix, heatIndex, disp60w = 0, disp120w = 10) {
  let dispDesc = '';
  if (disp >= 10) dispDesc = '대세 상승 순항';
  else if (disp > 0) dispDesc = '200일선 상회';
  else if (disp60w >= -2.5) dispDesc = '주봉 60주선 지지';
  else if (disp120w >= -3.5) dispDesc = '120주 마지노선';
  else dispDesc = '매크로 추세 이탈';

  const w60Desc = disp60w >= 5 ? '중기 추세 순항' : disp60w >= -2.5 ? '60주 핵심 지지권' : '60주선 하회';
  const w120Desc = disp120w >= 10 ? '장기 정배열 견고' : disp120w >= -3.5 ? '120주 인생지지권' : '장기 추세 붕괴';

  const rsiDesc = rsi >= 70 ? '고점 과열권' : rsi <= 35 ? '단기 침체권' : rsi <= 45 ? '침체 탈출 시도' : '중립 안정권';
  const bbDesc = bb >= 80 ? '상단 밴드 근접' : bb <= 0 ? '하단 이탈(투매)' : bb <= 25 ? '하단 밴드 지지' : '밴드 내 순항';
  const stochDesc = stoch >= 80 ? '단기 과열권' : stoch <= 20 ? '바닥 침체권' : stoch <= 35 ? '골든크로스 포착' : '상승 탄력 유지';
  const vixDesc = vix >= 25 ? '극심한 공포' : vix >= 20 ? '공포 심리 유입' : vix >= 16 ? '공포 완화 중' : '안정 국면 유지';
  const heatDesc = heatIndex >= 75 ? '고점 과열 경보' : heatIndex <= 30 ? '극단 침체 구간' : heatIndex <= 50 ? '눌림목 변곡점' : '적정 안정 구간';

  return { dispDesc, w60Desc, w120Desc, rsiDesc, bbDesc, stochDesc, vixDesc, heatDesc };
}

// ============================================================================
// 4. 시장 상황별 100% 동적 헤드라인 및 시스템 상태 평가 (v4.0: 일봉 200일 + 주봉 60주·120주)
// ============================================================================
function evaluateSystemRegime(disp, rsi, bb, stoch, vix, aboveSma20, weeklyData = null) {
  const disp60w = weeklyData ? weeklyData.disp60w : disp;
  const disp120w = weeklyData ? weeklyData.disp120w : disp + 10;
  const weeklyBullAligned = weeklyData ? weeklyData.weeklyBullAligned : true;
  const slope60w = weeklyData ? weeklyData.slope60w : 1.0;

  // 주봉 60주선 이격도와 일봉 200일선 이격도를 결합한 추세 점수
  const effectiveDisp = (disp * 0.6) + (disp60w * 0.4);
  const sDisp = clamp(((effectiveDisp - (-10.0)) / 30.0) * 100.0, 0.0, 100.0);
  const sRsi = clamp(((rsi - 25.0) / 50.0) * 100.0, 0.0, 100.0);
  const sBb = clamp(bb, 0.0, 100.0);
  const sStoch = clamp(stoch, 0.0, 100.0);
  const sVix = clamp(((35.0 - vix) / 23.0) * 100.0, 0.0, 100.0);

  // 5대 지표 가중 합산 복합 과열도 (Heat Index)
  const heatIndex = Math.round((0.35 * sDisp) + (0.15 * sRsi) + (0.15 * sBb) + (0.15 * sStoch) + (0.20 * sVix));

  let headline = "";
  let subIntro = "";
  let badge = "🟢골디락스";
  let posText = "• QLD: 75% (안정 적립 프로토콜 실행)\n• GPIX: 25% (현금흐름 방어 유지)";
  let bottomText = "일봉 200일선 및 주봉 60·120주선 정배열 순항. 기본 루틴 적립을 진행합니다.";

  if (disp > 0) {
    // [구간 A] 일봉 200일선(주봉 40주선) 위
    if (disp >= 12.0 || heatIndex >= 75) {
      // [1] 고점 과열
      headline = '"과열 구간에선 탐욕을 멈추고, 방어벽을 높인다."';
      subIntro = "단기 과열 경보가 발령되었습니다. 추격 매수를 멈추고 GPIX 월배당(연 8.3%) 비중을 확대해 조정 안전 마진을 확보합니다.";
      badge = "💰고점과열";
      posText = "• QLD: 30% (레버리지 비중 축소)\n• GPIX: 70% (방어자산 대폭 확대)";
      bottomText = "고점 과열 경보. 방어자산 비중을 확대합니다.";
    } else if (disp <= 2.0 && vix >= 22.0 && !aboveSma20) {
      // [2] 200일선 테스트 경계 (주봉 60주선 위이므로 전면 동결 대신 50:50 속도 조절)
      headline = '"일봉 변곡점 구간, 속도를 줄이고 주봉 지지를 확인한다."';
      subIntro = "일봉 200일선 지지 테스트 구간이나 주봉 60·120주선 상승 추세는 견고합니다. 공격과 방어를 50:50으로 균형 배치합니다.";
      badge = "🟡지지선점검";
      posText = "• QLD: 50% (분할 적립 속도 조절)\n• GPIX: 50% (방어 및 배당 실탄 확충)";
      bottomText = "주봉 추세 양호. 50:50 균형 적립으로 대응합니다.";
    } else {
      // [3] 진짜 골디락스 (일봉 200일선 & 주봉 60·120주선 정배열 순항)
      headline = '"대세 상승장에선, 2배 레버리지 복리를 극대화한다."';
      subIntro = "일봉 200일선 및 주봉 60·120주선 정배열 구간입니다. QLD로 복리 성장을 견인하되 GPIX 월배당(연 8.3%)을 상시 적립해 조정에 대비합니다.";
      badge = "🟢골디락스";
      posText = "• QLD: 75% (안정 적립 프로토콜 실행)\n• GPIX: 25% (현금흐름 방어 유지)";
      bottomText = "일봉·주봉 정배열 추세 양호. 기본 루틴을 진행합니다.";
    }
  } else {
    // [구간 B] 일봉 200일선 아래 — 주봉 60주선 & 120주선으로 '눌림목' vs '대폭락장' 판독!
    const isWeekly60Support = (disp60w >= -2.5) && weeklyBullAligned && (slope60w >= -0.3);
    const isNearWeekly120 = (disp120w >= -3.5 && disp120w <= 4.0) && weeklyBullAligned;

    if ((vix < 22.0 && aboveSma20) || (isNearWeekly120 && (rsi <= 38.0 || aboveSma20))) {
      // [4] 바닥 반등 확인 or 주봉 120주선 인생 지지선 스나이퍼 포착
      headline = '"공포의 극점이 지났다, 비축한 실탄을 발사한다."';
      subIntro = "주봉 핵심 지지선 위에서 반등 신호가 포착되었습니다. 비축한 현금 및 GPIX 배당 실탄을 3배 레버리지(TQQQ)에 집중 투입합니다.";
      badge = "🎯골든스나이퍼";
      posText = "• TQQQ: 80% (바닥 반등 확인! 집중 타격)\n• GPIX: 20% (잔여 방어 유지)";
      bottomText = "주봉 지지 및 반등 확인. 집중 타격을 개시합니다.";
    } else if (isWeekly60Support) {
      // [5] 일봉 200일선은 이탈했으나 주봉 60주선 핵심 지지 중 (25년 역사적 1년 승률 86.8% 눌림목 구간!)
      headline = '"일봉은 흔들려도, 주봉 60주선 지지는 기회다."';
      subIntro = "일봉 200일선은 소폭 이탈했으나 주봉 60·120주선 정배열이 살아있는 중기 눌림목(승률 86.8%) 구간입니다. 50:50 분할 매수와 방어를 병행합니다.";
      badge = "🟡60주선눌림목";
      posText = "• QLD: 50% (주봉 60주선 지지 분할매수)\n• GPIX: 50% (방어 및 배당 실탄 축적)";
      bottomText = "주봉 60·120주 정배열 유지 중. 50:50 눌림목 대응을 실행합니다.";
    } else {
      // [6] 주봉 60주선 붕괴 낙하 중 or 주봉 120주선 마지노선 이탈 (진짜 대세 하락장)
      headline = '"주봉 지지선이 무너졌다, 칼날을 잡지 마라."';
      subIntro = "일봉 200일선에 이어 주봉 60주선까지 이탈한 하락 구간입니다. 주봉 120주선 지지 또는 반등 확인 전까지 매수를 동결하고 배당 실탄만 비축합니다.";
      badge = "🚨실탄비축(하락)";
      posText = "• QLD: 0% (매수 전면 동결! 하락 진행)\n• GPIX: 100% (MDD 방어 & 실탄 100% 비축)";
      bottomText = "주봉 120주선 지지 또는 반등 전까지 매수를 금합니다.";
    }
  }

  return { heatIndex, badge, headline, subIntro, posText, bottomText };
}

// ============================================================================
// 5. Threads API 포스팅 (2단계: 컨테이너 생성 -> 실제 발행)
// ============================================================================
function sendRequest(path, postData) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.threads.net',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0'
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function publishToThreadsSingle(text, tag) {
  console.log(`📤 1단계: Threads 미디어 컨테이너 생성 중 (토픽: ${tag})...`);
  const containerData = new URLSearchParams({
    media_type: 'TEXT',
    text: text,
    topic_tag: tag,
    access_token: THREADS_ACCESS_TOKEN
  }).toString();

  const res1 = await sendRequest(`/v1.0/${THREADS_USER_ID}/threads`, containerData);
  if (res1.status !== 200 || !res1.body.id) {
    console.error(`❌ [${tag}] 컨테이너 생성 실패:`, res1.body);
    return false;
  }
  const creationId = res1.body.id;
  console.log(`✅ [${tag}] 컨테이너 생성 완료 (ID: ${creationId})`);

  // Meta 서버 분산 DB 동기화 대기 (최소 5초 대기 필수)
  console.log(`⏳ [${tag}] Meta 서버 동기화 대기 중 (5초)...`);
  await new Promise(r => setTimeout(r, 5000));

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`🚀 [${tag}] 2단계: Threads 실제 발행 중... (시도 ${attempt}/3)`);
    const publishData = new URLSearchParams({
      creation_id: creationId,
      access_token: THREADS_ACCESS_TOKEN
    }).toString();

    const res2 = await sendRequest(`/v1.0/${THREADS_USER_ID}/threads_publish`, publishData);
    if (res2.status === 200 && res2.body.id) {
      console.log(`🎉 [${tag}] 포스팅 성공! (게시물 ID: ${res2.body.id})`);
      return res2.body.id;
    }

    if (attempt < 3) {
      console.log(`⏳ [${tag}] Meta 서버 동기화 지연 감지, 3초 후 재시도...`);
      await new Promise(r => setTimeout(r, 3000));
    } else {
      console.error(`❌ [${tag}] 포스팅 발행 실패:`, res2.body);
      return false;
    }
  }
}

async function publishToThreads(text) {
  console.log('📱 Threads 2대 커뮤니티 동시 발행 시작 (Investing & QLD)...');
  const results = {};

  // 1. Investing 커뮤니티 발행
  results.investing = await publishToThreadsSingle(text, 'Investing');

  // 토픽 간 Meta 분산 DB 동기화 대기 (5초)
  console.log('⏳ 다음 토픽(QLD) 발행 전 대기 (5초)...');
  await new Promise(r => setTimeout(r, 5000));

  // 2. QLD 커뮤니티 발행
  results.qld = await publishToThreadsSingle(text, 'QLD');

  return results;
}

// ============================================================================
// 6. 실시간 시장 데이터 및 5대 지표 수집기 (일봉 + 주봉 60·120주선 통합)
// ============================================================================
async function fetchRealtimeMarketData() {
  const [qqqDailyJson, qqqWeeklyJson, vixJson] = await Promise.all([
    fetchYahooJSON('https://query1.finance.yahoo.com/v8/finance/chart/QQQ?interval=1d&range=2y'),
    fetchYahooJSON('https://query1.finance.yahoo.com/v8/finance/chart/QQQ?interval=1wk&range=5y'),
    fetchYahooJSON('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d')
  ]);

  const quote = qqqDailyJson.chart.result[0].indicators.quote[0];
  let highs = [], lows = [], closes = [];
  for (let i = 0; i < quote.close.length; i++) {
    if (quote.close[i] !== null && quote.high[i] !== null && quote.low[i] !== null) {
      highs.push(quote.high[i]);
      lows.push(quote.low[i]);
      closes.push(quote.close[i]);
    }
  }

  const wQuote = qqqWeeklyJson.chart.result[0].indicators.quote[0];
  let wCloses = [];
  for (let i = 0; i < wQuote.close.length; i++) {
    if (wQuote.close[i] !== null && wQuote.close[i] !== undefined) {
      wCloses.push(wQuote.close[i]);
    }
  }

  const vixMeta = vixJson.chart.result[0].meta;
  const vix = vixMeta.regularMarketPrice || vixMeta.chartPreviousClose || 20.8;

  const qqqPrice = closes[closes.length - 1];
  const sma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const disp = ((qqqPrice - sma200) / sma200) * 100;
  const aboveSma20 = qqqPrice >= sma20;

  // 주봉 60주선 & 120주선 연산
  const sma60w = wCloses.slice(-60).reduce((a, b) => a + b, 0) / 60;
  const sma120w = wCloses.slice(-120).reduce((a, b) => a + b, 0) / 120;
  const sma60wPrev = wCloses.slice(-64, -4).reduce((a, b) => a + b, 0) / 60;
  const sma120wPrev = wCloses.slice(-124, -4).reduce((a, b) => a + b, 0) / 120;

  const disp60w = ((qqqPrice - sma60w) / sma60w) * 100;
  const disp120w = ((qqqPrice - sma120w) / sma120w) * 100;
  const slope60w = ((sma60w - sma60wPrev) / sma60wPrev) * 100;
  const slope120w = ((sma120w - sma120wPrev) / sma120wPrev) * 100;
  const weeklyBullAligned = (sma60w >= sma120w) && (slope120w >= -0.2);

  const weeklyData = {
    sma60w,
    sma120w,
    disp60w,
    disp120w,
    slope60w,
    slope120w,
    weeklyBullAligned
  };

  // 5대 지표 연산
  const rsi = calculateWilderRSI(closes, 14);
  const bb = calculateBollingerBandPctB(closes, 20, 2.0);
  const stoch = calculateStochasticSlow(highs, lows, closes, 20, 3, 3);

  const regime = evaluateSystemRegime(disp, rsi, bb, stoch, vix, aboveSma20, weeklyData);
  const descs = getIndicatorDescs(disp, rsi, bb, stoch, vix, regime.heatIndex, disp60w, disp120w);

  return {
    qqqPrice,
    sma200,
    sma20,
    sma60w,
    sma120w,
    disp,
    disp60w,
    disp120w,
    slope60w,
    slope120w,
    weeklyBullAligned,
    aboveSma20,
    rsi,
    bb,
    stoch,
    vix,
    regime,
    descs
  };
}

// ============================================================================
// 7. 포스팅 텍스트 생성기 (일봉 200일 + 주봉 60·120주선 표시)
// ============================================================================
async function generatePostContent(isPreMarket, preloadedData = null) {
  const quantData = preloadedData || await fetchRealtimeMarketData();
  const { disp, disp60w, disp120w, rsi, bb, stoch, vix, regime, descs } = quantData;

  const dispSign = disp >= 0 ? '+' : '';
  const w60Sign = disp60w >= 0 ? '+' : '';
  const w120Sign = disp120w >= 0 ? '+' : '';
  const sessionHeader = isPreMarket ? "오늘 밤 권장 포지션" : "익일 권장 포지션";
  const systemHeader = isPreMarket ? "🌙 [오후 19:00 프리마켓 매수 알림]" : "☀️ [오전 07:00 정규장 마감 브리핑]";

  let postText = `[SYSTEM REPORT: QLD 절대 생존 퀀트]
${systemHeader}
${regime.headline}

${regime.subIntro}

■ 현재 시장 냉정 진단 (${regime.badge})
• 주봉 60·120주: ${w60Sign}${disp60w.toFixed(1)}% / ${w120Sign}${disp120w.toFixed(1)}% (${descs.dispDesc})
• 일봉 200일선: ${dispSign}${disp.toFixed(1)}% | RSI: ${rsi.toFixed(1)} (${descs.rsiDesc})
• 볼린저 %B: ${bb.toFixed(1)}% | 스토캐스틱: ${stoch.toFixed(1)}
• VIX 공포지수: ${vix.toFixed(1)} | 과열도: ${regime.heatIndex}점 (${descs.heatDesc})

■ ${sessionHeader}
${regime.posText}

${regime.bottomText}

#미국주식 #나스닥 #QLD #GPIX #investing`;

  // 500자 안전 장치
  if (postText.length > 500) {
    console.warn(`⚠️ 경고: 글자 수(${postText.length}자) 초과 방지를 위한 안전 조정 실행`);
    postText = postText.replace('#미국주식 #나스닥 #QLD #GPIX #investing', '#나스닥 #QLD #GPIX');
  }

  return { postText, postContent: postText, quantData };
}

// ============================================================================
// 8. 메인 실행 함수 (통합 다채널 동시 발행 파이프라인)
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  let isPreMarket = false;

  if (args.includes('pre')) {
    isPreMarket = true;
  } else if (args.includes('post')) {
    isPreMarket = false;
  } else {
    const nowKST = new Date(new Date().getTime() + 9 * 3600 * 1000);
    const hour = nowKST.getHours();
    isPreMarket = (hour >= 14 && hour <= 23);
  }

  const sessionName = isPreMarket ? "🌙 [미장 개장 전 프리마켓 점검 & 매수 알림]" : "☀️ [미장 정규장 마감 브리핑 & 포지션]";
  console.log(`=== [퀀트 봇 다채널 자동 발행 시작: ${sessionName}] ===`);

  try {
    const { postText, quantData } = await generatePostContent(isPreMarket);
    console.log('\n--- [생성된 포스팅 내용] ---');
    console.log(postText);
    console.log(`글자 수: ${postText.length}자 (Threads 제한 500자)`);
    console.log('---------------------------\n');

    // 1. Threads 발행 (Investing & QLD 2대 커뮤니티)
    console.log('📱 1. Threads 포스팅 진행...');
    await publishToThreads(postText);

    // 2. X(트위터) 동시 발행 (2단 타래 및 캐시태그 최적화)
    try {
      const { publishToX } = require('./x_bot.js');
      console.log('\n🐦 2. X(트위터) 동시 포스팅 진행 (캐시태그 최적화)...');
      await publishToX(postText, quantData, isPreMarket);
    } catch (xErr) {
      console.warn('⚠️ X 포스팅 건너뜀 또는 오류:', xErr.message);
    }

    // 3. 인스타그램 카드뉴스(캐러셀) 동시 제작 및 발행
    try {
      const { createAndPublishDailyCardNews } = require('./instagram_card_bot.js');
      console.log('\n📸 3. 인스타그램 카드뉴스(캐러셀) 동시 제작 및 발행 진행...');
      await createAndPublishDailyCardNews(quantData, isPreMarket);
    } catch (cardErr) {
      console.warn('⚠️ 인스타그램 카드뉴스 건너뜀 또는 오류:', cardErr.message);
    }

    // 4. 인스타그램 릴스(Reels) + 스토리 동시 제작 및 발행
    try {
      const { createAndPublishDailyReel } = require('./instagram_reels_bot.js');
      console.log('\n🎬 4. 인스타그램 릴스(Reels) & 스토리 동시 제작 및 발행 진행...');
      await createAndPublishDailyReel(quantData.regime, quantData.descs, isPreMarket, postText, quantData);
    } catch (reelsErr) {
      console.warn('⚠️ 인스타그램 릴스 건너뜀 또는 오류:', reelsErr.message);
    }

    console.log('\n🎉 [모든 채널 다중 배포 작업 완료!]');
  } catch (err) {
    console.error('오류 발생:', err.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generatePostContent,
  publishToThreads,
  publishToThreadsSingle,
  evaluateSystemRegime,
  fetchRealtimeMarketData,
  calculateWilderRSI,
  calculateBollingerBandPctB,
  calculateStochasticSlow,
  getIndicatorDescs
};
