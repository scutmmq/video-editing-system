// 项目服务：获取或创建当前用户的默认项目、列出项目。
// createProjectService(client) 接收 Supabase client（或测试用 fake）。

(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ProjectService = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const DEFAULT_PROJECT_TITLE = '我的项目';

  function createProjectService(client) {
    if (!client || typeof client.from !== 'function') {
      throw new Error('Supabase client 不可用，无法初始化 projectService');
    }

    async function listProjects() {
      const { data, error } = await client
        .from('projects')
        .select('id,title,created_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    // 优先返回最早的项目；没有则通过 security definer RPC 创建一个默认项目。
    // 使用 RPC 而非直接 INSERT 的原因是：PostgREST 的 auth.uid() 可能因 JWT 解码差异
    // 返回 NULL，导致 RLS INSERT 策略（owner_id = auth.uid()）被拒（42501）。
    // security definer 函数内部读取 request.jwt.claims 不受此影响。
    async function getOrCreateDefaultProject(userId) {
      if (!userId) throw new Error('缺少 userId');

      // 1. 先查找已有项目（SELECT 走 RLS，即使 auth.uid() 为 NULL 也只返回空，不会报错）
      const { data: existing, error: selectError } = await client
        .from('projects')
        .select('id,title')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true })
        .limit(1);
      if (selectError) throw selectError;

      if (existing && existing.length > 0) {
        return existing[0];
      }

      // 2. 通过 security definer RPC 创建项目（绕过 RLS + 内置 profile 校验）
      if (typeof client.rpc !== 'function') {
        // 兜底：RPC 不可用时回退到直接 INSERT（保留原有行为用于测试等场景）
        const { data: created, error: insertError } = await client
          .from('projects')
          .insert({ owner_id: userId, title: DEFAULT_PROJECT_TITLE })
          .select('id,title')
          .single();
        if (insertError) throw insertError;
        return created;
      }

      const { data: created, error: rpcError } = await client
        .rpc('create_project_for_owner', { _title: DEFAULT_PROJECT_TITLE });
      if (rpcError) throw rpcError;
      return created;
    }

    return { listProjects, getOrCreateDefaultProject };
  }

  return { createProjectService, DEFAULT_PROJECT_TITLE };
});
