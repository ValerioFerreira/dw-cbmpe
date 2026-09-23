import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// Mesmo padrão de organogramaStore.js — arquivo JSON no servidor, única
// fronteira com o disco, fila em memória serializando escritas concorrentes.
// Migrado de localStorage (2026-09-23): a atribuição de perfil feita pelo
// admin em /adm precisa estar visível quando o usuário atribuído logar no
// PRÓPRIO navegador dele, não só no navegador de quem atribuiu — com
// localStorage isso era estruturalmente impossível (cada navegador tem o
// seu). Também é o que agora dá ao backend (requireAdmin.js) visibilidade
// real de quem tem perfil ADMINISTRADOR, sem depender de um claim do
// cliente.
const ARQUIVO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "atribuicoes.json");

let filaEscrita = Promise.resolve();

export async function lerAtribuicoes() {
  const bruto = await fs.readFile(ARQUIVO, "utf-8");
  const dados = JSON.parse(bruto);
  if (!dados.atribuicoes || typeof dados.atribuicoes !== "object") {
    throw new Error(`Arquivo de atribuições corrompido: ${ARQUIVO}`);
  }
  return dados.atribuicoes;
}

export function salvarAtribuicoes(atribuicoes) {
  const tarefa = filaEscrita.then(async () => {
    const conteudo = JSON.stringify({ atribuicoes }, null, 2) + "\n";
    const tmp = `${ARQUIVO}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, conteudo, "utf-8");
    await fs.rename(tmp, ARQUIVO);
  });
  filaEscrita = tarefa.catch(() => {});
  return tarefa;
}
