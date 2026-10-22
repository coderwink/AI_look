/**
 * 同步日常 Chrome 的登录态到采集用配置目录（避免扫码）
 * 用法:
 *   node scripts/sync-chrome-login.cjs            # 等待 Chrome 关闭后复制（最多等 5 分钟）
 *   node scripts/sync-chrome-login.cjs --relaunch # 复制完成后自动重开 Chrome
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SRC = 'C:/Users/10677/AppData/Local/Google/Chrome/User Data';
const DST = 'C:/Users/10677/.workbuddy/chrome-profile';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const files = [
  ['Local State', 'Local State'],
  ['Default/Preferences', 'Default/Preferences'],
  ['Default/Network/Cookies', 'Default/Network/Cookies'],
  ['Default/Network/Cookies-journal', 'Default/Network/Cookies-journal'],
  ['Default/Network/Cookies-wal', 'Default/Network/Cookies-wal'],
  ['Default/Network/Cookies-shm', 'Default/Network/Cookies-shm'],
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function tryCopy() {
  const done = [];
  for (const [rel, rel2] of files) {
    const src = path.join(SRC, rel);
    const dst = path.join(DST, rel2);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    done.push(rel);
  }
  return done;
}

(async () => {
  console.log('正在复制日常 Chrome 登录态（需要 Chrome 处于关闭状态）…');
  let ok = false;
  for (let i = 0; i < 100; i++) {
    try {
      const done = tryCopy();
      console.log(`✓ 已复制 ${done.length} 个文件 → ${DST}`);
      fs.writeFileSync(path.join(DST, '.synced-at'), new Date().toISOString());
      ok = true;
      break;
    } catch (e) {
      if (e.code === 'EBUSY') {
        if (i === 0) console.log('⏳ Chrome 正在运行，等你关闭它（本轮最多等 5 分钟，每 3 秒重试）…');
        await sleep(3000);
      } else {
        throw e;
      }
    }
  }
  if (!ok) {
    console.error('✗ 超时：Chrome 一直未关闭，未复制成功');
    process.exit(1);
  }
  if (process.argv.includes('--relaunch')) {
    spawn(CHROME, [], { detached: true, stdio: 'ignore' }).unref();
    console.log('已重新打开 Chrome');
  }
})();
