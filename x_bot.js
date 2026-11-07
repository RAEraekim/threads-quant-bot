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

// X(트위터) 정책 최적화 포맷팅 (캐시태그 트윗당 1개 엄격 준수 + 280 규격)
function buildTweetsForX(quantData, isPreMarket) {
  const { regime, disp, vix, descs } = quantData;
  const dispSign = disp >= 0 ? '+' : '';
  const sessionTitle = isPreMarket ? "🌙 [프리마켓 매수 알림]" : "☀️ [정규장 마감 브리핑]";
  const posAction = isPreMarket ? "오늘 밤 권장" : "익일 권장";

  // 장세에 따른 단일 캐시태그 선택 (트윗당 1개 제한)
  const isFreeze = regime.posText.includes("0%");
  const tag1 = isFreeze ? "$GPIX" : "$QLD";
  const tag2 = isFreeze ? "$QLD" : "$GPIX";

  // 1번 트윗: 핵심 진단 & 매수/관망 포지션
  const tweet1 = `${sessionTitle}
${regime.headline}

■ ${posAction} 포지션 (${regime.badge})
${regime.posText.replace('GPIX', tag1)}

💡 떨어지는 칼날을 잡지 않고 데이터로만 대응합니다. (1/2 🧵👇)`;

  // 2번 트윗: 5대 핵심 지표 & 인스타 링크
  const tweet2 = `■ 5대 복합 퀀트 지표
• 200일선 이격: ${dispSign}${disp.toFixed(1)}% (${descs.dispDesc})
• VIX 공포지수: ${vix.toFixed(1)} (${descs.vixDesc})
• 복합 과열도: ${regime.heatIndex}점 (${descs.heatDesc})

방어와 반등 타격은 ${tag2} 시스템으로 기계적 실행!

📊 실시간 대시보드:
instagram.com/safety_qld_bot

(2/2)`;

  return [tweet1, tweet2];
}

// 일반 텍스트 입력 시 안전 분할 폴백
function formatForX(postText) {
  if (getTwitterLength(postText) <= 240) {
    return [postText];
  }

  // 섹션 분할
  const paragraphs = postText.split('\n\n');
  const mid = Math.ceil(paragraphs.length / 2);
  const t1 = paragraphs.slice(0, mid).join('\n\n') + '\n\n(1/2 🧵👇)';
  const t2 = paragraphs.slice(mid).join('\n\n') + '\n\n(2/2)';

  return [t1, t2];
}

async function getXClient() {
  // 1순위: OAuth 1.0a (만료되지 않는 영구 키 방식)
  const appKey = process.env.X_API_KEY || '6fTtht3ZpM0hE59E6DxsPdwe5';
  const appSecret = process.env.X_API_SECRET || 'STKu7BoFD7ns6Nb3KPvEN8aqkRKxhG38Lp9zzbVSbl8EvTEqiB';
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
  let access = process.env.X_ACCESS_TOKEN;
  let tokens = {};

  if (fs.existsSync(TOKENS_PATH)) {
    tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    refreshToken = refreshToken || tokens.refreshToken;
    access = access || tokens.accessToken;
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

  return new TwitterApi(access);
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

  const tweetUrl = `https://twitter.com/i/web/status/${firstId}`;
  console.log(`🔗 X 게시물 링크: ${tweetUrl}`);
  return { id: firstId, url: tweetUrl };
}

module.exports = { getXClient, publishToX, buildTweetsForX, formatForX };
