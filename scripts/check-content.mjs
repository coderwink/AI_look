#!/usr/bin/env node
/**
 * 内容校验脚本 · 不依赖任何第三方包
 * 用法： node scripts/check-content.mjs
 * 检查项：JSON 可解析 / id 唯一 / 枚举合法 / 必填字段 / 图片文件存在 / 画幅比例合理 / 色值格式
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

let taxonomy, looksData, editorialsData, palettesData;
try { taxonomy = read('content/taxonomy.json'); } catch (e) { err(`taxonomy.json 解析失败：${e.message}`); }
try { looksData = read('content/looks.json'); } catch (e) { err(`looks.json 解析失败：${e.message}`); }
try { editorialsData = read('content/editorials.json'); } catch (e) { err(`editorials.json 解析失败：${e.message}`); }
try { palettesData = read('content/palettes.json'); } catch (e) { err(`palettes.json 解析失败：${e.message}`); }

if (taxonomy && looksData) {
  const styleKeys = new Set(taxonomy.styles.map((s) => s.key));
  const sceneKeys = new Set(taxonomy.scenes.map((s) => s.key));
  const seasonKeys = new Set(taxonomy.seasons.map((s) => s.key));
  const catKeys = new Set(taxonomy.itemCategories.map((c) => c.key));

  const seen = new Set();
  const looks = looksData.looks ?? [];

  if (!Array.isArray(looks)) err('looks.json 的 looks 必须是数组');

  looks.forEach((l, i) => {
    const where = `looks[${i}] ${l.id ?? '(缺 id)'}`;

    if (!l.id) err(`${where}: 缺少 id`);
    else if (seen.has(l.id)) err(`${where}: id 重复`);
    else seen.add(l.id);

    if (!l.title) err(`${where}: 缺少 title`);
    if (!Array.isArray(l.styles) || !l.styles.length) err(`${where}: styles 必须是非空数组`);
    (l.styles ?? []).forEach((s) => styleKeys.has(s) || err(`${where}: 未知风格 "${s}"`));
    (l.scenes ?? []).forEach((s) => sceneKeys.has(s) || err(`${where}: 未知场景 "${s}"`));
    (l.seasons ?? []).forEach((s) => seasonKeys.has(s) || err(`${where}: 未知季节 "${s}"`));

    if (!l.image?.src) err(`${where}: 缺少 image.src`);
    else if (!existsSync(join(ROOT, 'content/images/looks', l.image.src))) {
      err(`${where}: 图片不存在 content/images/looks/${l.image.src}`);
    }
    if (typeof l.image?.ratio !== 'number') err(`${where}: image.ratio 必须是数字`);
    else if (l.image.ratio < 0.4 || l.image.ratio > 2) err(`${where}: image.ratio 超出 0.4~2.0`);
    if (!l.image?.alt) warn(`${where}: 建议补 image.alt（无障碍）`);

    if (!Array.isArray(l.items) || !l.items.length) err(`${where}: items 不能为空`);
    (l.items ?? []).forEach((it, k) => {
      catKeys.has(it.cat) || err(`${where}: items[${k}] 未知品类 "${it.cat}"`);
      if (!it.name) err(`${where}: items[${k}] 缺少 name`);
    });

    if (!Array.isArray(l.palette) || l.palette.length < 2) err(`${where}: palette 至少 2 个色值`);
    (l.palette ?? []).forEach((c) => /^#[0-9a-fA-F]{6}$/.test(c) || err(`${where}: 色值格式错误 "${c}"`));

    if (!['published', 'draft'].includes(l.status)) err(`${where}: status 只能是 published / draft`);

    // 适穿身高区间：可选字段，但有就必须自洽
    if (l.heightFit !== undefined) {
      const f = l.heightFit;
      if (typeof f !== 'object' || f === null) err(`${where}: heightFit 必须是对象 { min, max, note }`);
      else {
        if (typeof f.min !== 'number' || typeof f.max !== 'number') err(`${where}: heightFit.min / max 必须是数字`);
        else if (f.min >= f.max) err(`${where}: heightFit.min 必须小于 max`);
        else {
          if (f.min < 140 || f.max > 210) warn(`${where}: heightFit 区间 ${f.min}–${f.max} 超出常规 140–210cm`);
          const covered = (taxonomy.heights ?? []).filter((h) => h.min !== null && f.min < h.max && f.max > h.min);
          if (!covered.length) warn(`${where}: heightFit 未覆盖任何身高段，身高筛选里会看不到`);
        }
        if (f.note && f.note.length > 40) warn(`${where}: heightFit.note 建议 40 字以内（详情页单行展示）`);
      }
    } else {
      warn(`${where}: 建议补 heightFit（身高筛选需要）`);
    }

    if (!l.desc) warn(`${where}: 建议补 desc（详情页正文）`);
    if (!l.tip) warn(`${where}: 建议补 tip（搭配提醒）`);
  });

  (editorialsData?.editorials ?? []).forEach((e, i) => {
    const where = `editorials[${i}] ${e.id ?? '(缺 id)'}`;
    if (!e.id) err(`${where}: 缺少 id`);
    else if (seen.has(e.id)) err(`${where}: id 与其它内容重复`);
    else seen.add(e.id);
    if (!['palette', 'list', 'quote'].includes(e.type)) err(`${where}: type 只能是 palette / list / quote`);
    if (e.type === 'palette' && !Array.isArray(e.swatches)) err(`${where}: palette 类型需要 swatches 数组`);
    if (e.type === 'list' && !Array.isArray(e.list)) err(`${where}: list 类型需要 list 数组`);
  });

  const published = looks.filter((l) => l.status === 'published').length;
  console.log(`\n内容统计：${looks.length} 套 look（已发布 ${published}）· ${(editorialsData?.editorials ?? []).length} 张编辑部卡 · ${(palettesData?.palettes ?? []).length} 组配色`);
  console.log(`分类字典：${styleKeys.size} 风格 / ${sceneKeys.size} 场景 / ${seasonKeys.size} 季节 / ${catKeys.size} 品类`);
}

// ---------- 配色手册 ----------
if (palettesData) {
  const kindKeys = new Set((palettesData.kinds ?? []).map((k) => k.key));
  const palSeen = new Set();
  const hexRe = /^#[0-9a-fA-F]{6}$/;

  (palettesData.palettes ?? []).forEach((p, i) => {
    const where = `palettes[${i}] ${p.id ?? '(缺 id)'}`;
    if (!p.id) err(`${where}: 缺少 id`);
    else if (palSeen.has(p.id)) err(`${where}: id 重复`);
    else palSeen.add(p.id);

    if (!p.title) err(`${where}: 缺少 title`);
    if (!p.summary) warn(`${where}: 建议补 summary（列表页一句话）`);
    if (!kindKeys.has(p.kind)) err(`${where}: kind "${p.kind}" 不在 kinds 中`);
    if (!p.rule) err(`${where}: 缺少 rule（这组配色为什么成立）`);

    const sw = p.swatches ?? [];
    if (!Array.isArray(sw) || sw.length < 3) err(`${where}: swatches 至少 3 个色块`);
    else if (sw.length > 5) warn(`${where}: swatches 超过 5 个，手机上一屏放不下`);
    sw.forEach((s, k) => {
      hexRe.test(s.hex ?? '') || err(`${where}: swatches[${k}] 色值格式错误 "${s.hex}"`);
      if (!s.role) err(`${where}: swatches[${k}] 缺少 role（上装/下装/鞋…）`);
      if (!s.name) warn(`${where}: swatches[${k}] 建议补 name（颜色中文名）`);
    });

    (p.scenes ?? []).forEach((s) => taxonomy?.scenes.some((x) => x.key === s) || err(`${where}: 未知场景 "${s}"`));
    (p.seasons ?? []).forEach((s) => taxonomy?.seasons.some((x) => x.key === s) || err(`${where}: 未知季节 "${s}"`));
    if (!['published', 'draft'].includes(p.status)) err(`${where}: status 只能是 published / draft`);
  });
}

warns.forEach((w) => console.log(`  ⚠ ${w}`));
if (errors.length) {
  console.error('\n✗ 校验未通过：');
  errors.forEach((e) => console.error(`  · ${e}`));
  process.exit(1);
}
console.log('\n✓ 内容校验通过\n');
