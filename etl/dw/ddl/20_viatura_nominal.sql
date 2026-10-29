-- Frota por viatura para o app (2026-10-06): substitui viaturas_lista.json e
-- viaturas_detalhe.json (gerados pelo extrator etl/viaturas/extract_viaturas.py a
-- partir do Neon "Viatura", dentro do bundle e sem login). O backend entrega
-- estas linhas por GET /dados/viaturas, recortadas pelas unidades que o perfil
-- libera no indicador Viaturas.
--
-- Uma linha por veiculo CADASTRADO na Frota (inclusive embarcacoes, motos
-- aquaticas e reboques sem placa: a core.dim_viatura so tem quem tem placa, porque
-- placa e a chave dela). `sigla` e a unidade do organograma em que o veiculo conta:
-- OME da ultima transferencia -> de-para da Frota (stg.de_para_ome, sistema
-- 'frota') -> dono mais proximo no organograma (stg.ome_dono_organograma). Veiculo
-- sem unidade no organograma (ex. GTA) fica de fora, como sempre ficou. Situacao
-- como esta na fonte (ultimo status); quem esconde "Descarregada" e "Devolvida" e
-- o card (frota_organograma, abaixo) e a tela.
--
-- Ultimo status = o REGISTRADO por ultimo (created_at), como o sistema da Frota
-- faz (2026-10-29): a Frota mostrava 721 e o app 806. Antes valia a data do
-- documento (reference_date), que tem anos impossiveis (252024, 62025) e muda o
-- status de 14 veiculos; e o app contava as 80 alugadas "Devolvidas" (a
-- locadora), que a Frota nao conta.
--
-- As regras sao as do script do Windmill que alimentava o Neon
-- (etl/windmill/apps/frota_para_neon.py): ultima transferencia, ultimo status,
-- transacao de combustivel mais recente (odometro e ultimo abastecimento) e a
-- contagem de condutores distintos nas transacoes. A contagem de condutores segue
-- sendo uma hipotese ainda nao confirmada com a Frota (DW_PLANEJAMENTO.md).
-- Nenhum condutor e nominado aqui: so a contagem.
--
-- Depende de tabelas raw_frota.*: se a carga recriar alguma (muda de colunas), a
-- view cai junto e este arquivo precisa ser reaplicado.
CREATE OR REPLACE VIEW marts.viatura_nominal AS
WITH ultima_transferencia AS (
    SELECT DISTINCT ON (t.vehicle_id) t.vehicle_id, trim(o.acronym) AS ome_acronym
    FROM raw_frota.transfers t
    JOIN raw_frota.omes o ON o.id = t.ome_id
    ORDER BY t.vehicle_id, t.transfer_date DESC NULLS LAST, t.created_at DESC
),
ultimo_status AS (
    SELECT DISTINCT ON (vs.vehicle_id) vs.vehicle_id, vst.name AS situacao
    FROM raw_frota.vehicle_statuses vs
    JOIN raw_frota.vehicle_status_types vst ON vst.id = vs.status_type_id
    ORDER BY vs.vehicle_id, vs.created_at DESC, vs.id DESC
),
ultimo_abastecimento AS (
    SELECT DISTINCT ON (vehicle_id)
           vehicle_id,
           mileage     AS odometro,
           total_value AS ultimo_abastecimento_valor,
           time        AS ultimo_abastecimento_data
    FROM raw_frota.fuel_transactions
    ORDER BY vehicle_id, time DESC
),
condutores AS (
    SELECT vehicle_id, count(DISTINCT raw_data->>'condutor')::int AS condutores
    FROM raw_frota.fuel_transactions
    WHERE raw_data->>'condutor' IS NOT NULL AND raw_data->>'condutor' <> ''
    GROUP BY vehicle_id
)
SELECT d.sigla_organograma                       AS sigla,
       v.id,
       nullif(trim(v.license_plate), '')         AS placa,
       vt.name                                   AS tipo,
       vt.acronym                                AS tipo_acronym,
       v.order_number                            AS numero_ordem,
       v.brand                                   AS marca,
       v.model                                   AS modelo,
       nullif(v.year, 0)::int                    AS ano,
       v.patrimony                               AS patrimonio,
       v.renavam,
       v.chassis,
       v.is_tracked                              AS rastreado,
       v.is_characterized                        AS caracterizado,
       posse.name                                AS posse,
       destino.name                              AS destinacao,
       combustivel.name                          AS combustivel,
       categoria.code                            AS categoria_habilitacao,
       us.situacao,
       a.odometro,
       a.ultimo_abastecimento_valor,
       a.ultimo_abastecimento_data,
       c.condutores
FROM raw_frota.vehicles v
JOIN ultima_transferencia ut          ON ut.vehicle_id = v.id
JOIN stg.de_para_ome dp               ON dp.sistema = 'frota' AND dp.valor_origem = ut.ome_acronym
JOIN stg.ome_dono_organograma d       ON d.sk_ome = dp.sk_ome
LEFT JOIN ultimo_status us            ON us.vehicle_id = v.id
LEFT JOIN raw_frota.vehicle_types vt  ON vt.id = v.type_id
LEFT JOIN raw_frota.vehicle_ownership_types posse ON posse.id = v.vehicle_ownership_type_id
LEFT JOIN raw_frota.vehicle_destination_types destino ON destino.id = v.vehicle_destination_type_id
LEFT JOIN raw_frota.vehicle_fuel_types combustivel ON combustivel.id = v.vehicle_fuel_type_id
LEFT JOIN raw_frota.license_categories categoria ON categoria.id = v.license_category_id
LEFT JOIN ultimo_abastecimento a      ON a.vehicle_id = v.id
LEFT JOIN condutores c                ON c.vehicle_id = v.id;

-- Frota e dado de patrimonio, nao de pessoa; mas so o backend (com recorte por
-- perfil) entrega, como as demais nominais -- o BI nao le.
GRANT SELECT ON marts.viatura_nominal TO app_reader;
REVOKE ALL ON marts.viatura_nominal FROM bi_reader;
ALTER VIEW marts.viatura_nominal OWNER TO etl_writer;

-- O card de Viaturas de cada unidade (GET /dados/metricas) passa a contar daqui, e
-- nao mais da core.dim_viatura: a dim so tem veiculo com placa, e a tabela e o
-- dashboard mostram tambem as embarcacoes e reboques sem placa -- card e tabela
-- tem que bater (bug ja reportado em 2026-08-19). Sem as descarregadas e, desde
-- 2026-10-29, sem as devolvidas (alugadas ja entregues a locadora), como a Frota.
-- ATENCAO: a view depende de raw_frota.*; se a carga recriar alguma dessas
-- tabelas, ela cai e este arquivo precisa ser reaplicado.
CREATE OR REPLACE VIEW marts.frota_organograma AS
SELECT sigla, count(*) AS viaturas
FROM marts.viatura_nominal
WHERE situacao IS NULL OR situacao NOT IN ('Descarregada', 'Devolvida')
GROUP BY sigla;
