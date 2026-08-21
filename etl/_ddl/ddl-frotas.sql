-- DROP SCHEMA public;

CREATE SCHEMA public AUTHORIZATION pg_database_owner;

COMMENT ON SCHEMA public IS 'standard public schema';

-- DROP TYPE public.citext;

CREATE TYPE public.citext (
	INPUT = citextin,
	OUTPUT = citextout,
	RECEIVE = citextrecv,
	SEND = citextsend,
	ALIGNMENT = 4,
	STORAGE = any,
	CATEGORY = S,
	DELIMITER = ',',
	COLLATABLE = true);

-- DROP SEQUENCE public.action_text_rich_texts_id_seq;

CREATE SEQUENCE public.action_text_rich_texts_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.active_storage_attachments_id_seq;

CREATE SEQUENCE public.active_storage_attachments_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.active_storage_blobs_id_seq;

CREATE SEQUENCE public.active_storage_blobs_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.active_storage_variant_records_id_seq;

CREATE SEQUENCE public.active_storage_variant_records_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.fuel_transactions_id_seq;

CREATE SEQUENCE public.fuel_transactions_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.license_categories_id_seq;

CREATE SEQUENCE public.license_categories_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.omes_id_seq;

CREATE SEQUENCE public.omes_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.permissions_id_seq;

CREATE SEQUENCE public.permissions_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.profiles_id_seq;

CREATE SEQUENCE public.profiles_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.reports_alerts_id_seq;

CREATE SEQUENCE public.reports_alerts_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.reports_omes_id_seq;

CREATE SEQUENCE public.reports_omes_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.reports_vehicles_id_seq;

CREATE SEQUENCE public.reports_vehicles_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.transfers_id_seq;

CREATE SEQUENCE public.transfers_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.users_id_seq;

CREATE SEQUENCE public.users_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicle_destination_types_id_seq;

CREATE SEQUENCE public.vehicle_destination_types_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicle_document_types_id_seq;

CREATE SEQUENCE public.vehicle_document_types_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicle_documents_id_seq;

CREATE SEQUENCE public.vehicle_documents_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicle_fuel_types_id_seq;

CREATE SEQUENCE public.vehicle_fuel_types_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicle_maintenance_types_id_seq;

CREATE SEQUENCE public.vehicle_maintenance_types_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicle_maintenances_id_seq;

CREATE SEQUENCE public.vehicle_maintenances_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicle_observation_types_id_seq;

CREATE SEQUENCE public.vehicle_observation_types_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicle_observations_id_seq;

CREATE SEQUENCE public.vehicle_observations_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicle_ownership_types_id_seq;

CREATE SEQUENCE public.vehicle_ownership_types_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicle_status_types_id_seq;

CREATE SEQUENCE public.vehicle_status_types_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicle_statuses_id_seq;

CREATE SEQUENCE public.vehicle_statuses_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicle_types_id_seq;

CREATE SEQUENCE public.vehicle_types_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vehicles_id_seq;

CREATE SEQUENCE public.vehicles_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;-- public.action_text_rich_texts definição

-- Drop table

-- DROP TABLE public.action_text_rich_texts;

CREATE TABLE public.action_text_rich_texts (
	id bigserial NOT NULL,
	"name" varchar NOT NULL,
	body text NULL,
	record_type varchar NOT NULL,
	record_id int8 NOT NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT action_text_rich_texts_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX index_action_text_rich_texts_uniqueness ON public.action_text_rich_texts USING btree (record_type, record_id, name);


-- public.active_storage_blobs definição

-- Drop table

-- DROP TABLE public.active_storage_blobs;

CREATE TABLE public.active_storage_blobs (
	id bigserial NOT NULL,
	"key" varchar NOT NULL,
	filename varchar NOT NULL,
	content_type varchar NULL,
	metadata text NULL,
	service_name varchar NOT NULL,
	byte_size int8 NOT NULL,
	checksum varchar NULL,
	created_at timestamp(6) NOT NULL,
	CONSTRAINT active_storage_blobs_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX index_active_storage_blobs_on_key ON public.active_storage_blobs USING btree (key);


-- public.ar_internal_metadata definição

-- Drop table

-- DROP TABLE public.ar_internal_metadata;

CREATE TABLE public.ar_internal_metadata (
	"key" varchar NOT NULL,
	value varchar NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT ar_internal_metadata_pkey PRIMARY KEY (key)
);


-- public.good_job_batches definição

-- Drop table

-- DROP TABLE public.good_job_batches;

CREATE TABLE public.good_job_batches (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	description text NULL,
	serialized_properties jsonb NULL,
	on_finish text NULL,
	on_success text NULL,
	on_discard text NULL,
	callback_queue_name text NULL,
	callback_priority int4 NULL,
	enqueued_at timestamp(6) NULL,
	discarded_at timestamp(6) NULL,
	finished_at timestamp(6) NULL,
	CONSTRAINT good_job_batches_pkey PRIMARY KEY (id)
);


-- public.good_job_executions definição

-- Drop table

-- DROP TABLE public.good_job_executions;

CREATE TABLE public.good_job_executions (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	active_job_id uuid NOT NULL,
	job_class text NULL,
	queue_name text NULL,
	serialized_params jsonb NULL,
	scheduled_at timestamp(6) NULL,
	finished_at timestamp(6) NULL,
	error text NULL,
	error_event int2 NULL,
	CONSTRAINT good_job_executions_pkey PRIMARY KEY (id)
);
CREATE INDEX index_good_job_executions_on_active_job_id_and_created_at ON public.good_job_executions USING btree (active_job_id, created_at);


-- public.good_job_processes definição

-- Drop table

-- DROP TABLE public.good_job_processes;

CREATE TABLE public.good_job_processes (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	state jsonb NULL,
	CONSTRAINT good_job_processes_pkey PRIMARY KEY (id)
);


-- public.good_job_settings definição

-- Drop table

-- DROP TABLE public.good_job_settings;

CREATE TABLE public.good_job_settings (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	"key" text NULL,
	value jsonb NULL,
	CONSTRAINT good_job_settings_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX index_good_job_settings_on_key ON public.good_job_settings USING btree (key);


-- public.good_jobs definição

-- Drop table

-- DROP TABLE public.good_jobs;

CREATE TABLE public.good_jobs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	queue_name text NULL,
	priority int4 NULL,
	serialized_params jsonb NULL,
	scheduled_at timestamp(6) NULL,
	performed_at timestamp(6) NULL,
	finished_at timestamp(6) NULL,
	error text NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	active_job_id uuid NULL,
	concurrency_key text NULL,
	cron_key text NULL,
	retried_good_job_id uuid NULL,
	cron_at timestamp(6) NULL,
	batch_id uuid NULL,
	batch_callback_id uuid NULL,
	is_discrete bool NULL,
	executions_count int4 NULL,
	job_class text NULL,
	error_event int2 NULL,
	CONSTRAINT good_jobs_pkey PRIMARY KEY (id)
);
CREATE INDEX index_good_jobs_jobs_on_finished_at ON public.good_jobs USING btree (finished_at) WHERE ((retried_good_job_id IS NULL) AND (finished_at IS NOT NULL));
CREATE INDEX index_good_jobs_jobs_on_priority_created_at_when_unfinished ON public.good_jobs USING btree (priority DESC NULLS LAST, created_at) WHERE (finished_at IS NULL);
CREATE INDEX index_good_jobs_on_active_job_id ON public.good_jobs USING btree (active_job_id);
CREATE INDEX index_good_jobs_on_active_job_id_and_created_at ON public.good_jobs USING btree (active_job_id, created_at);
CREATE INDEX index_good_jobs_on_batch_callback_id ON public.good_jobs USING btree (batch_callback_id) WHERE (batch_callback_id IS NOT NULL);
CREATE INDEX index_good_jobs_on_batch_id ON public.good_jobs USING btree (batch_id) WHERE (batch_id IS NOT NULL);
CREATE INDEX index_good_jobs_on_concurrency_key_when_unfinished ON public.good_jobs USING btree (concurrency_key) WHERE (finished_at IS NULL);
CREATE INDEX index_good_jobs_on_cron_key_and_created_at ON public.good_jobs USING btree (cron_key, created_at);
CREATE UNIQUE INDEX index_good_jobs_on_cron_key_and_cron_at ON public.good_jobs USING btree (cron_key, cron_at);
CREATE INDEX index_good_jobs_on_queue_name_and_scheduled_at ON public.good_jobs USING btree (queue_name, scheduled_at) WHERE (finished_at IS NULL);
CREATE INDEX index_good_jobs_on_scheduled_at ON public.good_jobs USING btree (scheduled_at) WHERE (finished_at IS NULL);


-- public.license_categories definição

-- Drop table

-- DROP TABLE public.license_categories;

CREATE TABLE public.license_categories (
	id bigserial NOT NULL,
	code varchar(10) NOT NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT license_categories_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX index_license_categories_on_code ON public.license_categories USING btree (code);


-- public.omes definição

-- Drop table

-- DROP TABLE public.omes;

CREATE TABLE public.omes (
	id bigserial NOT NULL,
	"name" public.citext NOT NULL,
	acronym public.citext NOT NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	discarded_at timestamp(6) NULL,
	image_link text DEFAULT ''::text NOT NULL,
	CONSTRAINT omes_pkey PRIMARY KEY (id)
);
CREATE INDEX index_omes_on_acronym ON public.omes USING btree (acronym);
CREATE INDEX index_omes_on_discarded_at ON public.omes USING btree (discarded_at);
CREATE UNIQUE INDEX unique_acronym_constraint ON public.omes USING btree (acronym) WHERE (discarded_at IS NULL);


-- public.profiles definição

-- Drop table

-- DROP TABLE public.profiles;

CREATE TABLE public.profiles (
	id bigserial NOT NULL,
	"name" varchar NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT profiles_pkey PRIMARY KEY (id)
);


-- public.schema_migrations definição

-- Drop table

-- DROP TABLE public.schema_migrations;

CREATE TABLE public.schema_migrations (
	"version" varchar NOT NULL,
	CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);


-- public.users definição

-- Drop table

-- DROP TABLE public.users;

CREATE TABLE public.users (
	id bigserial NOT NULL,
	email varchar DEFAULT ''::character varying NOT NULL,
	cpf varchar DEFAULT ''::character varying NOT NULL,
	encrypted_password varchar DEFAULT ''::character varying NOT NULL,
	ome_id int4 DEFAULT 0 NOT NULL,
	reset_password_token varchar NULL,
	reset_password_sent_at timestamp(6) NULL,
	remember_created_at timestamp(6) NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	is_officer bool NULL,
	rank_and_warname varchar NULL,
	registration varchar NULL,
	sgp_ome varchar NULL,
	CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX index_users_on_cpf ON public.users USING btree (cpf);
CREATE UNIQUE INDEX index_users_on_email ON public.users USING btree (email);
CREATE INDEX index_users_on_ome_id ON public.users USING btree (ome_id);
CREATE UNIQUE INDEX index_users_on_reset_password_token ON public.users USING btree (reset_password_token);


-- public.vehicle_destination_types definição

-- Drop table

-- DROP TABLE public.vehicle_destination_types;

CREATE TABLE public.vehicle_destination_types (
	id bigserial NOT NULL,
	"name" public.citext NOT NULL,
	acronym public.citext NOT NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT vehicle_destination_types_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX index_vehicle_destination_types_on_name ON public.vehicle_destination_types USING btree (name);


-- public.vehicle_document_types definição

-- Drop table

-- DROP TABLE public.vehicle_document_types;

CREATE TABLE public.vehicle_document_types (
	id bigserial NOT NULL,
	"name" varchar NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT vehicle_document_types_pkey PRIMARY KEY (id)
);


-- public.vehicle_fuel_types definição

-- Drop table

-- DROP TABLE public.vehicle_fuel_types;

CREATE TABLE public.vehicle_fuel_types (
	id bigserial NOT NULL,
	"name" public.citext NOT NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT vehicle_fuel_types_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX index_vehicle_fuel_types_on_name ON public.vehicle_fuel_types USING btree (name);


-- public.vehicle_maintenance_types definição

-- Drop table

-- DROP TABLE public.vehicle_maintenance_types;

CREATE TABLE public.vehicle_maintenance_types (
	id bigserial NOT NULL,
	"name" varchar NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT vehicle_maintenance_types_pkey PRIMARY KEY (id)
);


-- public.vehicle_observation_types definição

-- Drop table

-- DROP TABLE public.vehicle_observation_types;

CREATE TABLE public.vehicle_observation_types (
	id bigserial NOT NULL,
	"name" varchar NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT vehicle_observation_types_pkey PRIMARY KEY (id)
);


-- public.vehicle_ownership_types definição

-- Drop table

-- DROP TABLE public.vehicle_ownership_types;

CREATE TABLE public.vehicle_ownership_types (
	id bigserial NOT NULL,
	"name" public.citext NOT NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT vehicle_ownership_types_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX index_vehicle_ownership_types_on_name ON public.vehicle_ownership_types USING btree (name);


-- public.vehicle_status_types definição

-- Drop table

-- DROP TABLE public.vehicle_status_types;

CREATE TABLE public.vehicle_status_types (
	id bigserial NOT NULL,
	"name" varchar NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	color varchar DEFAULT '#434343'::character varying NOT NULL,
	still_usable bool DEFAULT true NULL,
	CONSTRAINT vehicle_status_types_pkey PRIMARY KEY (id)
);


-- public.vehicle_types definição

-- Drop table

-- DROP TABLE public.vehicle_types;

CREATE TABLE public.vehicle_types (
	id bigserial NOT NULL,
	"name" public.citext NOT NULL,
	acronym public.citext NOT NULL,
	description varchar NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	is_vessel bool DEFAULT false NULL,
	CONSTRAINT vehicle_types_pkey PRIMARY KEY (id)
);
CREATE INDEX index_vehicle_types_on_acronym ON public.vehicle_types USING btree (acronym);


-- public.active_storage_attachments definição

-- Drop table

-- DROP TABLE public.active_storage_attachments;

CREATE TABLE public.active_storage_attachments (
	id bigserial NOT NULL,
	"name" varchar NOT NULL,
	record_type varchar NOT NULL,
	record_id int8 NOT NULL,
	blob_id int8 NOT NULL,
	created_at timestamp(6) NOT NULL,
	CONSTRAINT active_storage_attachments_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_c3b3935057 FOREIGN KEY (blob_id) REFERENCES public.active_storage_blobs(id)
);
CREATE INDEX index_active_storage_attachments_on_blob_id ON public.active_storage_attachments USING btree (blob_id);
CREATE UNIQUE INDEX index_active_storage_attachments_uniqueness ON public.active_storage_attachments USING btree (record_type, record_id, name, blob_id);


-- public.active_storage_variant_records definição

-- Drop table

-- DROP TABLE public.active_storage_variant_records;

CREATE TABLE public.active_storage_variant_records (
	id bigserial NOT NULL,
	blob_id int8 NOT NULL,
	variation_digest varchar NOT NULL,
	CONSTRAINT active_storage_variant_records_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_993965df05 FOREIGN KEY (blob_id) REFERENCES public.active_storage_blobs(id)
);
CREATE UNIQUE INDEX index_active_storage_variant_records_uniqueness ON public.active_storage_variant_records USING btree (blob_id, variation_digest);


-- public.permissions definição

-- Drop table

-- DROP TABLE public.permissions;

CREATE TABLE public.permissions (
	id bigserial NOT NULL,
	user_id int8 NOT NULL,
	profile_id int8 NULL,
	ome_id int8 NULL,
	author_id int8 NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT permissions_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_051bf45406 FOREIGN KEY (author_id) REFERENCES public.users(id),
	CONSTRAINT fk_rails_e59644711c FOREIGN KEY (ome_id) REFERENCES public.omes(id)
);
CREATE INDEX index_permissions_on_author_id ON public.permissions USING btree (author_id);
CREATE INDEX index_permissions_on_ome_id ON public.permissions USING btree (ome_id);
CREATE INDEX index_permissions_on_profile_id ON public.permissions USING btree (profile_id);
CREATE INDEX index_permissions_on_user_id ON public.permissions USING btree (user_id);


-- public.reports_alerts definição

-- Drop table

-- DROP TABLE public.reports_alerts;

CREATE TABLE public.reports_alerts (
	id bigserial NOT NULL,
	reports_vehicle_id int8 NOT NULL,
	fuel_transaction_id int8 NULL,
	"type" varchar NULL,
	description varchar NULL,
	resolution_user_id int8 NULL,
	resolution_date date NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT reports_alerts_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_3fa61494c0 FOREIGN KEY (resolution_user_id) REFERENCES public.users(id)
);
CREATE INDEX index_reports_alerts_on_fuel_transaction_id ON public.reports_alerts USING btree (fuel_transaction_id);
CREATE INDEX index_reports_alerts_on_reports_vehicle_id ON public.reports_alerts USING btree (reports_vehicle_id);
CREATE INDEX index_reports_alerts_on_resolution_user_id ON public.reports_alerts USING btree (resolution_user_id);
CREATE INDEX index_reports_alerts_on_type ON public.reports_alerts USING btree (type);


-- public.reports_omes definição

-- Drop table

-- DROP TABLE public.reports_omes;

CREATE TABLE public.reports_omes (
	id bigserial NOT NULL,
	ome_id int8 NOT NULL,
	start_date date NOT NULL,
	end_date date NOT NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT reports_omes_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_9fc3a45502 FOREIGN KEY (ome_id) REFERENCES public.omes(id)
);
CREATE INDEX index_reports_omes_on_end_date ON public.reports_omes USING btree (end_date);
CREATE INDEX index_reports_omes_on_ome_id ON public.reports_omes USING btree (ome_id);
CREATE INDEX index_reports_omes_on_start_date ON public.reports_omes USING btree (start_date);


-- public.vehicles definição

-- Drop table

-- DROP TABLE public.vehicles;

CREATE TABLE public.vehicles (
	id bigserial NOT NULL,
	brand varchar NULL,
	model varchar NULL,
	"year" int4 NULL,
	license_plate varchar NULL,
	chassis varchar NULL,
	order_number varchar NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	type_id int8 NULL,
	vehicle_ownership_type_id int8 DEFAULT 1 NOT NULL,
	inclusion_reference_document varchar DEFAULT ''::character varying NOT NULL,
	vehicle_fuel_type_id int8 NULL,
	patrimony varchar NULL,
	renavam varchar NULL,
	seats varchar NULL,
	is_tracked bool NULL,
	is_characterized bool NULL,
	vehicle_destination_type_id int8 NULL,
	license_category_id int8 NULL,
	CONSTRAINT vehicles_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_0fb132b33a FOREIGN KEY (vehicle_destination_type_id) REFERENCES public.vehicle_destination_types(id),
	CONSTRAINT fk_rails_6483761fcd FOREIGN KEY (license_category_id) REFERENCES public.license_categories(id),
	CONSTRAINT fk_rails_a4211f5b0a FOREIGN KEY (type_id) REFERENCES public.vehicle_types(id),
	CONSTRAINT fk_rails_b46e6e79b4 FOREIGN KEY (vehicle_fuel_type_id) REFERENCES public.vehicle_fuel_types(id),
	CONSTRAINT fk_rails_e329cb5195 FOREIGN KEY (vehicle_ownership_type_id) REFERENCES public.vehicle_ownership_types(id)
);
CREATE INDEX index_vehicles_on_license_category_id ON public.vehicles USING btree (license_category_id);
CREATE INDEX index_vehicles_on_type_id ON public.vehicles USING btree (type_id);
CREATE INDEX index_vehicles_on_vehicle_destination_type_id ON public.vehicles USING btree (vehicle_destination_type_id);
CREATE INDEX index_vehicles_on_vehicle_fuel_type_id ON public.vehicles USING btree (vehicle_fuel_type_id);
CREATE INDEX index_vehicles_on_vehicle_ownership_type_id ON public.vehicles USING btree (vehicle_ownership_type_id);


-- public.fuel_transactions definição

-- Drop table

-- DROP TABLE public.fuel_transactions;

CREATE TABLE public.fuel_transactions (
	id bigserial NOT NULL,
	vehicle_id int8 NOT NULL,
	"time" timestamp NOT NULL,
	fuel_type public.citext NULL,
	quantity float8 DEFAULT 0.0 NOT NULL,
	unitary_value float8 DEFAULT 0.0 NOT NULL,
	total_value float8 DEFAULT 0.0 NOT NULL,
	mileage float8 DEFAULT 0.0 NOT NULL,
	external_id int8 NULL,
	creation_source public.citext NULL,
	raw_data jsonb DEFAULT '"{}"'::jsonb NOT NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT fuel_transactions_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_8a9118f9bd FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id)
);
CREATE UNIQUE INDEX index_fuel_transactions_on_external_id_and_creation_source ON public.fuel_transactions USING btree (external_id, creation_source);
CREATE INDEX index_fuel_transactions_on_raw_data ON public.fuel_transactions USING gin (raw_data);
CREATE INDEX index_fuel_transactions_on_time ON public.fuel_transactions USING btree ("time");
CREATE INDEX index_fuel_transactions_on_vehicle_id ON public.fuel_transactions USING btree (vehicle_id);
CREATE UNIQUE INDEX index_fuel_transactions_on_vehicle_id_and_time ON public.fuel_transactions USING btree (vehicle_id, "time");


-- public.reports_vehicles definição

-- Drop table

-- DROP TABLE public.reports_vehicles;

CREATE TABLE public.reports_vehicles (
	id bigserial NOT NULL,
	reports_ome_id int8 NOT NULL,
	vehicle_id int8 NOT NULL,
	fuel_consumption numeric(10, 2) NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT reports_vehicles_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_52d026ac7b FOREIGN KEY (reports_ome_id) REFERENCES public.reports_omes(id),
	CONSTRAINT fk_rails_b0578f8c04 FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id)
);
CREATE INDEX index_reports_vehicles_on_reports_ome_id ON public.reports_vehicles USING btree (reports_ome_id);
CREATE INDEX index_reports_vehicles_on_vehicle_id ON public.reports_vehicles USING btree (vehicle_id);


-- public.transfers definição

-- Drop table

-- DROP TABLE public.transfers;

CREATE TABLE public.transfers (
	id bigserial NOT NULL,
	ome_id int8 NOT NULL,
	vehicle_id int8 NOT NULL,
	transfer_date date NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	reference_document varchar NULL,
	CONSTRAINT transfers_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_329ff5dfa8 FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id),
	CONSTRAINT fk_rails_d3ad001f85 FOREIGN KEY (ome_id) REFERENCES public.omes(id)
);
CREATE INDEX index_transfers_on_ome_id ON public.transfers USING btree (ome_id);
CREATE INDEX index_transfers_on_vehicle_id ON public.transfers USING btree (vehicle_id);
CREATE UNIQUE INDEX index_transfers_on_vehicle_id_and_transfer_date ON public.transfers USING btree (vehicle_id, transfer_date);

-- Table Triggers

create trigger prevent_invalid_transfers before
insert
    or
update
    on
    public.transfers for each row execute function check_transfer_ome();


-- public.vehicle_documents definição

-- Drop table

-- DROP TABLE public.vehicle_documents;

CREATE TABLE public.vehicle_documents (
	id bigserial NOT NULL,
	document_type_id int8 NOT NULL,
	author_id int8 NOT NULL,
	vehicle_id int8 NOT NULL,
	description text NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT vehicle_documents_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_88b5cec300 FOREIGN KEY (author_id) REFERENCES public.users(id),
	CONSTRAINT fk_rails_b805ae55b4 FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id),
	CONSTRAINT fk_rails_e682c5c22e FOREIGN KEY (document_type_id) REFERENCES public.vehicle_document_types(id)
);
CREATE INDEX index_vehicle_documents_on_author_id ON public.vehicle_documents USING btree (author_id);
CREATE INDEX index_vehicle_documents_on_document_type_id ON public.vehicle_documents USING btree (document_type_id);
CREATE INDEX index_vehicle_documents_on_vehicle_id ON public.vehicle_documents USING btree (vehicle_id);


-- public.vehicle_maintenances definição

-- Drop table

-- DROP TABLE public.vehicle_maintenances;

CREATE TABLE public.vehicle_maintenances (
	id bigserial NOT NULL,
	maintenance_type_id int8 NOT NULL,
	author_id int8 NOT NULL,
	vehicle_id int8 NOT NULL,
	description text NULL,
	"cost" float8 NULL,
	reference_document varchar NULL,
	reference_date date NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT vehicle_maintenances_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_3ef0ee882e FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id),
	CONSTRAINT fk_rails_95509ef0a8 FOREIGN KEY (maintenance_type_id) REFERENCES public.vehicle_maintenance_types(id),
	CONSTRAINT fk_rails_d51f01f930 FOREIGN KEY (author_id) REFERENCES public.users(id)
);
CREATE INDEX index_vehicle_maintenances_on_author_id ON public.vehicle_maintenances USING btree (author_id);
CREATE INDEX index_vehicle_maintenances_on_maintenance_type_id ON public.vehicle_maintenances USING btree (maintenance_type_id);
CREATE INDEX index_vehicle_maintenances_on_vehicle_id ON public.vehicle_maintenances USING btree (vehicle_id);


-- public.vehicle_observations definição

-- Drop table

-- DROP TABLE public.vehicle_observations;

CREATE TABLE public.vehicle_observations (
	id bigserial NOT NULL,
	observation_type_id int8 NOT NULL,
	author_id int8 NOT NULL,
	vehicle_id int8 NOT NULL,
	description text NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT vehicle_observations_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_2a06680b8f FOREIGN KEY (author_id) REFERENCES public.users(id),
	CONSTRAINT fk_rails_36f1529c03 FOREIGN KEY (observation_type_id) REFERENCES public.vehicle_observation_types(id),
	CONSTRAINT fk_rails_a66f8fbf17 FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id)
);
CREATE INDEX index_vehicle_observations_on_author_id ON public.vehicle_observations USING btree (author_id);
CREATE INDEX index_vehicle_observations_on_observation_type_id ON public.vehicle_observations USING btree (observation_type_id);
CREATE INDEX index_vehicle_observations_on_vehicle_id ON public.vehicle_observations USING btree (vehicle_id);


-- public.vehicle_statuses definição

-- Drop table

-- DROP TABLE public.vehicle_statuses;

CREATE TABLE public.vehicle_statuses (
	id bigserial NOT NULL,
	status_type_id int8 NOT NULL,
	author_id int8 NOT NULL,
	vehicle_id int8 NOT NULL,
	reference_document varchar NULL,
	reference_date date NULL,
	created_at timestamp(6) NOT NULL,
	updated_at timestamp(6) NOT NULL,
	CONSTRAINT vehicle_statuses_pkey PRIMARY KEY (id),
	CONSTRAINT fk_rails_3416950b85 FOREIGN KEY (author_id) REFERENCES public.users(id),
	CONSTRAINT fk_rails_619a648d76 FOREIGN KEY (status_type_id) REFERENCES public.vehicle_status_types(id),
	CONSTRAINT fk_rails_a5e019f2cb FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id)
);
CREATE INDEX index_vehicle_statuses_on_author_id ON public.vehicle_statuses USING btree (author_id);
CREATE INDEX index_vehicle_statuses_on_status_type_id ON public.vehicle_statuses USING btree (status_type_id);
CREATE INDEX index_vehicle_statuses_on_vehicle_id ON public.vehicle_statuses USING btree (vehicle_id);



-- DROP FUNCTION public.check_transfer_ome();

CREATE OR REPLACE FUNCTION public.check_transfer_ome()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  omes_found integer[];
BEGIN
  WITH ts as (
    (SELECT *
     FROM transfers t
     WHERE t.transfer_date < NEW.transfer_date
       AND t.vehicle_id = NEW.vehicle_id
     ORDER BY t.transfer_date DESC
     LIMIT 1)
    UNION ALL
    (SELECT *
     FROM transfers t
     WHERE t.transfer_date > NEW.transfer_date
       AND t.vehicle_id = NEW.vehicle_id
     ORDER BY t.transfer_date ASC
     LIMIT 1)
  )
  SELECT ARRAY_AGG(ts.ome_id) INTO omes_found
  FROM ts;

  -- A OME destino da nova transferência coincide a transferência anterior ou com a próxima?
  IF NEW.ome_id = ANY(omes_found) THEN
    RAISE EXCEPTION 'Não é possível ter uma transferência para a OME % entre as transferências para as OMEs %', NEW.ome_id, omes_found;
  END IF;

  RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.citext(bpchar);

CREATE OR REPLACE FUNCTION public.citext(character)
 RETURNS citext
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$rtrim1$function$
;

-- DROP FUNCTION public.citext(inet);

CREATE OR REPLACE FUNCTION public.citext(inet)
 RETURNS citext
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$network_show$function$
;

-- DROP FUNCTION public.citext(bool);

CREATE OR REPLACE FUNCTION public.citext(boolean)
 RETURNS citext
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$booltext$function$
;

-- DROP FUNCTION public.citext_cmp(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_cmp(citext, citext)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_cmp$function$
;

-- DROP FUNCTION public.citext_eq(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_eq(citext, citext)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_eq$function$
;

-- DROP FUNCTION public.citext_ge(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_ge(citext, citext)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_ge$function$
;

-- DROP FUNCTION public.citext_gt(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_gt(citext, citext)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_gt$function$
;

-- DROP FUNCTION public.citext_hash(citext);

CREATE OR REPLACE FUNCTION public.citext_hash(citext)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_hash$function$
;

-- DROP FUNCTION public.citext_hash_extended(citext, int8);

CREATE OR REPLACE FUNCTION public.citext_hash_extended(citext, bigint)
 RETURNS bigint
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_hash_extended$function$
;

-- DROP FUNCTION public.citext_larger(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_larger(citext, citext)
 RETURNS citext
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_larger$function$
;

-- DROP FUNCTION public.citext_le(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_le(citext, citext)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_le$function$
;

-- DROP FUNCTION public.citext_lt(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_lt(citext, citext)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_lt$function$
;

-- DROP FUNCTION public.citext_ne(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_ne(citext, citext)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_ne$function$
;

-- DROP FUNCTION public.citext_pattern_cmp(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_pattern_cmp(citext, citext)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_pattern_cmp$function$
;

-- DROP FUNCTION public.citext_pattern_ge(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_pattern_ge(citext, citext)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_pattern_ge$function$
;

-- DROP FUNCTION public.citext_pattern_gt(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_pattern_gt(citext, citext)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_pattern_gt$function$
;

-- DROP FUNCTION public.citext_pattern_le(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_pattern_le(citext, citext)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_pattern_le$function$
;

-- DROP FUNCTION public.citext_pattern_lt(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_pattern_lt(citext, citext)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_pattern_lt$function$
;

-- DROP FUNCTION public.citext_smaller(citext, citext);

CREATE OR REPLACE FUNCTION public.citext_smaller(citext, citext)
 RETURNS citext
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/citext', $function$citext_smaller$function$
;

-- DROP FUNCTION public.citextin(cstring);

CREATE OR REPLACE FUNCTION public.citextin(cstring)
 RETURNS citext
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$textin$function$
;

-- DROP FUNCTION public.citextout(citext);

CREATE OR REPLACE FUNCTION public.citextout(citext)
 RETURNS cstring
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$textout$function$
;

-- DROP FUNCTION public.citextrecv(internal);

CREATE OR REPLACE FUNCTION public.citextrecv(internal)
 RETURNS citext
 LANGUAGE internal
 STABLE PARALLEL SAFE STRICT
AS $function$textrecv$function$
;

-- DROP FUNCTION public.citextsend(citext);

CREATE OR REPLACE FUNCTION public.citextsend(citext)
 RETURNS bytea
 LANGUAGE internal
 STABLE PARALLEL SAFE STRICT
AS $function$textsend$function$
;

-- DROP AGGREGATE public.max(citext);

CREATE OR REPLACE AGGREGATE public.max(public.citext) (
	SFUNC = citext_larger,
	STYPE = citext,
	SORTOP = >
);

-- DROP AGGREGATE public.min(citext);

CREATE OR REPLACE AGGREGATE public.min(public.citext) (
	SFUNC = citext_smaller,
	STYPE = citext,
	SORTOP = <
);

-- DROP FUNCTION public.regexp_match(citext, citext);

CREATE OR REPLACE FUNCTION public.regexp_match(citext, citext)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT pg_catalog.regexp_match( $1::pg_catalog.text, $2::pg_catalog.text, 'i' );
$function$
;

-- DROP FUNCTION public.regexp_match(citext, citext, text);

CREATE OR REPLACE FUNCTION public.regexp_match(citext, citext, text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT pg_catalog.regexp_match( $1::pg_catalog.text, $2::pg_catalog.text, CASE WHEN pg_catalog.strpos($3, 'c') = 0 THEN  $3 || 'i' ELSE $3 END );
$function$
;

-- DROP FUNCTION public.regexp_matches(citext, citext);

CREATE OR REPLACE FUNCTION public.regexp_matches(citext, citext)
 RETURNS SETOF text[]
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT ROWS 1
AS $function$
    SELECT pg_catalog.regexp_matches( $1::pg_catalog.text, $2::pg_catalog.text, 'i' );
$function$
;

-- DROP FUNCTION public.regexp_matches(citext, citext, text);

CREATE OR REPLACE FUNCTION public.regexp_matches(citext, citext, text)
 RETURNS SETOF text[]
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT ROWS 10
AS $function$
    SELECT pg_catalog.regexp_matches( $1::pg_catalog.text, $2::pg_catalog.text, CASE WHEN pg_catalog.strpos($3, 'c') = 0 THEN  $3 || 'i' ELSE $3 END );
$function$
;

-- DROP FUNCTION public.regexp_replace(citext, citext, text);

CREATE OR REPLACE FUNCTION public.regexp_replace(citext, citext, text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT pg_catalog.regexp_replace( $1::pg_catalog.text, $2::pg_catalog.text, $3, 'i');
$function$
;

-- DROP FUNCTION public.regexp_replace(citext, citext, text, text);

CREATE OR REPLACE FUNCTION public.regexp_replace(citext, citext, text, text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT pg_catalog.regexp_replace( $1::pg_catalog.text, $2::pg_catalog.text, $3, CASE WHEN pg_catalog.strpos($4, 'c') = 0 THEN  $4 || 'i' ELSE $4 END);
$function$
;

-- DROP FUNCTION public.regexp_split_to_array(citext, citext);

CREATE OR REPLACE FUNCTION public.regexp_split_to_array(citext, citext)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT pg_catalog.regexp_split_to_array( $1::pg_catalog.text, $2::pg_catalog.text, 'i' );
$function$
;

-- DROP FUNCTION public.regexp_split_to_array(citext, citext, text);

CREATE OR REPLACE FUNCTION public.regexp_split_to_array(citext, citext, text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT pg_catalog.regexp_split_to_array( $1::pg_catalog.text, $2::pg_catalog.text, CASE WHEN pg_catalog.strpos($3, 'c') = 0 THEN  $3 || 'i' ELSE $3 END );
$function$
;

-- DROP FUNCTION public.regexp_split_to_table(citext, citext);

CREATE OR REPLACE FUNCTION public.regexp_split_to_table(citext, citext)
 RETURNS SETOF text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT pg_catalog.regexp_split_to_table( $1::pg_catalog.text, $2::pg_catalog.text, 'i' );
$function$
;

-- DROP FUNCTION public.regexp_split_to_table(citext, citext, text);

CREATE OR REPLACE FUNCTION public.regexp_split_to_table(citext, citext, text)
 RETURNS SETOF text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT pg_catalog.regexp_split_to_table( $1::pg_catalog.text, $2::pg_catalog.text, CASE WHEN pg_catalog.strpos($3, 'c') = 0 THEN  $3 || 'i' ELSE $3 END );
$function$
;

-- DROP FUNCTION public."replace"(citext, citext, citext);

CREATE OR REPLACE FUNCTION public.replace(citext, citext, citext)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT pg_catalog.regexp_replace( $1::pg_catalog.text, pg_catalog.regexp_replace($2::pg_catalog.text, '([^a-zA-Z_0-9])', E'\\\\\\1', 'g'), $3::pg_catalog.text, 'gi' );
$function$
;

-- DROP FUNCTION public.split_part(citext, citext, int4);

CREATE OR REPLACE FUNCTION public.split_part(citext, citext, integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT (pg_catalog.regexp_split_to_array( $1::pg_catalog.text, pg_catalog.regexp_replace($2::pg_catalog.text, '([^a-zA-Z_0-9])', E'\\\\\\1', 'g'), 'i'))[$3];
$function$
;

-- DROP FUNCTION public.strpos(citext, citext);

CREATE OR REPLACE FUNCTION public.strpos(citext, citext)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT pg_catalog.strpos( pg_catalog.lower( $1::pg_catalog.text ), pg_catalog.lower( $2::pg_catalog.text ) );
$function$
;

-- DROP FUNCTION public.texticlike(citext, text);

CREATE OR REPLACE FUNCTION public.texticlike(citext, text)
 RETURNS boolean
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$texticlike$function$
;

-- DROP FUNCTION public.texticlike(citext, citext);

CREATE OR REPLACE FUNCTION public.texticlike(citext, citext)
 RETURNS boolean
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$texticlike$function$
;

-- DROP FUNCTION public.texticnlike(citext, citext);

CREATE OR REPLACE FUNCTION public.texticnlike(citext, citext)
 RETURNS boolean
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$texticnlike$function$
;

-- DROP FUNCTION public.texticnlike(citext, text);

CREATE OR REPLACE FUNCTION public.texticnlike(citext, text)
 RETURNS boolean
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$texticnlike$function$
;

-- DROP FUNCTION public.texticregexeq(citext, citext);

CREATE OR REPLACE FUNCTION public.texticregexeq(citext, citext)
 RETURNS boolean
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$texticregexeq$function$
;

-- DROP FUNCTION public.texticregexeq(citext, text);

CREATE OR REPLACE FUNCTION public.texticregexeq(citext, text)
 RETURNS boolean
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$texticregexeq$function$
;

-- DROP FUNCTION public.texticregexne(citext, text);

CREATE OR REPLACE FUNCTION public.texticregexne(citext, text)
 RETURNS boolean
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$texticregexne$function$
;

-- DROP FUNCTION public.texticregexne(citext, citext);

CREATE OR REPLACE FUNCTION public.texticregexne(citext, citext)
 RETURNS boolean
 LANGUAGE internal
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$texticregexne$function$
;

-- DROP FUNCTION public."translate"(citext, citext, text);

CREATE OR REPLACE FUNCTION public.translate(citext, citext, text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT pg_catalog.translate( pg_catalog.translate( $1::pg_catalog.text, pg_catalog.lower($2::pg_catalog.text), $3), pg_catalog.upper($2::pg_catalog.text), $3);
$function$
;