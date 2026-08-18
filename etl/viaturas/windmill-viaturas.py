# requirements:
# psycopg2-binary
"""Script Windmill de sincronização Frota (sistema interno) -> Neon
(tabela "Viatura"), rodado pelo usuário via Windmill (não pelo Claude
Code) — arquivo mantido aqui só como registro/versão do que está publicado
lá, para poder evoluir com o mesmo cuidado dos outros scripts do domínio.

Atualização de 2026-08-17: adiciona ANO e PATRIMÔNIO à sincronização —
usuário pediu essas colunas na tabela de Viaturas do app; inspecionei o
schema de "vehicles" na fonte (vehicles.year, vehicles.patrimony) antes
de escrever esta extensão (ver DW_PLANEJAMENTO.md). NOME (nome do tipo de
viatura, ex. "Auto Bomba Tanque") já vinha sincronizado como "tipo" —
não precisou de mudança aqui, só passou a ser exposto em
etl/viaturas/extract_viaturas.py.

**Resolvido em 2026-08-18**: usuário publicou e rodou esta versão —
ano/patrimonio já estão no Neon, populados.

Atualização de 2026-08-18: usuário pediu que a coluna "Nome" da tabela de
Viaturas do app passasse a mostrar o mesmo identificador usado no sistema
de frotas (ex. "AP-32", "AT/1-80"), não mais o nome por extenso do tipo
("Auto Plataforma"). Inspecionei o DDL da fonte antes de escrever esta
extensão: esse identificador é `vehicle_types.acronym + "-" +
vehicles.order_number` — nenhum dos dois campos estava sincronizado pro
Neon. Adiciona `tipoAcronym` (de `vehicle_types.acronym`) e
`numeroOrdem` (de `vehicles.order_number`) à tabela "Viatura".

Pendente: o usuário publica esta versão no Windmill e roda o job (mesmo
fluxo já usado pra Efetivo/windmill-neon.py) — depois, rodar de novo
etl/viaturas/extract_viaturas.py localmente pra o novo formato de nome
(acronym-numeroOrdem) aparecer em src/data/real/viaturas_lista.json —
até lá, `extract_viaturas.py` continua usando `tipo` (nome por extenso)
como "nome", de forma proposital, pra não quebrar antes da sincronização
existir.

Atualização de 2026-08-18 (2): página de detalhamento por viatura
(clique numa linha da tabela) — usuário confirmou o escopo depois de eu
levantar o DDL de frotas card a card (ver DW_PLANEJAMENTO.md):
- **Card "Resumo"/"Outros"** do print de referência: adiciona Renavam
  (`vehicles.renavam`), Chassis (`vehicles.chassis`), Posse
  (`vehicle_ownership_types.name`), Destinação
  (`vehicle_destination_types.name`), Tipo de Combustível
  (`vehicle_fuel_types.name`), Categoria de Habilitação
  (`license_categories.code`), Rastreado? (`vehicles.is_tracked`) e
  Caracterizado? (`vehicles.is_characterized`) — todos denormalizados
  como texto/booleano direto na tabela "Viatura" (decisão do usuário:
  não criar tabelas de dimensão à parte no Neon pra essas lookups
  pequenas, mesmo padrão já usado pra tipo/status).
- **Odômetro / Último Abastecimento**: derivados da transação de
  `fuel_transactions` mais recente por veículo (`mileage`, `total_value`,
  `time`) — hipótese testada e batendo com o print da AP-32 antes desta
  extensão.
- **Condutores**: contagem de valores distintos da chave `condutor`
  dentro do `raw_data` (jsonb) de `fuel_transactions` por veículo.
  **Ressalva registrada a pedido do usuário**: essa é uma hipótese ainda
  não formalmente confirmada (não bati o número calculado contra o "6"
  do print) — o usuário pediu pra seguir assim por ora, mas com nota
  explícita de que precisa ser confirmado depois. Ver aviso equivalente
  em `DW_PLANEJAMENTO.md` e no tooltip do campo na UI.
- **Saldo do Cartão**: **fora de escopo por decisão do usuário** — não
  existe na fonte de frotas; ele vai enviar depois os detalhes de uma
  API externa da operadora do cartão. Não adicionado aqui.

Credenciais via variável de ambiente (DATABASE_URL_FROTA, DATABASE_URL_VIATURAS)
— nunca hardcoded no código, mesmo padrão dos demais scripts de etl/ —
no Windmill isso é resource/variable (ver DW_ETL.md).

Uso:
    DATABASE_URL_FROTA=postgresql://... DATABASE_URL_VIATURAS=postgresql://... python windmill-viaturas.py
"""
import os
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta, timezone


def main():

    # -------------------------
    # Conectar no banco do sistema de frotas (rede interna)
    # -------------------------

    frota_conn = psycopg2.connect(os.environ["DATABASE_URL_FROTA"])

    frota_cur = frota_conn.cursor()

    # -------------------------
    # Extrair, por viatura: tipo, OME atual (última transferência),
    # status atual (última alteração de status), ano e patrimônio.
    # -------------------------
    # A tabela vehicles não tem FK direta pra OME nem pra status: ambos são
    # derivados do registro mais recente em transfers / vehicle_statuses,
    # respectivamente (mesma lógica que o próprio sistema usa no trigger
    # check_transfer_ome, que só compara contra a transferência anterior/
    # seguinte de cada viatura).

    frota_cur.execute("""
        WITH ultima_transferencia AS (
            SELECT DISTINCT ON (t.vehicle_id)
                t.vehicle_id,
                t.ome_id,
                o.acronym AS ome_acronym
            FROM transfers t
            JOIN omes o ON o.id = t.ome_id
            ORDER BY t.vehicle_id, t.transfer_date DESC NULLS LAST, t.created_at DESC
        ),
        ultimo_status AS (
            SELECT DISTINCT ON (vs.vehicle_id)
                vs.vehicle_id,
                vst.name AS status_nome,
                vst.still_usable
            FROM vehicle_statuses vs
            JOIN vehicle_status_types vst ON vst.id = vs.status_type_id
            ORDER BY vs.vehicle_id, vs.reference_date DESC NULLS LAST, vs.created_at DESC
        ),
        ultimo_abastecimento AS (
            SELECT DISTINCT ON (vehicle_id)
                vehicle_id,
                mileage AS odometro,
                total_value AS ultimo_abastecimento_valor,
                time AS ultimo_abastecimento_data
            FROM fuel_transactions
            ORDER BY vehicle_id, time DESC
        ),
        condutores_distintos AS (
            -- Hipótese ainda não formalmente confirmada (ver docstring do
            -- módulo) — condutor vem de um campo de texto livre (JSON) de
            -- uma operadora externa (Maxifrota), não de uma tabela própria.
            SELECT
                vehicle_id,
                COUNT(DISTINCT raw_data->>'condutor') AS qtd_condutores
            FROM fuel_transactions
            WHERE raw_data->>'condutor' IS NOT NULL AND raw_data->>'condutor' <> ''
            GROUP BY vehicle_id
        )
        SELECT
            v.id,
            vt.name AS tipo,
            vt.acronym AS tipo_acronym,
            v.order_number,
            v.license_plate,
            v.brand,
            v.model,
            v.year,
            v.patrimony,
            v.renavam,
            v.chassis,
            v.is_tracked,
            v.is_characterized,
            posse.name AS posse_nome,
            destino.name AS destinacao_nome,
            combustivel.name AS combustivel_nome,
            categoria.code AS categoria_habilitacao,
            ut.ome_id,
            ut.ome_acronym,
            us.status_nome,
            us.still_usable,
            ab.odometro,
            ab.ultimo_abastecimento_valor,
            ab.ultimo_abastecimento_data,
            cond.qtd_condutores
        FROM vehicles v
        LEFT JOIN vehicle_types vt ON vt.id = v.type_id
        LEFT JOIN vehicle_ownership_types posse ON posse.id = v.vehicle_ownership_type_id
        LEFT JOIN vehicle_destination_types destino ON destino.id = v.vehicle_destination_type_id
        LEFT JOIN vehicle_fuel_types combustivel ON combustivel.id = v.vehicle_fuel_type_id
        LEFT JOIN license_categories categoria ON categoria.id = v.license_category_id
        LEFT JOIN ultima_transferencia ut ON ut.vehicle_id = v.id
        LEFT JOIN ultimo_status us ON us.vehicle_id = v.id
        LEFT JOIN ultimo_abastecimento ab ON ab.vehicle_id = v.id
        LEFT JOIN condutores_distintos cond ON cond.vehicle_id = v.id
        ORDER BY v.id;
    """)

    linhas = frota_cur.fetchall()

    frota_cur.close()
    frota_conn.close()

    agora = (datetime.now(timezone.utc) - timedelta(hours=3)).replace(tzinfo=None)

    values = [
        (
            vehicle_id,
            tipo,
            tipo_acronym,
            order_number,
            license_plate,
            brand,
            model,
            year,
            patrimony,
            renavam,
            chassis,
            is_tracked,
            is_characterized,
            posse_nome,
            destinacao_nome,
            combustivel_nome,
            categoria_habilitacao,
            ome_id,
            ome_acronym,
            status_nome,
            still_usable,
            odometro,
            ultimo_abastecimento_valor,
            ultimo_abastecimento_data,
            qtd_condutores,
            agora,
        )
        for (
            vehicle_id, tipo, tipo_acronym, order_number, license_plate, brand, model, year, patrimony,
            renavam, chassis, is_tracked, is_characterized, posse_nome, destinacao_nome, combustivel_nome,
            categoria_habilitacao, ome_id, ome_acronym, status_nome, still_usable, odometro,
            ultimo_abastecimento_valor, ultimo_abastecimento_data, qtd_condutores
        ) in linhas
    ]

    # -------------------------
    # Conectar no Neon (destino, dedicado a Frota)
    # -------------------------

    neon_conn = psycopg2.connect(os.environ["DATABASE_URL_VIATURAS"], sslmode="require")

    neon_cur = neon_conn.cursor()

    neon_cur.execute("""
        CREATE TABLE IF NOT EXISTS "Viatura" (
            id integer PRIMARY KEY,
            tipo text,
            placa text,
            marca text,
            modelo text,
            "omeId" integer,
            "omeAcronym" text,
            status text,
            "stillUsable" boolean,
            "updatedAt" timestamp NOT NULL
        );
    """)
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS placa text;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS marca text;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS modelo text;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS ano integer;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS patrimonio text;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS "tipoAcronym" text;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS "numeroOrdem" text;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS renavam text;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS chassis text;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS rastreado boolean;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS caracterizado boolean;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS posse text;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS destinacao text;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS combustivel text;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS "categoriaHabilitacao" text;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS odometro double precision;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS "ultimoAbastecimentoValor" double precision;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS "ultimoAbastecimentoData" timestamp;')
    neon_cur.execute('ALTER TABLE "Viatura" ADD COLUMN IF NOT EXISTS condutores integer;')

    # Full refresh: esta tabela só existe pra alimentar este ETL, então
    # truncar + reinserir evita sobrar viatura excluída/baixada no cadastro
    # de origem.
    neon_cur.execute('TRUNCATE TABLE "Viatura";')

    execute_values(
        neon_cur,
        """
        INSERT INTO "Viatura" (
            id, tipo, "tipoAcronym", "numeroOrdem", placa, marca, modelo, ano, patrimonio,
            renavam, chassis, rastreado, caracterizado, posse, destinacao, combustivel,
            "categoriaHabilitacao", "omeId", "omeAcronym", status, "stillUsable",
            odometro, "ultimoAbastecimentoValor", "ultimoAbastecimentoData", condutores,
            "updatedAt"
        )
        VALUES %s
        """,
        values,
        page_size=1000
    )

    neon_conn.commit()

    neon_cur.close()
    neon_conn.close()

    print(f"{len(values)} viaturas sincronizadas com o Neon.")


if __name__ == "__main__":
    main()
