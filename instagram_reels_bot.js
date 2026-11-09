process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const sharp = require('sharp');

// 1. 인스타그램 계정 및 토큰
const IG_USER_ID = (process.env.INSTAGRAM_ACCOUNT_ID && process.env.INSTAGRAM_ACCOUNT_ID.trim() !== "")
  ? process.env.INSTAGRAM_ACCOUNT_ID.trim()
  : "17841451358369247";

const PAGE_ACCESS_TOKEN = (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCESS_TOKEN.trim() !== "")
  ? process.env.INSTAGRAM_ACCESS_TOKEN.trim()
  : (process.env.PAGE_ACCESS_TOKEN || "EAAfdZBNdsyFcBSwuFkBbqLYVA0Ia5imWpwIJUJCWdi7qA4H00rfJs8ZAvnNODA4ZBZAMysGARZB5ZCmoNf0opNdlKkIovZAPqn6XKFEndvDfbcMa2auYzzzEuOWygn8yFXGoL3KisJxWRCu1mZAUK1gqmCUom732p2uVX4Eq0WdzHiD7FhgRMdCCLCEo5ujw");

function getFfmpegBin() {
  if (process.platform === 'win32') {
    const winPath = path.resolve('node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');
    if (fs.existsSync(winPath)) return winPath;
  }
  return 'ffmpeg';
}

function getAudioDurationSec(audioPath) {
  const ff = getFfmpegBin();
  const r = spawnSync(ff, ['-i', audioPath]);
  const stderr = r.stderr ? r.stderr.toString() : '';
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) return 5.0;
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeXml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const FONT_FAMILY = "'Pretendard', 'Noto Sans CJK KR', 'NanumGothic', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";

// 2. 9:16 세로 릴스 슬라이드 SVG 렌더러 (v4.0 주봉 60·120주 + 일봉 200일선 하이브리드)
function generateSlideSvg(item) {
  const themeColor = item.themeColor || "#38bdf8";
  const tagBg = item.tagBg || "#0284c7";

  return `
  <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1920" fill="#090d14"/>
    <circle cx="540" cy="500" r="450" fill="${themeColor}" fill-opacity="0.1"/>

    <g transform="translate(100, 200)">
      <rect width="420" height="64" rx="16" fill="${tagBg}"/>
      <text x="210" y="42" text-anchor="middle" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="28" font-weight="900">${escapeXml(item.tag)}</text>
    </g>

    <g transform="translate(100, 380)">
      <text x="0" y="80" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="68" font-weight="900" letter-spacing="-2">${escapeXml(item.mainText)}</text>
      
      <g transform="translate(0, 130)">
        <rect width="880" height="150" rx="24" fill="${themeColor}" fill-opacity="0.15" stroke="${themeColor}" stroke-width="2.5"/>
        <text x="40" y="65" fill="${themeColor}" font-family="${FONT_FAMILY}" font-size="33" font-weight="900">${escapeXml(item.subHighlight)}</text>
        <text x="40" y="115" fill="#e2e8f0" font-family="${FONT_FAMILY}" font-size="25" font-weight="600">${escapeXml(item.desc)}</text>
      </g>
    </g>

    <g transform="translate(100, 800)">
      <rect width="880" height="620" rx="36" fill="#111722" stroke="#1e293b" stroke-width="2"/>
      
      <g transform="translate(50, 60)">
        <text x="0" y="30" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="24" font-weight="700">QUANT PROTOCOL v4.0 #0${item.id} (60W·120W·200D)</text>
        <line x1="0" y1="55" x2="780" y2="55" stroke="#1e293b" stroke-width="1.5"/>

        <g transform="translate(0, 95)">
          <rect width="780" height="110" rx="20" fill="#18202f" stroke="${item.id === 2 ? '#38bdf8' : '#1e293b'}" stroke-width="${item.id === 2 ? '2' : '1'}"/>
          <text x="35" y="48" fill="#38bdf8" font-family="${FONT_FAMILY}" font-size="28" font-weight="900">1. QLD (나스닥 2배 주력 엔진)</text>
          <text x="35" y="85" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="22">일봉 200일선 위 75% · 주봉 60주선 눌림목 50% 적립</text>
          ${item.id === 2 ? '<text x="735" y="65" text-anchor="end" fill="#38bdf8" font-size="30">🚀</text>' : ''}
        </g>

        <g transform="translate(0, 235)">
          <rect width="780" height="110" rx="20" fill="#18202f" stroke="${item.id === 3 ? '#34d399' : '#1e293b'}" stroke-width="${item.id === 3 ? '2' : '1'}"/>
          <text x="35" y="48" fill="#34d399" font-family="${FONT_FAMILY}" font-size="28" font-weight="900">2. GPIX (월배당 캐시카우 방패)</text>
          <text x="35" y="85" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="22">주봉 60주선 붕괴 시 QLD 중단 &amp; 연 8.3% 배당 실탄 비축</text>
          ${item.id === 3 ? '<text x="735" y="65" text-anchor="end" fill="#34d399" font-size="30">🛡️</text>' : ''}
        </g>

        <g transform="translate(0, 375)">
          <rect width="780" height="110" rx="20" fill="#18202f" stroke="${item.id === 4 ? '#fbbf24' : '#1e293b'}" stroke-width="${item.id === 4 ? '2' : '1'}"/>
          <text x="35" y="48" fill="#fbbf24" font-family="${FONT_FAMILY}" font-size="28" font-weight="900">3. TQQQ (120주선 바닥 스나이퍼)</text>
          <text x="35" y="85" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="22">주봉 120주선 대바닥 지지 &amp; 20일선 돌파 시 3배수 풀스윙</text>
          ${item.id === 4 ? '<text x="735" y="65" text-anchor="end" fill="#fbbf24" font-size="30">🎯</text>' : ''}
        </g>
      </g>
    </g>

    <g transform="translate(100, 1550)">
      <rect width="880" height="140" rx="28" fill="${item.id === 4 ? '#2563eb' : '#1e293b'}"/>
      <text x="440" y="84" text-anchor="middle" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="34" font-weight="900">${item.id === 4 ? '🔥 @safety_qld_bot 팔로우하고 신호 받기' : '@safety_qld_bot · 주봉 60·120주 생존 공식'}</text>
    </g>
  </svg>
  `;
}

// 3. 제로-딜레이 고속 릴스 비디오 렌더러 (-t 칼매칭 + 연속 스트림 병합)
async function renderFastReelsVideo(slidesData, outputFilePath) {
  const ffBin = getFfmpegBin();
  const ffmpeg = ffBin.includes(' ') ? `"${ffBin}"` : ffBin;
  const workDir = path.resolve('./temp_reels_render');
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

  console.log('🎬 [릴스 비디오 렌더링 시작]');

  for (const item of slidesData) {
    const svg = generateSlideSvg(item);
    const imgPath = path.join(workDir, `slide_${item.id}.png`);
    await sharp(Buffer.from(svg)).png().toFile(imgPath);
  }

  for (const item of slidesData) {
    const tts = new MsEdgeTTS();
    await tts.setMetadata("ko-KR-InJoonNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const rawAudioPath = path.join(workDir, `raw_${item.id}.mp3`);
    const trimmedAudioPath = path.join(workDir, `trimmed_${item.id}.mp3`);

    const { audioStream } = tts.toStream(item.script, { rate: "+28%", pitch: "+7Hz" });
    const writable = fs.createWriteStream(rawAudioPath);
    audioStream.pipe(writable);
    await new Promise(resolve => writable.on('close', resolve));
    tts.close();

    const trimCmd = `${ffmpeg} -y -i "${rawAudioPath}" -af "silenceremove=start_periods=1:start_duration=0.01:start_threshold=-38dB,areverse,silenceremove=start_periods=1:start_duration=0.03:start_threshold=-38dB,areverse" "${trimmedAudioPath}"`;
    execSync(trimCmd, { stdio: 'ignore' });
  }

  const segmentFiles = [];
  for (let i = 1; i <= slidesData.length; i++) {
    const imgPath = path.join(workDir, `slide_${i}.png`);
    const audioPath = path.join(workDir, `trimmed_${i}.mp3`);
    const segPath = path.join(workDir, `seg_${i}.mp4`);
    const dur = getAudioDurationSec(audioPath);

    const cmd = `${ffmpeg} -y -loop 1 -t ${dur.toFixed(2)} -i "${imgPath}" -i "${audioPath}" -c:v libx264 -tune stillimage -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -ar 44100 -shortest "${segPath}"`;
    execSync(cmd, { stdio: 'ignore' });
    segmentFiles.push(segPath);
  }

  const inputs = segmentFiles.map(f => `-i "${f}"`).join(' ');
  const filterStr = segmentFiles.map((_, idx) => `[${idx}:v][${idx}:a]`).join('') + `concat=n=${segmentFiles.length}:v=1:a=1[v][a]`;
  const mergeCmd = `${ffmpeg} -y ${inputs} -filter_complex "${filterStr}" -map "[v]" -map "[a]" -c:v libx264 -profile:v high -level:v 4.0 -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -ar 44100 -movflags +faststart "${outputFilePath}"`;
  execSync(mergeCmd, { stdio: 'ignore' });

  console.log(`✅ [릴스 비디오 렌더링 완료]: ${outputFilePath}`);
}

// 4. Imgur CDN 비디오 업로드 (오디오 보존 & 트랜스코딩 완료 확인)
async function uploadVideoToImgur(filePath) {
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append('video', new Blob([buf], { type: 'video/mp4' }), 'reels.mp4');
  fd.append('disable_audio', '0');

  const res = await fetch('https://api.imgur.com/3/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Client-ID 546c25a59c58ad7' },
    body: fd
  });
  const json = await res.json();
  if (!json.data || !json.data.id) {
    throw new Error('Imgur 비디오 업로드 실패: ' + JSON.stringify(json));
  }

  const videoId = json.data.id;
  const mp4Url = json.data.link || `https://i.imgur.com/${videoId}.mp4`;

  for (let i = 1; i <= 15; i++) {
    await sleep(3000);
    const chk = await fetch(`https://api.imgur.com/3/image/${videoId}`, {
      headers: { 'Authorization': 'Client-ID 546c25a59c58ad7' }
    }).then(r => r.json());
    if (chk.data?.processing?.status === 'completed') break;
  }

  return mp4Url;
}

// 5. Meta Graph API 헬퍼 함수
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
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
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
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function publishIgByVideoUrl(videoUrl, mediaType, caption = '') {
  const params = {
    media_type: mediaType,
    video_url: videoUrl,
    access_token: PAGE_ACCESS_TOKEN
  };
  if (mediaType === 'REELS') {
    params.caption = caption;
    params.share_to_feed = 'true';
  }

  const initRes = await postGraph(`/${IG_USER_ID}/media`, params);
  if (!initRes.body || !initRes.body.id) {
    throw new Error(`Instagram ${mediaType} 컨테이너 생성 실패: ` + JSON.stringify(initRes.body));
  }

  const containerId = initRes.body.id;
  for (let i = 1; i <= 30; i++) {
    await sleep(5000);
    const statusRes = await getGraph(`/${containerId}`, {
      fields: 'status_code,status',
      access_token: PAGE_ACCESS_TOKEN
    });
    const code = statusRes.body?.status_code;
    if (code === 'FINISHED') break;
    if (code === 'ERROR') {
      throw new Error(`Instagram ${mediaType} 처리 실패: ` + JSON.stringify(statusRes.body));
    }
  }

  const pubRes = await postGraph(`/${IG_USER_ID}/media_publish`, {
    creation_id: containerId,
    access_token: PAGE_ACCESS_TOKEN
  });
  if (!pubRes.body || !pubRes.body.id) {
    throw new Error(`Instagram ${mediaType} 최종 발행 실패: ` + JSON.stringify(pubRes.body));
  }

  const mediaId = pubRes.body.id;
  await sleep(2000);
  const infoRes = await getGraph(`/${mediaId}`, {
    fields: 'permalink,shortcode',
    access_token: PAGE_ACCESS_TOKEN
  });

  const permalink = infoRes.body?.permalink || `https://www.instagram.com/safety_qld_bot/`;
  return { mediaId, permalink };
}

// 6. 메인 릴스 & 스토리 동시 발행 함수
async function publishReelsToInstagram(videoPath, caption, includeStory = true) {
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN.trim() === "") {
    console.warn('⚠️ [Instagram Reels] INSTAGRAM_ACCESS_TOKEN 이 설정되지 않아 발행을 건너뜁니다.');
    return null;
  }

  console.log(`\n==================================================`);
  console.log(`🚀 [인스타그램 릴스 & 스토리 자동 발행 시작] 계정 ID: ${IG_USER_ID}`);
  console.log(`==================================================`);

  const videoUrl = await uploadVideoToImgur(videoPath);
  console.log(` -> Imgur CDN URL: ${videoUrl}`);

  const reels = await publishIgByVideoUrl(videoUrl, 'REELS', caption);
  console.log(`🎉 [릴스 발행 성공!] 링크: ${reels.permalink}`);

  let stories = null;
  if (includeStory) {
    stories = await publishIgByVideoUrl(videoUrl, 'STORIES');
    console.log(`🎉 [스토리 발행 성공!] 링크: ${stories.permalink}`);
  }

  return { reels, stories };
}

// 7. 데일리 퀀트 릴스 & 스토리 자동 생성 및 발행 통합 함수 (v4.0 주봉 60·120주 + 일봉 200일선)
async function createAndPublishDailyReel(regime, descs, isPreMarket, postContent) {
  const sessionTitle = isPreMarket ? "프리마켓 핵심 점검" : "정규장 마감 브리핑";
  const posClean = regime.posText.replace(/\n/g, ' / ').replace(/• /g, '');

  const slidesData = [
    {
      id: 1,
      tag: `🚨 ${regime.badge}`,
      themeColor: "#ef4444",
      tagBg: "#dc2626",
      mainText: "아직도 감으로 레버리지 사요?",
      subHighlight: `${regime.headline.replace(/"/g, '')}`,
      desc: `${descs.weeklyDesc || '주봉 60·120주 매크로'} | 과열도 ${regime.heatIndex}점`,
      script: `아직도 나스닥 레버리지 무지성 매수하십니까? 현재 시장은 ${regime.badge} 상태입니다! ${regime.headline.replace(/"/g, '')}! 일봉 200일선과 주봉 60주선, 120주선 시스템을 믿어야 계좌가 삽니다.`
    },
    {
      id: 2,
      tag: "🚀 STEP 1. 상승 & 60주선 눌림",
      themeColor: "#38bdf8",
      tagBg: "#0284c7",
      mainText: "200일·60주선 위? QLD 폭격!",
      subHighlight: "일봉 200일선 위 75%, 주봉 60주선 지지 시 50%",
      desc: "25년 백테스트 승률 86.8% 핵심 추세 구간",
      script: "일봉 200일선 위 대세 상승장엔 큐엘디 75%, 일봉이 깨져도 주봉 60주선이 버티면 50% 눌림목 매수로 복리를 극대화합니다."
    },
    {
      id: 3,
      tag: "🛡️ STEP 2. 주봉 60주선 붕괴",
      themeColor: "#34d399",
      tagBg: "#059669",
      mainText: "60주선 붕괴? 매수 전면 STOP!",
      subHighlight: "내 쌩돈 1원도 안 태우고, 연 8.3% 월배당 축적",
      desc: "GPIX 방패로 원금 지키며 주봉 120주선 대기",
      script: "하지만 주봉 60주선이 진짜 무너지면 레버리지 매수 전면 스톱! 지픽스 월배당으로 연 8.3% 현금 총알만 복사합니다."
    },
    {
      id: 4,
      tag: `🎯 ${sessionTitle} 추천`,
      themeColor: "#fbbf24",
      tagBg: "#d97706",
      mainText: `권장: ${posClean.split('/')[0].trim()}`,
      subHighlight: `${regime.bottomText}`,
      desc: `주봉 120주선 대바닥 & 20일선 돌파 시 TQQQ 저격`,
      script: `오늘 시스템 권장 포지션은 ${posClean}입니다! 감정 버리고 주봉과 일봉 시스템으로 돈 버실 분들, 지금 팔로우 박으세요!`
    }
  ];

  const videoOutputPath = path.resolve('./daily_reels_video.mp4');
  await renderFastReelsVideo(slidesData, videoOutputPath);

  const caption = `[QLD 절대 생존 퀀트 v4.0: ${sessionTitle}]
${regime.headline}

■ 현재 시스템 진단: ${regime.badge}
■ 주봉 60·120주 추세: ${descs.weeklyDesc || ''}
■ 권장 포지션: ${posClean}

#미국주식 #나스닥 #QLD #TQQQ #GPIX #재테크 #릴스 #퀀트봇`;

  const igRes = await publishReelsToInstagram(videoOutputPath, caption, true);

  // YouTube Shorts 동시 발행 (모듈 존재 시)
  try {
    if (fs.existsSync(path.resolve('./youtube_bot.js'))) {
      const { publishYouTubeShorts } = require('./youtube_bot.js');
      const ytTitle = `[미국주식 퀀트] ${regime.badge} | ${sessionTitle} (${posClean.split('/')[0].trim()}) #Shorts`;
      await publishYouTubeShorts(videoOutputPath, ytTitle, postContent || caption);
    }
  } catch (ytErr) {
    console.warn('⚠️ YouTube Shorts 건너뜀 또는 오류:', ytErr.message);
  }

  // TikTok 동시 발행 (모듈 존재 시)
  try {
    if (fs.existsSync(path.resolve('./tiktok_bot.js'))) {
      const { publishToTikTok } = require('./tiktok_bot.js');
      const ttTitle = `[QLD 퀀트] ${regime.headline.replace(/"/g, '')} #미국주식 #나스닥 #QLD #TQQQ #GPIX`;
      await publishToTikTok(videoOutputPath, ttTitle, process.env.TIKTOK_PUBLISH_MODE || 'inbox');
    }
  } catch (ttErr) {
    console.warn('⚠️ TikTok 건너뜀 또는 오류:', ttErr.message);
  }

  return igRes;
}

module.exports = {
  publishReelsToInstagram,
  renderFastReelsVideo,
  generateSlideSvg,
  createAndPublishDailyReel
};
