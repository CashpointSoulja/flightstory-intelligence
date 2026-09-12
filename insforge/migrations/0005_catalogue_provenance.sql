alter table flightstory.episodes
  add column if not exists source_guid text,
  add column if not exists source_audio_url text;

create unique index if not exists episodes_workspace_source_guid_idx
  on flightstory.episodes(workspace_id, source_guid)
  where source_guid is not null;
