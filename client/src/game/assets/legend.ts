/**
 * Legende der Hazards/Utilities für die Dev-Seite: verbindet den fachlichen
 * Namen (siehe `docs/08-hazards-und-utilities.md`) mit dem tatsächlich im Spiel
 * verwendeten Asset. Die Texturen werden NICHT erneut hart verdrahtet, sondern
 * aus `HAZARD_REGISTRY`/`UTILITY_REGISTRY` + `SHEET_SPECS`/`STATIC_IMAGE_SPECS`
 * abgeleitet (DRY, kein Drift zwischen Spiel und Legende).
 */
import type { HazardKind, UtilityKind } from "@arena/bot-contract";
import { HAZARD_REGISTRY, UTILITY_REGISTRY } from "../hazards/registry";
import { SHEET_SPECS, STATIC_IMAGE_SPECS } from "./spriteSheets";

export interface LegendPreview {
  /** Absolute, URL-kodierte Adresse des Assets (Dateinamen enthalten Leerzeichen). */
  url: string;
  /** Breite eines einzelnen Frames – `null` bei echten Einzelbildern. */
  frameWidth: number | null;
  /** Höhe eines einzelnen Frames – `null` bei echten Einzelbildern. */
  frameHeight: number | null;
}

export interface LegendEntry {
  kind: HazardKind | UtilityKind;
  label: string;
  description: string;
  /** `null` für Utilities (Stompbarkeit ist dort nicht definiert). */
  stompable: boolean | null;
  preview: LegendPreview;
}

/** Texte pro Kind – einzige Stelle mit Fließtext für die Legende. */
const COPY: Record<HazardKind | UtilityKind, { label: string; description: string }> = {
  ninjafrog: {
    label: "Ninja-Frog",
    description: "Patrouillierender Gegner. Von oben draufspringen schaltet ihn aus.",
  },
  schnetzler: {
    label: "Schnetzler",
    description: "Rotierende Säge, patrouilliert. Nicht stompbar – nur ausweichen.",
  },
  stachlinger: {
    label: "Stachlinger",
    description: "Feststehende Bodenstacheln. Müssen übersprungen werden.",
  },
  loderix: {
    label: "Loderix",
    description: "Feuersäule, die sich getaktet an- und ausschaltet.",
  },
  kugelblitz: {
    label: "Kugelblitz",
    description: "Pendelnde Stachelkugel, meist über einer Lücke.",
  },
  spikehead: {
    label: "Spikehead",
    description: "Fällt herab, sobald man die Zone darunter betritt.",
  },
  boingo: {
    label: "Boingo",
    description: "Trampolin: katapultiert nach oben – kein Hazard, sondern Hilfsmittel.",
  },
};

function previewFor(textureKey: string): LegendPreview {
  const sheet = SHEET_SPECS.find((spec) => spec.key === textureKey);
  if (sheet) {
    return {
      url: encodeURI(`/${sheet.path}`),
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
    };
  }
  const image = STATIC_IMAGE_SPECS.find((spec) => spec.key === textureKey);
  if (image) {
    return { url: encodeURI(`/${image.path}`), frameWidth: null, frameHeight: null };
  }
  throw new Error(`Kein Asset-Pfad für Textur-Key "${textureKey}" gefunden`);
}

const HAZARD_ENTRIES: LegendEntry[] = (Object.keys(HAZARD_REGISTRY) as HazardKind[]).map(
  (kind) => ({
    kind,
    ...COPY[kind],
    stompable: HAZARD_REGISTRY[kind].stompable,
    preview: previewFor(HAZARD_REGISTRY[kind].texture),
  })
);

const UTILITY_ENTRIES: LegendEntry[] = (Object.keys(UTILITY_REGISTRY) as UtilityKind[]).map(
  (kind) => ({
    kind,
    ...COPY[kind],
    stompable: null,
    preview: previewFor(UTILITY_REGISTRY[kind].texture),
  })
);

export const LEGEND_ENTRIES: readonly LegendEntry[] = [...HAZARD_ENTRIES, ...UTILITY_ENTRIES];
