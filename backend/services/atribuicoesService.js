import crypto from "crypto";
import { lerAtribuicoes, salvarAtribuicoes } from "./atribuicoesStore.js";
import { resolverMatriculaEOmePorCpf } from "./omeResolver.js";
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

// Remove `cpfPendente` de cada registro antes de expor — ver `criarPendente`.
// GET /atribuicoes é rota PÚBLICA (o app inteiro precisa da lista pra
// calcular controle de acesso), então isto é a única barreira entre o CPF
// guardado e qualquer chamador não autenticado. `matriculaPendente` (só um
// booleano) continua exposto — é a flag que a UI usa pra mostrar o aviso.
function semCpfPendente(atribuicoes) {
  const publicas = {};
  for (const [chave, dados] of Object.entries(atribuicoes)) {
    const { cpfPendente, ...resto } = dados;
    publicas[chave] = resto;
  }
  return publicas;
}

export async function listar() {
  const atribuicoes = await lerAtribuicoes();
  return semCpfPendente(atribuicoes);
}

// Usada por requireAdmin.js — true se a matrícula (ou chave de usuário) tem
// hoje um perfil que concede admin. Consulta o arquivo a cada chamada (sem
// cache): perfil revogado em /adm vale na próxima requisição, não só depois
// de expirar um token já emitido. Checa o perfil PRINCIPAL e qualquer
// perfil adicional (ver `outrosPerfis` — 2026-09-25, suporte a mais de um
// perfil por usuário): quem tem ADMINISTRADOR como perfil adicional segue
// administrador, independente de qual perfil está "ativo" na sessão dele
// (isso é só escolha de visualização no navegador, não afeta autorização).
export async function perfilConcedeAdmin(usuarioChave) {
  if (!usuarioChave) return false;
  const atribuicoes = await lerAtribuicoes();
  const atribuicao = atribuicoes[normalizarUsuario(usuarioChave)];
  if (!atribuicao) return false;
  if (PERFIS_COM_ADMIN.has(atribuicao.perfil)) return true;
  return (atribuicao.outrosPerfis || []).some((p) => PERFIS_COM_ADMIN.has(p.perfil));
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
  // O estado "pendente" (ver criarPendente) descreve a IDENTIDADE do
  // registro, não o perfil — sobrevive a uma troca de perfil feita antes de
  // resolver, senão editar o perfil de alguém pendente apagaria a flag e o
  // CPF guardado, quebrando o "Atualizar" em lote pra aquele registro.
  if (anterior.matriculaPendente) {
    proxima.matriculaPendente = true;
    proxima.cpfPendente = anterior.cpfPendente;
  }
  // Perfis adicionais (ver adicionarPerfil/removerPerfil) sobrevivem à
  // troca do perfil PRINCIPAL — sem isso, editar o perfil principal de um
  // usuário com dupla atribuição apagaria o(s) perfil(is) adicional(is)
  // dele em silêncio.
  if (anterior.outrosPerfis?.length) proxima.outrosPerfis = anterior.outrosPerfis;

  const proximas = { ...atribuicoes, [usuario]: proxima };
  await salvarAtribuicoes(proximas);
  const { cpfPendente, ...proximaPublica } = proxima;
  return proximaPublica;
}

// Suporte a mais de um perfil por usuário (2026-09-25, pedido do usuário):
// o perfil PRINCIPAL continua em `perfil`/`unidade`/`titular`/
// `unidadeConcedida` (ver `definir` acima — nunca muda de formato, pra não
// quebrar nada que já lê essas chaves direto); cada perfil A MAIS entra em
// `outrosPerfis`, um array de objetos no mesmo formato. A confirmação
// "usuário já tem outro perfil, atribuir mesmo assim?" é responsabilidade
// da UI (ver UsuariosEditor.jsx) — aqui só valida que o perfil novo não
// duplica um que o usuário já tem (principal ou adicional).
export async function adicionarPerfil(usuarioChave, { perfil, unidade, titular, unidadeConcedida }) {
  const usuario = normalizarUsuario(usuarioChave);
  if (!usuario) throw new ValidationError("Informe o usuário (matrícula).");
  if (!perfil || !PERFIS_VALIDOS.has(perfil)) {
    throw new ValidationError(`Perfil inválido. Use um de: ${[...PERFIS_VALIDOS].join(", ")}.`);
  }

  const atribuicoes = await lerAtribuicoes();
  const atual = atribuicoes[usuario];
  if (!atual) throw new NotFoundError(`Usuário "${usuario}" não encontrado — atribua o primeiro perfil antes de adicionar outro.`);

  const outrosAtuais = atual.outrosPerfis || [];
  if (atual.perfil === perfil || outrosAtuais.some((p) => p.perfil === perfil)) {
    throw new ValidationError(`"${usuario}" já tem o perfil ${perfil}.`);
  }

  const novoPerfil = { perfil };
  if (unidade) novoPerfil.unidade = unidade;
  if (titular) novoPerfil.titular = titular;
  if (unidadeConcedida) novoPerfil.unidadeConcedida = unidadeConcedida;

  const proxima = { ...atual, outrosPerfis: [...outrosAtuais, novoPerfil] };
  await salvarAtribuicoes({ ...atribuicoes, [usuario]: proxima });
  const { cpfPendente, ...proximaPublica } = proxima;
  return proximaPublica;
}

export async function removerPerfil(usuarioChave, perfilChave) {
  const usuario = normalizarUsuario(usuarioChave);
  const atribuicoes = await lerAtribuicoes();
  const atual = atribuicoes[usuario];
  if (!atual) throw new NotFoundError("Usuário não encontrado.");
  const outrosAtuais = atual.outrosPerfis || [];
  if (!outrosAtuais.some((p) => p.perfil === perfilChave)) {
    throw new NotFoundError(`"${usuario}" não tem o perfil ${perfilChave} como adicional.`);
  }
  const restantes = outrosAtuais.filter((p) => p.perfil !== perfilChave);
  const proxima = { ...atual };
  if (restantes.length > 0) proxima.outrosPerfis = restantes;
  else delete proxima.outrosPerfis;
  await salvarAtribuicoes({ ...atribuicoes, [usuario]: proxima });
  const { cpfPendente, ...proximaPublica } = proxima;
  return proximaPublica;
}

// Usuário adicionado por CPF cuja matrícula não foi encontrada no SGP —
// decisão do usuário (2026-09-25): guarda o CPF só deste registro (exceção
// pontual e documentada à regra geral de nunca persistir CPF, ver
// omeResolver.js), pra permitir o retry automático em lote depois (ver
// atualizarPendentes). Chave é um placeholder (nunca o CPF, nunca a
// matrícula que não existe ainda) — vira a chave de verdade quando resolver.
export async function criarPendente({ cpf, perfil }) {
  const cpfLimpo = String(cpf || "").replace(/\D/g, "");
  if (cpfLimpo.length !== 11) throw new ValidationError("CPF inválido.");
  if (!perfil || !PERFIS_VALIDOS.has(perfil)) {
    throw new ValidationError(`Perfil inválido. Use um de: ${[...PERFIS_VALIDOS].join(", ")}.`);
  }

  const atribuicoes = await lerAtribuicoes();
  let usuario;
  do {
    usuario = `PENDENTE-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  } while (atribuicoes[usuario]);

  const registro = { perfil, matriculaPendente: true, cpfPendente: cpfLimpo };
  await salvarAtribuicoes({ ...atribuicoes, [usuario]: registro });
  return { usuario, atribuicao: { perfil, matriculaPendente: true } };
}

// Tenta resolver de novo, contra o SGP/DW, a matrícula de cada usuário
// pendente — chamado pelo botão "Atualizar" (ver Administracao.jsx). Quando
// resolve, migra o registro da chave placeholder pra chave real (matrícula),
// preservando perfil/unidade/vínculo; quando a matrícula resolvida já
// pertence a outro registro (alguém já cadastrado por essa matrícula
// enquanto este ficava pendente), pula e conta como conflito em vez de
// sobrescrever quem já existe.
export async function atualizarPendentes() {
  const atribuicoes = await lerAtribuicoes();
  const proximas = { ...atribuicoes };
  let resolvidos = 0;
  let conflitos = 0;
  let aindaPendentes = 0;

  for (const [chave, dados] of Object.entries(atribuicoes)) {
    if (!dados.matriculaPendente || !dados.cpfPendente) continue;
    const { matricula } = await resolverMatriculaEOmePorCpf(dados.cpfPendente);
    if (!matricula) {
      aindaPendentes += 1;
      continue;
    }
    const chaveNova = normalizarUsuario(matricula);
    if (proximas[chaveNova] && chaveNova !== chave) {
      conflitos += 1;
      continue;
    }
    const { matriculaPendente, cpfPendente, ...resto } = dados;
    delete proximas[chave];
    proximas[chaveNova] = resto;
    resolvidos += 1;
  }

  if (resolvidos > 0) await salvarAtribuicoes(proximas);
  return { resolvidos, conflitos, aindaPendentes };
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
