-- Keep the existing programming timestamp trigger while fixing object lookup.
-- pg_catalog remains implicitly available for now(); no data is changed.
alter function public.set_programming_state_updated_at() set search_path = '';
