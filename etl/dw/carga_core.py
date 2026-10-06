# requirements:
# psycopg2-binary
"""Constroi stg e core a partir de raw. E aqui que a regra de negocio mora.

Ordem: dim_tempo -> dim_ome (+ closure) -> demais dimensoes -> de-para ->
fatos. Idempotente: cada etapa limpa e reconstroi o que produz.

As decisoes de negocio encodadas aqui estao todas registradas em
DW_PLANEJAMENTO.md (entrada 2026-08-24) e DW_MODELO_DADOS.md:

- As duas DGP (id 25 e id 8 "DGP.") sao a mesma unidade -- somar. A id 8 sai
  da dimensao e seus filhos sao repontados para a 25.
- ADIDO (id 4) e a OME fantasma "ADIDOS". Na fonte ela pende da DGP, mas o
  adido NAO conta como efetivo da DGP: aqui ela e repontada para o COMANDO
  GERAL. Assim o adido some no orgao externo, na OME fantasma, no rollup do
  Comando Geral e no total -- sem duplicidade.
- CPPA (id 22) e setor vinculado: ja pende da DGP na fonte, entao o rollup
  ja funciona. So recebe o rotulo.
- INATIVOS/OUT SIT/LIC/CFHP sao estado funcional modelado como OME, nao
  unidade: conta_efetivo = false, senao inativo e licenciado entrariam no
  efetivo da DGP por rollup.
- Seis unidades extintas seguem com ic_stat='A' na fonte. Nao as inativamos
  la (o usuario ainda vai confirmar se algo depende delas), mas aqui elas
  entram como extintas.

Uso:
    python carga_core.py
"""
import os
import re
import unicodedata
from datetime import date, timedelta

import psycopg2
from psycopg2.extras import execute_values

# --- regras de OME, ver docstring -------------------------------------------
SK_CG = 23
SK_DGP = 25
SK_DGP_DUPLICADA = 8
SK_ADIDO = 4
SK_CPPA = 22
SK_SCG = 18
SITUACOES = {3, 5, 6, 80}
EXTINTAS = {35, 37, 42, 54, 57, 86}
SK_DGA = 9001

# De-para de sigla do Peculio para sigla do SGP, so onde a normalizacao
# automatica nao resolve.
PECULIO_PARA_SGP = {
    "SG": "SCG",
    "CAT Zona da Mata": "CAT / ZM",
    "CAT Agreste": "CAT / AGRESTE",
    "CAT Sertão": "CAT / SERTÃO",
    "CAT/RMR": "CAT / RMR",
    "CG": "CG",
    "ADIDO": "ADIDOS",
    "CAT MATA": "CAT / ZM",
    # O GTA nao e OME do CBMPE: quem serve la e adido, com orgao externo GTA
    # (confirmado pelo usuario em 2026-08-24). Ele aparece como unidade no
    # cadastro da Frota, e e por isso que as viaturas de la caem na OME
    # fantasma ADIDOS em vez de ficarem sem unidade.
    "GTA": "ADIDOS",
}


def normalizar(texto):
    if not texto:
        return ""
    base = unicodedata.normalize("NFKD", str(texto))
    base = "".join(c for c in base if not unicodedata.combining(c))
    return "".join(c for c in base.upper() if c.isalnum())


def normalizar_numero(numero):
    """Numero de ordem comparavel entre Frota e mapa de forca."""
    texto = str(numero or "").strip().upper()
    if texto.endswith("L"):
        texto = texto[:-1]
    return texto.lstrip("0") or texto


def url_do_dw():
    base, _, _ = os.environ["DATABASE_URL_DW"].rpartition("/")
    return f"{base}/dw"


# De-para entre a sigla do organograma e a do SGP, onde a normalizacao
# automatica nao resolve. Sao seis, todas variacao de escrita da mesma
# unidade -- nenhuma e unidade diferente.
ORGANOGRAMA_PARA_SGP = {
    "COMANDO GERAL": "CG",
    "SUBCOMANDO GERAL": "SCG",
    "DINTER I": "DINTER/1",
    "DINTER II": "DINTER/2",
    "CAT/AG": "CAT / AGRESTE",
    "CAT/SE": "CAT / SERTÃO",
}

# OMEs que so existem no SGP e cuja hierarquia de la esta obsoleta. Regras
# derivadas de decisoes ja tomadas com o usuario:
# - GBFN deixou de ser Grupamento e virou Secao (SBFN) vinculada ao GBI. No
#   SGP ela ainda pende do COM, que esta inativo.
# - As CAT numeradas foram absorvidas pela de numero 1 (mesma decisao que
#   valeu para as coordenadas), entao acompanham o pai da sua CAT base. No
#   SGP todas pendem do COESP, tambem inativo.
PAI_POR_REGRA = {
    "GBFN": "GBI",
    "AJ": "GCG",            # confirmado pelo usuario em 2026-08-24
    "CAT / SERTÃO 2": "CAT / SERTÃO", "CAT / SERTÃO 3": "CAT / SERTÃO",
    "CAT / SERTÃO 4": "CAT / SERTÃO", "CAT / SERTÃO 5": "CAT / SERTÃO",
    "CAT / SERTÃO 6": "CAT / SERTÃO",
    "CAT / ZM 2": "CAT / ZM",
    "CAT / AGRESTE 2": "CAT / AGRESTE", "CAT / AGRESTE 3": "CAT / AGRESTE",
}

# Unidades que o SGP ainda marca como ativas mas que nao existem mais --
# confirmado pelo usuario em 2026-08-24, ao revisar as 8 OMEs ativas no SGP
# fora do organograma. Sobreviveram so a AJ (hoje sob o GCG) e o GBFN, que
# virou Secao (SBFN) sob o GBI. Como as demais, elas nao sao inativadas na
# fonte -- so entram aqui como extintas.
EXTINTAS_CONFIRMADAS = {"CAC", "CPA", "CPTO", "CTA", "CEMET II", "DFEA"}


def arvore_do_organograma(cur):
    """Le a hierarquia de app.organograma_unidade (banco `dw`).

    O organograma e a autoridade sobre QUEM PENDE DE QUEM (decisao do usuario,
    2026-08-24); a tb_ome do SGP continua sendo o registro do QUE EXISTE. As
    duas divergem em pontos reais: o SGP pendura DAS e CEFD na DGP, o
    organograma as coloca sob DGA e DEIP.

    Ate 2026-09-23 isto lia direto `const ARVORE` de src/data/organograma.js
    via regex. Trocado porque o organograma passou a ser editavel pelo
    administrador (ver src/components/admin/OrganogramaEditor.jsx) e
    persistido em backend/data/organograma.json. Desde 2026-09-25 o backend
    grava na tabela app.organograma_unidade, no proprio banco `dw` (ver
    etl/dw/ddl/06_app.sql) -- lida aqui pelo mesmo cursor da carga, entao a
    proxima carga do DW reflete as edicoes do admin sem sincronizar nada.
    Falha alto se vier vazia, o unico modo de falha silenciosa possivel.
    """
    cur.execute("SELECT id, sigla, parent_id FROM app.organograma_unidade")
    unidades = [{"id": i, "sigla": s, "parentId": p} for i, s, p in cur.fetchall()]

    por_id = {u["id"]: u for u in unidades}
    arvore = {}
    pai_de_filho = {}
    for u in unidades:
        if u.get("parentId") is None:
            continue
        pai_sigla = por_id[u["parentId"]]["sigla"]
        arvore.setdefault(pai_sigla, []).append(u["sigla"])
        pai_de_filho[u["sigla"]] = pai_sigla
    if len(arvore) < 5:
        raise SystemExit(f"app.organograma_unidade com so {len(arvore)} nos com filhos -- rode backend/scripts/semear_estado_app.js.")

    return arvore, pai_de_filho


def coordenadas_das_omes(cur):
    """Coordenada por id_ome do SGP, ja casada por
    etl/sgp/casar_coordenadas_ome.py --gravar-dw (as regras foram revisadas
    uma a uma com o usuario e so existem la). Ate 2026-09-29 este script
    importava aquele arquivo do disco e lia o banco dw_dim; agora le so o
    `dw`, para rodar no Windmill -- o casamento e o passo anterior do flow."""
    cur.execute("SELECT id_ome, latitude::float, longitude::float FROM stg.coordenada_ome")
    return {int(i): (lat, lon) for i, lat, lon in cur.fetchall()}


# ---------------------------------------------------------------------------
# dim_tempo
# ---------------------------------------------------------------------------
def carregar_dim_tempo(cur):
    cur.execute("""
        INSERT INTO core.dim_tempo
            (sk_tempo, data, ano, mes, dia, trimestre, nome_mes,
             dia_semana, nome_dia, fim_de_semana, ano_mes)
        SELECT
            (to_char(d, 'YYYYMMDD'))::int, d::date,
            extract(year FROM d)::int, extract(month FROM d)::int,
            extract(day FROM d)::int, extract(quarter FROM d)::int,
            to_char(d, 'TMMonth'),
            extract(dow FROM d)::int, to_char(d, 'TMDay'),
            extract(isodow FROM d) >= 6, to_char(d, 'YYYY-MM')
        FROM generate_series('2019-01-01'::date, '2030-12-31'::date, '1 day') d
        ON CONFLICT (sk_tempo) DO NOTHING
    """)
    cur.execute("SELECT count(*) FROM core.dim_tempo")
    print(f"  dim_tempo                    {cur.fetchone()[0]:>8}")


# ---------------------------------------------------------------------------
# dim_ome + closure
# ---------------------------------------------------------------------------
def carregar_dim_ome(cur):
    coords = coordenadas_das_omes(cur)

    cur.execute("""
        SELECT id_ome, id_ome_fk, sg_ome, nm_ome, ic_tipo, nr_nivel_ome,
               ds_hiera_ome, ic_stat, en_cidd_ome
        FROM raw_sgp.tb_ome ORDER BY id_ome
    """)
    fonte = cur.fetchall()

    def pai_resolvido(fk):
        """A DGP duplicada sai da dimensao: quem pendia dela passa a pender
        da DGP de verdade."""
        if fk is None:
            return None
        fk = int(fk)
        return SK_DGP if fk == SK_DGP_DUPLICADA else fk

    linhas = []
    for (id_ome, fk, sigla, nome, tipo, nivel, hierarquia, stat, cidade) in fonte:
        id_ome = int(id_ome)
        if id_ome == SK_DGP_DUPLICADA:
            continue  # fundida na DGP (id 25)

        sigla = (sigla or "").strip()
        pai = pai_resolvido(fk)

        if id_ome == SK_ADIDO:
            sigla, nome = "ADIDOS", "ADIDOS (efetivo em orgaos externos)"
            pai = SK_CG          # override: adido nao conta como efetivo da DGP
            tipo_registro, conta = "fantasma", True
        elif id_ome == SK_CPPA:
            tipo_registro, conta = "setor_vinculado", True
        elif id_ome in SITUACOES:
            tipo_registro, conta = "situacao", False
        else:
            tipo_registro, conta = "ome", True

        if id_ome in EXTINTAS or sigla in EXTINTAS_CONFIRMADAS:
            status, conta = "extinta", False
        elif stat == "I":
            status, conta = "inativa", False
        else:
            status = "ativa"

        lat, lon = coords.get(id_ome, (None, None))
        linhas.append((
            id_ome, id_ome, sigla, (nome or "").strip(), tipo,
            int(nivel) if nivel is not None else None, hierarquia, pai,
            (cidade or "").strip() or None, lat, lon,
            status, tipo_registro, conta, "ovrsgp.tb_ome",
        ))

    # DGA: existe no organograma, ainda nao foi criada de fato.
    linhas.append((
        SK_DGA, None, "DGA", "DIRETORIA DE GESTAO ADMINISTRATIVA", "AD", 1,
        None, SK_SCG, None, None, None, "planejada", "planejada", False,
        "organograma",
    ))

    # ---- o organograma passa a mandar na hierarquia -------------------------
    # Ate aqui o sk_ome_pai veio do SGP. Agora, para toda unidade que consta
    # do organograma, ele e substituido pelo pai de la. Isso corrige, entre
    # outros, DAS (que o SGP pendura na DGP e o organograma poe sob a DGA) e
    # CEFD (SGP: DGP; organograma: DEIP).
    _arvore, pai_organograma = arvore_do_organograma(cur)
    por_sigla_norm = {normalizar(l[2]): l[0] for l in linhas}
    por_sigla_norm[normalizar("DGA")] = SK_DGA

    def sk_da_sigla_organograma(sigla):
        alvo = ORGANOGRAMA_PARA_SGP.get(sigla, sigla)
        return por_sigla_norm.get(normalizar(alvo))

    no_organograma = {normalizar(ORGANOGRAMA_PARA_SGP.get(s, s))
                      for s in set(pai_organograma) | set(_arvore)}

    ajustadas = []
    for i, l in enumerate(linhas):
        sigla = l[2]
        sk = l[0]
        esta_no_organograma = normalizar(sigla) in no_organograma
        novo_pai, origem_hier = l[7], "sgp"

        sigla_org = next((s for s in pai_organograma
                          if normalizar(ORGANOGRAMA_PARA_SGP.get(s, s)) == normalizar(sigla)),
                         None)
        if sigla_org is not None:
            pai_no_organograma = pai_organograma[sigla_org]
            # A DGA existe no organograma mas ainda nao foi criada de fato.
            # Enquanto for planejada, quem penderia dela pende direto do
            # Subcomando Geral -- senao o rollup atravessaria uma unidade que
            # nao existe, e o Subcomando so somaria por acidente. Decisao do
            # usuario em 2026-08-24. Quando a DGA for ativada, basta trocar o
            # status e a hierarquia do organograma volta a valer sozinha.
            if pai_no_organograma == "DGA":
                pai_no_organograma = "SUBCOMANDO GERAL"
            candidato = sk_da_sigla_organograma(pai_no_organograma)
            if candidato is not None and candidato != sk:
                if candidato != l[7]:
                    ajustadas.append((sigla, l[7], candidato))
                novo_pai, origem_hier = candidato, "organograma"
        elif sigla in PAI_POR_REGRA:
            candidato = por_sigla_norm.get(normalizar(PAI_POR_REGRA[sigla]))
            if candidato is not None and candidato != sk:
                if candidato != l[7]:
                    ajustadas.append((sigla, l[7], candidato))
                novo_pai, origem_hier = candidato, "regra"

        # ADIDOS mantem o override proprio: pende do Comando Geral.
        if sk == SK_ADIDO:
            novo_pai, origem_hier = SK_CG, "regra"

        linhas[i] = l[:7] + (novo_pai,) + l[8:] + (esta_no_organograma, origem_hier)

    sigla_por_sk = {l[0]: l[2] for l in linhas}
    if ajustadas:
        print("    hierarquia reescrita pelo organograma:")
        for sigla, antes, depois in ajustadas:
            print(f"      {sigla:<18} {sigla_por_sk.get(antes, antes)} -> {sigla_por_sk.get(depois, depois)}")

    cur.execute("DELETE FROM core.dim_ome_ancestral")
    cur.execute("DELETE FROM core.dim_ome")

    # Insere sem o pai primeiro, senao a FK auto-referente quebra na ordem.
    execute_values(cur, """
        INSERT INTO core.dim_ome
            (sk_ome, id_ome, sigla, nome, tipo, nivel, hierarquia, sk_ome_pai,
             municipio, latitude, longitude, status, tipo_registro,
             conta_efetivo, origem, no_organograma, origem_hierarquia)
        VALUES %s
    """, [l[:7] + (None,) + l[8:] for l in linhas])

    execute_values(cur, """
        UPDATE core.dim_ome d SET sk_ome_pai = v.pai
        FROM (VALUES %s) AS v(sk, pai)
        WHERE d.sk_ome = v.sk
    """, [(l[0], l[7]) for l in linhas if l[7] is not None])

    # Closure: uma linha por par (ancestral, descendente), inclusive distancia 0.
    por_sk = {l[0]: l[7] for l in linhas}
    fechamento = []
    for sk in por_sk:
        atual, distancia = sk, 0
        visitados = set()
        while atual is not None and atual not in visitados:
            visitados.add(atual)
            fechamento.append((atual, sk, distancia))
            atual = por_sk.get(atual)
            distancia += 1
    execute_values(cur, """
        INSERT INTO core.dim_ome_ancestral (sk_ome_ancestral, sk_ome_descendente, distancia)
        VALUES %s
    """, fechamento)

    print(f"  dim_ome                      {len(linhas):>8}"
          f"  (closure: {len(fechamento)} pares)")


# ---------------------------------------------------------------------------
# Dimensoes do mapa de forca / escala (autoridade: ovresc)
# ---------------------------------------------------------------------------
def carregar_dimensoes_escala(cur):
    cur.execute("DELETE FROM core.dim_turno")
    cur.execute("""
        INSERT INTO core.dim_turno (sk_turno, id_turno, nome, hora_inicio, hora_fim, duracao_horas, origem)
        SELECT id_turn_servi::int, id_turn_servi::int, trim(ds_turn_servi),
               hr_inic, hr_term, qtd_horas::int, 'ovresc.tb_turn_servi'
        FROM raw_escala.tb_turn_servi
    """)

    cur.execute("DELETE FROM core.dim_tipo_servico")
    cur.execute("""
        INSERT INTO core.dim_tipo_servico (sk_tipo_servico, id_tipo_servico, nome, natureza, origem)
        SELECT t.id_tipo_servi::int, t.id_tipo_servi::int, trim(t.ds_tipo_servi),
               NULL, 'ovresc.tb_tipo_servi'
        FROM raw_escala.tb_tipo_servi t
    """)

    cur.execute("DELETE FROM core.dim_funcao_servico")
    cur.execute("""
        INSERT INTO core.dim_funcao_servico (sk_funcao_servico, id_funcao, nome, origem)
        SELECT id_func_oper::int, id_func_oper::int, trim(ds_func_oper), 'ovresc.tb_func_oper'
        FROM raw_escala.tb_func_oper
    """)

    cur.execute("DELETE FROM core.dim_tipo_recurso")
    cur.execute("""
        INSERT INTO core.dim_tipo_recurso (sk_tipo_recurso, id_tipo_recurso, nome, origem)
        SELECT id::int, id::int, trim(name), 'mapa_forca.operational_resource_types'
        FROM raw_mapa_forca.operational_resource_types
    """)

    # Posto de servico: autoridade e o ovresc.tb_posto -- o mapa de forca casa
    # 141/141 com ele, e ele tem OME, coordenada e AIS proprios. A stations do
    # mapa de forca entra so preenchendo o que faltar (coalesce).
    cur.execute("DELETE FROM core.dim_posto_servico")
    cur.execute("""
        INSERT INTO core.dim_posto_servico
            (sk_posto_servico, id_posto, nome, sk_ome, municipio, bairro, ais,
             latitude, longitude, origem)
        SELECT p.id_posto::int, p.id_posto::int, trim(p.nm_posto),
               o.sk_ome,
               coalesce(nullif(trim(p.en_cidd), ''), nullif(trim(s.city), '')),
               coalesce(nullif(trim(p.en_bair), ''), nullif(trim(s.neighborhood), '')),
               coalesce(nullif(trim(p.nr_ais::text), ''), nullif(trim(s.ais), '')),
               coalesce(nullif(p.en_latd, 0), nullif(s.latitude, 0)::numeric),
               coalesce(nullif(p.en_long, 0), nullif(s.longitude, 0)::numeric),
               'ovresc.tb_posto + mapa_forca.stations'
        FROM raw_escala.tb_posto p
        LEFT JOIN raw_mapa_forca.stations s ON s.id_scriptcase = p.id_posto::int
        LEFT JOIN core.dim_ome o ON o.sk_ome = p.id_ome_respo_fk::int
    """)

    for tabela in ("dim_turno", "dim_tipo_servico", "dim_funcao_servico",
                   "dim_tipo_recurso", "dim_posto_servico"):
        cur.execute(f"SELECT count(*) FROM core.{tabela}")
        print(f"  {tabela:<28} {cur.fetchone()[0]:>8}")


# ---------------------------------------------------------------------------
# dim_posto_grad, dim_orgao_externo, dim_militar (fonte: Peculio)
# ---------------------------------------------------------------------------
def carregar_dimensoes_pessoal(cur):
    cur.execute("DELETE FROM core.fato_efetivo_diario")
    cur.execute("DELETE FROM core.dim_militar")
    cur.execute("DELETE FROM core.dim_posto_grad")
    cur.execute("DELETE FROM core.dim_orgao_externo")

    # Fonte: a planilha do Peculio como ela e (raw_peculio.planilha), nao o
    # Neon "Militar". O Neon ja vem transformado -- infere data de praca pela
    # moda do prefixo da matricula e descarta militar sem campo obrigatorio --
    # e a camada raw nao pode herdar transformacao de outro consumidor.
    # Ver etl/windmill/README.md.
    #
    # A planilha nao tem flag de ativo: quem esta nela e o efetivo ativo. Isso
    # e mais honesto que o ativo=false do Neon, que so marca quem saiu da
    # planilha em alguma rodada anterior e nunca foi limpo.
    #
    # A ORDEM DA PLANILHA E A ANTIGUIDADE. Ela vem em blocos por posto, do Cel
    # ao Sd, e a coluna "No" (posicao 1) reinicia em 1 a cada bloco. Entao a
    # antiguidade nao e calculada por nos: e lida. col[1] da a antiguidade
    # dentro do posto; a posicao na planilha inteira da a precedencia na
    # corporacao. Se um dia a planilha deixar de vir ordenada, os dois valores
    # deixam de significar o que dizem -- validar.py checa isso.
    # A view abaixo e montada POR POSICAO, nao por nome de coluna: o
    # cabecalho da planilha e texto livre, muda sozinho e ja veio truncado
    # em 40 caracteres pelo carregador. A posicao e o unico contrato estavel
    # que uma planilha oferece.
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'raw_peculio' AND table_name = 'planilha'
          AND column_name LIKE 'col%' ORDER BY ordinal_position
    """)
    col = {int(c[4:6]): c for (c,) in cur.fetchall()}

    def texto(posicao):
        return "nullif(trim(\"{}\"), '')".format(col[posicao])

    def booleano(posicao):
        return "upper(trim(\"{}\")) = 'TRUE'".format(col[posicao])

    def data(posicao):
        # A planilha escreve data em DD/MM/AAAA -- o formato brasileiro, que e
        # o que se esperaria de uma planilha mantida pela DGP. A primeira
        # versao desta funcao so aceitava ISO, e o resultado foi
        # data_nascimento e data_ingresso 100% NULAS na dim_militar sem que
        # nada reclamasse: o CASE devolvia NULL em silencio para as 2.658
        # linhas. Por isso o validar.py agora checa preenchimento de data.
        #
        # ISO continua aceito como segunda alternativa, porque planilha muda
        # de formato sozinha. Celula fora dos dois formatos vira NULL -- uma
        # celula errada nao pode derrubar a carga inteira.
        alvo = col[posicao]
        return (
            "CASE WHEN \"{0}\" ~ '^[0-9]{{2}}/[0-9]{{2}}/[0-9]{{4}}$' "
            "     THEN to_date(trim(\"{0}\"), 'DD/MM/YYYY') "
            "     WHEN \"{0}\" ~ '^[0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}}' "
            "     THEN left(trim(\"{0}\"), 10)::date END".format(alvo)
        )

    # DROP antes do CREATE: "CREATE OR REPLACE VIEW" so aceita acrescentar
    # coluna no fim da lista, e esta view muda de forma sempre que a planilha
    # ganha um campo novo. Nada depende dela alem desta funcao.
    cur.execute("DROP VIEW IF EXISTS stg.peculio")
    cur.execute(f"""
        CREATE VIEW stg.peculio AS
        SELECT
            linha                                  AS ordem,
            nullif(trim("{col[1]}"), '')::int       AS antiguidade,
            row_number() OVER (ORDER BY linha)     AS antiguidade_geral,
            trim("{col[8]}")                       AS matricula_exibida,
            replace(trim("{col[8]}"), '-', '')     AS matricula,
            trim("{col[2]}")                       AS posto_grad,
            trim("{col[3]}")                       AS ome,
            trim("{col[9]}")                       AS nome,
            trim("{col[10]}")                      AS nome_guerra,
            trim("{col[12]}")                      AS sexo,
            {texto(13)}                            AS raca_cor,
            {texto(7)}                             AS orgao,
            {texto(6)}                             AS afastamento,
            {booleano(25)}                         AS le,
            {booleano(26)}                         AS ltip,
            {booleano(22)}                         AS readaptado,
            {booleano(23)}                         AS pcd,
            {texto(24)}                            AS acumulo_cargos,
            {texto(5)}                             AS observacao,
            {texto(11)}                            AS ome_anterior,
            {texto(18)}                            AS principio_promocao,
            {texto(28)}                            AS suplemento,
            {booleano(21)}                         AS horario_especial,
            {data(27)}                             AS data_nascimento,
            {data(15)}                             AS data_praca,
            {data(17)}                             AS data_ultima_promocao,
            {data(4)}                              AS data_movimentacao_sp,
            {data(29)}                             AS data_suplemento
        FROM raw_peculio.planilha
        WHERE nullif(trim("{col[8]}"), '') IS NOT NULL
    """)

    cur.execute("""
        INSERT INTO core.dim_posto_grad (sk_posto_grad, sigla, ordem_hierarquica, origem)
        SELECT row_number() OVER (ORDER BY min(ordem)), posto_grad, min(ordem)::int, 'peculio'
        FROM stg.peculio WHERE posto_grad IS NOT NULL AND posto_grad <> ''
        GROUP BY posto_grad
    """)

    cur.execute("""
        INSERT INTO core.dim_orgao_externo (sk_orgao_externo, nome, origem)
        SELECT row_number() OVER (ORDER BY orgao), orgao, 'peculio.orgao'
        FROM (SELECT DISTINCT orgao FROM stg.peculio
              WHERE ome = 'ADIDO' AND orgao IS NOT NULL) x
    """)

    cur.execute("""
        INSERT INTO core.dim_principio_promocao (sk_principio_promocao, principio, origem)
        SELECT row_number() OVER (ORDER BY count(*) DESC), principio_promocao, 'peculio'
        FROM stg.peculio WHERE principio_promocao IS NOT NULL
        GROUP BY principio_promocao
    """)

    cur.execute("""
        INSERT INTO core.dim_suplemento_pessoal
            (sk_suplemento, numero_ano, data_publicacao, origem)
        SELECT row_number() OVER (ORDER BY min(data_suplemento)), suplemento,
               min(data_suplemento), 'peculio'
        FROM stg.peculio WHERE suplemento IS NOT NULL
        GROUP BY suplemento
    """)

    # O tipo de afastamento vem de uma coluna de texto livre, entao entra
    # lixo digitado (sigla de OME no lugar do tipo). Carrega como esta: a
    # dimensao reflete a origem, e o validar.py mostra o que nao parece tipo.
    cur.execute("""
        INSERT INTO core.dim_tipo_afastamento (sk_tipo_afastamento, sigla, origem)
        SELECT row_number() OVER (ORDER BY count(*) DESC), afastamento, 'peculio'
        FROM stg.peculio WHERE afastamento IS NOT NULL
        GROUP BY afastamento
    """)

    cur.execute("""
        INSERT INTO core.dim_militar
            (sk_militar, matricula, matricula_exibida, nome, nome_guerra, sexo,
             data_nascimento, data_ingresso, raca_cor, sk_posto_grad,
             antiguidade, antiguidade_geral, data_ultima_promocao,
             sk_principio_promocao, ome_anterior, data_movimentacao_sp,
             sk_suplemento, acumulo_cargos, observacao, ativo, origem)
        SELECT row_number() OVER (ORDER BY p.matricula), p.matricula,
               p.matricula_exibida, p.nome, p.nome_guerra, p.sexo,
               p.data_nascimento, p.data_praca, p.raca_cor,
               pg.sk_posto_grad, p.antiguidade, p.antiguidade_geral,
               p.data_ultima_promocao, pp.sk_principio_promocao,
               p.ome_anterior, p.data_movimentacao_sp, sp.sk_suplemento,
               p.acumulo_cargos, p.observacao, true, 'peculio'
        FROM stg.peculio p
        LEFT JOIN core.dim_posto_grad pg ON pg.sigla = p.posto_grad
        LEFT JOIN core.dim_principio_promocao pp ON pp.principio = p.principio_promocao
        LEFT JOIN core.dim_suplemento_pessoal sp ON sp.numero_ano = p.suplemento
    """)

    carregar_contato_militar(cur)

    for tabela in ("dim_posto_grad", "dim_orgao_externo",
                   "dim_principio_promocao", "dim_suplemento_pessoal",
                   "dim_tipo_afastamento", "dim_militar", "contato_militar"):
        cur.execute(f"SELECT count(*) FROM core.{tabela}")
        print(f"  {tabela:<28} {cur.fetchone()[0]:>8}")


# ---------------------------------------------------------------------------
# stg.peculio_titular (titular de cada OME, para marts.chefe_organograma)
# ---------------------------------------------------------------------------
def carregar_peculio_titular(cur):
    """Titular de cada OME do DW: o militar mais antigo dela no Peculio (pela
    ordem da planilha). marts.chefe_organograma le DAQUI e nao de stg.peculio,
    porque a carga recria essa view a cada rodada e o DROP falharia se uma view
    de marts dependesse dela (ver etl/dw/ddl/18_peculio_titular.sql)."""
    cur.execute("TRUNCATE stg.peculio_titular")
    cur.execute("""
        INSERT INTO stg.peculio_titular (sk_ome, matricula, ordem)
        SELECT DISTINCT ON (dp.sk_ome) dp.sk_ome, p.matricula, p.ordem::int
        FROM stg.peculio p
        JOIN stg.de_para_ome dp ON dp.sistema = 'peculio' AND dp.valor_origem = p.ome
        WHERE p.matricula IS NOT NULL AND p.matricula <> ''
        ORDER BY dp.sk_ome, p.ordem
    """)
    print(f"  stg.peculio_titular: {cur.rowcount} OME(s) com titular")


# ---------------------------------------------------------------------------
# dim_viatura
# ---------------------------------------------------------------------------
def carregar_dim_viatura(cur):
    """dim_viatura como SCD tipo 2: uma linha por VERSAO da viatura.

    Uma versao nova nasce a cada mudanca de OME (raw_frota.transfers) ou de
    situacao (raw_frota.vehicle_statuses) -- os dois unicos atributos que
    mudam ao longo da vida do veiculo. Ver o comentario do DDL em
    02_core_dimensoes.sql para o porque.

    O que isso compra: o numero de ordem e reciclado (viatura devolvida, a
    que entra no lugar herda o numero), entao "a viatura 108" so tem resposta
    com uma data junto. Sem vigencia, 413 pares (acronimo, numero) do mapa de
    forca ficavam ambiguos.

    A linha do tempo e montada em SQL (sao ~2,2 mil eventos, nao vale trazer
    pro Python); a resolucao OME -> sk_ome fica no Python porque reaproveita o
    de-para e a normalizacao que ja existem aqui.
    """
    # Nao ha DELETE aqui: limpar() ja truncou dim_viatura e, por CASCADE, os
    # fatos que dependem dela. Um DELETE em fato_frota_diaria neste ponto
    # levaria junto os snapshots que limpar() acabou de guardar.

    # Tres reference_date da Frota tem ano com 5 ou 6 digitos -- 62025-02-05,
    # 22025-06-09, 252024-01-01. E o mesmo erro de digitacao ja conhecido no
    # ovresc. Sao descartados em vez de "corrigidos": adivinhar o ano certo de
    # um evento de status nao e trabalho de ETL. Ficam contados abaixo para
    # nao sumirem em silencio.
    cur.execute(r"""
        SELECT count(*) FROM raw_frota.vehicle_statuses
        WHERE reference_date::text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    """)
    datas_descartadas = cur.fetchone()[0]

    # Fonte: a Frota como ela e, nao o Neon "Viatura" (que e cache de
    # aplicacao, com TRUNCATE a cada rodada e recorte de colunas).
    cur.execute(r"""
        WITH eventos AS (
            SELECT t.vehicle_id, t.transfer_date::date AS d, t.id AS ord,
                   'ome' AS tipo, o.acronym AS valor
            FROM raw_frota.transfers t
            JOIN raw_frota.omes o ON o.id = t.ome_id
            WHERE t.transfer_date IS NOT NULL
            UNION ALL
            SELECT vs.vehicle_id, vs.reference_date::date, vs.id,
                   'situacao', vst.name
            FROM raw_frota.vehicle_statuses vs
            JOIN raw_frota.vehicle_status_types vst ON vst.id = vs.status_type_id
            WHERE vs.reference_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        ),
        datas AS (SELECT DISTINCT vehicle_id, d FROM eventos),
        -- Estado da viatura em cada data de evento: o ultimo valor conhecido
        -- de cada atributo ate aquele dia (inclusive). Desempate pelo id da
        -- origem, para dois eventos do mesmo tipo no mesmo dia.
        estado AS (
            SELECT dt.vehicle_id, dt.d,
                   (SELECT e.valor FROM eventos e
                     WHERE e.vehicle_id = dt.vehicle_id AND e.tipo = 'ome' AND e.d <= dt.d
                     ORDER BY e.d DESC, e.ord DESC LIMIT 1) AS ome,
                   (SELECT e.valor FROM eventos e
                     WHERE e.vehicle_id = dt.vehicle_id AND e.tipo = 'situacao' AND e.d <= dt.d
                     ORDER BY e.d DESC, e.ord DESC LIMIT 1) AS situacao
            FROM datas dt
        ),
        -- Colapsa datas consecutivas com o mesmo estado: so vira versao nova
        -- quando OME ou situacao de fato mudam.
        marcado AS (
            SELECT e.*,
                   (lag(ome)      OVER w IS DISTINCT FROM ome
                 OR lag(situacao) OVER w IS DISTINCT FROM situacao)::int AS novo
            FROM estado e
            WINDOW w AS (PARTITION BY vehicle_id ORDER BY d)
        ),
        agrupado AS (
            SELECT *, sum(novo) OVER (PARTITION BY vehicle_id ORDER BY d
                                      ROWS UNBOUNDED PRECEDING) AS g
            FROM marcado
        ),
        versao AS (
            SELECT vehicle_id, g, min(d) AS inicio, min(ome) AS ome, min(situacao) AS situacao
            FROM agrupado GROUP BY vehicle_id, g
        ),
        numerada AS (
            SELECT v.*,
                   row_number() OVER (PARTITION BY vehicle_id ORDER BY inicio) AS seq,
                   lead(inicio) OVER (PARTITION BY vehicle_id ORDER BY inicio) AS proximo
            FROM versao v
        ),
        -- Quem abre o passado, dentro de cada numero de ordem. O historico da
        -- Frota comeca em 2023-12 e o mapa de forca em 2021-05, entao a
        -- primeira versao precisa valer para tras -- senao dois anos e meio
        -- de lancamento ficam sem casar.
        --
        -- Mas isso NAO pode valer para todas: quando o numero foi reciclado,
        -- abrir as duas em 1900 faz as duas ficarem vigentes no mesmo dia e
        -- devolve a ambiguidade que o SCD2 veio resolver (foi o que aconteceu
        -- na primeira tentativa). A regra e: dentro de um numero de ordem, so
        -- a viatura que chegou primeiro herda o passado; as seguintes comecam
        -- no seu proprio primeiro evento.
        dono_do_passado AS (
            SELECT n.vehicle_id,
                   -- n.seq = 1 no WHERE, entao n.inicio ja e o primeiro evento
                   -- da viatura -- nao precisa de min().
                   row_number() OVER (
                       PARTITION BY stg.normalizar_numero_ordem(v.order_number)
                       ORDER BY n.inicio, n.vehicle_id
                   ) = 1 AS abre_passado
            FROM numerada n
            JOIN raw_frota.vehicles v ON v.id = n.vehicle_id
            WHERE n.seq = 1
        )
        SELECT n.vehicle_id, n.seq,
               CASE WHEN n.seq = 1 AND dp.abre_passado THEN DATE '1900-01-01'
                    ELSE n.inicio END AS valido_de,
               (n.proximo - 1) AS valido_ate,
               (n.proximo IS NULL) AS versao_atual,
               n.ome, n.situacao,
               -- Situacao NULL = antes do primeiro evento de status; tratar
               -- como em servico e o comportamento certo, e nao ausencia.
               coalesce(st.still_usable, true) AS em_servico,
               trim(v.license_plate), v.chassis, v.renavam, v.patrimony,
               vt.name, vt.acronym, v.order_number, v.brand, v.model,
               nullif(v.year, 0)::int,
               posse.name, destino.name, combustivel.name, categoria.code,
               v.is_tracked, v.is_characterized
        FROM numerada n
        JOIN dono_do_passado dp ON dp.vehicle_id = n.vehicle_id
        JOIN raw_frota.vehicles v ON v.id = n.vehicle_id
        LEFT JOIN raw_frota.vehicle_status_types st ON st.name = n.situacao
        LEFT JOIN raw_frota.vehicle_types vt ON vt.id = v.type_id
        LEFT JOIN raw_frota.vehicle_ownership_types posse ON posse.id = v.vehicle_ownership_type_id
        LEFT JOIN raw_frota.vehicle_destination_types destino ON destino.id = v.vehicle_destination_type_id
        LEFT JOIN raw_frota.vehicle_fuel_types combustivel ON combustivel.id = v.vehicle_fuel_type_id
        LEFT JOIN raw_frota.license_categories categoria ON categoria.id = v.license_category_id
        WHERE nullif(trim(v.license_plate), '') IS NOT NULL
        ORDER BY n.vehicle_id, n.seq
    """)
    fonte = cur.fetchall()

    cur.execute("SELECT sk_ome, sigla FROM core.dim_ome")
    ome_por_sigla = {normalizar(sigla): sk for sk, sigla in cur.fetchall()}

    linhas, sem_ome = [], set()
    for r in fonte:
        (id_frota, seq, valido_de, valido_ate, versao_atual, sigla_ome, situacao,
         em_servico,
         placa, chassi, renavam, patrimonio, tipo, tipo_acronym, numero_ordem,
         marca, modelo, ano, posse, destinacao, combustivel, categoria,
         rastreado, caracterizado) = r
        sigla_ome = (sigla_ome or "").strip()
        sk_ome = ome_por_sigla.get(normalizar(PECULIO_PARA_SGP.get(sigla_ome, sigla_ome)))
        if sigla_ome and sk_ome is None:
            sem_ome.add(sigla_ome)
        linhas.append((
            # sk_viatura deterministico: id da Frota * 100 + numero da versao.
            # Estavel entre cargas, ao contrario do row_number() antigo. Cabe
            # folgado: maior id da Frota = 859, maximo de versoes = 27.
            id_frota * 100 + seq, placa, id_frota, valido_de, valido_ate,
            versao_atual, chassi, renavam, patrimonio, tipo, tipo_acronym,
            numero_ordem, normalizar_numero(numero_ordem), marca, modelo, ano,
            posse, destinacao, combustivel, categoria, rastreado, caracterizado,
            sk_ome, situacao, em_servico, "frotas_production",
        ))

    execute_values(cur, """
        INSERT INTO core.dim_viatura
            (sk_viatura, placa, id_frota, valido_de, valido_ate, versao_atual,
             chassi, renavam, patrimonio, tipo, tipo_acronym, numero_ordem,
             numero_ordem_norm, marca, modelo, ano, posse, destinacao,
             combustivel, categoria_habilitacao, rastreado, caracterizado,
             sk_ome, situacao, em_servico, origem)
        VALUES %s
    """, linhas)

    cur.execute("SELECT count(DISTINCT id_frota), count(*) FROM core.dim_viatura")
    viaturas, versoes = cur.fetchone()
    print(f"  dim_viatura                  {versoes:>8}  "
          f"({viaturas} viaturas, {versoes / viaturas:.1f} versoes cada)")
    if datas_descartadas:
        print(f"    eventos de status com ano invalido, descartados: {datas_descartadas}")
    if sem_ome:
        print(f"    OMEs da frota sem correspondencia no SGP: {sorted(sem_ome)}")


# ---------------------------------------------------------------------------
# stg.de_para_ome e stg.de_para_viatura
# ---------------------------------------------------------------------------
def carregar_de_para_ome(cur):
    cur.execute("DELETE FROM stg.de_para_ome")
    cur.execute("SELECT sk_ome, sigla FROM core.dim_ome")
    por_sigla = {normalizar(s): sk for sk, s in cur.fetchall()}

    linhas = []

    # A DGP duplicada da propria fonte.
    linhas.append(("sgp", "DGP.", SK_DGP, "fusao",
                   "id 8 do SGP e a mesma DGP do id 25 -- decisao de 2026-08-24"))

    # Peculio: as siglas de OME que aparecem na planilha (coluna na posicao
    # 3, mesmo filtro de militar de carregar_dimensoes_pessoal). Ate
    # 2026-09-29 vinham das chaves de etl/efetivo/mapeamento_unidades.json;
    # conferido nesta data que os dois conjuntos eram identicos (46 siglas),
    # e ler da raw faz uma OME nova na planilha entrar sozinha -- ou aparecer
    # em "nao casados" abaixo.
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'raw_peculio' AND table_name = 'planilha'
          AND column_name LIKE 'col%' ORDER BY ordinal_position
    """)
    col = {int(c[4:6]): c for (c,) in cur.fetchall()}
    cur.execute(f"""
        SELECT DISTINCT trim("{col[3]}") FROM raw_peculio.planilha
        WHERE nullif(trim("{col[8]}"), '') IS NOT NULL
          AND nullif(trim("{col[3]}"), '') IS NOT NULL
        ORDER BY 1
    """)
    siglas_peculio = [s for (s,) in cur.fetchall()]
    nao_casados = []
    for sigla_peculio in siglas_peculio:
        alvo = PECULIO_PARA_SGP.get(sigla_peculio, sigla_peculio)
        sk = por_sigla.get(normalizar(alvo))
        if sk is None:
            nao_casados.append(sigla_peculio)
            continue
        if sigla_peculio == "CPPA":
            tipo = "setor_vinculado"
        elif sigla_peculio == "ADIDO":
            tipo = "fantasma"
        else:
            tipo = "grafia"
        linhas.append(("peculio", sigla_peculio, sk, tipo, None))

    # Mapa de forca: FK real, nao casamento por nome.
    cur.execute("""
        SELECT o.acronym, o.id_scriptcase FROM raw_mapa_forca.omes o
        WHERE o.id_scriptcase IS NOT NULL
    """)
    for acronimo, id_scriptcase in cur.fetchall():
        if id_scriptcase in por_sigla.values() or True:
            linhas.append(("mapa_forca", str(acronimo).strip(), int(id_scriptcase),
                           "fk", "omes.id_scriptcase = tb_ome.id_ome"))

    # Frota: por sigla normalizada.
    cur.execute("SELECT DISTINCT acronym FROM raw_frota.omes WHERE acronym IS NOT NULL")
    for (acronimo,) in cur.fetchall():
        alvo = PECULIO_PARA_SGP.get(acronimo.strip(), acronimo)
        sk = por_sigla.get(normalizar(alvo))
        if sk is not None:
            linhas.append(("frota", acronimo.strip(), sk, "grafia", None))
        else:
            nao_casados.append(f"frota:{acronimo}")

    # Organograma do app: sigla do organograma -> OME do DW. E o que deixa o
    # marts responder na sigla que o app usa (marts.efetivo_organograma e
    # afins, lidos pelo backend em /dados). Sigla do organograma que nao
    # existe no SGP (unidade so planejada, ou "em construcao") aparece em
    # "sem correspondencia" e simplesmente nao recebe numero do DW.
    cur.execute("SELECT DISTINCT sigla FROM app.organograma_unidade")
    for (sigla_org,) in cur.fetchall():
        alvo = ORGANOGRAMA_PARA_SGP.get(sigla_org, sigla_org)
        sk = por_sigla.get(normalizar(alvo))
        if sk is None:
            nao_casados.append(f"organograma:{sigla_org}")
            continue
        tipo = "grafia" if alvo == sigla_org else "de_para"
        linhas.append(("organograma", sigla_org, sk, tipo, None))

    # Remove duplicata de (sistema, valor_origem) mantendo a primeira.
    unicos, chaves = [], set()
    for l in linhas:
        if (l[0], l[1]) in chaves:
            continue
        chaves.add((l[0], l[1]))
        unicos.append(l)

    execute_values(cur, """
        INSERT INTO stg.de_para_ome (sistema, valor_origem, sk_ome, tipo, observacao)
        VALUES %s
    """, unicos)
    print(f"  stg.de_para_ome              {len(unicos):>8}")
    if nao_casados:
        print(f"    sem correspondencia: {nao_casados}")


def carregar_de_para_viatura(cur):
    """Relatorio de qualidade da reconciliacao Frota x mapa de forca.

    Deixou de ser a chave de resolucao em 2026-08-26: com a dim_viatura em
    SCD2, o fato casa direto por (numero normalizado, data dentro da
    vigencia) -- ver carregar_fatos_lancamento. O que sobra aqui, e que
    continua valendo muito, e conseguir responder DEPOIS por que um
    lancamento nao casou.

    As quatro situacoes possiveis estao descritas no DDL (04_stg.sql). A que
    interessa medir e 'resolvido_por_data': e exatamente o que o SCD2 comprou.
    """
    cur.execute("DELETE FROM stg.de_para_viatura")
    cur.execute("""
        INSERT INTO stg.de_para_viatura
            (acronimo_origem, numero_origem, numero_norm, sk_viatura, situacao,
             candidatos, acronimo_diverge, lancamentos, lancamentos_resolvidos)
        WITH lancamento AS (
            SELECT vt.acronym AS acronimo, lv.order_number AS numero,
                   stg.normalizar_numero_ordem(lv.order_number) AS numero_norm,
                   l.date::date AS data
            FROM raw_mapa_forca.launch_vehicles lv
            JOIN raw_mapa_forca.vehicle_types vt ON vt.id = lv.vehicle_type_id
            JOIN raw_mapa_forca.launches l ON l.id = lv.launch_id
            WHERE lv.discarded_at IS NULL AND l.discarded_at IS NULL
              AND lv.order_number IS NOT NULL AND trim(lv.order_number) <> ''
              AND l.date BETWEEN DATE '2019-01-01' AND current_date + 365
        ),
        -- Por lancamento: quantas viaturas estavam vigentes naquele numero
        -- naquele dia. 0 = nao existe na Frota; 1 = a data resolveu.
        por_lancamento AS (
            SELECT c.*, v.vigentes, v.vigentes_uteis,
                   -- Mesma regra de dois estagios do fato (ver
                   -- carregar_fatos_lancamento): candidata em servico manda;
                   -- na falta de qualquer uma, vale a fora de servico.
                   (v.vigentes_uteis = 1
                    OR (v.vigentes_uteis = 0 AND v.vigentes = 1)) AS resolveu
            FROM lancamento c
            CROSS JOIN LATERAL (
                SELECT count(*) AS vigentes,
                       count(*) FILTER (WHERE coalesce(dv.em_servico, true)) AS vigentes_uteis
                FROM core.dim_viatura dv
                WHERE dv.numero_ordem_norm = c.numero_norm
                  AND c.data >= dv.valido_de
                  AND (dv.valido_ate IS NULL OR c.data <= dv.valido_ate)
            ) v
        ),
        -- Por par (acronimo, numero), que e o grao da tabela.
        por_par AS (
            SELECT acronimo, numero, numero_norm,
                   count(*) AS lancamentos,
                   count(*) FILTER (WHERE resolveu) AS resolvidos,
                   count(*) FILTER (WHERE vigentes = 0) AS sem_vigente
            FROM por_lancamento GROUP BY 1, 2, 3
        ),
        -- Candidatas em TODA a linha do tempo, ignorando vigencia: e o que
        -- diz se o numero foi reciclado alguma vez.
        candidatas AS (
            SELECT p.acronimo, p.numero,
                   count(DISTINCT v.id_frota) AS candidatos,
                   min(v.sk_viatura) FILTER (WHERE v.versao_atual) AS sk_unico,
                   bool_or(upper(v.tipo_acronym) = upper(p.acronimo)) AS acronimo_bate
            FROM por_par p
            LEFT JOIN core.dim_viatura v ON v.numero_ordem_norm = p.numero_norm
            GROUP BY 1, 2
        )
        SELECT p.acronimo, p.numero, p.numero_norm,
               CASE WHEN c.candidatos = 1 THEN c.sk_unico END,
               CASE WHEN c.candidatos = 0 THEN 'sem_casar'
                    WHEN c.candidatos = 1 THEN 'resolvido'
                    WHEN p.resolvidos = p.lancamentos THEN 'resolvido_por_data'
                    ELSE 'ambiguo' END,
               c.candidatos,
               CASE WHEN c.candidatos > 0 THEN NOT c.acronimo_bate END,
               p.lancamentos, p.resolvidos
        FROM por_par p
        JOIN candidatas c ON c.acronimo = p.acronimo AND c.numero = p.numero
    """)
    cur.execute("""
        SELECT situacao, count(*), sum(lancamentos)
        FROM stg.de_para_viatura GROUP BY 1 ORDER BY 3 DESC
    """)
    resumo = ", ".join(f"{s}={n} pares/{v} lanc." for s, n, v in cur.fetchall())
    cur.execute("SELECT count(*) FROM stg.de_para_viatura")
    print(f"  stg.de_para_viatura          {cur.fetchone()[0]:>8}  ({resumo})")


# ---------------------------------------------------------------------------
# Fatos
# ---------------------------------------------------------------------------
def carregar_fato_efetivo_diario(cur):
    """Snapshot de hoje. Rodando diariamente, vira a serie temporal que a
    fonte nao tem (ela so guarda o estado atual)."""
    cur.execute("""
        INSERT INTO core.fato_efetivo_diario
            (sk_tempo, sk_militar, sk_ome, sk_posto_grad, sk_orgao_externo,
             adido, afastado, le, ltip, readaptado, pcd,
             horario_especial, sk_tipo_afastamento)
        SELECT (to_char(current_date, 'YYYYMMDD'))::int,
               dm.sk_militar,
               dp.sk_ome,
               dm.sk_posto_grad,
               oe.sk_orgao_externo,
               m.ome = 'ADIDO',
               m.afastamento IS NOT NULL,
               m.le, m.ltip, m.readaptado, m.pcd,
               m.horario_especial, ta.sk_tipo_afastamento
        FROM stg.peculio m
        JOIN core.dim_militar dm ON dm.matricula = m.matricula
        JOIN stg.de_para_ome dp ON dp.sistema = 'peculio' AND dp.valor_origem = m.ome
        LEFT JOIN core.dim_orgao_externo oe
               ON m.ome = 'ADIDO' AND oe.nome = m.orgao
        LEFT JOIN core.dim_tipo_afastamento ta ON ta.sigla = m.afastamento
        ON CONFLICT (sk_tempo, sk_militar) DO NOTHING
    """)
    cur.execute("SELECT count(*) FROM core.fato_efetivo_diario")
    print(f"  fato_efetivo_diario          {cur.fetchone()[0]:>8}")


def carregar_fato_frota_diaria(cur):
    """Snapshot de hoje da frota. So a versao vigente de cada viatura: desde o
    SCD2 a dim_viatura tem uma linha por versao, e sem o filtro a mesma
    viatura entraria no snapshot uma vez por mudanca de OME que ja teve."""
    cur.execute("""
        INSERT INTO core.fato_frota_diaria (sk_tempo, sk_viatura, sk_ome, situacao, odometro)
        SELECT (to_char(current_date, 'YYYYMMDD'))::int, v.sk_viatura, v.sk_ome,
               v.situacao, ab.mileage
        FROM core.dim_viatura v
        LEFT JOIN LATERAL (
            SELECT mileage FROM raw_frota.fuel_transactions ft
            WHERE ft.vehicle_id = v.id_frota ORDER BY ft.time DESC NULLS LAST LIMIT 1
        ) ab ON true
        WHERE v.versao_atual
        ON CONFLICT (sk_tempo, sk_viatura) DO NOTHING
    """)
    cur.execute("SELECT count(*) FROM core.fato_frota_diaria")
    print(f"  fato_frota_diaria            {cur.fetchone()[0]:>8}")


def carregar_fatos_lancamento(cur):
    """Os tres fatos do mapa de forca. Tudo em SQL dentro do proprio DW: os
    dados ja estao em raw, nao ha motivo pra trazer 1,5 milhao de linhas pro
    Python e devolver.

    Cuidados encodados nas consultas:
    - discarded_at IS NULL nos dois lados (o mapa de forca usa soft delete;
      sao 4.657 lancamentos cancelados que nao devem contar).
    - faixa de sanidade na data: o ovresc tem datas de ano 22 e ano 4202, e
      o mesmo tipo de erro de digitacao aparece aqui.
    - sk_militar e sk_viatura ficam NULL quando nao casam, e a chave de
      origem e guardada ao lado -- e o que permite auditar a cobertura em
      vez de perder a linha.
    """
    cur.execute("DELETE FROM core.fato_lancamento_militar")
    cur.execute("DELETE FROM core.fato_lancamento_viatura")
    cur.execute("DELETE FROM core.fato_lancamento_recurso")

    # Separado em dois pedacos porque a resolucao da viatura precisa entrar
    # ENTRE eles: o LATERAL usa l.date, e um LATERAL so enxerga o que ja
    # apareceu antes dele no FROM.
    juncoes = """
        JOIN raw_mapa_forca.launches l ON l.id = f.launch_id
        -- launches.ome_id ja e o id_ome do SGP (nao o id da tabela omes local):
        -- verificado com ome_id 44 = CAT/RMR e 51 = GBAPH na tb_ome.
        LEFT JOIN core.dim_ome dome ON dome.sk_ome = l.ome_id
        LEFT JOIN core.dim_posto_servico dps ON dps.id_posto = l.service_station_id
        LEFT JOIN core.dim_turno dtu ON dtu.id_turno = l.service_shift_id
        LEFT JOIN core.dim_tipo_servico dts ON dts.id_tipo_servico = l.service_type_id
    """

    filtros = """
        WHERE f.discarded_at IS NULL AND l.discarded_at IS NULL
          AND l.date BETWEEN DATE '2019-01-01' AND current_date + 365
    """

    cur.execute(f"""
        INSERT INTO core.fato_lancamento_militar
            (sk_lancamento_militar, id_lancamento, sk_tempo, sk_militar,
             matricula_origem, posto_origem, sk_ome, sk_posto_servico, sk_turno,
             sk_tipo_servico, sk_funcao_servico, status)
        SELECT f.id, l.id, (to_char(l.date, 'YYYYMMDD'))::int,
               dm.sk_militar, f.military_registration, f.military_rank,
               dome.sk_ome, dps.sk_posto_servico, dtu.sk_turno, dts.sk_tipo_servico,
               dfs.sk_funcao_servico, f.status
        FROM raw_mapa_forca.launch_militaries f
        LEFT JOIN core.dim_militar dm ON dm.matricula = trim(f.military_registration)
        LEFT JOIN core.dim_funcao_servico dfs ON dfs.id_funcao = f.service_occupation_id
        {juncoes}
        {filtros}
    """)

    # A resolucao da viatura mudou em 2026-08-26. Antes: um LEFT JOIN na
    # stg.de_para_viatura, que so sabia responder quando o numero de ordem
    # tinha uma dona unica em toda a historia -- 413 pares ficavam de fora.
    # Agora casa contra a dim_viatura SCD2, exigindo que a data do lancamento
    # caia dentro da vigencia da versao. E o que o numero reciclado pedia.
    #
    # O LATERAL devolve duas coisas de proposito: a escolhida E quantas
    # estavam vigentes. Sem a contagem, um desempate silencioso viraria
    # "resolvido" no relatorio de qualidade sem nunca ter sido.
    #
    # A vigencia sozinha nao basta: uma viatura Devolvida mantem a ultima
    # versao aberta (valido_ate NULL), entao ela e a sucessora ficam vigentes
    # ao mesmo tempo. Dai o filtro em dois estagios, medido sobre os 204 mil
    # lancamentos:
    #   so vigencia .......................... 91,9% resolvidos
    #   vigencia + em servico ................ 97,5%  (mas 367 lancamentos
    #                                          perdiam a unica candidata)
    #   os dois, com queda para a candidata
    #   fora de servico quando nao ha outra ... 97,7%   <- a implementada
    #
    # Desempate entre candidatas em servico, quando ainda sobra mais de uma:
    #   1. acronimo igual ao do lancamento -- fraco, erra em 26% dos casos,
    #      mas quando bate e sinal;
    #   2. menor sk_viatura, so para o resultado ser deterministico.
    cur.execute(f"""
        INSERT INTO core.fato_lancamento_viatura
            (sk_lancamento_viatura, id_lancamento, sk_tempo, sk_viatura,
             acronimo_origem, numero_origem, sk_ome, sk_posto_servico, sk_turno,
             sk_tipo_servico, status)
        SELECT f.id, l.id, (to_char(l.date, 'YYYYMMDD'))::int,
               dv.sk_viatura, vt.acronym, f.order_number,
               dome.sk_ome, dps.sk_posto_servico, dtu.sk_turno, dts.sk_tipo_servico,
               f.status
        FROM raw_mapa_forca.launch_vehicles f
        LEFT JOIN raw_mapa_forca.vehicle_types vt ON vt.id = f.vehicle_type_id
        {juncoes}
        LEFT JOIN LATERAL (
            SELECT (array_agg(v.sk_viatura ORDER BY
                        -- em servico primeiro: e o estagio que mais resolve
                        coalesce(v.em_servico, true) DESC,
                        (upper(v.tipo_acronym) = upper(vt.acronym)) DESC NULLS LAST,
                        v.sk_viatura))[1] AS sk_viatura,
                   count(*) AS vigentes,
                   count(*) FILTER (WHERE coalesce(v.em_servico, true)) AS vigentes_uteis
            FROM core.dim_viatura v
            WHERE v.numero_ordem_norm = stg.normalizar_numero_ordem(f.order_number)
              AND l.date::date >= v.valido_de
              AND (v.valido_ate IS NULL OR l.date::date <= v.valido_ate)
        ) dv ON true
        {filtros}
    """)

    cur.execute(f"""
        INSERT INTO core.fato_lancamento_recurso
            (sk_lancamento_recurso, id_lancamento, sk_tempo, sk_tipo_recurso,
             sk_ome, sk_posto_servico, quantidade)
        SELECT f.id, l.id, (to_char(l.date, 'YYYYMMDD'))::int,
               dtr.sk_tipo_recurso, dome.sk_ome, dps.sk_posto_servico, f.quantity
        FROM raw_mapa_forca.launch_operational_resources f
        LEFT JOIN core.dim_tipo_recurso dtr
               ON dtr.id_tipo_recurso = f.operational_resource_type_id
        {juncoes}
        {filtros}
    """)

    for tabela, chave in [
        ("fato_lancamento_militar", "sk_militar"),
        ("fato_lancamento_viatura", "sk_viatura"),
        ("fato_lancamento_recurso", "sk_tipo_recurso"),
    ]:
        cur.execute(f"""
            SELECT count(*), count({chave}), count(sk_ome)
            FROM core.{tabela}
        """)
        total, com_chave, com_ome = cur.fetchone()
        pct = 100 * com_chave / total if total else 0
        print(f"  {tabela:<28} {total:>8}  {chave} resolvido: {pct:5.1f}%"
              f"  sk_ome: {100 * com_ome / total if total else 0:5.1f}%")


def limpar(cur):
    """Reconstrucao: derruba fatos antes das dimensoes, senao as FKs barram.

    Os fatos de lancamento sao reconstruidos inteiros a cada rodada, porque a
    fonte guarda o historico e reprocessar da o mesmo resultado.

    Os SNAPSHOTS DIARIOS sao o oposto: a fonte so tem o estado de hoje, entao
    o dia de ontem so existe se nos guardamos. E o TRUNCATE ... CASCADE abaixo
    leva os tres junto, porque eles apontam para as dimensoes.

    Ate 2026-08-26 isso era resolvido com um SystemExit: a carga simplesmente
    se recusava a rodar se existisse snapshot de dia anterior, porque as
    chaves substitutas eram row_number() e trocavam a cada carga -- restaurar
    o snapshot deixaria cada linha apontando para outro militar. Era honesto,
    mas travava o agendamento da carga diaria, que e justamente o que o DW
    existe para comprar.

    Agora os snapshots sao guardados pela CHAVE NATURAL (matricula do militar,
    placa da viatura), que nao depende de chave substituta nenhuma, e
    devolvidos por restaurar_snapshots() depois que as dimensoes voltam. Uma
    linha cuja chave natural sumiu da dimensao e descartada e contada -- e o
    caso do militar que deixou de existir na fonte entre uma carga e outra.
    """
    for tabela, coluna, dim, natural in SNAPSHOTS:
        # Alem da chave principal, as outras chaves substitutas do snapshot
        # (posto, orgao externo, tipo de afastamento) tambem sao guardadas pelo
        # valor natural: essas dimensoes numeram por row_number() e a numeracao
        # muda quando o Peculio ganha ou perde um valor. Sem isso o snapshot
        # voltava com a chave velha -- apontando para outro orgao, ou para
        # nenhum (violacao de FK em 2026-10-06, quando um orgao saiu da lista).
        extras = SNAPSHOT_FKS.get(tabela, [])
        sel_extra = "".join(f", x{i}.{nat} AS nat_{col}" for i, (col, d2, nat) in enumerate(extras))
        join_extra = "".join(
            f" LEFT JOIN core.{d2} x{i} ON x{i}.{col} = f.{col}" for i, (col, d2, nat) in enumerate(extras)
        )
        cur.execute(f"""
            CREATE TEMP TABLE tmp_{tabela} ON COMMIT DROP AS
            SELECT f.*, d.{natural} AS chave_natural{sel_extra}
            FROM core.{tabela} f
            JOIN core.{dim} d ON d.{coluna} = f.{coluna}{join_extra}
        """)
        cur.execute(f"SELECT count(*) FROM tmp_{tabela}")
        guardadas = cur.fetchone()[0]
        cur.execute(f"SELECT count(*) FROM core.{tabela}")
        total = cur.fetchone()[0]
        if total:
            print(f"  snapshot {tabela:<26} {guardadas:>7} de {total} guardadas "
                  f"por {natural}")

    cur.execute("""
        TRUNCATE
            core.fato_lancamento_militar, core.fato_lancamento_viatura,
            core.fato_lancamento_recurso,
            core.fato_averbacao, core.fato_afastamento_reserva,
            stg.de_para_ome, stg.de_para_viatura,
            core.dim_ome_ancestral, core.dim_ome, core.dim_militar,
            core.dim_posto_grad, core.dim_orgao_externo, core.dim_viatura,
            core.contato_militar, core.dim_principio_promocao,
            core.dim_suplemento_pessoal, core.dim_tipo_afastamento,
            core.dim_posto_servico, core.dim_turno, core.dim_tipo_servico,
            core.dim_funcao_servico, core.dim_tipo_recurso
        CASCADE
    """)


# (tabela de snapshot, coluna de chave substituta, dimensao, chave natural).
# A dim_viatura tem uma linha por versao desde o SCD2, entao a restauracao
# filtra versao_atual -- um snapshot diario e sempre do estado corrente.
SNAPSHOTS = [
    ("fato_efetivo_diario", "sk_militar", "dim_militar", "matricula"),
    ("fato_frota_diaria", "sk_viatura", "dim_viatura", "placa"),
    ("fato_previsao_reserva", "sk_militar", "dim_militar", "matricula"),
]


# Outras chaves substitutas de cada snapshot, que tambem precisam ser traduzidas
# pelo valor natural: (coluna, dimensao, coluna natural). sk_ome fica de fora
# porque vem do id do SGP e nao muda entre cargas.
SNAPSHOT_FKS = {
    "fato_efetivo_diario": [
        ("sk_posto_grad", "dim_posto_grad", "sigla"),
        ("sk_orgao_externo", "dim_orgao_externo", "nome"),
        ("sk_tipo_afastamento", "dim_tipo_afastamento", "sigla"),
    ],
}


def restaurar_snapshots(cur):
    """Devolve os snapshots guardados por limpar(), traduzindo a chave natural
    de volta para a chave substituta nova. Chamado depois das dimensoes."""
    for tabela, coluna, dim, natural in SNAPSHOTS:
        cur.execute(f"SELECT count(*) FROM tmp_{tabela}")
        if not cur.fetchone()[0]:
            continue
        filtro_versao = " AND d.versao_atual" if dim == "dim_viatura" else ""
        cur.execute(f"""
            SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
            FROM information_schema.columns
            WHERE table_schema = 'core' AND table_name = '{tabela}'
        """)
        colunas = cur.fetchone()[0]
        extras = {col: (i, d2, nat) for i, (col, d2, nat) in enumerate(SNAPSHOT_FKS.get(tabela, []))}
        def expressao(c):
            c = c.strip()
            if c == coluna:
                return f"d.{coluna}"
            if c in extras:
                return f"x{extras[c][0]}.{c}"
            return f"t.{c}"
        seleto = ", ".join(expressao(c) for c in colunas.split(","))
        join_extra = "".join(
            f" LEFT JOIN core.{d2} x{i} ON x{i}.{nat} = t.nat_{col}"
            for col, (i, d2, nat) in extras.items()
        )
        cur.execute(f"""
            INSERT INTO core.{tabela} ({colunas})
            SELECT {seleto}
            FROM tmp_{tabela} t
            JOIN core.{dim} d ON d.{natural} = t.chave_natural{filtro_versao}{join_extra}
            ON CONFLICT DO NOTHING
        """)
        restauradas = cur.rowcount
        cur.execute(f"SELECT count(*) FROM tmp_{tabela}")
        guardadas = cur.fetchone()[0]
        perdidas = guardadas - restauradas
        aviso = f"  ({perdidas} sem correspondencia na dimensao nova)" if perdidas else ""
        print(f"  {tabela:<28} {restauradas:>8} restauradas{aviso}")


def carregar_contato_militar(cur):
    """Telefone dos militares, das duas abas de contato da planilha.

    Tabela separada da dim_militar de proposito: contato de 2.043 pessoas nao
    pode sair de carona num SELECT * na dimensao. Ver DW_GOVERNANCA.md.

    As colunas sao localizadas PELO NOME, e nao pela posicao como no resto do
    Peculio -- aqui a posicao nao serve de contrato porque as duas abas
    guardam o mesmo campo em posicoes diferentes (telefone 1 e a coluna 34 na
    aba DIRETORIAS e a 35 na GRUPAMENTOS). Se o cabecalho mudar, isto falha
    alto em vez de gravar a coluna errada.

    DIRETORIAS tem prioridade sobre GRUPAMENTOS -- mesma regra do script que
    alimenta o app hoje (etl/windmill/apps/peculio_para_metabase_e_neon.py).

    As abas trazem tambem e-mail e endereco. Nao entram: nenhum consumidor
    pediu, e dado sensivel sem uso concreto nao entra no DW.
    """
    def colunas(tabela):
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'raw_peculio' AND table_name = %s
              AND column_name ILIKE %s
            ORDER BY ordinal_position
        """, (tabela, "%telefone%"))
        achadas = [c for (c,) in cur.fetchall()]
        if len(achadas) != 2:
            raise SystemExit(
                f"raw_peculio.{tabela}: esperava 2 colunas de telefone, "
                f"achei {len(achadas)} ({achadas}). O cabecalho da planilha "
                "mudou -- confira antes de recarregar."
            )
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'raw_peculio' AND table_name = %s
              AND column_name ILIKE %s
            ORDER BY ordinal_position LIMIT 1
        """, (tabela, "%matr%"))
        return cur.fetchone()[0], achadas[0], achadas[1]

    dir_m, dir_1, dir_2 = colunas("telefones_diretorias")
    gru_m, gru_1, gru_2 = colunas("telefones_grupamentos")

    cur.execute(f"""
        INSERT INTO core.contato_militar (sk_militar, telefone_1, telefone_2, origem)
        SELECT dm.sk_militar,
               coalesce(d.t1, g.t1),
               coalesce(d.t2, g.t2),
               'peculio.telefones'
        FROM core.dim_militar dm
        LEFT JOIN (
            SELECT replace(trim("{dir_m}"), '-', '') AS matricula,
                   nullif(trim("{dir_1}"), '') AS t1, nullif(trim("{dir_2}"), '') AS t2
            FROM raw_peculio.telefones_diretorias
            WHERE nullif(trim("{dir_m}"), '') IS NOT NULL
        ) d ON d.matricula = dm.matricula
        LEFT JOIN (
            SELECT replace(trim("{gru_m}"), '-', '') AS matricula,
                   nullif(trim("{gru_1}"), '') AS t1, nullif(trim("{gru_2}"), '') AS t2
            FROM raw_peculio.telefones_grupamentos
            WHERE nullif(trim("{gru_m}"), '') IS NOT NULL
        ) g ON g.matricula = dm.matricula
        WHERE coalesce(d.t1, g.t1, d.t2, g.t2) IS NOT NULL
        ON CONFLICT (sk_militar) DO NOTHING
    """)


# ---------------------------------------------------------------------------
# Reserva remunerada (fonte: sistema de controle de reserva, no Neon)
# ---------------------------------------------------------------------------
def carregar_fatos_reserva(cur):
    """Averbacao, afastamento e a previsao de reserva vigente.

    Este e o unico dominio em que o Neon e sistema de origem, e nao cache de
    aplicacao: nenhuma outra fonte nossa conhece averbacao, e nenhum script do
    Windmill escreve nessas tabelas.

    Averbacao e Afastamento apontam para o militar por id LOCAL do Neon
    (militarId), nao por matricula. A ponte e raw_reserva.militar -> matricula
    -> core.dim_militar, e por isso a tabela Militar do Neon entra na raw
    junto com as outras duas.
    """
    cur.execute("""
        CREATE OR REPLACE VIEW stg.reserva_militar AS
        SELECT id,
               replace(trim(matricula), '-', '')  AS matricula,
               ativo
        FROM raw_reserva.militar
    """)

    cur.execute("""
        INSERT INTO core.fato_averbacao
            (sk_averbacao, sk_militar, tipo, dias, processo_sei_militar,
             processo_sei_inss, observacao, criado_em, atualizado_em, carga_id)
        SELECT a.id, dm.sk_militar, a.tipo, a.dias, a."processoSeiMilitar",
               a."processoSeiInss", a.obs, a."createdAt", a."updatedAt", a.carga_id
        FROM raw_reserva.averbacao a
        JOIN stg.reserva_militar rm ON rm.id = a."militarId"
        JOIN core.dim_militar dm ON dm.matricula = rm.matricula
    """)

    cur.execute("""
        INSERT INTO core.fato_afastamento_reserva
            (sk_afastamento, sk_militar, tipo, dias, processo_sei_militar,
             observacao, criado_em, atualizado_em, carga_id)
        SELECT f.id, dm.sk_militar, f.tipo, f.dias, f."processoSeiMilitar",
               f.obs, f."createdAt", f."updatedAt", f.carga_id
        FROM raw_reserva.afastamento f
        JOIN stg.reserva_militar rm ON rm.id = f."militarId"
        JOIN core.dim_militar dm ON dm.matricula = rm.matricula
    """)

    cur.execute("""
        INSERT INTO core.fato_previsao_reserva
            (sk_tempo, sk_militar, data_reserva_requerimento,
             data_reserva_compulsoria, abono_permanencia, data_inicio_abono,
             processo_sei_abono, carga_id)
        SELECT (to_char(current_date, 'YYYYMMDD'))::int, dm.sk_militar,
               m."reservaRequerimento"::date, m."reservaCompulsoria"::date,
               m."abonoPermanencia", m."dataInicioAbono"::date,
               m."processoSeiAbono", m.carga_id
        FROM raw_reserva.militar m
        JOIN core.dim_militar dm
          ON dm.matricula = replace(trim(m.matricula), '-', '')
        ON CONFLICT (sk_tempo, sk_militar) DO NOTHING
    """)

    # Averbacao de quem nao esta no efetivo ativo do Peculio nao entra: a
    # dim_militar so tem os 2.658 ativos, e um fato sem dimensao nao existe.
    # Nao e perda silenciosa -- e contada e impressa aqui, porque o dia em que
    # o DW cobrir inativos essas linhas passam a ter para onde ir.
    for tabela, destino in (("averbacao", "fato_averbacao"),
                            ("afastamento", "fato_afastamento_reserva")):
        cur.execute(f"SELECT count(*) FROM raw_reserva.{tabela}")
        origem = cur.fetchone()[0]
        cur.execute(f"SELECT count(*) FROM core.{destino}")
        carregado = cur.fetchone()[0]
        fora = origem - carregado
        extra = f"  ({fora} de militar fora do efetivo ativo)" if fora else ""
        print(f"  {destino:<28} {carregado:>8}{extra}")

    cur.execute("SELECT count(*) FROM core.fato_previsao_reserva")
    print(f"  fato_previsao_reserva        {cur.fetchone()[0]:>8}")


# ---------------------------------------------------------------------------
# Financas
# ---------------------------------------------------------------------------
# A planilha de Financas tem UMA aba de dados ("Banco de Dados - NAO MEXER",
# raw_financas.banco_de_dados_nao_mexer) com tres blocos lado a lado --
# Autorizacao em A:R, Carnaval 2026 em T:AK, SFI Ordinario em AM:AZ. E o mesmo
# recorte por posicao que o script "DF Metabase" do Windmill usa para gravar
# public.fin_*. Aqui a posicao e conferida contra o cabeçalho: se a planilha
# ganhar ou perder coluna, a carga para em vez de somar a coluna errada.
BLOCOS_FINANCAS = {
    # bloco: {campo: (posicao 1-based, trecho(s) aceito(s) no nome da coluna)}
    # O bloco Autorizacao chama o destino de "OME"; os outros, de "DESTINO".
    "autorizacao": {"oficio": (1, "ofic"), "item": (2, "item"), "empenho": (14, "empenho"),
                    "ficha_financ": (7, "ficha"), "valor": (8, "valor"), "destino": (10, ("destino", "ome")),
                    "enquadramento": (11, "enquadr"), "situacao": (12, "situa"),
                    "mes": (13, "mes"), "valor_liquidado": (15, "liquid"),
                    "valor_pago": (16, "pago")},
    "carnaval_2026": {"oficio": (20, "ofic"), "item": (21, "item"), "empenho": (33, "empenho"),
                      "ficha_financ": (26, "ficha"), "valor": (27, "valor"), "destino": (29, "destino"),
                      "enquadramento": (30, "enquadr"), "situacao": (31, "situa"),
                      "mes": (32, "mes"), "valor_liquidado": (34, "liquid"),
                      "valor_pago": (35, "pago")},
    "sfi_ordinario": {"empenho": (48, "empenho"), "natureza": (42, "natureza"), "ficha_financ": (43, "ficha"), "valor": (44, "valor"),
                      "destino": (45, "destino"), "situacao": (46, "situa"),
                      "mes": (47, "mes"), "valor_liquidado": (49, "liquid"),
                      "valor_pago": (50, "pago")},
}
CAMPOS_TEXTO = ("destino", "enquadramento", "situacao", "natureza", "mes", "ficha_financ", "oficio", "item", "empenho")
CAMPOS_VALOR = ("valor", "valor_liquidado", "valor_pago")


# --- Tratamento de GRAFIA da planilha de Financas (2026-10-01) ---------------
# Regra do usuario: o sistema apresenta os dados como estao -- nao corrige valor,
# situacao, destino nem enquadramento. So se tratam erros de digitacao de
# nomenclatura: caixa, espaco e hifen do tipo de gasto (ficha financeira) e o mes
# escrito com palavras extras. O resto vira apontamento no relatorio
# (etl/financas/auditar_planilha.py, que importa estas mesmas funcoes).
MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
EXERCICIO = 2026  # a planilha e do exercicio de 2026; o ano explicito no texto vence
_MES = re.compile(r"^\s*(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-ZÇ]*\b(?:\s*/\s*(20\d\d))?", re.I)


def tratar_mes(texto):
    """'JAN (ASA BRANCA R$ ...)' -> ('JAN', 202601); 'MAIO'/'MAI' -> MAI; 'NOV/2025' ->
    ('NOV/2025', 202511); numero de serie do Excel (bloco Carnaval) -> o mes da data;
    'CANCELADO' ou vazio -> (None, None). Devolve (rotulo, ordem aaaamm)."""
    t = str(texto).strip() if texto is not None else ""
    if re.fullmatch(r"\d{5}", t):
        d = date(1899, 12, 30) + timedelta(days=int(t))
        t = f"{MESES[d.month - 1]}/{d.year}"
    m = _MES.match(t)
    if not m:
        return None, None
    abrev = m.group(1).upper()
    ano = int(m.group(2)) if m.group(2) else None
    rotulo = f"{abrev}/{ano}" if ano and ano != EXERCICIO else abrev
    return rotulo, (ano or EXERCICIO) * 100 + MESES.index(abrev) + 1


PALAVRAS_CORRIGIDAS = {"globa": "global", "miliar": "militar"}
PREFIXOS_FICHA = ["CUSTEIO", "EXECUTIVA PRIORITÁRIA", "EXECUTIVA", "PESSOAL E ENCARGOS SOCIAIS",
                  "OPERAÇÕES DE CRÉDITO", "AUXÍLIOS DE FOLHA"]


def _corrigir_palavras(texto):
    def troca(m):
        certa = PALAVRAS_CORRIGIDAS.get(m.group(0).lower())
        if not certa:
            return m.group(0)
        return certa.upper() if m.group(0).isupper() else certa.capitalize() if m.group(0)[0].isupper() else certa
    return re.sub(r"[A-Za-zÀ-ú]+", troca, texto)


def _chave_ficha(texto):
    sem = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", sem.lower()).strip()


def _estrutura_ficha(texto):
    t = re.sub(r"\s+", " ", (texto or "").strip())
    for p in sorted(PREFIXOS_FICHA, key=len, reverse=True):
        m = re.match(rf"^{re.escape(p)}\s*-\s*(.*)$", t, re.I)
        if m:
            return p, m.group(1).strip()
        if t.upper() == p:
            return p, ""
    return None, t


def construir_mapa_tipos(valores):
    """{texto original: texto tratado}. Grafias que so diferem em caixa, espaco, hifen ou
    acento (ou nas PALAVRAS_CORRIGIDAS) viram a grafia mais frequente do grupo. NAO funde
    tipos diferentes ('Cota Global' e 'Cota Global CBM' seguem separados)."""
    from collections import Counter
    cont = Counter(v for v in valores if v and str(v).strip())
    grupos = {}
    for original, n in cont.items():
        prefixo, resto = _estrutura_ficha(original)
        resto = re.sub(r"\s-(?=\S)", " - ", _corrigir_palavras(resto))
        grupos.setdefault((prefixo or "", _chave_ficha(resto)), []).append((n, original, prefixo, resto))
    mapa = {}
    for itens in grupos.values():
        corpo = Counter()
        for n, _, _, resto in itens:
            corpo[resto] += n
        vencedora = corpo.most_common(1)[0][0]
        for _, original, prefixo, _ in itens:
            mapa[original] = f"{prefixo} - {vencedora}" if prefixo and vencedora else (prefixo or vencedora)
    return mapa


def tratar_grafia_financas(cur):
    """Guarda o texto original (ficha_financ_original, mes_original) e grava o tratado."""
    cur.execute("""UPDATE core.fato_financeiro
                   SET ficha_financ_original = ficha_financ, mes_original = mes""")
    cur.execute("SELECT DISTINCT ficha_financ_original FROM core.fato_financeiro WHERE ficha_financ_original IS NOT NULL")
    mapa = construir_mapa_tipos([r[0] for r in cur.fetchall()])
    if mapa:
        execute_values(cur, """UPDATE core.fato_financeiro f SET ficha_financ = v.tratado
                               FROM (VALUES %s) AS v(original, tratado)
                               WHERE f.ficha_financ_original = v.original""", list(mapa.items()))
    cur.execute("SELECT DISTINCT mes_original FROM core.fato_financeiro WHERE mes_original IS NOT NULL")
    meses = [(m, *tratar_mes(m)) for (m,) in cur.fetchall()]
    if meses:
        execute_values(cur, """UPDATE core.fato_financeiro f SET mes_rotulo = v.rotulo, mes_ordem = v.ordem::int
                               FROM (VALUES %s) AS v(original, rotulo, ordem)
                               WHERE f.mes_original = v.original""", meses)


def carregar_fato_financeiro(cur):
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'raw_financas' AND table_name = 'banco_de_dados_nao_mexer'
          AND column_name LIKE 'col%'
    """)
    col = {int(c[4:6]): c for (c,) in cur.fetchall()}
    if not col:
        print("  fato_financeiro              (raw_financas.banco_de_dados_nao_mexer ausente -- pulado)")
        return

    cur.execute("DELETE FROM core.fato_financeiro")
    for bloco, campos in BLOCOS_FINANCAS.items():
        def confere(pos, trechos):
            nome = col.get(pos) or ""
            return any(t in nome for t in (trechos if isinstance(trechos, tuple) else (trechos,)))

        errados = [f"{campo}: posicao {pos} = {col.get(pos)!r}, esperado {trecho!r}"
                   for campo, (pos, trecho) in campos.items()
                   if not confere(pos, trecho)]
        if errados:
            raise SystemExit(f"planilha de Financas mudou de estrutura no bloco {bloco}: "
                             + "; ".join(errados))

        def expr(campo):
            if campo not in campos:
                return "NULL"
            nome = col[campos[campo][0]]
            if campo in CAMPOS_VALOR:
                return f'stg.valor_monetario("{nome}")'
            return f'nullif(trim("{nome}"), \'\')'

        preenchido = " OR ".join(f'nullif(trim("{col[campos[c][0]]}"), \'\') IS NOT NULL'
                                 for c in ("destino", "valor", "situacao"))
        cur.execute(f"""
            INSERT INTO core.fato_financeiro
                (bloco, linha, destino, enquadramento, situacao, natureza, mes,
                 valor, valor_liquidado, valor_pago, ficha_financ, oficio, item, empenho)
            SELECT %s, linha, {expr('destino')}, {expr('enquadramento')}, {expr('situacao')},
                   {expr('natureza')}, {expr('mes')},
                   {expr('valor')}, {expr('valor_liquidado')}, {expr('valor_pago')},
                   {expr('ficha_financ')}, {expr('oficio')}, {expr('item')}, {expr('empenho')}
            FROM raw_financas.banco_de_dados_nao_mexer
            WHERE {preenchido}
        """, (bloco,))

    tratar_grafia_financas(cur)

    cur.execute("SELECT bloco, count(*) FROM core.fato_financeiro GROUP BY 1 ORDER BY 1")
    resumo = ", ".join(f"{b}={n}" for b, n in cur.fetchall())
    cur.execute("SELECT count(*) FROM marts.financas_destino_sem_mapeamento")
    sem = cur.fetchone()[0]
    extra = f"  !! {sem} destino(s) sem mapeamento (marts.financas_destino_sem_mapeamento)" if sem else ""
    print(f"  fato_financeiro              {resumo}{extra}")


# ---------------------------------------------------------------------------
# QOD (efetivo previsto, lotacao por funcao, chefes) -- ver ddl/11_qod.sql
# ---------------------------------------------------------------------------
# Colunas usadas de cada aba, pelo nome que raw_planilhas.py da ao
# cabecalho. Se a DPlaG renomear uma coluna, a carga para aqui com o nome que
# sumiu, em vez de gravar NULL em silencio.
COLUNAS_QOD = {
    "funcoes_dplag": ["col_01_ome", "col_02_cod_func", "col_03_funcao", "col_05_tipo_vaga"],
    # ID_ATUALIZADO: aba com o ID fixo das funcoes (decisao do usuario, 2026-10-01); a
    # QOD_FUNCOES (agosto) tinha IDs renumerados todo mes.
    "id_atualizado": ["col_01_id_funcao", "col_02_tipo_funcao", "col_04_ome_completa", "col_05_ome",
                    "col_06_localidade", "col_07_secao",
                    "col_08_funcao", "col_09_funcao_completa", "col_10_ordem_exibicao",
                    "col_16_mes", "col_17_ano", "col_18_ativo"],
    "qod_consolidada": ["col_02_antig", "col_03_unidade", "col_04_matricula", "col_05_posto_grad",
                        "col_06_nome_completo", "col_07_csbm_cas_cao", "col_11_portaria", "col_12_bge",
                        "col_08_tipo", "col_10_funcao_de", "col_13_codigo"],
}


def carregar_qod(cur):
    for tabela, colunas in COLUNAS_QOD.items():
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'raw_qod' AND table_name = %s
        """, (tabela,))
        existentes = {c for (c,) in cur.fetchall()}
        if not existentes:
            print(f"  qod                          (raw_qod.{tabela} ausente -- pulado)")
            return
        faltando = [c for c in colunas if c not in existentes]
        if faltando:
            raise SystemExit(f"QOD mudou de estrutura: raw_qod.{tabela} sem {faltando}")

    cur.execute("DELETE FROM core.qod_vaga")
    cur.execute("""
        INSERT INTO core.qod_vaga (linha, ome_qod, cod_funcao, funcao, tipo_vaga)
        SELECT linha, nullif(trim(col_01_ome), ''), nullif(trim(col_02_cod_func), ''),
               nullif(trim(col_03_funcao), ''), upper(nullif(trim(col_05_tipo_vaga), ''))
        FROM raw_qod.funcoes_dplag
        WHERE nullif(trim(col_01_ome), '') IS NOT NULL
    """)

    # O ID de funcao e unico no catalogo; linha repetida (se houver) fica a
    # primeira, para nao derrubar a carga por uma duplicata da planilha.
    cur.execute("DELETE FROM core.qod_funcao")
    cur.execute("""
        INSERT INTO core.qod_funcao (id_funcao, tipo_funcao, ome_qod, secao, funcao,
                                     funcao_completa, ordem_exibicao, ativo, mes_referencia,
                                     ome_completa, localidade)
        SELECT DISTINCT ON (trim(col_01_id_funcao))
               trim(col_01_id_funcao), nullif(trim(col_02_tipo_funcao), ''),
               nullif(trim(col_05_ome), ''), nullif(trim(col_07_secao), ''),
               nullif(trim(col_08_funcao), ''), nullif(trim(col_09_funcao_completa), ''),
               stg.valor_monetario(col_10_ordem_exibicao),
               upper(trim(col_18_ativo)) = 'SIM',
               nullif(trim(concat_ws('/', col_16_mes, col_17_ano)), ''),
               nullif(trim(col_04_ome_completa), ''), nullif(trim(col_06_localidade), '')
        FROM raw_qod.id_atualizado
        WHERE nullif(trim(col_01_id_funcao), '') IS NOT NULL
        ORDER BY trim(col_01_id_funcao), linha
    """)

    cur.execute("DELETE FROM core.qod_ocupacao")
    cur.execute("""
        INSERT INTO core.qod_ocupacao (linha, matricula, nome_qod, unidade_qod, posto_grad,
                                       id_funcao, tipo, funcao_de, antiguidade,
                                       cursos, portaria, bge)
        SELECT linha, nullif(regexp_replace(coalesce(col_04_matricula, ''), '[^0-9]', '', 'g'), ''),
               nullif(trim(col_06_nome_completo), ''),
               nullif(trim(col_03_unidade), ''), nullif(trim(col_05_posto_grad), ''),
               nullif(trim(col_13_codigo), ''), nullif(trim(col_08_tipo), ''),
               nullif(trim(col_10_funcao_de), ''), stg.valor_monetario(col_02_antig),
               nullif(trim(col_07_csbm_cas_cao), ''), nullif(trim(col_11_portaria), ''),
               nullif(trim(col_12_bge), '')
        FROM raw_qod.qod_consolidada
        WHERE nullif(trim(col_04_matricula), '') IS NOT NULL
    """)

    cur.execute("SELECT count(*) FROM core.qod_vaga WHERE tipo_vaga = 'FUNCIONAL'")
    vagas = cur.fetchone()[0]
    cur.execute("SELECT count(*), count(DISTINCT id_funcao) FROM core.qod_ocupacao")
    ocup, funcoes = cur.fetchone()
    cur.execute("""
        SELECT DISTINCT ome_qod FROM core.qod_vaga
        WHERE ome_qod NOT IN (SELECT ome_qod FROM stg.qod_ome_organograma)
    """)
    fora = [o for (o,) in cur.fetchall()]
    extra = f"  !! OME do QOD sem sigla no organograma: {fora}" if fora else ""
    print(f"  qod                          {vagas} vagas funcionais, {ocup} ocupacoes "
          f"em {funcoes} funcoes{extra}")


# ---------------------------------------------------------------------------
# Quadros do QOD (previsto por unidade e posto) -- ver 15_qod_quadros.sql
# ---------------------------------------------------------------------------
# Colunas do quadro GERAL 001 (posicao 1-based na aba): A = rotulo, B..G = QOC
# (Cel..2o Ten), H = soma, I..L = QOA (Maj..2o Ten), M = soma, N..S = pracas
# (Subten..Sd), T = soma, U = TOTAL.
POSICAO_QUADRO = {"cel": 2, "ten_cel": 3, "maj_qoc": 4, "cap_qoc": 5, "ten1_qoc": 6, "ten2_qoc": 7,
                  "maj_qoa": 9, "cap_qoa": 10, "ten1_qoa": 11, "ten2_qoa": 12,
                  "subten": 14, "sgt1": 15, "sgt2": 16, "sgt3": 17, "cb": 18, "sd": 19, "total": 21}
# Primeira palavra do rotulo do quadro -> sigla do organograma. "Comando Geral" e
# "Subcomando Geral" somam no gabinete; CPPA na DGP.
SIGLA_DO_QUADRO = {
    "COMANDO": "GCG", "SUBCOMANDO": "GSG", "GCG": "GCG", "GSG": "GSG", "CI": "CI", "CPO": "CPO",
    "AECI": "AECI", "CCS": "CCS", "AJG": "AJG", "CPP": "CPP", "DGO": "DGO", "DIM": "DIM",
    "GBI": "GBI", "GBAPH": "GBAPH", "GBS": "GBS", "GBMAR": "GBMar", "CAT/RMR": "CAT/RMR",
    "CAT/ZM": "CAT/ZM", "CAT/AG": "CAT/AG", "CAT/SE": "CAT/SE", "DIESP": "DIESP", "DAS": "DAS",
    "DGP": "DGP", "CPPA": "DGP", "DJD": "DJD", "DVP": "DVP", "DTIC": "DTIC", "DPLAG": "DPLAG",
    "DLOG": "DLOG", "CMAN": "CMAN", "CINT": "CINT", "CEAO": "CEAO", "DF": "DF", "DEIP": "DEIP",
    "ABMG": "ABMG", "CEFD": "CEFD",
}


def sigla_do_quadro(rotulo):
    t = re.sub(r"^\d+(\.\d+)*[\.\)]?\s*", "", str(rotulo).strip())
    m = re.match(r"(\d+)\s*º\s*GB", t)
    if m:
        return f"{m.group(1)}º GB"
    palavras = t.split()
    if palavras and palavras[0].upper() == "DINTER" and len(palavras) > 1:
        return {"I": "DINTER I", "II": "DINTER II"}.get(palavras[1].upper())
    return SIGLA_DO_QUADRO.get(palavras[0].upper()) if palavras else None


def carregar_quadro_qod(cur):
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'raw_qod_quadros' AND table_name = 'geral_001' AND column_name LIKE 'col%'
    """)
    col = {int(c[4:6]): c for (c,) in cur.fetchall()}
    if not col:
        print("  qod_quadro_unidade           (raw_qod_quadros.geral_001 ausente -- pulado)")
        return
    campos = ", ".join(f'"{col[p]}"' for p in [1] + list(POSICAO_QUADRO.values()))
    cur.execute(f"SELECT {campos} FROM raw_qod_quadros.geral_001")
    nomes = list(POSICAO_QUADRO)
    linhas, sem_sigla = [], []
    for r in cur.fetchall():
        rotulo = (r[0] or "").strip()
        if not re.match(r"^\d", rotulo):
            continue
        try:
            valores = [int(float(x)) if x not in (None, "") else 0 for x in r[1:]]
        except ValueError:
            continue
        sigla = sigla_do_quadro(rotulo)
        if sigla is None:
            sem_sigla.append(rotulo)
        linhas.append((rotulo, sigla, *valores))
    cur.execute("DELETE FROM core.qod_quadro_unidade")
    if linhas:
        execute_values(cur, f"INSERT INTO core.qod_quadro_unidade (rotulo, sigla_organograma, {', '.join(nomes)}) VALUES %s", linhas)
    cur.execute("SELECT count(*), coalesce(sum(total), 0) FROM core.qod_quadro_unidade")
    n, total = cur.fetchone()
    extra = f"  !! quadro sem sigla no organograma: {sem_sigla}" if sem_sigla else ""
    print(f"  qod_quadro_unidade           {n} quadros, previsto {total}{extra}")


# ---------------------------------------------------------------------------
# Divisoes do organograma: previsto e lotacao por divisao -- ver 21_divisoes.sql
# ---------------------------------------------------------------------------
# O QOD e UM NIVEL MAIS FINO que o organograma do app: lista "Secao de
# Tesouraria - STes", que no organograma esta dentro de "Divisao Administrativa".
# As divisoes que o app mostra por unidade estao em stg.divisao_organograma
# (copia de SUBSETORES, de src/data/organograma.js, sem as unidades-filhas). Estas
# duas cargas casam o QOD com elas e gravam o resultado:
#   core.qod_previsto_divisao    previsto por unidade e divisao (quadros de setembro)
#   core.qod_funcao_divisao      divisao de cada funcao do catalogo
#   core.qod_lotacao_divisao     quem esta lotado em cada divisao (por unidade do militar)
# Casamento por texto, com heuristica -- o que nao casa fica sem divisao e conta so
# no total da unidade: numero errado no painel e pior que numero ausente. As duas
# cargas rodam dentro de um SAVEPOINT (ver carregar_divisoes_qod): se quebrarem, o
# resto da carga segue e a divisao fica com o valor da rodada anterior.

# Aba de unidade dos quadros (raw_qod_quadros.<nome>_<numero>) -> sigla.
ABA_DO_QUADRO = {
    "gcg": "GCG", "ci": "CI", "cpo": "CPO", "aeci": "AECI", "ccs": "CCS", "gsg": "GSG",
    "ajg": "AJG", "cpp": "CPP", "dgo": "DGO", "dim": "DIM", "gbi": "GBI", "gbaph": "GBAPH",
    "gbs": "GBS", "gbmar": "GBMar", "diesp": "DIESP", "cat_rmr": "CAT/RMR",
    "dinter_i": "DINTER I", "1o_gb": "1º GB", "2o_gb": "2º GB", "6o_gb": "6º GB",
    "7o_gb": "7º GB", "cat_zm": "CAT/ZM", "cat_ag": "CAT/AG", "dinter_ii": "DINTER II",
    "3o_gb": "3º GB", "4o_gb": "4º GB", "5o_gb": "5º GB", "9o_gb": "9º GB",
    "cat_ser": "CAT/SE", "das": "DAS", "dgp": "DGP", "djd": "DJD", "dvp": "DVP",
    "dtic": "DTIC", "dplag": "DPLAG", "dlog": "DLOG", "cman": "CMAN", "cint": "CINT",
    "ceao": "CEAO", "df": "DF", "deip": "DEIP", "abmg": "ABMG", "cefd": "CEFD",
}
# Abas "satelite" que somam em outra unidade como divisao extra (CPPA soma na DGP --
# decisao registrada em DW_PLANEJAMENTO.md).
ABA_SATELITE = {"cppa": ("DGP", "CPPA")}

PADRAO_SECAO_OPERACIONAL = re.compile(r"\bSB(APH|SA|FN|I|S)?\b|\bSATec\b", re.IGNORECASE)
PADRAO_CABECALHO = re.compile(r"^(\d+(?:\.\d+)*)\)\s*(.+)$")
PADRAO_CORPO = re.compile(r"^[a-z]\.\s")


def _norm_quadro(s):
    s = str(s or "").strip()
    s = re.sub(r"^↳\s*", "", s)
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"\s+", " ", s).strip()


def _variantes_quadro(titulo):
    """Texto completo, so a abreviacao (depois do ultimo hifen) e o nome sem ela --
    cada uma tambem numa forma "solta" (sem espacos/hifens), porque o QOD tem
    inconsistencias de digitacao."""
    vs = {_norm_quadro(titulo)}
    partes = re.split(r"\s*-\s*", str(titulo))
    if len(partes) >= 2:
        vs.add(_norm_quadro(partes[-1]))
        vs.add(_norm_quadro(" - ".join(partes[:-1])))
    return vs | {re.sub(r"[\s-]+", "", v) for v in vs}


class _NoQuadro:
    __slots__ = ("titulo", "nivel", "proprio", "filhos", "claimed", "pai", "alvo")

    def __init__(self, titulo, nivel):
        self.titulo, self.nivel = titulo, nivel
        self.proprio, self.filhos, self.claimed = 0.0, [], False
        self.pai, self.alvo = None, None


def _numero(valor):
    try:
        return float(str(valor).strip().replace(",", "."))
    except (TypeError, ValueError):
        return None


def _arvore_quadro(linhas):
    """linhas = [(discriminacao, total)] a partir da linha 6 da aba. Devolve as
    raizes da arvore numerada ("1)", "4.1)") e o TOTAL da planilha. As linhas-filho
    ("a. Chefe") somam seu total no no que as abre."""
    raizes, pilha, total_planilha = [], [], None
    for discriminacao, total in linhas:
        a = str(discriminacao or "").strip()
        if not a:
            continue
        if a.upper().startswith("TOTAL"):
            total_planilha = _numero(total)
            break
        m = PADRAO_CABECALHO.match(a)
        if m:
            no = _NoQuadro(m.group(2).strip(), len(m.group(1).split(".")))
            while pilha and pilha[-1].nivel >= no.nivel:
                pilha.pop()
            if pilha:
                no.pai = pilha[-1]
                pilha[-1].filhos.append(no)
            else:
                raizes.append(no)
            pilha.append(no)
        elif PADRAO_CORPO.match(a) and pilha:
            n = _numero(total)
            if n is not None:
                pilha[-1].proprio += n
    return raizes, total_planilha


def _achatar_quadro(raizes):
    saida = []

    def visitar(no):
        saida.append(no)
        for f in no.filhos:
            visitar(f)

    for r in raizes:
        visitar(r)
    return saida


def _rollup_quadro(no):
    """Soma do no e dos descendentes que NENHUMA outra divisao reivindicou."""
    return no.proprio + sum(_rollup_quadro(f) for f in no.filhos if not f.claimed)


def calcular_previsto_divisao(linhas, alvos):
    """Previsto de cada divisao `alvos` (nomes de stg.divisao_organograma) numa aba
    de unidade. Devolve (divisoes, extras, soma, total_da_planilha, nao_casados, heranca)."""
    raizes, total_planilha = _arvore_quadro(linhas)
    nos = _achatar_quadro(raizes)
    resultado, nao_casados = {}, []

    # Passo 1: casamento por texto (so quando ha um unico candidato).
    for alvo in alvos:
        vs_alvo = _variantes_quadro(alvo)
        candidatos = [n for n in nos if not n.claimed and (_variantes_quadro(n.titulo) & vs_alvo)]
        if len(candidatos) == 1:
            candidatos[0].claimed = True
            candidatos[0].alvo = alvo
            resultado[alvo] = candidatos[0]
        else:
            nao_casados.append(alvo)

    # Passo 2: secoes operacionais (SB/SATec) restantes casam por posicao -- cobre
    # rotulos duplicados por erro de digitacao no QOD.
    alvos_op = [a for a in nao_casados if PADRAO_SECAO_OPERACIONAL.search(a)]
    nos_op = [n for n in nos if not n.claimed and PADRAO_SECAO_OPERACIONAL.search(n.titulo)]
    for alvo, no in zip(alvos_op, nos_op):
        no.claimed = True
        no.alvo = alvo
        resultado[alvo] = no
        nao_casados.remove(alvo)

    # Heranca: cada no do quadro pertence a divisao do ancestral mais proximo que
    # alguma divisao reivindicou. Serve para a lotacao: "Nucleo de Justica e
    # Disciplina" nao e divisao do app, mas o quadro o pendura em "Secretaria e Apoio
    # do Comando". Titulo que aparece em divisoes diferentes fica de fora (ambiguo).
    heranca, ambiguos = {}, set()
    for no in nos:
        ancestral = no
        while ancestral is not None and ancestral.alvo is None:
            ancestral = ancestral.pai
        if ancestral is None:
            continue
        chave = _norm_quadro(no.titulo)
        if heranca.setdefault(chave, ancestral.alvo) != ancestral.alvo:
            ambiguos.add(chave)
    heranca = {k: v for k, v in heranca.items() if k not in ambiguos}

    divisoes = [(alvo, int(round(_rollup_quadro(resultado[alvo]))) if alvo in resultado else 0) for alvo in alvos]
    extras = [(r.titulo, int(round(_rollup_quadro(r)))) for r in raizes if not r.claimed]
    soma = sum(p for _, p in divisoes) + sum(p for _, p in extras)
    return divisoes, extras, soma, total_planilha, nao_casados, heranca


def _linhas_da_aba(cur, tabela):
    """[(discriminacao, total)] da aba, na ordem da planilha, a partir da linha 6."""
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'raw_qod_quadros' AND table_name = %s AND column_name LIKE 'col\\_%%'
    """, (tabela,))
    col = {int(c[4:6]): c for (c,) in cur.fetchall()}
    if 1 not in col or 21 not in col:
        return None
    cur.execute(f'SELECT "{col[1]}", "{col[21]}" FROM raw_qod_quadros."{tabela}" WHERE linha >= 6 ORDER BY linha')
    return cur.fetchall()


def previsto_das_divisoes(cur):
    """({sigla: [(nome, previsto, extra)]}, avisos, {sigla: {titulo: divisao}}), lendo as
    abas de unidade dos quadros (raw_qod_quadros). Somente leitura."""
    cur.execute("""
        SELECT sigla, nome FROM stg.divisao_organograma ORDER BY sigla, ordem
    """)
    alvos_por_sigla = {}
    for sigla, nome in cur.fetchall():
        alvos_por_sigla.setdefault(sigla, []).append(nome)

    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'raw_qod_quadros'")
    tabelas = {}
    for (t,) in cur.fetchall():
        m = re.match(r"^(.+)_(\d{3})$", t)
        if m:
            tabelas[m.group(1)] = t

    resultado, avisos, herancas = {}, [], {}
    # O satelite (CPPA) nao entra como alvo da aba da unidade: soma a parte.
    satelites = {sigla: rotulo for sigla, rotulo in ABA_SATELITE.values()}
    for chave, sigla in ABA_DO_QUADRO.items():
        tabela = tabelas.get(chave)
        if not tabela:
            avisos.append(f"{sigla}: aba '{chave}' ausente em raw_qod_quadros")
            continue
        linhas = _linhas_da_aba(cur, tabela)
        if linhas is None:
            avisos.append(f"{sigla}: aba {tabela} sem as colunas esperadas")
            continue
        alvos = [a for a in alvos_por_sigla.get(sigla, []) if a != satelites.get(sigla)]
        divisoes, extras, soma, total, nao_casados, heranca = calcular_previsto_divisao(linhas, alvos)
        herancas[sigla] = heranca
        resultado[sigla] = [(n, p, False) for n, p in divisoes] + [(n, p, True) for n, p in extras]
        if nao_casados:
            avisos.append(f"{sigla}: divisoes sem correspondencia na aba: {nao_casados}")
        if total is not None and abs(soma - total) > 0.01:
            avisos.append(f"{sigla}: soma das divisoes ({soma}) != TOTAL da aba ({total})")
    for chave, (sigla, rotulo) in ABA_SATELITE.items():
        tabela = tabelas.get(chave)
        linhas = _linhas_da_aba(cur, tabela) if tabela else None
        if linhas is None:
            avisos.append(f"{rotulo}: aba '{chave}' ausente em raw_qod_quadros")
            continue
        _, total = _arvore_quadro(linhas)
        valor = int(round(total or 0))
        itens = resultado.setdefault(sigla, [])
        # Se o app ja lista o satelite como divisao (CPPA na DGP), o valor vai nela;
        # senao entra como divisao extra.
        existente = next((i for i, (n, _, _) in enumerate(itens) if n == rotulo), None)
        if existente is not None:
            itens[existente] = (rotulo, valor, False)
        else:
            itens.append((rotulo, valor, True))
    return resultado, avisos, herancas


# --- Lotacao: casa a secao/funcao do QOD com a divisao do organograma -------------
OME_ALIAS_DIVISAO = {
    "ajg": "AJG", "diesp": "DIESP", "cat rmr": "CAT/RMR", "dinter 1": "DINTER I",
    "dinter ii": "DINTER II", "cat ser": "CAT/SE", "dlog": "DLOG", "dplag": "DPLAG",
    "gsg": "GSG", "cint": "CINT", "cman": "CMAN", "cppa": "DGP",
}
# Prefixos que resolvem o topo da unidade, onde o texto nao cita o nome da divisao
# (as duas primeiras olham a FUNCAO; as demais, a SECAO).
PREFIXOS_COMANDO = [
    (re.compile(r"^subcomand"), "subcomand"), (re.compile(r"^comand"), "comand"),
    (re.compile(r"^diretor"), "diretor"), (re.compile(r"^chefia\b"), "chefia"),
    (re.compile(r"^gabinete do (sub)?comando"), "chefia"),
]
# Cargo que E a unidade (Comandante Geral, Subcomandante Geral, Diretor): se a
# unidade nao tem divisao propria para ele, fica SEM divisao de proposito.
CARGO_DE_TOPO = re.compile(r"^(comandante|subcomandante|diretor)")
# ...mas so quando a SECAO tambem e a caixa de topo ("Comandante da 1a SATec" nao).
SECAO_DE_TOPO = re.compile(r"^(comando|subcomando|gabinete|chefia|diretoria)\b")
# Divisoes de vaga unica: so as regras de prefixo podem preenche-las.
DIVISOES_SINGULARES = {"comando", "subcomando", "diretoria", "chefia"}


def _norm_lot(s):
    s = str(s or "").strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = s.replace("divisao", "div").replace("secao", "sec").replace("nucleo", "nuc")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _contem_palavra(maior, menor):
    return bool(maior and menor and re.search(r"\b" + re.escape(menor) + r"\b", maior))


def _variantes_lot(titulo):
    partes = re.split(r"\s*-\s*", titulo)
    formas = {titulo}
    if len(partes) >= 2:
        formas.add(partes[-1])
        formas.add(" - ".join(partes[:-1]))
    # "1ª SBI/GBI (Jaboatao)" -> "1ª SBI": o QOD nomeia a secao sem a cidade.
    formas.add(re.sub(r"\s*/\s*\S+\s*\([^)]*\)\s*$", "", titulo))
    formas.add(re.sub(r"\s*\([^)]*\)\s*$", "", titulo))
    return {_norm_lot(f) for f in formas if _norm_lot(f)}


def casar_divisao(texto, divisoes):
    """Casa um titulo (secao do QOD ou nome da funcao) com as divisoes do
    organograma. Devolve o nome como esta em stg.divisao_organograma, ou None."""
    core = _norm_lot(texto)
    if not core:
        return None
    candidatos = [(d, _variantes_lot(d)) for d in divisoes]

    melhores = []
    for divisao, variantes in candidatos:
        if _norm_lot(divisao) in DIVISOES_SINGULARES:
            continue
        for v in variantes:
            if len(v) >= 4 and (_contem_palavra(core, v) or _contem_palavra(v, core)):
                melhores.append((len(v), divisao))
    if melhores:
        return sorted(melhores, reverse=True)[0][1]

    # Cargo de topo da unidade: a funcao nao cita a divisao, so o cargo.
    for padrao, prefixo in PREFIXOS_COMANDO:
        if padrao.match(core):
            for divisao, variantes in candidatos:
                if any(v.startswith(prefixo) for v in variantes):
                    return divisao
    m = re.match(r"^chefe d[oae]\s+(.+)$", core)
    if m and len(m.group(1)) <= 6:
        for divisao, variantes in candidatos:
            if any(v.startswith("chefia") for v in variantes):
                return divisao

    # Sobreposicao de palavras (>= 70%) -- uma palavra a mais no meio quebra a
    # contencao literal, mas o conjunto ainda bate.
    alvo_tokens = set(core.split())
    melhores = []
    for divisao, variantes in candidatos:
        if _norm_lot(divisao) in DIVISOES_SINGULARES:
            continue
        for v in variantes:
            v_tokens = set(v.split())
            if len(v_tokens) < 2:
                continue
            menor = min(len(alvo_tokens), len(v_tokens))
            razao = len(alvo_tokens & v_tokens) / menor if menor else 0
            if razao >= 0.7:
                melhores.append((razao, len(v), divisao))
    if melhores:
        return sorted(melhores, reverse=True)[0][2]
    return None


def unidade_pai_do_qod(ome, siglas_validas):
    """Sigla do organograma para a OME do catalogo. Secoes operacionais vem como
    "1ª SB/4º GB": a unidade-mae e a parte depois da ultima barra."""
    ome = str(ome or "").strip()
    chave = _norm_lot(ome)
    if chave in OME_ALIAS_DIVISAO:
        return OME_ALIAS_DIVISAO[chave]
    if ome in siglas_validas:
        return ome
    if "/" in ome:
        parte = ome.rsplit("/", 1)[-1].strip()
        if parte in siglas_validas:
            return parte
    return ome


def resolver_divisao_da_funcao(item, divisoes_da_sigla, herancas=None):
    """Divisao do organograma de uma funcao do catalogo (ou None). Se o texto nao
    casa com nenhuma divisao, tenta a hierarquia do quadro (`herancas`): a secao da
    funcao e um no do quadro, e a divisao dele e a do ancestral mais proximo."""
    divisao = _resolver_por_texto(item, divisoes_da_sigla)
    if divisao is None and herancas and item["ome"] == item["sigla"]:
        divisao = herancas.get(item["sigla"], {}).get(_norm_quadro(item["secao"]))
    return divisao


def _resolver_por_texto(item, divisoes_da_sigla):
    sigla, divisoes = item["sigla"], divisoes_da_sigla.get(item["sigla"], [])
    if not divisoes:
        return None
    # Secao que e sub-OME propria ("1a SB/1o GB") casa pelo NOME DA OME: o comandante
    # da SB pertence a caixa da SB, nao ao "Comando" do GB.
    if item["ome"] != sigla:
        return casar_divisao(item["ome"], divisoes)
    # Cargo que E a unidade: resolvido pelo nome da FUNCAO, nunca pela secao.
    if SECAO_DE_TOPO.match(_norm_lot(item["secao"])) and CARGO_DE_TOPO.match(_norm_lot(item["funcao"])):
        return casar_divisao(item["funcao"], divisoes)
    return casar_divisao(item["secao"], divisoes)


def lotacao_das_divisoes(cur):
    """(divisao de cada funcao, {(sigla do militar, divisao): {matriculas}}, avisos).
    Somente leitura."""
    cur.execute("SELECT sigla, nome FROM stg.divisao_organograma ORDER BY sigla, ordem")
    divisoes_da_sigla = {}
    for sigla, nome in cur.fetchall():
        divisoes_da_sigla.setdefault(sigla, []).append(nome)
    cur.execute("SELECT valor_origem FROM stg.de_para_ome WHERE sistema = 'organograma'")
    siglas_validas = {s for (s,) in cur.fetchall()} | set(divisoes_da_sigla)

    cur.execute("""
        SELECT id_funcao, tipo_funcao, ome_qod, coalesce(secao, ''), coalesce(funcao, ''), ordem_exibicao
        FROM core.qod_funcao
    """)
    catalogo = {}
    for id_funcao, tipo, ome, secao, funcao, ordem in cur.fetchall():
        ome = (ome or "").strip()
        catalogo[id_funcao] = {"tipo": tipo, "ome": ome, "secao": secao.strip(), "funcao": funcao.strip(),
                               "ordem": float(ordem or 0), "sigla": unidade_pai_do_qod(ome, siglas_validas)}
    _, _, herancas = previsto_das_divisoes(cur)
    for item in catalogo.values():
        item["divisao"] = resolver_divisao_da_funcao(item, divisoes_da_sigla, herancas)

    # Funcao lancada mais de uma vez (mesma OME, secao e nome) vira UMA: a de menor
    # ordem de exibicao e a canonica.
    por_tripla = {}
    for chave, item in sorted(catalogo.items(), key=lambda kv: kv[1]["ordem"]):
        por_tripla.setdefault((item["ome"], item["secao"], item["funcao"]), []).append(chave)
    canonico = {rep: ids[0] for ids in por_tripla.values() if len(ids) > 1 for rep in ids[1:]}

    # Unidade de cada militar do efetivo ativo (a mesma do app: marts.efetivo_nominal).
    cur.execute("SELECT matricula_normalizada, sigla FROM marts.efetivo_nominal")
    sigla_do_militar = dict(cur.fetchall())

    cur.execute("SELECT matricula, id_funcao FROM core.qod_ocupacao WHERE matricula IS NOT NULL AND id_funcao IS NOT NULL")
    funcoes_do_militar = {}
    for matricula, id_funcao in cur.fetchall():
        id_funcao = canonico.get(id_funcao, id_funcao)
        item = catalogo.get(id_funcao)
        if item is not None and matricula in sigla_do_militar:
            funcoes_do_militar.setdefault(matricula, []).append(item)

    # Conta so FUNCAO, mais o ENCARGO de quem nao tem nenhuma funcao lancada --
    # senao quem acumula contaria duas vezes na secao.
    lotacao, sem_divisao = {}, 0
    for matricula, itens in funcoes_do_militar.items():
        sigla = sigla_do_militar[matricula]
        divisoes_do_militar = divisoes_da_sigla.get(sigla, [])
        for item in ([i for i in itens if i["tipo"] == "FUNÇÃO"] or itens):
            divisao = item["divisao"]
            # A divisao foi resolvida contra a unidade DO CATALOGO; se o Peculio lota o
            # militar em outra unidade, so vale a divisao que exista la. Divisao ja nula
            # fica nula (foi anulada de proposito).
            if divisao and divisao not in divisoes_do_militar:
                divisao = casar_divisao(item["secao"], divisoes_do_militar)
            if divisao:
                lotacao.setdefault((sigla, divisao), set()).add(matricula)
            else:
                sem_divisao += 1
    return {k: v["divisao"] for k, v in catalogo.items()}, lotacao, sem_divisao


def carregar_divisoes_qod(cur):
    """Roda as duas cargas dentro de SAVEPOINTs: se uma quebrar, a carga segue."""
    cur.execute("SELECT to_regclass('stg.divisao_organograma') IS NOT NULL")
    if not cur.fetchone()[0]:
        print("  divisoes do organograma      (stg.divisao_organograma ausente -- aplique ddl/21; pulado)")
        return
    cur.execute("SELECT count(*) FROM stg.divisao_organograma")
    if not cur.fetchone()[0]:
        print("  divisoes do organograma      (stg.divisao_organograma vazia -- pulado)")
        return

    cur.execute("SAVEPOINT divisoes_previsto")
    try:
        previsto, avisos, _herancas = previsto_das_divisoes(cur)
        linhas = [(sigla, i, nome, prev, extra)
                  for sigla, itens in previsto.items() for i, (nome, prev, extra) in enumerate(itens, 1)]
        if linhas:
            cur.execute("DELETE FROM core.qod_previsto_divisao")
            execute_values(cur, "INSERT INTO core.qod_previsto_divisao (sigla, ordem, divisao, previsto, extra) VALUES %s", linhas)
        print(f"  qod_previsto_divisao         {len(linhas)} linhas, previsto {sum(l[3] for l in linhas)}")
        for a in avisos:
            print(f"    !! {a}")
        cur.execute("RELEASE SAVEPOINT divisoes_previsto")
    except Exception as erro:  # noqa: BLE001 -- a carga principal nao pode cair por isto
        cur.execute("ROLLBACK TO SAVEPOINT divisoes_previsto")
        print(f"  qod_previsto_divisao         !! FALHOU, mantida a rodada anterior: {erro}")

    cur.execute("SAVEPOINT divisoes_lotacao")
    try:
        divisao_da_funcao, lotacao, sem_divisao = lotacao_das_divisoes(cur)
        cur.execute("DELETE FROM core.qod_funcao_divisao")
        execute_values(cur, "INSERT INTO core.qod_funcao_divisao (id_funcao, divisao) VALUES %s",
                       [(k, v) for k, v in divisao_da_funcao.items() if v])
        cur.execute("DELETE FROM core.qod_lotacao_divisao")
        execute_values(cur, "INSERT INTO core.qod_lotacao_divisao (sigla, divisao, matricula) VALUES %s",
                       [(s, d, m) for (s, d), mats in lotacao.items() for m in sorted(mats)])
        com = sum(1 for v in divisao_da_funcao.values() if v)
        print(f"  qod_funcao_divisao           {com} de {len(divisao_da_funcao)} funcoes com divisao; "
              f"{sum(len(m) for m in lotacao.values())} lotacoes em {len(lotacao)} divisoes "
              f"({sem_divisao} funcoes de militares sem divisao)")
        cur.execute("RELEASE SAVEPOINT divisoes_lotacao")
    except Exception as erro:  # noqa: BLE001
        cur.execute("ROLLBACK TO SAVEPOINT divisoes_lotacao")
        print(f"  qod_funcao_divisao           !! FALHOU, mantida a rodada anterior: {erro}")


# ---------------------------------------------------------------------------
# Retencao do Mapa de Forca (22_retencao_e_views.sql)
# ---------------------------------------------------------------------------
JANELA_MAPA_FORCA_DIAS = 30


def guardar_historico_emprego(cur):
    """Antes de reconstruir os fatos de lancamento, grava (agregado por dia, sem
    matricula nem nome) o que o core ainda tem de dias que ja SAIRAM da janela de 30
    dias. A raw so copia a janela (stg.raw_filtro), entao sem isto o corte apagaria a
    serie historica que o BI e o validar.py usam. Idempotente; na primeira rodada
    depois da retencao o core ainda tem os anos antigos e eles entram todos aqui."""
    cur.execute("SELECT to_regclass('core.emprego_historico_ome_dia') IS NOT NULL")
    if not cur.fetchone()[0]:
        print("  historico do emprego         (22_retencao_e_views.sql nao aplicado -- pulado)")
        return
    cur.execute("SAVEPOINT historico_emprego")
    try:
        cur.execute("SELECT max(date) FROM raw_mapa_forca.launches")
        fim = cur.fetchone()[0]
        if fim is None:
            cur.execute("RELEASE SAVEPOINT historico_emprego")
            print("  historico do emprego         (raw_mapa_forca.launches vazia -- nada a guardar)")
            return
        corte = fim - timedelta(days=JANELA_MAPA_FORCA_DIAS - 1)
        cur.execute("""
            INSERT INTO core.emprego_historico_viatura_dia (id_frota, data, lancamentos)
            SELECT v.id_frota, t.data, count(*)
            FROM core.fato_lancamento_viatura l
            JOIN core.dim_viatura v ON v.sk_viatura = l.sk_viatura
            JOIN core.dim_tempo t ON t.sk_tempo = l.sk_tempo
            WHERE t.data < %s AND v.id_frota IS NOT NULL
            GROUP BY v.id_frota, t.data
            ON CONFLICT (id_frota, data) DO UPDATE SET lancamentos = EXCLUDED.lancamentos
        """, (corte,))
        n_vtr = cur.rowcount
        cur.execute("""
            INSERT INTO core.emprego_historico_ome_dia (sigla, data, lancamentos, militares_escalados)
            SELECT o.sigla, t.data, count(DISTINCT l.id_lancamento), count(*)
            FROM core.fato_lancamento_militar l
            JOIN core.dim_tempo t ON t.sk_tempo = l.sk_tempo
            JOIN core.dim_ome o ON o.sk_ome = l.sk_ome
            WHERE t.data < %s
            GROUP BY o.sigla, t.data
            ON CONFLICT (sigla, data) DO UPDATE
                SET lancamentos = EXCLUDED.lancamentos, militares_escalados = EXCLUDED.militares_escalados
        """, (corte,))
        n_ome = cur.rowcount
        cur.execute("RELEASE SAVEPOINT historico_emprego")
        print(f"  historico do emprego         ate {corte - timedelta(days=1)}: {n_vtr} viatura-dias, {n_ome} unidade-dias gravados")
    except Exception as erro:  # noqa: BLE001
        # Diferente das divisoes: aqui a carga PARA. Se seguisse, o core seria reconstruido
        # so com a janela e o historico que ainda esta nele se perderia para sempre.
        cur.execute("ROLLBACK TO SAVEPOINT historico_emprego")
        raise SystemExit(f"historico do emprego falhou -- carga interrompida para nao perder o core antigo: {erro}")


def main():
    # role=etl_writer: o que esta carga cria (views em stg) fica com o dono
    # das camadas, seja rodada pelo Windmill (windmill_etl) ou a mao pelo
    # administrador. Ver etl/dw/ddl/07_papeis.sql.
    conn = psycopg2.connect(url_do_dw(), connect_timeout=30, options="-c role=etl_writer")
    cur = conn.cursor()

    print("Historico do emprego operacional (antes do corte da janela):")
    guardar_historico_emprego(cur)

    print("Snapshots diarios (guardados pela chave natural):")
    limpar(cur)

    print("\nDimensoes:")
    carregar_dim_tempo(cur)
    carregar_dim_ome(cur)
    carregar_dimensoes_escala(cur)
    carregar_dimensoes_pessoal(cur)
    carregar_dim_viatura(cur)

    # Antes do primeiro commit, de proposito: as temporarias de limpar() sao
    # ON COMMIT DROP. E se a carga quebrar no meio, o rollback devolve os
    # snapshots intactos.
    print("\nSnapshots devolvidos:")
    restaurar_snapshots(cur)
    conn.commit()

    print("\nDe-para:")
    carregar_de_para_ome(cur)
    carregar_peculio_titular(cur)
    carregar_de_para_viatura(cur)
    conn.commit()

    print("\nFatos:")
    carregar_fato_efetivo_diario(cur)
    carregar_fato_frota_diaria(cur)
    carregar_fatos_lancamento(cur)
    carregar_fatos_reserva(cur)
    carregar_fato_financeiro(cur)
    carregar_qod(cur)
    carregar_quadro_qod(cur)
    carregar_divisoes_qod(cur)
    conn.commit()

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
