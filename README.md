# dsh-workspace-actions

DeepSeek Harness（DSH）Web UI 的工作区文件操作插件：在侧栏底部加一个「🗂 工作区」按钮，点开浮层即可对工作区目录做日常文件管理。

## 功能

- 📂 **在资源管理器中打开**：当前目录或单个文件，用系统默认方式打开
- ➕ **新建文件 / 新建文件夹**：相对当前目录创建
- 🗂 **新建子工作区**：调系统目录选择器，把选中的目录注册为工作区
- 📄 **文件列表**：点文件夹进入、上一级返回，展示文件大小
- 📋 **复制路径**：把文件绝对路径写入剪贴板
- 🗑 **删除**：删除文件/文件夹（带确认框）

## 安装

```powershell
dsh plugin --profile web add <本仓库路径或 git 地址>
```

装完重启 `dsh web` 并刷新浏览器，侧栏底部出现「🗂 工作区」按钮。

## 实现

- 宿主侧（`lib/index.js`）：通过 `webServer` 注册 HTTP 路由，用 Node 内置 `fs` 完成新建/删除/复制/移动/列目录/打开资源管理器；请求需携带自定义头 `X-DSH-Workspace-Actions: 1` 作 CSRF 防护。
- 浏览器侧（`lib/client.js`）：`shell.overlay` 浮层 + `sidebar.footer.action` 按钮；目录浏览、打开资源管理器、目录选择器、注册工作区等复用 DSH 自带的 `ctx.workspaces` 服务。

## 安全提示

本插件以 DSH 进程的权限执行文件操作，能读写任意被请求的路径。安装第三方插件前请先审阅源码。

## License

MIT
