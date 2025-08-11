import React, { useEffect, useMemo, useState } from "react";
import StlViewer from "./components/StlViewer";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import * as THREE from "three";

function LogoBewu3D({ className = "h-8 w-8" }: { className?: string }) {
  return <img src="/logo.svg" className={className} alt="Bewu3D logo" />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className="text-sm text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

type Material = "PLA" | "PETG" | "ABS";
type Product = { id: number; name: string; price: number };

const PRODUCTS: Product[] = [
  { id: 1, name: "Uchwyt na słuchawki", price: 59 },
  { id: 2, name: "Organizer na biurko", price: 79 },
  { id: 3, name: "Stojak na telefon", price: 39 },
  { id: 4, name: "Pudełko na karty SD", price: 29 },
  { id: 5, name: "Wieszak na kable", price: 25 },
  { id: 6, name: "Model dekoracyjny", price: 119 },
];

const MATERIAL_RATE_PLN_PER_KG = 150;
const DENSITY: Record<Material, number> = { PLA: 1.24, PETG: 1.27, ABS: 1.04 }; // g/cm^3
const DEFAULT_USAGE_FACTOR = 0.30;
const DEFAULT_THROUGHPUT_G_PER_H = 20;
const AMS_EXTRA_COLOR_SURCHARGE = 0;

async function estimateVolumeCm3FromSTL(file: File): Promise<number | null> {
  try {
    const buf = await file.arrayBuffer();
    const loader = new STLLoader();
    const geo = loader.parse(buf as ArrayBuffer);
    const pos = geo.getAttribute('position');
    if (!pos) return null;
    let volume = 0; // mm^3
    const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      v0.fromBufferAttribute(pos as any, i);
      v1.fromBufferAttribute(pos as any, i + 1);
      v2.fromBufferAttribute(pos as any, i + 2);
      volume += v0.dot(v1.clone().cross(v2));
    }
    volume = Math.abs(volume) / 6.0;
    const cm3 = volume / 1000.0;
    return cm3;
  } catch {
    return null;
  }
}

type CartProductLine = { kind: 'product'; product: Product; qty: number };
type CartCustomLine = { kind: 'stl'; name: string; price: number; qty: number; meta: { material: Material; filename: string; weightG: number; colors: number } };
type CartLine = CartProductLine | CartCustomLine;

function useCart() {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try { return JSON.parse(localStorage.getItem("bewu3d_cart") || "[]"); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem("bewu3d_cart", JSON.stringify(lines)); }, [lines]);

  function addProduct(product: Product, qty = 1) {
    setLines(prev => {
      const i = prev.findIndex(l => (l as any).product?.id === product.id && l.kind === 'product');
      if (i >= 0) { const copy = [...prev]; const line = copy[i] as CartProductLine; copy[i] = { ...line, qty: line.qty + qty }; return copy; }
      return [...prev, { kind: 'product', product, qty } as CartProductLine];
    });
  }
  function addCustom(name: string, price: number, qty: number, meta: CartCustomLine['meta']) {
    setLines(prev => [...prev, { kind: 'stl', name, price, qty, meta } as CartCustomLine]);
  }
  function remove(index: number) { setLines(prev => prev.filter((_, i) => i !== index)); }
  function setQty(index: number, qty: number) { setLines(prev => prev.map((l, i) => i === index ? ({ ...l, qty: Math.max(1, qty) } as CartLine) : l)); }
  function clear() { setLines([]); }
  const count = lines.reduce((s, l) => s + (l as any).qty, 0);
  const total = lines.reduce((s, l) => s + (l as any).qty * (l.kind === 'product' ? (l as any).product.price : (l as any).price), 0);
  return { lines, addProduct, addCustom, remove, setQty, clear, count, total };
}

export default function App({ goContact }: { goContact: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [material, setMaterial] = useState<Material>("PLA");
  const [copies, setCopies] = useState<number>(1);
  const [amsColors, setAmsColors] = useState<number>(1);

  const [autoVolCm3, setAutoVolCm3] = useState<number | null>(null);
  const [usageFactor, setUsageFactor] = useState<number>(DEFAULT_USAGE_FACTOR);
  const [weightG, setWeightG] = useState<number | null>(null);
  const [throughputGph, setThroughputGph] = useState<number>(DEFAULT_THROUGHPUT_G_PER_H);
  const [timeH, setTimeH] = useState<number | null>(null);

  const cart = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!file) { setAutoVolCm3(null); setWeightG(null); setTimeH(null); return; }
    (async () => {
      const vol = await estimateVolumeCm3FromSTL(file);
      if (cancelled) return;
      setAutoVolCm3(vol);
      if (vol) {
        const w = vol * DENSITY[material] * usageFactor;
        setWeightG(parseFloat(w.toFixed(1)));
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => {
    if (autoVolCm3 && autoVolCm3 > 0) {
      const w = autoVolCm3 * DENSITY[material] * usageFactor;
      setWeightG(parseFloat(w.toFixed(1)));
    }
  }, [material, usageFactor, autoVolCm3]);

  useEffect(() => {
    if (weightG != null && throughputGph > 0) {
      const t = weightG / throughputGph;
      setTimeH(parseFloat(t.toFixed(2)));
    }
  }, [weightG, throughputGph]);

  const estimate = useMemo(() => {
    if (!file || weightG == null) return null;
    const basePerPiece = (weightG / 1000) * MATERIAL_RATE_PLN_PER_KG;
    const colorExtra = Math.max(0, amsColors - 1) * AMS_EXTRA_COLOR_SURCHARGE;
    const perPiece = basePerPiece + colorExtra;
    const total = perPiece * Math.max(1, copies);
    return { perPiece, total };
  }, [file, weightG, copies, amsColors]);

  function addCurrentModelToCart() {
    if (!file || !estimate || weightG == null) return;
    cart.addCustom(file.name, Number(estimate.perPiece.toFixed(2)), copies, {
      material, filename: file.name, weightG, colors: amsColors
    });
    setCartOpen(true);
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      <div className={"fixed inset-y-0 right-0 z-50 w-80 transform bg-[#0B0F14] p-4 shadow-2xl ring-1 ring-white/10 transition-transform " + (cartOpen ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Twój koszyk</div>
          <button onClick={() => setCartOpen(false)} className="rounded-lg border border-white/10 px-2 py-1 text-sm hover:bg-white/10">Zamknij</button>
        </div>
        <div className="mt-4 space-y-3 overflow-auto" style={{maxHeight: "70vh"}}>
          {cart.lines.length === 0 && <div className="text-sm text-white/60">Koszyk jest pusty.</div>}
          {cart.lines.map((l, idx) => (
            <div key={idx} className="rounded-2xl border border-white/10 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  {l.kind === 'product' ? (l as any).product.name : `${(l as any).name} (${(l as any).meta.material}, ${(l as any).meta.weightG} g, kolory: ${(l as any).meta.colors})`}
                </div>
                <div className="text-sm font-semibold">{(l.kind === 'product' ? (l as any).product.price : (l as any).price)} PLN</div>
              </div>
              {l.kind === 'stl' && (
                <div className="mt-1 text-xs text-white/50">Plik: {(l as any).meta.filename}</div>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => cart.setQty(idx, (l as any).qty - 1)} className="w-7 rounded-lg border border-white/10 hover:bg-white/10">-</button>
                  <input type="number" className="w-12 rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm" value={(l as any).qty} min={1} onChange={(e)=>cart.setQty(idx, parseInt(e.target.value||'1'))} />
                  <button onClick={() => cart.setQty(idx, (l as any).qty + 1)} className="w-7 rounded-lg border border-white/10 hover:bg-white/10">+</button>
                </div>
                <button onClick={() => cart.remove(idx)} className="text-xs text-white/70 hover:text-white">Usuń</button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between text-sm">
            <div>Suma</div>
            <div className="font-semibold">{cart.total} PLN</div>
          </div>
          <button onClick={() => alert("Demo checkout – tu podpinamy Stripe Checkout")} className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#36F3D6] to-[#00A3FF] px-4 py-2 text-sm font-semibold text-[#0B0F14]">Przejdź do płatności</button>
          {cart.lines.length > 0 && <button onClick={cart.clear} className="mt-2 w-full rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10">Wyczyść koszyk</button>}
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B0F14]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <LogoBewu3D className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-wide">Bewu3D</span>
          </div>
          <nav className="hidden gap-6 text-sm text-white/80 md:flex">
            <a href="#upload" className="hover:text-white">Wycena</a>
            <a href="#showcase" className="hover:text-white">Sklep</a>
            <a href="#/contact" className="hover:text-white">Kontakt</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={()=>setCartOpen(true)} className="relative rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
              Koszyk <span className="ml-2 rounded-md bg-white/10 px-2 py-0.5 text-xs">{cart.count}</span>
            </button>
            <a href="#upload" className="rounded-2xl bg-gradient-to-r from-[#36F3D6] to-[#00A3FF] px-4 py-2 text-sm font-semibold text-[#0B0F14] shadow-lg shadow-cyan-500/10">Wyceń model</a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#36F3D6]/10 blur-3xl" />
        <div className="absolute -right-32 top-24 h-80 w-80 rounded-full bg-[#00A3FF]/10 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              Nowoczesny <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#36F3D6] to-[#00A3FF]">druk 3D</span><br />na żądanie
            </h1>
            <p className="mt-4 text-white/70">Bambu Lab A1 + AMS – kolory? Jasne. Wgraj STL, obejrzyj w 3D i wyceń wg wagi.</p>
            <div className="mt-6 flex items-center gap-3">
              <a href="#upload" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">Wgraj STL</a>
              <a href="#showcase" className="text-sm text-white/70 hover:text-white">Zobacz realizacje →</a>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <Stat label="Drukarki" value="FDM (PLA/PETG/ABS)" />
              <Stat label="Lead time" value="1–3 dni" />
              <Stat label="AMS" value="Wielokolorowo" />
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] w-full rounded-3xl bg-gradient-to-br from-white/5 to-white/0 ring-1 ring-white/10" />
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(54,243,214,0.15),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(0,163,255,0.15),transparent_40%)]" />
          </div>
        </div>
      </section>

      <section id="upload" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-semibold">Wycena wg wagi (+ podgląd STL)</h2>
            <p className="mt-2 text-sm text-white/70">Cena = waga × {MATERIAL_RATE_PLN_PER_KG} PLN/kg. Auto-waga z STL (szacunek, zależy od infill/ścianek) – możesz nadpisać ręcznie.</p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm text-white/80">Plik STL</label>
                <input type="file" accept=".stl" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F14] p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white/90 hover:file:bg-white/20" />
                {file && (<div className="mt-2 text-xs text-white/60">Wybrano: {file.name}</div>)}
              </div>

              <StlViewer file={file} />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-white/80">Materiał</label>
                  <select value={material} onChange={(e) => setMaterial(e.target.value as Material)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F14] p-3 text-sm">
                    <option>PLA</option><option>PETG</option><option>ABS</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-white/80">Ilość sztuk</label>
                  <input type="number" min={1} value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F14] p-3 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-white/80">Szac. zużycie materiału (%)</label>
                  <input type="number" min={1} max={100} value={Math.round(usageFactor * 100)} onChange={(e)=>setUsageFactor(Math.min(1, Math.max(0.01, Number(e.target.value)/100)))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F14] p-3 text-sm" />
                  <div className="mt-1 text-xs text-white/50">Obwiednie + infill (np. 30% dla 20% infill + ścianki).</div>
                </div>
                <div>
                  <label className="text-sm text-white/80">Kolory (AMS)</label>
                  <input type="number" min={1} value={amsColors} onChange={(e)=>setAmsColors(Math.max(1, Number(e.target.value)))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F14] p-3 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-white/80">Waga (g)</label>
                  <input type="number" min={1} value={weightG ?? ''} onChange={(e)=>setWeightG(Math.max(1, Number(e.target.value)))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F14] p-3 text-sm" placeholder={autoVolCm3 ? (autoVolCm3 * DENSITY[material] * usageFactor).toFixed(1) : 'np. 134'} />
                  {autoVolCm3 && <div className="mt-1 text-xs text-white/50">Auto: {(autoVolCm3 * DENSITY[material] * usageFactor).toFixed(1)} g (objętość {autoVolCm3.toFixed(1)} cm³)</div>}
                </div>
                <div>
                  <label className="text-sm text-white/80">Wydajność (g/h)</label>
                  <input type="number" min={1} value={throughputGph} onChange={(e)=>setThroughputGph(Math.max(1, Number(e.target.value)))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F14] p-3 text-sm" />
                  <div className="mt-1 text-xs text-white/50">Szacunek czasu = waga / wydajność.</div>
                </div>
              </div>

              {weightG != null && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-white/80">Szac. czas (h)</label>
                    <input type="number" min={0.1} step={0.1} value={timeH ?? ''} onChange={(e)=>setTimeH(Math.max(0.1, Number(e.target.value)))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F14] p-3 text-sm" />
                  </div>
                </div>
              )}

              {estimate ? (
                <div className="mt-4 rounded-2xl bg-[#0B0F14] p-4 ring-1 ring-white/10">
                  <div className="text-sm text-white/70">Szacunek dla {copies} szt. ({material})</div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <div className="text-white/60">Cena za sztukę</div><div className="text-right font-semibold">{estimate.perPiece.toFixed(2)} PLN</div>
                    <div className="text-white/60">Razem</div><div className="text-right font-semibold">{estimate.total.toFixed(2)} PLN</div>
                    <div className="text-white/60">Szac. czas druku</div><div className="text-right font-semibold">{timeH ? timeH.toFixed(2) : '-'} h</div>
                    <div className="text-white/60">Waga</div><div className="text-right font-semibold">{weightG?.toFixed(0)} g</div>
                  </div>
                  <div className="mt-3 text-xs text-white/60">Uwaga: auto-waga to szacunek (zależy od ustawień slicera). Najlepiej wpisać wagę i czas z Bambu Studio.</div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button onClick={addCurrentModelToCart} className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Dodaj model do koszyka</button>
                    <button className="rounded-xl bg-gradient-to-r from-[#36F3D6] to-[#00A3FF] px-4 py-2 text-sm font-semibold text-[#0B0F14]">Wyślij do wyceny</button>
                    <button onClick={goContact} className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10">Zadaj pytanie</button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/60">Wgraj plik STL, ustaw wagę/czas (lub użyj auto) i dodaj do koszyka.</div>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-6">
              <h3 className="text-xl font-semibold">Materiały</h3>
              <p className="mt-2 text-sm text-white/70">PLA, PETG, ABS (bez żywic). Cena wg wagi – prosto i uczciwie.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-6">
              <h3 className="text-xl font-semibold">AMS</h3>
              <p className="mt-2 text-sm text-white/70">Wielokolorowe wydruki dzięki AMS. Opcjonalna dopłata za dodatkowe kolory.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-6">
              <h3 className="text-xl font-semibold">Szybka realizacja</h3>
              <p className="mt-2 text-sm text-white/70">Najczęściej 1–3 dni robocze. Ostateczny termin potwierdzamy po akceptacji.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="showcase" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h2 className="text-2xl font-semibold">Gotowe wydruki</h2>
        <p className="mt-2 text-sm text-white/70">Przykładowe produkty dostępne od ręki. Integrację Stripe + koszyk podpinamy w implementacji.</p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => (
            <div key={p.id} className="group rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="aspect-square w-full rounded-2xl bg-[conic-gradient(at_70%_30%,rgba(54,243,214,0.2),rgba(0,163,255,0.15),transparent_60%)] ring-1 ring-white/10 transition group-hover:scale-[1.01]" />
              <div className="mt-3 flex items-start justify-between">
                <div>
                  <div className="text-sm text-white/80">{p.name}</div>
                  <div className="font-semibold">{p.price} PLN</div>
                </div>
                <button onClick={() => { cart.addProduct(p, 1); setCartOpen(true); }} className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/20">Do koszyka</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold">Kontakt</h2>
          <p className="mt-2 text-sm text-white/70">Jeśli wolisz formularz: przejdź do <a href="#/contact" className="underline">strony kontaktowej</a>.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div><div className="text-sm text-white/60">Formularz</div><a href="#/contact" className="font-semibold hover:underline">Napisz wiadomość</a></div>
            <div><div className="text-sm text-white/60">Telefon</div><a href="tel:+48123456789" className="font-semibold hover:underline">+48 123 456 789</a></div>
            <div><div className="text-sm text-white/60">Social</div><div className="font-semibold">Instagram • Facebook</div></div>
          </div>
          <p className="mt-4 text-sm text-white/60">Dane firmy i polityka prywatności dodamy przy wdrożeniu.</p>
        </div>
      </section>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/50">© {new Date().getFullYear()} Bewu3D. Wszelkie prawa zastrzeżone.</footer>
    </div>
  );
}
