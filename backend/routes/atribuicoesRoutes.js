import express from "express";
import { listar, definir, remover, criarPendente, atualizarPendentes, adicionarPerfil, removerPerfil } from "../controllers/atribuicoesController.js";
import validateToken from "../middlewares/validateToken.js";
import requireAdmin from "../middlewares/requireAdmin.js";

const router = express.Router();

// Pública — mesma lógica de organogramaRoutes.js: o app inteiro precisa
// dela pra calcular controle de acesso (calcularAcesso, ver
// src/lib/accessControl.js), não só quem está em /adm. NUNCA carrega CPF
// (ver atribuicoesService.js > listar/semCpfPendente) — só perfil/unidade/
// vínculo de assessor/flag de pendência.
router.get("/", listar);

// Escrita — admin fixo (role "admin") OU um usuário SGU cujo próprio
// perfil, hoje, é ADMINISTRADOR (requireAdmin.js consulta este mesmo
// arquivo pra decidir, então um perfil revogado aqui derruba o acesso de
// escrita na próxima requisição, não só no próximo login).
//
// Rotas literais (/pendente, /atualizar-pendentes) antes de /:usuario só
// por clareza de leitura — não há colisão real, métodos diferentes.
router.post("/pendente", validateToken, requireAdmin, criarPendente);
router.post("/atualizar-pendentes", validateToken, requireAdmin, atualizarPendentes);
router.put("/:usuario", validateToken, requireAdmin, definir);
router.delete("/:usuario", validateToken, requireAdmin, remover);
// Mais de um perfil por usuário (2026-09-25) — perfil ADICIONAL, distinto
// do principal (PUT acima, que sempre SUBSTITUI o principal).
router.post("/:usuario/perfis", validateToken, requireAdmin, adicionarPerfil);
router.delete("/:usuario/perfis/:perfil", validateToken, requireAdmin, removerPerfil);

export default router;
