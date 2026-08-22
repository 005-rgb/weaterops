# WeatherOps — Replit

## Menjalankan

Environment wajib menyediakan `DATABASE_URL` untuk PostgreSQL dengan PostGIS
aktif. Node.js 24.x dan npm digunakan oleh proyek ini. Untuk board anonim,
`SESSION_KEY_SALT` digunakan untuk hash satu arah `X-Session-Key`; raw UUID
tidak pernah disimpan.

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

## Fase 6 — geospasial dan peta operasional

Endpoint geospasial:

```text
GET /api/v1/locations?level=adm1|adm2|adm3|adm4&parentCode=...
GET /api/v1/locations/resolve?lat=...&lng=...
GET /api/v1/locations/:adm4/boundary
GET /api/v1/locations/search?q=...&viewportLat=...&viewportLng=...
GET /api/v1/geospatial/hazard-heatmap?bounds=west,south,east,north
```

`resolve` menggunakan `ST_Contains` dengan urutan koordinat PostGIS
longitude-lalu-latitude dan fallback `adm4 → adm3 → adm2 → adm1`.
`boundary` mengembalikan GeoJSON tersederhana dan menyimpan cache
`geometry_simplified`; toleransi dapat diatur dengan
`BOUNDARY_SIMPLIFY_TOLERANCE` (default `0.001` derajat).

Frontend React + MapLibre tersedia di root preview dalam Mode A (location
picker) dan Mode B (tracking dashboard). Tile OpenFreeMap yang dipakai saat
development bukan keputusan provider produksi; provider produksi dan
persyaratan atribusinya harus dikonfirmasi manusia sebelum go-live. Jika
WebGL/tile gagal, dropdown hierarkis dan list analisis tetap tersedia.
Heatmap diberi label sebagai agregasi hazard cuaca, bukan skor risiko proyek.
Jalankan `npm run benchmark:geospatial` untuk benchmark p95 100 iterasi ketika
database PostGIS dan seed sudah tersedia.

## Fase 4 — analisis dan report

Endpoint analisis:

```text
POST /api/v1/analyses
GET  /api/v1/reports/:publicToken
POST /api/v1/reports/:publicToken/report.pdf
```

`POST /analyses` memvalidasi lokasi adm4, activity aktif, waktu terjadwal, dan
menyimpan request, hasil, reasons, serta evidence dalam satu transaksi. Report
HTML dibuat sekali dan dibaca kembali dari `report_snapshots` pada request
berikutnya, sehingga tidak ada silent recalculation. Endpoint PDF saat ini
menggunakan generator synchronous placeholder berbentuk data URL; renderer PDF
ber-styling final direncanakan untuk Fase 10.

`publicToken` adalah satu-satunya jalur akses report publik; UUID internal tidak
dipakai sebagai jalur tersebut. Error API menggunakan bentuk:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "..." } }
```

Migrasi database dan golden integration tests memerlukan `DATABASE_URL` dengan
PostgreSQL/PostGIS aktif. Tanpa koneksi tersebut, unit test/typecheck/lint tetap
dapat dijalankan, tetapi endpoint database akan berstatus degraded.

## Fase 5 — i18n

Locale hanya menerima `id` atau `en`. Gunakan `?lang=id|en` sebagai override
`Accept-Language`; default-nya `id`. `POST /api/v1/analyses` menyimpan locale
saat request dibuat, sedangkan report dapat dirender ulang dalam locale lain
tanpa menghitung ulang keputusan. Setiap kombinasi analysis dan locale memiliki
snapshot immutable sendiri. Katalog di-cache in-memory selama lima menit dan
diisi oleh migration `0007_translation-catalog`.

Terjemahan awal sengaja `reviewed_by_human=false`. Review makna substantif oleh
penutur asli/profesional bilingual masih harus dijadwalkan terpisah pada Fase 11;
test hanya memverifikasi kelengkapan struktur dan invariant bahasa-netral.

## Fase 7 — Session Board

Board bersifat implisit: analisis dengan `X-Session-Key` otomatis masuk ke
kumpulan session tersebut; `POST /api/v1/session-boards` hanya memberi label.
Akses board memerlukan UUID asli melalui header dan membandingkan hash header
dengan hash di path. Retensi board diperpanjang tujuh hari setiap aktivitas,
selaras dengan analisis. `regional-trend` hanya membaca slot cuaca tersimpan
dan tidak memanggil BMKG.