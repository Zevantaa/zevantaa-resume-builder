# SEC-01 access-control matrix

`D` = denied; `own` = only linked active client's record; `admin` = active administrator after server check; `server` = trusted server service-role after caller authorization. Anon/authenticated SQL grants do not substitute for these application checks.

| Resource/action | Anonymous | Client | Admin | Service role |
| --- | --- | --- | --- | --- |
| Client dashboard/profile | D | own | D | server |
| Admin dashboard/directory | D | D | admin | server |
| Core identity/contact/package mutation | D | D | admin | server |
| Career sections/save | D | own | review/administrative workflows | server |
| Source CV/GCC photo upload/download | D | own permitted use | admin review | server |
| Generated document download | D | entitled own output | admin generation/review | server |
| Privacy-masked employer PDF | D | D | admin | server |
| Auth account create/edit/disable | D | D | admin | server |
| Brand settings/asset mutation | D | D | admin | server |
| Skill library mutation | D | D | admin | server |
| `user_roles` SQL read | D | own row only | own row only | server |
| Other protected SQL tables/storage | D | D | D | server |

Browser-visible brand assets are routed through an application endpoint, not a public candidate bucket. The temporary extraction/PDF QA routes remain protected but should be removed or feature-gated before production release. Each new service-role route must document its exact caller and ownership check.
