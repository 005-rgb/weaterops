# Decision Engine

Decision engine Fase 3 adalah pure function: ia hanya menerima forecast,
activity profile, jadwal, dampak operasional, umur snapshot, dan batas horizon.
Ia tidak mengakses database, HTTP, waktu sistem, random, atau environment.

## Versioning

- `SCORING_VERSION` berubah saat formula hazard/scoring berubah.
- `DECISION_ENGINE_VERSION` berubah saat aturan status, confidence, reason, atau
  alternative window berubah.

## Formula

```text
weighted hazard = hazard score × profile sensitivity × phase weight
risk score = round(sum(weighted hazard) / sum(profile sensitivity × phase weight))
             × operational impact multiplier
```

`phase weight` adalah `1.0` saat pekerjaan berlangsung dan `0.85` selama
critical window setelah pekerjaan. Hasil akhir selalu dibatasi 0..100.
Satu slot hazard tinggi dengan sensitivitas tinggi selalu mengaktifkan critical
slot override sehingga hasil tidak boleh `PROCEED`, walaupun rata-rata rendah.

Reason hanya menggunakan kode terdaftar dan selalu membawa `evidenceRefs`;
translation text menjadi tanggung jawab fase berikutnya.