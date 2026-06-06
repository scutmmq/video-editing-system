(function (root, factory) {
  let jwtTokenModule = root && root.JwtTokenModule ? root.JwtTokenModule : null;

  if (!jwtTokenModule && typeof require === 'function') {
    try {
      jwtTokenModule = require('./jwtToken.js');
    } catch (_err) {
      jwtTokenModule = null;
    }
  }

  const api = factory(jwtTokenModule || {});

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.AuthModule = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (jwtTokenModule) {
  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function validateEmail(email) {
    const value = normalizeEmail(email);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validatePassword(password) {
    const value = String(password || '');
    if (value.length < 6) {
      return { valid: false, message: '密码至少需要 6 位' };
    }
    return { valid: true, message: '' };
  }

  function getAuthClient(supabaseClient) {
    return supabaseClient && supabaseClient.auth ? supabaseClient.auth : null;
  }

  function getSessionJwtToken(session) {
    return session && typeof session.access_token === 'string'
      ? session.access_token
      : '';
  }

  function validateSessionJwtToken(session, options) {
    options = options || {};
    const jwtToken = getSessionJwtToken(session);
    if (!jwtTokenModule || typeof jwtTokenModule.validateJwtToken !== 'function') {
      return { ok: false, message: 'jwtToken 校验模块不可用', jwtToken: '', payload: null };
    }

    const result = jwtTokenModule.validateJwtToken(jwtToken, {
      now: options.now,
      clockSkewSeconds: options.clockSkewSeconds,
    });

    return {
      ok: result.ok,
      message: result.message,
      jwtToken,
      payload: result.payload,
    };
  }

  function createAuthController(options) {
    options = options || {};
    const auth = getAuthClient(options.supabaseClient);

    function validateCredentials(email, password) {
      const normalizedEmail = normalizeEmail(email);
      if (!validateEmail(normalizedEmail)) {
        return { ok: false, message: '邮箱格式不正确', email: normalizedEmail };
      }

      const passwordResult = validatePassword(password);
      if (!passwordResult.valid) {
        return { ok: false, message: passwordResult.message, email: normalizedEmail };
      }

      if (!auth) {
        return { ok: false, message: 'Supabase 尚未配置，无法登录', email: normalizedEmail };
      }

      return { ok: true, message: '', email: normalizedEmail };
    }

    function requireValidSession(data, fallbackMessage) {
      const session = data && data.session ? data.session : null;
      const tokenResult = validateSessionJwtToken(session, {
        now: options.now,
        clockSkewSeconds: options.clockSkewSeconds,
      });

      if (!tokenResult.ok) {
        return {
          ok: false,
          message: tokenResult.message || fallbackMessage,
          data: null,
          jwtToken: tokenResult.jwtToken,
        };
      }

      return {
        ok: true,
        message: '',
        data,
        jwtToken: tokenResult.jwtToken,
        jwtPayload: tokenResult.payload,
      };
    }

    async function signIn(email, password) {
      const validation = validateCredentials(email, password);
      if (!validation.ok) return validation;

      const { data, error } = await auth.signInWithPassword({
        email: validation.email,
        password,
      });

      if (error) {
        return { ok: false, message: error.message || '登录失败', data: null };
      }

      const sessionResult = requireValidSession(data, '登录失败，jwtToken 无效');
      if (!sessionResult.ok) return sessionResult;

      return {
        ok: true,
        message: '登录成功',
        data,
        jwtToken: sessionResult.jwtToken,
        jwtPayload: sessionResult.jwtPayload,
      };
    }

    async function signUp(email, password) {
      const validation = validateCredentials(email, password);
      if (!validation.ok) return validation;

      const { data, error } = await auth.signUp({
        email: validation.email,
        password,
      });

      if (error) {
        return { ok: false, message: error.message || '注册失败', data: null };
      }

      if (data && data.session) {
        const sessionResult = requireValidSession(data, '注册失败，jwtToken 无效');
        if (!sessionResult.ok) return sessionResult;

        return {
          ok: true,
          message: '注册成功',
          data,
          jwtToken: sessionResult.jwtToken,
          jwtPayload: sessionResult.jwtPayload,
        };
      }

      return { ok: true, message: '注册成功，请根据邮箱提示完成确认', data, jwtToken: '' };
    }

    async function signOut() {
      if (!auth) {
        return { ok: false, message: 'Supabase 尚未配置，无法退出登录' };
      }

      const { error } = await auth.signOut();
      if (error) {
        return { ok: false, message: error.message || '退出登录失败' };
      }
      return { ok: true, message: '已退出登录' };
    }

    async function getSession() {
      if (!auth) return null;
      const { data, error } = await auth.getSession();
      if (error || !data || !data.session) return null;

      const tokenResult = validateSessionJwtToken(data.session, {
        now: options.now,
        clockSkewSeconds: options.clockSkewSeconds,
      });

      return tokenResult.ok ? data.session : null;
    }

    return {
      signIn,
      signUp,
      signOut,
      getSession,
      isConfigured: Boolean(auth),
    };
  }

  function initAuthUI() {
    if (typeof document === 'undefined') return;

    var emailInput = document.getElementById('authEmail');
    var passwordInput = document.getElementById('authPassword');
    var signInBtn = document.getElementById('authSignInBtn');
    var signUpBtn = document.getElementById('authSignUpBtn');
    var signOutBtn = document.getElementById('authSignOutBtn');
    var message = document.getElementById('authMessage');
    var signedOut = document.getElementById('authSignedOut');
    var signedIn = document.getElementById('authSignedIn');
    var userEmail = document.getElementById('authUserEmail');
    var loginLink = document.getElementById('authLoginLink');

    // 判断当前页面类型
    var isLoginPage = !!(emailInput && passwordInput && signInBtn && signUpBtn);
    var isMainPage = !isLoginPage && !!(signOutBtn && signedIn && userEmail);

    // 两种页面都不匹配则退出
    if (!isLoginPage && !isMainPage) return;
    if (!signOutBtn) return;

    var supabaseState = window.VideoEditingSupabase || {};
    var controller = createAuthController({ supabaseClient: supabaseState.client });

    function setMessage(text, type) {
      if (!message) return;
      message.textContent = text;
      var cssType = type || 'info';
      message.className = isLoginPage ? 'login-message ' + cssType : 'auth-message ' + cssType;
    }

    function setLoading(isLoading) {
      if (signInBtn) {
        signInBtn.disabled = isLoading || !controller.isConfigured;
        if (!isLoading) signInBtn.classList.remove('btn-loading');
      }
      if (signUpBtn) {
        signUpBtn.disabled = isLoading || !controller.isConfigured;
        if (!isLoading) signUpBtn.classList.remove('btn-loading');
      }
      if (signOutBtn) {
        signOutBtn.disabled = isLoading || !controller.isConfigured;
        if (isLoading && isMainPage) signOutBtn.classList.add('btn-loading');
        if (!isLoading) signOutBtn.classList.remove('btn-loading');
      }
    }

    function renderSession(session) {
      var email = session && session.user ? session.user.email : '';
      var hasSession = Boolean(email);
      if (signedOut) signedOut.style.display = hasSession ? 'none' : '';
      if (signedIn) signedIn.style.display = hasSession ? '' : 'none';
      if (userEmail) userEmail.textContent = email || '';
      if (loginLink) loginLink.style.display = hasSession ? 'none' : '';
    }

    async function runAuthAction(action) {
      setLoading(true);
      var result = await action(normalizeEmail(emailInput.value), passwordInput.value);
      setMessage(result.message, result.ok ? 'success' : 'error');
      if (result.ok) {
        passwordInput.value = '';
        renderSession(result.data ? result.data.session : await controller.getSession());
      }
      setLoading(false);
    }

    if (isLoginPage && signInBtn && signUpBtn) {
      signInBtn.addEventListener('click', function () { runAuthAction(controller.signIn); });
      signUpBtn.addEventListener('click', function () { runAuthAction(controller.signUp); });
    }

    // 退出登录 → 跳转到登录页
    signOutBtn.addEventListener('click', async function () {
      setLoading(true);
      var result = await controller.signOut();
      if (result.ok) {
        renderSession(null);
        window.location.replace('/login.html');
      } else {
        setMessage(result.message, 'error');
        setLoading(false);
      }
    });

    if (!controller.isConfigured) {
      if (isLoginPage) setMessage('Supabase 尚未配置，登录功能不可用', 'error');
      setLoading(false);
      return;
    }

    // 初始化渲染当前会话状态
    controller.getSession().then(renderSession);

    // 监听认证状态变化
    var authClient = supabaseState.client && supabaseState.client.auth;
    if (authClient && typeof authClient.onAuthStateChange === 'function') {
      authClient.onAuthStateChange(function (_event, session) {
        var tokenResult = validateSessionJwtToken(session);
        if (tokenResult.ok) {
          renderSession(session);
        } else {
          renderSession(null);
          // 主页面：token 失效时自动跳转登录页
          if (isMainPage && session) {
            window.location.replace('/login.html');
          }
        }
      });
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initAuthUI);
  }

  return {
    normalizeEmail,
    validateEmail,
    validatePassword,
    validateSessionJwtToken,
    createAuthController,
    initAuthUI,
  };
});
