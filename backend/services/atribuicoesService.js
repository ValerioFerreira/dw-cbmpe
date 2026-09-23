import { lerAtribuicoes, salvarAtribuicoes } from "./atribuicoesStore.js";
import { ValidationError, NotFoundError } from "../errors/AppError.js";

// Espelha src/lib/accessControl.js (PERFIS) — só o essencial que o backend
// precisa: quais chaves de perfil existem, e quais concedem admin (hoje só
// ADMINISTRADOR). Os dois lados não compartilham módulo (front é bundle
// Vite, back é Node puro), então isto é mantido manualmente em sincronia; se
// um perfil novo ganhar `admin: true` em accessControl.js, replique aqui
// também. Um teste de integração cobrindo os dois seria o ideal, mas o
// volume de mudança nesta lista é baixo (perfis são definidos pela
// corporação, não por código).
const PERFIS_VALIDOS = new Set([
  "ADMINISTRADOR", "COMANDANTE_GERAL", "SUBCOMANDANTE_GERAL",
  "DGP", "DLOG", "DF", "TITULAR", "ASSESSOR",
]);
const PERFIS_COM_ADMIN = new Set(["ADMINISTRADOR"]);

function normalizarUsuario(usuario) {
  return String(usuario || "").trim().toUpperCase();
}

export async function listar() {
  return lerAtribuicoes();
}

// Usada por requireAdmin.js — true se a matrícula (ou chave de usuário) tem
// hoje um perfil que concede admin. Consulta o arquivo a cada chamada (sem
// cache): perfil revogado em /adm vale na próxima requisição, não só depois
// de expirar um token já emitido.
export async function perfilConcedeAdmin(usuarioChave) {
  if (!usuarioChave) return false;
  const atribuicoes = await lerAtribuicoes();
  const atribuicao = atribuicoes[normalizarUsuario(usuarioChave)];
  return !!atribuicao && PERFIS_COM_ADMIN.has(atribuicao.perfil);
}

export async function definir(usuarioChave, { perfil, unidade, titular, unidadeConcedida }) {
  const usuario = normalizarUsuario(usuarioChave);
  if (!usuario) throw new ValidationError("Informe o usuário (matrícula).");
  if (!perfil || !PERFIS_VALIDOS.has(perfil)) {
    throw new ValidationError(`Perfil inválido. Use um de: ${[...PERFIS_VALIDOS].join(", ")}.`);
  }

  const atribuicoes = await lerAtribuicoes();
  const anterior = atribuicoes[usuario] || {};
  // Mesma regra de Administracao.jsx: ao trocar de perfil, só sobrevivem os
  // campos que continuam fazendo sentido pro perfil novo — em vez de
  // acumular lixo de perfis anteriores (ex. um `titular` órfão numa
  // atribuição de DGP).
  const proxima = { perfil };
  if (unidade !== undefined) proxima.unidade = unidade || undefined;
  else if (anterior.perfil === perfil) proxima.unidade = anterior.unidade;
  if (titular !== undefined) proxima.titular = titular || undefined;
  else if (anterior.perfil === perfil) proxima.titular = anterior.titular;
  if (unidadeConcedida !== undefined) proxima.unidadeConcedida = unidadeConcedida || undefined;
  else if (anterior.perfil === perfil) proxima.unidadeConcedida = anterior.unidadeConcedida;

  const proximas = { ...atribuicoes, [usuario]: proxima };
  await salvarAtribuicoes(proximas);
  return proxima;
}

export async function remover(usuarioChave) {
  const usuario = normalizarUsuario(usuarioChave);
  const atribuicoes = await lerAtribuicoes();
  if (!atribuicoes[usuario]) throw new NotFoundError("Usuário não encontrado.");
  const proximas = { ...atribuicoes };
  delete proximas[usuario];
  await salvarAtribuicoes(proximas);
  return { usuario };
}
