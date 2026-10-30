// 웹푸시·홈 화면 아이콘 생성기. 그림은 이 파일에서 직접 그린 SVG가 원본이다(외부 이미지 없음).
// 실행: node scripts/build-push-icons.mjs  →  public/icons/push/*.svg·*.png, src/app/apple-icon.png
// 색은 globals.css 토큰 값과 같다(서비스 워커·PNG는 CSS 변수를 못 읽어 값을 적는다).
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const OUT = new URL('../public/icons/push/', import.meta.url).pathname;
const APP_DIR = new URL('../src/app/', import.meta.url).pathname;

const COLOR = {
  danger: '#b3312b', // --sb-danger
  warn: '#a3602c', // --sb-warn
  safe: '#2e8559', // --sb-safe
  brand: '#b0674d', // --sb-brand
};

// 모든 그림은 192×192 좌표계. fg = 그림 색, bg = 그림 안에 뚫어 보이는 바탕색
const GLYPHS = {
  bridge: () => `
    <path d="M52 114 C70 66 122 66 140 114" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round"/>
    <path d="M76 90 V114 M96 81 V114 M116 90 V114" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
    <rect x="36" y="112" width="120" height="16" rx="8" fill="#fff"/>
    <rect x="56" y="126" width="14" height="28" rx="4" fill="#fff"/>
    <rect x="122" y="126" width="14" height="28" rx="4" fill="#fff"/>`,
  sos: bg => `
    <path d="M96 44 L152 144 H40 Z" fill="#fff" stroke="#fff" stroke-width="14" stroke-linejoin="round"/>
    <rect x="88" y="76" width="16" height="40" rx="8" fill="${bg}"/>
    <circle cx="96" cy="130" r="9" fill="${bg}"/>`,
  fire: bg => `
    <path d="M96 38 C106 66 134 82 134 118 C134 140 117 154 96 154 C75 154 58 140 58 118 C58 98 68 86 78 76 C80 92 86 100 94 102 C90 80 92 58 96 38 Z" fill="#fff"/>
    <path d="M96 106 C103 116 113 124 113 135 C113 145 105 151 96 151 C87 151 79 145 79 135 C79 124 89 116 96 106 Z" fill="${bg}"/>`,
  fall: () => `
    <circle cx="122" cy="56" r="15" fill="#fff"/>
    <path d="M110 78 L86 114 M98 92 L132 102 M98 92 L70 80 M86 114 L114 134 M86 114 L64 140" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M42 156 H150" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`,
  weapon: () => `
    <path d="M70 128 L130 50 C140 40 154 48 146 62 L92 140 Z" fill="#fff"/>
    <path d="M74 140 L50 162" stroke="#fff" stroke-width="18" stroke-linecap="round"/>
    <path d="M60 124 L94 150" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`,
  anomaly: bg => `
    <path d="M36 96 C58 58 134 58 156 96 C134 134 58 134 36 96 Z" fill="#fff"/>
    <circle cx="96" cy="96" r="22" fill="${bg}"/>
    <circle cx="96" cy="96" r="8" fill="#fff"/>`,
  medication: () => `
    <g transform="rotate(-45 96 96)">
      <rect x="50" y="72" width="92" height="48" rx="24" fill="none" stroke="#fff" stroke-width="11"/>
      <path d="M74 72 H96 V120 H74 A24 24 0 0 1 74 72 Z" fill="#fff"/>
    </g>`,
  connection: () => `
    <circle cx="74" cy="70" r="19" fill="#fff"/>
    <circle cx="126" cy="78" r="15" fill="#fff"/>
    <path d="M38 150 C38 120 54 102 74 102 C94 102 110 120 110 150 Z" fill="#fff"/>
    <path d="M116 150 C116 128 120 112 128 108 C144 108 156 124 156 150 Z" fill="#fff"/>`,
};

// 알림 아이콘: 이름 → [그림, 종류색]. 서비스 워커·토스트가 같은 파일을 쓴다
const ICONS = {
  sos: ['sos', COLOR.danger],
  fire: ['fire', COLOR.warn],
  fall: ['fall', COLOR.warn],
  weapon: ['weapon', COLOR.warn],
  anomaly: ['anomaly', COLOR.warn],
  medication: ['medication', COLOR.safe],
  connection: ['connection', COLOR.brand],
  default: ['bridge', COLOR.brand],
};

const svg = (body, size = 192) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 192 192">${body}</svg>`;

async function write(name, markup, size) {
  writeFileSync(`${OUT}${name}.svg`, markup);
  await sharp(Buffer.from(markup)).resize(size, size).png().toFile(`${OUT}${name}.png`);
}

mkdirSync(OUT, { recursive: true });

for (const [name, [glyph, color]] of Object.entries(ICONS)) {
  await write(`icon-${name}`, svg(`<rect width="192" height="192" rx="44" fill="${color}"/>${GLYPHS[glyph](color)}`), 192);
}

// 배지: 안드로이드 상태 표시줄용 단색 실루엣(투명 바탕 + 흰 그림, 시스템이 색을 입힌다)
await write('badge', svg(GLYPHS.bridge()), 96);

// 홈 화면 앱 아이콘: 둥근 모서리 없이 꽉 채운다(maskable - 기기가 모양을 자른다). 그림은 가운데 60% 안
const appIcon = svg(`<rect width="192" height="192" fill="${COLOR.brand}"/>${GLYPHS.bridge()}`);
await write('app-192', appIcon, 192);
await sharp(Buffer.from(appIcon)).resize(512, 512).png().toFile(`${OUT}app-512.png`);
await sharp(Buffer.from(appIcon)).resize(180, 180).png().toFile(`${APP_DIR}apple-icon.png`);

console.log('push icons written');
