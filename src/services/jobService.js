// 处理任务服务：开始/完成/失败一条 processing_jobs，以及列出项目历史。
// createJobService(client) 接收 Supabase client（或测试用 fake）。

(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.JobService = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function createJobService(client) {
    if (!client || typeof client.from !== 'function') {
      throw new Error('Supabase client 不可用，无法初始化 jobService');
    }

    // 创建一条 processing 状态的任务，返回其 id。
    async function startJob(job) {
      const row = {
        project_id: job.projectId,
        operation: job.operation,
        params: job.params || {},
        status: 'processing',
        source_asset_id: job.sourceAssetId || null,
        created_by: job.createdBy,
        started_at: new Date().toISOString(),
      };

      const { data, error } = await client
        .from('processing_jobs')
        .insert(row)
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    }

    async function completeJob(jobId, resultAssetId) {
      const { error } = await client
        .from('processing_jobs')
        .update({
          status: 'succeeded',
          result_asset_id: resultAssetId || null,
          finished_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      if (error) throw error;
    }

    async function failJob(jobId, message) {
      const { error } = await client
        .from('processing_jobs')
        .update({
          status: 'failed',
          error_message: message ? String(message).slice(0, 500) : '未知错误',
          finished_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      if (error) throw error;
    }

    async function listJobs(projectId, limit) {
      const max = (typeof limit === 'number' && limit > 0) ? limit : 100;
      const { data, error } = await client
        .from('processing_jobs')
        .select('id,operation,params,status,error_message,result_asset_id,created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(max);
      if (error) throw error;
      return data || [];
    }

    async function deleteJob(jobId) {
      const { error } = await client
        .from('processing_jobs')
        .delete()
        .eq('id', jobId);
      if (error) throw error;
    }

    return { startJob, completeJob, failJob, listJobs, deleteJob };
  }

  return { createJobService };
});
