// 认证守卫模块 — 主应用页面加载时检查登录状态
// 如果 Token 无效或已过期，自动跳转到登录页面

(function () {
  if (typeof document === 'undefined') return;

  // 仅在主页面（index.html）生效，不在登录页执行
  if (window.location.pathname.endsWith('login.html') ||
      window.location.pathname === '/login.html') {
    return;
  }

  const LOGIN_URL = '/login.html';

  /**
   * 检查当前会话是否有效
   * @returns {Promise<boolean>}
   */
  async function checkSession() {
    const state = window.VideoEditingSupabase;
    if (!state || !state.isConfigured || !state.client) {
      // Supabase 未配置 → 允许使用（无登录模式）
      console.warn('Supabase 未配置，跳过认证检查');
      return true;
    }

    try {
      const { data, error } = await state.client.auth.getSession();
      if (error || !data || !data.session) {
        return false;
      }

      // 用 jwtToken 模块校验 token 是否过期
      if (window.AuthModule && typeof window.AuthModule.validateSessionJwtToken === 'function') {
        const result = window.AuthModule.validateSessionJwtToken(data.session, {
          clockSkewSeconds: 30,
        });
        return result.ok;
      }

      // 如果 jwtToken 模块不可用，至少 session 存在就认为有效
      return true;
    } catch (err) {
      console.error('认证检查失败:', err);
      return false;
    }
  }

  /**
   * 跳转到登录页面
   */
  function redirectToLogin() {
    // 避免循环跳转
    if (window.location.pathname.endsWith('login.html')) return;
    window.location.replace(LOGIN_URL);
  }

  // ===== 初始检查 =====
  // 等待 Supabase SDK 初始化完成
  function waitForSupabase() {
    return new Promise((resolve) => {
      const check = () => {
        const state = window.VideoEditingSupabase;
        if (state) {
          resolve(state);
        } else {
          setTimeout(check, 80);
        }
      };
      check();
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const state = await waitForSupabase();

    // 如果 Supabase 未配置，跳过认证（允许离线使用）
    if (!state.isConfigured) {
      console.info('Supabase 未配置，跳过认证检查，以离线模式运行');
      return;
    }

    const isValid = await checkSession();
    if (!isValid) {
      console.warn('未登录或会话已过期，跳转到登录页面');
      redirectToLogin();
      return;
    }

    console.log('认证检查通过');
  });

  // ===== 运行时监听 Token 变化 =====
  // 当 Supabase 检测到 token 刷新失败或过期时，自动跳转
  function listenAuthChanges() {
    const state = window.VideoEditingSupabase;
    if (!state || !state.client || !state.client.auth) return;

    const auth = state.client.auth;
    if (typeof auth.onAuthStateChange !== 'function') return;

    auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED 失败或 SIGNED_OUT 时跳转
      if (event === 'SIGNED_OUT') {
        redirectToLogin();
        return;
      }

      if (event === 'TOKEN_REFRESHED' && !session) {
        redirectToLogin();
        return;
      }

      // 任何情况下 session 变为 null 且当前在主页面时跳转
      if (!session && event !== 'INITIAL_SESSION') {
        redirectToLogin();
      }
    });
  }

  // 监听初始状态完成后注册
  document.addEventListener('DOMContentLoaded', () => {
    const state = window.VideoEditingSupabase;
    if (state && state.isConfigured) {
      listenAuthChanges();
    } else {
      // 如果还没配置完成，等一会儿再注册
      const checkAndListen = () => {
        const s = window.VideoEditingSupabase;
        if (s && s.isConfigured) {
          listenAuthChanges();
        } else {
          setTimeout(checkAndListen, 200);
        }
      };
      setTimeout(checkAndListen, 500);
    }
  });
})();
