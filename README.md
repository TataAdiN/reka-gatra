# Reka Gatra

> **Kanvas visual tempat Balungan dan Cengkok digambar bersama.**  
> *Gatra ERD & Data Modeler* — Peranti modern untuk merancang kerangka database (ERD) dan diagram alur sistem (Flowchart) dalam satu kanvas interaktif.

---

## 🏛️ Filosofi & Etimologi Nama

Nama **Reka Gatra** berakar dari khazanah tata bahasa Jawa / Kawi dan filosofi karawitan Nusantara, yang dianalogikan ke dalam arsitektur perangkat lunak modern:

| Komponen | Penulisan / Pelafalan | Tata Bahasa & Makna | Peran dalam Sistem |
| :--- | :--- | :--- | :--- |
| **Reka** | *Reko* | Merancang, menggubah, merekayasa (*designing / modelling*). Kata kerja aktif. | Tindakan desainer/engineer dalam menyusun skema dan relasi. |
| **Gatra** | *Gotro* | Struktur, kerangka, unit metrik terkecil pembangun melodi utuh. | Objek rancangan: tabel, kolom data, relasi kunci asing, dan blok alur. |

### 1. Makna Gatra (Untuk Diagram Layout & Relasi Tabel)
* **Arti Tradisional:** Unit / birama terkecil yang membangun struktur melodi utuh (lazimnya terdiri dari 4 tabuhan gendhing).
* **Filosofi Sistem:** Menggambarkan entitas tabel tunggal beserta kolom-kolomnya yang saling terhubung membentuk sistem database utuh. Tanpa gatra yang kokoh, harmoni lagu tak akan tercipta; tanpa skema tabel yang presisi, sistem aplikasi tak akan andal.
* **Sub-nama / Tagline:** *Gatra ERD & Data Modeler*.

### 2. Keselarasan Karakter Nama
Pola penamaan **Reka Gatra** sejalan dengan tradisi pembentukan istilah cipta karya dalam bahasa Jawa/Kawi seperti *Reka Cipta*, *Reka Rupa*, maupun *Reka Wujud*:
* **Reka** bertindak sebagai kata kerja/proses (*designing & architectural modeling*).
* **Gatra** bertindak sebagai objek fundamental yang dirancang (tabel, atribut, relasi, dan blok alur proses).
* **Secara Utuh:** Reka Gatra mengekspresikan **"Peranti Visual untuk Merancang Kerangka Sistem & Basis Data"**.

---

## ✨ Fitur Utama

### 1. Dual-Mode Interactive Canvas
* **Table Node (ERD):**
  * Visualisasi nama tabel, daftar kolom lengkap, tipe data, dan badge constraint (`PK`, `FK`, `Nullable`, `Unique`, `AI`, `Default`).
  * Palette warna header kustom untuk pengelompokan domain/modul (Users, Billing, Content, dsb).
  * Rename in-place langsung dengan klik ganda (*double click*).
* **Flowchart Node:**
  * Bentuk standar proses: **Process** (kotak rounded), **Decision** (belah ketupat), **Document** (gelombang bawah), dan **Start/End (Terminal)** (stadium kapsul).
  * Konektor multi-arah (Top, Right, Bottom, Left) untuk memetakan alur bisnis di samping tabel database.
* **Relasi & Connector Cerdas:**
  * Drag-and-drop antar handle kolom untuk membentuk relasi Foreign Key (`1:1`, `1:N`, `N:M`).
  * Notasi Crow's Foot otomatis pada ujung konektor.
  * Pilihan gaya garis **Smooth Bezier** atau **Orthogonal / Step**.
  * Dynamic handle routing: garis otomatis menempel ke sisi terdekat (kiri/kanan) saat tabel digeser.

### 2. One-Click Copy & Export Engine (Core Feature)
Setiap header Table Node menyediakan tombol aksi instan dengan notifikasi toast:
* **SQL DDL (`CREATE TABLE`):** Query siap pakai dengan auto-increment, primary key, unique, default, dan foreign key constraints (tersedia opsi dialek MySQL & PostgreSQL).
* **Text / Markdown Descriptive:** Ringkasan bersih kolom dan constraint yang ideal untuk prompt LLM, dokumentasi tim, atau pull request.
* **Laravel Migration Snippet:** Kode migrasi elegan menggunakan helper modern Laravel (`$table->id()`, `foreignId()->constrained()`, `timestamps()`, `softDeletes()`).
* **Bulk Export Modal:** Export seluruh tabel kanvas sekaligus ke file `.sql`, `.md`, atau file migrasi Laravel `.php` utuh (tersusun otomatis berdasarkan urutan dependensi foreign key).

### 3. SQL Reverse Parser (Bonus Importer)
Tempel query `CREATE TABLE` yang sudah ada (MySQL, Postgres, SQLite), dan Reka Gatra akan otomatis mem-parse struktur kolom, primary key, auto increment, dan relasi foreign key menjadi node tabel visual di atas kanvas.

### 4. Inspector & Riwayat State
* **Side Inspector Panel:** Slide-over panel untuk mengedit atribut tabel, menambah/menghapus/mengurutkan kolom, mengubah tipe data, mengatur nilai default, dan pratinjau kode live.
* **Undo & Redo:** Riwayat riwayat penuh (snapshot-based) melalui tombol toolbar atau shortcut `Ctrl+Z` / `Ctrl+Shift+Z`.
* **Penyimpanan Lokal & File Proyek:** State otomatis tersimpan di `localStorage` peramban, serta mendukung ekspor/impor file proyek format `.json`.
* **Dark & Light Mode:** Dukungan tema gelap/terang native yang nyaman di mata.

---

## 🛠️ Arsitektur Teknologi

* **Framework:** [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`, ES Modules / JavaScript murni).
* **Canvas Engine:** [@vue-flow/core](https://vueflow.dev/) (dengan add-on Background, Controls, dan MiniMap).
* **State Management:** [Pinia](https://pinia.vuejs.org/) (sentralisasi diagram, seleksi aktif, preferensi UI, dan stack undo/redo).
* **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) + `@tailwindcss/vite`.
* **Icons:** [@lucide/vue](https://lucide.dev/).
* **Bundler:** [Vite](https://vite.dev/).

---

## 📂 Struktur Direktori

```text
reka-gatra/
├── src/
│   ├── types/
│   │   └── diagram.mjs             # Definisi data model, tipe data, & factory helpers
│   ├── utils/
│   │   ├── id.mjs                  # Generator unique identifier
│   │   ├── generators.mjs          # Pure engine generator (SQL, Markdown, Laravel)
│   │   └── sqlParser.mjs           # Reverse parser CREATE TABLE -> node kanvas
│   ├── stores/
│   │   ├── diagram.js              # Pinia store untuk state tabel, relasi, & undo/redo
│   │   ├── ui.js                   # Pinia store untuk tema, toast, modal, & konfigurasi
│   │   └── sample.js               # Starter template (users & posts + flowchart)
│   ├── composables/
│   │   └── useSchemaCopy.js        # Logika salin clipboard + toast feedback
│   ├── components/
│   │   ├── nodes/
│   │   │   ├── TableNode.vue       # Komponen visual tabel ERD + quick copy buttons
│   │   │   └── FlowNode.vue        # Komponen shape flowchart (SVG flat aesthetic)
│   │   ├── edges/
│   │   │   ├── RelationEdge.vue    # Konektor tabel (Crow's Foot, Bezier/Orthogonal)
│   │   │   └── FlowEdge.vue        # Konektor flowchart dengan arrowhead & label
│   │   ├── TopBar.vue              # Toolbar utama (insert, styling, undo/redo, file)
│   │   ├── InspectorPanel.vue      # Panel inspeksi dan editor kolom / shape
│   │   ├── ExportModal.vue         # Modal pratinjau & unduh ekspor massal
│   │   ├── ImportSqlModal.vue      # Modal reverse parser SQL CREATE TABLE
│   │   └── ToastContainer.vue      # Feedback visual notifikasi salin
│   ├── views/
│   │   └── CanvasView.vue          # Container kanvas utama & keyboard shortcuts
│   ├── App.vue
│   ├── main.js
│   └── style.css
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## 🚀 Memulai (Quick Start)

### Prasyarat
* [Node.js](https://nodejs.org/) versi 18 atau yang lebih baru.
* NPM atau PNPM.

### Instalasi & Menjalankan Dev Server
```bash
# 1. Masuk ke direktori proyek
cd c:/laragon/www/reka-gatra

# 2. Pasang dependensi
npm install

# 3. Jalankan development server
npm run dev
```

Buka URL lokal yang muncul di terminal (biasanya `http://localhost:5173/`) pada browser Anda.

### Build Produksi
```bash
npm run build
npm run preview
```

---

## ⌨️ Pintasan Papan Ketik (Keyboard Shortcuts)

| Shortcut | Aksi |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Simpan file diagram (*Auto-save / overwrite* ke file yang sedang dibuka tanpa membuat file baru) |
| <kbd>T</kbd> | Tambah Table Node baru di tengah kanvas |
| <kbd>S</kbd> | Tambah Flow Shape baru di tengah kanvas |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Urungkan aksi (*Undo*) |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd> | Ulangi aksi (*Redo*) |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | Duplikasi node tabel atau shape yang sedang dipilih |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Hapus elemen yang dipilih (tabel, kolom, relasi, shape) |
| <kbd>Esc</kbd> | Batalkan seleksi / tutup modal dialog |

---

## 📄 Lisensi

Perangkat lunak ini dirilis di bawah lisensi **Non-Commercial License (Source-Available)**:
* **Penggunaan Pribadi & Non-Komersial:** Diizinkan secara bebas untuk keperluan belajar, penelitian, pengujian internal, atau portofolio nirlaba.
* **Larangan Komersial & SaaS:** Dilarang keras digunakan untuk tujuan komersial, dijual kembali, dibundel dalam produk berbayar, atau dipasang (*hosted*) sebagai layanan publik/SaaS oleh pihak ketiga tanpa izin tertulis dari pemilik hak cipta.
* Hak komersial, hosting resmi, dan monetisasi produk dipegang secara eksklusif oleh pembuat / pemilik repositori ini.

Silakan baca berkas [LICENSE](./LICENSE) untuk ketentuan hukum lengkap.
