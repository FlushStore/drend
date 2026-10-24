/**
 * Curva suave por pontos para gráficos de linha e área no SVG: passa por todos os
 * pontos e é monótona entre eles (Fritsch-Carlson, a mesma ideia do `curveMonotoneX`
 * do d3). Antes (Catmull-Rom) a curva passava do ponto: um dia zerado ao lado de um
 * dia forte afundava abaixo da base do gráfico (revisão de 15/10).
 */
export function curvaSuave(pts: ReadonlyArray<readonly [number, number]>): string {
  const n = pts.length;
  if (n < 2) return "";
  const h = (i: number) => pts[i + 1][0] - pts[i][0];
  const inclinacao = (i: number) => (h(i) === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / h(i));
  const tangentes = pts.map((_, i) => {
    if (i === 0) return inclinacao(0);
    if (i === n - 1) return inclinacao(n - 2);
    const a = inclinacao(i - 1), b = inclinacao(i);
    // Pico, vale ou trecho plano: tangente zero, a curva não passa do ponto.
    if (a * b <= 0) return 0;
    const p = (a * h(i) + b * h(i - 1)) / (h(i - 1) + h(i));
    return Math.sign(a) * Math.min(Math.abs(a), Math.abs(b), Math.abs(p) / 2) * 2;
  });
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const t = h(i) / 3;
    d += ` C${x1 + t},${y1 + tangentes[i] * t} ${x2 - t},${y2 - tangentes[i + 1] * t} ${x2},${y2}`;
  }
  return d;
}
