window.__ModuleLoader__.load({ id: "dsh-workspace-actions", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

/**
 * dsh-workspace-actions（浏览器侧）
 * 右键点击左侧「工作区」文件夹 → 弹出上下文菜单：
 *  - 在资源管理器中打开 / 复制路径
 *  - 新建文件 / 新建文件夹 / 新建子工作区
 *  - 删除工作区（仅移除注册，不删磁盘目录）
 */

let React = null
try { React = require('react') } catch (e) { React = null }

const API = '/dsh-workspace-actions/api'
const HEADER = { 'X-DSH-Workspace-Actions': '1' }

async function api(path) {
  try {
    const r = await window.fetch(path, { headers: HEADER })
    let data = null
    try { data = await r.json() } catch (e) { data = {} }
    return { ok: !!(r.ok && data && data.ok), data: data || {} }
  } catch (e) {
    return { ok: false, data: { error: '无法连接宿主接口' } }
  }
}

function enc(s) { return encodeURIComponent(s) }

function joinPath(base, name) {
  const sep = base.indexOf('\\') >= 0 ? '\\' : '/'
  return base.replace(/[\\/]+$/, '') + sep + name
}

function basename(p) {
  const clean = p.replace(/[\\/]+$/, '')
  const idx = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'))
  return idx < 0 ? clean : clean.slice(idx + 1)
}

function apply(ctx) {
  const slots = ctx.get('slots')
  const workspaces = ctx.get('workspaces')
  if (slots === undefined || React === null) return

  // ---- 工作区缓存（id/path/title） ----
  let wsCache = []
  async function refreshCache() {
    const r = await api(API + '/workspaces')
    if (r.ok && Array.isArray(r.data.workspaces)) wsCache = r.data.workspaces
    return wsCache
  }
  refreshCache() // 启动即预载

  function matchWorkspace(label) {
    for (const w of wsCache) if (w.title === label) return w
    for (const w of wsCache) if (basename(w.path) === label) return w
    return null
  }

  // ---- 右键菜单 store ----
  const menu = {
    open: false, x: 0, y: 0, ws: null, label: '',
    listeners: new Set(),
    show(x, y, ws, label) { menu.open = true; menu.x = x; menu.y = y; menu.ws = ws; menu.label = label; menu.notify() },
    hide() { menu.open = false; menu.notify() },
    subscribe(l) { menu.listeners.add(l); return function () { menu.listeners.delete(l) } },
    notify() { menu.listeners.forEach(function (l) { l() }) },
  }

  const ITEM = {
    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
    background: 'none', border: 'none', color: 'inherit', fontSize: '13px',
    padding: '7px 10px', borderRadius: '6px',
  }

  function ContextMenu() {
    const [s, setS] = React.useState({ open: menu.open, x: menu.x, y: menu.y, ws: menu.ws, label: menu.label })
    React.useEffect(function () {
      return menu.subscribe(function () { setS({ open: menu.open, x: menu.x, y: menu.y, ws: menu.ws, label: menu.label }) })
    }, [])

    if (!s.open || !s.ws) return null

    function close() { menu.hide() }
    function run(fn) { close(); Promise.resolve().then(fn).catch(function (e) { window.alert(String((e && e.message) || e)) }) }

    function openExplorer() { run(function () { return api(API + '/open-explorer?path=' + enc(s.ws.path)) }) }
    function copyPath() { run(function () { navigator.clipboard.writeText(s.ws.path) }) }
    function createFile() {
      const name = window.prompt('新建文件（文件名）')
      if (!name) return
      run(function () { return api(API + '/create-file?path=' + enc(joinPath(s.ws.path, name))) })
    }
    function createFolder() {
      const name = window.prompt('新建文件夹（文件夹名）')
      if (!name) return
      run(function () { return api(API + '/create-folder?path=' + enc(joinPath(s.ws.path, name))) })
    }
    function createSubWorkspace() {
      if (!workspaces) { window.alert('workspaces 服务不可用'); return }
      const name = window.prompt('新建子工作区（子文件夹名）')
      if (!name) return
      const sub = joinPath(s.ws.path, name)
      run(async function () {
        await api(API + '/create-folder?path=' + enc(sub))
        await workspaces.create({ path: sub })
      })
    }
    function deleteWorkspace() {
      if (!workspaces) { window.alert('workspaces 服务不可用'); return }
      if (!window.confirm('从工作区列表移除「' + s.label + '」？（不会删除磁盘上的目录）')) return
      run(function () { return workspaces.delete(s.ws.id) })
    }

    const menuStyle = {
      position: 'fixed', left: Math.min(s.x, window.innerWidth - 260) + 'px',
      top: Math.min(s.y, window.innerHeight - 320) + 'px',
      width: '240px', background: 'var(--surface, #1f1f1f)', color: 'var(--text, #eee)',
      border: '1px solid var(--border, #333)', borderRadius: '10px',
      boxShadow: '0 12px 40px rgba(0,0,0,.5)', padding: '6px', zIndex: 10000,
      fontFamily: 'system-ui, sans-serif',
    }
    const backdrop = { position: 'fixed', inset: '0', zIndex: 9999 }

    return React.createElement('div', { style: backdrop, onClick: close, onContextMenu: function (e) { e.preventDefault(); close() } },
      React.createElement('div', { style: menuStyle, onClick: function (e) { e.stopPropagation() } },
        React.createElement('div', {
          style: { fontWeight: 600, fontSize: '13px', padding: '6px 10px', borderBottom: '1px solid rgba(128,128,128,.2)', marginBottom: '4px', wordBreak: 'break-all' },
          title: s.ws.path,
        }, '🗂 ' + s.label),
        React.createElement('button', { style: ITEM, onClick: openExplorer }, '📂 在资源管理器中打开'),
        React.createElement('button', { style: ITEM, onClick: copyPath }, '📋 复制路径'),
        React.createElement('div', { style: { height: '1px', background: 'rgba(128,128,128,.2)', margin: '4px 0' } }),
        React.createElement('button', { style: ITEM, onClick: createFile }, '➕ 新建文件'),
        React.createElement('button', { style: ITEM, onClick: createFolder }, '➕ 新建文件夹'),
        React.createElement('button', { style: ITEM, onClick: createSubWorkspace }, '🗂 新建子工作区'),
        React.createElement('div', { style: { height: '1px', background: 'rgba(128,128,128,.2)', margin: '4px 0' } }),
        React.createElement('button', { style: Object.assign({}, ITEM, { color: '#ef5350' }), onClick: deleteWorkspace }, '🗑 删除工作区'),
      ),
    )
  }

  // ---- 全局右键监听：命中工作区行才接管 ----
  ctx.effect(function () {
    function onCtx(e) {
      const el = e.target && e.target.closest ? e.target.closest('[role="treeitem"]') : null
      if (!el) return
      const label = (el.textContent || '').trim().split('\n')[0].trim()
      if (!label) return
      const ws = matchWorkspace(label)
      if (!ws) { refreshCache(); return } // 缓存未就绪则刷新后下次再试
      e.preventDefault()
      e.stopPropagation()
      menu.show(e.clientX, e.clientY, ws, label)
    }
    document.addEventListener('contextmenu', onCtx, true)
    return function () { document.removeEventListener('contextmenu', onCtx, true) }
  })

  slots.inject('shell.overlay', function () {
    return slots.register(
      { name: 'shell.overlay', id: 'workspace-actions-menu', order: 60, label: '工作区操作' },
      function () { return React.createElement(ContextMenu, null) },
    )
  })
}

module.exports = { apply }
return module.exports
}});
