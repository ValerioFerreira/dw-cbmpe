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

Pendente: o usuário publica esta versão no Windmill e roda o job (mesmo
fluxo já usado pra Efetivo/windmill-neon.py) — depois, rodar de novo
etl/viaturas/extract_viaturas.py localmente pra ano/patrimonio aparecerem
em src/data/real/viaturas_lista.json.

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
        )
        SELECT
            v.id,
            vt.name AS tipo,
            v.license_plate,
            v.brand,
            v.model,
            v.year,
            v.patrimony,
            ut.ome_id,
            ut.ome_acronym,
            us.status_nome,
            us.still_usable
        FROM vehicles v
        LEFT JOIN vehicle_types vt ON vt.id = v.type_id
        LEFT JOIN ultima_transferencia ut ON ut.vehicle_id = v.id
        LEFT JOIN ultimo_status us ON us.vehicle_id = v.id
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
            license_plate,
            brand,
            model,
            year,
            patrimony,
            ome_id,
            ome_acronym,
            status_nome,
            still_usable,
            agora,
        )
        for vehicle_id, tipo, license_plate, brand, model, year, patrimony, ome_id, ome_acronym, status_nome, still_usable in linhas
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

    # Full refresh: esta tabela só existe pra alimentar este ETL, então
    # truncar + reinserir evita sobrar viatura excluída/baixada no cadastro
    # de origem.
    neon_cur.execute('TRUNCATE TABLE "Viatura";')

    execute_values(
        neon_cur,
        """
        INSERT INTO "Viatura" (id, tipo, placa, marca, modelo, ano, patrimonio, "omeId", "omeAcronym", status, "stillUsable", "updatedAt")
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
