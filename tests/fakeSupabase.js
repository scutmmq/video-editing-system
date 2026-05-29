// 测试用的最小 Supabase client 仿造：支持链式 from().select().eq().order().limit()/单条 single()、
// insert().select().single()、update().eq()，以及 storage.from().upload()/createSignedUrl()、auth.getUser()。
// responders 按 `${table}.${op}` 或 `storage.upload` / `storage.createSignedUrl` / `auth.getUser` 提供返回值。

function createFakeSupabase(opts) {
  const options = opts || {};
  const responders = options.responders || {};
  const calls = { inserts: [], updates: [], uploads: [], signed: [], rpcs: [], deletes: [], removes: [] };

  function tableBuilder(table) {
    const state = { table, op: 'select', payload: null, filters: [], single: false };

    function computeResult() {
      const key = table + '.' + state.op;
      const fn = responders[key];
      if (fn) return fn(state, calls);
      return { data: state.single ? null : [], error: null };
    }

    const builder = {
      select() { return builder; },
      insert(row) { state.op = 'insert'; state.payload = row; calls.inserts.push({ table, row }); return builder; },
      update(obj) { state.op = 'update'; state.payload = obj; calls.updates.push({ table, obj }); return builder; },
      delete() { state.op = 'delete'; calls.deletes.push({ table }); return builder; },
      eq(col, val) { state.filters.push([col, val]); return builder; },
      order() { return builder; },
      limit(n) { state.limit = n; return builder; },
      single() { state.single = true; return Promise.resolve(computeResult()); },
      maybeSingle() { state.single = true; return Promise.resolve(computeResult()); },
      then(onFulfilled, onRejected) { return Promise.resolve(computeResult()).then(onFulfilled, onRejected); },
    };
    return builder;
  }

  const client = {
    from(table) { return tableBuilder(table); },
    rpc(fnName, params) {
      calls.rpcs.push({ fn: fnName, params });
      const fn = responders['rpc.' + fnName] || responders['rpc'];
      return Promise.resolve(fn ? fn({ fn: fnName, params }, calls) : { data: null, error: new Error('rpc not mocked') });
    },
    storage: {
      from(bucket) {
        return {
          upload(path, blob, uploadOpts) {
            calls.uploads.push({ bucket, path, options: uploadOpts });
            const fn = responders['storage.upload'];
            return Promise.resolve(fn ? fn({ bucket, path, blob }, calls) : { data: { path }, error: null });
          },
          createSignedUrl(path, ttl) {
            calls.signed.push({ bucket, path, ttl });
            const fn = responders['storage.createSignedUrl'];
            return Promise.resolve(fn ? fn({ bucket, path, ttl }, calls) : { data: { signedUrl: 'https://signed/' + bucket + '/' + path }, error: null });
          },
          remove(paths) {
            calls.removes.push({ bucket, paths });
            const fn = responders['storage.remove'];
            return Promise.resolve(fn ? fn({ bucket, paths }, calls) : { data: paths.map(function(p) { return { id: p, path: p }; }), error: null });
          },
        };
      },
    },
    auth: {
      getUser() {
        const fn = responders['auth.getUser'];
        return Promise.resolve(fn ? fn() : { data: { user: { id: 'user-1' } }, error: null });
      },
    },
  };

  return { client, calls };
}

module.exports = { createFakeSupabase };
