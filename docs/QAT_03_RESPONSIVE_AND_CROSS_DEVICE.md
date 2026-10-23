# QAT-03 — Responsive and cross-device QA

Date: 2026-10-13. Branch: `develop`. This pass preserves the uncommitted QAT-01/02 work. No production credentials, account data, migration, commit, or push were used.

## Evidence and limits

- `node scripts/qa-responsive-browser.mjs` uses local headless Chrome with explicit device metrics, visits `/login`, measures document/control bounds, and fails on page-level horizontal overflow. It passed at 1440×900, 1365×768, 1024×768, 768×1024, 390×844, 360×800, and 320×700. A 390×844 screenshot was inspected locally; the form and portal switch fit. Temporary screenshots/browser profiles were removed.
- `tests/qat-03-responsive.test.mjs` checks key responsive CSS/markup contracts and validates a fictional career draft with 8 work roles, 5 education entries, 10 certifications, 10 projects, and 26 skills. It does **not** replace interaction/visual testing of an authenticated editor.
- Existing download/authorization/upload regression tests cover server behavior independently of viewport width. A browser viewport does not change HTTP download headers or server-side ownership checks.
- This run had no QA login credentials. Protected admin/client screens could not be visually or interactively inspected in Chrome. The source evidence below is not a claim of a live-device pass.

| Item | Viewport / expected behavior | Automated/source evidence | Live/manual evidence still required | Bugs found/fixed | Result |
| --- | --- | --- | --- | --- | --- |
| QAT-03-01 Desktop | 1440×900, 1365×768: login and protected workspaces should use width without clipping, overlap, or body overflow. | Chrome login probe passed at both widths; dashboard max-widths, local table scroll, and wrapping rules reviewed. | Sign in as admin/client and inspect dashboard, career editor, intake, ATS, documents, directory, edit, review, generator workspaces, and appearance at both widths. | None proven on protected desktop screens. | **Partial:** login verified; protected screens pending. |
| QAT-03-02 Tablet | 1024×768, 768×1024: navigation, editor, fields, table actions, calendar, and save bar usable. | Chrome login probe passed; editor has one-column adaptation below 61rem, scrollable section navigation, anchored date popover, independently scrollable content, and a separate save row. Targeted source tests pass. | Authenticated tablet checks of all editor interactions, date picker, admin table, save bar, and keyboard focus. | Directory filters previously retained four minimum-width columns from 48rem; now two columns until 64rem. | **Partial:** static fix and login verified; protected interaction pending. |
| QAT-03-03 Mobile | 390×844 plus 360/320: no page overflow, clipped headings, inaccessible actions, or off-screen popovers. | Chrome login probe passed at all three widths; screenshot inspected at 390. Career/nav/card stacking, wrap and popover rules have source assertions. | Authenticated mobile device/browser pass, including 100/125/200% zoom, focus order, taps, toast/modals, and long content. | Login grid given a shrinkable track; long career entry titles and skill chips may wrap instead of expanding the page. | **Partial:** login verified; protected screens/zoom pending. |
| QAT-03-04 Tables | 768/390/320: directory scrolls locally, first columns understandable, actions reachable. | `.table-container` owns horizontal scrolling; directory has 70rem table minimum, keyboard-focusable labelled scroll region, sticky action column below 64rem. Targeted source test passes. | At narrow widths, scroll a populated admin directory horizontally and activate row actions by touch and keyboard. | Tablet filter grid corrected; no table-data defect proven. | **Partial:** source covered; populated table QA pending. |
| QAT-03-05 Forms | 768/390/320: login, account create/edit, intake, career, review, appearance inputs usable. | Login form fits measured viewport; form/control focus and stacking rules reviewed; upload inputs constrained; skill results shrink below 12rem. Stress draft validated at requested row counts. | Actual entry, validation messages, long filenames, picker open/close, and keyboard-focus scroll on protected forms. | Narrow upload/file input and skill grid bounds strengthened. | **Partial:** login and source/data checks; protected forms pending. |
| QAT-03-06 Mobile PDF | 390/320: download controls reachable; PDF response and filename preserved. | Client dashboard/workspace use normal protected download links. Existing DSH-02 regression asserts private PDF response, cache headers, filename, and ownership; targeted QAT-03 source test covers link presence. | Signed-in mobile click/open/download, loading state, and native PDF viewer behavior on iOS/Android. | None found. | **Partial:** server route covered; real mobile download pending. |
| QAT-03-07 Mobile uploads | 390/320: resume, GCC photo, brand upload fit; selected filename/errors wrap; save reachable. | Intake shows selected filename and saving state; private upload restrictions covered by existing FND-06 tests. File inputs constrained to their column; filename text already wraps. Brand asset input shares the width rule. | Signed-in client/admin selects unusually long filenames, triggers errors, uploads/replaces each allowed file, and checks progress at mobile widths. | File-input min-width/width constraint added. | **Partial:** source/server checks; browser file-picker flow pending. |

## Accessibility-responsive checks

The stylesheet retains `:focus-visible` outlines and `prefers-reduced-motion: reduce`; controls are not intentionally hidden to remove overflow. The menu remains available below 40rem. The date picker is positioned from the trigger and clamped to viewport width. These are source checks; 125/200% browser zoom, screen reader announcements, touch target size, and focus scrolling require authenticated browser/device inspection.

## Manual completion matrix

Use a non-production admin and client account. Repeat at the listed desktop/tablet/mobile widths, including 320px and 125/200% zoom. Populate a fictional career profile with 8 roles, 5 education entries, 10 certifications, 10 projects, and at least 26 skills. For each protected route, record screenshots and `document.documentElement.scrollWidth <= window.innerWidth`; check navigation, horizontal table scrolling, actions, text wrapping, calendar anchoring, save bar, PDF open/download, and resume/photo/brand uploads. Do not record real candidate data or credentials in evidence.

## Verification snapshot

- Targeted QAT-03 source/data tests: 5/5 passed.
- Full regression suite: 326/326 passed.
- Local Chrome login viewport assertions: 7/7 passed.
- ESLint and production build: passed.
- Production dependency audit: zero known vulnerabilities.
- Secret scan and `git diff --check`: passed (Git reported line-ending conversion warnings only).
- Overall status: **partial / live QA pending**. The public login and automated/source checks pass, but authenticated cross-device interactions and physical-device PDF/file-picker behavior have not been witnessed in this run.
