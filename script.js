// 1. KONFIGURASI FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDLGsOh2xBu9M553rSjuKp9xyA1OQKva8U",
  authDomain: "teh-oplos.firebaseapp.com",
  databaseURL: "https://teh-oplos-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "teh-oplos",
  storageBucket: "teh-oplos.firebasestorage.app",
  messagingSenderId: "430811396745",
  appId: "1:430811396745:web:3e0e86da936848cbc8e458",
  measurementId: "G-3FNRV2XVZ6"
};

// 2. INISIALISASI FIREBASE
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// DATABASE PRODUK DEFAULT
const DEFAULT_DATABASE_PRODUK = {
  "1": { nama: "Cup Besar", harga: 5000, kategori: "teh", stokKebutuhan: { cupBesar: 1 } },
  "2": { nama: "Cup Besar + Creamer", harga: 7000, kategori: "teh", stokKebutuhan: { cupBesar: 1, creamer: 1 } },
  "3": { nama: "Cup Kecil", harga: 3000, kategori: "teh", stokKebutuhan: { cupKecil: 1 } },
  "4": { nama: "Cup Kecil + Creamer", harga: 5000, kategori: "teh", stokKebutuhan: { cupKecil: 1, creamer: 1 } },
  "5": { nama: "Creamer", harga: 2000, kategori: "teh", stokKebutuhan: { creamer: 1 } },
  "6": { nama: "Kopi", harga: 5000, kategori: "kopi_jajanan", stokKebutuhan: { kopi: 1 } },
  "7": { nama: "Jajanan", harga: 1000, kategori: "kopi_jajanan", stokKebutuhan: {} },
  "8": { nama: "Dancow", harga: 7000, kategori: "kopi_jajanan", stokKebutuhan: {} },
  "9": { nama: "Good Day", harga: 7000, kategori: "kopi_jajanan", stokKebutuhan: {} },
  "baslok_pcs": { nama: "Baslok", harga: 1000, kategori: "baslok", stokKebutuhan: { baslokPorsi: 1 } }
};

let DATABASES_PRODUK = {};

// STATE MANAGEMENT
let appState = {
  depositAwal: 0,
  stok: { cupBesar: 50, cupKecil: 50, kopi: 30, creamer: 40, baslokPorsi: 50 },
  transaksi: [],
  terakhirReset: new Date().toDateString()
};

// Temporary Cart States
let keranjang = {};
let keranjangBaslok = {};

let chartJamInstance = null;
let chartHarianInstance = null;
let chartStokInstance = null;
let targetEditStokKey = null;

// INIT SYSTEM
document.addEventListener("DOMContentLoaded", () => {
  muatStateDariStorage();
  cekOtomatisResetHari();
  initEventListeners();
  initCharts();
  mulaiCountdownReset();
});

// FUNGSI REALTIME CLOUD FIREBASE
function muatStateDariStorage() {
  db.ref("teh_risma_state").on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
      appState = data;
      if (!appState.transaksi) appState.transaksi = [];
      if (!appState.stok) appState.stok = { cupBesar: 50, cupKecil: 50, kopi: 30, creamer: 40, baslokPorsi: 50 };
    } else {
      simpanState();
    }
    renderSemua();
  }, (err) => console.error("Gagal konek state Firebase:", err));

  db.ref("teh_risma_produk").on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
      DATABASES_PRODUK = data;
    } else {
      DATABASES_PRODUK = { ...DEFAULT_DATABASE_PRODUK };
      simpanProduk();
    }
    renderSemua();
  }, (err) => console.error("Gagal konek produk Firebase:", err));
}

function simpanState() {
  db.ref("teh_risma_state").set(appState);
}

function simpanProduk() {
  db.ref("teh_risma_produk").set(DATABASES_PRODUK);
}

function initEventListeners() {
  const elMetode = document.getElementById("metode-bayar");
  if (elMetode) {
    elMetode.addEventListener("change", (e) => {
      document.getElementById("group-nama-pembeli").style.display = e.target.value === "Utang" ? "block" : "none";
    });
  }
  
  const elMetodeBaslok = document.getElementById("metode-bayar-baslok");
  if (elMetodeBaslok) {
    elMetodeBaslok.addEventListener("change", (e) => {
      document.getElementById("group-nama-baslok").style.display = e.target.value === "Utang" ? "block" : "none";
    });
  }
}

// RENDER GRID MENU UTAMA
function renderGridMenu() {
  const gridContainer = document.getElementById("grid-pilihan-menu");
  if (!gridContainer) return;
  gridContainer.innerHTML = "";

  for (const [id, item] of Object.entries(DATABASES_PRODUK)) {
    if (item.kategori !== "baslok") {
      const card = document.createElement("div");
      card.className = "menu-card-wrapper";
      card.innerHTML = `
        <button type="button" class="btn-menu-card" onclick="tambahKeKeranjang('${id}')">
          <span class="menu-nama">${item.nama}</span>
          <span class="menu-harga">Rp ${item.harga.toLocaleString()}</span>
        </button>
        <button type="button" class="btn-hapus-menu" title="Hapus Menu" onclick="hapusProdukDariMenu('${id}')">✕</button>
      `;
      gridContainer.appendChild(card);
    }
  }
}

// RENDER GRID MENU BASLOK
function renderGridMenuBaslok() {
  const gridContainer = document.getElementById("grid-pilihan-menu-baslok");
  if (!gridContainer) return;
  gridContainer.innerHTML = "";

  const daftarPreset = [
    { label: "1 Pcs (1rb)", qty: 1 },
    { label: "2 Pcs (2rb)", qty: 2 },
    { label: "3 Pcs (3rb)", qty: 3 },
    { label: "5 Pcs (5rb)", qty: 5 },
    { label: "10 Pcs (10rb)", qty: 10 }
  ];

  daftarPreset.forEach(preset => {
    const btn = document.createElement("button");
    btn.className = "btn-menu-card btn-baslok-card";
    btn.type = "button";
    btn.onclick = () => tambahKeKeranjangBaslok("baslok_pcs", preset.qty);
    btn.innerHTML = `
      <span class="menu-nama">${preset.label}</span>
      <span class="menu-harga" style="color:#E65100;">+ ${preset.qty} Pcs</span>
    `;
    gridContainer.appendChild(btn);
  });
}

// MANAGEMENT PRODUK
function bukaModalTambahProduk() {
  document.getElementById("modal-tambah-produk").style.display = "flex";
}

function tutupModalTambahProduk() {
  document.getElementById("modal-tambah-produk").style.display = "none";
}

function simpanProdukBaru(e) {
  e.preventDefault();
  const nama = document.getElementById("nama-produk-baru").value;
  const harga = parseInt(document.getElementById("harga-produk-baru").value) || 0;
  const kategori = document.getElementById("kategori-produk-baru").value;

  if (!nama || harga <= 0) return;

  const newId = Date.now().toString();
  DATABASES_PRODUK[newId] = {
    nama: nama,
    harga: harga,
    kategori: kategori,
    stokKebutuhan: kategori === "baslok" ? { baslokPorsi: 1 } : {}
  };

  simpanProduk();
  tutupModalTambahProduk();
  document.getElementById("nama-produk-baru").value = "";
  document.getElementById("harga-produk-baru").value = "";
}

function hapusProdukDariMenu(idProduk) {
  const item = DATABASES_PRODUK[idProduk];
  if (!item) return;

  if (confirm(`Hapus menu "${item.nama}" dari pilihan?`)) {
    delete DATABASES_PRODUK[idProduk];
    if (keranjang[idProduk]) delete keranjang[idProduk];
    simpanProduk();
  }
}

// KERANJANG KASIR UTAMA
function tambahKeKeranjang(idProduk) {
  keranjang[idProduk] = (keranjang[idProduk] || 0) + 1;
  renderKeranjang();
}

function ubahQtyKeranjang(idProduk, delta) {
  if (keranjang[idProduk]) {
    keranjang[idProduk] += delta;
    if (keranjang[idProduk] <= 0) delete keranjang[idProduk];
  }
  renderKeranjang();
}

function renderKeranjang() {
  const container = document.getElementById("kontainer-keranjang");
  const totalEl = document.getElementById("val-total-keranjang");
  const btnSubmit = document.getElementById("btn-submit-penjualan");

  if (!container) return;
  container.innerHTML = "";
  let grandTotal = 0;
  const keys = Object.keys(keranjang);

  if (keys.length === 0) {
    container.innerHTML = `<p class="empty-cart-msg">Keranjang masih kosong. Klik menu di samping untuk menambah.</p>`;
    totalEl.innerText = "Rp 0";
    btnSubmit.disabled = true;
    return;
  }

  keys.forEach(id => {
    const item = DATABASES_PRODUK[id];
    if (!item) return;

    const qty = keranjang[id];
    const subtotal = item.harga * qty;
    grandTotal += subtotal;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <div class="cart-item-info">
        <span class="cart-item-title">${item.nama}</span>
        <span class="cart-item-subtotal">@${item.harga.toLocaleString()} = Rp ${subtotal.toLocaleString()}</span>
      </div>
      <div class="cart-qty-control">
        <button class="cart-qty-btn" type="button" onclick="ubahQtyKeranjang('${id}', -1)">-</button>
        <span class="cart-qty-num">${qty}</span>
        <button class="cart-qty-btn" type="button" onclick="ubahQtyKeranjang('${id}', 1)">+</button>
      </div>
    `;
    container.appendChild(div);
  });

  totalEl.innerText = `Rp ${grandTotal.toLocaleString()}`;
  btnSubmit.disabled = false;
}

// KERANJANG BASLOK
function tambahKeKeranjangBaslok(idProduk, jumlah = 1) {
  keranjangBaslok[idProduk] = (keranjangBaslok[idProduk] || 0) + jumlah;
  renderKeranjangBaslok();
}

function ubahQtyKeranjangBaslok(idProduk, delta) {
  if (keranjangBaslok[idProduk]) {
    keranjangBaslok[idProduk] += delta;
    if (keranjangBaslok[idProduk] <= 0) delete keranjangBaslok[idProduk];
  }
  renderKeranjangBaslok();
}

function renderKeranjangBaslok() {
  const container = document.getElementById("kontainer-keranjang-baslok");
  const totalEl = document.getElementById("val-total-keranjang-baslok");
  const btnSubmit = document.getElementById("btn-submit-baslok");

  if (!container) return;
  container.innerHTML = "";
  let grandTotal = 0;
  const keys = Object.keys(keranjangBaslok);

  if (keys.length === 0) {
    container.innerHTML = `<p class="empty-cart-msg">Keranjang Baslok kosong. Klik porsi di samping.</p>`;
    totalEl.innerText = "Rp 0";
    btnSubmit.disabled = true;
    return;
  }

  keys.forEach(id => {
    const item = DATABASES_PRODUK[id] || { nama: "Baslok", harga: 1000 };
    const qty = keranjangBaslok[id];
    const subtotal = item.harga * qty;
    grandTotal += subtotal;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <div class="cart-item-info">
        <span class="cart-item-title">${item.nama} (${qty} Pcs)</span>
        <span class="cart-item-subtotal">@Rp ${item.harga.toLocaleString()} = Rp ${subtotal.toLocaleString()}</span>
      </div>
      <div class="cart-qty-control">
        <button class="cart-qty-btn" type="button" onclick="ubahQtyKeranjangBaslok('${id}', -1)">-</button>
        <span class="cart-qty-num">${qty}</span>
        <button class="cart-qty-btn" type="button" onclick="ubahQtyKeranjangBaslok('${id}', 1)">+</button>
      </div>
    `;
    container.appendChild(div);
  });

  totalEl.innerText = `Rp ${grandTotal.toLocaleString()}`;
  btnSubmit.disabled = false;
}

// CHECKOUT KASIR UTAMA (DENGAN VALIDASI BLOKIR STOK HABIS)
function prosesCheckoutKeranjang(e) {
  e.preventDefault();
  const keys = Object.keys(keranjang);
  if (keys.length === 0) return;

  // 1. Cek Kebutuhan Stok
  const totalKebutuhanStok = {};
  for (const idProduk of keys) {
    const item = DATABASES_PRODUK[idProduk];
    if (item && item.stokKebutuhan) {
      const qty = keranjang[idProduk];
      for (const [bahan, butuh] of Object.entries(item.stokKebutuhan)) {
        totalKebutuhanStok[bahan] = (totalKebutuhanStok[bahan] || 0) + (butuh * qty);
      }
    }
  }

  // 2. Blokir Jika Stok Kurang/Habis
  for (const [bahan, butuh] of Object.entries(totalKebutuhanStok)) {
    const sisaStok = appState.stok[bahan] || 0;
    if (sisaStok < butuh) {
      alert(`Transaksi Gagal! Stok [ ${bahan.toUpperCase()} ] tidak cukup.\n(Dibutuhkan: ${butuh}, Tersedia: ${sisaStok})`);
      return;
    }
  }

  // 3. Proses Transaksi
  const metode = document.getElementById("metode-bayar").value;
  const namaPembeli = document.getElementById("nama-pembeli").value;
  const now = new Date();

  keys.forEach(idProduk => {
    const item = DATABASES_PRODUK[idProduk];
    if (!item) return;

    const qty = keranjang[idProduk];
    const total = item.harga * qty;

    if (item.stokKebutuhan) {
      for (const [bahan, butuh] of Object.entries(item.stokKebutuhan)) {
        if (appState.stok[bahan] !== undefined) {
          appState.stok[bahan] -= (butuh * qty);
        }
      }
    }

    const dataTransaksi = {
      id: Date.now() + Math.random(),
      waktu: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      jamAngka: now.getHours(),
      tipe: "penjualan",
      kategori: item.kategori,
      detail: `${item.nama} x${qty} ${metode === 'Utang' && namaPembeli ? '(' + namaPembeli + ')' : ''}`,
      total: total,
      metode: metode,
      statusUtang: metode === "Utang" ? "Belum Lunas" : "N/A",
      stokDikurangi: item.stokKebutuhan ? JSON.parse(JSON.stringify(item.stokKebutuhan)) : {},
      qty: qty
    };

    appState.transaksi.unshift(dataTransaksi);
  });

  keranjang = {};
  simpanState();
  renderKeranjang();

  document.getElementById("form-checkout").reset();
  document.getElementById("group-nama-pembeli").style.display = "none";
  alert("Transaksi berhasil diproses!");
}

// CHECKOUT BASLOK (DENGAN VALIDASI BLOKIR STOK HABIS)
function prosesCheckoutBaslok(e) {
  e.preventDefault();
  const keys = Object.keys(keranjangBaslok);
  if (keys.length === 0) return;

  // 1. Cek Kebutuhan Stok Baslok
  let butuhBaslok = 0;
  keys.forEach(idProduk => {
    const item = DATABASES_PRODUK[idProduk] || { stokKebutuhan: { baslokPorsi: 1 } };
    const qty = keranjangBaslok[idProduk];
    if (item.stokKebutuhan && item.stokKebutuhan.baslokPorsi) {
      butuhBaslok += item.stokKebutuhan.baslokPorsi * qty;
    }
  });

  // 2. Blokir Jika Stok Baslok Habis
  const sisaStokBaslok = appState.stok.baslokPorsi || 0;
  if (sisaStokBaslok < butuhBaslok) {
    alert(`Transaksi Baslok Gagal! Stok Baslok tidak cukup.\n(Dibutuhkan: ${butuhBaslok} Porsi, Tersedia: ${sisaStokBaslok} Porsi)`);
    return;
  }

  // 3. Proses Transaksi
  const metode = document.getElementById("metode-bayar-baslok").value;
  const namaPembeli = document.getElementById("nama-pembeli-baslok").value;
  const now = new Date();

  keys.forEach(idProduk => {
    const item = DATABASES_PRODUK[idProduk] || { nama: "Baslok", harga: 1000, stokKebutuhan: { baslokPorsi: 1 } };
    const qty = keranjangBaslok[idProduk];
    const total = item.harga * qty;

    if (item.stokKebutuhan) {
      for (const [bahan, butuh] of Object.entries(item.stokKebutuhan)) {
        if (appState.stok[bahan] !== undefined) {
          appState.stok[bahan] -= (butuh * qty);
        }
      }
    }

    const dataTransaksi = {
      id: Date.now() + Math.random(),
      waktu: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      jamAngka: now.getHours(),
      tipe: "penjualan",
      kategori: "baslok",
      detail: `Baslok ${qty} Pcs ${metode === 'Utang' && namaPembeli ? '(' + namaPembeli + ')' : ''}`,
      total: total,
      metode: metode,
      statusUtang: metode === "Utang" ? "Belum Lunas" : "N/A",
      stokDikurangi: item.stokKebutuhan ? JSON.parse(JSON.stringify(item.stokKebutuhan)) : {},
      qty: qty
    };

    appState.transaksi.unshift(dataTransaksi);
  });

  keranjangBaslok = {};
  simpanState();
  renderKeranjangBaslok();

  document.getElementById("group-nama-baslok").style.display = "none";
  alert("Transaksi Baslok berhasil diproses!");
}

// PENGELUARAN KAS
function prosesPengeluaran(e) {
  e.preventDefault();
  const ket = document.getElementById("ket-pengeluaran").value;
  const nominal = parseInt(document.getElementById("nominal-pengeluaran").value);
  const now = new Date();

  const dataTransaksi = {
    id: Date.now(),
    waktu: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    jamAngka: now.getHours(),
    tipe: "pengeluaran",
    kategori: "pengeluaran",
    detail: ket,
    total: nominal,
    metode: "Pengeluaran",
    statusUtang: "N/A",
    stokDikurangi: null,
    qty: 0
  };

  appState.transaksi.unshift(dataTransaksi);
  simpanState();
  document.getElementById("form-pengeluaran").reset();
}

// HAPUS TRANSAKSI (MENGEMBALIKAN STOK HABIS BILA DIHAPUS)
function hapusTransaksi(id) {
  const index = appState.transaksi.findIndex(x => x.id === id);
  if (index === -1) return;

  const itemTerhapus = appState.transaksi[index];

  if (confirm(`Hapus transaksi "${itemTerhapus.detail}"?`)) {
    if (itemTerhapus.tipe === "penjualan" && itemTerhapus.stokDikurangi) {
      const qty = itemTerhapus.qty || 1;
      for (const [bahan, butuh] of Object.entries(itemTerhapus.stokDikurangi)) {
        if (appState.stok[bahan] !== undefined) {
          appState.stok[bahan] = (appState.stok[bahan] || 0) + (butuh * qty);
        }
      }
    }

    appState.transaksi.splice(index, 1);
    simpanState();
  }
}

// SET DEPOSIT AWAL
function setDepositAwal() {
  const val = parseInt(document.getElementById("input-deposit-awal").value) || 0;
  appState.depositAwal = val;
  simpanState();
  alert("Modal / Deposit Awal berhasil disimpan!");
}

// STOK MANUAL
function ubahStok(key, delta) {
  if (appState.stok[key] !== undefined) {
    appState.stok[key] = Math.max(0, appState.stok[key] + delta);
    simpanState();
  }
}

function bukaModalEditStok(key) {
  targetEditStokKey = key;
  document.getElementById("label-modal-stok").innerText = `Edit Stok: ${key.toUpperCase()}`;
  document.getElementById("input-stok-manual").value = appState.stok[key];
  document.getElementById("modal-edit-stok").style.display = "flex";
}

function tutupModalStok() {
  document.getElementById("modal-edit-stok").style.display = "none";
}

function simpanStokManual() {
  const val = parseInt(document.getElementById("input-stok-manual").value) || 0;
  if (targetEditStokKey) {
    appState.stok[targetEditStokKey] = val;
    simpanState();
  }
  tutupModalStok();
}

// LUNASI UTANG
function lunasiUtang(id) {
  const t = appState.transaksi.find(x => x.id === id);
  if (t) {
    t.statusUtang = "Lunas";
    simpanState();
  }
}

// RENDER DASHBOARD & TABEL
function renderSemua() {
  renderGridMenu();
  renderGridMenuBaslok();

  const inputDeposit = document.getElementById("input-deposit-awal");
  if (inputDeposit) inputDeposit.value = appState.depositAwal;

  let totalTeh = 0;
  let totalTehTunai = 0;
  let totalKopiJajanan = 0;
  let totalBaslok = 0;
  let totalBaslokTunai = 0;
  let totalPengeluaran = 0;

  if (appState.transaksi) {
    appState.transaksi.forEach(t => {
      if (t.tipe === "penjualan") {
        if (t.kategori === "teh") {
          totalTeh += t.total;
          if (t.metode === "Tunai" || t.statusUtang === "Lunas") totalTehTunai += t.total;
        } else if (t.kategori === "kopi_jajanan") {
          totalKopiJajanan += t.total;
        } else if (t.kategori === "baslok") {
          totalBaslok += t.total;
          if (t.metode === "Tunai" || t.statusUtang === "Lunas") totalBaslokTunai += t.total;
        }
      } else if (t.tipe === "pengeluaran") {
        totalPengeluaran += t.total;
      }
    });
  }

  const kasAkhirTeh = appState.depositAwal + totalTehTunai - totalPengeluaran;

  if (document.getElementById("val-kas-teh")) document.getElementById("val-kas-teh").innerText = `Rp ${kasAkhirTeh.toLocaleString()}`;
  if (document.getElementById("val-kopi-jajanan")) document.getElementById("val-kopi-jajanan").innerText = `Rp ${totalKopiJajanan.toLocaleString()}`;
  if (document.getElementById("val-total-teh")) document.getElementById("val-total-teh").innerText = `Rp ${totalTeh.toLocaleString()}`;
  if (document.getElementById("val-total-pengeluaran")) document.getElementById("val-total-pengeluaran").innerText = `Rp ${totalPengeluaran.toLocaleString()}`;

  if (document.getElementById("val-total-baslok")) document.getElementById("val-total-baslok").innerText = `Rp ${totalBaslok.toLocaleString()}`;
  if (document.getElementById("val-kas-baslok")) document.getElementById("val-kas-baslok").innerText = `Rp ${totalBaslokTunai.toLocaleString()}`;

  if (appState.stok) {
    for (const [key, value] of Object.entries(appState.stok)) {
      const el = document.getElementById(`stok-val-${key}`);
      if (el) el.innerText = value;
    }
  }

  const renderTabelKe = (elementId) => {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!appState.transaksi || appState.transaksi.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#888;">Belum ada riwayat transaksi hari ini</td></tr>`;
      return;
    }

    appState.transaksi.forEach(t => {
      let badgeClass = "badge-tunai";
      if (t.tipe === "pengeluaran") badgeClass = "badge-pengeluaran";
      else if (t.metode === "QR") badgeClass = "badge-qr";
      else if (t.metode === "Utang") badgeClass = "badge-utang";

      let aksi = [];
      if (t.metode === "Utang") {
        if (t.statusUtang === "Belum Lunas") {
          aksi.push(`<button class="btn btn-sm btn-primary" onclick="lunasiUtang(${t.id})">Set Lunas</button>`);
        } else {
          aksi.push(`<span class="badge badge-lunas">Lunas</span>`);
        }
      }
      aksi.push(`<button class="btn btn-sm btn-danger" onclick="hapusTransaksi(${t.id})">Hapus</button>`);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.waktu}</td>
        <td><strong style="color: ${t.kategori === 'baslok' ? '#E65100' : '#2E7D32'}">${t.kategori.toUpperCase()}</strong></td>
        <td>${t.detail}</td>
        <td>Rp ${t.total.toLocaleString()}</td>
        <td><span class="badge ${badgeClass}">${t.metode}</span></td>
        <td><div class="action-btns">${aksi.join('')}</div></td>
      `;
      tbody.appendChild(tr);
    });
  };

  renderTabelKe("body-tabel-transaksi");
  renderTabelKe("body-tabel-baslok");

  updateCharts();
}

// TAB NAVIGATION
function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  if (tabName === "kasir") {
    document.getElementById("btn-tab-kasir").classList.add("active");
    document.getElementById("tab-kasir-content").classList.add("active");
  } else if (tabName === "baslok") {
    document.getElementById("btn-tab-baslok").classList.add("active");
    document.getElementById("tab-baslok-content").classList.add("active");
  } else {
    document.getElementById("btn-tab-statistik").classList.add("active");
    document.getElementById("tab-statistik-content").classList.add("active");
  }
}

// CHART SYSTEM
function initCharts() {
  const elJam = document.getElementById('chartTrafikJam');
  if (elJam) {
    chartJamInstance = new Chart(elJam.getContext('2d'), {
      type: 'line',
      data: {
        labels: Array.from({length: 24}, (_, i) => `${i}:00`),
        datasets: [{ label: 'Transaksi', data: Array(24).fill(0), borderColor: '#2E7D32', tension: 0.3, fill: true, backgroundColor: 'rgba(46,125,50,0.1)' }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const elHarian = document.getElementById('chartPenjualanHarian');
  if (elHarian) {
    chartHarianInstance = new Chart(elHarian.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Teh', 'Kopi & Jajanan', 'Baslok', 'Pengeluaran'],
        datasets: [{ label: 'Total (Rp)', data: [0, 0, 0, 0], backgroundColor: ['#2E7D32', '#0288D1', '#E65100', '#D32F2F'] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const elStok = document.getElementById('chartSisaStok');
  if (elStok) {
    chartStokInstance = new Chart(elStok.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Cup Besar', 'Cup Kecil', 'Kopi', 'Creamer', 'Baslok (Porsi)'],
        datasets: [{ data: [0, 0, 0, 0, 0], backgroundColor: ['#4CAF50', '#81C784', '#FFB74D', '#64B5F6', '#FF9800'] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

function updateCharts() {
  if (chartJamInstance) {
    const hourlyData = Array(24).fill(0);
    if (appState.transaksi) {
      appState.transaksi.forEach(t => {
        if (t.tipe === "penjualan") hourlyData[t.jamAngka] += 1;
      });
    }
    chartJamInstance.data.datasets[0].data = hourlyData;
    chartJamInstance.update();
  }

  if (chartHarianInstance) {
    let tTeh = 0, tKopi = 0, tBaslok = 0, tPengeluaran = 0;
    if (appState.transaksi) {
      appState.transaksi.forEach(t => {
        if (t.tipe === "penjualan") {
          if (t.kategori === "teh") tTeh += t.total;
          else if (t.kategori === "kopi_jajanan") tKopi += t.total;
          else if (t.kategori === "baslok") tBaslok += t.total;
        } else tPengeluaran += t.total;
      });
    }
    chartHarianInstance.data.datasets[0].data = [tTeh, tKopi, tBaslok, tPengeluaran];
    chartHarianInstance.update();
  }

  if (chartStokInstance && appState.stok) {
    chartStokInstance.data.datasets[0].data = [
      appState.stok.cupBesar || 0,
      appState.stok.cupKecil || 0,
      appState.stok.kopi || 0,
      appState.stok.creamer || 0,
      appState.stok.baslokPorsi || 0
    ];
    chartStokInstance.update();
  }
}

// RESET OTOMATIS TERSINKRONISASI
function cekOtomatisResetHari() {
  const hariIni = new Date().toDateString();
  if (appState.terakhirReset !== hariIni) {
    appState.transaksi = [];
    appState.depositAwal = 0;
    appState.terakhirReset = hariIni;
    simpanState();
  }
}

function mulaiCountdownReset() {
  setInterval(() => {
    const now = new Date();
    const besok = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const sisaWaktu = besok - now;

    const jam = Math.floor((sisaWaktu / (1000 * 60 * 60)) % 24);
    const menit = Math.floor((sisaWaktu / (1000 * 60)) % 60);
    const detik = Math.floor((sisaWaktu / 1000) % 60);

    const elTimer = document.getElementById("countdown-timer");
    if (elTimer) {
      elTimer.innerText = `${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}:${String(detik).padStart(2, '0')}`;
    }

    if (jam === 0 && menit === 0 && detik === 0) {
      cekOtomatisResetHari();
    }
  }, 1000);
}

// EXPORT CSV
function downloadCSV() {
  if (!appState.transaksi || appState.transaksi.length === 0) {
    alert("Belum ada data transaksi untuk di-export!");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,Jam,Kategori,Detail,Total,Metode,Status Utang\n";
  appState.transaksi.forEach(t => {
    csvContent += `"${t.waktu}","${t.kategori}","${t.detail}",${t.total},"${t.metode}","${t.statusUtang}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Laporan_Penjualan_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
