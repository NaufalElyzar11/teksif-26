# Model 3D shower adaptif C2

Model ini adalah geometri konsep untuk melihat susunan alat dan mencoba keadaan kontrol. Model belum merupakan CAD fabrikasi atau komponen bertekanan yang siap dicetak.

## Berkas

- `viewer-shower-C2.html`: buka langsung di Chrome/Edge, tanpa instalasi atau internet. Putar/zoom, coba AIR dan SABUN, lihat bagian dalam, urai rakitan, lepas kartrid, dan buka tutup. Pada tampak Venturi dengan bagian dalam aktif, kepala dan spons disisihkan agar penampang pencampur terlihat.
- `shower-C2.glb`: rakitan bernama dengan warna/material dan hierarki komponen. Bila ada, klip `Air_buka_tutup` dan `Sabun_buka_tutup` hanya menggambarkan perubahan keadaan.
- `shower-C2.obj` dan `shower-C2.mtl`: geometri rakitan dan warna. Simpan keduanya dalam folder yang sama ketika diimpor.
- `shower-C2.stl`: geometri rakitan sebagai satu berkas. STL tidak menyimpan warna, nama komponen, atau animasi.
- `parts-C2.json`: daftar bagian dan ukuran konsep.
- `geometry-check.json`: jumlah mesh/segitiga, batas geometri, dan pemeriksaan struktur ekspor.
- `model.js`, `exports.js`, dan `export-model.mjs`: sumber parametrik dan eksportir, dengan pustaka lokal pada `vendor/`.

## Satuan dan ukuran

OBJ dan STL menggunakan angka dalam **milimeter**; format tersebut tidak menetapkan satuan baku, sehingga pilih milimeter saat impor. GLB mengonversi posisi dan translasi menjadi **meter**, sesuai glTF.

Gagang nominal sekitar 190 x 42 x 45 mm dan pipa nominal 520 mm merupakan ukuran ilustrasi. Pipa asli belum diukur. Ukuran katup lengkap, ulir, seal, sambungan, ventilasi kartrid, dan posisi kontrol harus ditentukan sebelum CAD produksi. Model dapat memuat bagian yang saling beririsan karena fungsinya sebagai studi susunan rakitan; jangan mencetak seluruh STL sebagai alat yang akan menahan air.

## Mekanisme yang dapat dicoba

Kontrol air dan katup sabun adalah dua keadaan terpisah. Jika SABUN dipilih ketika AIR mati, pilihan tetap tersimpan tetapi tidak ada hisapan Venturi. Membuka AIR kembali memakai pilihan SABUN yang masih aktif. Gerak pengunci dan komponen katup ditampilkan secara ilustratif; mekanisme komersial dan gaya yang cocok untuk pengguna belum dipilih.

Aliran bergerak adalah skema keadaan, **bukan CFD**, prediksi debit, kekuatan hisapan, atau kadar sabun. Waktu animasi dan klip GLB bukan waktu nyata. Priming, orientasi, tekanan pasokan, kekentalan sabun, jeda bilas, kebocoran, dan perlindungan aliran balik perlu diuji pada prototipe fisik. Air tidak otomatis mati ketika alat terjatuh.

## Pembuatan ulang ekspor

Dengan Node.js tersedia, jalankan `node export-model.mjs` dari folder ini. Tidak ada unduhan paket atau koneksi jaringan saat ekspor. Pustaka Three.js tersimpan lokal dengan lisensi MIT pada `vendor/LICENSE-three.txt`.

Untuk membuat ulang viewer lokal setelah mengedit model, jalankan `node build-viewer.mjs`. Tampilan bagian dalam menggeser paddle ke samping untuk inspeksi; perpindahan tersebut bukan gerak saat alat dioperasikan. Klik paddle pada model atau tombol AIR/SABUN di atas layar untuk mencoba keadaan kontrol.
