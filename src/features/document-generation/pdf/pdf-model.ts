import type { EntityId } from "@/types/core";

/** Transient layout input assembled from reviewed DocumentData by a template. */
export interface PdfDocumentModel {
  sourceProfileId: EntityId;
  title?: string;
  sections: PdfSection[];
  header?: PdfPageAdornment;
  footer?: PdfPageAdornment;
}

/** Optional, template-supplied running text; omitted unless explicitly set. */
export interface PdfPageAdornment {
  text?: string;
  reference?: string;
  alignment?: "left" | "center" | "right";
  pageNumbers?: "current" | "current-of-total";
}

export interface PdfSection {
  id: string;
  title?: string;
  blocks: PdfBlock[];
  breakBefore?: boolean;
  headingStyle?: "plain" | "ruled" | "accent" | "uppercase" | "gold-rule" | "editorial";
  /** Render the section title and first structured entry's title/metadata as one opening block. */
  keepWithFirstEntry?: boolean;
}

export interface PdfContactItem {
  text: string;
  href?: string;
}

export type PdfIdentityStyle =
  | "global-ats"
  | "boardroom"
  | "executive-sidebar"
  | "editorial-masthead"
  | "gold-accent"
  | "cover-letter";

export type PdfBlock =
  | { kind: "gcc-identity"; name: string; headline?: string; details: string[]; photoDataUri?: string }
  | { kind: "european-identity"; name: string; contact: string[]; context: string[] }
  | { kind: "premium-identity"; style: PdfIdentityStyle; name: string; headline?: string; contact: string[] }
  | { kind: "competency-grid"; items: string[]; columns?: 2 | 3; tone?: "plain" | "navy" | "gold" }
  | { kind: "heading"; text: string; level?: 1 | 2; keepWithNext?: boolean }
  | { kind: "banner"; title: string; subtitle?: string }
  | { kind: "rule" }
  | { kind: "paragraph"; text: string; small?: boolean; keepWithNext?: boolean }
  | { kind: "bullets"; items: string[] }
  | { kind: "contact-row"; items: PdfContactItem[] }
  | { kind: "entry"; title: string; subtitle?: string; date?: string; location?: string; description?: string; bullets?: string[]; keepTogether?: boolean; keepOpeningTogether?: boolean }
  | { kind: "columns"; left: PdfBlock[]; right: PdfBlock[]; variant?: "balanced" | "sidebar" | "split-grid" }
  | { kind: "page-break" };
