// Storage 服务：上传结果文件、生成临时签名 URL。
// createStorageService(client) 接收 Supabase client（或测试用 fake），便于单测。

(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.StorageService = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const DEFAULT_SIGNED_URL_TTL = 3600; // 1 小时

  function createStorageService(client) {
    if (!client || !client.storage) {
      throw new Error('Supabase client 不可用，无法初始化 storageService');
    }

    async function uploadResult(bucket, path, blob, contentType) {
      const { error } = await client.storage.from(bucket).upload(path, blob, {
        contentType: contentType || (blob && blob.type) || 'application/octet-stream',
        upsert: false,
      });
      if (error) throw error;
      return { bucket, path };
    }

    async function getSignedUrl(bucket, path, expiresIn) {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn || DEFAULT_SIGNED_URL_TTL);
      if (error) throw error;
      return data.signedUrl;
    }

    async function deleteFile(bucket, path) {
      const { data, error } = await client.storage
        .from(bucket)
        .remove([path]);
      if (error) throw error;
      return data;
    }

    return { uploadResult, getSignedUrl, deleteFile };
  }

  return { createStorageService, DEFAULT_SIGNED_URL_TTL };
});
