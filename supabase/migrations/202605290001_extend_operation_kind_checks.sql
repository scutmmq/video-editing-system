-- Phase 2：把 Phase 1 新增的处理类型纳入 check 约束。
-- Postgres 的 check 约束无法直接 alter，只能先 drop 再以新定义重建（幂等）。

-- processing_jobs.operation：新增 transform / transcode / speed / audio_adjust
alter table public.processing_jobs drop constraint if exists processing_jobs_operation_check;
alter table public.processing_jobs add constraint processing_jobs_operation_check check (
  operation in (
    'trim',
    'gif',
    'extract_audio',
    'watermark',
    'filter',
    'capture_cover',
    'transform',
    'transcode',
    'speed',
    'audio_adjust'
  )
);

-- media_assets.kind：新增四种结果类型（Phase 1 功能的输出）
alter table public.media_assets drop constraint if exists media_assets_kind_check;
alter table public.media_assets add constraint media_assets_kind_check check (
  kind in (
    'source_video',
    'trimmed_video',
    'gif',
    'audio',
    'cover_image',
    'watermarked_video',
    'filtered_video',
    'transformed_video',
    'transcoded_video',
    'speed_video',
    'audio_adjusted_video'
  )
);
