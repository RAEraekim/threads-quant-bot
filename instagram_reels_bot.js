process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const sharp = require('sharp');

// 1. 인스타그램 계정 및 토큰
const IG_USER_ID = (process.env.INSTAGRAM_ACCOUNT_ID && process.env.INSTAGRAM_ACCOUNT_ID.trim() !== "")
  ? process.env.INSTAGRAM_ACCOUNT_ID.trim()
  : "17841451358369247";

const PAGE_ACCESS_TOKEN = (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCESS_TOKEN.trim() !== "")
  ? process.env.INSTAGRAM_ACCESS_TOKEN.trim()
  : "EAAfdZBNdsyFcBS4zXVkV855SilZBJsFqLZBayNhU9HrKaGFYS1jBppWbL6yDgR1elsKQGLDZCdGxbzmZA2nVExdY8Lh2iuNSYkpZAHwuNtwAyePyQ4fHFZC92qtHDuoFuRKQnvEBZCTZBQXcK6MFZBCreP6leD9URg2QO2vHcwfXMtxLivIyOevct8o8DFnzG2AV7fRABxiTy7icT7Gghqh7HL5YOT74o349rIlvTrchW9eiXZCBDzrsECnRZC1PcpkgnKx8ZCOqznLWStMvqXSX8vMEp";

function getFfmpegPath() {
  if (process.platform === 'win32') {
    const winPath = path.resolve('node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');
    if (fs.existsSync(winPath)) return `"${winPath}"`;
  }
  return 'ffmpeg';
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

// 2. 9:16 세로 릴스 슬라이드 SVG 렌더러
function generateSlideSvg(item) {
  const themeColor = item.themeColor || "#38bdf8";
  const tagBg = item.tagBg || "#0284c7";

  return `
  <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1920" fill="#090d14"/>
    <circle cx="540" cy="500" r="450" fill="${themeColor}" fill-opacity="0.1"/>

    <g transform="translate(100, 200)">
      <rect width="360" height="64" rx="16" fill="${tagBg}"/>
      <text x="180" y="42" text-anchor="middle" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="28" font-weight="900">${item.tag}</text>
    </g>

    <g transform="translate(100, 380)">
      <text x="0" y="80" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="70" font-weight="900" letter-spacing="-2">${escapeXml(item.mainText)}</text>
      
      <g transform="translate(0, 130)">
        <rect width="880" height="150" rx="24" fill="${themeColor}" fill-opacity="0.15" stroke="${themeColor}" stroke-width="2.5"/>
        <text x="40" y="65" fill="${themeColor}" font-family="${FONT_FAMILY}" font-size="34" font-weight="900">${escapeXml(item.subHighlight)}</text>
        <text x="40" y="115" fill="#e2e8f0" font-family="${FONT_FAMILY}" font-size="26" font-weight="600">${escapeXml(item.desc)}</text>
      </g>
    </g>

    <g transform="translate(100, 800)">
      <rect width="880" height="620" rx="36" fill="#111722" stroke="#1e293b" stroke-width="2"/>
      
      <g transform="translate(50, 60)">
        <text x="0" y="30" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="24" font-weight="700">QUANT PROTOCOL #0${item.id}</text>
        <line x1="0" y1="55" x2="780" y2="55" stroke="#1e293b" stroke-width="1.5"/>

        <g transform="translate(0, 95)">
          <rect width="780" height="110" rx="20" fill="#18202f" stroke="${item.id === 2 ? '#38bdf8' : '#1e293b'}" stroke-width="${item.id === 2 ? '2' : '1'}"/>
          <text x="35" y="48" fill="#38bdf8" font-family="${FONT_FAMILY}" font-size="28" font-weight="900">1. QLD (나스닥 2배)</text>
          <text x="35" y="85" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="22">대세 상승장 복리 극대화 엔진 (평상시 75%)</text>
          ${item.id === 2 ? '<text x="735" y="65" text-anchor="end" fill="#38bdf8" font-size="30">🚀</text>' : ''}
        </g>

        <g transform="translate(0, 235)">
          <rect width="780" height="110" rx="20" fill="#18202f" stroke="${item.id === 3 ? '#34d399' : '#1e293b'}" stroke-width="${item.id === 3 ? '2' : '1'}"/>
          <text x="35" y="48" fill="#34d399" font-family="${FONT_FAMILY}" font-size="28" font-weight="900">2. GPIX (월배당 방패)</text>
          <text x="35" y="85" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="22">하락장 매수 중단 &amp; 연 8.3% 배당 실탄 비축</text>
          ${item.id === 3 ? '<text x="735" y="65" text-anchor="end" fill="#34d399" font-size="30">🛡️</text>' : ''}
        </g>

        <g transform="translate(0, 375)">
          <rect width="780" height="110" rx="20" fill="#18202f" stroke="${item.id === 4 ? '#fbbf24' : '#1e293b'}" stroke-width="${item.id === 4 ? '2' : '1'}"/>
          <text x="35" y="48" fill="#fbbf24" font-family="${FONT_FAMILY}" font-size="28" font-weight="900">3. TQQQ (바닥 저격수)</text>
          <text x="35" y="85" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="22">5대 지표 바닥 확인 시 배당 실탄으로 풀스윙</text>
          ${item.id === 4 ? '<text x="735" y="65" text-anchor="end" fill="#fbbf24" font-size="30">🎯</text>' : ''}
        </g>
      </g>
    </g>

    <g transform="translate(100, 1550)">
      <rect width="880" height="140" rx="28" fill="${item.id === 4 ? '#2563eb' : '#1e293b'}"/>
      <text x="440" y="84" text-anchor="middle" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="34" font-weight="900">${item.id === 4 ? '🔥 @safety_qld_bot 팔로우하고 신호 받기' : '@safety_qld_bot · 퀀트 생존 공식'}</text>
    </g>
  </svg>
  `;
}

// 3. 제로-딜레이 고속 릴스 비디오 렌더러
async function renderFastReelsVideo(slidesData, outputFilePath) {
  const ffmpeg = getFfmpegPath();
  const workDir = path.resolve('./temp_reels_render');
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

  console.log('🎬 [릴스 비디오 렌더링 시작]');

  // 1) 9:16 슬라이드 이미지 생성
  for (const item of slidesData) {
    const svg = generateSlideSvg(item);
    const imgPath = path.join(workDir, `slide_${item.id}.png`);
    await sharp(Buffer.from(svg)).png().toFile(imgPath);
  }

  // 2) 고속 텐션 UP 음성 합성 (속도 +28%, 피치 +7Hz) 및 앞뒤 무음 0초 칼트림
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

  // 3) 슬라이드별 제로-딜레이 세그먼트 생성
  const segmentFiles = [];
  for (let i = 1; i <= slidesData.length; i++) {
    const imgPath = path.join(workDir, `slide_${i}.png`);
    const audioPath = path.join(workDir, `trimmed_${i}.mp3`);
    const segPath = path.join(workDir, `seg_${i}.mp4`);

    const cmd = `${ffmpeg} -y -loop 1 -i "${imgPath}" -i "${audioPath}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -r 30 -shortest "${segPath}"`;
    execSync(cmd, { stdio: 'ignore' });
    segmentFiles.push(segPath);
  }

  // 4) 최종 병합
  const concatListContent = segmentFiles
    .map(f => `file '${f.replace(/\\/g, '/')}'`)
    .join('\n');
  const listFilePath = path.join(workDir, 'concat_list.txt');
  fs.writeFileSync(listFilePath, concatListContent, 'utf8');

  const mergeCmd = `${ffmpeg} -y -f concat -safe 0 -i "${listFilePath}" -c copy "${outputFilePath}"`;
  execSync(mergeCmd, { stdio: 'ignore' });

  console.log(`✅ [릴스 비디오 렌더링 완료]: ${outputFilePath}`);
}

// 4. Meta Graph API 헬퍼 함수
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

// 5. rupload.facebook.com 바이너리 직접 업로드
function uploadBinaryToRupload(uploadUri, filePath, token) {
  return new Promise((resolve, reject) => {
    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;
    const fileStream = fs.createReadStream(filePath);
    const urlObj = new URL(uploadUri);

    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${token}`,
        'offset': '0',
        'file_size': fileSize.toString(),
        'Content-Type': 'video/mp4',
        'Content-Length': fileSize
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
    fileStream.pipe(req);
  });
}

// 6. 메인 릴스 발행 함수 (Resumable Upload)
async function publishReelsToInstagram(videoPath, caption) {
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN.trim() === "") {
    console.warn('⚠️ [Instagram Reels] INSTAGRAM_ACCESS_TOKEN 이 설정되지 않아 발행을 건너뜁니다.');
    return null;
  }

  console.log(`\n==================================================`);
  console.log(`🚀 [인스타그램 릴스 자동 발행 시작] 계정 ID: ${IG_USER_ID}`);
  console.log(`==================================================`);

  // Step 1: Resumable 세션 초기화
  console.log('1단계: Meta Graph API 업로드 세션 생성 중...');
  const initRes = await postGraph(`/${IG_USER_ID}/media`, {
    upload_type: 'resumable',
    media_type: 'REELS',
    caption: caption,
    share_to_feed: 'true',
    access_token: PAGE_ACCESS_TOKEN
  });

  if (!initRes.body || !initRes.body.id || !initRes.body.uri) {
    throw new Error('릴스 세션 초기화 실패: ' + JSON.stringify(initRes.body));
  }

  const containerId = initRes.body.id;
  const uploadUri = initRes.body.uri;
  console.log(` -> Container ID: ${containerId}`);

  // Step 2: 바이너리 비디오 전송
  console.log('2단계: rupload.facebook.com 직접 전송 중...');
  await uploadBinaryToRupload(uploadUri, videoPath, PAGE_ACCESS_TOKEN);
  console.log(' -> 영상 바이너리 전송 완료');

  // Step 3: Meta 서버 인코딩 완료 대기
  console.log('3단계: 인스타그램 서버 비디오 인코딩 대기 (폴링)...');
  for (let i = 1; i <= 30; i++) {
    await sleep(5000);
    const statusRes = await getGraph(`/${containerId}`, {
      fields: 'status_code,status',
      access_token: PAGE_ACCESS_TOKEN
    });

    const code = statusRes.body?.status_code;
    console.log(`   [${i * 5}초] 인코딩 상태: ${code}`);

    if (code === 'FINISHED') break;
    if (code === 'ERROR') throw new Error('인코딩 오류: ' + JSON.stringify(statusRes.body));
  }

  // Step 4: 최종 발행
  console.log('4단계: 인스타그램 릴스 최종 발행...');
  const publishRes = await postGraph(`/${IG_USER_ID}/media_publish`, {
    creation_id: containerId,
    access_token: PAGE_ACCESS_TOKEN
  });

  if (!publishRes.body || !publishRes.body.id) {
    throw new Error('릴스 최종 발행 실패: ' + JSON.stringify(publishRes.body));
  }

  const mediaId = publishRes.body.id;
  await sleep(2000);
  const infoRes = await getGraph(`/${mediaId}`, {
    fields: 'permalink,shortcode',
    access_token: PAGE_ACCESS_TOKEN
  });

  const permalink = infoRes.body?.permalink || `https://www.instagram.com/reel/${infoRes.body?.shortcode}/`;
  console.log(`🎉🎉 [릴스 발행 완벽 성공!] Media ID: ${mediaId}`);
  console.log(`🔗 릴스 링크: ${permalink}`);

  return { mediaId, permalink };
}

// 7. 데일리 퀀트 릴스 자동 생성 및 발행 통합 함수
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
      desc: `과열도: ${regime.heatIndex}점 (${descs.heatDesc})`,
      script: `아직도 나스닥 레버리지 무지성 매수하십니까? 현재 시장은 ${regime.badge} 상태입니다! ${regime.headline.replace(/"/g, '')}! 감정 버리고 시스템을 믿어야 계좌가 삽니다.`
    },
    {
      id: 2,
      tag: "🚀 STEP 1. 대세 상승장",
      themeColor: "#38bdf8",
      tagBg: "#0284c7",
      mainText: "상승장엔? QLD 2배 복리 폭격!",
      subHighlight: "200일선 위에서는 자산을 2배속으로 팽창",
      desc: "확실한 상승장에서만 2배 레버리지 풀가동!",
      script: "화면 보시죠! 200일선 위 대세 상승장엔 큐엘디(QLD) 2배수로 계좌를 미친 속도로 불립니다."
    },
    {
      id: 3,
      tag: "🛡️ STEP 2. 위험/하락 구간",
      themeColor: "#34d399",
      tagBg: "#059669",
      mainText: "하락장엔? 매수 STOP! 배당 실탄 복사",
      subHighlight: "내 쌩돈은 1원도 안 태우고, 연 8.3% 월배당 축적",
      desc: "GPIX로 원금 100% 방어하면서 바닥 총알 충전!",
      script: "근데 하락장 오면 매수 전면 스톱! 내 쌩돈 절대 안 태우고, 지픽스(GPIX) 월배당으로 매달 연 8.3% 현금 총알을 복사합니다."
    },
    {
      id: 4,
      tag: `🎯 ${sessionTitle} 추천`,
      themeColor: "#fbbf24",
      tagBg: "#d97706",
      mainText: `권장: ${posClean.split('/')[0].trim()}`,
      subHighlight: `${regime.bottomText}`,
      desc: `5대 지표 바닥 확인 시 TQQQ 3배수 풀스윙!`,
      script: `오늘 시스템 권장 포지션은 ${posClean}입니다! 감정 버리고 기계처럼 돈 버실 분들, 지금 팔로우 박으세요!`
    }
  ];

  const videoOutputPath = path.resolve('./daily_reels_video.mp4');
  await renderFastReelsVideo(slidesData, videoOutputPath);

  const caption = `[QLD 절대 생존 퀀트: ${sessionTitle}]
${regime.headline}

■ 현재 시스템 진단: ${regime.badge}
■ 권장 포지션: ${posClean}

#미국주식 #나스닥 #QLD #TQQQ #GPIX #재테크 #릴스 #퀀트봇`;

  return await publishReelsToInstagram(videoOutputPath, caption);
}

module.exports = {
  publishReelsToInstagram,
  renderFastReelsVideo,
  generateSlideSvg,
  createAndPublishDailyReel
};
