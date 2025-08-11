# Bewu3D – MVP v7 (cart aggregation)

## Lokalne uruchomienie
```bash
npm install
npm run dev
# http://localhost:5173
```

## Netlify (deploy)
- Build: `npm run build`
- Publish: `dist`
- Functions: `netlify/functions`
- ENV: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `CONTACT_TO`

## Funkcje
- Wycenia wg wagi (150 PLN/kg), bez edycji parametrów przez użytkownika.
- Dopłata AMS (5 PLN za kolor >1), minimalne zamówienie 30 PLN **na poziomie koszyka**.
- „Wyślij do wyceny” wysyła cały koszyk, miniatury i załączniki STL (≤5 MB/plik).
- Kontakt i wycena przez Netlify Functions (nodemailer).
