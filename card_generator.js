const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const FONT_FAMILY = "'Pretendard', 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ----------------------------------------------------------------------------
// [슬라이드 1: 모던 핀테크 매거진 표지 (토스증권 / 머니그라피 룩)]
// ----------------------------------------------------------------------------
function generateSlide1Svg({ regime, disp, rsi, bb, stoch, vix, isPreMarket, dateStr, descs }) {
  const sessionTitle = isPreMarket ? "프리마켓 점검" : "정규장 마감 브리핑";
  const sessionHeader = isPreMarket ? "오늘 밤 권장 포지션" : "익일 권장 포지션";
  const dispSign = disp >= 0 ? '+' : '';

  // 포지션 상태 및 비율 파싱
  const isSniper = regime.badge.includes("스나이퍼") || regime.posText.includes("TQQQ");
  const isFreeze = regime.posText.includes("0%");
  const isHighHeat = regime.posText.includes("30%");

  let box1Title = "QLD";
  let box1Sub = "나스닥 2배 레버리지";
  let box1Ratio = "75%";
  let box1Badge = "적립 실행 🟢";
  let box1Color = "#10b981";

  let box2Title = "GPIX";
  let box2Sub = "S&P500 연 8.3% 월배당";
  let box2Ratio = "25%";
  let box2Badge = "실탄 축적 💰";
  let box2Color = "#38bdf8";

  if (isSniper) {
    box1Title = "TQQQ";
    box1Sub = "나스닥 3배 레버리지";
    box1Ratio = "80%";
    box1Badge = "바닥 타격 🎯";
    box1Color = "#fbbf24";

    box2Ratio = "20%";
    box2Badge = "잔여 방어 🛡️";
    box2Color = "#10b981";
  } else if (isFreeze) {
    box1Ratio = "0%";
    box1Badge = "매수 전면 동결 ✋";
    box1Color = "#ef4444";

    box2Ratio = "100%";
    box2Badge = "원금 방어 & 실탄 비축 🛡️";
    box2Color = "#10b981";
  } else if (isHighHeat) {
    box1Ratio = "30%";
    box1Badge = "비중 축소 ⚠️";
    box1Color = "#f59e0b";

    box2Ratio = "70%";
    box2Badge = "방어자산 확대 🛡️";
    box2Color = "#10b981";
  }

  // 헤드라인 2줄 파싱
  let rawHeadline = (regime.headline || "시장에 맞서지 않고 데이터로 대응한다").replace(/["']/g, '').trim();
  let line1 = rawHeadline;
  let line2 = "기계적 퀀트 생존 공식";

  if (rawHeadline.includes(',')) {
    const parts = rawHeadline.split(',');
    line1 = parts[0].trim();
    line2 = parts.slice(1).join(',').trim();
  } else if (rawHeadline.length > 15) {
    const half = Math.floor(rawHeadline.length / 2);
    const spaceIdx = rawHeadline.indexOf(' ', half);
    if (spaceIdx > 0) {
      line1 = rawHeadline.substring(0, spaceIdx).trim();
      line2 = rawHeadline.substring(spaceIdx).trim();
    }
  }

  const subCopy = escapeXml((regime.subIntro || "무지성 물타기를 멈추고 5대 지표 기반으로 방어벽을 세웁니다.").substring(0, 52) + "...");

  return `
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgMatte" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0f141c"/>
        <stop offset="100%" stop-color="#0a0d13"/>
      </linearGradient>

      <filter id="cardShadow" x="-10%" y="-5%" width="120%" height="115%">
        <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>

    <!-- 배경 -->
    <rect width="1080" height="1350" fill="url(#bgMatte)"/>

    <!-- 1. 상단 메타 바 -->
    <g transform="translate(80, 85)">
      <rect width="180" height="40" rx="10" fill="#2563eb" fill-opacity="0.2"/>
      <text x="90" y="26" text-anchor="middle" fill="#60a5fa" font-family="${FONT_FAMILY}" font-size="18" font-weight="700">미국주식 퀀트</text>
      <text x="920" y="27" text-anchor="end" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="20" font-weight="600">${escapeXml(dateStr)} · ${sessionTitle}</text>
    </g>

    <!-- 2. 빅 볼드 타이포그래피 (동적 헤드라인) -->
    <g transform="translate(80, 195)">
      <text x="0" y="55" fill="#f8fafc" font-family="${FONT_FAMILY}" font-size="58" font-weight="900" letter-spacing="-1.5">
        ${escapeXml(line1)}
      </text>

      <g transform="translate(0, 80)">
        <rect x="-4" y="22" width="560" height="28" rx="6" fill="#fbbf24" fill-opacity="0.35"/>
        <text x="0" y="55" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="58" font-weight="900" letter-spacing="-1.5">
          ${escapeXml(line2)}
        </text>
      </g>

      <text x="0" y="195" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="24" font-weight="500">
        ${subCopy}
      </text>
    </g>

    <!-- 3. 토스증권 스타일 [오늘의 포지션 티켓 카드] -->
    <g transform="translate(80, 480)" filter="url(#cardShadow)">
      <rect width="920" height="470" rx="32" fill="#151b26" stroke="#252d3d" stroke-width="1.5"/>

      <!-- 헤더 바 -->
      <g transform="translate(45, 45)">
        <text x="0" y="24" fill="#f8fafc" font-family="${FONT_FAMILY}" font-size="28" font-weight="800">
          ${sessionHeader}
        </text>
        <rect x="680" y="-3" width="150" height="36" rx="8" fill="#f59e0b" fill-opacity="0.15"/>
        <text x="755" y="22" text-anchor="middle" fill="#fbbf24" font-family="${FONT_FAMILY}" font-size="18" font-weight="700">
          ${escapeXml(regime.badge)}
        </text>
      </g>

      <line x1="45" y1="100" x2="875" y2="100" stroke="#252d3d" stroke-width="1.5"/>

      <!-- [아이템 1] -->
      <g transform="translate(45, 130)">
        <rect width="830" height="135" rx="20" fill="#1a2232" stroke="${box1Color}" stroke-width="1.5" stroke-opacity="0.4"/>
        <text x="35" y="52" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="32" font-weight="800">${box1Title} <tspan fill="#64748b" font-size="20" font-weight="500">${box1Sub}</tspan></text>
        
        <rect x="35" y="75" width="180" height="34" rx="8" fill="${box1Color}" fill-opacity="0.2"/>
        <text x="125" y="98" text-anchor="middle" fill="${box1Color}" font-family="${FONT_FAMILY}" font-size="18" font-weight="700">${box1Badge}</text>

        <text x="795" y="85" text-anchor="end" fill="${box1Color}" font-family="${FONT_FAMILY}" font-size="64" font-weight="900">${box1Ratio}</text>
      </g>

      <!-- [아이템 2] -->
      <g transform="translate(45, 290)">
        <rect width="830" height="135" rx="20" fill="#1a2232" stroke="${box2Color}" stroke-width="1.5" stroke-opacity="0.4"/>
        <text x="35" y="52" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="32" font-weight="800">${box2Title} <tspan fill="#64748b" font-size="20" font-weight="500">${box2Sub}</tspan></text>
        
        <rect x="35" y="75" width="220" height="34" rx="8" fill="${box2Color}" fill-opacity="0.2"/>
        <text x="145" y="98" text-anchor="middle" fill="${box2Color}" font-family="${FONT_FAMILY}" font-size="18" font-weight="700">${box2Badge}</text>

        <text x="795" y="85" text-anchor="end" fill="${box2Color}" font-family="${FONT_FAMILY}" font-size="64" font-weight="900">${box2Ratio}</text>
      </g>
    </g>

    <!-- 4. 실시간 팩트 체크 미니 칩 (3개 알약 태그) -->
    <g transform="translate(80, 995)">
      <g transform="translate(0, 0)">
        <rect width="288" height="100" rx="16" fill="#151b26" stroke="#252d3d" stroke-width="1.2"/>
        <text x="25" y="38" fill="#64748b" font-family="${FONT_FAMILY}" font-size="16" font-weight="600">200일선 이격도</text>
        <text x="25" y="78" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="28" font-weight="800">${dispSign}${disp.toFixed(1)}%</text>
        <text x="155" y="78" fill="#38bdf8" font-family="${FONT_FAMILY}" font-size="15" font-weight="600">(${escapeXml(descs.dispDesc)})</text>
      </g>

      <g transform="translate(316, 0)">
        <rect width="288" height="100" rx="16" fill="#151b26" stroke="#252d3d" stroke-width="1.2"/>
        <text x="25" y="38" fill="#64748b" font-family="${FONT_FAMILY}" font-size="16" font-weight="600">VIX 공포지수</text>
        <text x="25" y="78" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="28" font-weight="800">${vix.toFixed(1)}</text>
        <text x="135" y="78" fill="#f87171" font-family="${FONT_FAMILY}" font-size="15" font-weight="600">(${escapeXml(descs.vixDesc)})</text>
      </g>

      <g transform="translate(632, 0)">
        <rect width="288" height="100" rx="16" fill="#151b26" stroke="#252d3d" stroke-width="1.2"/>
        <text x="25" y="38" fill="#64748b" font-family="${FONT_FAMILY}" font-size="16" font-weight="600">복합 과열도</text>
        <text x="25" y="78" fill="#fbbf24" font-family="${FONT_FAMILY}" font-size="28" font-weight="900">${regime.heatIndex}점</text>
        <text x="145" y="78" fill="#fbbf24" font-family="${FONT_FAMILY}" font-size="15" font-weight="600">(${escapeXml(descs.heatDesc)})</text>
      </g>
    </g>

    <!-- 5. 하단 카드뉴스 표준 스와이프 바 -->
    <g transform="translate(80, 1145)">
      <rect width="920" height="72" rx="16" fill="#1e293b"/>
      <text x="45" y="44" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="20" font-weight="600">
        💡 감정을 지우고 5대 퀀트 지표로만 기계적 대응합니다.
      </text>
      <text x="875" y="44" text-anchor="end" fill="#60a5fa" font-family="${FONT_FAMILY}" font-size="20" font-weight="700">
        넘겨서 5대 지표 보기 👉
      </text>
    </g>

    <!-- 푸터 -->
    <g transform="translate(80, 1265)">
      <text x="0" y="30" fill="#64748b" font-family="${FONT_FAMILY}" font-size="20" font-weight="600">@safety_qld_bot</text>
      <text x="920" y="30" text-anchor="end" fill="#64748b" font-family="${FONT_FAMILY}" font-size="20" font-weight="600">1 / 3</text>
    </g>
  </svg>
  `;
}

// ----------------------------------------------------------------------------
// [슬라이드 2: 5대 퀀트 지표 대시보드 (실시간 리포트)]
// ----------------------------------------------------------------------------
function generateSlide2Svg({ regime, disp, rsi, bb, stoch, vix, descs }) {
  const dispSign = disp >= 0 ? '+' : '';

  const indicators = [
    { name: "1. 200일선 이격도", weight: "35%", val: `${dispSign}${disp.toFixed(1)}%`, desc: descs.dispDesc, pct: clamp((disp + 10) * 3.3, 5, 100), color: "#38bdf8" },
    { name: "2. 일봉 RSI 14", weight: "15%", val: `${rsi.toFixed(1)}`, desc: descs.rsiDesc, pct: clamp(rsi, 5, 100), color: "#818cf8" },
    { name: "3. 볼린저밴드 %B", weight: "15%", val: `${bb.toFixed(1)}%`, desc: descs.bbDesc, pct: clamp(bb, 5, 100), color: "#34d399" },
    { name: "4. 스토캐스틱 %D", weight: "15%", val: `${stoch.toFixed(1)}`, desc: descs.stochDesc, pct: clamp(stoch, 5, 100), color: "#fbbf24" },
    { name: "5. VIX 공포지수", weight: "20%", val: `${vix.toFixed(1)}`, desc: descs.vixDesc, pct: clamp((vix / 40) * 100, 5, 100), color: "#f87171" }
  ];

  let indRows = indicators.map((ind, i) => {
    const y = 370 + i * 145;
    const barWidth = Math.round(850 * (ind.pct / 100));
    return `
    <g transform="translate(80, ${y})">
      <rect width="920" height="125" rx="18" fill="#151b26" stroke="#252d3d" stroke-width="1.2"/>
      
      <!-- 지표 이름 및 가중치 -->
      <text x="35" y="48" fill="#f8fafc" font-family="${FONT_FAMILY}" font-size="28" font-weight="700">${escapeXml(ind.name)}</text>
      <text x="330" y="48" fill="#64748b" font-family="${FONT_FAMILY}" font-size="18">(가중치 ${escapeXml(ind.weight)})</text>
      
      <!-- 수치 및 해석 -->
      <text x="885" y="48" text-anchor="end" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="28" font-weight="800">
        ${escapeXml(ind.val)} <tspan fill="${ind.color}" font-size="20" font-weight="700">(${escapeXml(ind.desc)})</tspan>
      </text>

      <!-- 게이지 바 배경 -->
      <rect x="35" y="80" width="850" height="12" rx="6" fill="#1e293b"/>
      <!-- 게이지 바 채움 -->
      <rect x="35" y="80" width="${barWidth}" height="12" rx="6" fill="${ind.color}"/>
    </g>
    `;
  }).join('\n');

  return `
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1350" fill="#0f141c"/>

    <!-- 헤더 -->
    <g transform="translate(80, 85)">
      <text x="0" y="24" fill="#60a5fa" font-family="${FONT_FAMILY}" font-size="18" font-weight="700">실시간 데이터 진단</text>
      <text x="0" y="75" fill="#f8fafc" font-family="${FONT_FAMILY}" font-size="44" font-weight="900">5대 퀀트 복합 지표 현황</text>
    </g>

    <!-- 종합 점수 상단 카드 -->
    <g transform="translate(80, 200)">
      <rect width="920" height="130" rx="20" fill="#151b26" stroke="#f59e0b" stroke-width="1.8"/>
      <text x="40" y="52" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="22" font-weight="600">5대 지표 가중 합산 복합 과열도</text>
      <text x="40" y="98" fill="#f59e0b" font-family="${FONT_FAMILY}" font-size="42" font-weight="900">${regime.heatIndex}점 <tspan fill="#64748b" font-size="24" font-weight="500">/ 100점</tspan></text>

      <rect x="640" y="38" width="240" height="52" rx="14" fill="#1e293b"/>
      <text x="760" y="73" text-anchor="middle" fill="#fbbf24" font-family="${FONT_FAMILY}" font-size="22" font-weight="700">${escapeXml(descs.heatDesc)}</text>
    </g>

    <!-- 5개 지표 행 렌더링 -->
    ${indRows}

    <!-- 하단 스와이프 안내 -->
    <g transform="translate(80, 1145)">
      <rect width="920" height="72" rx="16" fill="#1e293b"/>
      <text x="45" y="44" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="20" font-weight="600">💡 "단일 지표는 속여도, 5대 복합 지표는 속이지 못한다."</text>
      <text x="875" y="44" text-anchor="end" fill="#60a5fa" font-family="${FONT_FAMILY}" font-size="20" font-weight="700">넘겨서 3원칙 보기 👉</text>
    </g>

    <g transform="translate(80, 1265)">
      <text x="0" y="30" fill="#64748b" font-family="${FONT_FAMILY}" font-size="20" font-weight="600">@safety_qld_bot</text>
      <text x="920" y="30" text-anchor="end" fill="#64748b" font-family="${FONT_FAMILY}" font-size="20" font-weight="600">2 / 3</text>
    </g>
  </svg>
  `;
}

// ----------------------------------------------------------------------------
// [슬라이드 3: 시스템 운용 규칙 및 채널 안내 (선명한 SVG)]
// ----------------------------------------------------------------------------
function generateSlide3Svg() {
  return `
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1350" fill="#0f141c"/>

    <!-- 헤더 -->
    <g transform="translate(80, 85)">
      <text x="0" y="24" fill="#60a5fa" font-family="${FONT_FAMILY}" font-size="18" font-weight="700">운용 프로토콜</text>
      <text x="0" y="75" fill="#f8fafc" font-family="${FONT_FAMILY}" font-size="44" font-weight="900">감정을 버린 3단계 생존 원칙</text>
    </g>

    <!-- 원칙 1: 상승장 -->
    <g transform="translate(80, 195)">
      <rect width="920" height="175" rx="20" fill="#151b26" stroke="#10b981" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="18" fill="#10b981" fill-opacity="0.2"/>
      <text x="50" y="57" text-anchor="middle" fill="#10b981" font-family="${FONT_FAMILY}" font-size="22" font-weight="800">1</text>
      
      <text x="85" y="57" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="28" font-weight="800">대세 상승장 (200일선 위)</text>
      <text x="880" y="57" text-anchor="end" fill="#10b981" font-family="${FONT_FAMILY}" font-size="24" font-weight="800">QLD 75% + GPIX 25%</text>

      <text x="45" y="108" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="22">나스닥 2배(QLD)로 복리 성장을 극대화하되,</text>
      <text x="45" y="142" fill="#38bdf8" font-family="${FONT_FAMILY}" font-size="22" font-weight="600">GPIX 월배당(연 8.3%)을 상시 비축하여 다가올 폭락장 실탄을 모읍니다.</text>
    </g>

    <!-- 원칙 2: 하락장 -->
    <g transform="translate(80, 395)">
      <rect width="920" height="175" rx="20" fill="#151b26" stroke="#ef4444" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="18" fill="#ef4444" fill-opacity="0.2"/>
      <text x="50" y="57" text-anchor="middle" fill="#ef4444" font-family="${FONT_FAMILY}" font-size="22" font-weight="800">2</text>
      
      <text x="85" y="57" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="28" font-weight="800">하락 진행 중 (200일선 아래)</text>
      <text x="880" y="57" text-anchor="end" fill="#ef4444" font-family="${FONT_FAMILY}" font-size="24" font-weight="800">QLD 0% | GPIX 100%</text>

      <text x="45" y="108" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="22">떨어지는 칼날을 잡지 않습니다. 레버리지 매수를 전면 동결하고</text>
      <text x="45" y="142" fill="#f87171" font-family="${FONT_FAMILY}" font-size="22" font-weight="600">S&amp;P500 월배당(GPIX)으로 원금을 지키며 총알만 장전합니다.</text>
    </g>

    <!-- 원칙 3: 바닥 반등 타격 -->
    <g transform="translate(80, 595)">
      <rect width="920" height="175" rx="20" fill="#151b26" stroke="#f59e0b" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="18" fill="#f59e0b" fill-opacity="0.2"/>
      <text x="50" y="57" text-anchor="middle" fill="#f59e0b" font-family="${FONT_FAMILY}" font-size="22" font-weight="800">3</text>
      
      <text x="85" y="57" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="28" font-weight="800">바닥 탈출 반등 (골든스나이퍼)</text>
      <text x="880" y="57" text-anchor="end" fill="#f59e0b" font-family="${FONT_FAMILY}" font-size="24" font-weight="800">TQQQ 80% + GPIX 20%</text>

      <text x="45" y="108" fill="#94a3b8" font-family="${FONT_FAMILY}" font-size="22">20일선 돌파 및 5대 지표 바닥 확인 시,</text>
      <text x="45" y="142" fill="#fbbf24" font-family="${FONT_FAMILY}" font-size="22" font-weight="600">모아둔 배당 실탄을 3배 레버리지(TQQQ)에 투입하여 V자 반등을 취합니다.</text>
    </g>

    <!-- 하단 채널 안내 카드 -->
    <g transform="translate(80, 800)">
      <rect width="920" height="310" rx="28" fill="#151b26" stroke="#2563eb" stroke-width="2"/>
      <g transform="translate(50, 45)">
        <text x="0" y="30" fill="#60a5fa" font-family="${FONT_FAMILY}" font-size="24" font-weight="800">🤖 QLD 절대 생존 퀀트 봇</text>
        <text x="0" y="80" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="34" font-weight="900">매일 2회 실시간 자동 브리핑</text>
        
        <rect x="0" y="110" width="820" height="120" rx="16" fill="#1a2232"/>
        <text x="35" y="152" fill="#f8fafc" font-family="${FONT_FAMILY}" font-size="24" font-weight="700">☀️ 오전 07:00 [정규장 마감 브리핑 &amp; 포지션]</text>
        <text x="35" y="195" fill="#f8fafc" font-family="${FONT_FAMILY}" font-size="24" font-weight="700">🌙 오후 19:00 [개장 전 프리마켓 점검 &amp; 매수 알림]</text>
      </g>
    </g>

    <!-- 팔로우 유도 CTA 바 -->
    <g transform="translate(80, 1145)">
      <rect width="920" height="72" rx="18" fill="#2563eb"/>
      <text x="460" y="45" text-anchor="middle" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="24" font-weight="800">
        🔥 지금 팔로우하고 매일 밤 기계적 포지션을 확인하세요.
      </text>
    </g>

    <!-- 푸터 -->
    <g transform="translate(80, 1265)">
      <text x="0" y="30" fill="#64748b" font-family="${FONT_FAMILY}" font-size="20" font-weight="600">@safety_qld_bot</text>
      <text x="920" y="30" text-anchor="end" fill="#64748b" font-family="${FONT_FAMILY}" font-size="20" font-weight="600">3 / 3</text>
    </g>
  </svg>
  `;
}

// ----------------------------------------------------------------------------
// 메인 카드뉴스 3장 일괄 생성 함수
// ----------------------------------------------------------------------------
async function generateAllCards(data, outputDir = './cards') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const nowKST = new Date(new Date().getTime() + 9 * 3600 * 1000);
  const dateStr = `${nowKST.getFullYear()}.${String(nowKST.getMonth() + 1).padStart(2, '0')}.${String(nowKST.getDate()).padStart(2, '0')}`;

  const renderData = { ...data, dateStr };

  const svg1 = generateSlide1Svg(renderData);
  const svg2 = generateSlide2Svg(renderData);
  const svg3 = generateSlide3Svg();

  const file1 = path.join(outputDir, 'card_1_cover.png');
  const file2 = path.join(outputDir, 'card_2_dashboard.png');
  const file3 = path.join(outputDir, 'card_3_protocol.png');

  console.log('🎨 핀테크 카드뉴스 렌더링 중 (1080x1350)...');
  await Promise.all([
    sharp(Buffer.from(svg1)).png().toFile(file1),
    sharp(Buffer.from(svg2)).png().toFile(file2),
    sharp(Buffer.from(svg3)).png().toFile(file3)
  ]);

  console.log(`✅ 핀테크 카드뉴스 3장 생성 완료!\n- ${file1}\n- ${file2}\n- ${file3}`);
  return [file1, file2, file3];
}

module.exports = { generateAllCards, generateSlide1Svg, generateSlide2Svg, generateSlide3Svg };
