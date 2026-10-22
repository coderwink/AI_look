/**
 * 把本机 Chrome「日常配置」的登录态复制到独立工作目录，供采集器使用（不再需要扫码）
 * 用法: node scripts/prepare-chrome-profile.cjs
 * 说明: 只复制 Local State + Default 下的 Cookie/偏好文件；不影响正在运行的 Chrome。
 */
const fs = require('fs');
const path = require('path');

const SRC = 'C:/Users/10677/AppData/Local/Google/Chrome/User Data';
const DST = 'C:/Users/10677/.workbuddy/chrome-profile';

const files = [
  ['Local State', 'Local State'],
  ['Default/Preferences', 'Default/Preferences'],
  ['Default/Secure Preferences', 'Default/Secure Preferences'],
  ['Default/Network/Cookies', 'Default/Network/Cookies'],
  ['Default/Network/Cookies-journal', 'Default/Network/Cookies-journal'],
  ['Default/Network/Cookies-wal', 'Default/Network/Cookies-wal'],
  ['Default/Network/Cookies-shm', 'Default/Network/Cookies-shm'],
];

let copied = 0;
for (const [rel, rel2] of files) {
  const src = path.join(SRC, rel);
  const dst = path.join(DST, rel2);
  if (!fs.existsSync(src)) { console.log(`跳过（不存在）: ${rel}`); continue; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  const kb = (fs.statSync(dst).size / 1024).toFixed(0);
  console.log(`✓ ${rel}  ${kb} KB`);
  copied++;
}
console.log(`\n完成：${copied} 个文件 → ${DST}`);
console.log('Cookie 使用系统 DPAPI 加密，必须用同一台机器、同一个 chrome.exe 启动才能解密。');
