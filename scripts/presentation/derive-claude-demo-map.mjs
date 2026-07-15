import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("/mnt/c/Users/Alex Molovata/Downloads/Platforma_WJC (10).html", "utf8");
const start = source.indexOf("const D=") + 8;
const end = source.indexOf(";", start);
const data = vm.runInNewContext(`(${source.slice(start, end)})`);

const slug = (value) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
const sourceLabel = "Platforma_WJC (10).html · embedded Claude demo";

const dateRangeFrom = (raw, iso, precision) => {
  const value = typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  const rawValue = raw ?? null;
  if (!value) return { raw: rawValue, start: null, end: null, precision: "unknown" };
  const normalizedPrecision = precision === "zi"
    ? "day"
    : precision === "luna"
      ? "month"
      : precision === "an"
        ? "year"
        : "unknown";
  return { raw: rawValue, start: value, end: normalizedPrecision === "day" ? value : null, precision: normalizedPrecision };
};

const dateRangeFromYear = (value) => {
  if (typeof value !== "string" || !/^\d{4}$/.test(value)) {
    return { raw: value ?? null, start: null, end: null, precision: "unknown" };
  }
  return { raw: value, start: `${value}-01-01`, end: null, precision: "year" };
};

const deathDateRange = (value) => {
  if (typeof value !== "string") return dateRangeFrom(null, null, null);
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return match
    ? dateRangeFrom(value, `${match[3]}-${match[2]}-${match[1]}`, "zi")
    : dateRangeFrom(value, null, null);
};

const publicEventLabel = (type) => {
  const value = String(type || "").toLocaleLowerCase("ro");
  if (/nastere|naștere/.test(value)) return "Birth / origin";
  if (/evacu|deport|intern/.test(value)) return "Evacuation / deportation";
  if (/munca|muncă/.test(value)) return "Forced labour";
  if (/lagar|lagăr|ghetou|ghetto/.test(value)) return "Camp / ghetto";
  if (/deces|death|mort/.test(value)) return "Death / loss";
  if (/intoarcere|întoarcere|return|repatri/.test(value)) return "Return / repatriation";
  return String(type || "Documented event").replaceAll("_", " ");
};

const placeId = (name) => `claude-place-${slug(name)}`;

const people = data.persoane.map((person) => ({
  id: person.id,
  label: person.nume,
  dossierId: person.dosare[0] || null,
  roles: person.roluri || [],
  story: {
    personId: person.id,
    dossierId: person.dosare[0] || null,
    dossierLabel: person.dosare[0] ? `Dosar ${person.dosare[0]}` : null,
    roles: person.roluri || [],
    profile: {
      birthDate: dateRangeFromYear(person.an_nastere),
      sex: person.sex || null,
      profession: person.profesie || null,
      studies: person.studii || null,
      civilStatus: person.stare_civila || null,
      address: person.adresa || null,
      origin: person.origine || null,
      destination: person.destinatie || null,
      fate: person.soarta || null,
      deathPlace: person.loc_deces || null,
      deathDate: deathDateRange(person.data_deces),
    },
    timeline: (person.evenimente || []).map((event, index) => ({
      id: `${person.id}-event-${index + 1}`,
      placeId: event.loc ? placeId(event.loc) : null,
      placeName: event.loc || null,
      placeNameRo: event.loc || null,
      date: dateRangeFrom(event.data_text, event.data_iso, event.data_precizie),
      label: publicEventLabel(event.tip),
      description: event.descriere || null,
      sourceLabel,
    })),
    materials: (person.dosare || []).map((dossierId) => ({
      id: `claude-dossier-${dossierId}`,
      label: `Dosar ${dossierId}`,
      sourceLabel,
      pageCount: null,
    })),
    testimony: typeof person.narativ === "string" && person.narativ.trim() ? person.narativ : null,
    sourceLabel,
  },
}));
const peopleByName = new Map(people.map((person) => [person.label, person.id]));
const categoriesFor = (types) => types.flatMap((type) => {
  if (/nastere/.test(type)) return ["origin"];
  if (/evac|deport/.test(type)) return ["evacuation_deportation"];
  if (/munca/.test(type)) return ["forced_labour"];
  if (/deces/.test(type)) return ["death"];
  if (/intoarcere/.test(type)) return ["return"];
  return [];
});

const places = Object.entries(data.map.locuri).map(([name, info]) => {
  const events = data.persoane.flatMap((person) => (person.evenimente || [])
    .filter((event) => event.loc === name));
  const personIds = [...new Set(events
    .map((event) => data.persoane.find((person) => person.evenimente?.includes(event))?.id)
    .filter(Boolean))];
  const eventTypes = [...new Set(events.map((event) => event.tip))];
  return {
    id: placeId(name),
    label: name,
    labelRo: name,
    coordinates: { latitude: info.lat, longitude: info.lng },
    placeType: info.tip === "transnistria"
      ? "historical_region"
      : info.tip === "lagar"
        ? "camp"
        : info.tip === "munca"
          ? "institution"
          : "settlement",
    layer: "core",
    confidence: "unknown",
    resolutionStatus: "resolved",
    personIds,
    eventTypes,
    years: [...new Set(events
      .map((event) => Number((event.data_iso || "").slice(0, 4)))
      .filter(Number.isFinite))],
    dossierIds: [...new Set(personIds
      .map((id) => people.find((person) => person.id === id)?.dossierId)
      .filter(Boolean))],
    roles: eventTypes,
    categories: categoriesFor(eventTypes),
    sourceLabel,
  };
});

const routes = [];
for (const person of data.persoane) {
  const events = (person.evenimente || [])
    .filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lng))
    .sort((left, right) => (left.data_iso || "9999").localeCompare(right.data_iso || "9999"));
  for (let index = 0; index < events.length - 1; index += 1) {
    const origin = events[index];
    const destination = events[index + 1];
    if (origin.lat === destination.lat && origin.lng === destination.lng) continue;
    routes.push({
      id: `${person.id}-route-${index + 1}`,
      personId: person.id,
      personName: person.nume,
      dossierId: person.dosare[0] || null,
      originId: placeId(origin.loc),
      originName: origin.loc,
      destinationId: placeId(destination.loc),
      destinationName: destination.loc,
      coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
      routeStatus: "explicit",
      confidence: "unknown",
      dateStart: origin.data_iso || null,
      dateEnd: destination.data_iso || null,
      dateRaw: destination.data_text || null,
      transportRaw: null,
      sequence: index + 1,
      sourceLabel,
      notes: destination.descriere || null,
      eventTypes: [origin.tip, destination.tip],
    });
  }
}

const dossiers = data.dosare.map((dossier) => ({
  id: `claude-dossier-${dossier.dosar}`,
  label: `Dosar ${dossier.dosar} · ${dossier.localitate || ""}`.trim(),
}));
const groups = data.map.families.map((family) => ({
  id: `claude-family-${family.dosar}`,
  label: `${family.cap_nume} · dosar ${family.dosar}`,
  personIds: family.persoane.map((person) => peopleByName.get(person.nume)).filter(Boolean),
  kind: "family",
}));

process.stdout.write(JSON.stringify({
  metadata: {
    sourceFile: "Platforma_WJC (10).html",
    sourceSha256: "2dd8b2facb3e4ae2b214736d85d3dfd3449d73d942a1a49f8fbf3b0409273522",
    generatedAt: "2026-07-15",
    description: "Derived map-demo fixture from the embedded Claude prototype. Not normalized research data.",
  },
  places,
  routes,
  persons: people,
  dossiers,
  groups,
  eventTypes: [...new Set(data.persoane.flatMap((person) => (person.evenimente || []).map((event) => event.tip)))].sort(),
  unresolvedMentions: [],
}, null, 2));
