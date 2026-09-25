import { getPoolDw } from "../config/db.js";

// Persistência das atribuições de perfil — desde 2026-09-25 nas tabelas
// app.atribuicao (perfil principal) e app.atribuicao_adicional (perfis a
// mais) do banco `dw` (DDL em etl/dw/ddl/06_app.sql; decisão do usuário, ver
// DW_INGESTAO.md seção 6). Antes: backend/data/atribuicoes.json, hoje só
// semente de instalação nova (ver scripts/semear_estado_app.js).
//
// Mesma interface de antes — objeto { [usuario]: {perfil, unidade?,
// titular?, unidadeConcedida?, matriculaPendente?, cpfPendente?,
// outrosPerfis?} } —, então atribuicoesService.js e requireAdmin.js (que
// consulta isto a cada requisição de escrita) não mudaram.

let filaEscrita = Promise.resolve();

function semNulos(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== false));
}

export async function lerAtribuicoes() {
  const pool = getPoolDw();
  const [principais, adicionais] = await Promise.all([
    pool.query(`select usuario, perfil, unidade, titular, unidade_concedida, matricula_pendente, cpf_pendente
                from app.atribuicao order by usuario`),
    pool.query(`select usuario, perfil, unidade, titular, unidade_concedida
                from app.atribuicao_adicional order by usuario, posicao, perfil`),
  ]);
  const atribuicoes = {};
  for (const r of principais.rows) {
    atribuicoes[r.usuario] = semNulos({
      perfil: r.perfil,
      unidade: r.unidade,
      titular: r.titular,
      unidadeConcedida: r.unidade_concedida,
      matriculaPendente: r.matricula_pendente,
      cpfPendente: r.cpf_pendente,
    });
  }
  for (const r of adicionais.rows) {
    const dono = atribuicoes[r.usuario];
    if (!dono) continue;
    (dono.outrosPerfis ||= []).push(semNulos({
      perfil: r.perfil,
      unidade: r.unidade,
      titular: r.titular,
      unidadeConcedida: r.unidade_concedida,
    }));
  }
  return atribuicoes;
}

// Regrava tudo numa transação — mesmo raciocínio de organogramaStore.js
// (volume pequeno, edição administrativa esporádica).
export function salvarAtribuicoes(atribuicoes) {
  const tarefa = filaEscrita.then(async () => {
    const cliente = await getPoolDw().connect();
    try {
      await cliente.query("begin");
      await cliente.query("delete from app.atribuicao_adicional");
      await cliente.query("delete from app.atribuicao");
      for (const [usuario, a] of Object.entries(atribuicoes)) {
        await cliente.query(
          `insert into app.atribuicao (usuario, perfil, unidade, titular, unidade_concedida, matricula_pendente, cpf_pendente, atualizado_em)
           values ($1, $2, $3, $4, $5, $6, $7, now())`,
          [usuario, a.perfil, a.unidade ?? null, a.titular ?? null, a.unidadeConcedida ?? null,
            !!a.matriculaPendente, a.matriculaPendente ? (a.cpfPendente ?? null) : null],
        );
        for (const [posicao, p] of (a.outrosPerfis || []).entries()) {
          await cliente.query(
            `insert into app.atribuicao_adicional (usuario, perfil, unidade, titular, unidade_concedida, posicao)
             values ($1, $2, $3, $4, $5, $6)`,
            [usuario, p.perfil, p.unidade ?? null, p.titular ?? null, p.unidadeConcedida ?? null, posicao],
          );
        }
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
