import { describe, expect, it } from "vitest";
import { lerFrontmatter, notaDoArquivo, resumoDe, tirarSegredos, validarNota } from "./_vault.js";

const nota = [
  "---",
  'type: "project"',
  'title: "00 - Hub Loja"',
  "status: active # comentário",
  "project_role: hub",
  'next_action: "Ligar para o fornecedor"',
  "tags: [loja, \"#vendas\"]",
  "updated: 2026-10-20",
  "---",
  "# 00 - Hub Loja",
  "",
  "> [!info] Aviso",
  "> nada",
  "",
  "O catálogo da loja com **preços** e [[Contexto|o contexto]].",
].join("\n");

describe("vault: leitura das notas", () => {
  it("lê o frontmatter simples e as listas em bloco", () => {
    const { dados, corpo } = lerFrontmatter("---\ntags:\n  - a\n  - 'b'\nstatus: x\n---\ncorpo");
    expect(dados).toEqual({ tags: ["a", "b"], status: "x" });
    expect(corpo).toBe("corpo");
  });

  it("monta a nota com título, projeto, próxima ação e resumo sem markdown", () => {
    const n = notaDoArquivo("02 - Projects/Loja/00 - Hub Loja.md", nota);
    expect(n).toMatchObject({
      titulo: "00 - Hub Loja",
      pasta: "02 - Projects/Loja",
      tipo: "project",
      status: "active",
      papel: "hub",
      proxima: "Ligar para o fornecedor",
      tags: ["loja", "vendas"],
      modificado: "2026-10-20",
      resumo: "O catálogo da loja com preços e o contexto.",
    });
    expect(n.corpo.startsWith("# 00 - Hub Loja")).toBe(true);
  });

  it("deixa de fora o que é sensível, modelo ou anexo", () => {
    expect(notaDoArquivo("06 - People/x.md", "---\nsensitivity: sensitive\n---\nsegredo")).toBeNull();
    expect(notaDoArquivo("98 - Templates/Projeto.md", "# Modelo")).toBeNull();
    expect(notaDoArquivo("13 - Assets/foto.png", "")).toBeNull();
    expect(notaDoArquivo(".obsidian/app.md", "x")).toBeNull();
  });

  it("título cai para o primeiro # e depois para o nome do arquivo; data pelo nome", () => {
    expect(notaDoArquivo("a/Nota.md", "# Título [[Link]]\n\ntexto").titulo).toBe("Título Link");
    const d = notaDoArquivo("09 - Daily/2026-10-01 - Dia.md", "só texto");
    expect(d.titulo).toBe("2026-10-01 - Dia");
    expect(d.modificado).toBe("2026-10-01");
  });

  it("esconde o que parece credencial", () => {
    const t = tirarSegredos("chave sk-ant-api03-abcdefghijklmnopqrstu e ghp_abcdefghijklmnopqrstuvwxyz12 e senha: minhasenha123 e eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4");
    expect(t).not.toMatch(/sk-ant|ghp_|minhasenha|eyJ/);
    expect(t).toContain("senha: [oculto]");
  });

  it("o resumo pula títulos, avisos, listas e tabelas", () => {
    expect(resumoDe("# T\n\n- item\n\n| a | b |\n\nFrase de verdade aqui.")).toBe("Frase de verdade aqui.");
  });

  it("o POST só aceita caminho .md sem subir pasta", () => {
    expect(validarNota({ caminho: "../x.md", titulo: "x" })).toBeNull();
    expect(validarNota({ caminho: "a.txt", titulo: "x" })).toBeNull();
    expect(validarNota({ caminho: "a/b.md", titulo: " B ", tags: ["x", 2], extra: 1 })).toMatchObject({ caminho: "a/b.md", titulo: "B", tags: ["x"] });
  });
});
