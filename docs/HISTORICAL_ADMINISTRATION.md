# European Borders WWII — regional and full historical administration layers

## Scope and source custody

The optional Historical administration layer is derived from
`EuropeanBorders_WWII.zip`, observed at:

```text
/mnt/c/Users/Alex Molovata/Downloads/EuropeanBorders_WWII.zip
```

The committed source manifest is
`data/manifests/european-borders-wwii.source.json`; the separate checksum file
is `data/manifests/EuropeanBorders_WWII.zip.sha256`. The archive is 278,902,121
bytes (520,838,193 bytes unpacked) and has SHA-256:

```text
4f934928531a57dc9e84d3a087cd21643f1232af011a4949621bcc53e099f4ea
```

Neither the archive nor its approximately 500 MB extracted tree belongs in
Git. The deterministic processor extracts to the ignored directory
`external-data/european-borders-wwii/raw/`. Compact browser derivatives are
committed under `public/data/historical-administration/` so the project layer
does not depend on a remote GIS service.

## Source inventory

The archive supplies 88 monthly polygon shapefiles from February 1938 through
May 1945 and one `Territorial_Changes` polygon layer with 81 records. Every
monthly DBF has the same six-field schema. The four historical attributes
preserved verbatim in each browser feature are:

- `Name`;
- `Foreign_Po`;
- `Head_of_St`;
- `Govt_in_Ex`.

The source does not contain a dedicated civil/military administration-type
field. The UI therefore does not create one. `foreignPowerCategory` is only a
documented display vocabulary produced by an exact lookup of the unchanged
`Foreign_Po` string. Unknown strings stop the conversion instead of falling
through to an invented category. The complete raw-to-display mapping is stored
in the derived manifest.

`Territorial_Changes` has no SHX index in the archive. It is read sequentially,
and its DBF attributes are retained in the regional derivative. This missing
component is a source condition, not repaired in the raw archive.

## Projection and deterministic processing

The shapefiles declare Europe Albers Equal Area Conic / European 1950,
`ESRI:102013`. The exact WKT is retained in the source manifest. The processor
uses the best non-ballpark PROJ operation available in the pinned environment:
inverse Europe Albers, ED50 to WGS 84 (1), then longitude/latitude axis order.
PROJ reports a 10-metre transformation accuracy. Derived GeoJSON is
`EPSG:4326` in longitude, latitude order.

The regional research window is `[19.0, 43.3, 34.5, 52.6]`. It covers Romania,
Moldova, the historical Transnistria area, western Ukraine and the Southern Bug
region. This rectangle is a processing extent, not a historical boundary
claim. The pipeline:

1. verifies archive byte size, entry count, CRC and SHA-256;
2. safely extracts to the ignored external-data directory;
3. validates the complete month sequence, supplied filename dates, projection,
   DBF schema and exact raw categorical vocabulary;
4. checks source assertions before conversion;
5. crops first in the source projection, reprojects to `EPSG:4326`, applies the
   exact geographic crop and simplifies with a topology-preserving 0.005-degree
   tolerance;
6. rounds coordinates to five decimal places and writes stable-key, compact
   GeoJSON with no generated timestamps;
7. records source and derived geometry validity issues and any `make_valid`
   operation rather than silently repairing them;
8. writes one file per year-month, a date/file manifest, a regional
   `Territorial_Changes` derivative and SHA-256 checksums for every output.

The source files remain unchanged. Browser code fetches the manifest and only
the currently selected monthly GeoJSON; it does not load all 88 snapshots.

## Reproduction

Python 3.12 was used with the exact dependencies in
`scripts/historical-administration/requirements.lock.txt`.

```bash
python3 -m venv external-data/european-borders-wwii/.venv
external-data/european-borders-wwii/.venv/bin/pip install -r scripts/historical-administration/requirements.lock.txt
external-data/european-borders-wwii/.venv/bin/python scripts/historical-administration/preprocess.py
external-data/european-borders-wwii/.venv/bin/python scripts/historical-administration/preprocess.py --verify-output
```

Use `--archive /path/to/EuropeanBorders_WWII.zip` when the observed Windows
path is unavailable. A second full run must produce the same `derived.sha256`.

## Temporal interpretation

February 1938 through September 1944 is the primary supported interval.
October 1944 through May 1945 is marked `limited_static`, not treated as
equivalent evidence. The source project reports missing frontline data;
October 1944 through April 1945 reuse the September 1944 shapefile geometry
byte-for-byte, while May 1945 changes but remains subject to the same source
limitation.

The selector uses year-month because the source intends monthly snapshots, but
the supplied date remains visible. August 1938 and August 1939 are dated the
30th, and leap-year February 1940 and February 1944 are dated the 28th. These
filenames are preserved rather than silently changed to calendar month-end.

## Verified historical distinctions

The preprocessing assertions and automated application tests verify:

- Transnistria is a separate feature by August 1941, with raw
  `Foreign_Po = Romanian-occupied` and
  `Head_of_St = Gheorghe Alexianu (Governor)`;
- Reichskommissariat Ukraine is separately present from September 1941, with
  raw `Foreign_Po = German-occupied` and
  `Head_of_St = Erich Koch (Reichskommissar)`;
- Transnistria appears from August 1941 through March 1944 and is absent from
  the April 1944 snapshot onward;
- `Territorial_Changes` contains the Transnistria changes dated 19 August 1941
  and 1 April 1944.

These checks distinguish raw features; they do not infer an administration
type beyond the supplied attributes.

## Anomalies and editorial corrections

The archive's October 1941 record for Italy has raw `Foreign_Po = Allies`. It
remains unchanged and is linked to a flagged editorial record in
`data/editorial/historical-administration.json`. No replacement is asserted
without external evidence and review provenance.

`Head_of_St` sometimes identifies a governor, prime minister, occupying force
or de facto ruler rather than a constitutional head of state. The UI labels it
as the raw source field and displays a methodological caution. The source also
contains both `Reichkommissariat Ostland` and `Reichskommissariat Ostland`,
literal `<Null>` as well as empty values, and multiple invalid/self-intersecting
source rings. All are preserved or reported rather than silently standardized.

Future editorial corrections must remain separate from the derivative and
include evidence, author, review date and status. Raw values must continue to
be available beside any accepted correction.

## Attribution, use limit and warning

Display attribution:

> European Borders during World War II (Stanford Spatial History Lab / Holocaust Geographies Project; Michael De Groot and Erik Steiner). Derived regional adaptation by Dosare Dorohoi.

The metadata credits Michael De Groot for historical research and digitization
(summer 2010), Erik Steiner for technical support and project management, and
the additional people, institutions and funding listed in the committed source
manifest. It encourages scholarly reuse and adaptation, prohibits commercial
use, and asks users to inform the authors about adaptations or quality
improvements.

The layer warning is always reachable in the map controls: these are analytical
monthly boundary snapshots, not comprehensive front lines and not an explicit
civil/military administration dataset. The default OpenStreetMap basemap still
requires an external network connection. The locally served historical layer,
project places, routes, controls and neutral research grid remain usable when
that external tile service is unavailable; the application is not described as
fully offline-capable.

## Regional versus full dataset

Two browser derivatives are committed and serve different map experiences:

| Derivative | URL prefix | Extent | Consumer |
| --- | --- | --- | --- |
| Regional | `/data/historical-administration/` | documented Dorohoi research window | Research Map (`/map`) |
| Full | `/data/historical-administration-full/` | every polygon surviving conversion from the original monthly shapefile | Presentation Map (`/presentation/map`) |

The regional derivative keeps `regionalBbox` and `regionalFeatureCount`. The
full derivative keeps `featureCount`, `dataBbox`, `naturalExtent` and
`presentationCategory`. `lib/historical-administration/schemas.ts` uses strict
scope-aware Zod unions so the two contracts remain compatible without making
regional-only or full-only metadata broadly optional. Legacy generated regional
JSON does not need a new field: its scope is inferred from its validated URL.

The full derivative contains 91 files and 120,150,216 bytes in total:

- 88 monthly snapshots: 119,363,689 bytes, averaging 1,356,405 bytes;
- largest monthly snapshot: `1941-10.geojson`, 1,367,115 bytes;
- `manifest.json`: 305,106 bytes;
- `territorial-changes.geojson`: 473,151 bytes.

The full output has no Git LFS configuration and is currently committed as
ordinary Git assets. It is suitable for local development and month-at-a-time
browser loading; the browser requests the manifest and only the selected
monthly file. It is large for repeated Git history, so future growth should be
reviewed before adding more derivatives. No optimization was applied after
validation: full geometry uses the source extent, topology-preserving Shapely
simplification with the documented `0.005` degree tolerance, five-decimal
coordinate rounding and no rectangular geographic crop. Polygon validity is
checked after conversion, and raw attributes remain on every feature.

The full manifest derives the public vocabulary `presentationCategory` from
the unchanged raw `Name` and `Foreign_Po` values. The public legend groups
features as sovereign/state territory, Romanian-occupied or administered,
German-occupied or administered, Soviet-controlled, and unresolved/other.
Raw `Name`, `Foreign_Po`, `Head_of_St` and `Govt_in_Ex` remain available in the
details panel. The derived category is a traceable display classification, not
a replacement for the source field and not a new historical assertion.

The checkpoint command used to validate the committed derivatives is:

```bash
external-data/european-borders-wwii/.venv/bin/python \
  scripts/historical-administration/preprocess.py \
  --scope all --verify-output
```

To reproduce both outputs from the source archive, run the same processor
without `--verify-output`; it validates the archive before writing deterministic
staging output. The committed output is the current browser artifact, while
the processor remains the reproducible source of future replacements.
