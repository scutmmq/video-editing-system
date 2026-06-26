// 素材服务：写入素材元数据、按 id / owner / project 查询素材（用于生成签名 URL、素材库列表）。
// createAssetService(client) 接收 Supabase client（或测试用 fake）。

(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.AssetService = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const LIST_COLUMNS =
    'id,project_id,owner_id,kind,bucket,storage_path,original_filename,mime_type,size_bytes,duration_seconds,created_at';

  function mapRow(row) {
    return {
      id: row.id,
      project_id: row.project_id,
      owner_id: row.owner_id,
      kind: row.kind,
      bucket: row.bucket,
      storage_path: row.storage_path,
      original_filename: row.original_filename,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      duration_seconds: row.duration_seconds,
      created_at: row.created_at,
    };
  }

  function createAssetService(client) {
    if (!client || typeof client.from !== 'function') {
      throw new Error('Supabase client 不可用，无法初始化 assetService');
    }

    // asset.id 由调用方（客户端 crypto.randomUUID）生成，必须与 storage_path 中的片段一致。
    async function insertResultAsset(asset) {
      const row = {
        id: asset.id,
        project_id: asset.projectId,
        owner_id: asset.ownerId,
        kind: asset.kind,
        bucket: asset.bucket,
        storage_path: asset.storagePath,
        original_filename: asset.originalFilename || null,
        mime_type: asset.mimeType || null,
        size_bytes: asset.sizeBytes ?? null,
        duration_seconds: asset.durationSeconds ?? null,
        width: asset.width ?? null,
        height: asset.height ?? null,
      };

      const { data, error } = await client
        .from('media_assets')
        .insert(row)
        .select('id,bucket,storage_path')
        .single();
      if (error) throw error;
      return data;
    }

    async function getAssetById(assetId) {
      const { data, error } = await client
        .from('media_assets')
        .select('id,bucket,storage_path,original_filename,mime_type,kind')
        .eq('id', assetId)
        .single();
      if (error) throw error;
      return data;
    }

    async function deleteAsset(assetId) {
      const { error } = await client
        .from('media_assets')
        .delete()
        .eq('id', assetId);
      if (error) throw error;
    }

    async function listProjectAssets(projectId, limit) {
      const { data, error } = await client
        .from('media_assets')
        .select(LIST_COLUMNS)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit || 100);
      if (error) throw error;
      return (data || []).map(mapRow);
    }

    // options: { kind, limit }。素材库用 kind:'source_video' 只取用户上传的源视频。
    async function listAssetsByOwner(ownerId, options) {
      const opts = options || {};
      let query = client
        .from('media_assets')
        .select(LIST_COLUMNS)
        .eq('owner_id', ownerId);
      if (opts.kind) query = query.eq('kind', opts.kind);
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(opts.limit || 100);
      if (error) throw error;
      return (data || []).map(mapRow);
    }

    return { insertResultAsset, getAssetById, deleteAsset, listProjectAssets, listAssetsByOwner };
  }

  return { createAssetService };
});
