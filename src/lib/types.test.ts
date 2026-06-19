import { describe, it, expect } from "vitest";
import { formatPrice, UNIT_LABELS, type ProductUnit } from "./types";

describe("formatPrice", () => {
  it("formate des centimes en euros au format FR", () => {
    expect(formatPrice(1234)).toBe("12,34\u00a0€");
  });

  it("gère le zéro", () => {
    expect(formatPrice(0)).toBe("0,00\u00a0€");
  });

  it("arrondit correctement les grandes valeurs", () => {
    expect(formatPrice(199999)).toBe("1\u202f999,99\u00a0€");
  });
});

describe("UNIT_LABELS", () => {
  it("couvre toutes les unités possibles", () => {
    const units: ProductUnit[] = ["piece", "kg", "g", "litre", "botte", "douzaine"];
    for (const u of units) {
      expect(UNIT_LABELS[u]).toBeTruthy();
    }
  });

  it("retourne 'pièce' pour 'piece'", () => {
    expect(UNIT_LABELS.piece).toBe("pièce");
  });
});
