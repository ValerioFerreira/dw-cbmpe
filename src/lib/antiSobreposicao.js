// Afasta rótulos/balões que se sobrepõem, mantendo cada um o mais perto
// possível do seu ponto real — e devolve a linha-guia que liga um ao outro.
//
// O problema concreto: 70 dos 185 postos do Mapa de Força ficam na Região
// Metropolitana, muitos a menos de 2 unidades de distância no viewBox de
// 1000. Desenhados no lugar exato, viram uma pilha ilegível onde não dá para
// clicar em nada. Mover o balão e deixar uma âncora no ponto verdadeiro é a
// solução clássica de cartografia — e é honesta, porque a linha mostra de
// onde o balão saiu.
//
// O algoritmo é uma relaxação simples: enquanto dois balões se tocarem,
// empurra os dois na direção que os separa; ao mesmo tempo, uma mola fraca
// puxa cada balão de volta para a sua âncora, para que ninguém se afaste
// mais do que o necessário. Determinístico (sem aleatoriedade), estável entre
// renders e barato para algumas centenas de pontos.

const ITERACOES = 120;
const FORCA_SEPARACAO = 0.6;
const FORCA_ANCORA = 0.045;

/**
 * @param {Array<{x:number, y:number, r:number}>} pontos  âncoras e raios
 * @param {{margem?:number, limites?:{x:number,y:number,w:number,h:number}}} opcoes
 * @returns {Array<{x:number, y:number, deslocado:boolean}>} posição do balão
 */
export default function afastarSobreposicoes(pontos, opcoes = {}) {
  const margem = opcoes.margem ?? 1.5;
  const limites = opcoes.limites;
  const n = pontos.length;
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    px[i] = pontos[i].x;
    py[i] = pontos[i].y;
  }

  // Ordem de prioridade: balão maior (mais viaturas) se move menos, porque
  // é o que o leitor procura primeiro. peso 1 = imóvel, 0 = livre. Sede de
  // unidade é quase imóvel: o brasão do batalhão tem que ficar no quartel, e
  // quem se afasta em volta dela é a vizinhança.
  const raioMax = Math.max(1, ...pontos.map((p) => p.r));
  const peso = pontos.map((p) => (p.fixo ? 0.9 : 0.15 + 0.5 * (p.r / raioMax)));

  // Pontos EXATAMENTE coincidentes não têm direção de separação, e a
  // relaxação sozinha demora a desempilhá-los — no QCG são 37 postos na mesma
  // coordenada. Então eles já começam abertos num anel em volta da âncora
  // comum, com raio suficiente para caberem lado a lado. É o que faz os
  // brasões se separarem quando se aproxima o zoom, em vez de continuarem um
  // por cima do outro.
  const pilhas = new Map();
  for (let i = 0; i < n; i += 1) {
    const chave = `${pontos[i].x.toFixed(4)},${pontos[i].y.toFixed(4)}`;
    if (!pilhas.has(chave)) pilhas.set(chave, []);
    pilhas.get(chave).push(i);
  }
  for (const indices of pilhas.values()) {
    if (indices.length < 2) continue;
    const passo = Math.max(...indices.map((i) => pontos[i].r)) * 2 + margem;
    const raioAnel = (indices.length * passo) / (2 * Math.PI);
    indices.forEach((i, k) => {
      const ang = (2 * Math.PI * k) / indices.length;
      px[i] += Math.cos(ang) * raioAnel;
      py[i] += Math.sin(ang) * raioAnel;
    });
  }

  for (let passo = 0; passo < ITERACOES; passo += 1) {
    let moveu = false;
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const dx = px[j] - px[i];
        const dy = py[j] - py[i];
        const minimo = pontos[i].r + pontos[j].r + margem;
        let dist = Math.hypot(dx, dy);
        if (dist >= minimo) continue;
        moveu = true;
        // Coincidência exata (mesma coordenada) não tem direção: abre num
        // ângulo derivado do índice, para continuar determinístico.
        let ux;
        let uy;
        if (dist < 1e-6) {
          const ang = ((i * 97 + j * 31) % 360) * (Math.PI / 180);
          ux = Math.cos(ang);
          uy = Math.sin(ang);
          dist = 1e-6;
        } else {
          ux = dx / dist;
          uy = dy / dist;
        }
        const empurrao = (minimo - dist) * FORCA_SEPARACAO;
        const fi = (1 - peso[i]) / ((1 - peso[i]) + (1 - peso[j]) || 1);
        const fj = 1 - fi;
        px[i] -= ux * empurrao * fi;
        py[i] -= uy * empurrao * fi;
        px[j] += ux * empurrao * fj;
        py[j] += uy * empurrao * fj;
      }
    }
    // Mola de volta para a âncora.
    for (let i = 0; i < n; i += 1) {
      px[i] += (pontos[i].x - px[i]) * FORCA_ANCORA;
      py[i] += (pontos[i].y - py[i]) * FORCA_ANCORA;
    }
    if (!moveu) break;
  }

  return pontos.map((p, i) => {
    let x = px[i];
    let y = py[i];
    if (limites) {
      x = Math.min(Math.max(x, limites.x + p.r), limites.x + limites.w - p.r);
      y = Math.min(Math.max(y, limites.y + p.r), limites.y + limites.h - p.r);
    }
    return { x, y, deslocado: Math.hypot(x - p.x, y - p.y) > p.r * 0.35 };
  });
}

/**
 * Agrupa pontos próximos demais para caberem lado a lado.
 *
 * Afastar resolve encavalamento de dois ou três balões, mas não a Região
 * Metropolitana: são ~70 postos numa área de poucas dezenas de unidades, e
 * empurrar todos para longe encheria o oceano de balões apontando para o
 * mesmo lugar. A saída é a de qualquer mapa — mostrar UM balão com o total do
 * grupo e abri-lo ao aproximar o zoom, já que a distância limite encolhe
 * junto com a escala.
 *
 * Agrupamento guloso por ligação simples: o ponto de maior valor abre o
 * grupo e puxa todos os vizinhos ainda livres dentro do raio. Determinístico
 * porque a ordem é sempre (fixo, valor desc, id).
 *
 * @param {Array<{x,y,valor,id,fixo?:boolean,chave?:string}>} pontos
 *        `fixo` marca sede de unidade; ver compativel() abaixo.
 * @param {number} distancia  limite, nas unidades do viewBox atual
 */
export function agruparProximos(pontos, distancia) {
  const ordem = pontos
    .map((p, i) => ({ p, i }))
    // Ponto `fixo` (a sede de uma unidade) lidera: só assim ele arrasta os
    // vizinhos da própria OME em vez de ser arrastado por um vizinho
    // qualquer, o que apagaria o brasão da unidade do mapa.
    .sort((a, b) => (Number(!!b.p.fixo) - Number(!!a.p.fixo))
      || (b.p.valor - a.p.valor)
      || String(a.p.id).localeCompare(String(b.p.id)));
  const usado = new Array(pontos.length).fill(false);
  const grupos = [];
  for (const { p, i } of ordem) {
    if (usado[i]) continue;
    usado[i] = true;
    const membros = [p];
    for (const { p: q, i: j } of ordem) {
      if (usado[j]) continue;
      if (!compativel(p, q)) continue;
      if (Math.hypot(q.x - p.x, q.y - p.y) <= distancia) {
        usado[j] = true;
        membros.push(q);
      }
    }
    // A âncora do grupo é a média dos membros, não a do primeiro: a linha-
    // guia deve sair do meio da mancha, senão aponta para um posto qualquer.
    // Exceção: grupo com sede fica ANCORADO NA SEDE — o brasão do batalhão
    // tem que pousar no quartel, não na média dos postos em volta.
    const ancora = p.fixo ? p : {
      x: membros.reduce((s, m) => s + m.x, 0) / membros.length,
      y: membros.reduce((s, m) => s + m.y, 0) / membros.length,
    };
    grupos.push({
      id: membros.length === 1 ? membros[0].id : `grupo-${membros[0].id}`,
      x: ancora.x,
      y: ancora.y,
      membros,
      fixo: !!p.fixo,
      valor: membros.reduce((s, m) => s + m.valor, 0),
    });
  }
  return grupos;
}

/**
 * Um grupo liderado por um ponto `fixo` só aceita pontos da mesma `chave`.
 *
 * É o que garante o pedido do usuário: "em toda sede (1ª SB) de unidade,
 * mesmo que haja mais unidades aglomeradas, o brasão da unidade aparece no
 * mapa, mesmo no zoom mais distante". Um balão com OMEs misturadas não tem
 * brasão para mostrar — vira um círculo com número. Impedindo a mistura, o
 * grupo da sede continua sendo de uma OME só, e a insígnia sobrevive.
 */
function compativel(lider, candidato) {
  if (!lider.fixo && !candidato.fixo) return true;
  return lider.chave != null && lider.chave === candidato.chave;
}
