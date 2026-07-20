-- Remove the AAG object-placement answer-set feature entirely.
-- The web UI, API routes, and lib helpers for this feature have been deleted;
-- this migration drops the backing tables, functions, and triggers.
-- Tables held only empty draft sets, so no participant data is affected.

drop trigger if exists aag_answer_markers_ready_protection on public.aag_answer_markers;
drop trigger if exists aag_answer_markers_updated_at on public.aag_answer_markers;
drop trigger if exists aag_answer_sets_ready_validation on public.aag_answer_sets;
drop trigger if exists aag_answer_sets_updated_at on public.aag_answer_sets;

drop function if exists public.aag_export_answer_set(text, text);
drop function if exists public.aag_set_answer_set_status(text, text, text);
drop function if exists public.aag_replace_answer_markers(text, text, jsonb, text, text);
drop function if exists public.aag_prevent_ready_marker_mutation();
drop function if exists public.aag_assert_ready_answer_set();
drop function if exists public.aag_answer_set_validation(text, text);

-- aag_answer_markers has a FK to aag_answer_sets, so drop it first.
drop table if exists public.aag_answer_markers;
drop table if exists public.aag_answer_sets;

-- aag_set_updated_at is shared only by the AAG triggers dropped above.
drop function if exists public.aag_set_updated_at();
