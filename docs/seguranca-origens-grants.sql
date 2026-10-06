-- Usuario SOMENTE LEITURA para o DW, por banco de origem. Gerado por etl/dw/gerar_grants_leitura.py.
-- O DBA define a senha (guardada nos App Configs / variaveis secretas, nunca no repositorio).
-- Depois: trocar a credencial na variavel de ambiente correspondente e REVOGAR o superusuario atual.

-- ===== 10.193.1.252:54329/frotas_production  (fontes do DW: frota) =====
CREATE ROLE cbmpe_dw_leitura LOGIN PASSWORD '<definir>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE cbmpe_dw_leitura SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE "frotas_production" TO cbmpe_dw_leitura;
GRANT USAGE ON SCHEMA "public" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "brand", "model", "year", "license_plate", "chassis", "order_number", "created_at", "updated_at", "type_id", "vehicle_ownership_type_id", "inclusion_reference_document", "vehicle_fuel_type_id", "patrimony", "renavam", "seats", "is_tracked", "is_characterized", "vehicle_destination_type_id", "license_category_id") ON "public"."vehicles" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "acronym", "description", "created_at", "updated_at", "is_vessel") ON "public"."vehicle_types" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "status_type_id", "author_id", "vehicle_id", "reference_document", "reference_date", "created_at", "updated_at") ON "public"."vehicle_statuses" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "created_at", "updated_at", "color", "still_usable") ON "public"."vehicle_status_types" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "created_at", "updated_at") ON "public"."vehicle_ownership_types" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "acronym", "created_at", "updated_at") ON "public"."vehicle_destination_types" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "created_at", "updated_at") ON "public"."vehicle_fuel_types" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "code", "created_at", "updated_at") ON "public"."license_categories" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "ome_id", "vehicle_id", "transfer_date", "created_at", "updated_at", "reference_document") ON "public"."transfers" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "acronym", "created_at", "updated_at", "discarded_at", "image_link", "sgp_ome_id") ON "public"."omes" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "vehicle_id", "time", "fuel_type", "quantity", "unitary_value", "total_value", "mileage", "external_id", "creation_source", "raw_data", "created_at", "updated_at") ON "public"."fuel_transactions" TO cbmpe_dw_leitura;

-- ===== 10.193.0.16:5432/db_portal_sistemas_prod  (fontes do DW: sgp, escala) =====
CREATE ROLE cbmpe_dw_leitura LOGIN PASSWORD '<definir>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE cbmpe_dw_leitura SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE "db_portal_sistemas_prod" TO cbmpe_dw_leitura;
GRANT USAGE ON SCHEMA "ovresc" TO cbmpe_dw_leitura;
GRANT USAGE ON SCHEMA "ovrsgp" TO cbmpe_dw_leitura;
GRANT SELECT ("id_ome", "id_ome_fk", "ds_hiera_ome", "nr_nivel_ome", "nm_ome", "sg_ome", "en_ome", "en_nr_ome", "en_bair_ome", "en_cidd_ome", "en_uf_ome", "en_cep_ome", "en_compl_ome", "en_pont_refer", "en_url", "ic_tipo", "nr_latd", "nr_long", "ic_stat", "dt_incl", "dt_atlz") ON "ovrsgp"."tb_ome" TO cbmpe_dw_leitura;
GRANT SELECT ("id_secao", "id_ome_fk", "id_secao_fk", "ds_hiera_secao", "nr_nivel_secao", "nm_secao", "sg_secao", "en_secao", "en_nr_secao", "en_bair_secao", "en_cidd_secao", "en_uf_secao", "en_cep_secao", "en_compl_secao", "en_pont_refer", "ic_tipo", "nr_latd", "nr_long", "ic_stat", "dt_incl", "dt_atlz", "ic_secr") ON "ovrsgp"."tb_secao" TO cbmpe_dw_leitura;
GRANT SELECT ("id_posto", "nm_posto", "en_logr", "en_nr", "en_bair", "en_cidd", "en_estd", "en_cep", "en_compl", "en_latd", "en_long", "ic_stat", "dt_incl", "dt_atlz", "id_ome_respo_fk", "ic_regia", "ds_cntt", "id_usur_fk", "nr_ais", "nr_ordenacao") ON "ovresc"."tb_posto" TO cbmpe_dw_leitura;
GRANT SELECT ("id_turn_servi", "ds_turn_servi", "ic_stat", "hr_inic", "hr_term", "dt_incl", "dt_atlz", "id_usur_fk", "qtd_horas") ON "ovresc"."tb_turn_servi" TO cbmpe_dw_leitura;
GRANT SELECT ("id_tipo_servi", "ds_tipo_servi", "ic_stat", "dt_incl", "dt_atlz", "id_usur_fk", "nr_ordenacao") ON "ovresc"."tb_tipo_servi" TO cbmpe_dw_leitura;
GRANT SELECT ("id_func_oper", "ds_func_oper", "ic_stat", "dt_incl", "dt_atlz", "id_usur_fk", "nr_ordenacao", "ds_servico") ON "ovresc"."tb_func_oper" TO cbmpe_dw_leitura;
GRANT SELECT ("id_natur_servi", "ds_natur_servi", "ic_stat", "dt_incl", "dt_atlz", "id_usur_fk") ON "ovresc"."tb_natur_servi" TO cbmpe_dw_leitura;

-- ===== 10.193.0.20:5432/mapa_forca_api_development  (fontes do DW: mapa_forca) =====
CREATE ROLE cbmpe_dw_leitura LOGIN PASSWORD '<definir>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE cbmpe_dw_leitura SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE "mapa_forca_api_development" TO cbmpe_dw_leitura;
GRANT USAGE ON SCHEMA "public" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "acronym", "discarded_at", "parent_ome_name", "id_scriptcase") ON "public"."omes" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "street", "number", "neighborhood", "city", "state", "latitude", "longitude", "ais", "discarded_at", "id_scriptcase", "ome_id_scriptcase") ON "public"."stations" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "acronym", "created_at", "updated_at", "vehicle_nature_id") ON "public"."vehicle_types" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "description", "created_at", "updated_at") ON "public"."operational_resource_types" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "ome_id", "service_station_id", "service_type_id", "service_shift_id", "date", "active", "created_at", "updated_at", "discarded_at") ON "public"."launches" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "launch_id", "service_occupation_id", "service_category_id", "military_registration", "military_name", "military_warname", "military_rank", "status", "created_at", "updated_at", "discarded_at") ON "public"."launch_militaries" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "launch_id", "vehicle_type_id", "order_number", "status", "created_at", "updated_at", "discarded_at") ON "public"."launch_vehicles" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "launch_id", "operational_resource_type_id", "quantity", "created_at", "updated_at", "discarded_at") ON "public"."launch_operational_resources" TO cbmpe_dw_leitura;

-- ===== 10.193.0.20:5432/vaccine_control_production  (fontes do DW: vacina) =====
CREATE ROLE cbmpe_dw_leitura LOGIN PASSWORD '<definir>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE cbmpe_dw_leitura SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE "vaccine_control_production" TO cbmpe_dw_leitura;
GRANT USAGE ON SCHEMA "public" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "registration", "name", "ome_id", "created_at", "updated_at", "has_health_insurance") ON "public"."militaries" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "record", "created_at", "updated_at") ON "public"."applicators" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "start", "end", "description", "created_at", "updated_at") ON "public"."campaigns" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "acronym", "created_at", "updated_at") ON "public"."omes" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "created_at", "updated_at") ON "public"."vaccines" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "created_at", "updated_at") ON "public"."vaccine_brands" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "date", "post", "vaccine_id", "batch", "recipient_id", "created_at", "updated_at", "campaign_id", "applicator_id", "vaccine_expiration", "vaccine_brand_id") ON "public"."vaccinations" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "symbol", "created_at", "updated_at") ON "public"."measurement_units" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "name", "created_at", "updated_at", "measurement_unit_id", "reference_type", "min_value", "max_value") ON "public"."vital_signs" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "date", "recipient_id", "created_at", "updated_at") ON "public"."vital_sign_records" TO cbmpe_dw_leitura;
GRANT SELECT ("id", "vital_sign_record_id", "vital_sign_id", "value", "created_at", "updated_at") ON "public"."vital_sign_measurements" TO cbmpe_dw_leitura;

-- ===== 10.193.1.252:15432/roe_api_production  (fontes do DW: roe) =====
CREATE ROLE cbmpe_dw_leitura LOGIN PASSWORD '<definir>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE cbmpe_dw_leitura SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE "roe_api_production" TO cbmpe_dw_leitura;
GRANT USAGE ON SCHEMA "public" TO cbmpe_dw_leitura;
GRANT SELECT ("roe_id", "protocolo", "data_recebimento", "status_relatorio", "diretoria", "ome", "ome_secao", "natureza", "grupo", "subgrupo", "qtde_vitimas_feridas", "qtde_vitimas_fatais", "qtde_vitimas_ilesas", "qtde_vitimas_desaparecidas", "ocorrencia_atendida", "motivo_naoatendimento", "descricao_naoatendimento", "logradouro_bairro", "logradouro_latitude", "logradouro_longitude", "cidade", "matricula_chefe_guarnicao", "matricula_oficial_operacoes", "viaturas", "odometro_saida", "odometro_local", "odometro_retorno", "horario_saida_quartel", "horario_chegada_ocorrencia", "horario_saida_ocorrencia", "horario_chegada_hospital", "horario_saida_hospital", "horario_retorno_quartel", "data_criacao", "data_ultima_atualizacao", "protocolo_completo") ON "public"."roe_basico_ocorrencias" TO cbmpe_dw_leitura;
GRANT SELECT ("roe_id", "protocolo_completo", "protocolo", "data_recebimento", "status_relatorio", "diretoria", "ome", "ome_secao", "natureza", "grupo", "subgrupo", "qtde_vitimas_feridas", "qtde_vitimas_fatais", "qtde_vitimas_ilesas", "qtde_vitimas_desaparecidas", "ocorrencia_atendida", "motivo_naoatendimento", "descricao_naoatendimento", "logradouro_bairro", "logradouro_latitude", "logradouro_longitude", "cidade", "matricula_chefe_guarnicao", "matricula_oficial_operacoes", "viaturas", "odometro_saida", "odometro_local", "odometro_retorno", "horario_saida_quartel", "horario_chegada_ocorrencia", "horario_saida_ocorrencia", "horario_chegada_hospital", "horario_saida_hospital", "horario_retorno_quartel", "data_criacao", "data_ultima_atualizacao") ON "public"."roe_basico_ocorrencias_nova" TO cbmpe_dw_leitura;
GRANT SELECT ("roe_id", "protocolo", "data_recebimento", "ocorrencia_atendida", "status_relatorio", "data_criacao", "data_ultima_atualizacao", "ome", "ome_secao", "natureza", "grupo", "subgrupo", "logradouro_bairro", "logradouro_latitude", "logradouro_longitude", "cidade", "matricula_chefe_guarnicao", "matricula_oficial_operacoes", "viaturas") ON "public"."roe_resumo_ocorrencias" TO cbmpe_dw_leitura;
GRANT SELECT ("aph_id", "roe_basico_id", "numero_documento", "emissor_documento", "idade", "idade_em_meses", "bombeiro_de_plantao", "numero", "complemento", "bairro", "temperatura_corporal", "frequencia_cardiaca", "frequencia_respiratoria", "pressao_sistolica", "pressao_diastolica", "vias_aereas_queimadas", "criado_em", "atualizado_em", "crm_ou_coren", "numero_prontuario", "cvi", "preso_em_ferragens", "entregue_vivo", "saturacao_o2", "genero", "destino_vitima", "tipo_hospital", "tipo_agressao_cvi", "consciencia_cvi", "respiracao_cvi", "frequencia_cardiaca_cvi", "condicao_pele_cvi", "situacao_vitima", "status_deficiencia", "tipo_veiculo_vitima", "condicao_seguranca_vitima", "posicao_vitima", "imobilizacao_realizada") ON "public"."roe_aph_ocorrencias" TO cbmpe_dw_leitura;
GRANT SELECT ("incendio_id", "roe_basico_id", "duracao_combate", "duracao_rescaldo", "duracao_combate_horas", "duracao_rescaldo_horas", "duracao_total_horas", "consumo_agua", "consumo_lge", "edificacao_pavimento_atingido_de", "edificacao_pavimento_atingido_ate", "edificacao_area_total_atingida", "edificacao_area_total", "edificacao_local_origem_incendio", "vegetacao_apa", "vegetacao_area_atingida", "vegetacao_area_total", "situacao_avcb", "sac_protocolo", "sac_validade", "nome_ocupacao", "encaminhar_cat", "bens_atingidos", "bens_salvos", "bens_entregues_documento", "bens_entregues_fone", "bens_entregues_tipo", "hidrante_cadastrado", "hidrante_cadastrado_numero", "hidrante_compesa") ON "public"."roe_incendio_ocorrencias" TO cbmpe_dw_leitura;
GRANT SELECT ("salvamento_id", "roe_basico_id", "relacionado_a_desastre", "codigo_desastre", "tipo_predominante", "tipo_predominante_descricao", "houve_captura_animal", "tipo_animal", "condicao_animal", "especificacao_animal", "destino_animal", "documento_responsavel_animal", "emissor_documento_responsavel", "descricao_pessoa_envolvida", "houve_operacao_mergulho", "local_mergulho", "ambiente_mergulho", "visibilidade_metros", "tipo_visibilidade", "possui_correnteza", "recursos_utilizados", "tipos_fundo_mergulho", "vitima_id", "vitima_idade", "vitima_idade_em_meses", "vitima_genero", "vitima_corpo_encontrado", "vitima_bombeiro", "vitima_afogamento", "vitima_grau_afogamento", "mergulhador_id", "mergulhador_posto_graduacao", "mergulhador_matricula", "cilindro_numero_serie", "intervalo_superficie", "tempo_fundo", "profundidade_metros", "pressao_inicial", "pressao_final", "data_criacao", "data_ultima_atualizacao") ON "public"."roe_salvamento_ocorrencias" TO cbmpe_dw_leitura;
GRANT SELECT ("prevencao_id", "roe_basico_id", "protocolo", "data_recebimento", "status_relatorio", "diretoria", "ome", "ome_secao", "natureza", "grupo", "subgrupo", "cidade", "logradouro_bairro", "logradouro_latitude", "logradouro_longitude", "nome_evento", "duracao_evento", "duracao_evento_horas", "publico_estimado", "publico_presente", "evento_regularizado", "area_estimada", "nome_estabelecimento", "responsavel", "sac_protocolo", "sac_validade", "documento_referencia", "situacao_avcb", "encaminhado_cat", "descricao_cat", "sei_cat", "informacoes_adicionais", "servicos_realizados", "sistemas_preventivos", "suportes_presentes", "estruturas_apoio", "aquaticos", "data_criacao", "data_atualizacao") ON "public"."roe_prevencao_ocorrencias" TO cbmpe_dw_leitura;
GRANT SELECT ("prod_perigosos_id", "roe_basico_id", "nome_produto", "numero_onu", "classe_risco", "tipo_recipiente", "descricao_recipiente", "estado_fisico", "responsavel_produto", "documento_responsavel", "valor_estimado_vazamento", "unidade_medida_vazamento", "valor_estimado_recipiente", "unidade_medida_recipiente", "qtde_pessoas_contaminadas", "qtde_pessoas_irradiadas", "qtde_pessoas_evacuadas", "qtde_obitos", "qtde_pessoas_feridas", "area_isolada", "unidade_medida_area_isolada", "area_contaminada", "unidade_medida_area_contaminada", "area_evacuada", "unidade_medida_area_evacuada", "situacao_avcb", "sac_protocolo", "sac_validade", "razao_social", "encaminhado_cat", "descricao_cat", "sei_cat", "perfil_botijao_glp", "descricao_perfil_botijao_glp", "distribuidora_glp", "descricao_distribuidora_glp", "condicao_cilindro", "condicao_valvula", "condicao_mangueira", "destinacao", "informacoes_adicionais", "relacionado_a_desastre", "codigo_desastre", "ambientes_atingidos", "motivos_provaveis_glp", "causas_provaveis_incidente", "acoes_realizadas", "data_criacao", "data_ultima_atualizacao") ON "public"."roe_prod_perigosos_ocorrencias" TO cbmpe_dw_leitura;

-- ===== Backend do app (login por CPF): so o que omeResolver.js consulta no SGP =====
CREATE ROLE cbmpe_app_leitura LOGIN PASSWORD '<definir>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE cbmpe_app_leitura SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE "db_portal_sistemas_prod" TO cbmpe_app_leitura;
GRANT USAGE ON SCHEMA "ovrsgp" TO cbmpe_app_leitura;
GRANT SELECT (nr_matr_pess, nm_pess, nr_cpf_pess) ON "ovrsgp"."tb_pess" TO cbmpe_app_leitura;
