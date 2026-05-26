# 数据库技术栈架构设计：Postgres + Supabase

## 1. 背景

当前项目是一个浏览器端视频剪辑与多媒体处理系统，主要由 `index.html`、`css/`、`js/` 和本地静态服务 `server.js` 组成。视频处理依赖 FFmpeg.wasm 在浏览器中完成，项目暂时没有用户系统、数据库、云端文件存储、任务记录和多人协作能力。

后续如果要支持账号、项目管理、素材管理、处理历史、云端保存和分享，需要引入持久化层。本设计选择 PostgreSQL 作为主数据库，并使用 Supabase 提供数据库托管、认证、对象存储、RLS 权限控制和边缘函数能力。

## 2. 设计目标

1. 建立可落地的数据架构，支撑后续逐步接入 Supabase。
2. 区分数据库元数据和视频二进制文件，避免把大文件直接写入 Postgres。
3. 通过 Row Level Security 保护用户数据，前端可以安全直连 Supabase。
4. 保留从当前纯前端项目平滑演进的路径，不一次性重写所有功能。
5. 为后续项目协作、素材分享和服务端处理任务预留扩展空间。

## 3. 非目标

1. 本阶段不实现完整后端业务服务。
2. 本阶段不把 FFmpeg.wasm 处理迁移到服务端。
3. 本阶段不设计复杂计费、团队组织、审计合规和实时多人编辑。
4. 本阶段不把视频文件存入数据库，只在数据库中保存文件元数据和 Storage 路径。

## 4. 推荐技术栈

| 层级 | 技术 | 用途 |
| --- | --- | --- |
| 主数据库 | Supabase Postgres | 用户资料、项目、素材、处理任务、导出记录等结构化数据 |
| 认证 | Supabase Auth | 注册、登录、会话、用户身份 |
| 权限 | PostgreSQL RLS + Supabase policies | 控制用户只能访问自己的项目和素材 |
| 文件存储 | Supabase Storage | 保存原始视频、导出视频、GIF、音频、封面图 |
| 前端 SDK | `@supabase/supabase-js` | 浏览器访问 Auth、Database、Storage |
| 特权逻辑 | Supabase Edge Functions | 邀请、批处理、清理文件、未来服务端任务调度 |
| 迁移工具 | Supabase CLI | 管理 schema migration、seed、类型生成 |

## 5. 架构方案选择

### 方案 A：前端直连 Supabase

前端通过 `@supabase/supabase-js` 直接访问 Auth、Database 和 Storage。所有数据安全依赖 RLS。

优点：
- 实施最快。
- 不需要维护独立后端。
- 适合当前项目从纯前端过渡。

缺点：
- 所有复杂权限都必须写成清晰的 RLS policy。
- 不能在浏览器中使用 `service_role` 密钥。
- 复杂服务端任务不适合放在前端。

### 方案 B：自建 Node.js API + Supabase

前端只访问自己的 Node.js API，由后端使用 Supabase service role 访问数据库和存储。

优点：
- 权限逻辑集中在后端，更容易实现复杂业务。
- 适合后续服务端视频处理、队列和计费。

缺点：
- 当前项目需要较大改造。
- 运维成本更高。
- 对当前阶段来说过重。

### 方案 C：混合架构（推荐）

普通用户操作由前端直连 Supabase，并依赖 RLS 保护数据；需要特权或跨用户的操作通过 Supabase Edge Functions 处理。

推荐理由：
- 符合当前项目体量。
- 能快速接入账号、项目、素材和历史记录。
- 不把 `service_role` 暴露到浏览器。
- 后续可以逐步把重任务迁移到 Edge Functions 或独立后端。

## 6. 目标架构

```mermaid
flowchart TB
    Browser[Browser App<br/>HTML/CSS/JS + FFmpeg.wasm]
    SupabaseJS[@supabase/supabase-js]
    Auth[Supabase Auth]
    DB[(Supabase Postgres)]
    Storage[Supabase Storage]
    Edge[Supabase Edge Functions]

    Browser --> SupabaseJS
    SupabaseJS --> Auth
    SupabaseJS --> DB
    SupabaseJS --> Storage
    Browser --> Edge
    Edge --> DB
    Edge --> Storage
```

核心原则：
- 浏览器只使用 Supabase anon key。
- 所有面向用户的数据表开启 RLS。
- 大媒体文件进入 Storage，数据库只保存路径、类型、大小、所有者和状态。
- Edge Functions 只处理需要服务端权限的操作，例如邀请协作者、批量删除、生成签名链接、未来任务派发。

## 7. 核心数据模型

### 7.1 `profiles`

保存 Supabase Auth 用户的业务资料。`id` 与 `auth.users.id` 一致。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` | 主键，关联 `auth.users.id` |
| `display_name` | `text` | 显示名称 |
| `avatar_url` | `text` | 头像 Storage URL 或路径 |
| `created_at` | `timestamptz` | 创建时间 |
| `updated_at` | `timestamptz` | 更新时间 |

### 7.2 `projects`

用户的视频编辑项目。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` | 主键 |
| `owner_id` | `uuid` | 项目拥有者，关联 `profiles.id` |
| `title` | `text` | 项目名称 |
| `description` | `text` | 项目说明 |
| `status` | `text` | `draft`、`active`、`archived` |
| `created_at` | `timestamptz` | 创建时间 |
| `updated_at` | `timestamptz` | 更新时间 |

### 7.3 `project_members`

为后续应用内协作预留。注意这和 GitHub 仓库协作者不是同一件事。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` | 主键 |
| `project_id` | `uuid` | 关联 `projects.id` |
| `user_id` | `uuid` | 关联 `profiles.id` |
| `role` | `text` | `owner`、`editor`、`viewer` |
| `created_at` | `timestamptz` | 加入时间 |

唯一约束：
- `unique(project_id, user_id)`

### 7.4 `media_assets`

保存用户上传和生成的媒体文件元数据。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` | 主键 |
| `project_id` | `uuid` | 所属项目 |
| `owner_id` | `uuid` | 上传或生成者 |
| `kind` | `text` | `source_video`、`trimmed_video`、`gif`、`audio`、`cover_image`、`watermarked_video`、`filtered_video` |
| `bucket` | `text` | Supabase Storage bucket |
| `storage_path` | `text` | Storage 对象路径 |
| `original_filename` | `text` | 原始文件名 |
| `mime_type` | `text` | MIME 类型 |
| `size_bytes` | `bigint` | 文件大小 |
| `duration_seconds` | `numeric` | 媒体时长，可为空 |
| `width` | `integer` | 视频或图片宽度，可为空 |
| `height` | `integer` | 视频或图片高度，可为空 |
| `created_at` | `timestamptz` | 创建时间 |

索引建议：
- `media_assets(project_id)`
- `media_assets(owner_id)`
- `media_assets(kind)`

### 7.5 `processing_jobs`

记录一次处理动作，不论处理发生在浏览器端还是未来服务端。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` | 主键 |
| `project_id` | `uuid` | 所属项目 |
| `source_asset_id` | `uuid` | 输入素材 |
| `result_asset_id` | `uuid` | 输出素材，可为空 |
| `operation` | `text` | `trim`、`gif`、`extract_audio`、`watermark`、`filter`、`capture_cover` |
| `params` | `jsonb` | 处理参数 |
| `status` | `text` | `queued`、`processing`、`succeeded`、`failed`、`cancelled` |
| `error_message` | `text` | 失败原因 |
| `started_at` | `timestamptz` | 开始时间 |
| `finished_at` | `timestamptz` | 结束时间 |
| `created_by` | `uuid` | 操作者 |
| `created_at` | `timestamptz` | 创建时间 |

索引建议：
- `processing_jobs(project_id)`
- `processing_jobs(status)`
- `processing_jobs(created_by, created_at desc)`

### 7.6 `project_invitations`

应用内项目邀请。后续如果要做“邀请用户加入某个视频项目”，使用这张表，不复用 GitHub 仓库邀请。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` | 主键 |
| `project_id` | `uuid` | 被邀请加入的项目 |
| `email` | `citext` | 被邀请邮箱 |
| `role` | `text` | `editor` 或 `viewer` |
| `token_hash` | `text` | 邀请 token 的哈希值 |
| `status` | `text` | `pending`、`accepted`、`revoked`、`expired` |
| `invited_by` | `uuid` | 邀请人 |
| `expires_at` | `timestamptz` | 过期时间 |
| `created_at` | `timestamptz` | 创建时间 |

### 7.7 `audit_events`

记录重要操作，便于排错和后续管理。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` | 主键 |
| `actor_id` | `uuid` | 操作者 |
| `project_id` | `uuid` | 相关项目，可为空 |
| `event_type` | `text` | 事件类型 |
| `metadata` | `jsonb` | 事件详情 |
| `created_at` | `timestamptz` | 创建时间 |

## 8. Storage 设计

### 8.1 Bucket 划分

| Bucket | 访问级别 | 用途 |
| --- | --- | --- |
| `media-originals` | private | 用户上传的原始视频 |
| `media-results` | private | 裁剪、滤镜、水印后的视频 |
| `media-derived` | private | GIF、音频、封面图等派生文件 |
| `avatars` | public 或 private | 用户头像 |

### 8.2 路径约定

```text
<user_id>/<project_id>/<asset_id>/<filename>
```

示例：

```text
4f2.../9ac.../f31.../source.mp4
4f2.../9ac.../b82.../trimmed-video.mp4
4f2.../9ac.../d77.../cover.png
```

路径中使用 `user_id` 和 `project_id`，便于写 Storage policy、清理项目文件和定位问题。

### 8.3 文件策略

1. 文件上传到 Storage。
2. 上传成功后写入 `media_assets` 元数据。
3. 删除项目时先删除 Storage 对象，再删除数据库记录。
4. 下载和预览优先使用短期 signed URL。
5. 数据库不保存永久公开文件 URL，避免权限变更后旧 URL 泄漏。

## 9. 权限模型与 RLS

### 9.1 角色

| 角色 | 权限 |
| --- | --- |
| `anonymous` | 未登录，只能访问公开页面，不可读写业务表 |
| `authenticated` | 登录用户，可管理自己的项目和素材 |
| `project owner` | 项目拥有者，可管理成员、邀请、素材和处理记录 |
| `project editor` | 可上传素材、创建处理任务、生成结果 |
| `project viewer` | 只读项目和素材 |
| `service_role` | 仅服务端使用，浏览器禁止使用 |

### 9.2 RLS 原则

1. 所有业务表默认开启 RLS。
2. `profiles`：用户只能读写自己的资料；必要时可开放只读显示字段。
3. `projects`：拥有者和项目成员可读；只有拥有者可删除。
4. `project_members`：项目拥有者可管理；成员可读取自己的成员关系。
5. `media_assets`：项目成员可读；拥有者或 editor 可创建；删除权限限制给 owner 或素材创建者。
6. `processing_jobs`：项目成员可读；owner/editor 可创建；只有创建者或 owner 可取消。
7. `project_invitations`：只有项目 owner 和 Edge Function 可创建或变更。
8. Storage policy 必须和数据库项目成员权限保持一致。

## 10. 前端接入方式

新增配置文件时只暴露以下变量：

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

浏览器端禁止出现：

```text
SUPABASE_SERVICE_ROLE_KEY
```

推荐前端模块边界：

| 模块 | 职责 |
| --- | --- |
| `supabaseClient` | 创建 Supabase client |
| `authService` | 登录、注册、退出、当前用户 |
| `projectService` | 项目 CRUD |
| `assetService` | 上传文件、写入素材元数据、获取 signed URL |
| `jobService` | 创建处理记录、更新处理状态、查询历史 |
| `storageService` | 封装 bucket/path/signed URL 细节 |

## 11. 主要数据流

### 11.1 用户注册

1. 用户通过 Supabase Auth 注册。
2. Auth 创建 `auth.users` 记录。
3. 数据库 trigger 或 Edge Function 创建 `profiles` 记录。
4. 前端进入项目列表页。

### 11.2 上传原始视频

1. 用户选择本地视频。
2. 前端创建或选择 `projects`。
3. 前端生成 `asset_id` 和 Storage path。
4. 前端上传文件到 `media-originals`。
5. 上传成功后写入 `media_assets`，`kind = source_video`。
6. 页面加载预览并显示文件元数据。

### 11.3 浏览器端视频处理

1. 用户选择处理动作和参数。
2. 前端写入 `processing_jobs`，状态为 `processing`。
3. FFmpeg.wasm 在浏览器中处理视频。
4. 处理成功后上传结果到 `media-results` 或 `media-derived`。
5. 前端写入结果 `media_assets`。
6. 前端更新 `processing_jobs.status = succeeded`，关联 `result_asset_id`。
7. 处理失败时写入 `failed` 和 `error_message`。

### 11.4 项目分享邀请

1. owner 输入被邀请邮箱和角色。
2. 前端调用 Edge Function。
3. Edge Function 校验调用者是否为项目 owner。
4. Edge Function 写入 `project_invitations` 并发送邀请邮件。
5. 用户接受邀请后写入 `project_members`。

## 12. 迁移与目录规划

建议后续新增 Supabase 目录：

```text
supabase/
├── config.toml
├── migrations/
│   ├── 202605260001_initial_schema.sql
│   ├── 202605260002_rls_policies.sql
│   └── 202605260003_storage_policies.sql
├── seed.sql
└── functions/
    └── invite-project-member/
```

迁移要求：
- 所有 schema 变更必须进入 `supabase/migrations/`。
- 不手工在生产库改表后忘记补 migration。
- RLS policy 和 Storage policy 作为 migration 管理。
- 使用 seed 准备本地开发数据。
- 类型可以通过 Supabase CLI 生成到前端，例如 `js/types/database.types.ts`，如果项目继续保持纯 JS，则先只生成文档或 JSDoc 类型。

## 13. 初始 Schema 草案

后续实施时可拆成多份 migration。以下只作为结构草案：

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique(project_id, user_id)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  bucket text not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  duration_seconds numeric,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  unique(bucket, storage_path)
);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_asset_id uuid references public.media_assets(id) on delete set null,
  result_asset_id uuid references public.media_assets(id) on delete set null,
  operation text not null,
  params jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
```

实施时应补充 check 约束或 enum 类型，限制 `status`、`role`、`kind` 和 `operation` 的合法值。

## 14. 安全要求

1. 浏览器只能使用 anon key。
2. `service_role` 只能出现在 Edge Functions、CI 或受控后端环境中。
3. 所有业务表必须开启 RLS 后再允许前端访问。
4. 上传文件大小、类型和路径必须校验。
5. 删除数据库记录时同步清理 Storage 对象，避免孤儿文件。
6. 处理参数 `params` 使用 JSONB，但关键字段仍需要前端和服务端双重校验。
7. 邀请 token 只保存哈希值，不保存明文 token。

## 15. 分阶段实施计划

### 阶段 1：Supabase 基础接入

- 创建 Supabase 项目。
- 初始化 `supabase/` 目录。
- 创建 `profiles`、`projects`、`media_assets`、`processing_jobs`。
- 配置 RLS 和基础 policy。
- 前端接入登录状态和项目列表。

### 阶段 2：素材与处理历史

- 原始视频上传到 Storage。
- 写入 `media_assets` 元数据。
- 每次处理写入 `processing_jobs`。
- 处理结果上传 Storage 并关联 result asset。
- 页面增加历史记录入口。

### 阶段 3：项目协作

- 增加 `project_members`。
- 增加 `project_invitations`。
- 使用 Edge Function 处理邀请。
- 实现 viewer/editor/owner 权限差异。

### 阶段 4：服务端能力扩展

- 将大文件清理、批量删除、邀请邮件等逻辑放入 Edge Functions。
- 如果浏览器端 FFmpeg 性能不足，再评估独立任务队列和服务端视频处理。
- 增加审计日志、用量统计和限额控制。

## 16. 风险与取舍

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| RLS policy 写错 | 用户可能访问越权数据 | 每张表添加权限测试，默认拒绝，再逐步放开 |
| 大文件上传失败 | 用户体验差，产生半成品记录 | 先上传 Storage，成功后写 DB；失败时清理临时对象 |
| 浏览器处理性能有限 | 大视频处理慢或失败 | 保留 `processing_jobs`，后续可迁移到服务端任务 |
| Storage 与 DB 不一致 | 产生孤儿文件或失效记录 | 删除流程走 Edge Function 或统一 service 封装 |
| JSONB 参数无约束 | 数据难以查询和校验 | 常用字段结构化，JSONB 只放操作差异参数 |

## 17. 参考资料

- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Storage: https://supabase.com/docs/guides/storage
- Supabase CLI and migrations: https://supabase.com/docs/guides/local-development
- PostgreSQL Row Security Policies: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
