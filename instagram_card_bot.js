process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');
const fs = require('fs');
const path = require('path');
const { generateAllCards } = require('./card_generator.js');

// ============================================================================
// 1. 인스타그램 및 Imgur 인증 정보
// ============================================================================
const IG_USER_ID = (process.env.INSTAGRAM_ACCOUNT_ID && process.env.INSTAGRAM_ACCOUNT_ID.trim() !== "")
  ? process.env.INSTAGRAM_ACCOUNT_ID.trim()
  : "17841451358369247";

const PAGE_ACCESS_TOKEN = (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCESS_TOKEN.trim() !== "")
  ? process.env.INSTAGRAM_ACCESS_TOKEN.trim()
  : (process.env.PAGE_ACCESS_TOKEN || "EAAfdZBNdsyFcBSwuFkBbqLYVA0Ia5imWpwIJUJCWdi7qA4H00rfJs8ZAvnNODA4ZBZAMysGARZB5ZCmoNf0opNdlKkIovZAPqn6XKFEndvDfbcMa2auYzzzEuOWygn8yFXGoL3KisJxWRCu1mZAUK1gqmCUom732p2uVX4Eq0WdzHiD7FhgRMdCCLCEo5ujw");

const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID || "546c25a59c58ad7";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// 2. Imgur 이미지 호스팅 (인스타그램 Graph API 전달용 공개 URL 획득)
// ============================================================================
function uploadToImgur(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`파일을 찾을 수 없습니다: ${filePath}`));
    }
    const imgData = fs.readFileSync(filePath).toString('base64');
    const postData = JSON.stringify({ image: imgData, type: 'base64' });

    const req = https.request({
      hostname: 'api.imgur.com',
      path: '/3/upload',
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data.link) {
            resolve(json.data.link);
          } else {
            reject(new Error('Imgur upload failed: ' + data));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ============================================================================
// 3. Instagram Graph API 통신 헬퍼
// ============================================================================
function postGraph(apiPath, params) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams(params).toString();
    const req = https.request({
      hostname: 'graph.facebook.com',
      path: `/v19.0${apiPath}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0'
      }
    }, res => {
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

function getGraph(apiPath, params) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams(params).toString();
    const req = https.request({
      hostname: 'graph.facebook.com',
      path: `/v19.0${apiPath}?${query}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    }, res => {
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
    req.end();
  });
}

// ============================================================================
// 4. 인스타그램 캐러셀(카드뉴스) 발행 함수
// ============================================================================
async function publishInstagramCarousel(imagePaths, caption) {
  console.log('\n==================================================');
  console.log('📸 [인스타그램 카드뉴스 캐러셀 발행 시작]');
  console.log(`대상 계정 ID: ${IG_USER_ID}`);
  console.log('==================================================');

  // Step 1: Imgur 업로드
  const imageUrls = [];
  for (let i = 0; i < imagePaths.length; i++) {
    const p = imagePaths[i];
    console.log(`[1단계] 카드뉴스 ${i + 1}/${imagePaths.length} Imgur 업로드 중... (${p})`);
    const url = await uploadToImgur(p);
    console.log(` -> 공개 URL: ${url}`);
    imageUrls.push(url);
    await sleep(1000);
  }

  // Step 2: 각 슬라이드 컨테이너 생성
  const itemIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    console.log(`[2단계] 카드 ${i + 1} 인스타그램 미디어 컨테이너 생성 중...`);
    const res = await postGraph(`/${IG_USER_ID}/media`, {
      image_url: imageUrls[i],
      is_carousel_item: 'true',
      access_token: PAGE_ACCESS_TOKEN
    });

    if (!res.body || !res.body.id) {
      throw new Error(`카드 ${i + 1} 생성 실패: ` + JSON.stringify(res.body));
    }
    console.log(` -> 컨테이너 ID: ${res.body.id}`);
    itemIds.push(res.body.id);
    await sleep(1500);
  }

  // Step 3: 메인 캐러셀 컨테이너 생성
  console.log('[3단계] 캐러셀 앨범 컨테이너 생성 중...');
  const carouselRes = await postGraph(`/${IG_USER_ID}/media`, {
    media_type: 'CAROUSEL',
    children: itemIds.join(','),
    caption: caption,
    access_token: PAGE_ACCESS_TOKEN
  });

  if (!carouselRes.body || !carouselRes.body.id) {
    throw new Error('캐러셀 생성 실패: ' + JSON.stringify(carouselRes.body));
  }
  const carouselId = carouselRes.body.id;
  console.log(` -> 캐러셀 ID: ${carouselId}`);

  // Step 4: 메타 서버 인코딩 대기
  console.log('⏳ [4단계] Meta 서버 미디어 처리 대기 (8초)...');
  await sleep(8000);

  // Step 5: 최종 피드 발행
  console.log('🚀 [5단계] 인스타그램 피드 최종 발행 중...');
  const publishRes = await postGraph(`/${IG_USER_ID}/media_publish`, {
    creation_id: carouselId,
    access_token: PAGE_ACCESS_TOKEN
  });

  if (!publishRes.body || !publishRes.body.id) {
    throw new Error('최종 발행 실패: ' + JSON.stringify(publishRes.body));
  }
  const postId = publishRes.body.id;
  console.log(`🎉 [인스타그램 카드뉴스 발행 성공!] Post ID: ${postId}`);

  // Step 6: 퍼머링크 확인
  await sleep(2000);
  let permalink = '';
  try {
    const mediaInfo = await getGraph(`/${postId}`, {
      fields: 'permalink,shortcode',
      access_token: PAGE_ACCESS_TOKEN
    });
    permalink = mediaInfo.body.permalink || `https://www.instagram.com/p/${mediaInfo.body.shortcode}/`;
    console.log(`🔗 게시물 링크: ${permalink}`);
  } catch (e) {
    permalink = `https://www.instagram.com/`;
  }

  return { postId, permalink };
}

// ============================================================================
// 5. 캡션 생성 헬퍼 (주봉 60·120주 + 일봉 200일 반영)
// ============================================================================
function buildInstagramCaption(quantData, isPreMarket) {
  const { regime, descs, disp, disp60w = 0, disp120w = 10, rsi, bb, stoch, vix } = quantData;
  const dispSign = disp >= 0 ? '+' : '';
  const w60Sign = disp60w >= 0 ? '+' : '';
  const w120Sign = disp120w >= 0 ? '+' : '';
  const sessionTitle = isPreMarket ? "🌙 [오후 19:00 프리마켓 점검 & 매수 알림]" : "☀️ [오전 07:00 정규장 마감 퀀트 브리핑]";
  const sessionHeader = isPreMarket ? "오늘 밤 권장 포지션" : "익일 권장 포지션";

  const HASHTAGS = `
.
.
.
#미국주식 #나스닥 #QQQ #QLD #TQQQ #GPIX #서학개미 #주식투자 #주식스타그램 #재테크 #경제적자유 #퀀트투자 #적립식투자 #투자전략 #월배당 #배당금 #스노우볼 #복리효과 #주린이 #해외주식 #주식공부 #포트폴리오 #자산배분 #투자스타그램`;

  return `${sessionTitle}
${regime.headline}

${regime.subIntro}

📊 주봉·일봉 5대 퀀트 복합 지표 현황 (${regime.badge})
• 주봉 60·120주 이격: ${w60Sign}${disp60w.toFixed(1)}% / ${w120Sign}${disp120w.toFixed(1)}% (${descs.dispDesc})
• 일봉 200일선 이격: ${dispSign}${disp.toFixed(1)}%
• 일봉 RSI 14: ${rsi.toFixed(1)} (${descs.rsiDesc})
• 볼린저 %B: ${bb.toFixed(1)}% (${descs.bbDesc})
• 스토캐스틱 %D: ${stoch.toFixed(1)} (${descs.stochDesc})
• VIX 공포지수: ${vix.toFixed(1)} (${descs.vixDesc})
👉 5대 복합 과열도: ${regime.heatIndex}점 (${descs.heatDesc})

🎯 ${sessionHeader}
${regime.posText}

${regime.bottomText}

💡 "감정을 지우고 주봉 60·120주선 및 5대 퀀트 데이터로만 기계적 대응합니다."
매일 2회 (07:00 정규장 마감 / 19:00 프리마켓 매수 알림) 실시간 브리핑을 받아보세요.
${HASHTAGS}`;
}

// ============================================================================
// 6. 카드뉴스 일괄 제작 및 인스타그램 발행 통합 파이프라인
// ============================================================================
async function createAndPublishDailyCardNews(quantData, isPreMarket, customCaption = null) {
  console.log('\n🎨 [1단계: 1080x1350 카드뉴스 3장 생성 시작]');
  const cardFiles = await generateAllCards({ ...quantData, isPreMarket }, './cards');

  console.log('\n📝 [2단계: 인스타그램 캡션 작성]');
  const caption = customCaption || buildInstagramCaption(quantData, isPreMarket);

  console.log('\n🚀 [3단계: 인스타그램 피드 캐러셀 발행]');
  const result = await publishInstagramCarousel(cardFiles, caption);

  return result;
}

// ============================================================================
// 단독 실행 테스트 (node instagram_card_bot.js)
// ============================================================================
async function main() {
  const { fetchRealtimeMarketData } = require('./threads_bot.js');
  const isPreMarket = false;
  console.log('=== [인스타그램 카드뉴스 단독 발행 테스트] ===');
  try {
    const quantData = await fetchRealtimeMarketData();
    await createAndPublishDailyCardNews(quantData, isPreMarket);
  } catch (err) {
    console.error('❌ 카드뉴스 발행 실패:', err);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createAndPublishDailyCardNews,
  publishInstagramCarousel,
  buildInstagramCaption,
  uploadToImgur
};
