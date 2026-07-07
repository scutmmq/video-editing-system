-- Allow recently added processing operations to be saved in cloud history.

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
    'audio_adjust',
    'image_watermark',
    'audio_mix',
    'concat',
    'subtitle_burn'
  )
);

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
    'audio_adjusted_video',
    'audio_mixed_video',
    'concatenated_video',
    'subtitled_video'
  )
);
