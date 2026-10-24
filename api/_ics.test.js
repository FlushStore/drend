import { describe, expect, it } from "vitest";
import { compromissos, lerEventos } from "./_ics.js";

const ics = [
  "BEGIN:VCALENDAR",
  "X-WR-TIMEZONE:America/Sao_Paulo",
  "BEGIN:VEVENT",
  "UID:a",
  "DTSTART;TZID=America/Sao_Paulo:20261024T140000",
  "DTEND;TZID=America/Sao_Paulo:20261024T150000",
  "SUMMARY:Reposição\\, fornecedor",
  "LOCATION:Loja",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:b",
  "DTSTART:20261025T120000Z",
  "DTEND:20261025T130000Z",
  "SUMMARY:Call em UTC",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:c",
  "DTSTART;VALUE=DATE:20261026",
  "DTEND;VALUE=DATE:20261027",
  "SUMMARY:Aniversário",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:d",
  "DTSTART;TZID=America/Sao_Paulo:20261020T193000",
  "DTEND;TZID=America/Sao_Paulo:20261020T203000",
  "RRULE:FREQ=WEEKLY;BYDAY=TU,TH",
  "EXDATE;TZID=America/Sao_Paulo:20261027T193000",
  "SUMMARY:Estudo",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:d",
  "RECURRENCE-ID;TZID=America/Sao_Paulo:20261029T193000",
  "DTSTART;TZID=America/Sao_Paulo:20261029T210000",
  "DTEND;TZID=America/Sao_Paulo:20261029T220000",
  "SUMMARY:Estudo (mais tarde)",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:e",
  "STATUS:CANCELLED",
  "DTSTART;TZID=America/Sao_Paulo:20261024T100000",
  "SUMMARY:Cancelado",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:f",
  "DTSTART;TZID=America/Sao_Paulo:20261024T080000",
  "DTEND;TZID=America/Sao_Paulo:20261024T083000",
  "SUMMARY:Linha muito comprida que o Google dobra no meio da pal",
  " avra",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const de = Date.parse("2026-10-24T03:00:00Z"); // 24/10 00:00 em Brasília
const ate = Date.parse("2026-11-01T03:00:00Z");

describe("agenda iCal", () => {
  it("lê o fuso e ignora cancelado", () => {
    const { fuso, eventos } = lerEventos(ics);
    expect(fuso).toBe("America/Sao_Paulo");
    expect(eventos.some((e) => e.titulo === "Cancelado")).toBe(false);
  });

  it("desdobra recorrência, exceção e EXDATE no horário de Brasília", () => {
    const lista = compromissos(ics, de, ate);
    expect(lista.map((e) => `${e.dia} ${e.titulo}`)).toEqual([
      "2026-10-24 Linha muito comprida que o Google dobra no meio da palavra",
      "2026-10-24 Reposição, fornecedor",
      "2026-10-25 Call em UTC",
      "2026-10-26 Aniversário",
      "2026-10-29 Estudo (mais tarde)",
    ]);
    const reposicao = lista.find((e) => e.titulo.startsWith("Reposição"));
    expect(reposicao).toMatchObject({ inicio: "2026-10-24T17:00:00.000Z", fim: "2026-10-24T18:00:00.000Z", local: "Loja", diaInteiro: false });
    expect(lista.find((e) => e.titulo === "Aniversário")).toMatchObject({ diaInteiro: true, inicio: "2026-10-26T03:00:00.000Z" });
    expect(lista.find((e) => e.titulo === "Estudo (mais tarde)")?.inicio).toBe("2026-10-30T00:00:00.000Z");
  });

  it("recorrência sem exceção aparece toda semana", () => {
    const lista = compromissos(ics, Date.parse("2026-11-01T03:00:00Z"), Date.parse("2026-11-08T03:00:00Z"));
    expect(lista.filter((e) => e.titulo === "Estudo").map((e) => e.dia)).toEqual(["2026-11-03", "2026-11-05"]);
  });

  it("UNTIL em UTC corta no dia certo", () => {
    const curto = ics.replace("RRULE:FREQ=WEEKLY;BYDAY=TU,TH", "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261103T223000Z");
    const lista = compromissos(curto, Date.parse("2026-11-01T03:00:00Z"), Date.parse("2026-11-08T03:00:00Z"));
    expect(lista.filter((e) => e.titulo === "Estudo").map((e) => e.dia)).toEqual(["2026-11-03"]);
  });
});

describe("cancelamento de uma ocorrência", () => {
  it("RECURRENCE-ID cancelado apaga só aquela ocorrência", () => {
    const cancelado = ics.replace("END:VCALENDAR", [
      "BEGIN:VEVENT", "UID:d", "STATUS:CANCELLED",
      "RECURRENCE-ID;TZID=America/Sao_Paulo:20261103T193000",
      "DTSTART;TZID=America/Sao_Paulo:20261103T193000",
      "SUMMARY:Estudo", "END:VEVENT", "END:VCALENDAR"].join("\r\n"));
    const lista = compromissos(cancelado, Date.parse("2026-11-01T03:00:00Z"), Date.parse("2026-11-08T03:00:00Z"));
    expect(lista.filter((e) => e.titulo === "Estudo").map((e) => e.dia)).toEqual(["2026-11-05"]);
  });
});
