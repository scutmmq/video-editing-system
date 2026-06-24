// 素材服务：写入结果素材元数据、按 id 取素材（用于生成签名 URL）。
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

    async function listAssetsByOwner(ownerId, limit) {
      const { data, error } = await client
        .from('media_assets')
        .select('id,owner_id,kind,bucket,storage_path,original_filename,mime_type,size_bytes,created_at')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(limit || 100);
      if (error) throw error;
      return (data || []).map(function (row) {
        return {
          id: row.id,
          owner_id: row.owner_id,
          kind: row.kind,
          bucket: row.bucket,
          storage_path: row.storage_path,
          original_filename: row.original_filename,
          mime_type: row.mime_type,
          size_bytes: row.size_bytes,
          created_at: row.created_at,
        };
      });
    }

    return { insertResultAsset, getAssetById, deleteAsset, listAssetsByOwner };

  return { createAssetService };
});
