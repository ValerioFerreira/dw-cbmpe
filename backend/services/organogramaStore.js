import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// Persistencia em arquivo JSON — decisao registrada no relatorio da
// funcionalidade (organograma editavel): nao ha banco de aplicacao ainda
// (so os bancos do DW/SGP/ROE, de outros sistemas), entao um arquivo no
// servidor e o primeiro corte mais simples possivel. lerOrganograma()/
// salvarOrganograma() sao a UNICA fronteira com o disco — trocar para
// Postgres/SQLite depois significa reescrever so este arquivo, mantendo
// organogramaService.js (as regras de negocio) intocado.
const ARQUIVO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "organograma.json");

// Serializa escritas concorrentes (duas chamadas PUT/POST quase simultaneas
// nao podem interlear leitura+escrita do mesmo arquivo e uma pisar na
// outra). Fila simples em memoria — suficiente pro volume de uso (edicao
// administrativa esporadica, nao um endpoint de alto trafego).
let filaEscrita = Promise.resolve();

export async function lerOrganograma() {
  const bruto = await fs.readFile(ARQUIVO, "utf-8");
  const dados = JSON.parse(bruto);
  if (!Array.isArray(dados.unidades)) {
    throw new Error(`Arquivo de organograma corrompido: ${ARQUIVO}`);
  }
  return dados.unidades;
}

export function salvarOrganograma(unidades) {
  const tarefa = filaEscrita.then(async () => {
    const conteudo = JSON.stringify({ unidades }, null, 2) + "\n";
    // Escreve em arquivo temporario e renomeia (atomico no mesmo volume) —
    // uma escrita que falhar no meio nunca deixa organograma.json truncado.
    const tmp = `${ARQUIVO}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, conteudo, "utf-8");
    await fs.rename(tmp, ARQUIVO);
  });
  filaEscrita = tarefa.catch(() => {});
  return tarefa;
}
