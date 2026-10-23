/**
 * 从笔记文案里抽取身高信息
 *
 * 用法:
 *   node scripts/extract-height.cjs --state search-166xz [--dry]
 *
 * 策略（保守优先，宁缺勿错）：
 *   1. 明确写法   166cm / 166 厘米 / 身高166 / 166小个子 / 168·57kg
 *   2. 语义写法   小个子 / 矮个子 / 娇小 → 归入 165 以下（value 留空，只标 tag）
 *                 高个子 / 180以上      → 归入 180+
 *   3. 抽不到     → unknown，不猜
 * 结果写回 _state.<name>.json 的 notes[id].height，并打印识别率报告。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'content');
const argv = process.argv.slice(2);
const stateName = (() => {
  const i = argv.indexOf('--state');
  return i >= 0 && argv[i + 1] ? argv[i + 1] : '';
})();
const DRY = argv.includes('--dry');
const STATE_FILE = path.join(ROOT, 'xhs', stateName ? `_state.${stateName}.json` : '_state.json');
const TAXONOMY = JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy.json'), 'utf8'));
const BANDS = TAXONOMY.heights;

const MIN = 145, MAX = 215;

/** 数值 → 身高段 */
function bandOf(cm) {
  if (cm == null) return BANDS.find(b => b.key === 'unknown');
  return BANDS.find(b => b.min != null && cm >= b.min && cm < b.max)
    || BANDS.find(b => b.key === 'h180');
}

/** 从一段文本里抽身高；返回 { value, raw, kind, confidence } */
function extract(text) {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ');

  // 0) 身高区间：165-175 / 165~175 / 165到175 → 取下限（穿搭参考以偏矮一侧为准）
  let m = t.match(/(\d{3})\s*[-–~～至到]\s*(\d{3})/);
  if (m && +m[1] >= MIN && +m[2] <= MAX) {
    return { value: +m[1], raw: m[0], kind: 'range', confidence: 'medium', range: [+m[1], +m[2]] };
  }

  // 1) 身高/体重写法：162/60、168·57kg → 第一个数是身高
  m = t.match(/(\d{3})\s*[\/·]\s*(\d{2,3})\s*(?:kg|斤|公斤)?/);
  if (m && +m[1] >= MIN && +m[1] <= MAX) {
    return { value: +m[1], raw: m[0], kind: 'height-weight', confidence: 'high' };
  }

  // 2) 明确带单位：166cm / 166 厘米 / 1.66米
  m = t.match(/(\d{3})\s*(?:cm|CM|Cm|厘米|公分)/);
  if (m) {
    const v = +m[1];
    if (v >= MIN && v <= MAX) return { value: v, raw: m[0], kind: 'explicit', confidence: 'high' };
  }
  m = t.match(/1[._](\d{2})\s*(?:米|m\b)/);
  if (m) {
    const v = 100 + +m[1];
    if (v >= MIN && v <= MAX) return { value: v, raw: m[0], kind: 'explicit', confidence: 'high' };
  }

  // 3) 身高+关键词：身高166
  m = t.match(/(?:身高|高)\s*(\d{3})/);
  if (m && +m[1] >= MIN && +m[1] <= MAX) return { value: +m[1], raw: m[0], kind: 'explicit', confidence: 'high' };

  // 4) 数字紧邻穿搭语义：166小个子 / 165男生 / 163穿搭（排除「60斤」这类体重）
  m = t.match(/(\d{3})\s*(?:小个子|矮个子|矮|男生|boy|穿搭)/i);
  if (m && +m[1] >= MIN && +m[1] <= MAX) return { value: +m[1], raw: m[0], kind: 'context', confidence: 'medium' };

  // 5) 开头就是三位数：166 小个子 / 168的男友
  m = t.match(/^\s*(\d{3})(?![0-9])/);
  if (m && +m[1] >= MIN && +m[1] <= MAX) return { value: +m[1], raw: m[0], kind: 'leading', confidence: 'medium' };

  // 6) 数字+的+人：168的男友 / 165的朋友
  m = t.match(/(\d{3})\s*的\s*(?:男友|男朋友|男生|人)/);
  if (m && +m[1] >= MIN && +m[1] <= MAX) return { value: +m[1], raw: m[0], kind: 'context', confidence: 'medium' };

  return null;
}

/** 语义兜底：没有数字时看是否提到「小个子 / 高个子」 */
function semantic(text) {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ');
  if (/小个子|矮个子|娇小|矮星人|显高/.test(t)) return { value: null, raw: '小个子', kind: 'semantic', confidence: 'low', tag: '小个子' };
  if (/高个子|180\+|一八零/.test(t)) return { value: null, raw: '高个子', kind: 'semantic', confidence: 'low', tag: '高个子' };
  return null;
}

function main() {
  if (!fs.existsSync(STATE_FILE)) throw new Error(`状态文件不存在: ${STATE_FILE}`);
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const ids = st.order || [];
  const stat = { total: ids.length, high: 0, medium: 0, low: 0, unknown: 0 };
  const bands = {};
  const samples = [];

  for (const id of ids) {
    const n = st.notes[id];
    const d = n.detail || {};
    const title = [n.title || '', d.title || ''].join(' ');
    const body = [d.desc || '', (d.tags || []).join(' ')].join(' ');

    // 标题优先：标题写了就以标题为准（正文常混入别人的身高）
    const hit = extract(title) || extract(body) || semantic(title) || semantic(body);

    if (hit) {
      const band = bandOf(hit.value);
      n.height = {
        value: hit.value,
        band: band.key,
        label: band.label,
        raw: hit.raw,
        kind: hit.kind,
        confidence: hit.confidence,
        range: hit.range || null,
        tag: hit.tag || band.tag || '',
      };
      stat[hit.confidence]++;
      bands[band.label] = (bands[band.label] || 0) + 1;
      if (samples.length < 12) samples.push(`${id.slice(0, 8)} | ${hit.value ?? '—'} | ${hit.kind} | ${(n.title || '').slice(0, 26)}`);
    } else {
      const band = bandOf(null);
      n.height = { value: null, band: band.key, label: band.label, raw: '', kind: 'none', confidence: 'none', tag: '' };
      stat.unknown++;
      bands[band.label] = (bands[band.label] || 0) + 1;
    }
  }

  if (!DRY) fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));

  const rate = ((stat.total - stat.unknown) / stat.total * 100).toFixed(1);
  console.log(`\n=== 身高抽取报告 · ${path.basename(STATE_FILE)} ===`);
  console.log(`总数 ${stat.total}｜识别 ${stat.total - stat.unknown}（${rate}%）｜未识别 ${stat.unknown}`);
  console.log(`置信度：high ${stat.high}｜medium ${stat.medium}｜low ${stat.low}`);
  console.log('身高段分布：');
  for (const [k, v] of Object.entries(bands).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(8)} ${String(v).padStart(3)}  ${'█'.repeat(Math.round(v / 2))}`);
  }
  console.log('抽样：');
  samples.forEach(s => console.log('  ' + s));
  if (DRY) console.log('\n(--dry 模式，未写入文件)');
}

main();
