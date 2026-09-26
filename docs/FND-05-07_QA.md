# FND-05-07 account provisioning QA

Run the focused regression suite with `node --test tests/fnd-05-07.test.mjs`.
It exercises the real server actions, provisioning service, authorization, and
browser auth service with isolated Supabase test doubles. It does not write test
users or candidate data to the remote project.

## Verified on 2026-09-26

| Area | Result | Evidence |
| --- | --- | --- |
| Admin-only route access | Pass for anonymous requests | Production server returned 307 to `/login?portal=admin` for `/admin`, `/admin/clients`, `/admin/clients/new`, and a direct edit URL. |
| Server-side admin checks | Pass with test doubles | Client role was rejected by provisioning and edit services. |
| Client creation and generated credential | Pass with test doubles | Auth creation, 20-character mixed-class password, confirmed email, `client` role, and candidate link were asserted. |
| Active and disabled provisioning | Pass with test doubles | Both statuses were recorded as requested. |
| Duplicate email and candidate | Pass with test doubles | Duplicate requests left the existing records unchanged. |
| Missing candidate and weak/malformed input | Pass with test doubles | Requests were rejected before creating an Auth user. |
| Package assignment and change | Pass with test doubles and live read-only SQL | Package code and matching target markets were asserted; live linked profiles have no package/market mismatch. |
| Invalid package | Pass with test doubles | Invalid code was rejected without changing data. |
| Email edit, deactivation, reactivation | Pass with test doubles | Auth email, profile email, status, package, and unchanged candidate link were asserted. |
| Cross-role and disabled access | Pass with test doubles | Admin/client role separation and disabled-client denial were asserted. |
| Client login and logout | Pass with test doubles | Client login target and local-scope sign-out were asserted. |
| Client session persistence after refresh | Requires signed-in browser QA | SSR cookie refresh plumbing was reviewed; no test account password was available for a live refresh test. |
| No plaintext password in profile/role storage | Pass | The regression test found none in persisted test-double rows; live public profile/role tables have no credential columns. |
| Secret absent from browser assets | Pass | The configured secret value was absent from all `.next/static` files. |

Live read-only integrity checks returned zero invalid client package references,
duplicate profile links, users linked to multiple profiles, invalid statuses,
invalid roles, package/market mismatches, linked clients missing Auth users,
linked email mismatches, and unconfirmed linked client emails. The project has
seven package definitions and one admin role row.

One older `client` role row has no candidate-profile link. The migration allowed
this pre-existing row; current authorization denies it client portal access.
The QA run left it unchanged.

## Signed-in manual completion

Using an approved fictional admin/client test pair, perform these checks in the
application and record the results before treating live end-to-end QA as complete:

1. Admin signs in, opens `/admin/clients/new`, creates an active client, copies
   the one-time generated credential, and checks the new Auth user is confirmed.
2. Client signs in, refreshes `/client`, signs out, then confirms direct `/client`
   access redirects to login.
3. Admin attempts duplicate email, duplicate candidate, malformed email, and
   weak manual password; each must show a safe error without a second account.
4. Admin changes package and email, then checks the candidate package, target
   markets, Auth email, and unchanged profile link.
5. Admin deactivates and reactivates the client. During deactivation, the client
   must be denied `/client`; afterward access must return.
6. Client attempts `/admin/clients/new` and a direct edit URL; both must be denied.
