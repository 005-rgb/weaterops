# WeatherOps — Riset API dan Batas Verifikasi

Tanggal riset: 22 Agustus 2026 (Asia/Jakarta)

## Ringkasan keputusan

WeatherOps menggunakan adapter BMKG yang endpoint-nya dikonfigurasi melalui
`BMKG_BASE_URL`. URL produksi dan format live tidak ditanam di kode sampai
diverifikasi manusia/QA. Dokumen ini mencatat sumber publik yang ditemukan,
kegunaan masing-masing API, dan batas implementasi yang aman.

## Sumber resmi yang ditemukan

### 1. Prakiraan cuaca BMKG

- Portal data terbuka: <https://data.bmkg.go.id/>
- Halaman data prakiraan: <https://data.bmkg.go.id/prakiraan-cuaca>
- Contoh halaman lokasi berdasarkan kode wilayah:  
  <https://www.bmkg.go.id/cuaca/prakiraan-cuaca/36.74.01.1002>
- Kegunaan: prakiraan cuaca kelurahan/desa hingga 3 harian.
- Status: sumber resmi teridentifikasi, tetapi endpoint machine-to-machine,
  format response live, persyaratan akses, dan rate limit tetap harus
  dikonfirmasi sebelum produksi.

### 2. Peta curah hujan dan hari hujan

- Portal Data API Satu Peta MKG: <https://gis.bmkg.go.id/portal/dataapi>
- MapServer publik yang tercantum portal:  
  <https://gis.bmkg.go.id/arcgis/rest/services/Peta_Curah_Hujan_dan_Hari_Hujan_/MapServer>
- Format yang tercantum: WMS/map service.
- Kegunaan: overlay dan analisis spasial historis curah hujan serta jumlah
  hari hujan. Belum dimasukkan ke modul forecast Fase 2.

### 3. Peta potensi energi angin

- Portal Data API Satu Peta MKG: <https://gis.bmkg.go.id/portal/dataapi>
- FeatureServer publik yang tercantum portal:  
  <https://gis.bmkg.go.id/arcgis/rest/services/Hosted/Peta_Potensi_Energi_Angin/FeatureServer>
- Format yang tercantum: WFS/Feature Layer.
- Kegunaan: overlay potensi angin untuk analisis spasial. Belum dimasukkan
  ke modul forecast Fase 2.

### 4. Batas administrasi dan kode lokasi

Sumber yang perlu dievaluasi lebih lanjut adalah BIG/Ina-Geoportal, Satu Data
Indonesia, dan data resmi Kemendagri. Belum ada sumber yang cukup terverifikasi
untuk membuat mapping `bmkg_adm4_code` ke kode Kemendagri secara aman.
Implementasi tidak mengarang mapping; polygon lookup dan mapping menjadi fase
terpisah setelah struktur kode dikonfirmasi.

## Kontrak implementasi Fase 2

Modul weather hanya melakukan:

1. HTTP client BMKG dengan timeout, retry 5xx/timeout/network, dan rate limit.
2. Penyimpanan response mentah untuk forensik.
3. Validasi response dengan schema asumsi yang longgar terhadap field tambahan.
4. Normalisasi slot ke canonical weather model; field yang tidak tersedia
   menjadi `null`, sedangkan deskripsi yang belum dikenal menjadi `UNKNOWN`.
5. Cache immutable snapshot dan freshness check.
6. Contract-test harness terpisah untuk dijalankan manusia terhadap API live.

### Penyimpanan dan penambahan provider

Setiap provider didaftarkan di `weather_sources` dengan `code`, tipe
`domestic`/`international`, dan `adapter_key`. Setiap panggilan upstream dicatat
di `weather_api_responses`, termasuk body JSON mentah, status HTTP, parameter,
durasi, dan error bila ada. `weather_snapshots` tetap menjadi cache canonical
yang dipakai aplikasi; tabel audit tidak menggantikannya.

Provider baru wajib mengimplementasikan kontrak `WeatherProvider`: mengambil
forecast, memvalidasi schema miliknya sendiri, lalu menormalisasi ke canonical
weather model. Dengan begitu perubahan format BMKG maupun penambahan API
internasional tidak memaksa perubahan tabel inti atau adapter lain.

Modul ini **tidak** membuat keputusan aktivitas, scoring, atau hazard mapping.

## Asumsi yang wajib diverifikasi manusia

- `BMKG_BASE_URL` dan pola URL lokasi.
- Bentuk JSON live, termasuk struktur `data[].cuaca`.
- Daftar nilai `weather_desc` yang benar-benar dikembalikan.
- Makna dan timezone `datetime`; adapter sementara memperlakukan timestamp
  tanpa offset sebagai WIB.
- Ketersediaan dan frekuensi `source_updated_at`/`updated_at`.
- Rate limit resmi BMKG.
- Ambang freshness 60 menit.
- Kesesuaian kode administrasi BMKG dengan kode Kemendagri.
- Bukti contract test staging berulang selama minimum 72 jam.

Daftar di atas adalah batasan rilis, bukan klaim bahwa verifikasi live sudah
selesai. Nilai asumsi ditandai di kode dengan komentar `ASUMSI — verifikasi
§13a.1`.

## Cara menjalankan verifikasi live

Setelah product owner/QA mengonfirmasi endpoint dan persyaratannya:

```bash
BMKG_BASE_URL=<verified-url> npm run bmkg:contract -- <location-code>
```

Perintah ini sengaja tidak dijalankan otomatis dalam test suite biasa.