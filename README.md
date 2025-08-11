# Bewu3D – MVP v3

## Szybki start (lokalnie)
```bash
npm install
npm run dev
# http://localhost:5173
```

## Netlify (deploy)
- Build command: `npm run build`
- Publish: `dist`
- Functions: `netlify/functions`
- ENV: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `CONTACT_TO`

## Wycena
- Cena = waga × **150 PLN/kg** (edytuj `MATERIAL_RATE_PLN_PER_KG` w `src/App.tsx`).
- Auto-waga z STL (objętość × gęstość × współczynnik zużycia) – najlepiej nadpisać wagę i czas z Bambu Studio.

