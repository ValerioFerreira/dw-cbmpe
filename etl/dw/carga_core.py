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
import importlib.util
import json
import os
import re
import unicodedata
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

RAIZ = Path(__file__).resolve().parents[2]
MAPEAMENTO_PECULIO = RAIZ / "etl" / "efetivo" / "mapeamento_unidades.json"

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


def arvore_do_organograma():
    """Le a ARVORE de src/data/organograma.js.

    O organograma e a autoridade sobre QUEM PENDE DE QUEM (decisao do usuario,
    2026-08-24); a tb_ome do SGP continua sendo o registro do QUE EXISTE. As
    duas divergem em pontos reais: o SGP pendura DAS e CEFD na DGP, o
    organograma as coloca sob DGA e DEIP.

    Le direto do JS em vez de manter uma copia, para nao existirem duas
    versoes da mesma verdade. Falha alto se o parse nao render nada, que e o
    unico modo de falha silenciosa que essa abordagem tem.
    """
    caminho = RAIZ / "src" / "data" / "organograma.js"
    texto = caminho.read_text(encoding="utf-8")
    bloco = re.search(r"const ARVORE\s*=\s*\{(.*?)\n\};", texto, re.S)
    if not bloco:
        raise SystemExit("Nao achei a ARVORE em organograma.js -- o formato mudou?")

    arvore = {}
    for pai, filhos in re.findall(r"'([^']+)'\s*:\s*\[(.*?)\]", bloco.group(1), re.S):
        arvore[pai] = re.findall(r"'([^']+)'", filhos)
    if len(arvore) < 5:
        raise SystemExit(f"ARVORE com so {len(arvore)} nos -- parse provavelmente quebrou.")

    pai_de_filho = {}
    for pai, filhos in arvore.items():
        for filho in filhos:
            pai_de_filho[filho] = pai
    return arvore, pai_de_filho


def coordenadas_das_omes():
    """Reaproveita as regras ja fechadas em etl/sgp/casar_coordenadas_ome.py
    em vez de duplica-las aqui -- elas foram revisadas uma a uma com o
    usuario e nao devem ter duas versoes."""
    caminho = RAIZ / "etl" / "sgp" / "casar_coordenadas_ome.py"
    spec = importlib.util.spec_from_file_location("casar_coord", caminho)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)

    origem = modulo.carregar_origem()
    por_sigla, por_nome = {}, {}
    for reg in origem.values():
        por_sigla.setdefault(reg["chave_sigla"], []).append(reg)
        por_nome.setdefault(reg["chave_nome"], []).append(reg)

    coords = {}
    for linha in modulo.carregar_destino():
        coord, _categoria, _explicacao = modulo.resolver(linha, origem, por_sigla, por_nome)
        if coord:
            coords[int(linha[0])] = coord
    return coords


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
    coords = coordenadas_das_omes()

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
    _arvore, pai_organograma = arvore_do_organograma()
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
        # Data vem como texto da planilha e pode vir mal preenchida. O cast
        # so acontece quando o formato bate, senao a celula vira NULL -- uma
        # celula errada nao pode derrubar a carga inteira.
        alvo = col[posicao]
        return (
            "CASE WHEN \"{0}\" ~ '^[0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}}' "
            "THEN left(trim(\"{0}\"), 10)::date END".format(alvo)
        )

    cur.execute(f"""
        CREATE OR REPLACE VIEW stg.peculio AS
        SELECT
            linha                                  AS ordem,
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
            {data(27)}                             AS data_nascimento,
            {data(15)}                             AS data_praca
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
        INSERT INTO core.dim_militar
            (sk_militar, matricula, matricula_exibida, nome, nome_guerra, sexo,
             data_nascimento, data_ingresso, raca_cor, sk_posto_grad, ativo, origem)
        SELECT row_number() OVER (ORDER BY p.matricula), p.matricula,
               p.matricula_exibida, p.nome, p.nome_guerra, p.sexo,
               p.data_nascimento, p.data_praca, p.raca_cor,
               pg.sk_posto_grad, true, 'peculio'
        FROM stg.peculio p
        LEFT JOIN core.dim_posto_grad pg ON pg.sigla = p.posto_grad
    """)

    for tabela in ("dim_posto_grad", "dim_orgao_externo", "dim_militar"):
        cur.execute(f"SELECT count(*) FROM core.{tabela}")
        print(f"  {tabela:<28} {cur.fetchone()[0]:>8}")


# ---------------------------------------------------------------------------
# dim_viatura
# ---------------------------------------------------------------------------
def carregar_dim_viatura(cur):
    cur.execute("DELETE FROM core.fato_lancamento_viatura")
    cur.execute("DELETE FROM stg.de_para_viatura")
    cur.execute("DELETE FROM core.fato_frota_diaria")
    cur.execute("DELETE FROM core.dim_viatura")

    # Fonte: a Frota como ela e, nao o Neon "Viatura" (que e cache de
    # aplicacao, com TRUNCATE a cada rodada e recorte de colunas).
    # OME e situacao nao sao colunas de vehicles: sao derivadas do registro
    # mais recente em transfers e vehicle_statuses -- mesma logica que o
    # proprio sistema de frotas usa.
    cur.execute("""
        WITH ultima_transferencia AS (
            SELECT DISTINCT ON (t.vehicle_id) t.vehicle_id, o.acronym
            FROM raw_frota.transfers t
            JOIN raw_frota.omes o ON o.id = t.ome_id
            ORDER BY t.vehicle_id, t.transfer_date DESC NULLS LAST, t.created_at DESC
        ),
        ultimo_status AS (
            SELECT DISTINCT ON (vs.vehicle_id) vs.vehicle_id, vst.name
            FROM raw_frota.vehicle_statuses vs
            JOIN raw_frota.vehicle_status_types vst ON vst.id = vs.status_type_id
            ORDER BY vs.vehicle_id, vs.reference_date DESC NULLS LAST, vs.created_at DESC
        )
        SELECT v.id, trim(v.license_plate), v.chassis, v.renavam, v.patrimony,
               vt.name, vt.acronym, v.order_number, v.brand, v.model,
               nullif(v.year, 0)::int,
               posse.name, destino.name, combustivel.name, categoria.code,
               v.is_tracked, v.is_characterized, ut.acronym, us.name
        FROM raw_frota.vehicles v
        LEFT JOIN raw_frota.vehicle_types vt ON vt.id = v.type_id
        LEFT JOIN raw_frota.vehicle_ownership_types posse ON posse.id = v.vehicle_ownership_type_id
        LEFT JOIN raw_frota.vehicle_destination_types destino ON destino.id = v.vehicle_destination_type_id
        LEFT JOIN raw_frota.vehicle_fuel_types combustivel ON combustivel.id = v.vehicle_fuel_type_id
        LEFT JOIN raw_frota.license_categories categoria ON categoria.id = v.license_category_id
        LEFT JOIN ultima_transferencia ut ON ut.vehicle_id = v.id
        LEFT JOIN ultimo_status us ON us.vehicle_id = v.id
        WHERE nullif(trim(v.license_plate), '') IS NOT NULL
    """)
    fonte = cur.fetchall()

    cur.execute("SELECT sk_ome, sigla FROM core.dim_ome")
    ome_por_sigla = {normalizar(sigla): sk for sk, sigla in cur.fetchall()}

    linhas, sem_ome = [], set()
    vistos = set()
    for i, r in enumerate(fonte, start=1):
        placa = r[1].strip()
        if placa in vistos:
            continue
        vistos.add(placa)
        sigla_ome = (r[17] or "").strip()
        sk_ome = ome_por_sigla.get(normalizar(PECULIO_PARA_SGP.get(sigla_ome, sigla_ome)))
        if sigla_ome and sk_ome is None:
            sem_ome.add(sigla_ome)
        linhas.append((
            i, placa, r[0], r[2], r[3], r[4], r[5], r[6], r[7],
            normalizar_numero(r[7]), r[8], r[9], r[10], r[11], r[12], r[13],
            r[14], r[15], r[16], sk_ome, r[18], "frotas_production",
        ))

    execute_values(cur, """
        INSERT INTO core.dim_viatura
            (sk_viatura, placa, id_frota, chassi, renavam, patrimonio, tipo,
             tipo_acronym, numero_ordem, numero_ordem_norm, marca, modelo, ano,
             posse, destinacao, combustivel, categoria_habilitacao, rastreado,
             caracterizado, sk_ome, situacao, origem)
        VALUES %s
    """, linhas)

    print(f"  dim_viatura                  {len(linhas):>8}")
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

    # Peculio (Neon): as chaves do mapeamento ja usado pelo app.
    mapeamento = json.loads(MAPEAMENTO_PECULIO.read_text(encoding="utf-8"))
    nao_casados = []
    for sigla_peculio in mapeamento:
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
    cur.execute("""
        INSERT INTO stg.de_para_viatura
            (acronimo_origem, numero_origem, numero_norm, sk_viatura, situacao,
             candidatos, acronimo_diverge)
        WITH pares AS (
            SELECT DISTINCT vt.acronym AS acronimo, lv.order_number AS numero
            FROM raw_mapa_forca.launch_vehicles lv
            JOIN raw_mapa_forca.vehicle_types vt ON vt.id = lv.vehicle_type_id
            WHERE lv.discarded_at IS NULL
              AND lv.order_number IS NOT NULL AND trim(lv.order_number) <> ''
        ),
        normalizado AS (
            SELECT acronimo, numero,
                   coalesce(nullif(ltrim(regexp_replace(upper(trim(numero)), 'L$', ''), '0'), ''),
                            upper(trim(numero))) AS numero_norm
            FROM pares
        ),
        casado AS (
            SELECT n.acronimo, n.numero, n.numero_norm,
                   count(v.sk_viatura) AS candidatos,
                   min(v.sk_viatura)   AS sk_unico,
                   bool_or(upper(v.tipo_acronym) = upper(n.acronimo)) AS acronimo_bate
            FROM normalizado n
            LEFT JOIN core.dim_viatura v ON v.numero_ordem_norm = n.numero_norm
            GROUP BY 1, 2, 3
        )
        SELECT acronimo, numero, numero_norm,
               CASE WHEN candidatos = 1 THEN sk_unico END,
               CASE WHEN candidatos = 0 THEN 'sem_casar'
                    WHEN candidatos = 1 THEN 'resolvido'
                    ELSE 'ambiguo' END,
               candidatos,
               CASE WHEN candidatos > 0 THEN NOT acronimo_bate END
        FROM casado
    """)
    cur.execute("""
        SELECT situacao, count(*) FROM stg.de_para_viatura GROUP BY 1 ORDER BY 1
    """)
    resumo = ", ".join(f"{s}={n}" for s, n in cur.fetchall())
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
             adido, afastado, le, ltip, readaptado, pcd)
        SELECT (to_char(current_date, 'YYYYMMDD'))::int,
               dm.sk_militar,
               dp.sk_ome,
               dm.sk_posto_grad,
               oe.sk_orgao_externo,
               m.ome = 'ADIDO',
               m.afastamento IS NOT NULL,
               m.le, m.ltip, m.readaptado, m.pcd
        FROM stg.peculio m
        JOIN core.dim_militar dm ON dm.matricula = m.matricula
        JOIN stg.de_para_ome dp ON dp.sistema = 'peculio' AND dp.valor_origem = m.ome
        LEFT JOIN core.dim_orgao_externo oe
               ON m.ome = 'ADIDO' AND oe.nome = m.orgao
        ON CONFLICT (sk_tempo, sk_militar) DO NOTHING
    """)
    cur.execute("SELECT count(*) FROM core.fato_efetivo_diario")
    print(f"  fato_efetivo_diario          {cur.fetchone()[0]:>8}")


def carregar_fato_frota_diaria(cur):
    cur.execute("""
        INSERT INTO core.fato_frota_diaria (sk_tempo, sk_viatura, sk_ome, situacao, odometro)
        SELECT (to_char(current_date, 'YYYYMMDD'))::int, v.sk_viatura, v.sk_ome,
               v.situacao, ab.mileage
        FROM core.dim_viatura v
        LEFT JOIN LATERAL (
            SELECT mileage FROM raw_frota.fuel_transactions ft
            WHERE ft.vehicle_id = v.id_frota ORDER BY ft.time DESC NULLS LAST LIMIT 1
        ) ab ON true
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

    juncoes = """
        JOIN raw_mapa_forca.launches l ON l.id = f.launch_id
        -- launches.ome_id ja e o id_ome do SGP (nao o id da tabela omes local):
        -- verificado com ome_id 44 = CAT/RMR e 51 = GBAPH na tb_ome.
        LEFT JOIN core.dim_ome dome ON dome.sk_ome = l.ome_id
        LEFT JOIN core.dim_posto_servico dps ON dps.id_posto = l.service_station_id
        LEFT JOIN core.dim_turno dtu ON dtu.id_turno = l.service_shift_id
        LEFT JOIN core.dim_tipo_servico dts ON dts.id_tipo_servico = l.service_type_id
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
    """)

    cur.execute(f"""
        INSERT INTO core.fato_lancamento_viatura
            (sk_lancamento_viatura, id_lancamento, sk_tempo, sk_viatura,
             acronimo_origem, numero_origem, sk_ome, sk_posto_servico, sk_turno,
             sk_tipo_servico, status)
        SELECT f.id, l.id, (to_char(l.date, 'YYYYMMDD'))::int,
               dpv.sk_viatura, vt.acronym, f.order_number,
               dome.sk_ome, dps.sk_posto_servico, dtu.sk_turno, dts.sk_tipo_servico,
               f.status
        FROM raw_mapa_forca.launch_vehicles f
        LEFT JOIN raw_mapa_forca.vehicle_types vt ON vt.id = f.vehicle_type_id
        LEFT JOIN stg.de_para_viatura dpv
               ON dpv.acronimo_origem = vt.acronym AND dpv.numero_origem = f.order_number
        {juncoes}
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
    o dia de ontem so existe se nos guardamos. Apagar tudo aqui destruiria a
    unica serie temporal de efetivo e frota que o DW produz -- por isso eles
    perdem so o dia corrente, que sera reescrito logo abaixo.
    """
    cur.execute("""
        DELETE FROM core.fato_efetivo_diario
        WHERE sk_tempo = (to_char(current_date, 'YYYYMMDD'))::int
    """)
    cur.execute("""
        DELETE FROM core.fato_frota_diaria
        WHERE sk_tempo = (to_char(current_date, 'YYYYMMDD'))::int
    """)

    # Dias anteriores ficam, mas as dimensoes vao ser reconstruidas com novas
    # chaves substitutas -- entao qualquer snapshot antigo perderia a
    # referencia. Enquanto as sk nao forem estaveis entre cargas, o jeito
    # honesto e avisar em vez de deixar o dado apontando para o lugar errado.
    cur.execute("""
        SELECT count(DISTINCT sk_tempo) FROM core.fato_efetivo_diario
        WHERE sk_tempo <> (to_char(current_date, 'YYYYMMDD'))::int
    """)
    dias_anteriores = cur.fetchone()[0]
    if dias_anteriores:
        raise SystemExit(
            f"Ha {dias_anteriores} snapshot(s) de dias anteriores em "
            "fato_efetivo_diario. A reconstrucao total das dimensoes trocaria "
            "as chaves substitutas e quebraria a referencia deles.\n"
            "Antes de agendar a carga diaria, dim_militar/dim_viatura precisam "
            "de chave substituta estavel entre execucoes (hoje sao row_number). "
            "Ver etl/windmill/README.md."
        )

    cur.execute("""
        TRUNCATE
            core.fato_lancamento_militar, core.fato_lancamento_viatura,
            core.fato_lancamento_recurso,
            stg.de_para_ome, stg.de_para_viatura,
            core.dim_ome_ancestral, core.dim_ome, core.dim_militar,
            core.dim_posto_grad, core.dim_orgao_externo, core.dim_viatura,
            core.dim_posto_servico, core.dim_turno, core.dim_tipo_servico,
            core.dim_funcao_servico, core.dim_tipo_recurso
        CASCADE
    """)


def main():
    conn = psycopg2.connect(url_do_dw(), connect_timeout=30)
    cur = conn.cursor()

    limpar(cur)

    print("Dimensoes:")
    carregar_dim_tempo(cur)
    carregar_dim_ome(cur)
    carregar_dimensoes_escala(cur)
    carregar_dimensoes_pessoal(cur)
    carregar_dim_viatura(cur)
    conn.commit()

    print("\nDe-para:")
    carregar_de_para_ome(cur)
    carregar_de_para_viatura(cur)
    conn.commit()

    print("\nFatos:")
    carregar_fato_efetivo_diario(cur)
    carregar_fato_frota_diaria(cur)
    carregar_fatos_lancamento(cur)
    conn.commit()

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
