set search_path to avrone_runtime, public;

alter table deployment_admissions add column if not exists promoted_by text;
alter table deployment_admissions add column if not exists promoted_at text;
alter table deployment_admissions add column if not exists promotion_receipt text;
