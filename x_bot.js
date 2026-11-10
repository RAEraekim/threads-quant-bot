process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.X_CLIENT_ID || 'UnBtdk5XZjkxc1V0M3c0UFlFc086MTpjaQ';
const CLIENT_SECRET = process.env.X_CLIENT_SECRET || 'VJEgdMRJ-qhFxkDYmzdOngyQGeuWV0mKarq5347wAS4fbHdpEY';
const TOKENS_PATH = path.resolve(__dirname, 'x_tokens.json');

// 트위터 글자 수 가중치 계산 (한글/CJK: 2, 영문/기호: 1, 최대 280)
function getTwitterLength(text) {
  let len = 0;
  for (const char of text) {
    len += char.charCodeAt(0) > 127 ? 2 : 1;
  }
  return len;
}

// X(트위터) 정책 최적화 포맷팅 (예시 A: 5대 지표 신호등 + 적립식 비중 + 면책문구)
function buildTweetsForX(quantData, isPreMarket) {
  const { regime, disp, disp60w = 0, disp120w = 10, rsi, bb, stoch, vix } = quantData;
  const dispSign = disp >= 0 ? '+' : '';
  const w60Sign = disp60w >= 0 ? '+' : '';
  const w120Sign = disp120w >= 0 ? '+' : '';
  const sessionTitle = isPreMarket ? "🌙 프리마켓 점검" : "☀️ 정규장 마감";

  // 신호등 판정
  let wLight = '🟢';
  if (disp60w < -2.5) wLight = '🔴';
  else if (disp60w < 0 || disp120w < 0) wLight = '🟡';

  let dLight = '🟢';
  if (disp < -3.0) dLight = '🔴';
  else if (disp < 0) dLight = '🟡';

  let rsiLight = '🟢';
  if (rsi <= 35 || rsi >= 70) rsiLight = '🔴';
  else if (rsi < 45 || rsi > 65) rsiLight = '🟡';

  let bbLight = '🟢';
  if (bb <= 10 || bb >= 90) bbLight = '🔴';
  else if (bb < 30 || bb > 70) bbLight = '🟡';

  let stochLight = '🟢';
  if (stoch <= 20 || stoch >= 80) stochLight = '🔴';
  else if (stoch < 30 || stoch > 70) stochLight = '🟡';

  let vixLight = '🟢';
  if (vix >= 24) vixLight = '🔴';
  else if (vix >= 18) vixLight = '🟡';

  // 장세에 따른 단일 캐시태그 선택 (트윗당 1개 제한)
  const isFreeze = regime.posText.includes("QLD: 0%") || regime.badge.includes("실탄비축") || regime.badge.includes("관망");
  const targetTag = isFreeze ? "$GPIX" : "$QLD";

  // 1번 트윗: 5대 지표 신호등 현황
  const tweet1 = `[QLD 퀀트 브리핑 | ${sessionTitle}]

■ 5대 지표 신호등 현황
• 주봉 60·120주: ${wLight} ${w60Sign}${disp60w.toFixed(1)}% / ${w120Sign}${disp120w.toFixed(1)}%
• 일봉 200일선: ${dLight} ${dispSign}${disp.toFixed(1)}%
• 일봉 RSI(14): ${rsiLight} ${rsi.toFixed(1)}
• 볼린저밴드 %B: ${bbLight} ${bb.toFixed(1)}%
• 스토캐스틱 %D: ${stochLight} ${stoch.toFixed(1)}
• VIX 공포지수: ${vixLight} ${vix.toFixed(1)} (1/2 🧵👇)`;

  // 2번 트윗: 종합 점수 & 오늘 적립식 매수한다면? & 면책
  const ratioWithTag = (regime.ratioSummary || "(QLD 0% / TQQQ 0% / GPIX 50% / 현금·채권 50%)")
    .replace(isFreeze ? 'GPIX' : 'QLD', targetTag);

  const tweet2 = `■ 현재 종합 점수: ${regime.heatIndex}점 / 100점 (${regime.badge})

👉 오늘 적립식 매수한다면 ?
${ratioWithTag}

※ 본 글은 투자 권유를 하고 있지 않으며 관점만 공유드립니다.
📸 인스타그램: instagram.com/safety_qld_bot (2/2)`;

  return [tweet1, tweet2];
}

// 일반 텍스트 입력 시 안전 분할 폴백
function formatForX(postText) {
  if (getTwitterLength(postText) <= 240) {
    return [postText];
  }

  const paragraphs = postText.split('\n\n');
  const mid = Math.ceil(paragraphs.length / 2);
  const t1 = paragraphs.slice(0, mid).join('\n\n') + '\n\n(1/2 🧵👇)';
  const t2 = paragraphs.slice(mid).join('\n\n') + '\n\n(2/2)';

  return [t1, t2];
}

async function getXClient() {
  // 1순위: OAuth 1.0a (만료되지 않는 영구 키 방식)
  const appKey = process.env.X_APP_KEY || process.env.X_API_KEY || '6fTtht3ZpM0hE59E6DxsPdwe5';
  const appSecret = process.env.X_APP_SECRET || process.env.X_API_SECRET || 'STKu7BoFD7ns6Nb3KPvEN8aqkRKxhG38Lp9zzbVSbl8EvTEqiB';
  const accessToken = process.env.X_ACCESS_TOKEN || '1524219327683371010-IHrKykf7VbLh07nBtatcPBnHwcKp49';
  const accessSecret = process.env.X_ACCESS_SECRET || 'U1itA3sSA8y9HoZqqCsdcS3VAPFRGnk82uC4nCi8gjo7k';

  if (appKey && accessToken && appSecret && accessSecret) {
    return new TwitterApi({
      appKey,
      appSecret,
      accessToken,
      accessSecret,
    });
  }

  // 2순위: OAuth 2.0 PKCE 방식
  let refreshToken = process.env.X_REFRESH_TOKEN;
  let oauth2Access = process.env.X_ACCESS_TOKEN;
  let tokens = {};

  if (fs.existsSync(TOKENS_PATH)) {
    tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    refreshToken = refreshToken || tokens.refreshToken;
    oauth2Access = oauth2Access || tokens.accessToken;
  }

  const baseClient = new TwitterApi({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  });

  if (refreshToken) {
    try {
      const { client: refreshedClient, accessToken: newAccess, refreshToken: newRefresh, expiresIn } = await baseClient.refreshOAuth2Token(refreshToken);
      tokens.accessToken = newAccess;
      tokens.refreshToken = newRefresh;
      tokens.expiresIn = expiresIn;
      tokens.savedAt = new Date().toISOString();
      fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf8');
      return refreshedClient;
    } catch (err) {
      console.warn('⚠️ X 리프레시 토큰 갱신 경고, 기존 액세스 토큰으로 시도:', err.message);
    }
  }

  return new TwitterApi(oauth2Access);
}

// X 발행 함수 (2단 타래 자동 발행)
async function publishToX(content, quantData = null, isPreMarket = false) {
  const client = await getXClient();

  let tweets = [];
  if (quantData) {
    tweets = buildTweetsForX(quantData, isPreMarket);
  } else if (Array.isArray(content)) {
    tweets = content;
  } else {
    tweets = formatForX(content);
  }

  console.log(`📤 X(트위터) 타래글 (${tweets.length}개 트윗) 발행 시작...`);
  for (let i = 0; i < tweets.length; i++) {
    console.log(` -> 트윗 ${i + 1} 길이: ${getTwitterLength(tweets[i])} (최대 280)`);
  }

  // 첫 번째 트윗 발행
  const firstRes = await client.v2.tweet(tweets[0]);
  const firstId = firstRes.data.id;
  console.log(`🎉 [1/${tweets.length}] 1번 트윗 발행 성공! ID: ${firstId}`);

  if (tweets.length > 1) {
    try {
      await new Promise(r => setTimeout(r, 2000));
      const secondRes = await client.v2.tweet(tweets[1], {
        reply: { in_reply_to_tweet_id: firstId }
      });
      console.log(`🎉 [2/${tweets.length}] 2번 타래 트윗 발행 성공! ID: ${secondRes.data.id}`);
    } catch (err) {
      console.warn('⚠️ 타래 답글 실패, 독립 트윗으로 재시도:', err.message);
      const secondResAlt = await client.v2.tweet(tweets[1]);
      console.log(`🎉 2번 독립 트윗 발행 성공! ID: ${secondResAlt.data.id}`);
    }
  }

  const tweetUrl = `https://x.com/SAFETY_QLD_BOT/status/${firstId}`;
  console.log(`🔗 X 게시물 링크: ${tweetUrl}`);
  return { id: firstId, url: tweetUrl };
}

module.exports = { getXClient, publishToX, buildTweetsForX, formatForX };
