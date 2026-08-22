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

## Memulihkan baseline saat pindah akun

Baseline referensi disimpan di migration dan seed yang ikut masuk Git. Pada
workspace atau akun baru, isi `DATABASE_URL` dengan database tujuan lalu jalankan:

```bash
npm run db:bootstrap
```

Perintah ini idempoten dan tidak menghapus activity yang sudah ada. Response API
live tidak dianggap seed permanen karena memiliki retention dan expiry; bila
histori jangka panjang diperlukan, lakukan backup/restore database terpisah.

Provider API dapat dikelola melalui `GET/POST /api/v1/weather/sources`,
`PATCH /api/v1/weather/sources/:id`, dan `DELETE /api/v1/weather/sources/:id`.
Delete bersifat soft-delete (`enabled=false`) sehingga histori tidak hilang.

Phase 0 hanya menyediakan scaffold, database migration PostGIS, middleware
dasar, dan endpoint health check. Logika bisnis dan integrasi BMKG belum
diimplementasikan.