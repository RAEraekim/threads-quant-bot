process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');

// ============================================================================
// 1. Threads API 인증 정보
// ============================================================================
const THREADS_USER_ID = process.env.THREADS_USER_ID || "29066378143019292";
const THREADS_ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN || "THAAXRloFIEjRBYmJQdW5rZAVZA3MlhDcjlrY2E3dktSYlJSZAERJdXdqYi1vc3Q0TDNiVDFGZAkZAFZAUlUdFBINXNNZAzhrZAHRBYXA4ZA2pJbDloVnV4NmR6c01BYjU5X0JEVDZASSnNPeXM5dlVrZAUpEa3JpelRfNFpYVXlJenVnemdGZAVlVZAwZDZD";

// ============================================================================
// 2. 야후 파이낸스 실시간 데이터 수집기
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
// 3. 5대 지표 복합 과열도(Heat Index) 및 시스템 상태 평가
// ============================================================================
function evaluateSystemRegime(disp, rsi, bb, stoch, vix, aboveSma20) {
  const sDisp = clamp(((disp - (-10.0)) / 30.0) * 100.0, 0.0, 100.0);
  const sRsi = clamp(((rsi - 25.0) / 50.0) * 100.0, 0.0, 100.0);
  const sBb = clamp(bb, 0.0, 100.0);
  const sStoch = clamp(stoch, 0.0, 100.0);
  const sVix = clamp(((35.0 - vix) / 23.0) * 100.0, 0.0, 100.0);

  // 5대 지표 가중 합산 복합 과열도 (Heat Index)
  const heatIndex = Math.round((0.35 * sDisp) + (0.15 * sRsi) + (0.15 * sBb) + (0.15 * sStoch) + (0.20 * sVix));

  const isNearSma200 = (disp > 0 && disp <= 3.0);
  const isDowntrendShort = !aboveSma20;
  const isHighVol = vix >= 20.0;

  let badge = "🟢골디락스";
  let actionCommand = "• QLD 75% + GPIX 25% 기본 정기 적립 프로토콜 실행.";

  if (disp > 0) {
    if (disp >= 12.0 || heatIndex >= 75) {
      badge = "💰고점과열(경보)";
      actionCommand = "• 고점 과열 감지. QLD 30% 축소 / GPIX 70% 방어 비중 확대.";
    } else if (isNearSma200 || isDowntrendShort || isHighVol) {
      badge = "⚠️지지선경계";
      actionCommand = "• 200일선 위태. QLD 매수 동결 / GPIX 100% 실탄 비축.";
    }
  } else {
    if (vix < 22.0 && aboveSma20) {
      badge = "🎯골든스나이퍼";
      actionCommand = "• 바닥 반등 확인. 비축 실탄으로 TQQQ 80% 집중 타격 프로토콜 실행.";
    } else {
      badge = "🚨실탄비축(하락)";
      actionCommand = "• 대세 하락 국면. 레버리지 매수 전면 동결 / GPIX 100% 방어.";
    }
  }

  return { heatIndex, badge, actionCommand };
}

// ============================================================================
// 4. Threads API 포스팅 (2단계: 컨테이너 생성 -> 실제 발행)
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

async function publishToThreads(text) {
  console.log('📤 1단계: Threads 미디어 컨테이너 생성 중 (토픽: Investing)...');
  const containerData = new URLSearchParams({
    media_type: 'TEXT',
    text: text,
    topic_tag: 'Investing',
    access_token: THREADS_ACCESS_TOKEN
  }).toString();

  const res1 = await sendRequest(`/v1.0/${THREADS_USER_ID}/threads`, containerData);
  if (res1.status !== 200 || !res1.body.id) {
    console.error('❌ 컨테이너 생성 실패:', res1.body);
    return false;
  }
  const creationId = res1.body.id;
  console.log(`✅ 컨테이너 생성 완료 (ID: ${creationId})`);

  console.log('🚀 2단계: Threads 실제 발행 중...');
  const publishData = new URLSearchParams({
    creation_id: creationId,
    access_token: THREADS_ACCESS_TOKEN
  }).toString();

  const res2 = await sendRequest(`/v1.0/${THREADS_USER_ID}/threads_publish`, publishData);
  if (res2.status === 200 && res2.body.id) {
    console.log(`🎉 포스팅 성공! (게시물 ID: ${res2.body.id})`);
    return true;
  } else {
    console.error('❌ 포스팅 발행 실패:', res2.body);
    return false;
  }
}

// ============================================================================
// 5. 포스팅 텍스트 생성기 (개장 전 / 마감 후 자동 분기 지원)
// ============================================================================
async function generatePostContent(isPreMarket) {
  const qqqJson = await fetchYahooJSON('https://query1.finance.yahoo.com/v8/finance/chart/QQQ?interval=1d&range=1y');
  const quote = qqqJson.chart.result[0].indicators.quote[0];
  let highs = [], lows = [], closes = [];
  for (let i = 0; i < quote.close.length; i++) {
    if (quote.close[i] !== null && quote.high[i] !== null && quote.low[i] !== null) {
      highs.push(quote.high[i]);
      lows.push(quote.low[i]);
      closes.push(quote.close[i]);
    }
  }

  const vixJson = await fetchYahooJSON('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d');
  const vixMeta = vixJson.chart.result[0].meta;
  const vix = vixMeta.regularMarketPrice || vixMeta.chartPreviousClose || 20.8;

  const qqqPrice = closes[closes.length - 1];
  const sma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const disp = ((qqqPrice - sma200) / sma200) * 100;
  const aboveSma20 = qqqPrice >= sma20;

  // 5대 지표 연산
  const rsi = calculateWilderRSI(closes, 14);
  const bb = calculateBollingerBandPctB(closes, 20, 2.0);
  const stoch = calculateStochasticSlow(highs, lows, closes, 20, 3, 3);

  const regime = evaluateSystemRegime(disp, rsi, bb, stoch, vix, aboveSma20);

  const nowKST = new Date(new Date().getTime() + 9 * 3600 * 1000);
  const dateStr = `${nowKST.getFullYear()}.${String(nowKST.getMonth() + 1).padStart(2, '0')}.${String(nowKST.getDate()).padStart(2, '0')}`;
  const dispSign = disp >= 0 ? '+' : '';

  const sessionTitle = isPreMarket ? "개장 전 프리마켓 점검" : "정규장 마감 퀀트 분석";
  const commandHeader = isPreMarket ? "오늘 밤 정규장 주문 명령" : "금일 시스템 명령";

  const postText = `[SYSTEM LOG: QLD 퀀트 방어 봇 v4.0]
■ 세션: ${sessionTitle}
■ 판정: ${regime.badge} (과열도: ${regime.heatIndex}점)
■ 기준: ${dateStr} 실시간 지표

[5대 퀀트 복합 지표]
1. 200일선 이격: ${dispSign}${disp.toFixed(1)}% (턱걸이)
2. 일봉 RSI: ${rsi.toFixed(1)} | 3. 볼린저 %B: ${bb.toFixed(1)}%
4. 스토캐스틱 %D: ${stoch.toFixed(1)} | 5. VIX: ${vix.toFixed(1)}

[시스템 자산 배분 원칙]
• QLD: 나스닥 우상향 2배 복리 극대화. 단, 하락장 변동성 잠식 방어를 위해 200일선 지지 확인 안전 구간에서만 진입.
• GPIX: S&P500 월배당(연 8.3%)으로 하락장 완충 및 폭락 시 QLD 저가 매수용 실탄(현금흐름)을 자동 공급함.

[${commandHeader}]
${regime.actionCommand}

#미국주식 #나스닥 #QQQ #QLD #GPIX #investing #퀀트투자`;

  return postText;
}

// ============================================================================
// 6. 메인 실행 함수
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  let isPreMarket = false;

  if (args.includes('pre')) {
    isPreMarket = true;
  } else if (args.includes('post')) {
    isPreMarket = false;
  } else {
    // KST 시간대 자동 감지: 17시~23시는 개장 전 프리마켓 점검, 그 외는 정규장 마감 브리핑
    const nowKST = new Date(new Date().getTime() + 9 * 3600 * 1000);
    const hour = nowKST.getHours();
    isPreMarket = (hour >= 17 && hour <= 23);
  }

  const sessionName = isPreMarket ? "🌙 [미장 개장 전 프리마켓 점검]" : "☀️ [미장 정규장 마감 브리핑]";
  console.log(`=== [Threads 퀀트 봇 실행: ${sessionName}] ===`);

  try {
    const postContent = await generatePostContent(isPreMarket);
    console.log('\n--- [생성된 포스팅 내용] ---');
    console.log(postContent);
    console.log(`글자 수: ${postContent.length}자 (제한 500자)`);
    console.log('---------------------------\n');

    await publishToThreads(postContent);
  } catch (err) {
    console.error('오류 발생:', err.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generatePostContent, publishToThreads };
