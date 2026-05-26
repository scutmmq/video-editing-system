(function () {
  function readMeta(name) {
    const element = document.querySelector(`meta[name="${name}"]`);
    return element ? element.content.trim() : '';
  }

  const publishableKey = readMeta('supabase-publishable-key') || readMeta('supabase-anon-key');
  const config = {
    url: readMeta('supabase-url'),
    publishableKey,
    anonKey: publishableKey,
  };

  const state = {
    client: null,
    isConfigured: false,
    status: 'initializing',
    config,
  };

  function setStatus(status) {
    state.status = status;
    document.documentElement.dataset.supabaseStatus = status;
  }

  window.VideoEditingSupabase = state;

  if (!config.url || !config.publishableKey) {
    setStatus('missing-config');
    console.info('Supabase is not configured. Add supabase-url and supabase-publishable-key meta values in index.html.');
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    setStatus('sdk-missing');
    console.warn('Supabase SDK did not load. Check the CDN script in index.html.');
    return;
  }

  state.client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  state.isConfigured = true;
  setStatus('configured');
})();
