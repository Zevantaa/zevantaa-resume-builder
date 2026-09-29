import "server-only";

import type { PdfDocumentModel } from "./pdf-model";
import type { PdfRenderQaScenario } from "./pdf-render-qa-types";

const QA_PROFILE_ID = "00000000-0000-4000-8000-000000000003";
const longEmployer = "Horizon Fictional International Operations and Supply Chain Cooperative, Regional Distribution and Process Improvement Division";
const longJobTitle = "Senior Operations and Supply Chain Transformation Programme Manager for Multi-Location Distribution";
const longBullet = "Coordinated a fictional cross-functional planning exercise, documented the supplied workflow, and explained handoffs between inventory, transport, and service teams without claiming any measured outcome. ".repeat(3).trim();

/** Fictional, static renderer inputs. Never reads or mutates a candidate profile. */
export function createPdfRenderQaModel(scenario: PdfRenderQaScenario): PdfDocumentModel {
  if (scenario === "header-footer") {
    return {
      ...createPdfRenderQaModel("multi-page"),
      title: "Development QA Header and Footer PDF",
      header: { text: "Zevantaa Resume Builder QA" },
      footer: { pageNumbers: "current-of-total" },
    };
  }

  const introduction: PdfDocumentModel["sections"] = [
    { id: "identity", blocks: [
      { kind: "heading", level: 1, text: "Rohan Kapoor" },
      { kind: "paragraph", text: "Operations & Supply Chain Professional" },
      { kind: "contact-row", items: [
        { text: "rohan.kapoor@example.invalid", href: "mailto:rohan.kapoor@example.invalid" },
        { text: "https://example.invalid/rohan-kapoor/fictional-professional-profile", href: "https://example.invalid/rohan-kapoor/fictional-professional-profile" },
      ] },
    ] },
    { id: "summary", title: "Professional Summary", blocks: [
      { kind: "paragraph", text: "Fictional operations and supply chain professional with experience coordinating distribution, inventory, and process-improvement work. This is static QA content, not a real candidate record." },
    ] },
  ];

  if (scenario === "unicode") {
    return { sourceProfileId: QA_PROFILE_ID, title: "Development QA Unicode PDF", sections: [
      ...introduction,
      { id: "unicode", title: "Unicode and Font Test", blocks: [
        { kind: "paragraph", text: "Rohan Kapoor" },
        { kind: "paragraph", text: "रोहन कपूर" },
        { kind: "paragraph", text: "Operations & Supply Chain" },
        { kind: "paragraph", text: "संचालन और आपूर्ति श्रृंखला" },
      ] },
    ] };
  }

  const conciseSections: PdfDocumentModel["sections"] = [
    { id: "employment", title: "Employment", blocks: [
      { kind: "entry", title: "Operations Manager", subtitle: "Horizon Fictional Retail Solutions", location: "Chandigarh", date: "2022-07 to Present",
        bullets: ["Coordinated fictional operations planning and documented process handoffs.", "Prepared fictional inventory and distribution reports for internal review."] },
    ] },
    { id: "education", title: "Education", blocks: [
      { kind: "entry", title: "Master of Business Administration (Operations)", subtitle: "Fictional Chandigarh Institute", date: "2017" },
    ] },
    { id: "skills", title: "Core Skills", blocks: [
      { kind: "bullets", items: ["Operations planning", "Inventory coordination", "Supply chain reporting"] },
    ] },
  ];

  if (scenario === "one-page") {
    return { sourceProfileId: QA_PROFILE_ID, title: "Development QA One-Page PDF", sections: [...introduction, ...conciseSections] };
  }

  if (scenario === "multi-page") {
    return { sourceProfileId: QA_PROFILE_ID, title: "Development QA Multi-Page PDF", sections: [
      ...introduction,
      { id: "long-employment", title: "Employment — Automatic Wrapping", blocks: [
        { kind: "entry", title: longJobTitle, subtitle: longEmployer, date: "2022-07 to Present", location: "Fictional Chandigarh office",
          description: "This deliberately long QA entry may continue onto a later page. It is not a production resume template.",
          bullets: Array.from({ length: 13 }, (_, index) => `Long supplied bullet ${index + 1}. ${longBullet}`) },
        ...Array.from({ length: 6 }, (_, index) => ({ kind: "entry" as const,
          title: `Fictional Operations Role ${index + 1}`, subtitle: longEmployer, date: "2018-01 to 2022-06",
          bullets: [longBullet, `Short concluding bullet for fictional role ${index + 1}.`] })),
      ] },
      { id: "explicit-break", title: "Explicit Page Break Test", blocks: [
        { kind: "page-break" },
        { kind: "paragraph", text: "This supplied QA paragraph starts after an explicit page break." },
        { kind: "heading", text: "Keep-with-next heading" },
        { kind: "paragraph", text: "This paragraph should remain with the heading when page space is tight." },
      ] },
      ...conciseSections.slice(1),
    ] };
  }

  throw new Error("Unsupported PDF QA scenario.");
}
