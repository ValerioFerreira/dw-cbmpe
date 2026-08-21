-- DROP SCHEMA ovrsgp;

CREATE SCHEMA ovrsgp AUTHORIZATION postgres;

-- DROP SEQUENCE ovrsgp.sq_afast;

CREATE SEQUENCE ovrsgp.sq_afast
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_agreg;

CREATE SEQUENCE ovrsgp.sq_agreg
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_banco;

CREATE SEQUENCE ovrsgp.sq_banco
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_cargo;

CREATE SEQUENCE ovrsgp.sq_cargo
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_cart;

CREATE SEQUENCE ovrsgp.sq_cart
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_categ_cnh;

CREATE SEQUENCE ovrsgp.sq_categ_cnh
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_clasf_curso;

CREATE SEQUENCE ovrsgp.sq_clasf_curso
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_cntt;

CREATE SEQUENCE ovrsgp.sq_cntt
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_cor_olho;

CREATE SEQUENCE ovrsgp.sq_cor_olho
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_cor_pele;

CREATE SEQUENCE ovrsgp.sq_cor_pele
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_curso;

CREATE SEQUENCE ovrsgp.sq_curso
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_depen;

CREATE SEQUENCE ovrsgp.sq_depen
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_docm;

CREATE SEQUENCE ovrsgp.sq_docm
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_fator_sang;

CREATE SEQUENCE ovrsgp.sq_fator_sang
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_func;

CREATE SEQUENCE ovrsgp.sq_func
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_inatv;

CREATE SEQUENCE ovrsgp.sq_inatv
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_inst_educ;

CREATE SEQUENCE ovrsgp.sq_inst_educ
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_mao_uso;

CREATE SEQUENCE ovrsgp.sq_mao_uso
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_movim;

CREATE SEQUENCE ovrsgp.sq_movim
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_mtvo_adido;

CREATE SEQUENCE ovrsgp.sq_mtvo_adido
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_mtvo_inatv;

CREATE SEQUENCE ovrsgp.sq_mtvo_inatv
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_ome;

CREATE SEQUENCE ovrsgp.sq_ome
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_ome_cntt;

CREATE SEQUENCE ovrsgp.sq_ome_cntt
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_pess;

CREATE SEQUENCE ovrsgp.sq_pess
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_prom;

CREATE SEQUENCE ovrsgp.sq_prom
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_qdro;

CREATE SEQUENCE ovrsgp.sq_qdro
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_secao;

CREATE SEQUENCE ovrsgp.sq_secao
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_stat_curso;

CREATE SEQUENCE ovrsgp.sq_stat_curso
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_afast;

CREATE SEQUENCE ovrsgp.sq_tipo_afast
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_cabe;

CREATE SEQUENCE ovrsgp.sq_tipo_cabe
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_cnta_banco;

CREATE SEQUENCE ovrsgp.sq_tipo_cnta_banco
	INCREMENT BY 1
	MINVALUE 0
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_curso;

CREATE SEQUENCE ovrsgp.sq_tipo_curso
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_docm;

CREATE SEQUENCE ovrsgp.sq_tipo_docm
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_esco;

CREATE SEQUENCE ovrsgp.sq_tipo_esco
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_estd_civl;

CREATE SEQUENCE ovrsgp.sq_tipo_estd_civl
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_func;

CREATE SEQUENCE ovrsgp.sq_tipo_func
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_paren;

CREATE SEQUENCE ovrsgp.sq_tipo_paren
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_pess;

CREATE SEQUENCE ovrsgp.sq_tipo_pess
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_prom;

CREATE SEQUENCE ovrsgp.sq_tipo_prom
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_relig;

CREATE SEQUENCE ovrsgp.sq_tipo_relig
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_tipo_sang;

CREATE SEQUENCE ovrsgp.sq_tipo_sang
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;
-- DROP SEQUENCE ovrsgp.sq_unid_extrn;

CREATE SEQUENCE ovrsgp.sq_unid_extrn
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;-- ovrsgp.tb_banco definição

-- Drop table

-- DROP TABLE ovrsgp.tb_banco;

CREATE TABLE ovrsgp.tb_banco (
	id_banco numeric NOT NULL,
	nm_banco varchar(255) NOT NULL,
	nr_cod_banco varchar(20) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_banco PRIMARY KEY (id_banco),
	CONSTRAINT un_banco_001 UNIQUE (nm_banco),
	CONSTRAINT un_banco_002 UNIQUE (nr_cod_banco)
);


-- ovrsgp.tb_categ_cnh definição

-- Drop table

-- DROP TABLE ovrsgp.tb_categ_cnh;

CREATE TABLE ovrsgp.tb_categ_cnh (
	id_categ_cnh numeric NOT NULL,
	ds_categ_cnh varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_categ_cnh PRIMARY KEY (id_categ_cnh),
	CONSTRAINT un_categ_cnh_001 UNIQUE (ds_categ_cnh)
);


-- ovrsgp.tb_clasf_curso definição

-- Drop table

-- DROP TABLE ovrsgp.tb_clasf_curso;

CREATE TABLE ovrsgp.tb_clasf_curso (
	id_clasf_curso numeric NOT NULL,
	ds_clasf_curso varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_clasf_curso PRIMARY KEY (id_clasf_curso),
	CONSTRAINT un_clasf_curso_001 UNIQUE (ds_clasf_curso)
);


-- ovrsgp.tb_cor_olho definição

-- Drop table

-- DROP TABLE ovrsgp.tb_cor_olho;

CREATE TABLE ovrsgp.tb_cor_olho (
	id_cor_olho numeric NOT NULL,
	ds_cor_olho varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_cores_olhos PRIMARY KEY (id_cor_olho),
	CONSTRAINT un_cor_olho_001 UNIQUE (ds_cor_olho)
);


-- ovrsgp.tb_cor_pele definição

-- Drop table

-- DROP TABLE ovrsgp.tb_cor_pele;

CREATE TABLE ovrsgp.tb_cor_pele (
	id_cor_pele numeric NOT NULL,
	ds_cor_pele varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_cor_pele PRIMARY KEY (id_cor_pele),
	CONSTRAINT un_cor_pele_001 UNIQUE (ds_cor_pele)
);


-- ovrsgp.tb_fator_sang definição

-- Drop table

-- DROP TABLE ovrsgp.tb_fator_sang;

CREATE TABLE ovrsgp.tb_fator_sang (
	id_fator_sang numeric NOT NULL,
	ds_fator_sang varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_fator_sang PRIMARY KEY (id_fator_sang),
	CONSTRAINT un_fator_sang_001 UNIQUE (ds_fator_sang)
);


-- ovrsgp.tb_inst_educ definição

-- Drop table

-- DROP TABLE ovrsgp.tb_inst_educ;

CREATE TABLE ovrsgp.tb_inst_educ (
	id_inst_educ numeric NOT NULL,
	nm_inst varchar(255) NOT NULL,
	sg_inst varchar(255) NULL,
	nr_cnpj_inst varchar(20) NULL,
	en_inst varchar(255) NULL,
	en_nr_inst varchar(20) NULL,
	en_bair_inst varchar(255) NULL,
	en_cidd_inst varchar(255) NULL,
	en_uf_inst bpchar(2) NULL,
	en_compl_inst varchar(255) NULL,
	nr_telef_inst varchar(20) NULL,
	en_email_inst varchar(255) NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_inst_educ PRIMARY KEY (id_inst_educ),
	CONSTRAINT un_inst_educ_001 UNIQUE (nm_inst)
);


-- ovrsgp.tb_mao_uso definição

-- Drop table

-- DROP TABLE ovrsgp.tb_mao_uso;

CREATE TABLE ovrsgp.tb_mao_uso (
	id_mao_uso numeric NOT NULL,
	ds_mao_uso varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_mao_uso PRIMARY KEY (id_mao_uso),
	CONSTRAINT un_mao_uso_001 UNIQUE (ds_mao_uso)
);


-- ovrsgp.tb_mtvo_adido definição

-- Drop table

-- DROP TABLE ovrsgp.tb_mtvo_adido;

CREATE TABLE ovrsgp.tb_mtvo_adido (
	id_mtvo_adido numeric NOT NULL,
	ds_mtvo_adido varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_mtvo_adido PRIMARY KEY (id_mtvo_adido),
	CONSTRAINT un_mtvo_adido_001 UNIQUE (ds_mtvo_adido)
);


-- ovrsgp.tb_mtvo_inatv definição

-- Drop table

-- DROP TABLE ovrsgp.tb_mtvo_inatv;

CREATE TABLE ovrsgp.tb_mtvo_inatv (
	id_mtvo_inatv numeric NOT NULL,
	ds_mtvo_inatv varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_mtvo_inatv PRIMARY KEY (id_mtvo_inatv),
	CONSTRAINT un_mtvo_inatv_001 UNIQUE (ds_mtvo_inatv)
);


-- ovrsgp.tb_pess_bkp definição

-- Drop table

-- DROP TABLE ovrsgp.tb_pess_bkp;

CREATE TABLE ovrsgp.tb_pess_bkp (
	id_pess numeric NOT NULL,
	nr_matr_pess varchar(20) NULL,
	nm_pess varchar(255) NULL,
	nm_guerr varchar(255) NULL,
	ic_sexo bpchar(1) NULL,
	dt_nasc date NOT NULL,
	id_tipo_relig_fk numeric NOT NULL,
	id_tipo_estd_civl_fk numeric NOT NULL,
	id_tipo_esco_fk numeric NOT NULL,
	id_tipo_pess_fk numeric NOT NULL,
	nr_cpf_pess varchar(20) NULL,
	nr_rg_milit varchar(20) NULL,
	ds_orga_rg_milit varchar(60) NULL,
	sg_uf_rg_milit bpchar(2) NULL,
	dt_valid_rg_milit date NOT NULL,
	dt_expd_rg_milit date NOT NULL,
	nr_rg_civl varchar(20) NULL,
	ds_orga_rg_civl varchar(60) NULL,
	sg_uf_rg_civl bpchar(2) NULL,
	dt_expd_rg_civl date NULL,
	nr_titu_eleit varchar(20) NULL,
	ds_zona_titu_eleit varchar(20) NULL,
	ds_secao_titu_eleit varchar(20) NULL,
	sg_uf_titu_eleit bpchar(2) NULL,
	nr_reser varchar(20) NULL,
	nr_serie_reser varchar(20) NULL,
	ds_tipo_reser varchar(50) NULL,
	ds_regia_milit_reser varchar(50) NULL,
	ds_categ_reser varchar(50) NULL,
	nr_via_reser varchar(10) NULL,
	nr_pis_pasep varchar(20) NULL,
	tp_pis_pasep varchar(50) NULL,
	id_categ_cnh_fk numeric NULL,
	nr_cnh varchar(20) NULL,
	sg_uf_cnh bpchar(2) NULL,
	dt_valid_cnh date NULL,
	dt_prim_cnh date NULL,
	dt_emisa_cnh date NULL,
	nr_pasp varchar(20) NULL,
	ds_pais_orige_pasp varchar(50) NULL,
	dt_emisa_pasp date NULL,
	dt_venc_pasp date NULL,
	nr_cart_profn varchar(20) NULL,
	nr_serie_cart_profn varchar(20) NULL,
	sg_uf_cart_profn bpchar(2) NULL,
	dt_expd_cart_profn date NULL,
	nr_cart_profn_liber varchar(20) NULL,
	ds_orga_cart_profn_liber varchar(50) NULL,
	ds_regia_cart_profn_liber varchar(50) NULL,
	nr_regis_embac varchar(20) NULL,
	dt_valid_regis_embac date NULL,
	ds_orga_exped_regis_embac varchar(20) NULL,
	nr_regis_aero varchar(20) NULL,
	dt_valid_regis_aero date NULL,
	ds_orga_exped_regis_aero varchar(50) NULL,
	en_pess varchar(255) NULL,
	en_nr_pess varchar(20) NULL,
	en_bair_pess varchar(255) NULL,
	en_cidd_pess varchar(255) NULL,
	en_uf_pess bpchar(2) NULL,
	en_cep_pess varchar(15) NULL,
	en_compl_pess varchar(255) NULL,
	en_pont_refer varchar(255) NULL,
	nm_gntr varchar(255) NULL,
	nm_gntra varchar(255) NULL,
	ds_nacn_pess varchar(255) NULL,
	ds_natur_pess varchar(255) NULL,
	sg_uf_natur bpchar(2) NULL,
	id_cor_pele_fk numeric NOT NULL,
	id_tipo_cabe_fk numeric NOT NULL,
	id_cor_olho_esqr_fk numeric NOT NULL,
	id_cor_olho_dirt_fk numeric NOT NULL,
	nr_altu_pess numeric(10, 2) NULL,
	nr_peso_pess numeric(10, 3) NULL,
	ds_tama_cint varchar(20) NULL,
	ds_tama_busto varchar(20) NULL,
	ds_tama_cabc varchar(255) NULL,
	ds_tama_calc varchar(255) NULL,
	ds_tama_cotur varchar(20) NULL,
	ds_tama_cami varchar(20) NULL,
	ds_tama_calca varchar(20) NULL,
	ds_tama_clcao varchar(20) NULL,
	ds_tama_busti varchar(20) NULL,
	ds_tama_maio varchar(20) NULL,
	ds_tama_sunga varchar(20) NULL,
	id_mao_uso_fk numeric NOT NULL,
	id_tipo_sang_fk numeric NOT NULL,
	id_fator_sang_fk numeric NOT NULL,
	ds_obsv_imun varchar(500) NULL,
	ds_ates_acid varchar(255) NULL,
	ds_ates_acid_sanit varchar(255) NULL,
	ds_doen_cron varchar(255) NULL,
	ds_remed_contr varchar(255) NULL,
	ds_alerg varchar(255) NULL,
	ds_foto_pess varchar(255) NULL,
	ds_assin_pess varchar(255) NULL,
	ds_digit_pess varchar(255) NULL,
	ds_fator_digit varchar(255) NULL,
	ds_poleg_dirt varchar(255) NULL,
	ds_indic_dirt varchar(255) NULL,
	ds_medio_dirt varchar(255) NULL,
	ds_anul_dirt varchar(255) NULL,
	ds_mini_dirt varchar(255) NULL,
	ds_poleg_esqr varchar(255) NULL,
	ds_indic_esqr varchar(255) NULL,
	ds_medio_esqr varchar(255) NULL,
	ds_anul_esqr varchar(255) NULL,
	ds_mini_esqr varchar(255) NULL,
	ic_doad_orga bpchar(1) NULL,
	ic_doad_sague bpchar(1) NULL,
	ic_socio_cas bpchar(1) NULL,
	ic_socio_simepe bpchar(1) NULL,
	ic_imun bpchar(1) NULL,
	ic_acid bpchar(1) NULL,
	ic_acid_sanit bpchar(1) NULL,
	ic_alerg bpchar(1) NULL,
	ic_remed_contr bpchar(1) NULL,
	ic_doen_cron bpchar(1) NULL,
	ic_sitc_pess bpchar(1) NULL,
	id_mtvo_adido_fk numeric NULL,
	ic_tipo_adido bpchar(1) NULL,
	id_unid_extrn_fk numeric NULL,
	ds_obsv_adido varchar(500) NULL,
	dt_ingrs date NULL,
	ic_pend_movim bpchar(1) NULL,
	ic_pend_prom bpchar(1) NULL,
	ic_pend_func bpchar(1) NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL
);


-- ovrsgp.tb_qdro definição

-- Drop table

-- DROP TABLE ovrsgp.tb_qdro;

CREATE TABLE ovrsgp.tb_qdro (
	id_qdro numeric NOT NULL,
	ds_qdro varchar(255) NOT NULL,
	ic_stat bpchar(1) NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_qdro PRIMARY KEY (id_qdro)
);
CREATE INDEX in_qdro_001 ON ovrsgp.tb_qdro USING btree (ic_stat);


-- ovrsgp.tb_stat_curso definição

-- Drop table

-- DROP TABLE ovrsgp.tb_stat_curso;

CREATE TABLE ovrsgp.tb_stat_curso (
	id_stat_curso numeric NOT NULL,
	ds_stat_curso varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_stat_curso PRIMARY KEY (id_stat_curso),
	CONSTRAINT un_stat_curso_001 UNIQUE (ds_stat_curso)
);


-- ovrsgp.tb_tipo_afast definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_afast;

CREATE TABLE ovrsgp.tb_tipo_afast (
	id_tipo_afast numeric NOT NULL,
	ds_tipo_afast varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_afast PRIMARY KEY (id_tipo_afast),
	CONSTRAINT un_tipo_afast_001 UNIQUE (ds_tipo_afast)
);


-- ovrsgp.tb_tipo_cabe definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_cabe;

CREATE TABLE ovrsgp.tb_tipo_cabe (
	id_tipo_cabe numeric NOT NULL,
	ds_tipo_cabe varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_cabe PRIMARY KEY (id_tipo_cabe),
	CONSTRAINT un_tipo_cabe_001 UNIQUE (ds_tipo_cabe)
);


-- ovrsgp.tb_tipo_cnta_banco definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_cnta_banco;

CREATE TABLE ovrsgp.tb_tipo_cnta_banco (
	id_tipo_cnta_banco numeric NOT NULL,
	ds_tipo_cnta_banco varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_cnta_banco PRIMARY KEY (id_tipo_cnta_banco),
	CONSTRAINT un_tipo_cnta_banco_001 UNIQUE (ds_tipo_cnta_banco)
);


-- ovrsgp.tb_tipo_curso definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_curso;

CREATE TABLE ovrsgp.tb_tipo_curso (
	id_tipo_curso numeric NOT NULL,
	ds_tipo_curso varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_curso PRIMARY KEY (id_tipo_curso),
	CONSTRAINT un_tipo_curso_001 UNIQUE (ds_tipo_curso)
);


-- ovrsgp.tb_tipo_docm definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_docm;

CREATE TABLE ovrsgp.tb_tipo_docm (
	id_tipo_docm numeric NOT NULL,
	ds_tipo_docm varchar(255) NOT NULL,
	sg_tipo_docm varchar(255) NULL,
	ic_stat bpchar(1) NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_docm PRIMARY KEY (id_tipo_docm),
	CONSTRAINT un_tipo_docm_001 UNIQUE (ds_tipo_docm)
);
CREATE INDEX in_tipo_docm_001 ON ovrsgp.tb_tipo_docm USING btree (ic_stat);


-- ovrsgp.tb_tipo_esco definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_esco;

CREATE TABLE ovrsgp.tb_tipo_esco (
	id_tipo_esco numeric NOT NULL,
	ds_tipo_esco varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_esco PRIMARY KEY (id_tipo_esco),
	CONSTRAINT un_tipo_esco_001 UNIQUE (ds_tipo_esco)
);


-- ovrsgp.tb_tipo_estd_civl definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_estd_civl;

CREATE TABLE ovrsgp.tb_tipo_estd_civl (
	id_tipo_estd_civl numeric NOT NULL,
	ds_tipo_estd_civl varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_estd_civl PRIMARY KEY (id_tipo_estd_civl),
	CONSTRAINT un_tipo_estd_civl_001 UNIQUE (ds_tipo_estd_civl)
);


-- ovrsgp.tb_tipo_func definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_func;

CREATE TABLE ovrsgp.tb_tipo_func (
	id_tipo_func numeric NOT NULL,
	ds_tipo_func varchar(255) NOT NULL,
	ic_tipo_atvd numeric NOT NULL,
	ic_stat bpchar(1) NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_func PRIMARY KEY (id_tipo_func),
	CONSTRAINT un_tipo_func_001 UNIQUE (ds_tipo_func)
);
CREATE INDEX in_tipo_func_001 ON ovrsgp.tb_tipo_func USING btree (ic_tipo_atvd);
CREATE INDEX in_tipo_func_002 ON ovrsgp.tb_tipo_func USING btree (ic_stat);


-- ovrsgp.tb_tipo_paren definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_paren;

CREATE TABLE ovrsgp.tb_tipo_paren (
	id_tipo_paren numeric NOT NULL,
	ds_tipo_paren varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_paren PRIMARY KEY (id_tipo_paren),
	CONSTRAINT un_tipo_paren_001 UNIQUE (ds_tipo_paren)
);


-- ovrsgp.tb_tipo_pess definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_pess;

CREATE TABLE ovrsgp.tb_tipo_pess (
	id_tipo_pess numeric NOT NULL,
	ds_tipo_pess varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_pess PRIMARY KEY (id_tipo_pess),
	CONSTRAINT un_tipo_pess_001 UNIQUE (ds_tipo_pess)
);


-- ovrsgp.tb_tipo_prom definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_prom;

CREATE TABLE ovrsgp.tb_tipo_prom (
	id_tipo_prom numeric NOT NULL,
	ds_tipo_prom varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_prom PRIMARY KEY (id_tipo_prom),
	CONSTRAINT un_tipo_prom_001 UNIQUE (ds_tipo_prom)
);


-- ovrsgp.tb_tipo_relig definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_relig;

CREATE TABLE ovrsgp.tb_tipo_relig (
	id_tipo_relig numeric NOT NULL,
	ds_tipo_relig varchar(255) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_relig PRIMARY KEY (id_tipo_relig),
	CONSTRAINT un_tipo_relig_001 UNIQUE (ds_tipo_relig)
);


-- ovrsgp.tb_tipo_sang definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_sang;

CREATE TABLE ovrsgp.tb_tipo_sang (
	id_tipo_sang numeric NOT NULL,
	ds_tipo_sang varchar(255) NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	ic_stat bpchar(1) NULL,
	CONSTRAINT pk_tipo_sang PRIMARY KEY (id_tipo_sang),
	CONSTRAINT un_tipo_sang_001 UNIQUE (ds_tipo_sang)
);


-- ovrsgp.tb_unid_extrn definição

-- Drop table

-- DROP TABLE ovrsgp.tb_unid_extrn;

CREATE TABLE ovrsgp.tb_unid_extrn (
	id_unid_extrn numeric NOT NULL,
	ds_unid_extrn varchar(255) NOT NULL,
	sg_unid_extrn varchar(50) NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_unid_extrn PRIMARY KEY (id_unid_extrn),
	CONSTRAINT un_unid_extrn_001 UNIQUE (ds_unid_extrn)
);


-- ovrsgp.tmp_movim_importacao definição

-- Drop table

-- DROP TABLE ovrsgp.tmp_movim_importacao;

CREATE TABLE ovrsgp.tmp_movim_importacao (
	matricula varchar NULL,
	numero_doe varchar NULL,
	data_doe varchar NULL
);


-- ovrsgp.tb_cargo definição

-- Drop table

-- DROP TABLE ovrsgp.tb_cargo;

CREATE TABLE ovrsgp.tb_cargo (
	id_cargo numeric NOT NULL,
	id_cargo_fk numeric NULL,
	ds_hiera_cargo varchar(255) NOT NULL,
	ds_cargo varchar(255) NOT NULL,
	sg_cargo varchar(255) NULL,
	ic_stat bpchar(1) NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_cargo PRIMARY KEY (id_cargo),
	CONSTRAINT un_cargo_001 UNIQUE (ds_hiera_cargo),
	CONSTRAINT un_cargo_002 UNIQUE (ds_cargo),
	CONSTRAINT fk_cargo_001 FOREIGN KEY (id_cargo_fk) REFERENCES ovrsgp.tb_cargo(id_cargo)
);
CREATE INDEX in_cargo_001 ON ovrsgp.tb_cargo USING btree (ic_stat);
CREATE INDEX in_cargo_002 ON ovrsgp.tb_cargo USING btree (id_cargo_fk);


-- ovrsgp.tb_ome definição

-- Drop table

-- DROP TABLE ovrsgp.tb_ome;

CREATE TABLE ovrsgp.tb_ome (
	id_ome numeric NOT NULL,
	id_ome_fk numeric NULL,
	ds_hiera_ome varchar(50) NOT NULL,
	nr_nivel_ome numeric NOT NULL,
	nm_ome varchar(255) NOT NULL,
	sg_ome varchar(100) NULL,
	en_ome varchar(255) NULL,
	en_nr_ome varchar(30) NULL,
	en_bair_ome varchar(255) NULL,
	en_cidd_ome varchar(255) NULL,
	en_uf_ome bpchar(2) NULL,
	en_cep_ome varchar(20) NULL,
	en_compl_ome varchar(255) NULL,
	en_pont_refer varchar(255) NULL,
	en_url varchar(255) NULL,
	ic_tipo bpchar(2) NOT NULL,
	nr_latd numeric(20, 10) NULL,
	nr_long numeric(20, 10) NULL,
	ic_stat bpchar(1) NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_ome PRIMARY KEY (id_ome),
	CONSTRAINT un_ome_002 UNIQUE (nm_ome),
	CONSTRAINT fk_ome_001 FOREIGN KEY (id_ome_fk) REFERENCES ovrsgp.tb_ome(id_ome)
);
CREATE INDEX in_ome_001 ON ovrsgp.tb_ome USING btree (ic_tipo);
CREATE INDEX in_ome_002 ON ovrsgp.tb_ome USING btree (ic_stat);
CREATE INDEX in_ome_003 ON ovrsgp.tb_ome USING btree (id_ome_fk);


-- ovrsgp.tb_ome_cntt definição

-- Drop table

-- DROP TABLE ovrsgp.tb_ome_cntt;

CREATE TABLE ovrsgp.tb_ome_cntt (
	id_ome_cntt numeric NOT NULL,
	id_ome_fk numeric NOT NULL,
	ic_tipo bpchar(2) NOT NULL,
	ds_cntt varchar(255) NOT NULL,
	ds_obsv_cntt varchar(255) NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_ome_cntt PRIMARY KEY (id_ome_cntt),
	CONSTRAINT fk_ome_cntt_001 FOREIGN KEY (id_ome_fk) REFERENCES ovrsgp.tb_ome(id_ome)
);
CREATE INDEX in_ome_cntt_001 ON ovrsgp.tb_ome_cntt USING btree (ic_tipo);
CREATE INDEX in_ome_cntt_002 ON ovrsgp.tb_ome_cntt USING btree (id_ome_fk);


-- ovrsgp.tb_pess definição

-- Drop table

-- DROP TABLE ovrsgp.tb_pess;

CREATE TABLE ovrsgp.tb_pess (
	id_pess numeric NOT NULL,
	nr_matr_pess varchar(20) NOT NULL,
	nm_pess varchar(255) NOT NULL,
	nm_guerr varchar(255) NOT NULL,
	ic_sexo bpchar(1) NOT NULL,
	dt_nasc date NOT NULL,
	id_tipo_relig_fk numeric NOT NULL,
	id_tipo_estd_civl_fk numeric NOT NULL,
	id_tipo_esco_fk numeric NOT NULL,
	id_tipo_pess_fk numeric NOT NULL,
	nr_cpf_pess varchar(20) NOT NULL,
	nr_rg_milit varchar(20) NOT NULL,
	ds_orga_rg_milit varchar(60) NOT NULL,
	sg_uf_rg_milit bpchar(2) NOT NULL,
	dt_valid_rg_milit date NOT NULL,
	dt_expd_rg_milit date NOT NULL,
	nr_rg_civl varchar(20) NULL,
	ds_orga_rg_civl varchar(60) NULL,
	sg_uf_rg_civl bpchar(2) NULL,
	dt_expd_rg_civl date NULL,
	nr_titu_eleit varchar(20) NOT NULL,
	ds_zona_titu_eleit varchar(20) NOT NULL,
	ds_secao_titu_eleit varchar(20) NOT NULL,
	sg_uf_titu_eleit bpchar(2) NOT NULL,
	nr_reser varchar(20) NULL,
	nr_serie_reser varchar(20) NULL,
	ds_tipo_reser varchar(50) NULL,
	ds_regia_milit_reser varchar(50) NULL,
	ds_categ_reser varchar(50) NULL,
	nr_via_reser varchar(10) NULL,
	nr_pis_pasep varchar(20) NULL,
	tp_pis_pasep varchar(50) NULL,
	id_categ_cnh_fk numeric NULL,
	nr_cnh varchar(20) NULL,
	sg_uf_cnh bpchar(2) NULL,
	dt_valid_cnh date NULL,
	dt_prim_cnh date NULL,
	dt_emisa_cnh date NULL,
	nr_pasp varchar(20) NULL,
	ds_pais_orige_pasp varchar(50) NULL,
	dt_emisa_pasp date NULL,
	dt_venc_pasp date NULL,
	nr_cart_profn varchar(20) NULL,
	nr_serie_cart_profn varchar(20) NULL,
	sg_uf_cart_profn bpchar(2) NULL,
	dt_expd_cart_profn date NULL,
	nr_cart_profn_liber varchar(20) NULL,
	ds_orga_cart_profn_liber varchar(50) NULL,
	ds_regia_cart_profn_liber varchar(50) NULL,
	nr_regis_embac varchar(20) NULL,
	dt_valid_regis_embac date NULL,
	ds_orga_exped_regis_embac varchar(20) NULL,
	nr_regis_aero varchar(20) NULL,
	dt_valid_regis_aero date NULL,
	ds_orga_exped_regis_aero varchar(50) NULL,
	en_pess varchar(255) NULL,
	en_nr_pess varchar(20) NULL,
	en_bair_pess varchar(255) NULL,
	en_cidd_pess varchar(255) NULL,
	en_uf_pess bpchar(2) NULL,
	en_cep_pess varchar(15) NULL,
	en_compl_pess varchar(255) NULL,
	en_pont_refer varchar(255) NULL,
	nm_gntr varchar(255) NULL,
	nm_gntra varchar(255) NULL,
	ds_nacn_pess varchar(255) NULL,
	ds_natur_pess varchar(255) NULL,
	sg_uf_natur bpchar(2) NULL,
	id_cor_pele_fk numeric NOT NULL,
	id_tipo_cabe_fk numeric NOT NULL,
	id_cor_olho_esqr_fk numeric NOT NULL,
	id_cor_olho_dirt_fk numeric NOT NULL,
	nr_altu_pess numeric(10, 2) NULL,
	nr_peso_pess numeric(10, 3) NULL,
	ds_tama_cint varchar(20) NULL,
	ds_tama_busto varchar(20) NULL,
	ds_tama_cabc varchar(255) NULL,
	ds_tama_calc varchar(255) NULL,
	ds_tama_cotur varchar(20) NULL,
	ds_tama_cami varchar(20) NULL,
	ds_tama_calca varchar(20) NULL,
	ds_tama_clcao varchar(20) NULL,
	ds_tama_busti varchar(20) NULL,
	ds_tama_maio varchar(20) NULL,
	ds_tama_sunga varchar(20) NULL,
	id_mao_uso_fk numeric NOT NULL,
	id_tipo_sang_fk numeric NOT NULL,
	id_fator_sang_fk numeric NOT NULL,
	ds_obsv_imun varchar(500) NULL,
	ds_ates_acid varchar(255) NULL,
	ds_ates_acid_sanit varchar(255) NULL,
	ds_doen_cron varchar(255) NULL,
	ds_remed_contr varchar(255) NULL,
	ds_alerg varchar(255) NULL,
	ds_foto_pess varchar(255) NULL,
	ds_assin_pess varchar(255) NULL,
	ds_digit_pess varchar(255) NULL,
	ds_fator_digit varchar(255) NULL,
	ds_poleg_dirt varchar(255) NULL,
	ds_indic_dirt varchar(255) NULL,
	ds_medio_dirt varchar(255) NULL,
	ds_anul_dirt varchar(255) NULL,
	ds_mini_dirt varchar(255) NULL,
	ds_poleg_esqr varchar(255) NULL,
	ds_indic_esqr varchar(255) NULL,
	ds_medio_esqr varchar(255) NULL,
	ds_anul_esqr varchar(255) NULL,
	ds_mini_esqr varchar(255) NULL,
	ic_doad_orga bpchar(1) NOT NULL,
	ic_doad_sague bpchar(1) NOT NULL,
	ic_socio_cas bpchar(1) NOT NULL,
	ic_socio_simepe bpchar(1) NOT NULL,
	ic_imun bpchar(1) NOT NULL,
	ic_acid bpchar(1) NOT NULL,
	ic_acid_sanit bpchar(1) NOT NULL,
	ic_alerg bpchar(1) NOT NULL,
	ic_remed_contr bpchar(1) NOT NULL,
	ic_doen_cron bpchar(1) NOT NULL,
	ic_sitc_pess bpchar(1) NOT NULL,
	id_mtvo_adido_fk numeric NULL,
	ic_tipo_adido bpchar(1) NULL,
	id_unid_extrn_fk numeric NULL,
	ds_obsv_adido varchar(500) NULL,
	dt_ingrs date NULL,
	ic_pend_movim bpchar(1) NOT NULL,
	ic_pend_prom bpchar(1) NOT NULL,
	ic_pend_func bpchar(1) NOT NULL,
	ic_stat bpchar(1) NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	nr_cntt_proprio varchar(11) NULL,
	CONSTRAINT pk_pess PRIMARY KEY (id_pess),
	CONSTRAINT un_pess_001 UNIQUE (nr_cpf_pess),
	CONSTRAINT fk_pess_001 FOREIGN KEY (id_mao_uso_fk) REFERENCES ovrsgp.tb_mao_uso(id_mao_uso),
	CONSTRAINT fk_pess_002 FOREIGN KEY (id_tipo_sang_fk) REFERENCES ovrsgp.tb_tipo_sang(id_tipo_sang),
	CONSTRAINT fk_pess_003 FOREIGN KEY (id_fator_sang_fk) REFERENCES ovrsgp.tb_fator_sang(id_fator_sang),
	CONSTRAINT fk_pess_004 FOREIGN KEY (id_mtvo_adido_fk) REFERENCES ovrsgp.tb_mtvo_adido(id_mtvo_adido),
	CONSTRAINT fk_pess_005 FOREIGN KEY (id_unid_extrn_fk) REFERENCES ovrsgp.tb_unid_extrn(id_unid_extrn),
	CONSTRAINT fk_pess_006 FOREIGN KEY (id_tipo_pess_fk) REFERENCES ovrsgp.tb_tipo_pess(id_tipo_pess),
	CONSTRAINT fk_pess_007 FOREIGN KEY (id_tipo_esco_fk) REFERENCES ovrsgp.tb_tipo_esco(id_tipo_esco),
	CONSTRAINT fk_pess_008 FOREIGN KEY (id_tipo_relig_fk) REFERENCES ovrsgp.tb_tipo_relig(id_tipo_relig),
	CONSTRAINT fk_pess_009 FOREIGN KEY (id_tipo_estd_civl_fk) REFERENCES ovrsgp.tb_tipo_estd_civl(id_tipo_estd_civl),
	CONSTRAINT fk_pess_010 FOREIGN KEY (id_categ_cnh_fk) REFERENCES ovrsgp.tb_categ_cnh(id_categ_cnh),
	CONSTRAINT fk_pess_011 FOREIGN KEY (id_cor_pele_fk) REFERENCES ovrsgp.tb_cor_pele(id_cor_pele),
	CONSTRAINT fk_pess_012 FOREIGN KEY (id_tipo_cabe_fk) REFERENCES ovrsgp.tb_tipo_cabe(id_tipo_cabe),
	CONSTRAINT fk_pess_013 FOREIGN KEY (id_cor_olho_esqr_fk) REFERENCES ovrsgp.tb_cor_olho(id_cor_olho),
	CONSTRAINT fk_pess_014 FOREIGN KEY (id_cor_olho_dirt_fk) REFERENCES ovrsgp.tb_cor_olho(id_cor_olho)
);
CREATE INDEX in_pess_001 ON ovrsgp.tb_pess USING btree (ic_doad_orga);
CREATE INDEX in_pess_002 ON ovrsgp.tb_pess USING btree (ic_doad_sague);
CREATE INDEX in_pess_003 ON ovrsgp.tb_pess USING btree (ic_socio_cas);
CREATE INDEX in_pess_004 ON ovrsgp.tb_pess USING btree (ic_socio_simepe);
CREATE INDEX in_pess_005 ON ovrsgp.tb_pess USING btree (ic_imun);
CREATE INDEX in_pess_006 ON ovrsgp.tb_pess USING btree (ic_acid);
CREATE INDEX in_pess_007 ON ovrsgp.tb_pess USING btree (ic_acid_sanit);
CREATE INDEX in_pess_008 ON ovrsgp.tb_pess USING btree (ic_alerg);
CREATE INDEX in_pess_009 ON ovrsgp.tb_pess USING btree (ic_remed_contr);
CREATE INDEX in_pess_010 ON ovrsgp.tb_pess USING btree (ic_doen_cron);
CREATE INDEX in_pess_011 ON ovrsgp.tb_pess USING btree (ic_sitc_pess);
CREATE INDEX in_pess_012 ON ovrsgp.tb_pess USING btree (ic_tipo_adido);
CREATE INDEX in_pess_013 ON ovrsgp.tb_pess USING btree (ic_pend_movim);
CREATE INDEX in_pess_014 ON ovrsgp.tb_pess USING btree (ic_pend_prom);
CREATE INDEX in_pess_015 ON ovrsgp.tb_pess USING btree (ic_pend_func);
CREATE INDEX in_pess_016 ON ovrsgp.tb_pess USING btree (ic_stat);
CREATE INDEX in_pess_017 ON ovrsgp.tb_pess USING btree (id_tipo_pess_fk);
CREATE INDEX in_pess_018 ON ovrsgp.tb_pess USING btree (id_tipo_esco_fk);
CREATE INDEX in_pess_019 ON ovrsgp.tb_pess USING btree (id_tipo_relig_fk);
CREATE INDEX in_pess_020 ON ovrsgp.tb_pess USING btree (id_tipo_estd_civl_fk);
CREATE INDEX in_pess_021 ON ovrsgp.tb_pess USING btree (id_categ_cnh_fk);
CREATE INDEX in_pess_022 ON ovrsgp.tb_pess USING btree (id_cor_pele_fk);
CREATE INDEX in_pess_023 ON ovrsgp.tb_pess USING btree (id_tipo_cabe_fk);
CREATE INDEX in_pess_024 ON ovrsgp.tb_pess USING btree (id_cor_olho_esqr_fk);
CREATE INDEX in_pess_025 ON ovrsgp.tb_pess USING btree (id_cor_olho_dirt_fk);
CREATE INDEX in_pess_026 ON ovrsgp.tb_pess USING btree (id_mao_uso_fk);
CREATE INDEX in_pess_027 ON ovrsgp.tb_pess USING btree (id_tipo_sang_fk);
CREATE INDEX in_pess_028 ON ovrsgp.tb_pess USING btree (id_fator_sang_fk);
CREATE INDEX in_pess_029 ON ovrsgp.tb_pess USING btree (id_mtvo_adido_fk);
CREATE INDEX in_pess_030 ON ovrsgp.tb_pess USING btree (id_unid_extrn_fk);
CREATE INDEX in_pess_nr_matr ON ovrsgp.tb_pess USING btree (nr_matr_pess);


-- ovrsgp.tb_pess_x_banco definição

-- Drop table

-- DROP TABLE ovrsgp.tb_pess_x_banco;

CREATE TABLE ovrsgp.tb_pess_x_banco (
	id_pess_fk numeric NOT NULL,
	id_banco_fk numeric NOT NULL,
	id_tipo_cnta_banco_fk numeric NOT NULL,
	nr_agen varchar(15) NOT NULL,
	nr_cnta_corr varchar(20) NULL,
	ic_paga bpchar(1) NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_pess_x_banco PRIMARY KEY (id_pess_fk, id_banco_fk, id_tipo_cnta_banco_fk, nr_agen),
	CONSTRAINT fk_pess_x_banco_001 FOREIGN KEY (id_pess_fk) REFERENCES ovrsgp.tb_pess(id_pess),
	CONSTRAINT fk_pess_x_banco_002 FOREIGN KEY (id_banco_fk) REFERENCES ovrsgp.tb_banco(id_banco),
	CONSTRAINT fk_pess_x_banco_003 FOREIGN KEY (id_tipo_cnta_banco_fk) REFERENCES ovrsgp.tb_tipo_cnta_banco(id_tipo_cnta_banco)
);
CREATE INDEX in_pess_x_banco_001 ON ovrsgp.tb_pess_x_banco USING btree (ic_paga);
CREATE INDEX in_pess_x_banco_002 ON ovrsgp.tb_pess_x_banco USING btree (id_pess_fk);
CREATE INDEX in_pess_x_banco_003 ON ovrsgp.tb_pess_x_banco USING btree (id_banco_fk);
CREATE INDEX in_pess_x_banco_004 ON ovrsgp.tb_pess_x_banco USING btree (id_tipo_cnta_banco_fk);


-- ovrsgp.tb_qdro_x_cargo definição

-- Drop table

-- DROP TABLE ovrsgp.tb_qdro_x_cargo;

CREATE TABLE ovrsgp.tb_qdro_x_cargo (
	id_qdro_fk numeric NOT NULL,
	id_cargo_fk numeric NOT NULL,
	ic_stat bpchar(1) NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_qdro_x_cargo PRIMARY KEY (id_qdro_fk, id_cargo_fk),
	CONSTRAINT fk_qdro_x_cargo_001 FOREIGN KEY (id_cargo_fk) REFERENCES ovrsgp.tb_cargo(id_cargo),
	CONSTRAINT fk_qdro_x_cargo_002 FOREIGN KEY (id_qdro_fk) REFERENCES ovrsgp.tb_qdro(id_qdro)
);
CREATE INDEX in_qdro_x_cargo_001 ON ovrsgp.tb_qdro_x_cargo USING btree (ic_stat);
CREATE INDEX in_qdro_x_cargo_002 ON ovrsgp.tb_qdro_x_cargo USING btree (id_qdro_fk);
CREATE INDEX in_qdro_x_cargo_003 ON ovrsgp.tb_qdro_x_cargo USING btree (id_cargo_fk);


-- ovrsgp.tb_secao definição

-- Drop table

-- DROP TABLE ovrsgp.tb_secao;

CREATE TABLE ovrsgp.tb_secao (
	id_secao numeric NOT NULL,
	id_ome_fk numeric NOT NULL,
	id_secao_fk numeric NULL,
	ds_hiera_secao varchar(50) NOT NULL,
	nr_nivel_secao numeric NOT NULL,
	nm_secao varchar(255) NOT NULL,
	sg_secao varchar(255) NULL,
	en_secao varchar(255) NULL,
	en_nr_secao varchar(20) NULL,
	en_bair_secao varchar(255) NULL,
	en_cidd_secao varchar(255) NULL,
	en_uf_secao bpchar(2) NULL,
	en_cep_secao varchar(20) NULL,
	en_compl_secao varchar(255) NULL,
	en_pont_refer varchar(255) NULL,
	ic_tipo bpchar(2) NOT NULL,
	nr_latd numeric(12, 10) NULL,
	nr_long numeric(12, 10) NULL,
	ic_stat bpchar(1) NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	ic_secr bpchar(1) NULL,
	CONSTRAINT pk_secao PRIMARY KEY (id_secao),
	CONSTRAINT fk_secao_001 FOREIGN KEY (id_ome_fk) REFERENCES ovrsgp.tb_ome(id_ome),
	CONSTRAINT fk_secao_002 FOREIGN KEY (id_secao_fk) REFERENCES ovrsgp.tb_secao(id_secao)
);
CREATE INDEX in_secao_001 ON ovrsgp.tb_secao USING btree (ic_tipo);
CREATE INDEX in_secao_002 ON ovrsgp.tb_secao USING btree (ic_stat);
CREATE INDEX in_secao_003 ON ovrsgp.tb_secao USING btree (id_ome_fk);
CREATE INDEX in_secao_004 ON ovrsgp.tb_secao USING btree (id_secao_fk);


-- ovrsgp.tb_secao_x_tipo_func definição

-- Drop table

-- DROP TABLE ovrsgp.tb_secao_x_tipo_func;

CREATE TABLE ovrsgp.tb_secao_x_tipo_func (
	id_secao_fk numeric NOT NULL,
	id_tipo_func_fk numeric NOT NULL,
	ic_stat bpchar(1) NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_secao_x_tipo_func PRIMARY KEY (id_secao_fk, id_tipo_func_fk),
	CONSTRAINT fk_secao_x_tipo_func_001 FOREIGN KEY (id_secao_fk) REFERENCES ovrsgp.tb_secao(id_secao),
	CONSTRAINT fk_secao_x_tipo_func_002 FOREIGN KEY (id_tipo_func_fk) REFERENCES ovrsgp.tb_tipo_func(id_tipo_func)
);
CREATE INDEX in_secao_x_tipo_func_001 ON ovrsgp.tb_secao_x_tipo_func USING btree (ic_stat);
CREATE INDEX in_secao_x_tipo_func_002 ON ovrsgp.tb_secao_x_tipo_func USING btree (id_secao_fk);
CREATE INDEX in_secao_x_tipo_func_003 ON ovrsgp.tb_secao_x_tipo_func USING btree (id_tipo_func_fk);


-- ovrsgp.tb_tipo_curso_x_clasf_curso definição

-- Drop table

-- DROP TABLE ovrsgp.tb_tipo_curso_x_clasf_curso;

CREATE TABLE ovrsgp.tb_tipo_curso_x_clasf_curso (
	id_tipo_curso_fk numeric NOT NULL,
	id_clasf_curso_fk numeric NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_tipo_curso_x_clasf_curso PRIMARY KEY (id_tipo_curso_fk, id_clasf_curso_fk),
	CONSTRAINT fk_tipo_curso_x_clasf_001 FOREIGN KEY (id_clasf_curso_fk) REFERENCES ovrsgp.tb_clasf_curso(id_clasf_curso),
	CONSTRAINT fk_tipo_curso_x_clasf_002 FOREIGN KEY (id_tipo_curso_fk) REFERENCES ovrsgp.tb_tipo_curso(id_tipo_curso)
);
CREATE INDEX in_tipo_curso_x_clasf_001 ON ovrsgp.tb_tipo_curso_x_clasf_curso USING btree (id_tipo_curso_fk);
CREATE INDEX in_tipo_curso_x_clasf_002 ON ovrsgp.tb_tipo_curso_x_clasf_curso USING btree (id_clasf_curso_fk);


-- ovrsgp.tb_afast definição

-- Drop table

-- DROP TABLE ovrsgp.tb_afast;

CREATE TABLE ovrsgp.tb_afast (
	id_afast numeric NOT NULL,
	id_pess_fk numeric NOT NULL,
	id_tipo_afast_fk numeric NOT NULL,
	id_tipo_docm_fk numeric NOT NULL,
	nr_docm varchar(50) NOT NULL,
	dt_docm date NOT NULL,
	dt_inic date NOT NULL,
	dt_term date NULL,
	ds_obsv_afast varchar(500) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_afast PRIMARY KEY (id_afast),
	CONSTRAINT fk_afast_001 FOREIGN KEY (id_pess_fk) REFERENCES ovrsgp.tb_pess(id_pess),
	CONSTRAINT fk_afast_002 FOREIGN KEY (id_tipo_afast_fk) REFERENCES ovrsgp.tb_tipo_afast(id_tipo_afast),
	CONSTRAINT fk_afast_003 FOREIGN KEY (id_tipo_docm_fk) REFERENCES ovrsgp.tb_tipo_docm(id_tipo_docm)
);
CREATE INDEX in_afast_001 ON ovrsgp.tb_afast USING btree (id_pess_fk);
CREATE INDEX in_afast_002 ON ovrsgp.tb_afast USING btree (id_tipo_afast_fk);
CREATE INDEX in_afast_003 ON ovrsgp.tb_afast USING btree (id_tipo_docm_fk);


-- ovrsgp.tb_agreg definição

-- Drop table

-- DROP TABLE ovrsgp.tb_agreg;

CREATE TABLE ovrsgp.tb_agreg (
	id_agreg numeric NOT NULL,
	id_pess_fk numeric NOT NULL,
	id_tipo_docm_fk numeric NOT NULL,
	ic_tipo bpchar(1) NOT NULL,
	dt_oprac date NOT NULL,
	nr_docm varchar(50) NOT NULL,
	dt_docm date NOT NULL,
	ds_obsv_agreg varchar(500) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_agreg PRIMARY KEY (id_agreg),
	CONSTRAINT fk_agreg_001 FOREIGN KEY (id_pess_fk) REFERENCES ovrsgp.tb_pess(id_pess),
	CONSTRAINT fk_agreg_002 FOREIGN KEY (id_tipo_docm_fk) REFERENCES ovrsgp.tb_tipo_docm(id_tipo_docm)
);
CREATE INDEX in_agreg_001 ON ovrsgp.tb_agreg USING btree (ic_tipo);
CREATE INDEX in_agreg_002 ON ovrsgp.tb_agreg USING btree (id_pess_fk);
CREATE INDEX in_agreg_003 ON ovrsgp.tb_agreg USING btree (id_tipo_docm_fk);


-- ovrsgp.tb_cart definição

-- Drop table

-- DROP TABLE ovrsgp.tb_cart;

CREATE TABLE ovrsgp.tb_cart (
	id_cart numeric NOT NULL,
	id_pess_fk numeric NOT NULL,
	ic_sitc_cart int4 NOT NULL,
	nr_bi varchar(255) NULL,
	dt_bi date NULL,
	nr_doe varchar(255) NULL,
	dt_doe date NULL,
	nr_bg varchar(255) NULL,
	dt_bg date NULL,
	nr_bgp varchar(255) NULL,
	dt_bgp date NULL,
	dt_emiss date NULL,
	dt_venc date NULL,
	dt_impr date NULL,
	ds_mtvo_inpto varchar(255) NULL,
	ic_apto_arma bpchar(1) NOT NULL,
	ic_vncd bpchar(1) NOT NULL,
	ic_impr bpchar(1) NOT NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_cart PRIMARY KEY (id_cart),
	CONSTRAINT fk_cart_001 FOREIGN KEY (id_pess_fk) REFERENCES ovrsgp.tb_pess(id_pess)
);
CREATE INDEX in_cart_001 ON ovrsgp.tb_cart USING btree (ic_apto_arma);
CREATE INDEX in_cart_002 ON ovrsgp.tb_cart USING btree (ic_vncd);
CREATE INDEX in_cart_003 ON ovrsgp.tb_cart USING btree (ic_impr);
CREATE INDEX in_cart_004 ON ovrsgp.tb_cart USING btree (id_pess_fk);


-- ovrsgp.tb_cntt definição

-- Drop table

-- DROP TABLE ovrsgp.tb_cntt;

CREATE TABLE ovrsgp.tb_cntt (
	id_cntt numeric NOT NULL,
	id_pess_fk numeric NOT NULL,
	ic_tipo bpchar(2) NOT NULL,
	ds_cntt varchar(255) NOT NULL,
	ds_obsv varchar(255) NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_cntt PRIMARY KEY (id_cntt),
	CONSTRAINT fk_cntt_001 FOREIGN KEY (id_pess_fk) REFERENCES ovrsgp.tb_pess(id_pess)
);
CREATE INDEX in_cntt_001 ON ovrsgp.tb_cntt USING btree (ic_tipo);
CREATE INDEX in_cntt_002 ON ovrsgp.tb_cntt USING btree (id_pess_fk);


-- ovrsgp.tb_curso definição

-- Drop table

-- DROP TABLE ovrsgp.tb_curso;

CREATE TABLE ovrsgp.tb_curso (
	id_curso numeric NOT NULL,
	id_clasf_curso_fk numeric NOT NULL,
	id_tipo_curso_fk numeric NOT NULL,
	id_inst_educ_fk numeric NOT NULL,
	nm_curso varchar(255) NOT NULL,
	sg_curso varchar(255) NULL,
	ds_emta_curso varchar(2000) NULL,
	nr_carga_hora_curso numeric NULL,
	nr_ponto_prom_curso numeric NULL,
	ic_stat bpchar(1) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_curso PRIMARY KEY (id_curso),
	CONSTRAINT fk_curso_001 FOREIGN KEY (id_tipo_curso_fk,id_clasf_curso_fk) REFERENCES ovrsgp.tb_tipo_curso_x_clasf_curso(id_tipo_curso_fk,id_clasf_curso_fk),
	CONSTRAINT fk_curso_002 FOREIGN KEY (id_inst_educ_fk) REFERENCES ovrsgp.tb_inst_educ(id_inst_educ)
);
CREATE INDEX in_curso_001 ON ovrsgp.tb_curso USING btree (id_inst_educ_fk);
CREATE INDEX in_curso_002 ON ovrsgp.tb_curso USING btree (id_tipo_curso_fk);
CREATE INDEX in_curso_003 ON ovrsgp.tb_curso USING btree (id_clasf_curso_fk);


-- ovrsgp.tb_depen definição

-- Drop table

-- DROP TABLE ovrsgp.tb_depen;

CREATE TABLE ovrsgp.tb_depen (
	id_depen numeric NOT NULL,
	id_pess_fk numeric NOT NULL,
	id_fator_sang_fk numeric NOT NULL,
	id_tipo_sang_fk numeric NOT NULL,
	id_tipo_esco_fk numeric NOT NULL,
	id_tipo_relig_fk numeric NOT NULL,
	id_tipo_estd_civl_fk numeric NOT NULL,
	id_tipo_paren_fk numeric NOT NULL,
	sq_depen varchar(255) NOT NULL,
	nm_depen varchar(255) NOT NULL,
	nr_cpf_depen varchar(20) NULL,
	dt_nasc date NOT NULL,
	ic_sexo_depen bpchar(1) NOT NULL,
	nr_rg varchar(20) NULL,
	ds_orga_exped_rg varchar(20) NULL,
	uf_rg bpchar(2) NULL,
	dt_exped_rg date NULL,
	ic_socio_cas bpchar(1) NULL,
	ic_socio_simepe bpchar(1) NULL,
	ic_depen_salar_famil bpchar(1) NULL,
	ic_depen_ir bpchar(1) NULL,
	ic_renda_finac bpchar(1) NULL,
	ic_defic_fisic bpchar(1) NULL,
	ds_defic_fisic varchar(255) NULL,
	ic_ates_vaci bpchar(1) NULL,
	ic_auxi_crec bpchar(1) NULL,
	ic_esco_milit bpchar(1) NULL,
	ic_stat bpchar(1) NULL,
	dt_cadas date NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_depen PRIMARY KEY (id_depen),
	CONSTRAINT fk_depen_001 FOREIGN KEY (id_pess_fk) REFERENCES ovrsgp.tb_pess(id_pess),
	CONSTRAINT fk_depen_002 FOREIGN KEY (id_tipo_relig_fk) REFERENCES ovrsgp.tb_tipo_relig(id_tipo_relig),
	CONSTRAINT fk_depen_003 FOREIGN KEY (id_fator_sang_fk) REFERENCES ovrsgp.tb_fator_sang(id_fator_sang),
	CONSTRAINT fk_depen_004 FOREIGN KEY (id_tipo_esco_fk) REFERENCES ovrsgp.tb_tipo_esco(id_tipo_esco),
	CONSTRAINT fk_depen_005 FOREIGN KEY (id_tipo_paren_fk) REFERENCES ovrsgp.tb_tipo_paren(id_tipo_paren),
	CONSTRAINT fk_depen_006 FOREIGN KEY (id_tipo_sang_fk) REFERENCES ovrsgp.tb_tipo_sang(id_tipo_sang),
	CONSTRAINT fk_depen_007 FOREIGN KEY (id_tipo_estd_civl_fk) REFERENCES ovrsgp.tb_tipo_estd_civl(id_tipo_estd_civl)
);
CREATE INDEX in_depen_001 ON ovrsgp.tb_depen USING btree (ic_socio_cas);
CREATE INDEX in_depen_002 ON ovrsgp.tb_depen USING btree (ic_socio_simepe);
CREATE INDEX in_depen_003 ON ovrsgp.tb_depen USING btree (ic_depen_salar_famil);
CREATE INDEX in_depen_004 ON ovrsgp.tb_depen USING btree (ic_depen_ir);
CREATE INDEX in_depen_005 ON ovrsgp.tb_depen USING btree (ic_renda_finac);
CREATE INDEX in_depen_006 ON ovrsgp.tb_depen USING btree (ic_defic_fisic);
CREATE INDEX in_depen_007 ON ovrsgp.tb_depen USING btree (ic_ates_vaci);
CREATE INDEX in_depen_008 ON ovrsgp.tb_depen USING btree (ic_auxi_crec);
CREATE INDEX in_depen_009 ON ovrsgp.tb_depen USING btree (ic_esco_milit);
CREATE INDEX in_depen_010 ON ovrsgp.tb_depen USING btree (ic_stat);
CREATE INDEX in_depen_011 ON ovrsgp.tb_depen USING btree (id_pess_fk);
CREATE INDEX in_depen_012 ON ovrsgp.tb_depen USING btree (id_fator_sang_fk);
CREATE INDEX in_depen_013 ON ovrsgp.tb_depen USING btree (id_tipo_sang_fk);
CREATE INDEX in_depen_014 ON ovrsgp.tb_depen USING btree (id_tipo_esco_fk);
CREATE INDEX in_depen_015 ON ovrsgp.tb_depen USING btree (id_tipo_relig_fk);
CREATE INDEX in_depen_016 ON ovrsgp.tb_depen USING btree (id_tipo_estd_civl_fk);
CREATE INDEX in_depen_017 ON ovrsgp.tb_depen USING btree (id_tipo_paren_fk);


-- ovrsgp.tb_docm definição

-- Drop table

-- DROP TABLE ovrsgp.tb_docm;

CREATE TABLE ovrsgp.tb_docm (
	id_docm numeric NOT NULL,
	id_pess_fk numeric NOT NULL,
	id_tipo_docm_fk numeric NOT NULL,
	ds_arqu_docm varchar(255) NOT NULL,
	dt_docm date NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_docm PRIMARY KEY (id_docm),
	CONSTRAINT fk_docm_001 FOREIGN KEY (id_pess_fk) REFERENCES ovrsgp.tb_pess(id_pess),
	CONSTRAINT fk_docm_002 FOREIGN KEY (id_tipo_docm_fk) REFERENCES ovrsgp.tb_tipo_docm(id_tipo_docm)
);
CREATE INDEX in_docm_001 ON ovrsgp.tb_docm USING btree (id_tipo_docm_fk);
CREATE INDEX in_docm_002 ON ovrsgp.tb_docm USING btree (id_pess_fk);


-- ovrsgp.tb_inatv definição

-- Drop table

-- DROP TABLE ovrsgp.tb_inatv;

CREATE TABLE ovrsgp.tb_inatv (
	id_inatv numeric NOT NULL,
	id_pess_fk numeric NOT NULL,
	id_mtvo_inatv_fk numeric NOT NULL,
	dt_inatv date NOT NULL,
	id_tipo_docm_fk numeric NOT NULL,
	nr_docm varchar(50) NOT NULL,
	dt_docm date NOT NULL,
	ds_obsv_inatv varchar(500) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	ic_sitc_inatv bpchar(1) NULL,
	CONSTRAINT pk_inatv PRIMARY KEY (id_inatv),
	CONSTRAINT fk_inatv_001 FOREIGN KEY (id_mtvo_inatv_fk) REFERENCES ovrsgp.tb_mtvo_inatv(id_mtvo_inatv),
	CONSTRAINT fk_inatv_002 FOREIGN KEY (id_pess_fk) REFERENCES ovrsgp.tb_pess(id_pess),
	CONSTRAINT fk_inatv_003 FOREIGN KEY (id_tipo_docm_fk) REFERENCES ovrsgp.tb_tipo_docm(id_tipo_docm)
);
CREATE INDEX in_inatv_001 ON ovrsgp.tb_inatv USING btree (id_pess_fk);
CREATE INDEX in_inatv_002 ON ovrsgp.tb_inatv USING btree (id_tipo_docm_fk);
CREATE INDEX in_inatv_003 ON ovrsgp.tb_inatv USING btree (id_mtvo_inatv_fk);


-- ovrsgp.tb_movim definição

-- Drop table

-- DROP TABLE ovrsgp.tb_movim;

CREATE TABLE ovrsgp.tb_movim (
	id_movim numeric NOT NULL,
	id_pess_fk numeric NOT NULL,
	id_ome_fk numeric NOT NULL,
	dt_movim date NULL,
	id_tipo_docm_fk numeric NOT NULL,
	nr_docm varchar(50) NOT NULL,
	dt_docm date NOT NULL,
	ic_efet bpchar(1) NOT NULL,
	ds_obsv_movim varchar(500) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_movim PRIMARY KEY (id_movim),
	CONSTRAINT fk_movim_001 FOREIGN KEY (id_ome_fk) REFERENCES ovrsgp.tb_ome(id_ome),
	CONSTRAINT fk_movim_002 FOREIGN KEY (id_pess_fk) REFERENCES ovrsgp.tb_pess(id_pess),
	CONSTRAINT fk_movim_003 FOREIGN KEY (id_tipo_docm_fk) REFERENCES ovrsgp.tb_tipo_docm(id_tipo_docm)
);
CREATE INDEX in_movim_001 ON ovrsgp.tb_movim USING btree (ic_efet);
CREATE INDEX in_movim_002 ON ovrsgp.tb_movim USING btree (id_pess_fk);
CREATE INDEX in_movim_003 ON ovrsgp.tb_movim USING btree (id_tipo_docm_fk);
CREATE INDEX in_movim_004 ON ovrsgp.tb_movim USING btree (id_ome_fk);


-- ovrsgp.tb_pess_x_curso definição

-- Drop table

-- DROP TABLE ovrsgp.tb_pess_x_curso;

CREATE TABLE ovrsgp.tb_pess_x_curso (
	id_pess_fk numeric NOT NULL,
	id_curso_fk numeric NOT NULL,
	id_stat_curso_fk numeric NOT NULL,
	dt_inic date NOT NULL,
	dt_term date NULL,
	ds_docm_insc varchar(255) NULL,
	ds_docm_concl varchar(255) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_pess_x_curso PRIMARY KEY (id_pess_fk, id_curso_fk),
	CONSTRAINT fk_pess_x_curso_001 FOREIGN KEY (id_curso_fk) REFERENCES ovrsgp.tb_curso(id_curso),
	CONSTRAINT fk_pess_x_curso_002 FOREIGN KEY (id_pess_fk) REFERENCES ovrsgp.tb_pess(id_pess),
	CONSTRAINT fk_pess_x_curso_003 FOREIGN KEY (id_stat_curso_fk) REFERENCES ovrsgp.tb_stat_curso(id_stat_curso)
);
CREATE INDEX in_pess_x_curso_001 ON ovrsgp.tb_pess_x_curso USING btree (id_pess_fk);
CREATE INDEX in_pess_x_curso_002 ON ovrsgp.tb_pess_x_curso USING btree (id_curso_fk);
CREATE INDEX in_pess_x_curso_003 ON ovrsgp.tb_pess_x_curso USING btree (id_stat_curso_fk);


-- ovrsgp.tb_prom definição

-- Drop table

-- DROP TABLE ovrsgp.tb_prom;

CREATE TABLE ovrsgp.tb_prom (
	id_prom numeric NOT NULL,
	id_pess_fk numeric NOT NULL,
	id_qdro_fk numeric NOT NULL,
	id_cargo_fk numeric NOT NULL,
	id_tipo_prom_fk numeric NOT NULL,
	dt_prom date NULL,
	id_tipo_docm_fk numeric NOT NULL,
	nr_docm varchar(50) NOT NULL,
	dt_docm date NOT NULL,
	dt_promv date NULL,
	ic_efet bpchar(1) NOT NULL,
	ds_obsv_prom varchar(500) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_prom PRIMARY KEY (id_prom),
	CONSTRAINT fk_prom_001 FOREIGN KEY (id_pess_fk) REFERENCES ovrsgp.tb_pess(id_pess),
	CONSTRAINT fk_prom_002 FOREIGN KEY (id_tipo_docm_fk) REFERENCES ovrsgp.tb_tipo_docm(id_tipo_docm),
	CONSTRAINT fk_prom_003 FOREIGN KEY (id_qdro_fk,id_cargo_fk) REFERENCES ovrsgp.tb_qdro_x_cargo(id_qdro_fk,id_cargo_fk),
	CONSTRAINT fk_prom_004 FOREIGN KEY (id_tipo_prom_fk) REFERENCES ovrsgp.tb_tipo_prom(id_tipo_prom)
);
CREATE INDEX in_prom_001 ON ovrsgp.tb_prom USING btree (ic_efet);
CREATE INDEX in_prom_002 ON ovrsgp.tb_prom USING btree (id_pess_fk);
CREATE INDEX in_prom_003 ON ovrsgp.tb_prom USING btree (id_tipo_docm_fk);
CREATE INDEX in_prom_004 ON ovrsgp.tb_prom USING btree (id_qdro_fk);
CREATE INDEX in_prom_005 ON ovrsgp.tb_prom USING btree (id_cargo_fk);
CREATE INDEX in_prom_006 ON ovrsgp.tb_prom USING btree (id_tipo_prom_fk);


-- ovrsgp.tb_qdro_x_cargo_x_secao_x_func definição

-- Drop table

-- DROP TABLE ovrsgp.tb_qdro_x_cargo_x_secao_x_func;

CREATE TABLE ovrsgp.tb_qdro_x_cargo_x_secao_x_func (
	id_qdro_fk numeric NOT NULL,
	id_cargo_fk numeric NOT NULL,
	id_secao_fk numeric NOT NULL,
	id_tipo_func_fk numeric NOT NULL,
	qt_vagas numeric NOT NULL,
	ic_stat bpchar(1) NOT NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_qdro_x_cargo_x_secao_x_func PRIMARY KEY (id_qdro_fk, id_cargo_fk, id_secao_fk, id_tipo_func_fk),
	CONSTRAINT fk_qdro_cargo_secao_func_001 FOREIGN KEY (id_qdro_fk,id_cargo_fk) REFERENCES ovrsgp.tb_qdro_x_cargo(id_qdro_fk,id_cargo_fk),
	CONSTRAINT fk_qdro_cargo_secao_func_002 FOREIGN KEY (id_secao_fk,id_tipo_func_fk) REFERENCES ovrsgp.tb_secao_x_tipo_func(id_secao_fk,id_tipo_func_fk)
);
CREATE INDEX in_qdro_cargo_secao_func_001 ON ovrsgp.tb_qdro_x_cargo_x_secao_x_func USING btree (ic_stat);
CREATE INDEX in_qdro_cargo_secao_func_002 ON ovrsgp.tb_qdro_x_cargo_x_secao_x_func USING btree (id_qdro_fk);
CREATE INDEX in_qdro_cargo_secao_func_003 ON ovrsgp.tb_qdro_x_cargo_x_secao_x_func USING btree (id_cargo_fk);
CREATE INDEX in_qdro_cargo_secao_func_004 ON ovrsgp.tb_qdro_x_cargo_x_secao_x_func USING btree (id_secao_fk);
CREATE INDEX in_qdro_cargo_secao_func_005 ON ovrsgp.tb_qdro_x_cargo_x_secao_x_func USING btree (id_tipo_func_fk);


-- ovrsgp.tb_func definição

-- Drop table

-- DROP TABLE ovrsgp.tb_func;

CREATE TABLE ovrsgp.tb_func (
	id_func numeric NOT NULL,
	id_pess_fk numeric NOT NULL,
	id_secao_fk numeric NOT NULL,
	id_tipo_func_fk numeric NOT NULL,
	id_qdro_fk numeric NOT NULL,
	id_cargo_fk numeric NOT NULL,
	dt_desig date NOT NULL,
	id_tipo_docm_fk numeric NOT NULL,
	nr_docm varchar(50) NOT NULL,
	dt_docm date NOT NULL,
	ic_exce bpchar(1) NOT NULL,
	ic_exer bpchar(1) NOT NULL,
	dt_disp date NULL,
	ic_efet bpchar(1) NOT NULL,
	ds_obsv_func varchar(500) NULL,
	dt_incl timestamp NOT NULL,
	dt_atlz timestamp NOT NULL,
	CONSTRAINT pk_func PRIMARY KEY (id_func),
	CONSTRAINT fk_func_001 FOREIGN KEY (id_tipo_docm_fk) REFERENCES ovrsgp.tb_tipo_docm(id_tipo_docm),
	CONSTRAINT fk_func_002 FOREIGN KEY (id_qdro_fk,id_cargo_fk,id_secao_fk,id_tipo_func_fk) REFERENCES ovrsgp.tb_qdro_x_cargo_x_secao_x_func(id_qdro_fk,id_cargo_fk,id_secao_fk,id_tipo_func_fk),
	CONSTRAINT fk_func_003 FOREIGN KEY (id_pess_fk) REFERENCES ovrsgp.tb_pess(id_pess)
);
CREATE INDEX in_func_001 ON ovrsgp.tb_func USING btree (ic_exce);
CREATE INDEX in_func_002 ON ovrsgp.tb_func USING btree (ic_exer);
CREATE INDEX in_func_003 ON ovrsgp.tb_func USING btree (ic_efet);
CREATE INDEX in_func_004 ON ovrsgp.tb_func USING btree (id_tipo_docm_fk);
CREATE INDEX in_func_005 ON ovrsgp.tb_func USING btree (id_qdro_fk);
CREATE INDEX in_func_006 ON ovrsgp.tb_func USING btree (id_cargo_fk);
CREATE INDEX in_func_007 ON ovrsgp.tb_func USING btree (id_secao_fk);
CREATE INDEX in_func_008 ON ovrsgp.tb_func USING btree (id_pess_fk);


-- ovrsgp.vw_analise_preenchimento fonte

CREATE OR REPLACE VIEW ovrsgp.vw_analise_preenchimento
AS SELECT regexp_replace(ef."Matricula"::text, '[^0-9]'::text, ''::text, 'g'::text) AS matricula,
    ef."ID",
    ef."Numero",
    ef."Posto Grad",
    ef."Ome",
    ef."Data Movimentacao Sp",
    ef."Observacao",
    ef."Afastamentos Sup 90 Dias",
    ef."Orgao",
    ef."Matricula",
    ef."Nome",
    ef."Nome Guerra",
    ef."Ome Anterior Sp",
    ef."Sexo",
    ef."Raca Cor",
    ef."Ano Ingresso",
    ef."Data Praca",
    ef."Tempo Servico Anos",
    ef."Data Ultima Promocao",
    ef."Principio Ultima Promocao",
    ef."Tempo Obm Atual",
    ef."Idade",
    ef."Horario Especial",
    ef."Readaptado",
    ef."Pcd",
    ef."Acumulo Cargos",
    ef."Le",
    ef."Ltip",
    ef."Categoria",
    ef."Disponibilidade",
    ef."Faixa Etária",
    ef."Tempo Obm Atual em Anos",
    mc.nr_altu_pess AS altura,
    mc.nr_peso_pess AS peso,
    mc.ds_tama_cint AS tamanho_cintura,
    mc.ds_tama_busto AS tamanho_busto,
    mc.ds_tama_cabc AS tamanho_cabeca,
    mc.ds_tama_calc AS tamanho_calcado,
    mc.ds_tama_cotur AS tamanho_coturno,
    mc.ds_tama_cami AS tamanho_camisa,
    mc.ds_tama_calca AS tamanho_calca,
    mc.ds_tama_clcao AS tamanho_calcao,
    mc.ds_tama_busti AS tamanho_busti,
    mc.ds_tama_maio AS tamanho_maio,
    mc.ds_tama_sunga AS tamanho_sunga,
    ad.situacao AS adido_situacao,
    ad.motivo AS adido_motivo,
    ad.unidade_externa AS adido_unidade_externa,
    ad.observacao AS adido_observacao,
    af.id_tipo_afastamento,
    af.tipo_afastamento,
    af.data_inicio AS afastamento_data_inicio,
    af.data_termino AS afastamento_data_termino,
    af.dias_afastado,
    af.status_afastamento,
    dp.nome_dependente,
    dp.data_nascimento AS dependente_data_nascimento,
    dp.idade AS dependente_idade,
    dp.menor_idade,
    dp.sexo AS dependente_sexo,
    dp.parentesco,
    dp.classificacao_parentesco,
    dp.possui_deficiencia,
    dp.descricao_deficiencia,
    fm.nome_curso,
    fm.tipo_curso,
    fm.classificacao_curso,
    fm.instituicao_ensino,
    fm.data_conclusao,
    fm.status_curso,
    mp.cpf,
    mp.rg_militar,
    mp.religiao,
    mp.estado_civil,
    mp.escolaridade,
    mp.cidade_residencia,
    mp.tipo_cnh,
    mp.validade_cnh,
    mp.registro_embarcacao,
    mp.validade_embarcacao,
    mp.registro_aeronave,
    mp.validade_aeronave,
    mp.tipo_sanguineo,
    mp.fator_sanguineo,
    mp.doador_sangue,
    mp.doador_orgao,
    mp.socio_cas,
    mp.socio_simepe,
    mp.quadro,
    mp."ingresso no cbmpe" AS ingresso_cbmpe,
    mp.cod_situacao,
    mp.situacao_adido_organico,
    mv.id_movim,
    mv.ome_destino,
    mv.data_movimentacao,
    mv.observacao AS movimentacao_observacao,
    mv.ome_origem,
    mv.dias_permanencia,
    pr.id_prom,
    pr.cargo_novo,
    pr.data_promocao,
    pr.motivo_promocao,
    pr.cargo_anterior
   FROM ovrsgp.vw_metabase_efetivo ef
     LEFT JOIN ovrsgp.vw_medidas_corporais mc ON regexp_replace(mc.nr_matr_pess::text, '[^0-9]'::text, ''::text, 'g'::text) = regexp_replace(ef."Matricula"::text, '[^0-9]'::text, ''::text, 'g'::text)
     LEFT JOIN ovrsgp.vw_metabase_adidos ad ON regexp_replace(ad.matricula::text, '[^0-9]'::text, ''::text, 'g'::text) = regexp_replace(ef."Matricula"::text, '[^0-9]'::text, ''::text, 'g'::text)
     LEFT JOIN ovrsgp.vw_metabase_afastamentos af ON regexp_replace(af.matricula::text, '[^0-9]'::text, ''::text, 'g'::text) = regexp_replace(ef."Matricula"::text, '[^0-9]'::text, ''::text, 'g'::text)
     LEFT JOIN ovrsgp.vw_metabase_dependentes dp ON regexp_replace(dp.matricula::text, '[^0-9]'::text, ''::text, 'g'::text) = regexp_replace(ef."Matricula"::text, '[^0-9]'::text, ''::text, 'g'::text)
     LEFT JOIN ovrsgp.vw_metabase_formacao fm ON regexp_replace(fm.matricula::text, '[^0-9]'::text, ''::text, 'g'::text) = regexp_replace(ef."Matricula"::text, '[^0-9]'::text, ''::text, 'g'::text)
     LEFT JOIN ovrsgp.vw_metabase_militar_perfil mp ON regexp_replace(mp.matricula::text, '[^0-9]'::text, ''::text, 'g'::text) = regexp_replace(ef."Matricula"::text, '[^0-9]'::text, ''::text, 'g'::text)
     LEFT JOIN ovrsgp.vw_metabase_movimentacoes mv ON regexp_replace(mv.matricula::text, '[^0-9]'::text, ''::text, 'g'::text) = regexp_replace(ef."Matricula"::text, '[^0-9]'::text, ''::text, 'g'::text)
     LEFT JOIN ovrsgp.vw_metabase_promocoes pr ON regexp_replace(pr.matricula::text, '[^0-9]'::text, ''::text, 'g'::text) = regexp_replace(ef."Matricula"::text, '[^0-9]'::text, ''::text, 'g'::text);


-- ovrsgp.vw_medidas_corporais fonte

CREATE OR REPLACE VIEW ovrsgp.vw_medidas_corporais
AS SELECT c.sg_cargo AS cargo_atual,
    p.nr_matr_pess,
    p.nm_guerr,
    p.nr_altu_pess,
    p.nr_peso_pess,
    p.ds_tama_cint,
    p.ds_tama_busto,
    p.ds_tama_cabc,
    p.ds_tama_calc,
    p.ds_tama_cotur,
    p.ds_tama_cami,
    p.ds_tama_calca,
    p.ds_tama_clcao,
    p.ds_tama_busti,
    p.ds_tama_maio,
    p.ds_tama_sunga
   FROM ovrsgp.tb_pess p
     LEFT JOIN ( SELECT DISTINCT ON (pr.id_pess_fk) pr.id_pess_fk,
            pr.id_cargo_fk
           FROM ovrsgp.tb_prom pr
          ORDER BY pr.id_pess_fk, pr.dt_prom DESC) ult_prom ON ult_prom.id_pess_fk = p.id_pess
     LEFT JOIN ovrsgp.tb_cargo c ON c.id_cargo = ult_prom.id_cargo_fk
  WHERE p.nr_matr_pess::text <> '0'::text;


-- ovrsgp.vw_metabase_adidos fonte

CREATE OR REPLACE VIEW ovrsgp.vw_metabase_adidos
AS SELECT p.nr_matr_pess AS matricula,
    p.nm_guerr AS nome_guerra,
        CASE
            WHEN p.ic_sitc_pess = 'A'::bpchar THEN 'Adido'::text
            ELSE 'Orgânico'::text
        END AS situacao,
    m.ds_mtvo_adido AS motivo,
    ( SELECT ue.ds_unid_extrn
           FROM ovrsgp.tb_unid_extrn ue
          WHERE (ue.id_unid_extrn IN ( SELECT ue.id_unid_extrn
                   FROM ovrsgp.tb_pess_x_banco pb
                  WHERE pb.id_pess_fk = p.id_pess
                 LIMIT 1))
         LIMIT 1) AS unidade_externa,
    p.ds_obsv_adido AS observacao
   FROM ovrsgp.tb_pess p
     LEFT JOIN ovrsgp.tb_mtvo_adido m ON p.id_mtvo_adido_fk = m.id_mtvo_adido;


-- ovrsgp.vw_metabase_afastamentos fonte

CREATE OR REPLACE VIEW ovrsgp.vw_metabase_afastamentos
AS SELECT a.id_afast,
    p.nr_matr_pess AS matricula,
    p.nm_guerr AS nome_guerra,
    a.id_tipo_afast_fk AS id_tipo_afastamento,
    t.ds_tipo_afast AS tipo_afastamento,
    a.dt_inic AS data_inicio,
    a.dt_term AS data_termino,
    COALESCE(a.dt_term, 'now'::text::date) - a.dt_inic AS dias_afastado,
        CASE
            WHEN a.dt_term IS NULL THEN 'Em andamento'::text
            WHEN a.dt_term >= '2026-04-27'::date THEN 'Em andamento'::text
            ELSE 'Finalizado'::text
        END AS status_afastamento,
    b.nm_pess AS nome_completo
   FROM ovrsgp.tb_afast a
     JOIN ovrsgp.tb_pess p ON a.id_pess_fk = p.id_pess
     LEFT JOIN ovrsgp.tb_pess_bkp b ON b.id_pess = a.id_pess_fk
     JOIN ovrsgp.tb_tipo_afast t ON a.id_tipo_afast_fk = t.id_tipo_afast
  WHERE NOT (EXISTS ( SELECT 1
           FROM ovrsgp.tb_inatv i
          WHERE i.id_pess_fk = p.id_pess));


-- ovrsgp.vw_metabase_dependentes fonte

CREATE OR REPLACE VIEW ovrsgp.vw_metabase_dependentes
AS SELECT d.id_pess_fk,
    p.nr_matr_pess AS matricula,
    p.nm_guerr AS nome_guerra,
    p.nm_pess AS nome_completo_militar,
    d.nm_depen AS nome_dependente,
    d.dt_nasc AS data_nascimento,
    date_part('year'::text, age('now'::text::date::timestamp with time zone, d.dt_nasc::timestamp with time zone))::integer AS idade,
        CASE
            WHEN date_part('year'::text, age('now'::text::date::timestamp with time zone, d.dt_nasc::timestamp with time zone)) < 18::double precision THEN 'S'::text
            ELSE 'N'::text
        END AS menor_idade,
        CASE
            WHEN d.ic_sexo_depen = 'M'::bpchar THEN 'Masculino'::text
            WHEN d.ic_sexo_depen = 'F'::bpchar THEN 'Feminino'::text
            ELSE 'Não informado'::text
        END AS sexo,
    tp.ds_tipo_paren AS parentesco,
        CASE
            WHEN lower(tp.ds_tipo_paren::text) ~~ '%filh%'::text THEN 'Filho(a)'::text
            WHEN lower(tp.ds_tipo_paren::text) ~~ '%conju%'::text THEN 'Cônjuge'::text
            WHEN lower(tp.ds_tipo_paren::text) ~~ '%espos%'::text THEN 'Cônjuge'::text
            WHEN lower(tp.ds_tipo_paren::text) ~~ '%companheir%'::text THEN 'Cônjuge'::text
            ELSE 'Outros'::text
        END AS classificacao_parentesco,
        CASE
            WHEN d.ic_defic_fisic = 'S'::bpchar THEN 'S'::text
            ELSE 'N'::text
        END AS possui_deficiencia,
    d.ds_defic_fisic AS descricao_deficiencia
   FROM ovrsgp.tb_depen d
     JOIN ovrsgp.tb_pess p ON d.id_pess_fk = p.id_pess
     LEFT JOIN ovrsgp.tb_tipo_paren tp ON d.id_tipo_paren_fk = tp.id_tipo_paren;


-- ovrsgp.vw_metabase_efetivo fonte

CREATE OR REPLACE VIEW ovrsgp.vw_metabase_efetivo
AS WITH ultima_movimentacao AS (
         SELECT DISTINCT ON (tb_movim.id_pess_fk) tb_movim.id_pess_fk,
            tb_movim.id_ome_fk,
            tb_movim.dt_movim,
            tb_movim.ds_obsv_movim
           FROM ovrsgp.tb_movim
          WHERE tb_movim.ic_efet = 'S'::bpchar
          ORDER BY tb_movim.id_pess_fk, tb_movim.dt_movim DESC
        ), penultima_movimentacao AS (
         SELECT m1.id_pess_fk,
            m1.id_ome_fk,
            m1.dt_movim
           FROM ( SELECT tb_movim.id_pess_fk,
                    tb_movim.id_ome_fk,
                    tb_movim.dt_movim,
                    row_number() OVER (PARTITION BY tb_movim.id_pess_fk ORDER BY tb_movim.dt_movim DESC) AS rn
                   FROM ovrsgp.tb_movim
                  WHERE tb_movim.ic_efet = 'S'::bpchar) m1
          WHERE m1.rn = 2
        ), ultima_promocao AS (
         SELECT DISTINCT ON (tb_prom.id_pess_fk) tb_prom.id_pess_fk,
            tb_prom.id_cargo_fk,
            tb_prom.id_qdro_fk,
            tb_prom.id_tipo_prom_fk,
            tb_prom.dt_promv
           FROM ovrsgp.tb_prom
          WHERE tb_prom.ic_efet = 'S'::bpchar
          ORDER BY tb_prom.id_pess_fk, tb_prom.dt_promv DESC
        ), afastamentos_ativos AS (
         SELECT a.id_pess_fk,
            string_agg(ta.ds_tipo_afast::text, ', '::text) AS afastamentos_desc
           FROM ovrsgp.tb_afast a
             JOIN ovrsgp.tb_tipo_afast ta ON a.id_tipo_afast_fk = ta.id_tipo_afast
          WHERE a.dt_term IS NULL OR a.dt_term >= 'now'::text::date
          GROUP BY a.id_pess_fk
        )
 SELECT p.id_pess AS "ID",
    row_number() OVER (ORDER BY c.ds_hiera_cargo, p.nm_pess) AS "Numero",
    COALESCE(c.sg_cargo, c.ds_cargo) AS "Posto Grad",
    COALESCE(o_atual.sg_ome, o_atual.nm_ome, 'ADIDO'::character varying) AS "Ome",
    to_char(um.dt_movim::timestamp with time zone, 'DD/MM/YYYY'::text) AS "Data Movimentacao Sp",
    COALESCE(um.ds_obsv_movim, 'Titular'::character varying) AS "Observacao",
    COALESCE(aa.afastamentos_desc, ''::text) AS "Afastamentos Sup 90 Dias",
    'CBMPE' AS "Orgao",
    p.nr_matr_pess AS "Matricula",
    p.nm_pess AS "Nome",
    p.nm_guerr AS "Nome Guerra",
    COALESCE(o_ant.sg_ome, o_ant.nm_ome, ''::character varying) AS "Ome Anterior Sp",
    p.ic_sexo AS "Sexo",
    cp.ds_cor_pele AS "Raca Cor",
    to_char(p.dt_incl, 'YYYY'::text) AS "Ano Ingresso",
    '' AS "Data Praca",
    date_part('year'::text, age('now'::text::date::timestamp without time zone, p.dt_incl))::text AS "Tempo Servico Anos",
    to_char(up.dt_promv::timestamp with time zone, 'DD/MM/YYYY'::text) AS "Data Ultima Promocao",
    tp.ds_tipo_prom AS "Principio Ultima Promocao",
    'now'::text::date - um.dt_movim AS "Tempo Obm Atual",
    date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone))::text AS "Idade",
    'false' AS "Horario Especial",
    'false' AS "Readaptado",
    'false' AS "Pcd",
    '' AS "Acumulo Cargos",
    'false' AS "Le",
    'false' AS "Ltip",
        CASE
            WHEN q.ds_qdro::text ~~* '%OFICIAIS%'::text THEN 'Oficiais'::text
            ELSE 'Praças'::text
        END AS "Categoria",
        CASE
            WHEN o_atual.sg_ome::text = 'ADIDO'::text THEN 'Indisponível'::text
            ELSE 'Disponível'::text
        END AS "Disponibilidade",
        CASE
            WHEN date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) >= 18::double precision AND date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) <= 22::double precision THEN '18-22'::text
            WHEN date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) >= 23::double precision AND date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) <= 27::double precision THEN '23-27'::text
            WHEN date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) >= 28::double precision AND date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) <= 32::double precision THEN '28-32'::text
            WHEN date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) >= 33::double precision AND date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) <= 37::double precision THEN '33-37'::text
            WHEN date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) >= 38::double precision AND date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) <= 42::double precision THEN '38-42'::text
            WHEN date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) >= 43::double precision AND date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) <= 47::double precision THEN '43-47'::text
            WHEN date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) >= 48::double precision AND date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) <= 52::double precision THEN '48-52'::text
            WHEN date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) >= 53::double precision AND date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) <= 57::double precision THEN '53-57'::text
            WHEN date_part('year'::text, age('now'::text::date::timestamp with time zone, p.dt_nasc::timestamp with time zone)) >= 58::double precision THEN '58+'::text
            ELSE 'N/I'::text
        END AS "Faixa Etária",
    date_part('year'::text, age('now'::text::date::timestamp with time zone, um.dt_movim::timestamp with time zone))::text AS "Tempo Obm Atual em Anos"
   FROM ovrsgp.tb_pess p
     LEFT JOIN ovrsgp.tb_cor_pele cp ON p.id_cor_pele_fk = cp.id_cor_pele
     LEFT JOIN ultima_movimentacao um ON p.id_pess = um.id_pess_fk
     LEFT JOIN ovrsgp.tb_ome o_atual ON um.id_ome_fk = o_atual.id_ome
     LEFT JOIN penultima_movimentacao pm ON p.id_pess = pm.id_pess_fk
     LEFT JOIN ovrsgp.tb_ome o_ant ON pm.id_ome_fk = o_ant.id_ome
     LEFT JOIN ultima_promocao up ON p.id_pess = up.id_pess_fk
     LEFT JOIN ovrsgp.tb_cargo c ON up.id_cargo_fk = c.id_cargo
     LEFT JOIN ovrsgp.tb_qdro q ON up.id_qdro_fk = q.id_qdro
     LEFT JOIN ovrsgp.tb_tipo_prom tp ON up.id_tipo_prom_fk = tp.id_tipo_prom
     LEFT JOIN afastamentos_ativos aa ON p.id_pess = aa.id_pess_fk
  WHERE NOT (EXISTS ( SELECT 1
           FROM ovrsgp.tb_inatv i
          WHERE i.id_pess_fk = p.id_pess));


-- ovrsgp.vw_metabase_formacao fonte

CREATE OR REPLACE VIEW ovrsgp.vw_metabase_formacao
AS SELECT p.nr_matr_pess AS matricula,
    p.nm_guerr AS nome_guerra,
    c.nm_curso AS nome_curso,
    tc.ds_tipo_curso AS tipo_curso,
    cc.ds_clasf_curso AS classificacao_curso,
    ie.nm_inst AS instituicao_ensino,
    pc.dt_term AS data_conclusao,
    sc.ds_stat_curso AS status_curso,
    b.nm_pess AS nome_completo
   FROM ovrsgp.tb_pess_x_curso pc
     JOIN ovrsgp.tb_pess p ON pc.id_pess_fk = p.id_pess
     LEFT JOIN ovrsgp.tb_pess_bkp b ON b.id_pess = pc.id_pess_fk
     JOIN ovrsgp.tb_curso c ON pc.id_curso_fk = c.id_curso
     JOIN ovrsgp.tb_tipo_curso tc ON c.id_tipo_curso_fk = tc.id_tipo_curso
     JOIN ovrsgp.tb_clasf_curso cc ON c.id_clasf_curso_fk = cc.id_clasf_curso
     JOIN ovrsgp.tb_inst_educ ie ON c.id_inst_educ_fk = ie.id_inst_educ
     JOIN ovrsgp.tb_stat_curso sc ON pc.id_stat_curso_fk = sc.id_stat_curso;


-- ovrsgp.vw_metabase_militar_perfil fonte

CREATE OR REPLACE VIEW ovrsgp.vw_metabase_militar_perfil
AS SELECT p.id_pess,
    p.nr_matr_pess AS matricula,
    p.nm_pess AS nome_completo,
    p.nm_guerr AS nome_guerra,
    p.ic_sexo AS sexo,
    p.dt_nasc AS data_nascimento,
    date_part('year'::text, age(now(), p.dt_nasc::timestamp with time zone))::integer AS idade_atual,
    p.nr_cpf_pess AS cpf,
    p.nr_rg_milit AS rg_militar,
    tr.ds_tipo_relig AS religiao,
    tec.ds_tipo_estd_civl AS estado_civil,
    tes.ds_tipo_esco AS escolaridade,
    cp.ds_cor_pele AS raca_cor,
    p.en_cidd_pess AS cidade_residencia,
    cc.ds_categ_cnh AS tipo_cnh,
    p.dt_valid_cnh AS validade_cnh,
    p.nr_regis_embac AS registro_embarcacao,
    p.dt_valid_regis_embac AS validade_embarcacao,
    p.nr_regis_aero AS registro_aeronave,
    p.dt_valid_regis_aero AS validade_aeronave,
    ts.ds_tipo_sang AS tipo_sanguineo,
    fs.ds_fator_sang AS fator_sanguineo,
        CASE
            WHEN p.ic_doad_sague = 'S'::bpchar THEN 'Sim'::text
            ELSE 'Não'::text
        END AS doador_sangue,
        CASE
            WHEN p.ic_doad_orga = 'S'::bpchar THEN 'Sim'::text
            ELSE 'Não'::text
        END AS doador_orgao,
        CASE
            WHEN p.ic_socio_cas = 'S'::bpchar THEN 'Sim'::text
            ELSE 'Não'::text
        END AS socio_cas,
        CASE
            WHEN p.ic_socio_simepe = 'S'::bpchar THEN 'Sim'::text
            ELSE 'Não'::text
        END AS socio_simepe,
    ( SELECT o.sg_ome
           FROM ovrsgp.tb_movim m
             JOIN ovrsgp.tb_ome o ON m.id_ome_fk = o.id_ome
          WHERE m.id_pess_fk = p.id_pess AND m.ic_efet = 'S'::bpchar
          ORDER BY m.dt_movim DESC
         LIMIT 1) AS ome_atual,
    ( SELECT c.sg_cargo
           FROM ovrsgp.tb_prom pr
             JOIN ovrsgp.tb_cargo c ON pr.id_cargo_fk = c.id_cargo
          WHERE pr.id_pess_fk = p.id_pess AND pr.ic_efet = 'S'::bpchar
          ORDER BY pr.dt_promv DESC
         LIMIT 1) AS posto_graduacao,
    ( SELECT q.ds_qdro
           FROM ovrsgp.tb_prom pr
             JOIN ovrsgp.tb_qdro q ON pr.id_qdro_fk = q.id_qdro
          WHERE pr.id_pess_fk = p.id_pess AND pr.ic_efet = 'S'::bpchar
          ORDER BY pr.dt_promv DESC
         LIMIT 1) AS quadro,
    pb.dt_ingrs AS "ingresso no cbmpe",
    p.ic_sitc_pess AS cod_situacao,
        CASE
            WHEN p.ic_sitc_pess = 'A'::bpchar THEN 'Orgânico'::text
            WHEN p.ic_sitc_pess = 'D'::bpchar THEN 'Adido'::text
            WHEN p.ic_sitc_pess = 'G'::bpchar THEN 'Agregado'::text
            ELSE 'Outros'::text
        END AS situacao_adido_organico
   FROM ovrsgp.tb_pess p
     LEFT JOIN ( SELECT DISTINCT ON (tb_pess_bkp.id_pess) tb_pess_bkp.id_pess,
            tb_pess_bkp.dt_ingrs
           FROM ovrsgp.tb_pess_bkp
          ORDER BY tb_pess_bkp.id_pess, tb_pess_bkp.dt_ingrs) pb ON pb.id_pess = p.id_pess
     LEFT JOIN ovrsgp.tb_tipo_relig tr ON p.id_tipo_relig_fk = tr.id_tipo_relig
     LEFT JOIN ovrsgp.tb_tipo_estd_civl tec ON p.id_tipo_estd_civl_fk = tec.id_tipo_estd_civl
     LEFT JOIN ovrsgp.tb_tipo_esco tes ON p.id_tipo_esco_fk = tes.id_tipo_esco
     LEFT JOIN ovrsgp.tb_cor_pele cp ON p.id_cor_pele_fk = cp.id_cor_pele
     LEFT JOIN ovrsgp.tb_categ_cnh cc ON p.id_categ_cnh_fk = cc.id_categ_cnh
     LEFT JOIN ovrsgp.tb_tipo_sang ts ON p.id_tipo_sang_fk = ts.id_tipo_sang
     LEFT JOIN ovrsgp.tb_fator_sang fs ON p.id_fator_sang_fk = fs.id_fator_sang
  WHERE NOT (EXISTS ( SELECT 1
           FROM ovrsgp.tb_inatv i
          WHERE i.id_pess_fk = p.id_pess));


-- ovrsgp.vw_metabase_movimentacoes fonte

CREATE OR REPLACE VIEW ovrsgp.vw_metabase_movimentacoes
AS SELECT m.id_movim,
    p.nr_matr_pess AS matricula,
    p.nm_guerr AS nome_guerra,
    o.sg_ome AS ome_destino,
    m.dt_movim AS data_movimentacao,
    m.ds_obsv_movim AS observacao,
    lag(o.sg_ome) OVER (PARTITION BY m.id_pess_fk ORDER BY m.dt_movim) AS ome_origem,
    lead(m.dt_movim) OVER (PARTITION BY m.id_pess_fk ORDER BY m.dt_movim) - m.dt_movim AS dias_permanencia,
    b.nm_pess AS nome_completo
   FROM ovrsgp.tb_movim m
     JOIN ovrsgp.tb_pess p ON m.id_pess_fk = p.id_pess
     LEFT JOIN ovrsgp.tb_pess_bkp b ON b.id_pess = m.id_pess_fk
     JOIN ovrsgp.tb_ome o ON m.id_ome_fk = o.id_ome
  WHERE m.ic_efet = 'S'::bpchar;


-- ovrsgp.vw_metabase_promocoes fonte

CREATE OR REPLACE VIEW ovrsgp.vw_metabase_promocoes
AS SELECT pr.id_prom,
    p.nr_matr_pess AS matricula,
    p.nm_guerr AS nome_guerra,
    c.sg_cargo AS cargo_novo,
    pr.dt_promv AS data_promocao,
    tp.ds_tipo_prom AS motivo_promocao,
    lag(c.sg_cargo) OVER (PARTITION BY pr.id_pess_fk ORDER BY pr.dt_promv) AS cargo_anterior
   FROM ovrsgp.tb_prom pr
     JOIN ovrsgp.tb_pess p ON pr.id_pess_fk = p.id_pess
     JOIN ovrsgp.tb_cargo c ON pr.id_cargo_fk = c.id_cargo
     JOIN ovrsgp.tb_tipo_prom tp ON pr.id_tipo_prom_fk = tp.id_tipo_prom
  WHERE pr.ic_efet = 'S'::bpchar;