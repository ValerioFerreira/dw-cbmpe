// Prepara o schema `app` do banco `dw` para o backend (ver
// etl/dw/ddl/06_app.sql e DW_INGESTAO.md seção 6):
//
//   1. aplica o DDL 06_app.sql (idempotente — CREATE ... IF NOT EXISTS);
//   2. se as tabelas estiverem VAZIAS, importa a semente de
//      backend/data/organograma.json e backend/data/atribuicoes.json.
//
// Nunca sobrescreve estado que já existe no banco — rodar de novo é seguro.
// Uso (de dentro de backend/, com DATABASE_URL_DW no .env):
//
//   node scripts/semear_estado_app.js
import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getPoolDw } from "../config/db.js";
import { salvarOrganograma } from "../services/organogramaStore.js";
import { salvarAtribuicoes } from "../services/atribuicoesStore.js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DDL = path.join(AQUI, "..", "..", "etl", "dw", "ddl", "06_app.sql");
const SEMENTE_ORGANOGRAMA = path.join(AQUI, "..", "data", "organograma.json");
const SEMENTE_ATRIBUICOES = path.join(AQUI, "..", "data", "atribuicoes.json");

async function contar(pool, tabela) {
  const { rows } = await pool.query(`select count(*)::int as n from ${tabela}`);
  return rows[0].n;
}

async function main() {
  const pool = getPoolDw();

  // O DDL vive em etl/dw/ddl/ (aplicado também por etl/dw/aplicar_ddl.py);
  // a imagem Docker do backend não leva etl/, então lá o schema tem de ter
  // sido criado antes — por isso o aviso em vez de falhar.
  try {
    await pool.query(await fs.readFile(DDL, "utf-8"));
    console.log("DDL 06_app.sql aplicado.");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    console.log("06_app.sql não encontrado (imagem Docker?) — assumindo schema `app` já criado.");
  }

  if (await contar(pool, "app.organograma_unidade") === 0) {
    const { unidades } = JSON.parse(await fs.readFile(SEMENTE_ORGANOGRAMA, "utf-8"));
    await salvarOrganograma(unidades);
    console.log(`Organograma semeado: ${unidades.length} unidades.`);
  } else {
    console.log(`Organograma já existe no banco (${await contar(pool, "app.organograma_unidade")} unidades) — mantido.`);
  }

  if (await contar(pool, "app.atribuicao") === 0) {
    const { atribuicoes } = JSON.parse(await fs.readFile(SEMENTE_ATRIBUICOES, "utf-8"));
    await salvarAtribuicoes(atribuicoes);
    console.log(`Atribuições semeadas: ${Object.keys(atribuicoes).length} usuários.`);
  } else {
    console.log(`Atribuições já existem no banco (${await contar(pool, "app.atribuicao")} usuários) — mantidas.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
