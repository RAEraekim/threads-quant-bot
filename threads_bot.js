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
// 3. 5대 지표 복합 과열도(Heat Index) 및 시스템 상태 평가 (옵션 2 템플릿용)
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
  let posText = "• QLD: 75% (안정 적립 프로토콜 실행)\n• GPIX: 25% (현금흐름 방어 유지)";
  let bottomText = "대세 상승 추세 양호. 기본 루틴 적립을 진행합니다.";
  let statusComment = "안정적 상승 추세";

  if (disp > 0) {
    if (disp >= 12.0 || heatIndex >= 75) {
      badge = "💰고점과열(경보)";
      posText = "• QLD: 30% (레버리지 비중 축소)\n• GPIX: 70% (방어자산 대폭 확대)";
      bottomText = "고점 과열 경보 발령. 방어자산 비중을 확대합니다.";
      statusComment = "고점 과열 경계";
    } else if (isNearSma200 || isDowntrendShort || isHighVol) {
      badge = "⚠️지지선경계";
      posText = "• QLD: 0% (매수 전면 동결! 추가 급락 위험)\n• GPIX: 100% (원금 방어 & 반등 실탄 100% 비축)";
      bottomText = "바닥 돌파 신호 확인 전까지 레버리지 매수를 금지합니다.";
      statusComment = "붕괴 직전 턱걸이";
    }
  } else {
    if (vix < 22.0 && aboveSma20) {
      badge = "🎯골든스나이퍼";
      posText = "• TQQQ: 80% (바닥 반등 확인! 집중 타격)\n• GPIX: 20% (잔여 방어 유지)";
      bottomText = "바닥 탈출 반등 확인. 비축 실탄으로 레버리지 진입을 개시합니다.";
      statusComment = "바닥 탈출 반등 국면";
    } else {
      badge = "🚨실탄비축(하락)";
      posText = "• QLD: 0% (매수 전면 동결! 하락장 진행 중)\n• GPIX: 100% (MDD 방어 및 실탄 100% 비축)";
      bottomText = "대세 하락 진행 중. 반등 신호까지 레버리지 매수를 전면 금지합니다.";
      statusComment = "대세 하락 진행 중";
    }
  }

  return { heatIndex, badge, posText, bottomText, statusComment };
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

  // Meta 서버 분산 DB 동기화 대기 (최소 5초 대기 필수)
  console.log('⏳ Meta 서버 동기화 대기 중 (5초)...');
  await new Promise(r => setTimeout(r, 5000));

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`🚀 2단계: Threads 실제 발행 중... (시도 ${attempt}/3)`);
    const publishData = new URLSearchParams({
      creation_id: creationId,
      access_token: THREADS_ACCESS_TOKEN
    }).toString();

    const res2 = await sendRequest(`/v1.0/${THREADS_USER_ID}/threads_publish`, publishData);
    if (res2.status === 200 && res2.body.id) {
      console.log(`🎉 포스팅 성공! (게시물 ID: ${res2.body.id})`);
      return res2.body.id;
    }

    if (attempt < 3) {
      console.log('⏳ Meta 서버 동기화 지연 감지, 3초 후 재시도...');
      await new Promise(r => setTimeout(r, 3000));
    } else {
      console.error('❌ 포스팅 발행 실패:', res2.body);
      return false;
    }
  }
}

// ============================================================================
// 5. 포스팅 텍스트 생성기 (옵션 2: 스마트 봇 & 냉정한 데이터 팩트형)
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

  const dispSign = disp >= 0 ? '+' : '';
  const sma20Str = aboveSma20 ? '상회 🟢' : '하회 🔴';
  const sessionHeader = isPreMarket ? "오늘 밤 권장 포지션" : "익일 권장 포지션";

  const postText = `[SYSTEM REPORT: QLD 절대 생존 퀀트]
"하락장에선 레버리지를 멈추고 실탄만 모은다."

10년 백테스트로 검증된 전략입니다.
상승장엔 QLD 2배 복리를 극대화하고, 하락장엔 매수를 멈춘 채 S&P500 월배당(GPIX 연 8.3%)으로 저가 매수용 실탄을 축적합니다.

■ 현재 시장 냉정 진단 (${regime.badge})
• QQQ 200일선 이격: ${dispSign}${disp.toFixed(1)}% (${regime.statusComment})
• 단기 20일선 ${sma20Str} | VIX ${vix.toFixed(1)} 공포 유입
• 5대 지표 복합 과열도: ${regime.heatIndex}점 (바닥 미확인)

■ ${sessionHeader}
${regime.posText}

${regime.bottomText}

#미국주식 #나스닥 #QQQ #QLD #GPIX #investing`;

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
