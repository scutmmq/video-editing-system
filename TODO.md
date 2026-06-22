# 任务清单（贡献者看板）

本文件汇总项目当前的待办任务，供协作者 fork 后按需认领。任务来源：一次完整的代码与产品评估（见末尾参考文档）。

## 如何使用

1. Fork 本仓库并在本地运行（见下方「上手」）。
2. 从「待办任务」中挑选一项，难度标注 S（1 天内）/ M（2–5 天）/ L（1 周以上），「新手友好」列标 ✓ 的适合首次贡献。
3. 认领方式见末尾「协作约定」。
4. 注意各任务的「前置」依赖，标注了前置的任务需等前置完成或一并完成。

## 上手

```bash
npm install
npm start      # http://localhost:3000
npm test       # 运行单元测试
```

- 纯浏览器端处理（FFmpeg.wasm），无构建步骤，模块以 `<script>` 顺序加载。
- 后端为 Supabase（Auth / Storage / Postgres），迁移在 `supabase/migrations/`。
- Android 打包见 `doc/Android-APK-Build-Plan.md`。

## 已完成（请勿重复）

- 安全：处理历史渲染的存储型 XSS 转义
- 稳定性：处理临时文件清理移入 finally；处理可取消；大文件（>300MB）拦截；超时参数
- 历史：查询上限、上传失败重试、并发复用项目、下载逻辑统一
- 体验：拖拽裁剪（裁剪 + GIF）、暗色模式、游客模式、链式处理、移动端 Web Share 下载
- 工程：移除版本库内 agent 配置、清理失实文档

---

## 待办任务

### A. 工程重构（详见 `doc/Tech-Debt.md`）

| 编号 | 任务 | 难度 | 新手友好 | 前置 | 入口 / 说明 |
|---|---|---|---|---|---|
| TD-1 | 引入构建 / 模块体系（打包器或原生 ESM），替代顺序 `<script>` | L | | — | `src/index.html` 脚本列表、各模块全局命名空间；是多数大型功能的前置 |
| TD-2 | 关键链路测试覆盖（history 编排、ffmpeg 封装） | M–L | | — | 复用 `tests/fakeSupabase.js`、mock FFmpeg；覆盖 `history._persistResult`、`ffmpeg.process/cancel` |

### B. 编辑能力（详见 `doc/Feature-Proposals.md`）

| 编号 | 任务 | 难度 | 新手友好 | 前置 | 入口 / 说明 |
|---|---|---|---|---|---|
| B5 | 图片水印 / Logo | S | ✓ | — | 扩展 `src/modules/watermark.js`，FFmpeg overlay |
| B3 | 处理预设（一键模板，如竖屏短视频） | M | | — | 新模块 + 组合现有处理参数 |
| B2 | 多段裁剪与拼接 | M | | — | FFmpeg concat；可复用拖拽时间轴 |
| B4 | 字幕烧录（srt/vtt） | M | | — | FFmpeg subtitles 滤镜；需打包字体 |
| B6 | 音频替换 / 混音 / 背景音乐 | M | | — | FFmpeg amix/amerge |
| B1 | 批量处理队列 | L | | TD-1 | 任务队列 + 串行调度，逐个释放 wasm 内存 |
| B7 | 撤销 / 重做与处理链可视化 | M | | A1 | 状态栈 |

### C. 工作流与效率

| 编号 | 任务 | 难度 | 新手友好 | 前置 | 入口 / 说明 |
|---|---|---|---|---|---|
| C3 | 处理前后对比（原视频 vs 结果并排） | S | ✓ | — | `app.js` showResult、结果区 DOM |
| C4 | 键盘快捷键（空格播放、`[` `]` 标记起止） | S | ✓ | — | `src/modules/preview.js` |
| C5 | 高分辨率 / 长时长上传预警 | S | ✓ | — | 读取 video 元数据，`upload.js` / `preview.js` |
| C1 | 失败任务一键重试 | S | ✓ | — | `history.js` 复用原参数重跑 |
| C2 | 素材库（复用已上传 / 已处理文件） | M | | A1 | 依赖 Storage 与项目 |

### D. 账户与协作（后端已就绪，详见提案）

> 数据库已实现 projects / project_members / 角色 / 邀请 / 审计（`supabase/migrations/202605260002_rls_policies.sql`），前端尚未使用。

| 编号 | 任务 | 难度 | 新手友好 | 前置 | 入口 / 说明 |
|---|---|---|---|---|---|
| A1 | 项目管理（新建 / 切换 / 重命名 / 删除） | M | | — | `services/projectService.js` + 新 UI + `app.js` |
| A3 | 账户管理（改密码 / 注销 / 资料） | M | | — | Supabase Auth API；注销需级联清理 Storage |
| A2 | 项目协作（邀请 / 角色） | L | | A1、需方向决策 | invitations 表已就绪 |
| A4 | 操作审计展示 | M | | A1 | audit_events 表已建，需补写入 |

### E. 工程化与移动端

| 编号 | 任务 | 难度 | 新手友好 | 前置 | 入口 / 说明 |
|---|---|---|---|---|---|
| E1 | APK 原生保存到相册 / 系统分享 | M | | — | `@capacitor/filesystem`+`share`；`app.js` download |
| D2 | PWA 离线（Service Worker 缓存壳 + wasm） | M | | — | manifest 已具备 |
| D3 | 错误上报 / 可观测性 | M | | — | 引入上报服务或自建 |
| D4 | 国际化（i18n） | M | | — | 文案当前硬编码中文 |
| D5 | 无障碍（ARIA / 焦点 / 对比度） | M | | — | 全量审查 |
| E2 | 原生 FFmpeg 提速 | L | | 需方向决策 | ffmpeg-kit 已停更，需评估替代 |
| E3 | Release 签名与上架准备 | M | | 需方向决策 | keystore / 隐私政策 / App Bundle |

---

## 待决策事项（影响多项任务的取舍）

1. **产品定位**：个人工具，还是面向团队 / 教学的协作平台？决定 D 组（A2 / A4）是否投入。
2. **是否引入构建体系（TD-1）**：影响 B1、A2 等大型功能的实现方式。
3. **APK 是否正式分发**：决定 E2 / E3 的必要性。

认领 A2 / A4 / E2 / E3 前请先与维护者确认上述方向。

## 协作约定

- 认领：在仓库新建 Issue，标题含任务编号（如 `[B5] 图片水印`），或在团队渠道声明，避免重复。
- 分支：从 `main` 切出 `feat/<编号>-简述` 或 `refactor/<编号>-简述`。
- 提交前：`npm test` 通过；UI 改动在浏览器自测；涉及处理的改动用真实视频验证。
- PR：说明对应任务编号、改动点、验证方式。

## 参考文档

- [doc/Feature-Proposals.md](doc/Feature-Proposals.md) — 功能提案详细评估
- [doc/Tech-Debt.md](doc/Tech-Debt.md) — 工程重构立项详情
- [doc/Android-APK-Build-Plan.md](doc/Android-APK-Build-Plan.md) — Android 打包
- [CLAUDE.md](CLAUDE.md) — 架构与开发约定

---

文档版本：v1　基于版本 v1.4.3 的评估。
