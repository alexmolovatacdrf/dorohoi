# Dosare Dorohoi — continuation handoff

Last saved: 2026-07-15

Acest document păstrează punctul de continuare pentru următoarea sesiune. Contextul conversației nu trebuie reconstruit doar din memorie: starea de lucru, deciziile și pașii următori sunt consemnate aici și în istoricul Git.

## Starea Git

- Branch: `feature/public-presentation-map`
- HEAD: `f61e848` (`feat: add presentation-only deployment guard`)
- Worktree: clean after the implementation checkpoint; nu au fost folosite reset, clean,
  checkout/restore destructiv și nu au fost șterse date existente.
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
9. `fc7549a` — compact people sections, active camera states, place context and route lanes
10. `ca343ab` — separate reverse route lanes, compact family card and person search
11. `57c5249` — visible selected-person route list in Research Map context panel
12. `c807fae` — shared curved route geometry and family/person directory in both maps
13. `6d0e6c0` — visible disclosure triangles for family and mentioned-people lists
14. `85d8f4a` — compact family cards with count/arrow on the head row and internal record inside the expanded content
15. `fff2ec9` — person-place context summaries on map clicks and tighter left control spacing
16. `24893f1` — anchored concise person-place popup beside the clicked map point
17. `abf33c6` — source-bound map person stories and richer Claude fixture
18. `6aa9756` — map people popup actions, central story dialog and public legend
19. `95ad1c4` — person story and Vercel access documentation

## Server și URL-uri

Serverul Next rulează în prezent pe `127.0.0.1:3000`. Dacă nu mai rulează în sesiunea următoare:

```bash
npm run dev -- --hostname 127.0.0.1
```

URL-uri:

- Presentation Map cu datele proiectului: `http://127.0.0.1:3000/presentation/map?dataset=project`
- Presentation Map cu fixture-ul derivat din Claude: `http://127.0.0.1:3000/presentation/map?dataset=claude-demo`
- Research Map: `http://127.0.0.1:3000/map`

Vercel Production după ultimul deploy:

- protected unique deployment: `https://dosare-dorohoi-platform-chatgpt-kgytv82kx.vercel.app`
- Presentation Map project: `https://dosare-dorohoi-platform-chatgpt-kgytv82kx.vercel.app/presentation/map?dataset=project`
- Presentation Map Claude: `https://dosare-dorohoi-platform-chatgpt-kgytv82kx.vercel.app/presentation/map?dataset=claude-demo`
- Research Map Claude: `https://dosare-dorohoi-platform-chatgpt-kgytv82kx.vercel.app/map?dataset=claude-demo`

Separate gradual-review deployment for Eugenia:

- Vercel project: `dosare-dorohoi-presentation`
- protected unique URL: `https://dosare-dorohoi-presentation-pr504kmki.vercel.app/presentation/map?dataset=project`
- Claude demo variant on the same protected deployment: `https://dosare-dorohoi-presentation-pr504kmki.vercel.app/presentation/map?dataset=claude-demo`
- stable alias (do not share as the private link on Hobby): `https://dosare-dorohoi-presentation.vercel.app`

The separate project has `PRESENTATION_ONLY=true` and Vercel Authentication
for production deployment URLs and previews. Its `/`, `/map`, `/persons`,
`/documents` and `/review` requests redirect to Presentation Map; only the
Presentation Map, Next static assets and full-Europe historical assets are
allowed through the request proxy.

Deployment Protection is Vercel Authentication. Without a Vercel session the
unique deployment returns a redirect to Vercel SSO; the stable project alias is
not the private review link on the Hobby plan.

## Ce este implementat acum

- `/map` rămâne Research Map-ul avansat, cu dataset-ul regional și funcționalitățile de cercetare.
- `/presentation/map` este experiența publică simplificată și folosește dataset-ul istoric full Europe.
- Presentation Map are panou de setări în stânga și panou separat pentru persoane/familii în dreapta.
- Panoul din stânga păstrează setările de vizualizare: view Europe/Project region, luna, layere, opacitatea stratului istoric, legendă, reset, fullscreen și ascunderea interfeței.
- Panoul din dreapta afișează familiile/dosarele, capul familiei/declarantul primul și persoanele menționate sub acesta. Fiecare persoană este selectabilă separat.
- Numărul dosarului este afișat discret ca identificator intern, nu ca titlu principal.
- Modelul păstrează posibilitatea ca aceeași persoană să fie legată ulterior de mai multe dosare; nu se deduce automat identitatea sau traseul rudelor.
- La selectarea unei persoane, camera se potrivește pe toate punctele și segmentele documentate pentru acea persoană.
- Europe View folosește fereastra practică `[longitude -11.0..62.5, latitude 35.0..72.0]`, din Portugalia până în zona Ekaterinburg/Perm; datele istorice din sursă rămân complete.
- Închiderea sau deschiderea panourilor nu mai reface fit-ul și nu mai resetează zoom-ul ales manual. Fit-ul unei persoane rezervă spațiu sigur pentru panouri și timeline.
- Animația traseului este manuală, o singură dată, lentă și progresivă, cu segmente Bézier/curbe și marker de progres; nu pornește automat și nu se repetă.
- Controlul tip busolă/săgeată de orientare a fost eliminat.
- Popup-ul istoric nu mai apare la hover. Apare doar la click normal sau click dreapta și poate fi închis.
- Opacitatea istorică are control separat, cu valoare implicită redusă pentru a păstra lizibile orașele, râurile și basemap-ul.
- Footer-ul este ascuns pe paginile de hartă, astfel încât să nu ocupe permanent spațiu din viewport.
- Fixture-ul Claude este comutat prin `?dataset=claude-demo`; nu este amestecat în `data/normalized/`.
- Tab-ul activ al dataset-ului este acum corelat corect cu URL-ul; `?dataset=project` afișează clar Project data.
- Europe view, Project region și Selected story au stare vizuală explicită, iar panoul arată eticheta „Active view”.
- Zoom-ul este mutat în afara panoului drept pe desktop și deasupra timeline-ului pe mobil.
- Lista familiei afișează capul/declarantul o singură dată; persoanele menționate sunt într-un `<details>` închis implicit.
- Antetul sticky al ambelor panouri păstrează butonul de închidere accesibil în timpul scroll-ului.
- Traseele inverse/repetate între aceleași localități primesc benzi vizuale diferite. Animația are acum 4,6 secunde per segment.
- Pentru o listă mare, panoul drept are căutare după nume de persoană sau familie; secțiunile menționate rămân închise până la deschidere.
- Click pe o localitate poate afișa persoanele asociate, grupate după contextul explicit documentat; în timpul animației este afișat locul curent și nota traseului.
- Când o persoană este selectată, click pe un punct/localitate arată în panoul de detalii conexiunile persoană-loc documentate: categorie publică, data disponibilă, descriere, rolul sursă și sursa. Capetele de rută sunt marcate ca atare și nu sunt transformate în evenimente.
- Același rezumat apare acum și într-un popup MapLibre ancorat lângă punctul apăsat; panoul lateral rămâne versiunea extinsă. Popup-ul include categoria, persoana, data și descrierea concisă, iar butonul nativ îl poate închide.
- Panoul stâng al ambelor hărți păstrează aceleași controale și ținte accesibile, dar are spațiere verticală mai compactă pentru a reduce scroll-ul.
- În Research Map, persoanele se selectează în `Filters → Person` sau `Filters → Group` din panoul stâng. Traseele apar când `Layers → People and movement → Individual routes` rămâne activ; click pe un traseu deschide detaliile în panoul `Context` din dreapta.
- După selectarea unei persoane în Research Map, panoul `Context` din dreapta afișează acum numele persoanei, numărul de segmente și lista traseelor selectabile; un click pe un segment deschide detaliile sale de proveniență.
- Research Map folosește acum aceeași geometrie de prezentare pentru trasee ca Presentation Map: curbe Bézier, săgeți direcționale și benzi separate pentru mișcări inverse sau repetate între aceleași localități.
- Panoul `Context` din Research Map include acum directorul comun `Families and mentioned people`, cu căutare și secțiuni dropdown pentru persoanele menționate. Capul/declarantul nu este repetat în lista de membri.
- Listele de persoane, familii și secțiunile aferente folosesc acum spațiere compactă în ambele moduri de hartă, cu rânduri mai scurte și mai puțin spațiu lateral.
- Directorul `Families and mentioned people` este acum el însuși un dropdown vizibil în ambele hărți: triunghiul `▸` închide lista, iar `▾` o extinde. Listele interne ale persoanelor menționate folosesc aceeași convenție.
- Cardul fiecărei familii nu mai repetă rândul `People mentioned in this dossier`. Numărul și triunghiul sunt pe rândul capului/declarantului; la extindere apar numele individuale și linia `Internal record`. Cardul de detalii al persoanei selectate folosește aceeași structură compactă.
- Datele afișate în hartă folosesc `formatIsoDate`, `formatDateRange` și
  `formatYearMonth` cu limba activă: engleză în `en-GB`, română în `ro-RO`.
- Un al doilea click pe aceeași localitate, rută sau zonă istorică elimină
  selecția și caseta sintetică; butonul nativ de închidere al popup-ului rămâne
  disponibil.
- Research Map acceptă acum `?dataset=claude-demo`, păstrând `/map` fără
  parametri pe datele normalizate ale proiectului.
- Animația comună are 4,6 secunde pe segment și este activă în ambele moduri;
  Research Map folosește aceeași curbă, săgeată și bilă de progres ca
  Presentation Map.
- Layerul EHRI/More Layers nu mai este ascuns când este selectată o persoană;
  rămâne independent de filtrul persoană și apare când este bifat.
- Claude Demo include acum overlay-ul EHRI local cu 385 de înregistrări, fără asocieri inventate cu persoanele Claude.
- Dropdown-urile familiilor sunt controlate exclusiv prin săgeată. Click pe
  capul unei alte familii închide lista precedentă fără să o deschidă pe cea
  nouă.
- Workspace-ul desktop rezervă spațiu pentru Story timeline, iar la pornirea
  playback-ului camera adaugă padding inferior pentru ca localitatea-destinație
  și săgeata să nu fie acoperite de bara de jos.

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

Conținut derivat: 48 persoane, 11 dosare, 15 locuri Claude și 26 trasee; 9 persoane au trasee documentate. În hartă se adaugă separat overlay-ul EHRI cu 385 de înregistrări. Referințele interne de dosar Claude sunt normalizate de adaptor astfel încât persoanele să apară sub familia/dosarul corect.

Regenerarea fixture-ului, doar dacă sursa este prezentă și după o verificare atentă:

```bash
node scripts/presentation/derive-claude-demo-map.mjs > data/demo/claude-map-demo.json
```

## Verificări deja trecute

- `npm test` — 31 teste în 5 fișiere
- `npm run typecheck` — trecut
- `npm run lint` — trecut
- `npm run build` — trecut după ultimele modificări
- `npm audit --json` — fără vulnerabilități raportate în verificarea anterioară

După adăugarea modelului Person story și a testelor pentru fixture-ul Claude:

- `npm test` — 33 teste în 5 fișiere
- `npm run typecheck` — trecut
- `npm run lint` — trecut
- `npm run build` — trecut
- `npm run normalize` — trecut, fără modificări în `data/normalized/`

Fișa centrală a persoanei este acum implementată în ambele moduri. Popup-ul
unei localități listează persoanele asociate și deschide această fișă la click
pe nume. Fixture-ul Claude păstrează profilul și cronologia din
`Platforma_WJC (10).html`; câmpurile goale nu sunt completate artificial. În
panoul din dreapta al Presentation Map se află și legenda publică compactă.
Playwright nu a putut porni în mediul ultimei sesiuni deoarece Chrome/Chromium
nu este instalat; build-ul și verificarea HTTP locală au trecut.

Verificarea curentă suplimentară:

- `curl -I http://127.0.0.1:3000/presentation/map?dataset=claude-demo` — HTTP 200
- `curl -I http://127.0.0.1:3000/map?dataset=claude-demo` — HTTP 200
- `npm audit --json` — 0 vulnerabilități

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
9. În `/map`, verifică și directorul din `Context`: deschide/închide secțiunile cu săgeata nativă, selectează un cap de familie și o persoană menționată, apoi confirmă că ruta selectată rămâne individuală și apare în lista de trasee.
10. În ambele hărți, verifică formatul datelor după schimbarea EN/RO și al doilea click pe aceeași localitate pentru închiderea casetei.

## Lucru rămas / atenționări

- Mai trebuie făcută verificarea vizuală completă în browser după ultimele modificări de panou și interacțiuni. Playwright este instalat ca CLI, dar mediul actual nu are Chrome/Chromium disponibil (`/opt/google/chrome/chrome`); instalarea automată a Chrome a eșuat deoarece cere sudo.
- Trebuie salvate/confirmate screenshot-urile finale pentru Presentation Map Europe view, persoană selectată, interfață ascunsă, Research Map și mobil.
- Trebuie confirmat în browser că toate layerele Presentation Map și Research Map (basemap, persoane, trasee, locuri, EHRI și unresolved) se afișează corect cu ambele surse de date.
- Trebuie verificat vizual un caz real cu două mișcări inverse între aceleași localități pentru a confirma că benzile nu se suprapun în MapLibre.
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
