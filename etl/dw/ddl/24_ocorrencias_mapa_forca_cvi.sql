-- Mapa de Forca e Ocorrencias como indicadores proprios + painel CVI (2026-10-29).
--
-- Os dois sairam de "Atividades Especificas" e viraram cards na pagina da
-- unidade (depois de Financas). O valor do card vem de GET /dados/metricas, como
-- os demais indicadores: um numero por sigla do organograma, que o front soma pela
-- arvore (aplicarMetricasDw/totaisDaSigla). Pedido do usuario em 2026-10-29.

-- ---------------------------------------------------------------------------
-- Ocorrencias: recebidas nos ultimos 30 dias, pela OME que atendeu. A OME do ROE
-- e sempre um grupamento (1o GB, GBAPH...) e casa com a sigla do organograma sem
-- olhar caixa ("GBMAR" no ROE, "GBMar" no organograma).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.ocorrencias_organograma AS
SELECT o.sigla, count(*) AS ocorrencias_30d
FROM raw_roe.roe_basico_ocorrencias b
JOIN (SELECT DISTINCT sigla FROM app.organograma_unidade) o
  ON upper(o.sigla) = upper(stg.ome_roe(b.ome))
WHERE b.data_recebimento >= current_date - 30
GROUP BY o.sigla;

-- ---------------------------------------------------------------------------
-- Mapa de Forca: militares distintos ATIVADOS no dia que o painel abre -- o mais
-- recente da janela, que e o dia atual (diaPadrao em src/lib/mapaForca.js). O Mapa de
-- Forca e recarregado de 15 em 15 minutos (flow dw_mapa_forca), entao o dia corrente
-- acompanha o que esta sendo lancado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.mapa_forca_organograma AS
WITH dia AS (SELECT max(data) AS data FROM marts.mapa_forca_lancamento)
SELECT l.sigla, dia.data, count(DISTINCT g.matricula) AS militares
FROM marts.mapa_forca_lancamento l
JOIN dia ON dia.data = l.data
JOIN marts.mapa_forca_guarnicao g ON g.id_lancamento = l.id_lancamento AND g.ativado
WHERE l.sigla IS NOT NULL
GROUP BY l.sigla, dia.data;

-- ---------------------------------------------------------------------------
-- Painel CVI (crime violento intencional), aba nova de Ocorrencias.
--
-- Regra (decisao do usuario, 2026-10-29): a ocorrencia de APH e CVI se alguma
-- vitima foi marcada "CVI" na ficha do APH OU se o grupo e "Vitima de Agressao".
-- `origem_cvi` diz qual dos dois criterios a trouxe ('marcacao', 'natureza',
-- 'ambos') -- a diferenca expoe agressoes registradas sem a marcacao.
--
-- Uma linha por vitima com ficha de APH; a ocorrencia CVI sem nenhuma ficha entra
-- com uma linha so, campos de vitima nulos (`vitima` = false). Sem nome,
-- documento, rua, numero nem hospital nominal. Coordenadas arredondadas a 3 casas
-- (~100 m): servem ao mapa e nao apontam a porta de ninguem.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.painel_roe_cvi AS
WITH ocorrencia AS (
    SELECT b.*,
           EXISTS (SELECT 1 FROM raw_roe.roe_aph_ocorrencias a
                   WHERE a.roe_basico_id = b.roe_id AND a.cvi) AS tem_marcacao,
           (b.grupo = 'Vítima de Agressão')                      AS e_agressao
    FROM raw_roe.roe_basico_ocorrencias b
    WHERE b.natureza = 'Atendimento Pré-Hospitalar'
),
cvi AS (
    SELECT * FROM ocorrencia WHERE tem_marcacao OR e_agressao
)
SELECT c.roe_id,
       to_char(c.data_recebimento, 'YYYY-MM-DD"T"HH24:MI:SS')  AS data,
       stg.ome_roe(c.ome)                                     AS ome,
       stg.ome_roe(c.diretoria)                               AS diretoria,
       nullif(trim(c.cidade), '')                             AS cidade,
       nullif(initcap(trim(c.logradouro_bairro)), '')         AS bairro,
       round(c.logradouro_latitude::numeric, 3)               AS lat,
       round(c.logradouro_longitude::numeric, 3)              AS lng,
       nullif(trim(c.grupo), '')                              AS grupo,
       nullif(trim(c.subgrupo), '')                           AS subgrupo,
       CASE WHEN c.tem_marcacao AND c.e_agressao THEN 'ambos'
            WHEN c.tem_marcacao THEN 'marcacao' ELSE 'natureza' END AS origem_cvi,
       c.status_relatorio = 'Finalizado'                      AS finalizado,
       c.ocorrencia_atendida                                  AS atendida,
       coalesce(c.qtde_vitimas_fatais, 0)                     AS vitimas_fatais_ocorrencia,
       -- minutos entre a saida do quartel e a chegada ao local; fora de 0-240 e
       -- erro de digitacao, nao entra
       CASE WHEN c.horario_chegada_ocorrencia >= c.horario_saida_quartel
             AND c.horario_chegada_ocorrencia - c.horario_saida_quartel <= interval '240 minutes'
            THEN round(extract(epoch FROM c.horario_chegada_ocorrencia - c.horario_saida_quartel) / 60.0, 1)
       END                                                    AS tempo_resposta_min,
       a.aph_id IS NOT NULL                                   AS vitima,
       coalesce(a.cvi, false)                                 AS vitima_marcada_cvi,
       -- tipo da agressao: o da ficha (PAF, PAB, agressao fisica...) e, sem ele, o
       -- subgrupo da natureza (arma de fogo, arma branca...), na mesma escala
       CASE coalesce(nullif(trim(a.tipo_agressao_cvi), ''), nullif(trim(c.subgrupo), ''))
            WHEN 'PAF'                THEN 'Arma de fogo'
            WHEN 'Arma de Fogo'       THEN 'Arma de fogo'
            WHEN 'PAB'                THEN 'Arma branca'
            WHEN 'Arma Branca'        THEN 'Arma branca'
            WHEN 'Faca'               THEN 'Arma branca'
            WHEN 'Facão'              THEN 'Arma branca'
            WHEN 'Agressão física'    THEN 'Agressão física'
            WHEN 'Física'             THEN 'Agressão física'
            WHEN 'Objeto Contundente' THEN 'Objeto contundente'
            WHEN 'Sexual'             THEN 'Violência sexual'
            ELSE 'Outros'
       END                                                    AS tipo_agressao,
       nullif(trim(a.genero), '')                             AS genero,
       -- idade_em_meses marca que `idade` foi anotada em meses (bebe): 0 anos
       CASE WHEN a.idade_em_meses THEN 0 ELSE a.idade END    AS idade,
       a.entregue_vivo,
       nullif(trim(a.destino_vitima), '')                     AS destino,
       nullif(trim(a.tipo_hospital), '')                      AS tipo_hospital,
       nullif(trim(a.consciencia_cvi), '')                    AS consciencia,
       stg.normalizar_sigla(stg.ome_roe(c.ome))               AS ome_norm,
       stg.normalizar_sigla(stg.ome_roe(c.diretoria))         AS diretoria_norm
FROM cvi c
LEFT JOIN raw_roe.roe_aph_ocorrencias a ON a.roe_basico_id = c.roe_id;

-- Como os demais paineis: so o backend le (perfil de vitima linha a linha nao vai
-- para o BI). As duas metricas sao agregadas e podem ir.
ALTER VIEW marts.ocorrencias_organograma OWNER TO etl_writer;
ALTER VIEW marts.mapa_forca_organograma OWNER TO etl_writer;
ALTER VIEW marts.painel_roe_cvi OWNER TO etl_writer;
GRANT SELECT ON marts.ocorrencias_organograma, marts.mapa_forca_organograma, marts.painel_roe_cvi TO app_reader;
GRANT SELECT ON marts.ocorrencias_organograma, marts.mapa_forca_organograma TO bi_reader;
REVOKE ALL ON marts.painel_roe_cvi FROM bi_reader;
