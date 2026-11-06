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

// 스레드 글을 트위터(X) 280 규격 타래(Thread)로 스마트 자동 분할
function formatForX(postText) {
  if (getTwitterLength(postText) <= 280) {
    return postText;
  }

  // 섹션 분할 (■ 기준)
  const sections = postText.split('\n\n■ ');
  if (sections.length >= 2) {
    const tweet1 = sections[0].trim() + '\n\n■ ' + sections[1].trim() + '\n\n(1/2 🧵👇)';
    const tweet2 = (sections.slice(2).length > 0 ? '■ ' + sections.slice(2).join('\n\n■ ') : sections[1]).trim() + '\n\n(2/2)';

    if (getTwitterLength(tweet1) <= 280 && getTwitterLength(tweet2) <= 280) {
      return [tweet1, tweet2];
    }
  }

  // 문단별 자동 누적 분할
  const paragraphs = postText.split('\n\n');
  const tweets = [];
  let current = '';

  for (const p of paragraphs) {
    const candidate = current ? current + '\n\n' + p : p;
    if (getTwitterLength(candidate) > 260) {
      if (current) tweets.push(current);
      current = p;
    } else {
      current = candidate;
    }
  }
  if (current) tweets.push(current);

  if (tweets.length > 1) {
    return tweets.map((t, idx) => `${t}\n\n(${idx + 1}/${tweets.length} 🧵)`);
  }
  return tweets;
}

async function getXClient() {
  // 1순위: OAuth 1.0a (만료되지 않는 영구 키 방식 - 로컬 및 GitHub Actions 최적)
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

  // 2순위: OAuth 2.0 PKCE 방식 (로컬 x_tokens.json 또는 환경변수)
  let refreshToken = process.env.X_REFRESH_TOKEN;
  let accessToken = process.env.X_ACCESS_TOKEN;
  let tokens = {};

  if (fs.existsSync(TOKENS_PATH)) {
    tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    refreshToken = refreshToken || tokens.refreshToken;
    accessToken = accessToken || tokens.accessToken;
  }

  if (!refreshToken && !accessToken) {
    throw new Error('x_tokens.json 또는 환경변수에 X 토큰이 없습니다. 먼저 x_oauth2_auth.js를 실행하세요.');
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

  return new TwitterApi(accessToken);
}

// X 발행 함수
async function publishToX(content) {
  const client = await getXClient();
  const formatted = typeof content === 'string' ? formatForX(content) : content;

  if (Array.isArray(formatted)) {
    console.log(`📤 X 타래글 (${formatted.length}개 트윗) 순차 발행 중...`);
    const res = await client.v2.tweetThread(formatted);
    const firstId = res[0]?.data?.id;
    console.log(`🎉 X 타래글 발행 성공! (ID: ${firstId})`);
    console.log(`🔗 링크: https://x.com/SAFETY_QLD_BOT/status/${firstId}`);
    return res;
  }

  console.log('📤 X 단일 트윗 발행 중...');
  const res = await client.v2.tweet(formatted);
  console.log(`🎉 X 트윗 발행 성공! (ID: ${res.data.id})`);
  console.log(`🔗 링크: https://x.com/SAFETY_QLD_BOT/status/${res.data.id}`);
  return res;
}

module.exports = { getXClient, publishToX, formatForX };
