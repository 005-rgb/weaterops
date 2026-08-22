# i18n

The backend catalog is stored in `translation_catalog` and seeded by migration
`0007_translation-catalog`. `resolveText` keeps an in-memory copy for five
minutes, with one shared refresh query when the cache expires. This is suitable
for the mostly-static catalog while still allowing edits to become visible
without restarting the process.

Use `?lang=id|en` for an explicit report locale. Otherwise the locale middleware
accepts the first supported `Accept-Language` value and defaults to `id`.
Report snapshots are immutable per `(analysis_result_id, locale)`.

The frontend JSON namespaces under `src/frontend/locales/` are preparation for
the frontend phase; no frontend components are implemented here.