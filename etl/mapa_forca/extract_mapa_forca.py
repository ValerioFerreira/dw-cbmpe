# requirements:
# psycopg2-binary
"""Gera os arquivos do painel de Mapa de Forca, a partir do DW.

MECANISMO DIFERENTE DOS OUTROS EXTRATORES, de proposito. Os demais gravam em
src/data/real/ e sao IMPORTADOS pelo app -- o Vite embute o conteudo no
bundle, que o navegador baixa inteiro antes do login. O mapa de forca nao
cabe nesse modelo: sao ~170 lancamentos de viatura e ~830 de militar POR DIA,
e o painel precisa de qualquer data.

Entao aqui a saida vai para public/dados/mapa-forca/, um arquivo por dia, e o
app BUSCA o dia pedido em tempo de execucao. Consequencias:

- o bundle nao cresce (continua sem o mapa de forca dentro);
- a janela e configuravel sem tocar em codigo;
- quando existir servidor, troca-se a URL do fetch por uma chamada de API e o
  painel nao muda -- e o mesmo seam que src/data/organograma.js ja usa.

O que este arquivo NAO resolve: o dado continua publico enquanto o app estiver
na Vercel, porque public/ e servido sem autenticacao. A guarnicao e nominal.
Por isso o recorte abaixo e o minimo que o painel precisa -- matricula, posto,
nome de guerra e funcao. Nome completo nao entra (o app ja o tem em
efetivo_lista.json, mas nao ha motivo de repetir), e CPF nunca entrou no DW
(ver carga_raw.py).

Uso:
    DATABASE_URL_DW=postgresql://... python extract_mapa_forca.py
    ... --dias 180        # janela (padrao: 90)
    ... --desde 2026-01-01 --ate 2026-03-31
"""
import argparse
import json
import os
import re
import unicodedata
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import psycopg2

RAIZ = Path(__file__).resolve().parents[2]
MAPEAMENTO = Path(__file__).resolve().parent / "mapeamento_unidades.json"
SAIDA = RAIZ / "public" / "dados" / "mapa-forca"

# Siglas do organograma (src/data/organograma.js). Duplicadas aqui de
# proposito: este script roda em Python, offline, e nao vai parsear um modulo
# JS. Se o organograma ganhar unidade nova, o casamento automatico resolve
# sozinho -- so entra no mapeamento_unidades.json o que nao casar.
SIGLAS_ORGANOGRAMA = [
    "COMANDO GERAL", "SUBCOMANDO GERAL", "GCG", "CI", "CPO", "AECI", "CCS",
    "DGO", "DGA", "GSG", "AJG", "CPP", "DIM", "DINTER I", "DINTER II", "DIESP",
    "GBI", "GBAPH", "GBS", "GBMar", "CAT/RMR", "1º GB", "2º GB", "6º GB",
    "7º GB", "CAT/ZM", "CAT/AG", "3º GB", "4º GB", "5º GB", "9º GB", "CAT/SE",
    "DGP", "DVP", "DJD", "DF", "DAS", "DTIC", "DLOG", "DEIP", "DPLAG",
    "CMAN", "CINT", "CEAO", "ABMG", "CEFD",
]


def url_do_dw():
    base, _, _ = os.environ["DATABASE_URL_DW"].rpartition("/")
    return f"{base}/dw"


def normalizar(texto):
    """Sigla comparavel entre o DW e o organograma: sem acento, sem espaco,
    sem barra. 'CAT / RMR' e 'CAT/RMR' viram a mesma coisa."""
    sem_acento = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Z0-9]", "", sem_acento.upper())


def construir_de_para(siglas_do_dw):
    """OME do DW -> sigla do organograma. Casamento automatico primeiro; o
    mapeamento_unidades.json cobre o que sobra, e uma sigla sem resposta
    derruba a extracao em vez de virar lancamento na unidade errada."""
    manual = {k: v for k, v in json.loads(MAPEAMENTO.read_text(encoding="utf-8")).items()
              if not k.startswith("_")}
    por_norma = {normalizar(s): s for s in SIGLAS_ORGANOGRAMA}

    de_para, sem_resposta, descartadas = {}, [], []
    for sigla in siglas_do_dw:
        if sigla in manual:
            destino = manual[sigla]
            if destino is None:
                descartadas.append(sigla)
            else:
                de_para[sigla] = destino
            continue
        automatico = por_norma.get(normalizar(sigla))
        if automatico:
            de_para[sigla] = automatico
        else:
            sem_resposta.append(sigla)
    return de_para, sem_resposta, descartadas


# Fernando de Noronha e o unico municipio de Pernambuco que nao encosta no
# continente, o que torna uma coordenada continental ali PROVADAMENTE errada.
# E ha oito postos declarados no municipio: tres com a coordenada certa da
# ilha (-3,856 / -32,427, que a propria fonte carrega), quatro apontando para
# Abreu e Lima (-7,829 / -34,902) e um para Jaboatao. Nao e chute corrigir --
# e usar, nos oito, o valor que a fonte ja da em tres deles.
#
# O de-para fica por municipio, e nao por posto, para o dia em que aparecer um
# nono posto na ilha ele ja nascer certo.
COORDENADA_POR_MUNICIPIO = {
    "FERNANDO DE NORONHA": (-3.85609, -32.42678),
}


def fora_do_municipio(municipio, lat, lon):
    """True quando a coordenada nao pode pertencer ao municipio declarado."""
    esperado = COORDENADA_POR_MUNICIPIO.get((municipio or "").strip().upper())
    if not esperado or lat is None or lon is None:
        return False
    # 1 grau ~ 111 km. Meio grau de folga cobre a ilha inteira com sobra e
    # nao alcanca o continente, que esta a mais de dois graus daqui.
    return abs(float(lat) - esperado[0]) > 0.5 or abs(float(lon) - esperado[1]) > 0.5


def catalogo(cur, de_para):
    """Postos de servico e OMEs -- nome, municipio, AIS e coordenada.

    O balao do mapa fica no posto de servico, que e mais granular que a OME
    (a secao de bombeiros de onde a guarnicao sai). Metade dos postos ainda
    nao tem coordenada na origem (ovresc.tb_posto grava 0,0), entao cai para a
    coordenada da OME -- e a origem fica registrada em `origemCoord`, para o
    painel poder dizer que aquele balao e aproximado.
    """
    cur.execute("""
        SELECT p.id_posto, p.nome, o.sigla, p.municipio, p.bairro, p.ais,
               nullif(p.latitude, 0), nullif(p.longitude, 0),
               nullif(o.latitude, 0), nullif(o.longitude, 0)
        FROM core.dim_posto_servico p
        LEFT JOIN core.dim_ome o ON o.sk_ome = p.sk_ome
    """)
    postos = {}
    for (id_posto, nome, sigla, municipio, bairro, ais,
         lat, lon, lat_ome, lon_ome) in cur.fetchall():
        origem = "posto" if lat is not None else ("ome" if lat_ome is not None else None)
        efetiva_lat = lat if lat is not None else lat_ome
        efetiva_lon = lon if lon is not None else lon_ome
        if fora_do_municipio(municipio, efetiva_lat, efetiva_lon):
            efetiva_lat, efetiva_lon = COORDENADA_POR_MUNICIPIO[municipio.strip().upper()]
            origem = "municipio"
        postos[str(id_posto)] = {
            "nome": nome,
            "ome": de_para.get(sigla, sigla),
            "municipio": municipio,
            "bairro": bairro,
            "ais": ais,
            "lat": float(efetiva_lat) if efetiva_lat is not None else None,
            "lon": float(efetiva_lon) if efetiva_lon is not None else None,
            "origemCoord": origem,
        }

    cur.execute("""
        SELECT sigla, nome, municipio, nullif(latitude, 0), nullif(longitude, 0)
        FROM core.dim_ome
    """)
    omes = {}
    for sigla, nome, municipio, lat, lon in cur.fetchall():
        destino = de_para.get(sigla)
        if not destino:
            continue
        omes[destino] = {
            "nome": nome,
            "municipio": municipio,
            "lat": float(lat) if lat is not None else None,
            "lon": float(lon) if lon is not None else None,
        }
    return postos, omes


def lancamentos_do_dia(cur, dia, de_para):
    """Um dia inteiro: lancamento -> viaturas + guarnicao.

    Tres consultas em vez de um join so, porque um join de viatura com militar
    multiplicaria as linhas (uma viatura x oito militares = oito linhas) e o
    Python teria que desfazer isso depois.
    """
    cur.execute("""
        SELECT DISTINCT f.id_lancamento, o.sigla, f.sk_posto_servico,
               ts.nome, tu.nome
        FROM core.fato_lancamento_militar f
        JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
        LEFT JOIN core.dim_ome o ON o.sk_ome = f.sk_ome
        LEFT JOIN core.dim_tipo_servico ts ON ts.sk_tipo_servico = f.sk_tipo_servico
        LEFT JOIN core.dim_turno tu ON tu.sk_turno = f.sk_turno
        WHERE t.data = %s
        UNION
        SELECT DISTINCT f.id_lancamento, o.sigla, f.sk_posto_servico,
               ts.nome, tu.nome
        FROM core.fato_lancamento_viatura f
        JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
        LEFT JOIN core.dim_ome o ON o.sk_ome = f.sk_ome
        LEFT JOIN core.dim_tipo_servico ts ON ts.sk_tipo_servico = f.sk_tipo_servico
        LEFT JOIN core.dim_turno tu ON tu.sk_turno = f.sk_turno
        WHERE t.data = %s
    """, (dia, dia))
    lancamentos = {}
    omes_vistas = set()
    for id_lanc, sigla, sk_posto, tipo_servico, turno in cur.fetchall():
        omes_vistas.add(sigla)
        lancamentos[id_lanc] = {
            "id": id_lanc,
            "ome": de_para.get(sigla, sigla),
            "posto": str(sk_posto) if sk_posto else None,
            "tipoServico": tipo_servico,
            "turno": turno,
            "viaturas": [],
            "guarnicao": [],
        }

    cur.execute("""
        SELECT f.id_lancamento, v.placa, v.tipo, v.tipo_acronym, v.numero_ordem,
               f.acronimo_origem, f.numero_origem
        FROM core.fato_lancamento_viatura f
        JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
        LEFT JOIN core.dim_viatura v ON v.sk_viatura = f.sk_viatura
        WHERE t.data = %s
        ORDER BY f.sk_lancamento_viatura
    """, (dia,))
    for id_lanc, placa, tipo, acronimo, numero, acr_origem, num_origem in cur.fetchall():
        if id_lanc not in lancamentos:
            continue
        lancamentos[id_lanc]["viaturas"].append({
            # placa nula = viatura que o mapa de forca lancou e a Frota nao
            # conhece (1,0% do volume). Mostrar assim mesmo, sem link para a
            # ficha, e melhor que sumir com a viatura do mapa.
            "placa": placa,
            "tipo": tipo,
            "acronimo": acronimo or acr_origem,
            "numero": numero or num_origem,
        })

    cur.execute("""
        SELECT f.id_lancamento, f.matricula_origem, m.matricula_exibida,
               coalesce(f.posto_origem, pg.sigla), m.nome_guerra, fs.nome
        FROM core.fato_lancamento_militar f
        JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
        LEFT JOIN core.dim_militar m ON m.sk_militar = f.sk_militar
        LEFT JOIN core.dim_posto_grad pg ON pg.sk_posto_grad = m.sk_posto_grad
        LEFT JOIN core.dim_funcao_servico fs ON fs.sk_funcao_servico = f.sk_funcao_servico
        WHERE t.data = %s
        ORDER BY f.sk_lancamento_militar
    """, (dia,))
    for id_lanc, matricula, exibida, posto, nome_guerra, funcao in cur.fetchall():
        if id_lanc not in lancamentos:
            continue
        lancamentos[id_lanc]["guarnicao"].append({
            # matricula_origem vem sem hifen; matricula_exibida e a formatada
            # da dimensao. A rota /militar/:matricula usa a do efetivo_lista,
            # que e a exibida -- entao ela e a chave de link.
            "matricula": exibida or matricula,
            "postoGrad": posto,
            "nomeGuerra": nome_guerra,
            "funcao": funcao,
        })

    return list(lancamentos.values()), omes_vistas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dias", type=int, default=90)
    ap.add_argument("--desde")
    ap.add_argument("--ate")
    args = ap.parse_args()

    conn = psycopg2.connect(url_do_dw(), connect_timeout=30)
    cur = conn.cursor()

    cur.execute("SELECT max(t.data) FROM core.fato_lancamento_militar f "
                "JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo")
    ultimo = cur.fetchone()[0] or date.today()
    fim = date.fromisoformat(args.ate) if args.ate else ultimo
    inicio = date.fromisoformat(args.desde) if args.desde else fim - timedelta(days=args.dias - 1)

    cur.execute("SELECT DISTINCT sigla FROM core.dim_ome")
    de_para, sem_resposta, descartadas = construir_de_para([s for (s,) in cur.fetchall()])

    # A exigencia de mapeamento vale so para quem LANCA na janela pedida. A
    # dim_ome tem 82 linhas -- inativos, CG, comissoes, unidades extintas -- e
    # a maioria nunca apareceu num mapa de forca. Exigir de-para para todas
    # transformaria o extrator num bloqueio permanente por unidades que o
    # painel jamais vai desenhar.
    cur.execute("""
        SELECT DISTINCT o.sigla
        FROM core.fato_lancamento_militar f
        JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
        JOIN core.dim_ome o ON o.sk_ome = f.sk_ome
        WHERE t.data BETWEEN %s AND %s
        UNION
        SELECT DISTINCT o.sigla
        FROM core.fato_lancamento_viatura f
        JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
        JOIN core.dim_ome o ON o.sk_ome = f.sk_ome
        WHERE t.data BETWEEN %s AND %s
    """, (inicio, fim, inicio, fim))
    siglas_na_janela = {s for (s,) in cur.fetchall()}

    faltando = sorted(siglas_na_janela & set(sem_resposta))
    if faltando:
        raise SystemExit(
            f"OMEs que lancam na janela e nao tem correspondencia no "
            f"organograma: {faltando}. Acrescente cada uma a "
            f"{MAPEAMENTO.name} antes de gerar os arquivos (use null se a "
            "unidade nao existe mais e o destino nao foi confirmado)."
        )

    postos, omes = catalogo(cur, de_para)
    SAIDA.mkdir(parents=True, exist_ok=True)

    gerado_em = datetime.now(timezone.utc).isoformat()
    datas, total_lanc, total_vtr, total_mil = [], 0, 0, 0
    omes_descartadas_na_janela = set()

    dia = inicio
    while dia <= fim:
        lancamentos, omes_vistas = lancamentos_do_dia(cur, dia, de_para)
        omes_descartadas_na_janela |= (omes_vistas & set(descartadas))
        if lancamentos:
            (SAIDA / f"{dia.isoformat()}.json").write_text(
                # Sem "gerado_em" aqui, de proposito: o carimbo faria os 90
                # arquivos mudarem a cada rodada, e o git guardaria 12 MB de
                # delta por execucao mesmo quando nada no dado mudou. Um dia
                # ja fechado produz sempre o mesmo arquivo. O carimbo fica no
                # indice.json, que e onde a pergunta "de quando e isso?" cabe.
                json.dumps({
                    "data": dia.isoformat(),
                    "fonte": "core.fato_lancamento_* (mapa_forca_api_development, via DW)",
                    "lancamentos": lancamentos,
                }, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8")
            datas.append(dia.isoformat())
            total_lanc += len(lancamentos)
            total_vtr += sum(len(l["viaturas"]) for l in lancamentos)
            total_mil += sum(len(l["guarnicao"]) for l in lancamentos)
        dia += timedelta(days=1)

    if omes_descartadas_na_janela:
        raise SystemExit(
            f"OMEs marcadas como null no mapeamento apareceram na janela: "
            f"{sorted(omes_descartadas_na_janela)}. Confirme o destino de cada "
            "uma antes de publicar -- somar na unidade errada e pior que falhar."
        )

    (SAIDA / "indice.json").write_text(
        json.dumps({
            "gerado_em": gerado_em,
            "fonte": "core.fato_lancamento_* (mapa_forca_api_development, via DW)",
            "datas": datas,
            "postos": postos,
            "omes": omes,
        }, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8")

    tamanho = sum(f.stat().st_size for f in SAIDA.glob("*.json"))
    print(f"Mapa de Forca gravado em {SAIDA.relative_to(RAIZ)}")
    print(f"  {len(datas)} dias ({datas[0]} a {datas[-1]})" if datas else "  nenhum dia com lancamento")
    print(f"  {total_lanc} lancamentos, {total_vtr} viaturas, {total_mil} militares")
    print(f"  {tamanho / 1024 / 1024:.2f} MB no total, "
          f"{tamanho / len(datas) / 1024:.0f} KB por dia" if datas else "")
    sem_coord = sum(1 for p in postos.values() if p["origemCoord"] is None)
    aprox = sum(1 for p in postos.values() if p["origemCoord"] == "ome")
    corrigidos = sum(1 for p in postos.values() if p["origemCoord"] == "municipio")
    print(f"  postos: {len(postos)} ({aprox} na coordenada da OME, "
          f"{corrigidos} corrigidos pelo municipio, {sem_coord} sem coordenada)")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
