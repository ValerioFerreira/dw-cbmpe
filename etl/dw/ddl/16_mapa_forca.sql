-- Mapa de Forca para o app (rota nominal GET /dados/mapa-forca/*).
--
-- Ate 2026-10-06 o painel lia ~90 arquivos JSON de public/dados/mapa-forca/
-- (12 MB, matricula + nome de guerra de cada militar, gerados por
-- etl/mapa_forca/extract_mapa_forca.py e servidos sem login). Agora o backend
-- le estas views, recorta pelo perfil do usuario no servidor e devolve o dia
-- pedido -- a mesma regra das demais rotas nominais (D6 de DW_INGESTAO.md).
--
-- RETENCAO: o app so apresenta os ULTIMOS 30 DIAS (decisao do usuario,
-- 2026-09-29), contados a partir do ultimo dia carregado -- a janela anda
-- sozinha com a carga. O core continua com o historico completo (desde 2019)
-- ate o corte fisico ser decidido; o resumo agregado que sobrevive a ele e
-- marts.emprego_viatura_resumo.
--
-- Sem nome completo, CPF ou qualquer dado alem do que o painel mostra:
-- matricula, posto/graduacao, nome de guerra e funcao no servico.

-- Ultimo dia com lancamento e inicio da janela de 30 dias.
CREATE OR REPLACE VIEW marts.mapa_forca_janela AS
SELECT max(t.data)                 AS data_fim,
       max(t.data) - 29            AS data_inicio
FROM core.fato_lancamento_militar f
JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo;

-- Um lancamento = uma guarnicao (e uma viatura, quando ha) num posto de
-- servico, num turno, num dia. `sigla` e a do ORGANOGRAMA do app (dono mais
-- proximo da OME, como em marts.efetivo_organograma): e por ela que o
-- servidor recorta por perfil.
CREATE OR REPLACE VIEW marts.mapa_forca_lancamento AS
WITH base AS (
    SELECT f.id_lancamento, t.data, f.sk_ome, f.sk_posto_servico,
           f.sk_tipo_servico, f.sk_turno, 1 AS prioridade
    FROM core.fato_lancamento_militar f
    JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
    JOIN marts.mapa_forca_janela j ON t.data BETWEEN j.data_inicio AND j.data_fim
    UNION ALL
    SELECT f.id_lancamento, t.data, f.sk_ome, f.sk_posto_servico,
           f.sk_tipo_servico, f.sk_turno, 2
    FROM core.fato_lancamento_viatura f
    JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
    JOIN marts.mapa_forca_janela j ON t.data BETWEEN j.data_inicio AND j.data_fim
),
unico AS (
    SELECT DISTINCT ON (id_lancamento) *
    FROM base
    ORDER BY id_lancamento, prioridade
)
SELECT u.id_lancamento,
       u.data,
       d.sigla_organograma   AS sigla,
       o.sigla               AS ome_dw,
       u.sk_posto_servico    AS id_posto,
       ts.nome               AS tipo_servico,
       tu.nome               AS turno
FROM unico u
LEFT JOIN core.dim_ome o               ON o.sk_ome = u.sk_ome
LEFT JOIN stg.ome_dono_organograma d   ON d.sk_ome = u.sk_ome
LEFT JOIN core.dim_tipo_servico ts     ON ts.sk_tipo_servico = u.sk_tipo_servico
LEFT JOIN core.dim_turno tu            ON tu.sk_turno = u.sk_turno;

-- Viaturas do lancamento. placa nula = viatura que o mapa de forca lancou e
-- a Frota nao conhece: aparece sem link para a ficha, em vez de sumir.
CREATE OR REPLACE VIEW marts.mapa_forca_viatura AS
SELECT f.id_lancamento,
       v.placa,
       v.tipo,
       coalesce(v.tipo_acronym, f.acronimo_origem) AS acronimo,
       coalesce(v.numero_ordem, f.numero_origem)   AS numero
FROM core.fato_lancamento_viatura f
JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
JOIN marts.mapa_forca_janela j ON t.data BETWEEN j.data_inicio AND j.data_fim
LEFT JOIN core.dim_viatura v ON v.sk_viatura = f.sk_viatura
ORDER BY f.id_lancamento, f.sk_lancamento_viatura;

-- Guarnicao do lancamento. `matricula` e a EXIBIDA (com hifen): e a chave da
-- rota /militar/:matricula do app.
CREATE OR REPLACE VIEW marts.mapa_forca_guarnicao AS
SELECT f.id_lancamento,
       coalesce(m.matricula_exibida, f.matricula_origem) AS matricula,
       coalesce(f.posto_origem, pg.sigla)                AS posto_grad,
       m.nome_guerra,
       fs.nome                                           AS funcao
FROM core.fato_lancamento_militar f
JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
JOIN marts.mapa_forca_janela j ON t.data BETWEEN j.data_inicio AND j.data_fim
LEFT JOIN core.dim_militar m              ON m.sk_militar = f.sk_militar
LEFT JOIN core.dim_posto_grad pg          ON pg.sk_posto_grad = m.sk_posto_grad
LEFT JOIN core.dim_funcao_servico fs      ON fs.sk_funcao_servico = f.sk_funcao_servico
ORDER BY f.id_lancamento, f.sk_lancamento_militar;

-- Dado NOMINAL: so o backend (app_reader) le, com recorte por perfil; o BI
-- nao enxerga (mesma regra de marts.efetivo_nominal, 12_nominal.sql). E o
-- ETL (etl_writer) passa a ser dono, para poder recriar as views.
GRANT SELECT ON marts.mapa_forca_janela, marts.mapa_forca_lancamento,
                marts.mapa_forca_viatura, marts.mapa_forca_guarnicao
    TO app_reader;
REVOKE ALL ON marts.mapa_forca_janela, marts.mapa_forca_lancamento,
              marts.mapa_forca_viatura, marts.mapa_forca_guarnicao
    FROM bi_reader;
ALTER VIEW marts.mapa_forca_janela     OWNER TO etl_writer;
ALTER VIEW marts.mapa_forca_lancamento OWNER TO etl_writer;
ALTER VIEW marts.mapa_forca_viatura    OWNER TO etl_writer;
ALTER VIEW marts.mapa_forca_guarnicao  OWNER TO etl_writer;
