/**
 * dsh-workspace-actions（宿主侧）
 *
 * 为客户端补上 `ctx.workspaces` 服务没有的文件写操作：
 * - GET /dsh-workspace-actions/api/status        → { cwd, home }
 * - GET /dsh-workspace-actions/api/list?path=    → 列一层目录（目录在前，含 size）
 * - GET /dsh-workspace-actions/api/create-file?path=
 * - GET /dsh-workspace-actions/api/create-folder?path=
 * - GET /dsh-workspace-actions/api/delete?path=
 * - GET /dsh-workspace-actions/api/copy?src=&dst=
 * - GET /dsh-workspace-actions/api/move?src=&dst=
 * - GET /dsh-workspace-actions/api/open-explorer?path=
 *
 * 安全：仅接受自定义头 X-DSH-Workspace-Actions: 1 的请求（跨站请求无法携带
 * 自定义头且本服务不处理 CORS 预检，天然挡 CSRF）。
 */
import { mkdir, writeFile, rm, copyFile, rename, readdir, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'

export const inject = ['webServer']

const API = '/dsh-workspace-actions/api'
const HEADER = 'x-dsh-workspace-actions'

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(body)
}

function guard(req) {
  return req.headers[HEADER] === '1'
}

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

function openExplorer(target) {
  if (process.platform === 'win32') {
    spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref()
  } else if (process.platform === 'darwin') {
    spawn('open', [target], { detached: true, stdio: 'ignore' }).unref()
  } else {
    spawn('xdg-open', [target], { detached: true, stdio: 'ignore' }).unref()
  }
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: API,
    handler: async (req, res) => {
      if (!guard(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' })
      let url
      try { url = new URL(req.url, 'http://127.0.0.1') } catch (e) { return sendJson(res, 400, { ok: false, error: 'bad url' }) }
      const path = url.pathname
      const q = (k) => String(url.searchParams.get(k) || '').trim()
      try {
        if (path === API + '/status') {
          return sendJson(res, 200, { ok: true, cwd: process.cwd(), home: dshHome() })
        }
        if (path === API + '/list') {
          const dir = q('path') || process.cwd()
          const entries = await readdir(dir, { withFileTypes: true })
          const out = []
          for (const e of entries) {
            const full = join(dir, e.name)
            let isDir = e.isDirectory()
            let size = null
            try { const s = await stat(full); isDir = s.isDirectory(); size = s.size } catch (err) {}
            out.push({ name: e.name, path: full, dir: isDir, size })
          }
          out.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
          return sendJson(res, 200, { ok: true, dir, entries: out })
        }
        if (path === API + '/create-file') {
          const fp = q('path')
          if (!fp) return sendJson(res, 400, { ok: false, error: '缺少 path' })
          await writeFile(fp, '', { flag: 'wx' })
          return sendJson(res, 200, { ok: true, path: fp })
        }
        if (path === API + '/create-folder') {
          const fp = q('path')
          if (!fp) return sendJson(res, 400, { ok: false, error: '缺少 path' })
          await mkdir(fp, { recursive: true })
          return sendJson(res, 200, { ok: true, path: fp })
        }
        if (path === API + '/delete') {
          const fp = q('path')
          if (!fp) return sendJson(res, 400, { ok: false, error: '缺少 path' })
          await rm(fp, { recursive: true, force: true })
          return sendJson(res, 200, { ok: true })
        }
        if (path === API + '/copy') {
          const src = q('src')
          const dst = q('dst')
          if (!src || !dst) return sendJson(res, 400, { ok: false, error: '缺少 src/dst' })
          await copyFile(src, dst)
          return sendJson(res, 200, { ok: true, path: dst })
        }
        if (path === API + '/move') {
          const src = q('src')
          const dst = q('dst')
          if (!src || !dst) return sendJson(res, 400, { ok: false, error: '缺少 src/dst' })
          await rename(src, dst)
          return sendJson(res, 200, { ok: true, path: dst })
        }
        if (path === API + '/open-explorer') {
          const fp = q('path') || process.cwd()
          openExplorer(fp)
          return sendJson(res, 200, { ok: true })
        }
        return sendJson(res, 404, { ok: false, error: '未知接口' })
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: String((e && e.message) || e) })
      }
    },
  }))
}
