/**
 * O cérebro do DREND em 3D: a casca (pontos com sulcos), a rede de neurônios por dentro
 * e o crânio de vidro em volta. Em repouso ele gira devagar e dispara um neurônio de vez
 * em quando; quando o DREND pensa (`atividade` muda), a rede acende em cascata.
 * Carregado sob demanda: o three.js não pesa na abertura do app.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gerarForma } from "./forma";

interface Pulso {
  de: number;
  para: number;
  t: number;
  vel: number;
  geracao: number;
}

const MAX_PULSOS = 160;

function texturaDePonto() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,.75)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Cor do acento do tema (azul do DREND), lida do CSS. */
function corDoAcento(el: HTMLElement) {
  const v = getComputedStyle(el).getPropertyValue("--cos-acento").trim();
  try {
    return new THREE.Color(v || "#60A5FA");
  } catch {
    return new THREE.Color("#60A5FA");
  }
}

export default function CerebroCena({ atividade, pensando }: { atividade: number; pensando: boolean }) {
  const caixa = useRef<HTMLDivElement>(null);
  const disparar = useRef<(n: number) => void>(() => {});
  const estadoPensando = useRef(pensando);
  estadoPensando.current = pensando;

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const forma = gerarForma(7000, 220, 2);
    const acento = corDoAcento(el);
    // Tema claro: luz somada some no fundo branco, então a rede é desenhada por cima, mais escura.
    const fundo = new THREE.Color(getComputedStyle(el).getPropertyValue("--cos-app").trim() || "#0A0A0B");
    const claro = fundo.r * 0.3 + fundo.g * 0.59 + fundo.b * 0.11 > 0.5;
    const mistura = claro ? THREE.NormalBlending : THREE.AdditiveBlending;
    const branco = new THREE.Color(claro ? "#0B2A66" : "#E8F1FF");
    const corCasca = claro ? acento.clone() : acento.clone().lerp(new THREE.Color("#ffffff"), 0.18);

    // Sem WebGL (aparelho antigo, contexto negado): o cérebro é enfeite, a tela segue sem ele.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      el.dataset.semWebgl = "";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0.25, 4.6);
    camera.lookAt(0, -0.08, 0);
    const grupo = new THREE.Group();
    grupo.rotation.set(0.12, -0.6, 0);
    cena.add(grupo);
    const ponto = texturaDePonto();

    // casca: os sulcos em pontos finos
    const gSup = new THREE.BufferGeometry();
    gSup.setAttribute("position", new THREE.BufferAttribute(forma.superficie, 3));
    const mSup = new THREE.PointsMaterial({ size: 0.034, map: ponto, color: corCasca, transparent: true, opacity: claro ? 0.5 : 0.85, depthWrite: false, blending: mistura });
    grupo.add(new THREE.Points(gSup, mSup));

    // ligações da rede
    const gLig = new THREE.BufferGeometry();
    gLig.setAttribute("position", new THREE.BufferAttribute(forma.nos, 3));
    gLig.setIndex(new THREE.BufferAttribute(forma.ligacoes, 1));
    const mLig = new THREE.LineBasicMaterial({ color: acento, transparent: true, opacity: 0.08, depthWrite: false, blending: mistura });
    grupo.add(new THREE.LineSegments(gLig, mLig));

    // neurônios: cada um com o próprio brilho (acende e apaga)
    const nNos = forma.nos.length / 3;
    const brilho = new Float32Array(nNos);
    const coresNos = new Float32Array(nNos * 3);
    const gNos = new THREE.BufferGeometry();
    gNos.setAttribute("position", new THREE.BufferAttribute(forma.nos, 3));
    gNos.setAttribute("color", new THREE.BufferAttribute(coresNos, 3));
    const mNos = new THREE.PointsMaterial({ size: 0.075, map: ponto, vertexColors: true, transparent: true, depthWrite: false, blending: mistura });
    grupo.add(new THREE.Points(gNos, mNos));

    // pulsos correndo pelas ligações
    const posPulsos = new Float32Array(MAX_PULSOS * 3);
    const gPul = new THREE.BufferGeometry();
    gPul.setAttribute("position", new THREE.BufferAttribute(posPulsos, 3));
    gPul.setDrawRange(0, 0);
    const mPul = new THREE.PointsMaterial({ size: 0.09, map: ponto, color: branco, transparent: true, depthWrite: false, blending: mistura });
    grupo.add(new THREE.Points(gPul, mPul));

    // crânio de vidro: só a borda brilha (fresnel), o miolo fica transparente
    const gCranio = new THREE.SphereGeometry(1, 64, 48);
    gCranio.scale(1.42, 1.16, 1.08);
    gCranio.translate(-0.04, 0.02, 0);
    const mCranio = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: mistura,
      side: THREE.FrontSide,
      uniforms: { cor: { value: acento }, forca: { value: claro ? 0.14 : 0.28 } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 cor; uniform float forca; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(cor * f * forca, f * forca); }`,
    });
    grupo.add(new THREE.Mesh(gCranio, mCranio));

    const pulsos: Pulso[] = [];
    const tmp = new THREE.Color();
    const ponto3 = (i: number) => [forma.nos[i * 3], forma.nos[i * 3 + 1], forma.nos[i * 3 + 2]];
    function soltar(de: number, geracao: number) {
      for (const para of forma.vizinhos[de]) {
        if (pulsos.length >= MAX_PULSOS) return;
        if (geracao > 0 && Math.random() < 0.35) continue;
        pulsos.push({ de, para, t: 0, vel: 1.4 + Math.random() * 1.2, geracao });
      }
    }
    disparar.current = (n: number) => {
      for (let i = 0; i < n; i++) {
        const no = Math.floor(Math.random() * nNos);
        brilho[no] = 1;
        soltar(no, 0);
      }
    };

    function redimensionar() {
      const { width, height } = el!.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    }
    redimensionar();
    const obs = new ResizeObserver(redimensionar);
    obs.observe(el);

    let visivel = true;
    const io = new IntersectionObserver(([e]) => (visivel = e.isIntersecting));
    io.observe(el);

    let anterior = performance.now();
    let espera = 0;
    let giro = 0;
    let quadro = 0;
    function passo(agora: number) {
      quadro = requestAnimationFrame(passo);
      const dt = Math.min((agora - anterior) / 1000, 0.05);
      anterior = agora;
      if (!visivel || document.hidden) return;
      const pensa = estadoPensando.current;

      // Balança mostrando o perfil (onde a forma do cérebro se lê melhor); pensando, gira.
      giro += dt * (pensa ? 1.6 : 0.35);
      grupo.rotation.y = -0.35 + Math.sin(giro) * 0.75;
      grupo.rotation.x = 0.1 + Math.sin(agora / 3200) * 0.04;

      // em repouso, um disparo de vez em quando; pensando, vários seguidos
      espera -= dt;
      if (espera <= 0) {
        disparar.current(pensa ? 3 : 1);
        espera = pensa ? 0.12 : 0.9 + Math.random() * 1.2;
      }

      let vivos = 0;
      for (let i = 0; i < pulsos.length; i++) {
        const p = pulsos[i];
        p.t += dt * p.vel;
        if (p.t >= 1) {
          brilho[p.para] = 1;
          if (p.geracao < (pensa ? 5 : 2)) soltar(p.para, p.geracao + 1);
          continue;
        }
        pulsos[vivos++] = p;
        const a = ponto3(p.de), b = ponto3(p.para);
        posPulsos[(vivos - 1) * 3] = a[0] + (b[0] - a[0]) * p.t;
        posPulsos[(vivos - 1) * 3 + 1] = a[1] + (b[1] - a[1]) * p.t;
        posPulsos[(vivos - 1) * 3 + 2] = a[2] + (b[2] - a[2]) * p.t;
      }
      pulsos.length = vivos;
      gPul.setDrawRange(0, Math.min(vivos, MAX_PULSOS));
      gPul.attributes.position.needsUpdate = true;

      for (let i = 0; i < nNos; i++) {
        brilho[i] = Math.max(0, brilho[i] - dt * 1.6);
        const b = claro ? 1 : 0.32 + brilho[i] * 0.95;
        const c = tmp.copy(acento).lerp(branco, brilho[i] * 0.8);
        coresNos[i * 3] = c.r * b;
        coresNos[i * 3 + 1] = c.g * b;
        coresNos[i * 3 + 2] = c.b * b;
      }
      gNos.attributes.color.needsUpdate = true;

      const alvo = pensa ? 0.22 : 0.08;
      mLig.opacity += (alvo - mLig.opacity) * Math.min(1, dt * 4);
      mCranio.uniforms.forca.value += ((claro ? (pensa ? 0.24 : 0.14) : pensa ? 0.5 : 0.28) - mCranio.uniforms.forca.value) * Math.min(1, dt * 3);
      renderer.render(cena, camera);
    }

    if (reduzir) {
      disparar.current(4);
      for (let i = 0; i < nNos; i++) coresNos.set([acento.r * 0.4, acento.g * 0.4, acento.b * 0.4], i * 3);
      renderer.render(cena, camera);
    } else {
      quadro = requestAnimationFrame(passo);
    }

    return () => {
      cancelAnimationFrame(quadro);
      obs.disconnect();
      io.disconnect();
      renderer.dispose();
      [gSup, gLig, gNos, gPul, gCranio].forEach((g) => g.dispose());
      [mSup, mLig, mNos, mPul, mCranio].forEach((m) => m.dispose());
      ponto.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // cada pedido novo: uma rajada
  useEffect(() => {
    if (atividade > 0) disparar.current(10);
  }, [atividade]);

  return <div ref={caixa} className="dr-cerebro-cena" aria-hidden="true" />;
}
