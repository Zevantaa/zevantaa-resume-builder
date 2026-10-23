import "server-only";

import path from "node:path";
import { Document, Font, Image, Link, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { jsx } from "react/jsx-runtime";
import { cloneElement, type ComponentProps, type ReactElement, type ReactNode } from "react";

import { isSafeExternalUrl } from "../../../lib/security/external-url";

import type { PdfBlock, PdfContactItem, PdfDocumentModel, PdfPageAdornment, PdfSection } from "./pdf-model";
import { resolvePdfTheme, type PdfTheme, type PdfThemeOverrides } from "./pdf-theme";

const fontPath = (name: string) => path.join(process.cwd(), "public", "fonts", name);
Font.register({ family: "Zevantaa PDF Latin", fonts: [
  { src: fontPath("noto-sans-latin-regular.woff"), fontWeight: 400 },
  { src: fontPath("noto-sans-latin-bold.woff"), fontWeight: 700 },
] });
Font.register({ family: "Zevantaa PDF Latin Ext", fonts: [
  { src: fontPath("noto-sans-latin-ext-regular.woff"), fontWeight: 400 },
  { src: fontPath("noto-sans-latin-ext-bold.woff"), fontWeight: 700 },
] });
Font.register({ family: "Zevantaa PDF Devanagari", fonts: [
  { src: fontPath("noto-sans-devanagari-regular.woff"), fontWeight: 400 },
  { src: fontPath("noto-sans-devanagari-bold.woff"), fontWeight: 700 },
] });
// React-PDF's automatic hyphenation can insert new characters into candidate
// names and role titles, changing copied/searched text. Let words wrap only at
// authored boundaries; unusually long contact URLs are wrapped below.
Font.registerHyphenationCallback((word) => [word]);

const hasText = (value: string | undefined): value is string => Boolean(value?.trim());
const ADORNMENT_HEIGHT = 16;
const ADORNMENT_GAP = 10;

/** Keep glyph runs in a bundled font rather than relying on host OS fallback. */
function textRuns(value: string, defaultFamily: string): ReactNode[] {
  const runs: { text: string; fontFamily: string }[] = [];
  for (const char of value) {
    const code = char.codePointAt(0)!;
    const fontFamily = code >= 0x0900 && code <= 0x097f ? "Zevantaa PDF Devanagari"
      : code >= 0x0100 && code <= 0x024f ? "Zevantaa PDF Latin Ext" : defaultFamily;
    const last = runs.at(-1);
    if (last?.fontFamily === fontFamily) last.text += char;
    else runs.push({ text: char, fontFamily });
  }
  return runs.map((run, index) => jsx(Text, { style: { fontFamily: run.fontFamily }, children: run.text }, index));
}

function text(value: string, style: Record<string, string | number>, theme: PdfTheme, key: string, minPresenceAhead = 0) {
  return jsx(Text, { style, minPresenceAhead, orphans: 2, widows: 2,
    children: textRuns(value, theme.typography.fontFamily) }, key);
}

function safeHref(href: string | undefined): string | null {
  if (!href || /[\u0000-\u001f\u007f]/u.test(href)) return null;
  try {
    const parsed = new URL(href);
    if (parsed.protocol === "https:") return isSafeExternalUrl(href) ? href : null;
    return ["mailto:", "tel:"].includes(parsed.protocol) ? href : null;
  } catch { return null; }
}

function bulletItems(items: readonly string[] | undefined, theme: PdfTheme, key: string) {
  const lines = (items ?? []).filter(hasText);
  if (!lines.length) return null;
  return jsx(View, { style: { marginTop: theme.typography.paragraphGap / 2 }, children: lines.map((item, index) =>
    text(`•  ${item}`, { fontSize: theme.typography.bodySize, lineHeight: theme.typography.lineHeight,
      marginLeft: theme.typography.bulletIndent, marginBottom: theme.typography.paragraphGap / 2,
      color: theme.textColor }, theme, `${key}-bullet-${index}`)) }, key);
}

function shortEntry(block: Extract<PdfBlock, { kind: "entry" }>, theme: PdfTheme): boolean {
  if (block.keepTogether === false) return false;
  const all = [block.title, block.subtitle, block.date, block.location, block.description, ...(block.bullets ?? [])].filter(hasText);
  const width = 595 - theme.margins.left - theme.margins.right;
  const charsPerLine = Math.max(20, Math.floor(width / (theme.typography.bodySize * 0.55)));
  const lines = all.reduce((count, value) => count + Math.ceil(value.length / charsPerLine), 0);
  const height = lines * theme.typography.bodySize * theme.typography.lineHeight +
    (block.bullets?.length ?? 0) * theme.typography.paragraphGap;
  return height < (842 - theme.margins.top - theme.margins.bottom) * 0.35;
}

function contactItem(item: PdfContactItem, theme: PdfTheme, key: string) {
  // Very long unspaced URLs need explicit display line breaks. The link target
  // stays exact; unlike word hyphenation this inserts no visible fake character.
  const display = item.text.startsWith("https://") && item.text.length > 64
    ? item.text.match(/.{1,64}/gu)?.join("\n") ?? item.text : item.text;
  const content = text(display, { fontSize: theme.typography.smallSize, color: theme.mutedColor,
    maxWidth: "100%" }, theme, `${key}-text`);
  const href = safeHref(item.href);
  const style = { maxWidth: "100%", flexShrink: 1 };
  return href ? jsx(Link, { src: href, style, children: content }, key) : jsx(View, { style, children: content }, key);
}

function entryOpening(block: Extract<PdfBlock, { kind: "entry" }>, theme: PdfTheme, key: string): ReactNode[] {
  const type = theme.typography;
  return [
    jsx(View, { style: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
      minPresenceAhead: type.bodySize * type.lineHeight * 2,
      children: [
        text(block.title, { fontSize: type.bodySize, fontWeight: 700, lineHeight: type.lineHeight,
          color: theme.textColor, flex: 1 }, theme, `${key}-title`),
        hasText(block.date) ? text(block.date, { fontSize: type.smallSize, color: theme.mutedColor,
          lineHeight: type.lineHeight, textAlign: "right", maxWidth: 110 }, theme, `${key}-date`) : null,
      ] }, `${key}-lead`),
    hasText(block.subtitle) ? text(block.subtitle, { fontSize: type.smallSize, color: theme.mutedColor,
      lineHeight: type.lineHeight }, theme, `${key}-subtitle`) : null,
    hasText(block.location) ? text(block.location, { fontSize: type.smallSize, color: theme.mutedColor,
      lineHeight: type.lineHeight }, theme, `${key}-location`) : null,
  ];
}

function entryBody(block: Extract<PdfBlock, { kind: "entry" }>, theme: PdfTheme, key: string): ReactNode[] {
  const type = theme.typography;
  return [
    hasText(block.description) ? text(block.description, { fontSize: type.bodySize, lineHeight: type.lineHeight,
      color: theme.textColor, marginTop: type.paragraphGap / 2 }, theme, `${key}-description`) : null,
    bulletItems(block.bullets, theme, `${key}-bullets`),
  ];
}

function renderBlock(block: PdfBlock, theme: PdfTheme, key: string): ReactNode {
  const type = theme.typography;
  if (block.kind === "european-identity") return jsx(View, { wrap: false, style: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.accentColor,
    paddingBottom: 12, marginBottom: type.paragraphGap * 2, gap: 18,
  }, children: [
    jsx(View, { style: { width: 102, borderRightWidth: 1, borderRightColor: "#CDD6DE", paddingRight: 12 },
      children: text("PROFILE", { fontSize: type.smallSize, fontWeight: 700,
        lineHeight: type.lineHeight, color: theme.accentColor }, theme, `${key}-label`) }, `${key}-rail`),
    jsx(View, { style: { flex: 1 }, children: [
      text(block.name, { fontSize: type.heading1Size, fontWeight: 700, lineHeight: type.lineHeight,
        color: theme.textColor, marginBottom: 6 }, theme, `${key}-name`),
      ...block.contact.filter(hasText).map((value, index) => text(value,
        { fontSize: type.smallSize, lineHeight: type.lineHeight, color: theme.textColor, marginBottom: 2 },
        theme, `${key}-contact-${index}`)),
      ...block.context.filter(hasText).map((value, index) => text(value,
        { fontSize: type.smallSize, lineHeight: type.lineHeight, color: theme.mutedColor, marginBottom: 2 },
        theme, `${key}-context-${index}`)),
    ] }, `${key}-content`),
  ] }, key);
  if (block.kind === "gcc-identity") return jsx(View, { wrap: false, style: {
    backgroundColor: "#0B132B", paddingHorizontal: 18, paddingVertical: 16,
    marginBottom: type.paragraphGap * 2, flexDirection: "row", alignItems: "center", gap: 18,
  }, children: [
    jsx(View, { style: { flex: 1 }, children: [
      text(block.name, { fontSize: type.heading1Size, fontWeight: 700, lineHeight: type.lineHeight,
        color: "#FFFFFF", marginBottom: 6 }, theme, `${key}-name`),
      ...block.details.filter(hasText).map((detail, index) => text(detail,
        { fontSize: type.smallSize, lineHeight: type.lineHeight, color: "#FFFFFF", marginBottom: 3 },
        theme, `${key}-detail-${index}`)),
    ] }, `${key}-details`),
    block.photoDataUri ? jsx(Image, { src: block.photoDataUri, cache: false,
      style: { width: 80, height: 100 } }, `${key}-photo`) : null,
  ] }, key);
  if (block.kind === "page-break") return jsx(View, { break: true, style: { height: 0 } }, key);
  if (block.kind === "rule") return jsx(View, { style: { borderBottomWidth: 1, borderBottomColor: theme.accentColor,
    marginBottom: type.paragraphGap * 1.5 } }, key);
  if (block.kind === "banner") return hasText(block.title) ? jsx(View, { style: {
    backgroundColor: theme.accentColor, paddingHorizontal: 15, paddingVertical: 12,
    marginBottom: type.paragraphGap * 1.5,
  }, children: [
    text(block.title, { fontSize: type.heading1Size, fontWeight: 700, lineHeight: type.lineHeight,
      color: "#FFFFFF" }, theme, `${key}-title`),
    hasText(block.subtitle) ? text(block.subtitle, { fontSize: type.smallSize, lineHeight: type.lineHeight,
      color: "#FFFFFF", marginTop: 4 }, theme, `${key}-subtitle`) : null,
  ] }, key) : null;
  if (block.kind === "heading") return hasText(block.text) ? text(block.text,
    { fontSize: block.level === 1 ? type.heading1Size : type.heading2Size, fontWeight: 700,
      lineHeight: type.lineHeight, color: theme.textColor, marginBottom: type.paragraphGap },
    theme, key, block.keepWithNext === false ? 0 : type.bodySize * type.lineHeight * 2) : null;
  if (block.kind === "paragraph") return hasText(block.text) ? text(block.text,
    { fontSize: block.small ? type.smallSize : type.bodySize, lineHeight: type.lineHeight,
      color: theme.textColor, marginBottom: type.paragraphGap }, theme, key,
    block.keepWithNext ? type.bodySize * type.lineHeight * 2 : 0) : null;
  if (block.kind === "bullets") return bulletItems(block.items, theme, key);
  if (block.kind === "contact-row") {
    const items = block.items.filter((item) => hasText(item.text));
    return items.length ? jsx(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 8,
      marginBottom: type.paragraphGap }, children: items.map((item, index) => contactItem(item, theme, `${key}-${index}`)) }, key) : null;
  }
  if (block.kind === "columns") {
    const left = block.left.map((item, index) => renderBlock(item, theme, `${key}-l-${index}`)).filter(Boolean);
    const right = block.right.map((item, index) => renderBlock(item, theme, `${key}-r-${index}`)).filter(Boolean);
    return left.length || right.length ? jsx(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
      jsx(View, { style: { width: "48%" }, children: left }, `${key}-left`),
      jsx(View, { style: { width: "48%" }, children: right }, `${key}-right`),
    ] }, key) : null;
  }
  if (!hasText(block.title)) return null;
  if (block.keepOpeningTogether) return jsx(View, { wrap: true,
    style: { marginBottom: type.paragraphGap * 1.5 }, children: [
      jsx(View, { wrap: false, children: entryOpening(block, theme, key) }, `${key}-opening`),
      ...entryBody(block, theme, key),
    ] }, key);
  return jsx(View, { wrap: !shortEntry(block, theme), style: { marginBottom: type.paragraphGap * 1.5 }, children: [
    ...entryOpening(block, theme, key),
    ...entryBody(block, theme, key),
  ] }, key);
}

function renderSection(section: PdfSection, theme: PdfTheme, key: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const headingStyle = section.headingStyle ?? "plain";
  const title = hasText(section.title) ? text(section.title,
    { fontSize: theme.typography.heading2Size, fontWeight: 700, lineHeight: theme.typography.lineHeight,
      color: headingStyle === "accent" ? theme.accentColor : theme.textColor,
      marginBottom: theme.typography.paragraphGap,
      ...(headingStyle === "ruled" ? { borderBottomWidth: 0.7, borderBottomColor: theme.accentColor, paddingBottom: 3 } : {}),
      ...(headingStyle === "accent" ? { borderLeftWidth: 3, borderLeftColor: theme.accentColor, paddingLeft: 7 } : {}),
      ...(headingStyle === "uppercase" ? { textTransform: "uppercase" } : {}),
    }, theme,
    `${key}-section-title`, section.keepWithFirstEntry ? 0 :
      theme.typography.bodySize * theme.typography.lineHeight * 2) : null;
  const firstEntry = section.keepWithFirstEntry && title && section.blocks[0]?.kind === "entry"
    ? section.blocks[0] : null;
  if (firstEntry) {
    // React-PDF can move an entire entry after minPresenceAhead has kept its section title.
    // Keep only the title and job metadata indivisible; the description/bullets stay wrappable.
    blocks.push(jsx(View, { wrap: false, break: section.breakBefore === true,
      children: [title, ...entryOpening(firstEntry, theme, `${key}-0`)] }, `${key}-first-opening`));
    blocks.push(jsx(View, { style: { marginBottom: theme.typography.paragraphGap * 1.5 },
      children: entryBody(firstEntry, theme, `${key}-0`) }, `${key}-first-body`));
  }
  let breakNext = section.breakBefore === true && !title;
  section.blocks.slice(firstEntry ? 1 : 0).forEach((block, offset) => {
    const index = offset + (firstEntry ? 1 : 0);
    if (block.kind === "page-break") { breakNext = true; return; }
    const rendered = renderBlock(block, theme, `${key}-${index}`);
    if (!rendered) return;
    blocks.push(breakNext ? cloneElement(rendered as ReactElement<{ break?: boolean }>, { break: true }) : rendered);
    breakNext = false;
  });
  if (!blocks.length) return [];
  return [
    ...(!firstEntry && title ? [section.breakBefore ? cloneElement(title as ReactElement<{ break?: boolean }>, { break: true }) : title] : []),
    ...blocks,
    jsx(View, { style: { height: theme.typography.sectionGap } }, `${key}-gap`),
  ];
}

function pageAdornment(adornment: PdfPageAdornment | undefined, position: "header" | "footer", theme: PdfTheme) {
  if (!adornment) return null;
  const values = [adornment.text, adornment.reference].filter(hasText);
  if (!values.length && !adornment.pageNumbers) return null;
  const staticValue = values.join(" · ");
  const limit = adornment.pageNumbers ? 36 : 42;
  if (values.some((value) => /[\r\n\u0000-\u001f\u007f]/u.test(value)) || Array.from(staticValue).length > limit) {
    throw new RangeError(`PDF header/footer text must be one line of at most ${limit} characters.`);
  }
  const alignment = adornment.alignment ?? "left";
  const justifyContent = alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center";
  return jsx(View, { fixed: true, style: {
    position: "absolute", left: theme.margins.left, right: theme.margins.right,
    ...(position === "header" ? { top: theme.margins.top } : { bottom: theme.margins.bottom }),
    height: ADORNMENT_HEIGHT, flexDirection: "row", justifyContent, alignItems: "center", gap: 6,
  }, children: [
    staticValue ? text(staticValue, { fontSize: theme.typography.smallSize, color: theme.mutedColor,
      lineHeight: theme.typography.lineHeight }, theme, `${position}-text`) : null,
    adornment.pageNumbers ? jsx(Text, { style: { fontSize: theme.typography.smallSize, color: theme.mutedColor,
      fontFamily: theme.typography.fontFamily },
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        adornment.pageNumbers === "current" ? `Page ${pageNumber}` : `Page ${pageNumber} of ${totalPages}`,
    }, `${position}-pages`) : null,
  ] }, position);
}

/** Server-only, in-memory PDF render. Caller must supply already-authorized data. */
export async function renderPdfDocument(model: PdfDocumentModel, overrides: PdfThemeOverrides = {}): Promise<Buffer> {
  const theme = resolvePdfTheme(overrides);
  const sections = model.sections.flatMap((section, index) => renderSection(section, theme, `section-${index}`));
  const header = pageAdornment(model.header, "header", theme);
  const footer = pageAdornment(model.footer, "footer", theme);
  const page = jsx(Page, { size: "A4", wrap: true,
    style: { paddingTop: theme.margins.top + (header ? ADORNMENT_HEIGHT + ADORNMENT_GAP : 0),
      paddingRight: theme.margins.right,
      paddingBottom: theme.margins.bottom + (footer ? ADORNMENT_HEIGHT + ADORNMENT_GAP : 0),
      paddingLeft: theme.margins.left,
      fontFamily: theme.typography.fontFamily, fontSize: theme.typography.bodySize,
      color: theme.textColor }, children: [header, ...sections, footer] });
  const document = jsx(Document, { title: model.title, creator: "Zevantaa Resume Builder",
    creationDate: new Date(0), modificationDate: new Date(0), children: page });
  return renderToBuffer(document as ReactElement<ComponentProps<typeof Document>>);
}
