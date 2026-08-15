window.__ModuleLoader__.load({ id: "dsh-workspace-actions", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

/**
 * dsh-workspace-actions（浏览器侧）
 * 侧栏底部「🗂 工作区」按钮 → shell.overlay 浮动面板：
 *  - 显示当前目录 + 在资源管理器中打开
 *  - 新建文件 / 新建文件夹 / 新建子工作区
 *  - 文件列表：进入目录、复制路径、删除、在资源管理器中打开
 */

let React = null
try { React = require('react') } catch (e) { React = null }

const API = '/dsh-workspace-actions/api'
const HEADER = { 'X-DSH-Workspace-Actions': '1' }

// ---------------- 开关 store（按钮与浮层共用） ----------------
const store = {
  open: false,
  listeners: new Set(),
  isOpen: function () { return store.open },
  toggle: function () { store.open = !store.open; store.listeners.forEach(function (l) { l() }) },
  close: function () { store.open = false; store.listeners.forEach(function (l) { l() }) },
  subscribe: function (l) { store.listeners.add(l); return function () { store.listeners.delete(l) } },
}

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

function parentDir(p) {
  const clean = p.replace(/[\\/]+$/, '')
  const idx = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'))
  if (idx < 0) return p
  const parent = clean.slice(0, idx)
  if (/^[A-Za-z]:$/.test(parent)) return parent + '\\'
  return parent === '' ? p : parent
}

const BTN = {
  cursor: 'pointer', background: 'none', border: 'none', color: 'inherit',
  fontSize: '13px', padding: '4px 8px', borderRadius: '6px',
}

function apply(ctx) {
  const slots = ctx.get('slots')
  const workspaces = ctx.get('workspaces')
  if (slots === undefined || React === null) return

  function WorkspacePanel() {
    const [open, setOpen] = React.useState(store.isOpen())
    const [dir, setDir] = React.useState('')
    const [entries, setEntries] = React.useState([])
    const [msg, setMsg] = React.useState(null)
    const [err, setErr] = React.useState(null)
    const [busy, setBusy] = React.useState(false)

    React.useEffect(function () {
      return store.subscribe(function () { setOpen(store.isOpen()) })
    }, [])

    const refresh = React.useCallback(async function (path) {
      setMsg(null); setErr(null); setBusy(true)
      const r = await api(API + '/list?path=' + enc(path))
      setBusy(false)
      if (r.ok) { setDir(r.data.dir || path); setEntries(r.data.entries || []) }
      else setErr(r.data.error || '读取目录失败')
    }, [])

    React.useEffect(function () {
      if (!open) return
      api(API + '/status').then(function (r) {
        const c = (r.ok && r.data.cwd) ? r.data.cwd : ''
        if (c) refresh(c)
        else setErr(r.data.error || '无法获取工作区路径')
      })
    }, [open, refresh])

    async function createFile() {
      const name = window.prompt('新建文件（文件名，相对当前目录）')
      if (!name) return
      const r = await api(API + '/create-file?path=' + enc(joinPath(dir, name)))
      if (r.ok) { setMsg('已创建 ' + name); refresh(dir) }
      else setErr(r.data.error || '创建失败')
    }

    async function createFolder() {
      const name = window.prompt('新建文件夹（文件夹名，相对当前目录）')
      if (!name) return
      const r = await api(API + '/create-folder?path=' + enc(joinPath(dir, name)))
      if (r.ok) { setMsg('已创建 ' + name); refresh(dir) }
      else setErr(r.data.error || '创建失败')
    }

    async function createSubWorkspace() {
      try {
        if (!workspaces) { setErr('workspaces 服务不可用'); return }
        const picked = await workspaces.pickDirectory()
        if (!picked) return
        await workspaces.create({ path: picked })
        setMsg('已注册子工作区：' + picked)
      } catch (e) { setErr(String((e && e.message) || e)) }
    }

    function openExplorer(p) { api(API + '/open-explorer?path=' + enc(p || dir)) }

    async function del(entry) {
      if (!window.confirm('确定删除？\n' + entry.path)) return
      const r = await api(API + '/delete?path=' + enc(entry.path))
      if (r.ok) { setMsg('已删除 ' + entry.name); refresh(dir) }
      else setErr(r.data.error || '删除失败')
    }

    function copyPath(p) {
      try { navigator.clipboard.writeText(p); setMsg('已复制路径') } catch (e) { setErr('复制失败') }
    }

    function enterDir(p) { refresh(p) }

    if (!open) return null

    const card = {
      position: 'fixed', top: '64px', right: '20px', width: '400px', maxHeight: '82vh',
      overflow: 'auto', background: 'var(--surface, #1f1f1f)', color: 'var(--text, #eee)',
      border: '1px solid var(--border, #333)', borderRadius: '12px', boxShadow: '0 12px 40px rgba(0,0,0,.45)',
      padding: '12px 14px', zIndex: 9999, fontFamily: 'system-ui, sans-serif',
    }
    const row = { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', borderBottom: '1px solid rgba(128,128,128,.15)' }

    return React.createElement('div', { style: card },
      React.createElement('div', { style: { fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('span', null, '🗂 工作区操作'),
        React.createElement('button', { onClick: function () { store.close() }, style: BTN, title: '关闭' }, '✕'),
      ),
      React.createElement('div', { style: { fontSize: '12px', opacity: .7, wordBreak: 'break-all', marginBottom: '6px' } }, dir || '…'),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' } },
        React.createElement('button', { onClick: function () { openExplorer(dir) }, style: BTN }, '📂 打开资源管理器'),
        React.createElement('button', { onClick: function () { refresh(dir) }, style: BTN }, '🔄 刷新'),
        React.createElement('button', { onClick: function () { refresh(parentDir(dir)) }, style: BTN }, '⬆ 上一级'),
        React.createElement('button', { onClick: createFile, style: BTN }, '➕ 新建文件'),
        React.createElement('button', { onClick: createFolder, style: BTN }, '➕ 新建文件夹'),
        React.createElement('button', { onClick: createSubWorkspace, style: BTN }, '🗂 新建子工作区'),
      ),
      msg ? React.createElement('div', { style: { color: '#4caf50', fontSize: '12px', marginBottom: '4px' } }, msg) : null,
      err ? React.createElement('div', { style: { color: '#ef5350', fontSize: '12px', marginBottom: '4px' } }, err) : null,
      busy ? React.createElement('div', { style: { fontSize: '12px', opacity: .6 } }, '加载中…') : null,
      entries.map(function (e) {
        return React.createElement('div', { key: e.path, style: row },
          React.createElement('span', {
            onClick: function () { e.dir ? enterDir(e.path) : openExplorer(e.path) },
            style: { cursor: 'pointer', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' },
            title: e.path,
          }, (e.dir ? '📁 ' : '📄 ') + e.name + (e.dir ? '/' : (e.size != null ? '  (' + e.size + 'B)' : ''))),
          React.createElement('button', { onClick: function () { copyPath(e.path) }, style: BTN, title: '复制路径' }, '复制'),
          React.createElement('button', { onClick: function () { del(e) }, style: BTN, title: '删除' }, '删除'),
        )
      }),
    )
  }

  slots.inject('sidebar.footer.action', function () {
    return slots.register(
      { name: 'sidebar.footer.action', id: 'workspace-actions', order: 90, label: '工作区' },
      function () {
        return React.createElement('button', {
          onClick: function () { store.toggle() },
          title: '工作区操作',
          style: { cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', fontSize: '14px', padding: '4px 8px' },
        }, '🗂 工作区')
      },
    )
  })

  slots.inject('shell.overlay', function () {
    return slots.register(
      { name: 'shell.overlay', id: 'workspace-actions-panel', order: 60, label: '工作区操作' },
      function () { return React.createElement(WorkspacePanel, null) },
    )
  })
}

module.exports = { apply }
return module.exports
}});
