/* ============================================================
   script.js — Dashboard Pengeluaran Mahasiswa ITS
   Vanilla JavaScript · Chart.js · Data dari data/pengeluaran.json
   ============================================================ */

/* ------------------------------------------------------------------ */
/*  KONSTANTA & KONFIGURASI                                            */
/* ------------------------------------------------------------------ */

// Pemetaan kategori ke tingkat kebutuhan
const PRIMER_KEYS    = ['pangan', 'papan', 'sandang', 'akademik'];
const SEKUNDER_KEYS  = ['transportasi', 'kuota_internet', 'perabot_rt', 'hiburan'];
const TERSIER_KEYS   = ['aksesoris_perhiasan', 'gadget_hobi', 'lainnya_tersier'];
const ALL_CAT_KEYS   = [...PRIMER_KEYS, ...SEKUNDER_KEYS, ...TERSIER_KEYS];

// Label ramah untuk setiap kategori
const CAT_LABELS = {
  pangan: 'Pangan', papan: 'Papan', sandang: 'Sandang', akademik: 'Akademik',
  transportasi: 'Transportasi', kuota_internet: 'Kuota Internet',
  perabot_rt: 'Perabot RT', hiburan: 'Hiburan',
  aksesoris_perhiasan: 'Aksesoris', gadget_hobi: 'Gadget/Hobi',
  lainnya_tersier: 'Lainnya (Tersier)'
};

// Warna konsisten: Primer=biru, Sekunder=amber, Tersier=rose
const COLOR_PRIMER  = '#3b82f6';
const COLOR_SEKUNDER = '#f59e0b';
const COLOR_TERSIER = '#f43f5e';

// Palet warna untuk chart multi-series
const PALETTE = [
  '#3b82f6','#f59e0b','#f43f5e','#10b981','#8b5cf6',
  '#06b6d4','#ef4444','#84cc16','#f97316','#6366f1',
  '#ec4899'
];

// Warna per kategori
const CAT_COLORS = {
  pangan: '#3b82f6', papan: '#6366f1', sandang: '#818cf8', akademik: '#93c5fd',
  transportasi: '#f59e0b', kuota_internet: '#fbbf24', perabot_rt: '#fcd34d', hiburan: '#fde68a',
  aksesoris_perhiasan: '#f43f5e', gadget_hobi: '#fb7185', lainnya_tersier: '#fda4af'
};

/* ------------------------------------------------------------------ */
/*  STATE GLOBAL                                                       */
/* ------------------------------------------------------------------ */
let rawData = [];         // Data asli dari JSON
let filteredData = [];    // Data setelah filter
let charts = {};          // Menyimpan instance Chart.js agar bisa di-destroy saat update

/* ------------------------------------------------------------------ */
/*  UTILITAS UMUM                                                      */
/* ------------------------------------------------------------------ */

/**
 * Format angka Rupiah tanpa simbol "Rp" panjang, menggunakan singkatan.
 * Contoh: 1500000 → "Rp 1,5 Jt"
 */
function formatRupiah(value) {
  if (!isFinite(value) || isNaN(value)) return 'Rp —';
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Jt`;
  if (value >= 1_000)    return `Rp ${(value / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Rb`;
  return `Rp ${value.toLocaleString('id-ID')}`;
}

/** Format angka persen dengan desimal opsional */
function formatPct(value, dec = 1) {
  if (!isFinite(value) || isNaN(value)) return '—%';
  return `${value.toFixed(dec)}%`;
}

/** Hitung rata-rata array angka, kembalikan 0 jika kosong */
function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Hitung total pengeluaran satu mahasiswa (sum 11 kategori) */
function totalPengeluaran(m) {
  return ALL_CAT_KEYS.reduce((s, k) => s + (m[k] || 0), 0);
}

/** Hitung total primer satu mahasiswa */
function totalPrimer(m)   { return PRIMER_KEYS.reduce((s, k) => s + (m[k] || 0), 0); }
/** Hitung total sekunder satu mahasiswa */
function totalSekunder(m) { return SEKUNDER_KEYS.reduce((s, k) => s + (m[k] || 0), 0); }
/** Hitung total tersier satu mahasiswa */
function totalTersier(m)  { return TERSIER_KEYS.reduce((s, k) => s + (m[k] || 0), 0); }

/** Apakah mahasiswa dalam kondisi defisit? */
function isDefisit(m) { return totalPengeluaran(m) > m.pemasukan_bulanan; }

/* ------------------------------------------------------------------ */
/*  INISIALISASI FILTER                                                */
/* ------------------------------------------------------------------ */

/**
 * Populate semua dropdown filter dari data mentah.
 * Dipanggil sekali setelah data dimuat.
 */
function initFilters(data) {
  const get = id => document.getElementById(id);

  const populate = (id, values) => {
    const sel = get(id);
    // Bersihkan semua opsi selain "Semua"
    while (sel.options.length > 1) sel.remove(1);
    [...new Set(values)].sort().forEach(v => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = v;
      sel.appendChild(opt);
    });
  };

  populate('f-fakultas', data.map(m => m.fakultas));
  populate('f-prodi',    data.map(m => m.prodi));
  populate('f-angkatan', data.map(m => String(m.angkatan)));
  populate('f-tempat',   data.map(m => m.tempat_tinggal));
  populate('f-dana',     data.map(m => m.sumber_dana));

  // Pasang event listener ke semua select
  ['f-fakultas','f-prodi','f-angkatan','f-tempat','f-dana'].forEach(id => {
    get(id).addEventListener('change', onFilterChange);
  });

  // Tombol reset
  get('btn-reset').addEventListener('click', () => {
    ['f-fakultas','f-prodi','f-angkatan','f-tempat','f-dana'].forEach(id => {
      get(id).value = '';
    });
    onFilterChange();
  });
}

/** Ambil nilai filter aktif dan kembalikan sebagai objek */
function getActiveFilters() {
  return {
    fakultas:  document.getElementById('f-fakultas').value,
    prodi:     document.getElementById('f-prodi').value,
    angkatan:  document.getElementById('f-angkatan').value,
    tempat:    document.getElementById('f-tempat').value,
    dana:      document.getElementById('f-dana').value,
  };
}

/** Filter data mentah berdasarkan nilai filter aktif */
function applyFilters(data, filters) {
  return data.filter(m => {
    if (filters.fakultas && m.fakultas !== filters.fakultas) return false;
    if (filters.prodi    && m.prodi    !== filters.prodi)    return false;
    if (filters.angkatan && String(m.angkatan) !== filters.angkatan) return false;
    if (filters.tempat   && m.tempat_tinggal !== filters.tempat)     return false;
    if (filters.dana     && m.sumber_dana    !== filters.dana)       return false;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/*  EVENT HANDLER FILTER                                               */
/* ------------------------------------------------------------------ */
function onFilterChange() {
  const filters = getActiveFilters();
  filteredData = applyFilters(rawData, filters);
  renderDashboard(filteredData);
}

/* ------------------------------------------------------------------ */
/*  RENDER DASHBOARD UTAMA                                             */
/* ------------------------------------------------------------------ */

/** Render semua komponen dashboard dengan data yang diberikan */
function renderDashboard(data) {
  const isEmpty = data.length === 0;

  // Tampilkan/sembunyikan empty state
  document.getElementById('empty-state').classList.toggle('hidden', !isEmpty);
  document.getElementById('dashboard-content').classList.toggle('hidden', isEmpty);

  // Update badge jumlah data
  document.getElementById('data-count').textContent =
    isEmpty ? 'Tidak ada data' : `${data.length} Mahasiswa`;

  if (isEmpty) return;

  renderKPI(data);
  renderChartDonut(data);
  renderChartBarKategori(data);
  renderChartLineTren(data);
  renderChartStackedFakultas(data);
  renderChartBarTempat(data);
  renderChartPieDana(data);
  renderChartScatter(data);
  renderChartBarAngkatan(data);
  renderInsights(data);
  renderTop10Table(data);
}

/* ------------------------------------------------------------------ */
/*  KPI CARDS                                                          */
/* ------------------------------------------------------------------ */
function renderKPI(data) {
  const n = data.length;
  const totals = data.map(totalPengeluaran);
  const grandTotal = totals.reduce((a, b) => a + b, 0);
  const rataRata   = grandTotal / n;

  // Rasio P:S:T
  const sumPrimer   = data.reduce((s, m) => s + totalPrimer(m), 0);
  const sumSekunder = data.reduce((s, m) => s + totalSekunder(m), 0);
  const sumTersier  = data.reduce((s, m) => s + totalTersier(m), 0);
  const grandSum    = sumPrimer + sumSekunder + sumTersier || 1;

  const pP = (sumPrimer   / grandSum * 100).toFixed(0);
  const pS = (sumSekunder / grandSum * 100).toFixed(0);
  const pT = (sumTersier  / grandSum * 100).toFixed(0);

  // Kategori terbesar
  const catSums = ALL_CAT_KEYS.map(k => ({
    key: k,
    total: data.reduce((s, m) => s + (m[k] || 0), 0)
  }));
  catSums.sort((a, b) => b.total - a.total);
  const topCat = catSums[0];

  // Defisit
  const defisitCount = data.filter(isDefisit).length;
  const defisitPct   = defisitCount / n * 100;

  // Render ke DOM
  document.getElementById('kpi-total').textContent     = formatRupiah(grandTotal);
  document.getElementById('kpi-total-sub').textContent  = `dari ${n} mahasiswa`;
  document.getElementById('kpi-avg').textContent        = formatRupiah(rataRata);
  document.getElementById('kpi-ratio').textContent      = `${pP}:${pS}:${pT}`;
  document.getElementById('kpi-top-cat').textContent    = CAT_LABELS[topCat.key];
  document.getElementById('kpi-top-cat-sub').textContent = formatRupiah(topCat.total);
  document.getElementById('kpi-defisit').textContent    = `${defisitCount} (${formatPct(defisitPct)})`;
  document.getElementById('kpi-defisit-sub').textContent = `dari ${n} mahasiswa`;
}

/* ------------------------------------------------------------------ */
/*  HELPER: destroy chart lama sebelum render baru                    */
/* ------------------------------------------------------------------ */
function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

/* ------------------------------------------------------------------ */
/*  CHART 1: Donut — Komposisi Tingkat Kebutuhan                      */
/* ------------------------------------------------------------------ */
function renderChartDonut(data) {
  destroyChart('donut');
  const sumP = data.reduce((s, m) => s + totalPrimer(m), 0);
  const sumS = data.reduce((s, m) => s + totalSekunder(m), 0);
  const sumT = data.reduce((s, m) => s + totalTersier(m), 0);

  const ctx = document.getElementById('chart-donut').getContext('2d');
  charts['donut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Primer', 'Sekunder', 'Tersier'],
      datasets: [{
        data: [sumP, sumS, sumT],
        backgroundColor: [COLOR_PRIMER, COLOR_SEKUNDER, COLOR_TERSIER],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = (ctx.parsed / total * 100).toFixed(1);
              return ` ${ctx.label}: ${formatRupiah(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/*  CHART 2: Bar Horizontal — Pengeluaran per Kategori                */
/* ------------------------------------------------------------------ */
function renderChartBarKategori(data) {
  destroyChart('barKat');
  const labels = ALL_CAT_KEYS.map(k => CAT_LABELS[k]);
  const values = ALL_CAT_KEYS.map(k => Math.round(avg(data.map(m => m[k] || 0))));
  const colors = ALL_CAT_KEYS.map(k => CAT_COLORS[k]);

  const ctx = document.getElementById('chart-bar-kategori').getContext('2d');
  charts['barKat'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Rata-rata (Rp)',
        data: values,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatRupiah(ctx.parsed.x)}` } }
      },
      scales: {
        x: {
          ticks: { callback: v => formatRupiah(v), font: { size: 10 } },
          grid: { color: '#f3f4f6' }
        },
        y: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/*  CHART 3: Line — Tren Pengeluaran Jul–Sep 2026                     */
/* ------------------------------------------------------------------ */
function renderChartLineTren(data) {
  destroyChart('lineTren');
  const avgJul = avg(data.map(m => m.total_jul));
  const avgAgu = avg(data.map(m => m.total_agu));
  const avgSep = avg(data.map(m => m.total_sep));

  const ctx = document.getElementById('chart-line-tren').getContext('2d');
  charts['lineTren'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Juli 2026', 'Agustus 2026', 'September 2026'],
      datasets: [{
        label: 'Rata-rata Pengeluaran',
        data: [avgJul, avgAgu, avgSep],
        borderColor: COLOR_PRIMER,
        backgroundColor: 'rgba(59,130,246,0.08)',
        pointBackgroundColor: COLOR_PRIMER,
        pointRadius: 6, pointHoverRadius: 8,
        fill: true, tension: 0.35, borderWidth: 2.5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatRupiah(ctx.parsed.y)}` } }
      },
      scales: {
        y: {
          ticks: { callback: v => formatRupiah(v), font: { size: 10 } },
          grid: { color: '#f3f4f6' }
        },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/*  CHART 4: Stacked Bar — Komposisi Kebutuhan per Fakultas           */
/* ------------------------------------------------------------------ */
function renderChartStackedFakultas(data) {
  destroyChart('stackedFak');
  // Kelompokkan per fakultas
  const faculties = [...new Set(data.map(m => m.fakultas))].sort();
  const avgPrimer   = faculties.map(f => avg(data.filter(m => m.fakultas === f).map(m => totalPrimer(m))));
  const avgSekunder = faculties.map(f => avg(data.filter(m => m.fakultas === f).map(m => totalSekunder(m))));
  const avgTersier  = faculties.map(f => avg(data.filter(m => m.fakultas === f).map(m => totalTersier(m))));

  const ctx = document.getElementById('chart-stacked-fakultas').getContext('2d');
  charts['stackedFak'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: faculties,
      datasets: [
        { label: 'Primer',   data: avgPrimer,   backgroundColor: COLOR_PRIMER,   borderRadius: 0 },
        { label: 'Sekunder', data: avgSekunder, backgroundColor: COLOR_SEKUNDER, borderRadius: 0 },
        { label: 'Tersier',  data: avgTersier,  backgroundColor: COLOR_TERSIER,  borderRadius: 0 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8 } },
        tooltip: {
          mode: 'index', intersect: false,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatRupiah(ctx.parsed.y)}` }
        }
      },
      scales: {
        x: { stacked: true, ticks: { font: { size: 9 } }, grid: { display: false } },
        y: { stacked: true, ticks: { callback: v => formatRupiah(v), font: { size: 9 } }, grid: { color: '#f3f4f6' } }
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/*  CHART 5: Bar — Rata-rata Pengeluaran per Tempat Tinggal           */
/* ------------------------------------------------------------------ */
function renderChartBarTempat(data) {
  destroyChart('barTempat');
  const tempatList = [...new Set(data.map(m => m.tempat_tinggal))].sort();
  const values = tempatList.map(t => avg(data.filter(m => m.tempat_tinggal === t).map(totalPengeluaran)));

  const ctx = document.getElementById('chart-bar-tempat').getContext('2d');
  charts['barTempat'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: tempatList,
      datasets: [{
        label: 'Rata-rata Pengeluaran',
        data: values,
        backgroundColor: PALETTE.slice(0, tempatList.length),
        borderRadius: 8, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatRupiah(ctx.parsed.y)}` } }
      },
      scales: {
        y: { ticks: { callback: v => formatRupiah(v), font: { size: 10 } }, grid: { color: '#f3f4f6' } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/*  CHART 6: Pie — Distribusi Sumber Dana                             */
/* ------------------------------------------------------------------ */
function renderChartPieDana(data) {
  destroyChart('pieDana');
  const sources = [...new Set(data.map(m => m.sumber_dana))].sort();
  const counts  = sources.map(s => data.filter(m => m.sumber_dana === s).length);

  const ctx = document.getElementById('chart-pie-dana').getContext('2d');
  charts['pieDana'] = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: sources,
      datasets: [{
        data: counts,
        backgroundColor: PALETTE.slice(0, sources.length),
        borderWidth: 2, borderColor: '#ffffff', hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 10 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = (ctx.parsed / total * 100).toFixed(1);
              return ` ${ctx.label}: ${ctx.parsed} orang (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/*  CHART 7: Scatter — Pemasukan vs % Tersier                         */
/* ------------------------------------------------------------------ */
function renderChartScatter(data) {
  destroyChart('scatter');
  // Untuk performa, batasi scatter ke maks 200 titik (seluruh data yang sudah difilter)
  const points = data.map(m => {
    const tot = totalPengeluaran(m) || 1;
    const pctTersier = totalTersier(m) / tot * 100;
    return { x: m.pemasukan_bulanan, y: parseFloat(pctTersier.toFixed(2)), nama: m.nama };
  });

  const ctx = document.getElementById('chart-scatter').getContext('2d');
  charts['scatter'] = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Mahasiswa',
        data: points,
        backgroundColor: 'rgba(244, 63, 94, 0.45)',
        pointRadius: 4, pointHoverRadius: 7,
        borderColor: COLOR_TERSIER, borderWidth: 1
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = ctx.raw;
              return [`  ${d.nama}`, `  Pemasukan: ${formatRupiah(d.x)}`, `  % Tersier: ${d.y.toFixed(1)}%`];
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Pemasukan Bulanan (Rp)', font: { size: 10 } },
          ticks: { callback: v => formatRupiah(v), font: { size: 9 } },
          grid: { color: '#f3f4f6' }
        },
        y: {
          title: { display: true, text: '% Tersier dari Total Pengeluaran', font: { size: 10 } },
          ticks: { callback: v => `${v}%`, font: { size: 9 } },
          grid: { color: '#f3f4f6' }
        }
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/*  CHART 8: Bar — Rata-rata Pengeluaran per Angkatan                 */
/* ------------------------------------------------------------------ */
function renderChartBarAngkatan(data) {
  destroyChart('barAngkatan');
  const angkatanList = [...new Set(data.map(m => String(m.angkatan)))].sort();
  const values = angkatanList.map(a => avg(data.filter(m => String(m.angkatan) === a).map(totalPengeluaran)));

  const ctx = document.getElementById('chart-bar-angkatan').getContext('2d');
  charts['barAngkatan'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: angkatanList.map(a => `Angkatan ${a}`),
      datasets: [{
        label: 'Rata-rata Pengeluaran',
        data: values,
        backgroundColor: PALETTE.slice(1, angkatanList.length + 1),
        borderRadius: 8, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatRupiah(ctx.parsed.y)}` } }
      },
      scales: {
        y: { ticks: { callback: v => formatRupiah(v), font: { size: 10 } }, grid: { color: '#f3f4f6' } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/*  INSIGHT CARDS                                                      */
/* ------------------------------------------------------------------ */
function renderInsights(data) {
  const container = document.getElementById('insight-container');
  container.innerHTML = '';

  const n = data.length;

  // 1. Mahasiswa paling hemat
  const sorted = [...data].sort((a, b) => totalPengeluaran(a) - totalPengeluaran(b));
  const palingHemat = sorted[0];

  // 2. Rasio pengeluaran tersier tertinggi rata-rata
  const avgTersierPct = avg(data.map(m => {
    const tot = totalPengeluaran(m) || 1;
    return totalTersier(m) / tot * 100;
  }));

  // 3. Kelompok tempat tinggal dengan rata-rata pengeluaran tertinggi
  const tempatGroups = [...new Set(data.map(m => m.tempat_tinggal))];
  const tempatAvg = tempatGroups.map(t => ({
    t, val: avg(data.filter(m => m.tempat_tinggal === t).map(totalPengeluaran))
  })).sort((a, b) => b.val - a.val);

  // 4. Sumber dana paling banyak
  const danaCount = {};
  data.forEach(m => { danaCount[m.sumber_dana] = (danaCount[m.sumber_dana] || 0) + 1; });
  const topDana = Object.entries(danaCount).sort((a, b) => b[1] - a[1])[0];

  // 5. Persentase mahasiswa yang surplus
  const surplusCount = data.filter(m => !isDefisit(m)).length;
  const surplusPct = surplusCount / n * 100;

  // 6. Rata-rata sisa uang surplus
  const surplusAvg = avg(
    data.filter(m => !isDefisit(m))
        .map(m => m.pemasukan_bulanan - totalPengeluaran(m))
  );

  // Data insight: [icon, colorClass, title, value, desc]
  const insights = [
    {
      icon: '💡', color: 'green',
      title: 'Rata-rata Tersier',
      value: formatPct(avgTersierPct),
      desc: `Rata-rata porsi pengeluaran tersier dari total pengeluaran seluruh mahasiswa.`
    },
    {
      icon: '🏠', color: 'amber',
      title: 'Tempat Tinggal Termahal',
      value: tempatAvg[0] ? tempatAvg[0].t : '—',
      desc: `Rata-rata pengeluaran ${tempatAvg[0] ? formatRupiah(tempatAvg[0].val) : '—'} / bulan.`
    },
    {
      icon: '💰', color: 'purple',
      title: 'Sumber Dana Dominan',
      value: topDana ? topDana[0] : '—',
      desc: `${topDana ? topDana[1] : 0} dari ${n} mahasiswa (${topDana ? formatPct(topDana[1]/n*100) : '—'}).`
    },
    {
      icon: '📈', color: 'green',
      title: 'Mahasiswa Surplus',
      value: formatPct(surplusPct),
      desc: `Rata-rata sisa dana: ${formatRupiah(surplusAvg)} / bulan.`
    }
  ];

  insights.forEach(ins => {
    const card = document.createElement('div');
    card.className = `insight-card ${ins.color}`;
    card.innerHTML = `
      <div class="insight-icon">${ins.icon}</div>
      <div class="insight-title">${ins.title}</div>
      <div class="insight-value">${ins.value}</div>
      <div class="insight-desc">${ins.desc}</div>
    `;
    container.appendChild(card);
  });
}

/* ------------------------------------------------------------------ */
/*  TOP 10 TABLE                                                       */
/* ------------------------------------------------------------------ */
function renderTop10Table(data) {
  const tbody = document.getElementById('table-top10');
  tbody.innerHTML = '';

  // Urutkan berdasarkan total_sep (atau total pengeluaran) descending
  const top10 = [...data]
    .sort((a, b) => totalPengeluaran(b) - totalPengeluaran(a))
    .slice(0, 10);

  if (top10.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-gray-400">Tidak ada data</td></tr>`;
    return;
  }

  top10.forEach((m, i) => {
    const total = totalPengeluaran(m);
    const defisit = isDefisit(m);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-semibold text-gray-400">${i + 1}</td>
      <td>
        <div class="font-medium text-gray-800">${m.nama}</div>
        <div class="text-gray-400 text-xs">${m.nrp}</div>
      </td>
      <td class="text-gray-600">${m.prodi}</td>
      <td class="text-gray-600">${m.angkatan}</td>
      <td class="text-gray-600">${m.tempat_tinggal}</td>
      <td class="text-right font-semibold text-gray-800">${formatRupiah(total)}</td>
      <td class="text-right text-gray-600">${formatRupiah(m.pemasukan_bulanan)}</td>
      <td class="text-center">
        <span class="badge ${defisit ? 'badge-defisit' : 'badge-surplus'}">
          ${defisit ? 'Defisit' : 'Surplus'}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ------------------------------------------------------------------ */
/*  LOAD DATA & BOOTSTRAP                                              */
/* ------------------------------------------------------------------ */

/**
 * Titik masuk utama aplikasi.
 * Fetch data JSON → init filter → render dashboard pertama kali.
 */
async function init() {
  try {
    const response = await fetch('data/pengeluaran.json');
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    rawData = await response.json();

    // Validasi minimal: pastikan array tidak kosong
    if (!Array.isArray(rawData) || rawData.length === 0) {
      throw new Error('Data JSON kosong atau format tidak valid.');
    }

    filteredData = rawData;
    initFilters(rawData);
    renderDashboard(filteredData);

  } catch (err) {
    console.error('Gagal memuat data:', err);
    document.getElementById('data-count').textContent = 'Gagal memuat data';
    document.getElementById('dashboard-content').classList.add('hidden');

    // Tampilkan pesan error yang informatif
    const empty = document.getElementById('empty-state');
    empty.classList.remove('hidden');
    empty.innerHTML = `
      <div class="text-4xl mb-3">⚠️</div>
      <p class="text-gray-500 font-medium">Gagal memuat file data.</p>
      <p class="text-gray-400 text-sm mt-1">Pastikan file <code class="bg-gray-100 px-1 rounded">data/pengeluaran.json</code> tersedia dan server dijalankan dengan benar.</p>
      <p class="text-gray-400 text-xs mt-1">Error: ${err.message}</p>
    `;
  }
}

// Jalankan saat DOM siap
document.addEventListener('DOMContentLoaded', init);
