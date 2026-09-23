// Pools do Postgres para os dois bancos que omeResolver.js precisa —
// separados (não um "db.js" genérico multi-uso) porque são credenciais e
// hosts diferentes, cada um só de leitura. Lazy: só conecta quando alguém
// pedir o pool pela primeira vez, então o backend sobe normalmente mesmo
// sem VPN (as rotas de auth via SGU não dependem disso).
//
// DATABASE_URL_DW aponta pro banco `postgres` (convenção já usada em todo
// etl/dw/ — ver aplicar_ddl.py/carga_core.py: essa var é o SERVIDOR, os
// scripts trocam o banco final pra `dw` na hora de usar). Aqui faz o mesmo
// em vez de introduzir uma env var nova só pra este backend — descobri em
// 2026-09-23 que já existe esse padrão, então reuso em vez de duplicar.
import pg from "pg";

const { Pool } = pg;

let poolSgp = null;
let poolDw = null;

function urlDoBancoDw() {
  const base = process.env.DATABASE_URL_DW;
  if (!base) throw new Error("DATABASE_URL_DW não configurada");
  const semBanco = base.slice(0, base.lastIndexOf("/"));
  return `${semBanco}/dw`;
}

export function getPoolSgp() {
  if (!poolSgp) {
    if (!process.env.DATABASE_URL_SGP) {
      throw new Error("DATABASE_URL_SGP não configurada");
    }
    poolSgp = new Pool({ connectionString: process.env.DATABASE_URL_SGP, connectionTimeoutMillis: 8000 });
  }
  return poolSgp;
}

export function getPoolDw() {
  if (!poolDw) {
    poolDw = new Pool({ connectionString: urlDoBancoDw(), connectionTimeoutMillis: 8000 });
  }
  return poolDw;
}
