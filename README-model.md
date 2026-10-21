# Geometri konsep C2

`model.js` berisi model prosedural dengan satuan **milimeter**. Model memiliki 31 kelompok komponen dan 163 mesh, sekitar 37.748 segitiga. Semua mesh memiliki permukaan tertutup pada pemeriksaan sisi yang dilas berdasarkan posisi hingga ketelitian 0,001 mm; orientasi volumenya positif. Ini pemeriksaan geometri, bukan pembuktian kekuatan, kecocokan komponen, atau kelayakan cetak rakitan.

## Pemakaian modul

```js
const model = createShowerModel(THREE);
scene.add(model.root);
model.setState({
  water: true,
  soap: false,
  exploded: 0,
  cutaway: true,
  cartridgeOut: false,
  capOpen: false,
  waterPress: 0,
  soapPress: 0
});
```

Nilai `exploded`, `waterPress`, dan `soapPress` berada dalam rentang 0 sampai 1. `setState` selalu menghitung ulang transformasi dari keadaan dasar sehingga pemanggilan berulang tidak menumpuk perpindahan. Sumbu panjang adalah Y, muka kontrol menghadap +Z.

Keluaran fungsi:

- `root`: grup seluruh rakitan.
- `parts`: metadata kelompok dengan `id`, `label`, `category`, `description`, dan `object`.
- `actuators`: paddle, inti katup, kartrid, tutup, belahan casing, dan dua bagian Venturi.
- `paths`: lintasan `waterPath`, `soapPath`, dan `mixedPath`, masing-masing array `THREE.Vector3` dalam koordinat lokal `root`.
- `dimensions`: ukuran nominal visual serta statusnya.
- `setState`: pengaturan keadaan dan posisi.

## Apa yang diperagakan

Paddle AIR dan SABUN dapat ditekan pada model. Inti katup berlubang berputar untuk memperlihatkan keadaan terbuka atau tertutup. Konstruksi inti putar adalah ilustrasi keadaan katup, **bukan penetapan kinematika modul tekan dua keadaan yang akan dibeli**. Cam, penghubung, dan rumah modul belum merupakan mekanisme produksi yang telah direkayasa.

Penampang Venturi memperlihatkan jalur menyempit lalu membesar dan port isap samping. Angka dimensinya tidak dipilih dari analisis fluida. Animasi air/sabun pada penampil hanya peragaan arah aliran; bukan CFD atau bukti sabun akan terisap pada tekanan keran tertentu.

Batang atas digambarkan panjang 520 mm agar bentuk aslinya tetap terbaca. Nilai tersebut **bukan hasil pengukuran unit asli**. Diameter pipa, ulir, dimensi injektor, dan fitting masih representatif.

Titik gelap di muka pancuran berupa penanda visual, belum berupa lubang bor tembus. Tekstur spons dibuat sederhana. Isi cairan kartrid dan selang digambarkan sebagai geometri untuk kebutuhan tampilan. Semua ini perlu dihilangkan atau dirancang ulang pada CAD manufaktur.

Ekspor rakitan dilakukan dari keadaan `exploded:0`, `cutaway:false`, `cartridgeOut:false`, dan `capOpen:false`. Seluruh mesh, termasuk komponen internal, dapat diekspor. Rakitan STL memiliki banyak solid yang dapat saling menyentuh/bertumpang tindih dan bukan benda satu bagian siap dicetak. Untuk merancang casing nyata, gunakan mesh belahan casing sebagai referensi bentuk lalu sesuaikan komponen dan pengukuran aktual.
