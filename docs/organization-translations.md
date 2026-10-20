# Localized organization names

API clients send the stored UI locale in `Accept-Language`. Department and position display names now come from the backend database, including dashboard charts/tables, profile assignments, meeting audience and participants, and author/reaction job titles. Personal names and post content remain original.

`LocaleCacheSync` resets RTK Query state when the persisted locale changes (including another tab's storage event). Active query hooks refetch; old pending query responses cannot populate the replacement cache. This covers independently generated department, position, profile, staff, organization, current-user and post APIs. Re-selecting the same locale does not reset caches.

Meeting data fetched outside RTK Query owns its locale. Participant profile caches are invalidated by locale/session, reload selected IDs, hide stale values immediately, and ignore responses after abort. Search suggestion loaders and department labels refetch when locale changes. Department suggestions now search on the backend across original names and all translations; `/dao tao` can therefore find an English-displayed Training department. Search does not depend on the visible localized text.

Department/position read DTOs include `originalName`. Future editors must bind that field and send it in update requests instead of editing localized `name`. Original IDs/codes remain the identity and all selection keys remain ID-based.

API schema and generated client include the optional position `Search` query parameter and the original-name read/edit contract. Regenerate after backend schema changes with `npm run api:fetch` and `npm run api:generate` against the updated Web process. Preserve existing unrelated localization changes when reviewing the resulting diff.

Tests in `src/shared/i18n/organizationLocale.test.tsx` exercise pending and completed participant cache transitions and an active RTK profile query during a delayed old-locale response. The existing meeting tests' selectors were aligned with labels already changed by the prior localization edits; unrelated UI strings were not translated for this feature.

Backend migration/setup/search details: [organization-translations.md](../../Portal.BE/docs/organization-translations.md). Final verification and exact feature paths are in `docs/organization-translations-verification.md`.
