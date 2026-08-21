# requirements:
# psycopg2-binary
"""Casa as coordenadas de dw_dim.efetivo.ome com ovrsgp.tb_ome e gera o
relatorio de divergencias + o SQL de UPDATE de nr_latd/nr_long.

Contexto (ver DW_PLANEJAMENTO.md): a tb_ome do SGP tem 82 linhas e nenhuma
coordenada real -- as 75 que nao sao NULL estao gravadas como 0,0. O banco
dw_dim (tentativa antiga de DW, hoje em desuso) tem 48 OMEs com latitude e
longitude preenchidas. Este script transporta aquelas coordenadas para o
SGP, que passa a ser a autoridade sobre a estrutura organizacional.

Por padrao SO GERA RELATORIO. A gravacao exige --aplicar, deliberadamente:
a tb_ome e producao do sistema de pessoal, e boa parte do casamento depende
de revisao humana.

Uso:
    DATABASE_URL_SGP=... DATABASE_URL_DW=... python casar_coordenadas_ome.py
    ... --aplicar     # executa os UPDATEs (revisar o relatorio antes!)
"""
import os
import sys
import unicodedata
from pathlib import Path

import psycopg2

SAIDA_SQL = Path(__file__).resolve().parent / "update_coordenadas_ome.sql"

# Quartel do Comando Geral. Regra do usuario (2026-08-21): toda diretoria/
# unidade administrativa sem sede propria conhecida fica neste ponto.
QCG = (-8.051522, -34.890144)

# De-para manual sigla_sgp -> sigla_dw_dim, para os casos em que a
# normalizacao automatica nao casa. Cada linha aqui e uma decisao humana.
DE_PARA_SIGLA = {
    "SCG": "SG",            # Subcomando Geral
    "CAT / ZM": "CAT Zona da Mata",
}

# Override explicito de coordenada -- pedido do usuario (2026-08-21): as duas
# Diretorias Integradas do Interior nao ficam no QCG, e sim junto do
# grupamento de referencia de cada uma.
OVERRIDE_POR_SIGLA = {
    "DINTER/1": "2ºGB",
    "DINTER/2": "4ºGB",
}

# Linhas da tb_ome que nao sao OME de verdade: sao situacoes funcionais
# modeladas como unidade. Nunca recebem coordenada.
NAO_E_OME = {"INATIVOS", "ADIDO", "OUT SIT / DGP", "LIC / DGP", "CFHP 2017"}


def normalizar(texto):
    """Remove acento, pontuacao e caixa -- '1oGB' e '1o GB' viram '1GB'."""
    if not texto:
        return ""
    base = unicodedata.normalize("NFKD", str(texto))
    base = "".join(c for c in base if not unicodedata.combining(c))
    return "".join(c for c in base.upper() if c.isalnum())


def carregar_origem():
    """dw_dim.efetivo.ome -- a fonte das coordenadas."""
    url = os.environ["DATABASE_URL_DW"].replace("/postgres", "/dw_dim")
    conn = psycopg2.connect(url, connect_timeout=15)
    cur = conn.cursor()
    cur.execute(
        'SELECT "acrônimo", nome, latitude, longitude FROM efetivo.ome '
        "WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
    )
    origem = {}
    for sigla, nome, lat, lon in cur.fetchall():
        origem[sigla] = {
            "sigla": sigla,
            "nome": nome,
            "coord": (float(lat), float(lon)),
            "chave_sigla": normalizar(sigla),
            "chave_nome": normalizar(nome),
        }
    conn.close()
    return origem


def carregar_destino():
    """ovrsgp.tb_ome -- quem vai receber as coordenadas."""
    conn = psycopg2.connect(os.environ["DATABASE_URL_SGP"], connect_timeout=15)
    cur = conn.cursor()
    cur.execute(
        "SELECT id_ome, nm_ome, sg_ome, ic_tipo, ic_stat, nr_latd, nr_long "
        "FROM ovrsgp.tb_ome ORDER BY id_ome"
    )
    linhas = cur.fetchall()
    conn.close()
    return linhas


def resolver(linha, origem, por_sigla, por_nome):
    """Decide a coordenada de uma linha da tb_ome.

    Devolve (coord_ou_None, categoria, explicacao). As categorias sao o eixo
    do relatorio: 'ignorar' nao recebe nada, 'casado'/'override'/'padrao_qcg'
    recebem, e 'divergencia' fica para decisao humana.
    """
    _id, nome, sigla, tipo, stat, _lat, _lon = linha
    sigla = (sigla or "").strip()

    if sigla in NAO_E_OME:
        return None, "ignorar", "situacao funcional, nao e OME"

    if stat == "I":
        return None, "ignorar", "OME inativa no SGP (ic_stat = I)"

    if sigla in OVERRIDE_POR_SIGLA:
        alvo = OVERRIDE_POR_SIGLA[sigla]
        if alvo not in origem:
            return None, "divergencia", "override aponta para %s, ausente na origem" % alvo
        return origem[alvo]["coord"], "override", "regra explicita: coordenada de %s" % alvo

    chave = normalizar(DE_PARA_SIGLA.get(sigla, sigla))
    candidatos = por_sigla.get(chave, [])
    if len(candidatos) == 1:
        return candidatos[0]["coord"], "casado", "sigla casa com %s" % candidatos[0]["sigla"]
    if len(candidatos) > 1:
        nomes = ", ".join(c["sigla"] for c in candidatos)
        return None, "divergencia", "sigla ambigua na origem: %s" % nomes

    candidatos = por_nome.get(normalizar(nome), [])
    if len(candidatos) == 1:
        return candidatos[0]["coord"], "casado", "nome casa com %s" % candidatos[0]["sigla"]
    if len(candidatos) > 1:
        nomes = ", ".join(c["sigla"] for c in candidatos)
        return None, "divergencia", "nome ambiguo na origem: %s" % nomes

    if tipo == "AD":
        return QCG, "padrao_qcg", "administrativa sem correspondencia: assume o QCG"

    return None, "divergencia", "operacional sem correspondencia na origem"


def main():
    aplicar = "--aplicar" in sys.argv
    origem = carregar_origem()

    por_sigla, por_nome = {}, {}
    for reg in origem.values():
        por_sigla.setdefault(reg["chave_sigla"], []).append(reg)
        por_nome.setdefault(reg["chave_nome"], []).append(reg)

    linhas = carregar_destino()
    resultados = []
    for linha in linhas:
        coord, categoria, explicacao = resolver(linha, origem, por_sigla, por_nome)
        resultados.append((linha, coord, categoria, explicacao))

    ordem = ["casado", "override", "padrao_qcg", "divergencia", "ignorar"]
    titulos = {
        "casado": "CASADOS AUTOMATICAMENTE",
        "override": "OVERRIDE EXPLICITO (regra do usuario)",
        "padrao_qcg": "PADRAO QCG (administrativa sem sede propria conhecida)",
        "divergencia": "DIVERGENCIAS -- PRECISAM DE DECISAO HUMANA",
        "ignorar": "IGNORADAS (nao recebem coordenada)",
    }
    for categoria in ordem:
        grupo = [r for r in resultados if r[2] == categoria]
        print("\n" + "=" * 78)
        print("%s  (%d)" % (titulos[categoria], len(grupo)))
        print("=" * 78)
        for (id_ome, nome, sigla, _t, _s, _la, _lo), coord, _c, explicacao in grupo:
            ponto = "%.6f, %.6f" % coord if coord else "-- sem coordenada --"
            print("  [%3s] %-16s %-26s %s" % (id_ome, sigla or "", ponto, nome.strip()))
            print("        %s" % explicacao)

    aplicaveis = [r for r in resultados if r[1] is not None]
    divergentes = [r for r in resultados if r[2] == "divergencia"]
    print("\n" + "=" * 78)
    print("RESUMO: %d linhas na tb_ome | %d receberiam coordenada | %d divergencias"
          % (len(linhas), len(aplicaveis), len(divergentes)))

    with SAIDA_SQL.open("w", encoding="utf-8") as fh:
        fh.write("-- Gerado por etl/sgp/casar_coordenadas_ome.py -- REVISAR ANTES DE EXECUTAR.\n")
        fh.write("-- Preenche nr_latd/nr_long em ovrsgp.tb_ome (hoje 0,0 ou NULL em todas).\n")
        fh.write("BEGIN;\n")
        for (id_ome, _n, sigla, _t, _s, _la, _lo), coord, categoria, _e in resultados:
            if coord is None:
                continue
            fh.write(
                "UPDATE ovrsgp.tb_ome SET nr_latd = %.10f, nr_long = %.10f, dt_atlz = now() "
                "WHERE id_ome = %s;  -- %s (%s)\n"
                % (coord[0], coord[1], id_ome, sigla, categoria)
            )
        fh.write("COMMIT;\n")
    print("SQL gravado em %s" % SAIDA_SQL)

    if not aplicar:
        print("\nNada foi gravado no SGP. Rode com --aplicar depois de revisar o relatorio.")
        return

    conn = psycopg2.connect(os.environ["DATABASE_URL_SGP"], connect_timeout=15)
    cur = conn.cursor()
    for (id_ome, _n, _sg, _t, _s, _la, _lo), coord, _c, _e in resultados:
        if coord is None:
            continue
        cur.execute(
            "UPDATE ovrsgp.tb_ome SET nr_latd = %s, nr_long = %s, dt_atlz = now() "
            "WHERE id_ome = %s",
            (coord[0], coord[1], id_ome),
        )
    conn.commit()
    conn.close()
    print("%d linhas atualizadas em ovrsgp.tb_ome." % len(aplicaveis))


if __name__ == "__main__":
    main()
