import { z } from "zod";

export const SourcePointerSchema = z
  .object({
    pagina_pdf: z.number().int().positive().optional(),
    pagina_tiparita: z.union([z.number(), z.string()]).optional(),
    rubrica: z.string().optional(),
    fragment: z.string().optional(),
  })
  .passthrough();

const SourceDateSchema = z
  .object({
    raw: z.string(),
    normalizat: z.string().optional(),
    precizie: z.string().optional(),
  })
  .passthrough();

export const SourcePersonSchema = z
  .object({
    persoana_id: z.string(),
    nume_afisat: z.string(),
    nume_familie: z.string().optional(),
    prenume: z.string().optional(),
    sex: z.string().optional(),
    data_nasterii: SourceDateSchema.optional(),
    an_nastere_raw: z.string().optional(),
    loc_nastere_raw: z.string().optional(),
    stare_civila_raw: z.string().optional(),
    roluri_in_document: z.array(z.string()).default([]),
    incredere_identitate: z.string().optional(),
    lecturi_alternative: z.array(z.string()).optional(),
  })
  .passthrough();

export const SourceHouseholdSchema = z
  .object({
    gospodarie_id: z.string(),
    cap_persoana_id: z.string().optional(),
    total_persoane_raw: z.string().optional(),
    membri: z.array(z.string()).default([]),
  })
  .passthrough();

export const SourceRelationshipSchema = z
  .object({
    relatie_id: z.string(),
    tip: z.string(),
    persoana_1: z.string().optional(),
    persoana_2: z.string().optional(),
    parinte: z.string().optional(),
    copil: z.string().optional(),
    incredere: z.string().optional(),
    sursa: SourcePointerSchema.optional(),
  })
  .passthrough();

export const SourceEventSchema = z
  .object({
    eveniment_id: z.string(),
    tip: z.string(),
    participant: z.string(),
    sursa: SourcePointerSchema.optional(),
  })
  .passthrough();

export const SourcePlaceSummarySchema = z
  .object({
    raw: z.string(),
    roluri: z.array(z.string()).default([]),
  })
  .passthrough();

export const SourceDossierSchema = z
  .object({
    _model_versiune: z.string(),
    _status: z.string(),
    document: z
      .object({
        document_id: z.string(),
        fisier_sursa: z.string(),
        tip: z.string(),
        pagini_pdf: z.number().int().positive(),
      })
      .passthrough(),
    persoane: z.array(SourcePersonSchema),
    gospodarii: z.array(SourceHouseholdSchema).optional(),
    relatii: z.array(SourceRelationshipSchema).optional(),
    evenimente: z.array(SourceEventSchema),
    locuri_mentionate: z.array(SourcePlaceSummarySchema).default([]),
    potriviri_de_verificat: z.array(z.record(z.string(), z.unknown())).optional(),
    probleme_deschise: z.array(z.string()).default([]),
  })
  .passthrough();

export const EhriPlaceSchema = z
  .object({
    nume: z.string(),
    alt: z.array(z.string()),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    tip: z.enum(["lagar", "ghetou"]),
    in_dosare: z.string().optional(),
  })
  .passthrough();

export const EhriPlacesSchema = z.array(EhriPlaceSchema);

export const AnalyticalModelSchema = z
  .object({
    _model_versiune: z.string(),
    _descriere: z.string(),
    documents: z.array(z.unknown()),
    persons: z.array(z.unknown()),
    relationships: z.array(z.unknown()),
    events: z.array(z.unknown()),
    places: z.array(z.unknown()),
    place_mentions: z.array(z.unknown()),
    route_segments: z.array(z.unknown()),
    review_tasks: z.array(z.unknown()),
    _record_templates: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export type SourceDossier = z.infer<typeof SourceDossierSchema>;
export type SourcePerson = z.infer<typeof SourcePersonSchema>;
export type SourceHousehold = z.infer<typeof SourceHouseholdSchema>;
export type SourceRelationship = z.infer<typeof SourceRelationshipSchema>;
export type SourceEvent = z.infer<typeof SourceEventSchema>;
export type SourcePointer = z.infer<typeof SourcePointerSchema>;
export type EhriPlace = z.infer<typeof EhriPlaceSchema>;
