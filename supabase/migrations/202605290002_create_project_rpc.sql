-- 通过 security definer 函数绕过 RLS 创建项目
-- 客户端调用 rpc('create_project_for_owner') 避免 42501 错误
-- 原因：PostgREST 的 auth.uid() 可能因 JWT 解码差异返回 NULL，
--       但 plpgsql 函数内部直接读取 request.jwt.claims 不受影响。

create or replace function public.create_project_for_owner(_title text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _owner_id uuid;
  _project_id uuid;
begin
  _owner_id := auth.uid();
  if _owner_id is null then
    raise exception '未登录或会话已过期';
  end if;

  -- 防御：确保 profiles 中存在该用户（否则 projects 外键会失败）
  if not exists (select 1 from public.profiles where id = _owner_id) then
    raise exception '用户资料未同步 — 请重新登录以触发 profiles 创建';
  end if;

  insert into public.projects (owner_id, title)
  values (_owner_id, coalesce(_title, '我的项目'))
  returning id into _project_id;

  return jsonb_build_object('id', _project_id, 'title', coalesce(_title, '我的项目'));
end;
$$;
