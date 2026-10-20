# Organization translations: FE verification and exact overlays

Existing dirty localization/session/benchmark changes were preserved. The feature adds/overlays only these paths relative to `Portal.FE`:

```text
docs/organization-translations.md
docs/organization-translations-verification.md
openapi/portal-api.json
src/core/providers.tsx
src/features/meetings/calendarEvents.ts
src/features/meetings/components/MeetingAudiencePicker.tsx
src/features/meetings/components/ParticipantPicker.tsx
src/features/meetings/components/MeetingBookingUI.test.tsx
src/features/meetings/components/MeetingCalendar.test.tsx
src/shared/api/baseQuery.ts
src/shared/api/fetchProtected.ts
src/shared/api/generated/portalApi.ts
src/shared/i18n/LocaleCacheSync.tsx
src/shared/i18n/organizationLocale.test.tsx
```

Verification:

- `npm test`: **35 files / 201 tests PASS**. Controller independently confirmed the same result.
- `npm test -- src/features/meetings/components/MeetingBookingUI.test.tsx src/features/meetings/components/MeetingCalendar.test.tsx`: **34/34 PASS** after aligning preexisting localized-label assertions.
- `npm test -- src/shared/i18n/organizationLocale.test.tsx`: **3/3 PASS** after final API client regeneration (completed participant cache, delayed old participant response, delayed old RTK profile response).
- `npm run typecheck`: **PASS** after final API client regeneration.
- `npm run build`: **PASS** after final API client regeneration; controller also confirmed the earlier production build.
- `npm run api:fetch` and `npm run api:generate`: **PASS** against updated Web on port 5128. Before writing the spec, a semantic comparison identified only six expected changed operations/schemas, retaining prior dirty spec edits. Generated meeting endpoints are from the meeting contract already present in that dirty spec.
- Runtime API requests through the FE proxy on port 3000 returned `Department Head` / `Information Technology Department` in English. Backend charts, profile assignments, and meeting audience/departments returned their English values and original Vietnamese values under the corresponding header.

Expected warning output in meeting error-path tests is unrelated to this feature. No final failing tests or type errors remain. The independent reviewer reported the three requested findings resolved. No commit or push has been performed.

Full backend/runtime report: [organization-translations-verification.md](../../Portal.BE/docs/organization-translations-verification.md). Migration/setup/search semantics: [organization-translations.md](../../Portal.BE/docs/organization-translations.md).
