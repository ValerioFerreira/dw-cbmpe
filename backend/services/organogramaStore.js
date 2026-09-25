import { getPoolDw } from "../config/db.js";

// Persistência do organograma editável — desde 2026-09-25 na tabela
// app.organograma_unidade do banco `dw` (DDL em etl/dw/ddl/06_app.sql;
// decisão do usuário, ver DW_INGESTAO.md seção 6). Antes era
// backend/data/organograma.json, que hoje só serve de semente pra uma
// instalação nova (ver scripts/semear_estado_app.js).
//
// lerOrganograma()/salvarOrganograma() continuam sendo a ÚNICA fronteira
// com o armazenamento, com a mesma interface de antes (árvore inteira como
// array de nós) — organogramaService.js (as regras de negócio) não mudou.

// Serializa escritas concorrentes deste processo (a transação abaixo já
// garante atomicidade no banco; a fila evita que duas edições quase
// simultâneas se sobrescrevam a partir da mesma leitura).
let filaEscrita = Promise.resolve();

const SQL_LER = `
  select id, sigla, nivel, parent_id, fixo, ordem::float8 as ordem, funcao_coronel
  from app.organograma_unidade
  order by nivel, ordem, sigla
`;

export async function lerOrganograma() {
  const { rows } = await getPoolDw().query(SQL_LER);
  if (rows.length === 0) {
    throw new Error("Organograma vazio no banco (app.organograma_unidade) — rode backend/scripts/semear_estado_app.js.");
  }
  return rows.map((r) => {
    const no = { id: r.id, sigla: r.sigla, nivel: r.nivel, parentId: r.parent_id, ordem: r.ordem };
    if (r.fixo) no.fixo = true;
    if (r.funcao_coronel) no.funcaoCoronel = true;
    return no;
  });
}

// Regrava a árvore inteira numa transação (são ~50 nós — mais simples e
// mais seguro que calcular diff; a FK pai→filho é DEFERRABLE, então a
// ordem de inserção não importa).
export function salvarOrganograma(unidades) {
  const tarefa = filaEscrita.then(async () => {
    const cliente = await getPoolDw().connect();
    try {
      await cliente.query("begin");
      await cliente.query("delete from app.organograma_unidade");
      for (const u of unidades) {
        await cliente.query(
          `insert into app.organograma_unidade (id, sigla, nivel, parent_id, fixo, ordem, funcao_coronel, atualizado_em)
           values ($1, $2, $3, $4, $5, $6, $7, now())`,
          [u.id, u.sigla, u.nivel, u.parentId ?? null, !!u.fixo, u.ordem ?? 0, !!u.funcaoCoronel],
        );
      }
      await cliente.query("commit");
    } catch (err) {
      await cliente.query("rollback").catch(() => {});
      throw err;
    } finally {
      cliente.release();
    }
  });
  filaEscrita = tarefa.catch(() => {});
  return tarefa;
}
