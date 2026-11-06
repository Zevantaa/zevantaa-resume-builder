# Zevantaa design-reference inventory

Inventory attempted on 6 November 2026 from the approved location:

`C:\Development\zevantaa-design-references`

## External reference root

The directory does not exist on this workstation. A recursive directory search under `C:\Development` found no renamed or nested `zevantaa-design-references` directory. Therefore:

- no November 5 PDF or HTML target can yet be checksummed or visually reviewed;
- missing-versus-duplicated assets inside that external collection cannot be determined;
- document generator styling must remain unchanged until the approved files are available.

This is a source-asset blocker only. It does not block the shared application UI modernization.

## Verified repository references

| File | Bytes | Modified | SHA-256 | Classification |
| --- | ---: | --- | --- | --- |
| `docs/reference/Zevantaa_Full_UIUX_Mockup_v8.html` | 84,606 | 2026-11-04 | `2682CE9AA7F3A4530A949C2CCEA132469E73B59AE2BEA2C3C2821AAAAAAB3250` | Application UI prototype |
| `docs/reference/Zevantaa_Resume_Dashboard_Prototype.html` | 24,412 | 2026-11-04 | `2BD43DEB7B9D14E9174BD238738A5FB03B50DE05442072EEA60D4558D90FBAC1` | Earlier dashboard prototype |

The two verified files are not byte duplicates. Neither is an approved resume or cover-letter rendering target.

## Generator-to-target matching table

The following is the exact existing generator boundary. The external-target column remains unresolved until the November 5 files are mounted.

| Frozen output | Existing generator | Current internal design | Approved external target |
| --- | --- | --- | --- |
| `global-ats-resume` | `src/features/document-generation/global-ats-resume.ts` | Global ATS | Unavailable |
| `domestic-resume-1` | `src/features/document-generation/domestic-resumes.ts` design `1` | Executive Classic | Unavailable |
| `domestic-resume-2` | `src/features/document-generation/domestic-resumes.ts` design `2` | Modern Professional | Unavailable |
| `domestic-resume-3` | `src/features/document-generation/domestic-resumes.ts` design `3` | Compact High-Density | Unavailable |
| `domestic-resume-4` | `src/features/document-generation/domestic-resumes.ts` design `4` | Contemporary Sidebar | Unavailable |
| `domestic-resume-5` | `src/features/document-generation/domestic-resumes.ts` design `5` | Premium Minimal | Unavailable |
| `gcc-resume` | `src/features/document-generation/gcc-resume.ts` | GCC regional | Unavailable |
| `europass-eu-resume` | `src/features/document-generation/european-resume.ts` | European / EU | Unavailable |
| `general-corporate-cover-letter` | `src/features/document-generation/cover-letters.ts` | General Corporate | Unavailable |
| `international-relocation-cover-letter` | `src/features/document-generation/cover-letters.ts` | International Relocation | Unavailable |
| `technology-startup-cover-letter` | `src/features/document-generation/cover-letters.ts` | Technology & Startup | Unavailable |

The output order and package authorization boundary remain defined by `V1_DOCUMENT_OUTPUTS` in `package-routing.ts`. No candidate facts from a reference will be copied into any generator.

## Required follow-up when the directory is available

1. Record relative path, extension, size, modified time and SHA-256 for every file.
2. Group identical hashes and identify near-duplicate filenames separately.
3. Render every PDF page to PNG and inspect typography, spacing, pagination and repeated elements.
4. Extract target titles from HTML/PDF metadata and visible page headings.
5. Resolve exactly one primary target for each frozen output; list unused or ambiguous assets.
6. Preserve the existing structured-profile mapping, package entitlements, private storage and version history while implementing visual changes.
