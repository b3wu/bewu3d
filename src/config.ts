export type Material = "PLA" | "PETG" | "ABS";

// Cena materiału (z prądem i usługą) – za 1 kg
export const MATERIAL_RATE_PLN_PER_KG = 150;

// Gęstość [g/cm^3]
export const DENSITY: Record<Material, number> = { PLA: 1.24, PETG: 1.27, ABS: 1.04 };

// Współczynnik zużycia = (obwiednie + infill + odpady) względem pełnego modelu.
// Zestrojone, żeby nie zaniżać (bliżej realiów z Bambu Studio).
export const USAGE_FACTOR: Record<Material, number> = { PLA: 0.43, PETG: 0.45, ABS: 0.40 };

// Wydajność drukarki [g/h] – szacunek dla A1 (0.2 mm). Służy tylko do czasu.
export const PRINT_RATE_G_PER_H: Record<Material, number> = { PLA: 23, PETG: 22, ABS: 22 };

// Zaokrąglanie wagi do pełnych gramów (możesz zmienić na 5, jeśli chcesz do 5 g)
export const ROUND_WEIGHT_TO_G = 1;
