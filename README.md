# Shower adaptif C2 - GitHub Pages

Situs statis untuk memperlihatkan model 3D kepada klien. Tidak membutuhkan npm, Node.js, database, akun pengunjung, atau koneksi CDN saat dijalankan. Tidak ada proses unggah atau deployment otomatis pada paket ini.

## Menjalankan secara lokal

Buka `index.html` di Chrome atau Edge. Pastikan folder `assets` dan `downloads` tetap berada di sebelahnya. Untuk uji melalui HTTP, jalankan server statis dari folder ini, misalnya `python -m http.server 8000`, kemudian buka `http://localhost:8000/`.

## Mengunggah ke GitHub Pages

1. Ekstrak ZIP paket situs. Unggah **isi foldernya**, sehingga `index.html`, `.nojekyll`, `assets/`, dan `downloads/` langsung berada di akar repository. Jangan hanya mengunggah berkas ZIP atau `index.html` sendirian.
2. Di repository GitHub, buka **Settings > Pages**.
3. Pada **Build and deployment**, pilih **Deploy from a branch**.
4. Pilih branch tempat berkas disimpan (misalnya `main`), lalu pilih **/(root)** dan **Save**.
5. Setelah GitHub selesai menerbitkan situs, buka alamat yang ditampilkan di halaman Pages. Untuk repository proyek, alamat biasanya `https://NAMA-AKUN.github.io/NAMA-REPOSITORY/`.

Semua alamat aset memakai jalur relatif sehingga situs dapat berjalan di alamat proyek seperti `/nama-repository/`. Tidak perlu mengedit URL script atau CSS sebelum diunggah.

Panduan resmi:
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Isi paket

- `index.html`: halaman utama untuk klien.
- `assets/styles.css`: tata letak dan gaya antarmuka.
- `assets/app.js`: mesin 3D, geometri, dan kontrol, dibundel tanpa dependensi jaringan.
- `assets/preview.png`: ilustrasi cadangan bila WebGL tidak tersedia.
- `assets/LICENSE-three.txt`: lisensi MIT Three.js.
- `downloads/`: GLB, OBJ/MTL, STL, rancangan PDF, dan paket sumber model 3D.
- `src/viewer.js`: sumber pengendali viewer untuk pengembangan berikutnya. Perubahan pada sumber ini perlu dibundel ulang sebelum tampil; pengeditan HTML dan CSS langsung terbaca saat halaman dimuat ulang.

## Penggunaan

- Geser model untuk memutar, gulir/cubit untuk zoom, atau gunakan tombol zoom di kanvas.
- Pilih tampak Utuh, Gagang, atau Venturi. Tombol keyboard panah memutar model; plus/minus mengatur zoom, dan 0 mengembalikan tampilan utuh saat kanvas menerima fokus.
- Nyalakan air, pilih sabun, lalu kembali ke bilas. Katup sabun mempertahankan pilihannya ketika air mati; tidak ada interlock fisik otomatis.
- Gunakan Bagian dalam, Urai komponen, dan pilihan bagian untuk pemeriksaan. Buka Kartrid & isi ulang untuk melepas kartrid/tutup secara visual.

Model dan aliran merupakan demonstrasi konsep. Gerak pengunci, ukuran komponen, tekanan, dosis, orientasi, dan gaya tekan belum divalidasi. Dimensi STL/OBJ dinyatakan dalam milimeter; GLB memakai meter. Animasi tidak menggantikan uji fisik.
