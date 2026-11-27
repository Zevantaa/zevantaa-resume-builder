import type { CefrAssessment, CefrLevel, EqfQualification, GlobalAtsMarket, RegionalIntake } from "@/types/regional-intake";

export class RegionalIntakeValidationError extends Error {
  constructor(message: string) { super(message); this.name = "RegionalIntakeValidationError"; }
}

const MARKET = new Set<GlobalAtsMarket>(["india", "global-mnc", "usa", "canada", "uk", "australia"]);
const CEFR = new Set<CefrLevel>(["A1", "A2", "B1", "B2", "C1", "C2"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function object(value: unknown, allowed: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new RegionalIntakeValidationError(`${label} contains an unsupported field.`);
  }
  return value as Record<string, unknown>;
}

function optionalText(value: unknown, label: string, max: number, multiline = false): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new RegionalIntakeValidationError(`${label} must be text.`);
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u : /[\u0000-\u001f\u007f]/u).test(trimmed)) {
    throw new RegionalIntakeValidationError(`${label} is too long or contains unsupported characters.`);
  }
  return trimmed;
}

function strings(value: unknown, label: string, maxItems: number, maxLength: number): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maxItems) throw new RegionalIntakeValidationError(`${label} has too many entries.`);
  const output = value.map((item) => optionalText(item, label, maxLength)).filter((item): item is string => Boolean(item));
  if (new Set(output.map((item) => item.toLocaleLowerCase("en"))).size !== output.length) {
    throw new RegionalIntakeValidationError(`${label} contains duplicate entries.`);
  }
  return output.length ? output : undefined;
}

function optionalSection(value: unknown, allowed: readonly string[], label: string): Record<string, unknown> | null {
  return value === undefined ? null : object(value, allowed, label);
}

/** Fail closed on unknown keys, overlong facts and unsupported CEFR/EQF values. */
export function validateRegionalIntake(value: unknown): RegionalIntake {
  const source = object(value, ["version", "global", "gcc", "eu"], "Regional intake");
  if (source.version !== 1) throw new RegionalIntakeValidationError("Refresh the regional form before saving.");
  const result: RegionalIntake = { version: 1 };

  const global = optionalSection(source.global, ["market", "targetJobTitle", "jobDescription", "targetKeywords",
    "functionalCompetencies", "technicalSkills", "noticePeriod", "workAuthorization"], "Global ATS");
  if (global) {
    if (global.market !== undefined && !MARKET.has(global.market as GlobalAtsMarket)) {
      throw new RegionalIntakeValidationError("Choose a supported Global ATS market.");
    }
    result.global = {
      ...(global.market ? { market: global.market as GlobalAtsMarket } : {}),
      ...(optionalText(global.targetJobTitle, "Target job title", 200) ? { targetJobTitle: optionalText(global.targetJobTitle, "Target job title", 200) } : {}),
      ...(optionalText(global.jobDescription, "Job description", 8000, true) ? { jobDescription: optionalText(global.jobDescription, "Job description", 8000, true) } : {}),
      ...(strings(global.targetKeywords, "Target keywords", 30, 80) ? { targetKeywords: strings(global.targetKeywords, "Target keywords", 30, 80) } : {}),
      ...(strings(global.functionalCompetencies, "Functional competencies", 30, 80) ? { functionalCompetencies: strings(global.functionalCompetencies, "Functional competencies", 30, 80) } : {}),
      ...(strings(global.technicalSkills, "Technical skills", 30, 80) ? { technicalSkills: strings(global.technicalSkills, "Technical skills", 30, 80) } : {}),
      ...(optionalText(global.noticePeriod, "Notice period", 120) ? { noticePeriod: optionalText(global.noticePeriod, "Notice period", 120) } : {}),
      ...(optionalText(global.workAuthorization, "Work authorization", 200) ? { workAuthorization: optionalText(global.workAuthorization, "Work authorization", 200) } : {}),
    };
  }

  const gcc = optionalSection(source.gcc, ["nationality", "visaWorkStatus", "noticePeriod", "drivingLicence",
    "maritalStatus", "photoConsent"], "GCC");
  if (gcc) {
    if (gcc.photoConsent !== undefined && typeof gcc.photoConsent !== "boolean") {
      throw new RegionalIntakeValidationError("Photo consent must be explicit.");
    }
    result.gcc = {
      ...(optionalText(gcc.nationality, "Nationality", 100) ? { nationality: optionalText(gcc.nationality, "Nationality", 100) } : {}),
      ...(optionalText(gcc.visaWorkStatus, "Visa or work status", 200) ? { visaWorkStatus: optionalText(gcc.visaWorkStatus, "Visa or work status", 200) } : {}),
      ...(optionalText(gcc.noticePeriod, "GCC notice period", 120) ? { noticePeriod: optionalText(gcc.noticePeriod, "GCC notice period", 120) } : {}),
      ...(optionalText(gcc.drivingLicence, "Driving licence", 160) ? { drivingLicence: optionalText(gcc.drivingLicence, "Driving licence", 160) } : {}),
      ...(optionalText(gcc.maritalStatus, "Optional personal information", 80) ? { maritalStatus: optionalText(gcc.maritalStatus, "Optional personal information", 80) } : {}),
      ...(gcc.photoConsent === true ? { photoConsent: true } : {}),
    };
  }

  const eu = optionalSection(source.eu, ["motherTongue", "workAuthorization", "cefr", "eqf"], "European");
  if (eu) {
    let cefr: CefrAssessment[] | undefined;
    if (eu.cefr !== undefined) {
      if (!Array.isArray(eu.cefr) || eu.cefr.length > 12) throw new RegionalIntakeValidationError("Too many CEFR assessments.");
      cefr = eu.cefr.map((item) => {
        const row = object(item, ["language", "listening", "reading", "spokenInteraction", "spokenProduction", "writing"], "CEFR assessment");
        const language = optionalText(row.language, "CEFR language", 100);
        if (!language || ![row.listening, row.reading, row.spokenInteraction, row.spokenProduction, row.writing]
          .every((level) => CEFR.has(level as CefrLevel))) {
          throw new RegionalIntakeValidationError("Complete all five CEFR axes with a supported level.");
        }
        return { language, listening: row.listening as CefrLevel, reading: row.reading as CefrLevel,
          spokenInteraction: row.spokenInteraction as CefrLevel, spokenProduction: row.spokenProduction as CefrLevel,
          writing: row.writing as CefrLevel };
      });
      if (new Set(cefr.map((item) => item.language.toLocaleLowerCase("en"))).size !== cefr.length) {
        throw new RegionalIntakeValidationError("CEFR language names must be unique.");
      }
    }
    let eqf: EqfQualification[] | undefined;
    if (eu.eqf !== undefined) {
      if (!Array.isArray(eu.eqf) || eu.eqf.length > 30) throw new RegionalIntakeValidationError("Too many EQF entries.");
      eqf = eu.eqf.map((item) => {
        const row = object(item, ["educationId", "level", "verificationBasis"], "EQF entry");
        if (typeof row.educationId !== "string" || !UUID.test(row.educationId) ||
            !Number.isInteger(row.level) || Number(row.level) < 1 || Number(row.level) > 8) {
          throw new RegionalIntakeValidationError("EQF entry must reference a qualification and level 1–8.");
        }
        const basis = optionalText(row.verificationBasis, "EQF verification basis", 300);
        if (!basis) throw new RegionalIntakeValidationError("An EQF level requires its verification source.");
        return { educationId: row.educationId, level: row.level as EqfQualification["level"], verificationBasis: basis };
      });
      if (new Set(eqf.map((item) => item.educationId)).size !== eqf.length) {
        throw new RegionalIntakeValidationError("Each qualification can have only one EQF entry.");
      }
    }
    result.eu = {
      ...(optionalText(eu.motherTongue, "Mother tongue", 100) ? { motherTongue: optionalText(eu.motherTongue, "Mother tongue", 100) } : {}),
      ...(optionalText(eu.workAuthorization, "EU or EEA work authorization", 200) ? { workAuthorization: optionalText(eu.workAuthorization, "EU or EEA work authorization", 200) } : {}),
      ...(cefr?.length ? { cefr } : {}), ...(eqf?.length ? { eqf } : {}),
    };
  }
  if (JSON.stringify(result).length > 30000) throw new RegionalIntakeValidationError("The regional form is too large.");
  return result;
}
