# Dosare Dorohoi V1 data model

## 1. Modeling principles

The individual person is the central entity. A household, family relationship,
dossier or map layer supplies context, but never substitutes for an individual's
evidence trail.

The model distinguishes three levels:

1. **Documentary input** — immutable analytical extracts and external catalog
   records in `data/source/`, with raw wording preserved.
2. **Normalized analytical records** — explicit, partial, inferred or unresolved
   assertions generated into `data/normalized/`.
3. **View models** — joins and labels created at runtime for tables, detail pages
   and MapLibre; these are not new historical assertions.

## 2. Common evidence envelope

Every record in every generated collection implements this conceptual envelope:

```ts
type Confidence = "high" | "medium" | "low" | "unknown";
type ReviewState = "not_required" | "needs_review" | "in_review" | "resolved";
type AssertionStatus = "explicit" | "partial" | "inferred" | "unresolved";

interface SourceReference {
  sourceFile: string;
  sourceDataset: "dossier" | "ehri_local" | "curated_gazetteer";
  documentId: string | null;
  dossierId: string | null;
  pagePdf: number | null;
  pagePrinted: number | string | null;
  field: string | null;
  sourceRecordId: string | null;
  fragmentRaw: string | null;
}

interface AlternativeReading {
  value: unknown;
  note: string | null;
  confidence: Confidence;
  sourceRefs: SourceReference[];
}

interface EvidenceEnvelope<TRaw, TNormalized> {
  id: string;
  dossierId: string | null;
  sourceRefs: SourceReference[];
  raw: TRaw;
  normalized: TNormalized;
  confidence: Confidence;
  assertionStatus: AssertionStatus;
  reviewState: ReviewState;
  alternativeReadings: AlternativeReading[];
}
```

`null` means “not supplied/not applicable,” never “known to be absent.” A source
page or rubric is retained whenever the input provides it. EHRI records have a
source-record index instead of a dossier page. Curated coordinates have a named
external coordinate source and access note.

## 3. Core entities

### 3.1 Person (`persons.json`)

A person is a research identity, not just a string mention.

Key normalized fields:

- stable `personId` (the supplied `persoana_id` in the pilot);
- display, given and family names;
- normalized sex where supplied;
- birth date interval and precision;
- birth-place mention link;
- civil status as raw and cautiously normalized text;
- roles in each document;
- linked name variants, events, relationships, household and documents.

The four pilot identities remain four separate people. No cross-dossier merge is
performed. Candidate duplicates belong in review tasks/entity-match evidence,
not in destructive normalization.

### 3.2 Person name variant (`personNameVariants.json`)

A variant links a raw or alternative written name to exactly one current person
identity. It records variant type (`documentary`, `alternative_reading`,
`search_form`), script/language when known and provenance.

`Marica Chibac` is the primary documentary reading. `Marica Aizic` is retained
as an alternative reading with medium confidence; it does not replace the
primary value.

### 3.3 Mention

A mention is the occurrence of an entity-like value in a source field. Mentions
are important because resolution may change without changing transcription.

V1 materializes geographic mentions in `placeMentions.json`; person/name
occurrences are represented through person provenance and name variants. A
future `mentions.json` can generalize the same pattern without changing IDs.

### 3.4 Relationship (`relationships.json`)

A relationship is a directed or symmetric assertion between two people. Fields
include relationship type, participant roles, valid-time fields if ever supplied
and source evidence.

- Iancu Aizic–Marica Chibac is a symmetric spouse relationship at medium
  confidence and needs review.
- Pesi Aizic–Iancu Aizic is a directed mother/son relationship at high
  confidence.

A relationship never causes event, place or route inheritance.

### 3.5 Household (`households.json`)

A household is a source-supported grouping and may contain membership records or
member identifiers with their evidence. It is not synonymous with a surname or
all dossier participants.

Dossier 2560 explicitly supplies a one-person household headed by Ițic Herțanu.
Dossier 2590 does not supply an explicit household object in the current
analytical JSON, so V1 does not manufacture one. Its family context is available
through the documented relationships.

### 3.6 Document (`documents.json`)

A document describes a documentary unit: identifier, dossier, filename, type,
page count, extraction version/status, media availability and future viewer
metadata. The two WJC dossiers are documentary records. The EHRI file is tracked
as a dataset source for place provenance, not presented as a dossier scan.

The supplied analytical-model template guides normalization but is not a
historical document.

### 3.7 Event (`events.json`)

An event is a historically meaningful occurrence tied only to explicitly named
participants. It contains:

- event type and localized display labels;
- raw date/interval fields;
- normalized start/end dates and date precision when defensible;
- participant IDs;
- linked place-mention IDs, never merely guessed place IDs;
- raw description, transport, duration, cause, authority, amount or institution
  fields as applicable; and
- the common evidence envelope.

Unparseable or relative dates such as “după evacuarea din 1941” remain visible
with null normalized bounds. Shorthand dates may be normalized only when the
reading is unambiguous and the raw value remains beside it.

Pesi Aizic's 8 February 1942 death at Moghilev is its own event with Pesi as the
sole participant.

### 3.8 Place (`places.json`)

A place is a gazetteer identity or an explicitly unresolved placeholder. It
contains:

- original/source name;
- normalized name;
- English and Romanian display names;
- all supplied or registered variants;
- place type (`settlement`, `river`, `camp`, `ghetto`, `region`,
  `institution`, `unresolved`, etc.);
- longitude/latitude or `null`;
- coordinate source, confidence and access note;
- resolution status (`resolved`, `partially_resolved`, `unresolved`);
- dataset/layer membership such as `core` or `ehri_local`; and
- provenance/review envelope.

Core dossier places are resolved only through an explicit gazetteer registry.
The EHRI overlay is imported record-for-record with stable IDs. Coincident
coordinates or similar names do not trigger automatic merging.

Special cases:

- `Ataki` resolves to the Otaci identity and both names remain variants;
- `Moghilev` resolves to the current Mohyliv-Podilskyi identity, but the public
  historical map label remains `Moghilev`; the modern name is retained in
  `normalizedName` and search variants. The EHRI Moghilev ghetto record remains
  a separately provenance-bearing overlay feature linked as a possible catalog
  representation rather than silently replacing the settlement;
- `Tropov[...]` has no coordinates and resolution status `unresolved`;
- `Jijia` is resolved only to the river concept; the work-site/bridge position
  remains unknown;
- `Transnistria` is a historical region mention and not a route point;
- `Banca Națională a României` is an institution mention and not a geographic
  route stop.

### 3.9 Place mention (`placeMentions.json`)

A place mention preserves a raw geographic or institution-like value in its
source context. Fields include owner kind/ID (person, event, document), role,
raw value, resolved place ID or `null`, resolution method and status.

The existence of a place mention never creates a route segment. This is the
central safeguard against turning lists, birthplaces, death places or contextual
geography into travel itineraries.

### 3.10 Route segment (`routeSegments.json`)

A route segment is a person-specific movement assertion with ordered origin and
destination place IDs, date range, transport, route status and provenance.

Route status is one of:

- `explicit`: origin and destination movement are directly stated;
- `partial`: endpoints/order are supported but intervening movement or exact
  path is incomplete;
- `inferred`: an analytical hypothesis, visually distinct and disabled by
  default; or
- `unresolved`: movement is asserted but an endpoint cannot be identified.

V1 pilot segments:

| Person | Segment | Status | Notes |
| --- | --- | --- | --- |
| Ițic Herțanu | Mihăileni → Bucecea, 19 June 1941, on foot | explicit | Direct source fields |
| Ițic Herțanu | Bucecea → Dorohoi, 4 July 1941 | explicit, needs review | The supplied fragment says Burdujeni; both readings remain visible |
| Iancu Aizic | Dorohoi → Ataki/Otaci | partial | Origin and frontier presence are documented; exact path/date is not |
| Iancu Aizic | Ataki/Otaci → Moghilev | partial | Frontier presence and destination are documented; exact path/date is not |

There is no Moghilev → `Tropov[...]` segment. Pesi and Marica receive no route
segments from Iancu's evidence.

### 3.11 Review task (`reviewTasks.json`)

A review task is a non-destructive queue item. It has category, title,
description, severity, status, entity links, evidence and suggested next action.
Categories include:

- unresolved place;
- uncertain reading;
- incomplete route;
- possible duplicate person;
- questionable relationship;
- contradiction;
- source collation;
- external catalog quality.

The UI always renders all required categories, including a zero state when no
possible duplicate has been generated.

## 4. Derived collection contract

The importer writes exactly these required files, each containing a sorted JSON
array:

```text
persons.json
personNameVariants.json
households.json
relationships.json
documents.json
events.json
places.json
placeMentions.json
routeSegments.json
reviewTasks.json
```

IDs are stable, source-derived and human-auditable. Dossier IDs retain the
supplied `DOROHOI-####` form. EHRI IDs use a zero-padded source index so duplicate
labels do not collapse. Generated timestamps are forbidden because they would
break deterministic output.

## 5. Provenance rules

1. Preserve the complete relevant source object in `raw` where practical.
2. Preserve raw date, name, place, role and descriptive wording even when a
   normalized equivalent exists.
3. Store every available PDF page, printed page, rubric and quoted fragment.
4. Make a normalization decision visible through `normalized`, confidence,
   assertion status and review state.
5. Store alternative readings as structured alternatives, not slash-separated
   display text.
6. Never overwrite a source value in place.
7. Never claim scan-level verification when only an analytical extraction is
   present.

## 6. Confidence and review

Confidence describes evidential strength for the specific record. Review state
describes workflow. They are independent: a high-confidence event can still
need source collation, and a medium-confidence relationship can remain open.

Resolution is also independent. A transcription can be high confidence while
its geographic identity is unresolved.

## 7. Date normalization

Dates use inclusive ISO 8601 bounds:

- day precision: start and end are the same date;
- month precision: first through last day of month;
- year precision: 1 January through 31 December;
- explicit intervals: normalized start/end with the source precision retained;
- relative, ambiguous or uncertain notation: raw value retained and bounds left
  null unless a defensible partial bound exists.

The UI must show the raw value beside any normalized display on provenance/detail
views.

## 8. Importing future dossiers

Each adapter returns the same collection fragments and uses the common envelope.
Adapters must be additive: unfamiliar source fields are retained, missing fields
become null, and pages do not depend on a dossier's bespoke JSON keys.

Cross-dossier matching produces candidates only. A reviewed merge, when later
implemented, must keep both source IDs and an auditable decision record.

## 9. Historical administration snapshot model

Historical polygons are derived geographic context, not dossier events and not
substitutes for person-centred evidence. They remain outside the ten core
normalized collections.

The committed manifest defines 88 ordered snapshots. Each snapshot record has
`yearMonth`, exact supplied `snapshotDate`, evidence `status`, relative file and
URL, byte count, SHA-256, source record count and regional feature count.
`status` is `primary` through September 1944 and `limited_static` thereafter.

Each monthly feature has a stable ID based on year-month and source record
index, polygon or multipolygon geometry in `EPSG:4326`, and these properties:

- `Name`, `Foreign_Po`, `Head_of_St`, `Govt_in_Ex`: unchanged raw DBF strings;
- `snapshotDate` and `yearMonth`: temporal identity without changing supplied
  dates;
- `sourceFeatureIndex`: link back to deterministic source record order;
- `foreignPowerCategory`: controlled display value derived by exact lookup of
  `Foreign_Po`;
- `editorialFlagIds`: references into the separate editorial record file.

There is deliberately no civil/military administration field. Empty strings
and literal `<Null>` remain distinct. Editorial records never overwrite these
properties.

The regional `Territorial_Changes` derivative retains all source DBF fields as
serializable raw values, adds an ISO `changeDate`, and retains
`sourceFeatureIndex`. It supports source validation and research inspection; it
does not replace the monthly snapshots rendered in the map.

The source manifest, derived manifest, checksum list and separate editorial
records form the provenance envelope. A valid browser snapshot must match its
manifest byte count and hash in repository tests, use only coordinates inside
the documented crop, and contain all four required raw monthly attributes.
