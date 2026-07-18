#!/usr/bin/env node
// 노션 자료 모음집 동기화 스크립트
//
// 사용법:
//   1. Notion 통합(integration) 토큰을 준비하고, 자료로 쓸 페이지마다
//      "연결 추가(Add connections)"로 그 통합을 연결한다.
//   2. NOTION_TOKEN 환경변수로 토큰을 넘겨서 실행한다 (커밋 금지):
//        NOTION_TOKEN=ntn_xxx node scripts/notion-sync.mjs
//   3. 새 자료를 추가하려면 아래 PAGES 배열에 노션 페이지 링크나 ID를 한 줄 추가하고 다시 실행한다.
//
// 무엇을 하는가:
//   - PAGES에 적힌 각 노션 페이지의 블록을 Notion API로 읽어와서
//     사이트 톤에 맞는 정적 HTML로 변환해 resources/<id>.html 로 저장한다.
//   - 이미지는 resources/img/ 에 다운로드해서 로컬 경로로 바꿔준다 (노션 이미지 URL은 1시간 후 만료됨).
//   - index.html 안의 RES 배열(NOTION_RESOURCES_START~END 사이)을 자동으로 다시 써준다.
//   - 토글(▶) 블록은 전부 펼친 상태로 변환한다 (인터랙션 없음).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RES_DIR = path.join(ROOT, 'resources');
const IMG_DIR = path.join(RES_DIR, 'img');
const INDEX_HTML = path.join(ROOT, 'index.html');

const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) {
  console.error('NOTION_TOKEN 환경변수가 필요합니다. 예) NOTION_TOKEN=ntn_xxx node scripts/notion-sync.mjs');
  process.exit(1);
}

// 자료 목록: 노션 페이지 링크 또는 ID를 한 줄씩 추가하면 됩니다.
const PAGES = [
  '39be43a1-6720-8075-a6d0-ef48461e984f', // Fable 5로 반드시 해야할 4가지
  '226e43a1-6720-8077-8b3d-db6bbfac58f1', // 제미나이로 PPT 만들기
  '2e7e43a1-6720-80f1-b44b-e3b514276788', // 제미나이로 영상 만들기
  '305e43a1-6720-8026-9a40-fb20af363d90', // 배송 안내 이미지 제작하기
  '306e43a1-6720-8029-9256-c5a7960d7cee', // 식료품 패키징 이미지 만들기
  '310e43a1-6720-805c-9287-d6bbcfe5094e', // 나노 바나나 2 이미지 프롬프트
  '317e43a1-6720-80c0-8018-e7a5e419da38', // 봄동 비빔밥 젤리 만들기
  '322e43a1-6720-8012-bf1a-f16552155063', // 나만의 이모티콘 제작 가이드
  '329e43a1-6720-809e-a0bf-e154aa1e21a7', // 나노 바나나 2 실무 활용 프롬프트
  '32ee43a1-6720-807f-b3f5-ecbca5963910', // 노트북LM 가이드 및 상황별 프롬프트
  '331e43a1-6720-803e-a46e-e0f1e0f6dcde', // PPT 아이콘 만들기
  '34ae43a1-6720-80e5-8e79-dbd17833278a', // 클로드 자동화: 뉴스·주식 정보 매일 받는 법
  '351e43a1-6720-80f4-9660-c148a220b34f', // 클로드 커넥터로 내 업무자동화하는 방법
  '356e43a1-6720-80c2-9c07-ff5ff2a5e3db', // 클로드 가이드 — AI가 처음인 당신을 위해
  '370e43a1-6720-805d-aa28-f864dee55586', // 반복 업무 시간을 단축시키는 AI 활용법
  '373e43a1-6720-80de-be57-e3a0004eb1e6', // 클로드 모델 선택 가이드
  '373e43a1-6720-80fc-abbf-c520a4ffcbc5', // 클로드 제대로 쓰는 법
  '378e43a1-6720-801e-bc27-ca5ebafd5133', // 카드뉴스를 MP4 영상으로 변환하는 법
  '379e43a1-6720-80cf-abbe-e8621ca42055', // 유튜브 영상 → 카드뉴스 자동화 프로그램 제작
  '37de43a1-6720-807f-b552-e7ed76a0dab1', // 주식 정보 카톡으로 받아보기
  '37fe43a1-6720-8010-ad61-d1de2c79fb3a', // 내 업무 전용 AI 팀 만들기 - AI 오케스트레이션
  '381e43a1-6720-8001-b516-fe4a5769ddfb', // 옵시디언 + 클로드 셋업 가이드
  '385e43a1-6720-80aa-829f-e3b13c0f2395', // AI로 영상 만드는 법
  '38ee43a1-6720-80ec-9283-c07121a1a2d2', // 1인 크리에이터 필수, 클로드 코드 확장기능 3가지
  '392e43a1-6720-806c-96bd-ccf7f4dba195', // 클로드 무료 이용권 상세 가이드
  '397e43a1-6720-802e-98ba-d0971f7b8712', // 요즘 유행하는 AI 영상 제작하기
  '399e43a1-6720-80da-b2ed-e7a609c76206', // 나만의 나무위키 페이지 만들기 — 전체 튜토리얼
];

const TAG_COLOR = { '가이드': '#35e0e0', '프롬프트': '#f2e14a', '영상': '#f45cf4', '이미지': '#35e05a', '튜토리얼': '#7e84e6', '기타': '#ff8a3d' };

// 카테고리(대분류) — 자료 모음집 화면의 필터 탭에 쓰인다.
// 새 자료를 추가하면 여기에도 id: '카테고리명'을 추가해줄 것. 안 넣으면 '기타'로 분류되고 실행 시 경고가 뜬다.
const CATEGORIES = ['클로드 활용', '영상 제작', '이미지·디자인', '업무 자동화', '생산성 도구'];
const CATEGORY_COLOR = { '클로드 활용': '#35e0e0', '영상 제작': '#f45cf4', '이미지·디자인': '#35e05a', '업무 자동화': '#ff8a3d', '생산성 도구': '#7e84e6', '기타': '#a7abdb' };
const CATEGORY_MAP = {
  '39be43a167208075a6d0ef48461e984f': '클로드 활용', // Fable 5로 반드시 해야할 4가지
  '226e43a1672080778b3ddb6bbfac58f1': '이미지·디자인', // 제미나이로 PPT 만들기
  '2e7e43a1672080f1b44be3b514276788': '영상 제작', // 제미나이로 영상 만들기
  '305e43a1672080269a40fb20af363d90': '이미지·디자인', // 배송 안내 이미지 제작하기
  '306e43a1672080299256c5a7960d7cee': '이미지·디자인', // 식료품 패키징 이미지 만들기
  '310e43a16720805c9287d6bbcfe5094e': '이미지·디자인', // 나노 바나나 2 이미지 프롬프트
  '317e43a1672080c08018e7a5e419da38': '이미지·디자인', // 봄동 비빔밥 젤리 만들기
  '322e43a167208012bf1af16552155063': '이미지·디자인', // 나만의 이모티콘 제작 가이드
  '329e43a16720809ea0bfe154aa1e21a7': '이미지·디자인', // 나노 바나나 2 실무 활용 프롬프트
  '32ee43a16720807fb3f5ecbca5963910': '생산성 도구', // 노트북LM 가이드 및 상황별 프롬프트
  '331e43a16720803ea46ee0f1e0f6dcde': '이미지·디자인', // PPT 아이콘 만들기
  '34ae43a1672080e58e79dbd17833278a': '업무 자동화', // 클로드 자동화: 뉴스·주식 정보 매일 받는 법
  '351e43a1672080f49660c148a220b34f': '클로드 활용', // 클로드 커넥터로 내 업무자동화하는 방법
  '356e43a1672080c29c07ff5ff2a5e3db': '클로드 활용', // 클로드 가이드
  '370e43a16720805daa28f864dee55586': '클로드 활용', // 반복 업무 시간을 단축시키는 AI 활용법
  '373e43a1672080debe57e3a0004eb1e6': '클로드 활용', // 클로드 모델 선택 가이드
  '373e43a1672080fcabbfc520a4ffcbc5': '클로드 활용', // 클로드 제대로 쓰는 법
  '378e43a16720801ebc27ca5ebafd5133': '영상 제작', // 카드뉴스를 MP4 영상으로 변환하는 법
  '379e43a1672080cfabbee8621ca42055': '업무 자동화', // 유튜브 영상 → 카드뉴스 자동화 프로그램 제작
  '37de43a16720807fb552e7ed76a0dab1': '업무 자동화', // 주식 정보 카톡으로 받아보기
  '37fe43a167208010ad61d1de2c79fb3a': '클로드 활용', // 내 업무 전용 AI 팀 만들기 - AI 오케스트레이션
  '381e43a167208001b516fe4a5769ddfb': '클로드 활용', // 옵시디언 + 클로드 셋업 가이드
  '385e43a1672080aa829fe3b13c0f2395': '영상 제작', // AI로 영상 만드는 법
  '38ee43a1672080ec9283c07121a1a2d2': '클로드 활용', // 1인 크리에이터 필수, 클로드 코드 확장기능 3가지
  '392e43a16720806c96bdccf7f4dba195': '클로드 활용', // 클로드 무료 이용권 상세 가이드
  '397e43a16720802e98bad0971f7b8712': '영상 제작', // 요즘 유행하는 AI 영상 제작하기
  '399e43a1672080dab2ede7a609c76206': '생산성 도구', // 나만의 나무위키 페이지 만들기
};

function normalizeId(raw) {
  const m = raw.match(/([0-9a-fA-F]{32})(?:[?#]|$)/) || raw.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
  if (!m) throw new Error('노션 페이지 ID를 찾을 수 없음: ' + raw);
  const hex = m[1].replace(/-/g, '');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function notionFetch(url, opts = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      ...opts,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') || '1') * 1000 + 300;
      await sleep(wait);
      continue;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(`Notion API ${res.status}: ${JSON.stringify(data)}`);
    await sleep(340); // 레이트리밋 방지
    return data;
  }
  throw new Error('Notion API 429 재시도 초과: ' + url);
}

async function fetchAllChildren(blockId) {
  let results = [];
  let cursor;
  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
    url.searchParams.set('page_size', '100');
    if (cursor) url.searchParams.set('start_cursor', cursor);
    const data = await notionFetch(url);
    results = results.concat(data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 다크 네이비 배경(#05053a~#0a0a5a)에서도 잘 읽히도록 조정한 노션 색상 팔레트
const COLOR_MAP = {
  gray: '#a7abdb', brown: '#d3a06c', orange: '#ffab5e', yellow: '#f2e14a',
  green: '#4be07a', blue: '#6cc7ff', purple: '#cf9bff', pink: '#ff8ce8', red: '#ff6b6b',
};
const BG_COLOR_MAP = {
  gray_background: '#33355c', brown_background: '#4a3626', orange_background: '#4a3418',
  yellow_background: '#4a441a', green_background: '#1c4a2e', blue_background: '#1a3a4a',
  purple_background: '#3a2650', pink_background: '#4a2040', red_background: '#4a2020',
};
function colorStyle(color) {
  if (!color || color === 'default') return '';
  if (BG_COLOR_MAP[color]) return `background:${BG_COLOR_MAP[color]};color:#f4f5ff;padding:1px 4px;`;
  if (COLOR_MAP[color]) return `color:${COLOR_MAP[color]};`;
  return '';
}

function richTextToHtml(rt) {
  if (!rt || !rt.length) return '';
  return rt.map((t) => {
    let text = esc(t.plain_text || '').replace(/\n/g, '<br>');
    const a = t.annotations || {};
    if (a.code) text = `<code>${text}</code>`;
    if (a.bold) text = `<strong>${text}</strong>`;
    if (a.italic) text = `<em>${text}</em>`;
    if (a.strikethrough) text = `<s>${text}</s>`;
    if (a.underline) text = `<u>${text}</u>`;
    const style = colorStyle(a.color);
    if (style) text = `<span style="${style}">${text}</span>`;
    const href = t.href || t.text?.link?.url;
    if (href) text = `<a href="${esc(href)}" target="_blank" rel="noopener">${text}</a>`;
    return text;
  }).join('');
}

function richTextToPlain(rt) {
  return (rt || []).map((t) => t.plain_text || '').join('');
}

async function downloadImage(url, ctx) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || '';
    const isGif = ct.includes('gif'); // sips가 애니메이션 gif는 못 다루므로 원본 유지
    const ext = isGif ? 'gif' : 'jpg';
    const fname = `${ctx.pageId}-${ctx.imgIndex++}.${ext}`;
    const fpath = path.join(IMG_DIR, fname);
    await fs.writeFile(fpath, buf);
    if (!isGif && buf.length > 150 * 1024) {
      try {
        const { stdout } = await execFileAsync('sips', ['-g', 'pixelWidth', fpath]);
        const wm = stdout.match(/pixelWidth:\s*(\d+)/);
        const width = wm ? Number(wm[1]) : 0;
        const args = ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78'];
        if (width > 1400) args.push('--resampleWidth', '1400');
        args.push(fpath, '--out', fpath);
        await execFileAsync('sips', args);
      } catch (e) { /* sips 실패 시 원본 그대로 사용 */ }
    }
    return 'resources/img/' + fname;
  } catch (e) {
    return null;
  }
}

const LIST_TYPES = new Set(['bulleted_list_item', 'numbered_list_item', 'to_do']);
const DESC_SKIP_PATTERNS = [/상업적\s*판매\s*금지/, /수시로\s*업데이트/, /DM으로\s*(문의|공유)/, /Copyright/i, /all rights reserved/i, /부체오\)/];

async function blocksToHtml(blocks, ctx, depth = 0) {
  let html = '';
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (LIST_TYPES.has(b.type)) {
      const runType = b.type;
      const tag = runType === 'numbered_list_item' ? 'ol' : 'ul';
      let items = '';
      while (i < blocks.length && blocks[i].type === runType) {
        items += await blockToHtml(blocks[i], ctx, depth);
        i++;
      }
      html += `<${tag}>${items}</${tag}>`;
      continue;
    }
    html += await blockToHtml(b, ctx, depth);
    i++;
  }
  return html;
}

async function blockToHtml(block, ctx, depth) {
  const t = block.type;
  const val = block[t];
  const children = block.has_children ? await fetchAllChildren(block.id) : [];

  switch (t) {
    case 'paragraph': {
      const inner = richTextToHtml(val.rich_text);
      if (ctx.firstText === null && depth === 0 && inner) {
        const plain = richTextToPlain(val.rich_text).trim();
        if (plain && !DESC_SKIP_PATTERNS.some((re) => re.test(plain))) ctx.firstText = plain;
      }
      const childHtml = await blocksToHtml(children, ctx, depth + 1);
      return inner || childHtml ? `<p>${inner}</p>${childHtml}` : '';
    }
    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      const level = t === 'heading_1' ? 1 : t === 'heading_2' ? 2 : 3;
      const label = richTextToHtml(val.rich_text);
      if (val.is_toggleable) {
        // 노션 "토글 제목" — 제목 자체가 펼치기 버튼인 토글
        const inner = await blocksToHtml(children, ctx, depth + 1);
        return `<details class="nb-toggle"><summary>${label}</summary><div class="toggle-body">${inner}</div></details>`;
      }
      const childHtml = await blocksToHtml(children, ctx, depth);
      return `<h${level}>${label}</h${level}>${childHtml}`;
    }
    case 'bulleted_list_item':
    case 'numbered_list_item': {
      const childHtml = await blocksToHtml(children, ctx, depth + 1);
      return `<li>${richTextToHtml(val.rich_text)}${childHtml}</li>`;
    }
    case 'to_do': {
      const childHtml = await blocksToHtml(children, ctx, depth + 1);
      return `<li class="todo">${val.checked ? '☑' : '☐'} ${richTextToHtml(val.rich_text)}${childHtml}</li>`;
    }
    case 'toggle': {
      const label = richTextToHtml(val.rich_text);
      const inner = await blocksToHtml(children, ctx, depth + 1);
      return `<details class="nb-toggle"><summary>${label}</summary><div class="toggle-body">${inner}</div></details>`;
    }
    case 'quote': {
      const childHtml = await blocksToHtml(children, ctx, depth + 1);
      return `<blockquote>${richTextToHtml(val.rich_text)}${childHtml}</blockquote>`;
    }
    case 'callout': {
      const icon = val.icon?.emoji || '💡';
      const inner = richTextToHtml(val.rich_text);
      const childHtml = await blocksToHtml(children, ctx, depth + 1);
      return `<div class="callout"><div>${icon}</div><div>${inner}${childHtml}</div></div>`;
    }
    case 'code': {
      // richTextToHtml을 써서 노션에서 표시해둔 색상 강조(예: 직접 수정할 부분 빨간색)를 그대로 보존
      const codeHtml = richTextToHtml(val.rich_text);
      return `<pre><button class="copy-btn" type="button">복사</button><code>${codeHtml}</code></pre>`;
    }
    case 'divider': return '<hr>';
    case 'image': {
      const src = val.type === 'external' ? val.external.url : val.file.url;
      const local = await downloadImage(src, ctx);
      const caption = richTextToHtml(val.caption);
      if (!local) return '';
      return `<figure><img src="${local}" alt="">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
    }
    case 'table': {
      const rows = children;
      const hasColHeader = val.has_column_header;
      let rowsHtml = '';
      rows.forEach((row, ri) => {
        const cells = row.table_row?.cells || [];
        const cellTag = hasColHeader && ri === 0 ? 'th' : 'td';
        rowsHtml += '<tr>' + cells.map((c) => `<${cellTag}>${richTextToHtml(c)}</${cellTag}>`).join('') + '</tr>';
      });
      return `<table>${rowsHtml}</table>`;
    }
    case 'column_list':
    case 'column':
    case 'synced_block':
      return await blocksToHtml(children, ctx, depth);
    case 'bookmark':
    case 'embed':
    case 'link_preview': {
      const url = val.url;
      return url ? `<p><a href="${esc(url)}" target="_blank" rel="noopener">🔗 ${esc(url)}</a></p>` : '';
    }
    case 'video':
    case 'file':
    case 'pdf': {
      if (val.type === 'external' && val.external?.url) {
        return `<p><a href="${esc(val.external.url)}" target="_blank" rel="noopener">📎 첨부 자료 열기</a></p>`;
      }
      return '<p style="color:#7e84e6;">📎 (원본 노션에 첨부된 파일 — 새 탭에서 열기로 확인해주세요)</p>';
    }
    case 'equation':
      return `<pre><code>${esc(val.expression || '')}</code></pre>`;
    default:
      return val?.rich_text ? `<p>${richTextToHtml(val.rich_text)}</p>` : '';
  }
}

function parseTitle(raw) {
  let s = raw.trim();
  let bracket = null;
  const m = s.match(/^\[([^\]]+)\]\s*/);
  if (m) { bracket = m[1]; s = s.slice(m[0].length); }
  let title = s, desc = '';
  const dashIdx = s.indexOf(' — ');
  if (dashIdx >= 0) { title = s.slice(0, dashIdx).trim(); desc = s.slice(dashIdx + 3).trim(); }
  return { bracket, title: title.trim(), desc };
}

function pickTag(rawTitle, bracket) {
  if (rawTitle.includes('영상')) return '영상';
  if (rawTitle.includes('이미지')) return '이미지';
  if (rawTitle.includes('나무위키')) return '튜토리얼';
  if (bracket === '프롬프트') return '프롬프트';
  return '가이드';
}

async function processPage(rawIdOrUrl) {
  const id = normalizeId(rawIdOrUrl);
  const flatId = id.replace(/-/g, '');
  const page = await notionFetch(`https://api.notion.com/v1/pages/${id}`);
  const titleProp = page.properties?.title?.title || page.properties?.Name?.title || [];
  const rawTitle = titleProp.map((t) => t.plain_text).join('').trim() || '(제목 없음)';
  const { bracket, title, desc: descFromTitle } = parseTitle(rawTitle);
  const tag = pickTag(rawTitle, bracket);
  const category = CATEGORY_MAP[flatId] || '기타';
  if (!CATEGORY_MAP[flatId]) console.log(`  ⚠ 카테고리 미지정 → '기타'로 분류됨. CATEGORY_MAP에 추가해주세요: ${flatId}`);
  const color = CATEGORY_COLOR[category];

  const ctx = { pageId: flatId, imgIndex: 0, firstText: null };
  const topBlocks = await fetchAllChildren(id);
  const bodyHtml = await blocksToHtml(topBlocks, ctx);

  const desc = descFromTitle || (ctx.firstText ? ctx.firstText.slice(0, 60) : '');

  await fs.writeFile(path.join(RES_DIR, `${flatId}.html`), bodyHtml, 'utf8');

  return {
    id: flatId,
    title,
    desc,
    tag,
    category,
    color,
    url: page.public_url || null,
  };
}

function toResJs(entries) {
  const lines = entries.map((e) => {
    const parts = [
      `id: ${JSON.stringify(e.id)}`,
      `title: ${JSON.stringify(e.title)}`,
      `desc: ${JSON.stringify(e.desc)}`,
      `tag: ${JSON.stringify(e.tag)}`,
      `category: ${JSON.stringify(e.category)}`,
      `color: ${JSON.stringify(e.color)}`,
    ];
    if (e.url) parts.push(`url: ${JSON.stringify(e.url)}`);
    return `    { ${parts.join(', ')} },`;
  });
  const catLines = CATEGORIES.map((c) => `    { name: ${JSON.stringify(c)}, color: ${JSON.stringify(CATEGORY_COLOR[c])} },`);
  return `  // === NOTION_RESOURCES_START (scripts/notion-sync.mjs 로 자동 생성됨 — 직접 수정해도 다음 실행 시 덮어써짐) ===\n  RES_CATEGORIES = [\n${catLines.join('\n')}\n  ];\n  RES = [\n${lines.join('\n')}\n  ];\n  // === NOTION_RESOURCES_END ===`;
}

async function main() {
  await fs.mkdir(IMG_DIR, { recursive: true });
  const entries = [];
  for (const p of PAGES) {
    process.stdout.write(`처리 중: ${p}\n`);
    try {
      const entry = await processPage(p);
      entries.push(entry);
      process.stdout.write(`  ✓ ${entry.title} [${entry.tag}]\n`);
    } catch (e) {
      process.stdout.write(`  ✗ 실패: ${e.message}\n`);
    }
  }

  const html = await fs.readFile(INDEX_HTML, 'utf8');
  const block = toResJs(entries);
  const re = /  \/\/ === NOTION_RESOURCES_START[\s\S]*?\/\/ === NOTION_RESOURCES_END ===/;
  if (!re.test(html)) {
    console.error('index.html에서 NOTION_RESOURCES_START/END 마커를 찾지 못했습니다.');
    process.exit(1);
  }
  await fs.writeFile(INDEX_HTML, html.replace(re, block), 'utf8');
  console.log(`\n완료: ${entries.length}개 자료를 index.html에 반영했습니다.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
