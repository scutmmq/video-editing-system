# 待办清单

本文件维护项目的待办任务，供团队成员查阅与认领。「状态」列：⬜ 待办 / ✅ 已完成。认领前请阅读对应任务的「前置」依赖。

## 上手

```bash
npm install
npm start      # http://localhost:3000
npm test       # 运行单元测试
```

- 浏览器端处理（FFmpeg.wasm），无构建步骤，模块以 `<script>` 顺序加载。
- 后端为 Supabase（Auth / Storage / Postgres），迁移位于 `supabase/migrations/`。
- Android 打包见 `doc/Android-APK-Build-Plan.md`。

## 已完成

- 安全：处理历史渲染的存储型 XSS 转义。
- 稳定性：处理临时文件清理移入 finally；处理可取消；大文件（> 300MB）拦截；处理超时参数。
- 历史：查询结果上限、上传失败重试、并发复用项目、下载逻辑统一。
- 体验：拖拽裁剪（裁剪与 GIF）、暗色模式、游客模式、链式处理、移动端系统分享下载。
- 工程：移除版本库内本地工具配置、清理失实文档。

---

## 待办任务

### A. 工程重构（详见 `doc/Tech-Debt.md`）

| 编号 | 任务 | 状态 | 前置 | 入口 / 说明 |
|---|---|---|---|---|
| TD-1 | 引入构建 / 模块体系（打包器或原生 ESM），替代顺序 `<script>` 加载 | ⬜ | — | `src/index.html` 脚本列表、模块全局命名空间；多数大型功能的前置 |
| TD-2 | 关键链路测试覆盖（history 编排、ffmpeg 封装） | ⬜ | — | 复用 `tests/fakeSupabase.js`、mock FFmpeg；覆盖 `history._persistResult`、`ffmpeg.process/cancel` |

### B. 编辑能力（详见 `doc/Feature-Proposals.md`）

| 编号 | 任务 | 状态 | 前置 | 入口 / 说明 |
|---|---|---|---|---|
| B5 | 图片水印 / Logo | ⬜ | — | 扩展 `src/modules/watermark.js`，FFmpeg overlay |
| B3 | 处理预设（一键模板，如竖屏短视频） | ⬜ | — | 新模块 + 组合现有处理参数 |
| B2 | 多段裁剪与拼接 | ⬜ | — | FFmpeg concat；可复用拖拽时间轴 |
| B4 | 字幕烧录（srt / vtt） | ⬜ | — | FFmpeg subtitles 滤镜；需打包字体 |
| B6 | 音频替换 / 混音 / 背景音乐 | ⬜ | — | FFmpeg amix / amerge |
| B1 | 批量处理队列 | ⬜ | TD-1 | 任务队列 + 串行调度，逐个释放 wasm 内存 |
| B7 | 撤销 / 重做与处理链可视化 | ⬜ | A1 | 状态栈 |

### C. 工作流与效率

| 编号 | 任务 | 状态 | 前置 | 入口 / 说明 |
|---|---|---|---|---|
| C3 | 处理前后对比（原视频与结果并排） | ⬜ | — | `src/modules/app.js` showResult、结果区 DOM |
| C4 | 键盘快捷键（空格播放、`[` `]` 标记起止） | ⬜ | — | `src/modules/preview.js` |
| C5 | 高分辨率 / 长时长上传预警 | ⬜ | — | 读取视频元数据，`upload.js` / `preview.js` |
| C1 | 失败任务一键重试 | ⬜ | — | `src/modules/history.js`，复用原参数重跑 |
| C2 | 素材库（复用已上传 / 已处理文件） | ⬜ | A1 | 依赖 Storage 与项目 |

### D. 账户与协作

> 数据库已实现 projects / project_members / 角色 / 邀请 / 审计（`supabase/migrations/202605260002_rls_policies.sql`），前端尚未使用。

| 编号 | 任务 | 状态 | 前置 | 入口 / 说明 |
|---|---|---|---|---|
| A1 | 项目管理（新建 / 切换 / 重命名 / 删除） | ⬜ | — | `src/services/projectService.js` + 项目选择 UI + `app.js` |
| A3 | 账户管理（修改密码 / 注销 / 个人资料） | ⬜ | — | Supabase Auth API；注销需级联清理 Storage |
| A2 | 项目协作（成员邀请 / 角色分配） | ⬜ | A1、待决策 1 | invitations 表已就绪 |
| A4 | 操作审计展示 | ⬜ | A1 | audit_events 表已建，需补充写入 |

### E. 工程化与移动端

| 编号 | 任务 | 状态 | 前置 | 入口 / 说明 |
|---|---|---|---|---|
| E1 | APK 原生保存到相册 / 系统分享 | ⬜ | — | `@capacitor/filesystem`、`@capacitor/share`；`app.js` download |
| D2 | PWA 离线（Service Worker 缓存应用与 wasm） | ⬜ | — | manifest 已具备 |
| D3 | 错误上报 / 可观测性 | ⬜ | — | 引入上报服务或自建 |
| D4 | 国际化（i18n） | ⬜ | — | 文案当前为硬编码中文 |
| D5 | 无障碍（ARIA / 焦点管理 / 对比度） | ⬜ | — | 全量审查 |
| E2 | 原生 FFmpeg 提速 | ⬜ | 待决策 3 | ffmpeg-kit 已停止维护，需评估替代方案 |
| E3 | Release 签名与上架准备 | ⬜ | 待决策 3 | keystore / 隐私政策 / App Bundle |

---

## 待决策事项

以下问题影响多项任务的取舍，需在排期前确认。认领标注「待决策」的任务前请先确认对应事项。

1. 产品定位：个人工具，或面向团队 / 教学的协作平台。决定 A2、A4 是否投入。
2. 是否引入构建体系（TD-1）。影响 B1、A2 等大型功能的实现方式。
3. APK 是否用于正式分发。决定 E2、E3 的必要性。

## 协作约定

- 认领：新建 Issue，标题含任务编号（如 `[B5] 图片水印`），避免重复认领；开始后将对应「状态」改为进行中或在 Issue 中标注。
- 分支：从 `main` 切出 `feat/<编号>-简述` 或 `refactor/<编号>-简述`。
- 提交前：`npm test` 通过；界面改动在浏览器自测；涉及处理的改动用真实视频验证。
- 完成后：将「状态」列改为 ✅，并在 PR 注明对应任务编号、改动点与验证方式。

## 参考文档

- `doc/Feature-Proposals.md` — 功能提案详细评估
- `doc/Tech-Debt.md` — 工程重构立项详情
- `doc/Android-APK-Build-Plan.md` — Android 打包
- `CLAUDE.md` — 架构与开发约定
