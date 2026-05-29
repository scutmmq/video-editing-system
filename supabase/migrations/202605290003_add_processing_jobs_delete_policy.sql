-- 补充 processing_jobs 的 DELETE 策略（此前仅有 SELECT/INSERT/UPDATE）
-- 仅允许项目成员（editor 及以上）删除自己项目中的处理任务
create policy "Editors can delete processing jobs"
on public.processing_jobs for delete
to authenticated
using (public.can_edit_project(project_id));
