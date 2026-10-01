-- Views NOMINAIS para o app (2026-09-29). Contem dado pessoal: o backend so
-- as entrega atras de login SGU e filtradas pelas unidades que o perfil do
-- usuario enxerga (backend/services/acessoService.js). bi_reader NAO recebe
-- grant nelas -- o Metabase le so os agregados.

-- ---------------------------------------------------------------------------
-- Relacao nominal do efetivo -- mesmo conteudo de src/data/real/
-- efetivo_lista.json (etl/efetivo/extract_efetivo.py), no ultimo dia do DW.
-- ---------------------------------------------------------------------------
-- sigla        a unidade do organograma em que o militar conta (regra do
--              ancestral mais proximo, stg.ome_dono_organograma).
-- ome_exibicao a OME de origem, quando nao e a propria unidade -- setor
--              vinculado (CPPA na DGP) e adido (ADIDO no Comando Geral).
--              "ADIDO" e a grafia que o app sempre mostrou (a OME no DW e
--              "ADIDOS").
CREATE OR REPLACE VIEW marts.efetivo_nominal AS
SELECT d.sigla_organograma                                   AS sigla,
       CASE WHEN d.distancia > 0
            THEN CASE o.sigla WHEN 'ADIDOS' THEN 'ADIDO' ELSE o.sigla END
       END                                                   AS ome_exibicao,
       pg.sigla                                              AS posto_grad,
       m.matricula_exibida                                   AS matricula,
       m.matricula                                           AS matricula_normalizada,
       m.nome,
       m.nome_guerra,
       m.sexo,
       extract(year FROM age(current_date, m.data_nascimento))::int AS idade,
       m.antiguidade_geral                                   AS ordem,
       -- bloco "completo" (painel "Verificar dados completos")
       m.raca_cor,
       f.pcd,
       c.telefone_1,
       c.telefone_2,
       extract(year FROM age(current_date, m.data_ingresso))::int  AS tempo_servico_anos,
       (current_date - m.data_movimentacao_sp)               AS tempo_obm_atual_dias,
       m.ome_anterior,
       CASE WHEN f.adido THEN oe.nome ELSE 'CBMPE' END       AS orgao,
       f.horario_especial,
       f.readaptado,
       m.acumulo_cargos,
       f.le,
       f.ltip,
       ta.sigla                                              AS afastamento_sup_90_dias,
       sp.numero_ano                                         AS suplemento_pessoal,
       sp.data_publicacao                                    AS data_suplemento_pessoal,
       (to_char(m.data_nascimento, 'MMDD') = to_char(current_date, 'MMDD')) AS aniversario,
       m.data_movimentacao_sp,
       m.data_ingresso,
       m.data_ultima_promocao,
       coalesce(pp.principio ILIKE '%PCNH%', false)          AS pcnh,
       t.data                                                AS data_referencia,
       -- Agregado: marca "Ag" na coluna OBS do Peculio (sozinha, ou junto de
       -- outra, como "Ag - READAP"). Conta na OME da coluna OME do Peculio.
       coalesce(m.observacao ~* '(^|[^A-Za-z])Ag([^A-Za-z]|$)', false) AS agregado,
       -- Regra de "indisponivel" (decisao do usuario, 2026-10-01): adido, ou
       -- afastado (LTS/LM), ou LTIP, ou LE, ou agregado. Readaptado sozinho
       -- continua disponivel. E a mesma regra de ehIndisponivel() em
       -- src/lib/efetivoDashboard.js -- mude as duas juntas.
       (f.adido OR o.sigla = 'ADIDOS' OR f.afastado OR f.le OR f.ltip
        OR coalesce(m.observacao ~* '(^|[^A-Za-z])Ag([^A-Za-z]|$)', false)) AS indisponivel
FROM core.fato_efetivo_diario f
JOIN core.dim_tempo t      ON t.sk_tempo = f.sk_tempo
JOIN core.dim_militar m    ON m.sk_militar = f.sk_militar
JOIN core.dim_ome o        ON o.sk_ome = f.sk_ome AND o.conta_efetivo
JOIN stg.ome_dono_organograma d ON d.sk_ome = f.sk_ome
LEFT JOIN core.dim_posto_grad pg          ON pg.sk_posto_grad = m.sk_posto_grad
LEFT JOIN core.contato_militar c          ON c.sk_militar = m.sk_militar
LEFT JOIN core.dim_orgao_externo oe       ON oe.sk_orgao_externo = f.sk_orgao_externo
LEFT JOIN core.dim_tipo_afastamento ta    ON ta.sk_tipo_afastamento = f.sk_tipo_afastamento
LEFT JOIN core.dim_suplemento_pessoal sp  ON sp.sk_suplemento = m.sk_suplemento
LEFT JOIN core.dim_principio_promocao pp  ON pp.sk_principio_promocao = m.sk_principio_promocao
WHERE f.sk_tempo = (SELECT max(sk_tempo) FROM core.fato_efetivo_diario);

-- ---------------------------------------------------------------------------
-- Lotacao por funcao (QOD) -- mesmo conteudo de por_matricula + funcoes em
-- src/data/real/lotacao_funcao.json. So militares do efetivo ativo (e por
-- eles que o backend filtra por unidade).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.lotacao_militar AS
SELECT e.sigla,
       e.matricula,                          -- como o app a conhece (com hifen)
       oc.id_funcao,
       oc.antiguidade,
       oc.bge,
       oc.cursos,
       oc.portaria,
       oc.funcao_de                          AS posto_funcao,
       f.tipo_funcao                         AS tipo,
       f.funcao,
       f.secao,
       f.ome_qod                             AS ome,
       f.ome_completa,
       f.localidade
FROM core.qod_ocupacao oc
JOIN marts.efetivo_nominal e ON e.matricula_normalizada = oc.matricula
LEFT JOIN core.qod_funcao f  ON f.id_funcao = oc.id_funcao;

-- So o backend (app_reader) le as nominais; o BI fica com os agregados.
REVOKE ALL ON marts.efetivo_nominal, marts.lotacao_militar FROM bi_reader;
GRANT SELECT ON marts.efetivo_nominal, marts.lotacao_militar TO app_reader;
