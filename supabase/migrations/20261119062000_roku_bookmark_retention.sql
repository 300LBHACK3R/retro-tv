begin;

-- Bookmarks within the 30-day window are protected regardless of how many
-- different titles a profile has watched. Keep older bookmarks in the latest 300.
create or replace function public.ttv_save_progress(p_user uuid,p_profile text,p_media text,p_position double precision,
  p_duration double precision,p_revision bigint,p_playback uuid,p_sequence integer)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current public.ttv_profile_progress; accepted boolean:=false;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_profile,42));
  select * into current from public.ttv_profile_progress where user_id=p_user and profile_id=p_profile and media_id=p_media;
  if current is null and p_revision=0 then
    insert into public.ttv_profile_progress(user_id,profile_id,media_id,position,duration,playback_id,sequence)
      values(p_user,p_profile,p_media,p_position,p_duration,p_playback,p_sequence) returning * into current;
    accepted:=true;
  elsif current.playback_id=p_playback and current.sequence>=p_sequence then
    accepted:=true;
  elsif current.playback_id=p_playback or current.revision=p_revision then
    update public.ttv_profile_progress set position=p_position,duration=p_duration,
      revision=revision+1,playback_id=p_playback,sequence=p_sequence,updated_at=now()
      where user_id=p_user and profile_id=p_profile and media_id=p_media returning * into current;
    accepted:=true;
  end if;
  delete from public.ttv_profile_progress where user_id=p_user and profile_id=p_profile
    and updated_at < now()-interval '720 hours' and media_id in
    (select media_id from public.ttv_profile_progress where user_id=p_user and profile_id=p_profile order by updated_at desc,media_id offset 300);
  return jsonb_build_object('accepted',accepted,'entry',to_jsonb(current));
end; $$;

comment on table public.ttv_profile_progress is 'Private per-household profile progress. Bookmarks are retained for at least 30 days, and the 300 most recent entries can be retained longer.';

commit;
