# WeatherOps — Replit

## Menjalankan

Environment wajib menyediakan `DATABASE_URL` untuk PostgreSQL dengan PostGIS
aktif. Node.js 24.x dan npm digunakan oleh proyek ini.

```bash
npm install
npm run db:migrate
npm run dev
```

API berjalan pada port dari `PORT` (default `3000`). Health check:

```bash
curl http://127.0.0.1:3000/api/v1/system/health
```

Pemeriksaan kualitas:

```bash
npm run typecheck
npm test
npm run lint
```

## Penyimpanan provider cuaca

Migration `0004_weather-source-registry` menyediakan katalog provider di
`weather_sources` untuk sumber `domestic` dan `international`, serta audit
immutable setiap panggilan di `weather_api_responses`. Respons canonical yang
digunakan cache tetap disimpan di `weather_snapshots`. Provider baru sebaiknya
mengikuti kontrak `WeatherProvider` dan mendaftarkan `code` serta `adapter_key`
tanpa mengubah tabel inti.

Phase 0 hanya menyediakan scaffold, database migration PostGIS, middleware
dasar, dan endpoint health check. Logika bisnis dan integrasi BMKG belum
diimplementasikan.