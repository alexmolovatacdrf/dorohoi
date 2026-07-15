# Dosare Dorohoi — continuation handoff

Last saved: 2026-07-15

Acest document păstrează punctul de continuare pentru următoarea sesiune. Contextul conversației nu trebuie reconstruit doar din memorie: starea de lucru, deciziile și pașii următori sunt consemnate aici și în istoricul Git.

## Starea Git

- Branch: `feature/public-presentation-map`
- HEAD: `98007da fix: clarify person dossiers and map interactions`
- Worktree: curat la momentul salvării
- Nu au fost folosite reset, clean, checkout/restore destructiv și nu au fost șterse date existente.

Checkpoint-urile relevante, în ordine:

1. `9430b14` — full-extent historical administration dataset
2. `fb0f146` — public Presentation Map
3. `3494518` — historical datasets and Presentation Map documentation
4. `4f3d92d` — final map verification notes
5. `6996dad` — public Presentation Map refinements
6. `c999822` — Claude demo dataset switch
7. `29733a4` — separate Presentation Map people controls
8. `98007da` — family/person panel and map interaction fixes

## Server și URL-uri

Serverul Next rulează în prezent pe `127.0.0.1:3000`. Dacă nu mai rulează în sesiunea următoare:

```bash
npm run dev -- --hostname 127.0.0.1
```

URL-uri:

- Presentation Map cu datele proiectului: `http://127.0.0.1:3000/presentation/map?dataset=project`
- Presentation Map cu fixture-ul derivat din Claude: `http://127.0.0.1:3000/presentation/map?dataset=claude-demo`
- Research Map: `http://127.0.0.1:3000/map`

## Ce este implementat acum

- `/map` rămâne Research Map-ul avansat, cu dataset-ul regional și funcționalitățile de cercetare.
- `/presentation/map` este experiența publică simplificată și folosește dataset-ul istoric full Europe.
- Presentation Map are panou de setări în stânga și panou separat pentru persoane/familii în dreapta.
- Panoul din stânga păstrează setările de vizualizare: view Europe/Project region, luna, layere, opacitatea stratului istoric, legendă, reset, fullscreen și ascunderea interfeței.
- Panoul din dreapta afișează familiile/dosarele, capul familiei/declarantul primul și persoanele menționate sub acesta. Fiecare persoană este selectabilă separat.
- Numărul dosarului este afișat discret ca identificator intern, nu ca titlu principal.
- Modelul păstrează posibilitatea ca aceeași persoană să fie legată ulterior de mai multe dosare; nu se deduce automat identitatea sau traseul rudelor.
- La selectarea unei persoane, camera se potrivește pe toate punctele și segmentele documentate pentru acea persoană.
- Animația traseului este manuală, o singură dată, lentă și progresivă, cu segmente Bézier/curbe și marker de progres; nu pornește automat și nu se repetă.
- Controlul tip busolă/săgeată de orientare a fost eliminat.
- Popup-ul istoric nu mai apare la hover. Apare doar la click normal sau click dreapta și poate fi închis.
- Opacitatea istorică are control separat, cu valoare implicită redusă pentru a păstra lizibile orașele, râurile și basemap-ul.
- Footer-ul este ascuns pe paginile de hartă, astfel încât să nu ocupe permanent spațiu din viewport.
- Fixture-ul Claude este comutat prin `?dataset=claude-demo`; nu este amestecat în `data/normalized/`.

## Datele din varianta Claude

Sursa locală folosită:

`/mnt/c/Users/Alex Molovata/Downloads/Platforma_WJC (10).html`

SHA-256-ul sursei la import:

`2dd8b2facb3e4ae2b214736d85d3dfd3449d73d942a1a49f8fbf3b0409273522`

Fixture-ul rezultat este în:

- `data/demo/claude-map-demo.json`
- adaptorul: `lib/data/claude-demo.ts`
- testele: `tests/claude-demo.test.ts`
- scriptul reproducibil: `scripts/presentation/derive-claude-demo-map.mjs`

Conținut derivat: 48 persoane, 11 dosare, 15 locuri și 26 trasee; 9 persoane au trasee documentate. Referințele interne de dosar Claude sunt normalizate de adaptor astfel încât persoanele să apară sub familia/dosarul corect.

Regenerarea fixture-ului, doar dacă sursa este prezentă și după o verificare atentă:

```bash
node scripts/presentation/derive-claude-demo-map.mjs > data/demo/claude-map-demo.json
```

## Verificări deja trecute

- `npm test` — 29 teste în 4 fișiere
- `npm run typecheck` — trecut
- `npm run lint` — trecut
- `npm run build` — trecut în verificarea anterioară
- `npm audit --json` — fără vulnerabilități raportate în verificarea anterioară

După orice modificare nouă, prima verificare trebuie să fie:

```bash
git status --short --branch
npm test
npm run typecheck
npm run lint
```

Observație: `npm run build` poate rescrie automat importul din `next-env.d.ts` de la `./.next/dev/types/routes.d.ts` la `./.next/types/routes.d.ts`. Dacă se întâmplă, păstrează importul de dezvoltare folosit de proiect și verifică din nou `git diff`.

## Primii pași pentru următoarea sesiune

1. Verifică `git status`, HEAD și serverul local.
2. Deschide ambele dataset-uri din URL-urile de mai sus.
3. În Claude demo, extinde prima familie, selectează `Goldemberg Roza` sau `Hoisie Bercu`, verifică traseul din panoul drept și apasă `Play route`.
4. Confirmă vizual că traseul este desenat progresiv, lent, o singură dată și că markerul de progres se deplasează.
5. Verifică click și click dreapta pe un poligon istoric; popup-ul nu trebuie să apară la simpla trecere a mausului.
6. Verifică lunile înainte de apariția Transnistriei, august 1941, martie 1944 și aprilie 1944.
7. Verifică layout-ul la 1366×768, 1920×1080 și 390×844: panoul stâng nu trebuie să se suprapună cu elemente de hartă, panoul drept trebuie să rămână utilizabil, iar footer-ul nu trebuie să apară.
8. Verifică în continuare `/map`: filtrele avansate, layer-ul regional și informațiile de proveniență trebuie să rămână funcționale.

## Lucru rămas / atenționări

- Mai trebuie făcută verificarea vizuală completă în browser după ultimele modificări de panou și interacțiuni.
- Trebuie salvate/confirmate screenshot-urile finale pentru Presentation Map Europe view, persoană selectată, interfață ascunsă, Research Map și mobil.
- Trebuie confirmat în browser că toate layerele Presentation Map (basemap, persoane, trasee, locuri, EHRI și unresolved) se afișează corect cu ambele surse de date.
- Integrarea viitoare a unei persoane menționate în mai multe dosare trebuie să folosească un identificator stabil și legături documentate între apariții/dosare; nu trebuie făcută deduplicare automată pe nume.
- Orice optimizare a dataset-ului istoric full trebuie validată înainte de înlocuirea celor 91 de fișiere existente.

## Fișiere-cheie

- `components/map/map-workspace.tsx` — modurile Research/Presentation, selecția persoanelor, layerele, popup-ul și animația
- `app/globals.css` — layout, panouri, tipografie și ascunderea footer-ului pe hărți
- `lib/historical-administration/schemas.ts` — contractul regional/full
- `scripts/historical-administration/preprocess.py` — pipeline-ul full historical data
- `public/data/historical-administration-full/` — dataset full Europe, 91 fișiere, aproximativ 115 MB
- `docs/PRESENTATION_MAP.md` — documentația Presentation Map
- `docs/HISTORICAL_ADMINISTRATION.md` — documentația dataset-ului istoric
- `docs/STATUS.md` — statusul proiectului

