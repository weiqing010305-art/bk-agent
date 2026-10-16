import { existsSync, copyFileSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const python = resolve(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const logs = resolve(root, '.local');
const built = process.argv.includes('--built');
process.chdir(root);
if (!existsSync(python)) throw new Error('请先按 backend/README.md 创建 .venv 并安装后端依赖。');
if (!existsSync('.env')) copyFileSync('.env.example', '.env');
process.loadEnvFile('.env');
mkdirSync(logs, { recursive: true });

function run(args) {
  const result = spawnSync(python, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('后端准备失败，请检查上方输出。');
}
async function available(url) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok; }
  catch { return false; }
}
async function start(name, executable, args, url) {
  if (await available(url)) { console.log(`${name} 已在运行，复用现有服务。`); return; }
  const out = openSync(resolve(logs, `${name}-out.log`), 'a');
  const err = openSync(resolve(logs, `${name}-err.log`), 'a');
  const child = spawn(executable, args, { cwd: root, detached: true,
    windowsHide: true, stdio: ['ignore', out, err] });
  let launchError;
  child.on('error', error => { launchError = error; });
  child.unref(); closeSync(out); closeSync(err);
  for (let attempt = 0; attempt < 12; attempt++) {
    if (launchError) throw launchError;
    if (await available(url)) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`${name} 未能就绪，请查看 .local/${name}-err.log。`);
}

run(['-m', 'backend.start_local_db']);
run(['-m', 'alembic', 'upgrade', 'head']);
if (built) {
  const port = Number(process.env.QINGHE_PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('QINGHE_PORT 必须是 1–65535 的整数。');
  const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
    cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, VITE_API_MODE: 'backend' },
  });
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error('前端构建失败，未启动合并应用。');
  const origins = new Set((process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173').split(','));
  origins.add(`http://127.0.0.1:${port}`); origins.add(`http://localhost:${port}`);
  console.log(`合并应用：http://127.0.0.1:${port}/（Ctrl+C 停止应用，保留数据库）`);
  const server = spawn(python, ['-m', 'uvicorn', 'backend.app:create_app', '--factory', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, ALLOWED_ORIGINS: [...origins].join(',') },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.kill(signal));
  server.once('error', error => { console.error(error.message); process.exitCode = 1; });
  server.once('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 0 : 1); });
} else {
await start('backend', python, ['-m', 'uvicorn', 'backend.app:create_app', '--factory',
  '--host', '127.0.0.1', '--port', '8000'], 'http://127.0.0.1:8000/api/health');
await start('frontend', process.execPath, ['node_modules/vite/bin/vite.js', '--host',
  '127.0.0.1', '--port', '5173', '--strictPort'], 'http://127.0.0.1:5173/');
console.log('前端：http://127.0.0.1:5173/');
console.log('接口文档：http://127.0.0.1:8000/docs');
console.log('项目数据库及日志：.local/（不重置现有数据）');
}
