# requirements:
# psycopg2-binary
"""Extração pontual de Viaturas a partir do banco Neon "Viatura"
(sincronizado do sistema de frotas via Windmill), para popular
src/data/real/viaturas.json (contagem agregada por unidade) e
src/data/real/viaturas_lista.json (relação por unidade — Placa, Modelo).

Uso:
    DATABASE_URL_VIATURAS=postgresql://... python extract_viaturas.py

O viaturas.json só tem contagens agregadas (decisão de minimização, mesma
usada em extract_efetivo.py). O viaturas_lista.json é uma exceção
deliberada e confirmada com o usuário (ver DW_PLANEJAMENTO.md,
2026-08-07): expõe placa + modelo + situação por unidade, para a tabela
de viaturas na página de Indicador — nunca chassi.

**Atualização de 2026-08-17**: usuário pediu também NOME, PATRIMÔNIO e
ANO. NOME = "tipo" (nome do tipo de viatura, ex. "Auto Bomba Tanque") —
já vinha sendo sincronizado pro Neon, só não estava exposto aqui; agora
sai como campo "nome" em cada item. PATRIMÔNIO e ANO existem na fonte
(vehicles.patrimony, vehicles.year) mas ainda não estão na tabela
"Viatura" do Neon — dependem da extensão do script Windmill de sync
(ver DW_PLANEJAMENTO.md) antes de aparecerem aqui.

**Atualização de 2026-08-18**: usuário rodou o Windmill estendido —
`ano` e `patrimonio` já existem e estão populados na tabela "Viatura" do
Neon (confirmado via `information_schema.columns` + amostra de dados).
Passam a sair como campos "ano"/"patrimonio" em cada item.

**Resolvido em 2026-08-18 (3)**: usuário rodou a extensão de
`windmill-viaturas.py` que traz `tipoAcronym`/`numeroOrdem` — NOME passa
a ser `tipoAcronym + "-" + numeroOrdem` (ex. "AP-32"), com fallback pro
`tipo` por extenso só se essas colunas não existirem no Neon (mesmo
mecanismo de "checa antes de selecionar" já usado pra
`viaturas_detalhe.json`, pra este script nunca quebrar dependendo do que
já foi sincronizado).

**Atualização de 2026-08-18 (2)**: gera também
`src/data/real/viaturas_detalhe.json` (um registro por placa, com todos
os campos da "ficha" da viatura — Renavam, Chassis, Posse, Destinação,
Combustível, Categoria de Habilitação, Rastreado?, Caracterizado?,
Odômetro, Último Abastecimento, Condutores) para a página
`ViaturaFicha.jsx` (rota `/viatura/:placa`). Como essas colunas ainda não
existem no Neon (dependem da extensão de `windmill-viaturas.py` que
prepara mas não roda), a consulta correspondente **só executa se todas
as colunas existirem** (checado via `information_schema.columns` antes)
— senão o script só avisa e segue gerando os outros dois arquivos
normalmente, sem quebrar. Assim que o usuário rodar o Windmill
estendido, rodar este script de novo já basta, sem precisar de outra
edição de código.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MAPEAMENTO_PATH = Path(__file__).resolve().parent / "mapeamento_unidades.json"
OUTPUT_PATH = ROOT / "src" / "data" / "real" / "viaturas.json"
OUTPUT_LISTA_PATH = ROOT / "src" / "data" / "real" / "viaturas_lista.json"
OUTPUT_DETALHE_PATH = ROOT / "src" / "data" / "real" / "viaturas_detalhe.json"

# Colunas que só existem no Neon depois que o usuário rodar a extensão de
# etl/viaturas/windmill-viaturas.py preparada em 2026-08-18 (ver
# DW_PLANEJAMENTO.md) — checadas antes de tentar selecioná-las, pra este
# script não quebrar enquanto a sincronização ainda não rodou.
COLUNAS_FICHA = [
    "tipoAcronym", "numeroOrdem", "renavam", "chassis", "rastreado",
    "caracterizado", "posse", "destinacao", "combustivel",
    "categoriaHabilitacao", "odometro", "ultimoAbastecimentoValor",
    "ultimoAbastecimentoData", "condutores",
]


def main():
    database_url = os.environ["DATABASE_URL_VIATURAS"]
    mapeamento_bruto = json.loads(MAPEAMENTO_PATH.read_text(encoding="utf-8"))
    mapeamento = {k: v for k, v in mapeamento_bruto.items() if not k.startswith("_")}

    conn = psycopg2.connect(database_url, client_encoding="UTF8")
    cur = conn.cursor()

    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'Viatura';")
    colunas_existentes = {row[0] for row in cur.fetchall()}
    ficha_disponivel = all(c in colunas_existentes for c in COLUNAS_FICHA)
    nome_via_acronym = "tipoAcronym" in colunas_existentes and "numeroOrdem" in colunas_existentes

    cur.execute("""
        SELECT "omeId", COUNT(*)
        FROM "Viatura"
        GROUP BY "omeId";
    """)
    contagem_por_ome_id = dict(cur.fetchall())

    campo_nome_sql = '"tipoAcronym", "numeroOrdem"' if nome_via_acronym else "tipo, NULL"
    cur.execute(f"""
        SELECT "omeId", placa, marca, modelo, {campo_nome_sql}, status, ano, patrimonio
        FROM "Viatura"
        ORDER BY placa ASC NULLS LAST;
    """)
    viaturas_detalhe = cur.fetchall()

    fichas = []
    if ficha_disponivel:
        cur.execute("""
            SELECT
                placa, "tipoAcronym", "numeroOrdem", "omeAcronym", marca, modelo, ano,
                patrimonio, renavam, chassis, rastreado, caracterizado, posse, destinacao,
                combustivel, "categoriaHabilitacao", status, odometro,
                "ultimoAbastecimentoValor", "ultimoAbastecimentoData", condutores
            FROM "Viatura"
            WHERE placa IS NOT NULL;
        """)
        fichas = cur.fetchall()

    cur.close()
    conn.close()

    ids_desconhecidos = [
        ome_id for ome_id in contagem_por_ome_id
        if ome_id is not None and str(ome_id) not in mapeamento
    ]
    if ids_desconhecidos:
        raise SystemExit(
            "omeId sem mapeamento em mapeamento_unidades.json: "
            f"{ids_desconhecidos}. Atualize o mapeamento antes de gerar o JSON."
        )

    por_unidade = {}
    desconsiderados = {}
    sem_transferencia = 0

    for ome_id, contagem in contagem_por_ome_id.items():
        if ome_id is None:
            sem_transferencia += contagem
            continue

        sigla = mapeamento[str(ome_id)]
        if sigla is None:
            desconsiderados[f"omeId {ome_id}"] = contagem
        else:
            por_unidade[sigla] = por_unidade.get(sigla, 0) + contagem

    total_frota = sum(por_unidade.values()) + sem_transferencia

    saida = {
        "fonte": "Neon (tabela Viatura, sincronizada do sistema de frotas via Windmill)",
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "total_frota": total_frota,
        "por_unidade": por_unidade,
        "sem_transferencia": sem_transferencia,
        "desconsiderados": desconsiderados,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"Viaturas real gravado em {OUTPUT_PATH} — total: {total_frota}")
    if sem_transferencia:
        print(f"Sem transferência registrada (nenhuma OME conhecida): {sem_transferencia}")
    if desconsiderados:
        print(f"Desconsiderados (fora do organograma, confirmado com o usuário): {desconsiderados}")

    # -------------------------
    # Relação de placa/modelo por unidade (só campos confirmados com o
    # usuário — ver docstring do módulo)
    # -------------------------
    lista_por_unidade = {}
    for ome_id, placa, marca, modelo, nome_a, nome_b, status, ano, patrimonio in viaturas_detalhe:
        if ome_id is None:
            continue
        sigla = mapeamento.get(str(ome_id))
        if not sigla:
            continue
        # Com tipoAcronym/numeroOrdem sincronizados, nome vira "AP-32"
        # (mesmo identificador do sistema de frotas); sem eles, cai pro
        # nome do tipo por extenso ("Auto Plataforma").
        nome = f"{nome_a}-{nome_b}" if (nome_via_acronym and nome_a and nome_b) else nome_a
        lista_por_unidade.setdefault(sigla, []).append({
            "placa": placa,
            "modelo": " ".join(p for p in [marca, modelo] if p) or None,
            "situacao": status,
            "nome": nome,
            "ano": ano,
            "patrimonio": patrimonio,
        })

    OUTPUT_LISTA_PATH.write_text(
        json.dumps(
            {
                "fonte": "Neon (tabela Viatura)",
                "gerado_em": datetime.now(timezone.utc).isoformat(),
                "por_unidade": lista_por_unidade,
            },
            ensure_ascii=False, indent=2, sort_keys=True,
        ),
        encoding="utf-8",
    )
    print(f"Relação de Viaturas gravada em {OUTPUT_LISTA_PATH}")

    # -------------------------
    # Ficha por viatura (página /viatura/:placa) — só gera se as colunas
    # novas já existirem no Neon (ver COLUNAS_FICHA acima).
    # -------------------------
    if not ficha_disponivel:
        faltando = [c for c in COLUNAS_FICHA if c not in colunas_existentes]
        print(
            "viaturas_detalhe.json NÃO gerado — colunas ainda pendentes no Neon "
            f"(rode a extensão de windmill-viaturas.py primeiro): {faltando}"
        )
        return

    por_placa = {}
    for (
        placa, tipo_acronym, numero_ordem, ome_acronym, marca, modelo, ano, patrimonio,
        renavam, chassis, rastreado, caracterizado, posse, destinacao, combustivel,
        categoria_habilitacao, status, odometro, ultimo_valor, ultima_data, condutores
    ) in fichas:
        # Algumas placas na fonte vêm com espaço em branco à volta, ou
        # vazias (viatura sem placa cadastrada, ex. embarcação/reboque) —
        # normaliza pra bater com o mesmo valor bruto usado como chave da
        # navegação (registro.placa em ViaturaDetalhe.jsx).
        placa = (placa or "").strip()
        if not placa:
            continue
        por_placa[placa] = {
            "nome": f"{tipo_acronym}-{numero_ordem}" if tipo_acronym and numero_ordem else None,
            "tipoAcronym": tipo_acronym,
            "numeroOrdem": numero_ordem,
            "ome": ome_acronym,
            "marca": marca,
            "modelo": modelo,
            "ano": ano,
            "patrimonio": patrimonio,
            "renavam": renavam,
            "chassis": chassis,
            "rastreado": rastreado,
            "caracterizado": caracterizado,
            "posse": posse,
            "destinacao": destinacao,
            "combustivel": combustivel,
            "categoriaHabilitacao": categoria_habilitacao,
            "situacao": status,
            "odometro": odometro,
            "ultimoAbastecimentoValor": ultimo_valor,
            "ultimoAbastecimentoData": ultima_data.isoformat() if ultima_data else None,
            # Ressalva (ver DW_PLANEJAMENTO.md): contagem de condutores
            # distintos no raw_data de fuel_transactions — hipótese ainda
            # não formalmente confirmada com o usuário.
            "condutores": condutores,
        }

    OUTPUT_DETALHE_PATH.write_text(
        json.dumps(
            {
                "fonte": "Neon (tabela Viatura)",
                "gerado_em": datetime.now(timezone.utc).isoformat(),
                "por_placa": por_placa,
            },
            ensure_ascii=False, indent=2, sort_keys=True,
        ),
        encoding="utf-8",
    )
    print(f"Ficha de Viaturas gravada em {OUTPUT_DETALHE_PATH} — {len(por_placa)} viaturas")


if __name__ == "__main__":
    main()
