/**
 * A forma do cérebro do DREND, gerada (sem modelo 3D baixado): dois hemisférios, lobos
 * temporais, cerebelo e tronco, com sulcos feitos de ondas na superfície. Daqui saem os
 * pontos da superfície e a rede de neurônios (nós + ligações) que acende na animação.
 * Eixos: x = frente (+) / nuca (−), y = cima, z = lados.
 */

type V = [number, number, number];
interface Parte { c: V; r: V }

const PARTES: Parte[] = [
  // hemisférios (a fresta entre eles é a fissura longitudinal)
  { c: [0, 0.06, 0.43], r: [1.0, 0.72, 0.42] },
  { c: [0, 0.06, -0.43], r: [1.0, 0.72, 0.42] },
  // lobos temporais
  { c: [0.12, -0.34, 0.47], r: [0.56, 0.3, 0.3] },
  { c: [0.12, -0.34, -0.47], r: [0.56, 0.3, 0.3] },
  // cerebelo
  { c: [-0.7, -0.5, 0.24], r: [0.34, 0.23, 0.3] },
  { c: [-0.7, -0.5, -0.24], r: [0.34, 0.23, 0.3] },
  // tronco
  { c: [-0.32, -0.78, 0], r: [0.13, 0.32, 0.13] },
];

/** Gerador determinístico: a mesma forma toda vez (e nos testes). */
export function aleatorio(semente = 7) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dentro = (p: V, parte: Parte, folga = 1) =>
  ((p[0] - parte.c[0]) / (parte.r[0] * folga)) ** 2 + ((p[1] - parte.c[1]) / (parte.r[1] * folga)) ** 2 + ((p[2] - parte.c[2]) / (parte.r[2] * folga)) ** 2 < 1;

/** Sulcos: soma de ondas; dá o relevo de giros sem textura. */
function sulco(x: number, y: number, z: number) {
  return Math.sin(x * 11 + Math.sin(y * 7) * 1.6) * Math.sin(y * 9 + z * 5) * 0.5 + Math.sin(z * 13 + x * 6) * 0.25;
}

export interface Forma {
  /** Pontos da superfície, [x,y,z,...]. */
  superficie: Float32Array;
  /** Neurônios (nós da rede). */
  nos: Float32Array;
  /** Ligações entre nós: pares de índices. */
  ligacoes: Uint16Array;
  /** Vizinhos de cada nó (para o disparo em cascata). */
  vizinhos: number[][];
}

export function gerarForma(nSuperficie = 3600, nNos = 240, k = 3, semente = 7): Forma {
  const r = aleatorio(semente);
  const sup: number[] = [];
  const pesos = PARTES.map((p) => p.r[0] * p.r[1] + p.r[1] * p.r[2] + p.r[0] * p.r[2]);
  const total = pesos.reduce((a, b) => a + b, 0);
  let tentativas = 0;
  while (sup.length / 3 < nSuperficie && tentativas++ < nSuperficie * 20) {
    // parte sorteada pela área aproximada
    let alvo = r() * total;
    let i = 0;
    while (alvo > pesos[i]) alvo -= pesos[i++];
    const parte = PARTES[i];
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const n: V = [s * Math.cos(a), u, s * Math.sin(a)];
    const relevo = 1 + sulco(n[0] * 2, n[1] * 2, n[2] * 2) * 0.045;
    const p: V = [parte.c[0] + n[0] * parte.r[0] * relevo, parte.c[1] + n[1] * parte.r[1] * relevo, parte.c[2] + n[2] * parte.r[2] * relevo];
    // só a casca da união: ponto escondido dentro de outra parte não aparece
    if (PARTES.some((o) => o !== parte && dentro(p, o, 0.97))) continue;
    // base do cérebro achatada (fora o tronco e o cerebelo)
    if (i < 4 && p[1] < -0.52) continue;
    sup.push(...p);
  }

  // neurônios: metade na casca, metade por dentro, para a rede ter profundidade
  const nos: number[] = [];
  while (nos.length / 3 < nNos) {
    if (nos.length / 3 < nNos / 2) {
      const j = Math.floor(r() * (sup.length / 3)) * 3;
      nos.push(sup[j] * 0.97, sup[j + 1] * 0.97, sup[j + 2] * 0.97);
    } else {
      const p: V = [r() * 2 - 1, r() * 1.6 - 0.8, r() * 1.8 - 0.9];
      if (PARTES.some((o) => dentro(p, o, 0.9))) nos.push(...p);
    }
  }

  const n = nos.length / 3;
  const vizinhos: number[][] = Array.from({ length: n }, () => []);
  const pares = new Set<string>();
  const lig: number[] = [];
  for (let i = 0; i < n; i++) {
    const dist: Array<[number, number]> = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = nos[i * 3] - nos[j * 3], dy = nos[i * 3 + 1] - nos[j * 3 + 1], dz = nos[i * 3 + 2] - nos[j * 3 + 2];
      dist.push([dx * dx + dy * dy + dz * dz, j]);
    }
    dist.sort((a, b) => a[0] - b[0]);
    for (const [, j] of dist.slice(0, k)) {
      const chave = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (pares.has(chave)) continue;
      pares.add(chave);
      lig.push(i, j);
      vizinhos[i].push(j);
      vizinhos[j].push(i);
    }
  }
  return { superficie: new Float32Array(sup), nos: new Float32Array(nos), ligacoes: new Uint16Array(lig), vizinhos };
}
