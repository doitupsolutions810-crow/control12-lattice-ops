set search_path to avrone_runtime, public;

alter table if exists constitution_amendments
  add column if not exists activated_by text,
  add column if not exists activated_at text,
  add column if not exists activation_evidence text;

comment on column constitution_amendments.activated_by is
  'Independent human authority that activated the approved amendment.';
comment on column constitution_amendments.activated_at is
  'Timestamp of constitutional activation.';
comment on column constitution_amendments.activation_evidence is
  'Canonical JSON receipt linking proposer, voting board, quorum, activator, digest, and resulting constitution version.';
