/* ==========================================================================
   KG Tahmin — demo istemci mantığı (tasarım denemesi 3)
   guvenHesapla() gerçek algoritma; Kupon özelliği gerçek çalışan bir
   hesap makinesi (toggle + localStorage + çarpımsal oran + tutar×oran).
   ========================================================================== */

const IDDAA_KATSAYI = 1.037;
const KUPON_ANAHTAR = "kgTahminKuponV1";

const IZINLI_TAM_LIGLER = [
  "türkiye süper ligi", "ingiltere premier lig", "ispanya la liga", "italya serie a",
  "fransa ligue 1", "suudi arabistan pro lig", "isveç allsvenskan", "norveç eliteserien",
  "finlandiya veikkausliiga", "çin süper lig",
];

function ligIzinliMi(ligAdiHam) {
  const hamKucuk = String(ligAdiHam).toLocaleLowerCase("tr-TR");
  const disariBirakPattern = /(kadın|bayan|women|female|rezerv|yedek|b takım|b takımı)/;
  const yasGrubuPattern = /\bu(1[5-9]|2[0-9])\b/;
  if (disariBirakPattern.test(hamKucuk) || yasGrubuPattern.test(hamKucuk)) return false;

  const govde = hamKucuk.split(",")[0].trim();
  if (IZINLI_TAM_LIGLER.includes(govde)) return true;
  if (hamKucuk.includes("hollanda") && hamKucuk.includes("eredivisie")) return true;
  if (hamKucuk.includes("portekiz") && hamKucuk.includes("premier")) return true;
  if (hamKucuk.includes("güney kore") && hamKucuk.includes("k lig")) return true;
  return false;
}

function oranGecerle(oran) {
  if (oran === null || oran === undefined) return null;
  return oran > 1.0 ? oran : null;
}

function guvenHesapla(mac, statsTablosu) {
  const iymsKg = oranGecerle(mac.iymsKg);
  const altUst6 = oranGecerle(mac.altUst6);
  if (iymsKg === null || altUst6 === null) {
    return { guven: null, onerilen: false, tutma: null, toplam: null, tutmaOrani: null, ligUygun: null };
  }
  const anahtar = `${Math.floor(iymsKg)},${Math.floor(altUst6)}`;
  const kayit = statsTablosu[anahtar];
  if (!kayit) {
    return { guven: null, onerilen: false, tutma: null, toplam: null, tutmaOrani: null, ligUygun: null };
  }
  const tutmaOrani = kayit.tutma / kayit.toplam;
  const ligUygun = ligIzinliMi(mac.lig);
  const kesinMi = kayit.toplam >= 3 && tutmaOrani === 1.0 && ligUygun;
  return { guven: kesinMi ? "kesin" : "olasi", onerilen: true, tutma: kayit.tutma, toplam: kayit.toplam, tutmaOrani, ligUygun };
}

function iddaaOranaCevir(nesineOran) {
  const gecerli = oranGecerle(nesineOran);
  if (gecerli === null) return null;
  return Math.round(gecerli * IDDAA_KATSAYI * 100) / 100;
}

function tlFormatla(sayi) {
  return sayi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

function saatFormatla(isoZaman) {
  return new Date(isoZaman).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/* ==========================================================================
   KUPON — localStorage tabanlı gerçek hesaplayıcı
   ========================================================================== */

function kuponOku() {
  try {
    const ham = localStorage.getItem(KUPON_ANAHTAR);
    return ham ? JSON.parse(ham) : [];
  } catch {
    return [];
  }
}

function kuponYaz(liste) {
  try {
    localStorage.setItem(KUPON_ANAHTAR, JSON.stringify(liste));
  } catch { /* localStorage kullanılamıyorsa sessizce yok say */ }
}

function kupondaMi(id) {
  return kuponOku().some((k) => k.id === id);
}

function kuponToggle(mac, kaynakOran) {
  const liste = kuponOku();
  const idx = liste.findIndex((k) => k.id === mac.id);
  if (idx >= 0) {
    liste.splice(idx, 1);
  } else {
    const iddaaOran = iddaaOranaCevir(kaynakOran);
    if (iddaaOran === null) return;
    liste.push({ id: mac.id, evSahibi: mac.evSahibi, deplasman: mac.deplasman, oran: iddaaOran });
  }
  kuponYaz(liste);
  tumEkraniGuncelle();
}

function kupondanCikar(id) {
  kuponYaz(kuponOku().filter((k) => k.id !== id));
  tumEkraniGuncelle();
}

function kuponuTemizle() {
  kuponYaz([]);
  tumEkraniGuncelle();
}

function kuponToplamOran() {
  const liste = kuponOku();
  if (liste.length === 0) return 0;
  return liste.reduce((carpim, k) => carpim * k.oran, 1);
}

/* ==========================================================================
   RENDER
   ========================================================================== */

let VERI = null;
let bultenFiltre = "hepsi";
let arsivAlt = "aktif";

async function veriYukle() {
  const res = await fetch("data.json");
  VERI = await res.json();
  tumEkraniGuncelle();
}

function tumEkraniGuncelle() {
  if (!VERI) return;
  bultenCiz();
  canliCiz();
  arsivCiz();
  kuponCiz();
  kuponRozetGuncelle();
}

function kuponEkleBtnHtml(mac, kaynakOran) {
  const gecerli = oranGecerle(kaynakOran);
  const eklendi = kupondaMi(mac.id);
  if (gecerli === null) {
    return `<button class="kupon-ekle-btn devre-disi" disabled>Oran yok</button>`;
  }
  const iddaaOran = iddaaOranaCevir(gecerli);
  return `<button class="kupon-ekle-btn ${eklendi ? "eklendi" : ""}" data-kupon-id="${mac.id}">
    ${eklendi ? "✓ Kuponda" : "+ Kupona Ekle"} · ${iddaaOran.toFixed(2)}
  </button>`;
}

function etiketCipHtml(guven) {
  if (guven === "kesin") return `<span class="etiket-cip kesin">KESİN</span>`;
  if (guven === "olasi") return `<span class="etiket-cip olasi">OLASI</span>`;
  return `<span class="etiket-cip yok">ETİKET YOK</span>`;
}

function bultenKartHtml(mac, hesap) {
  let detay = "";
  if (hesap.guven) {
    detay = `${hesap.tutma}/${hesap.toplam} · %${(hesap.tutmaOrani * 100).toFixed(0)}${hesap.ligUygun === false ? " · lig izinli değil" : ""}`;
  }
  const sinif = hesap.guven === "kesin" ? "kesin-kart" : hesap.guven === "olasi" ? "olasi-kart" : "";
  return `
    <article class="kart ${sinif}" data-guven="${hesap.guven || "yok"}">
      <div class="kart-ust">
        <span class="kart-lig">${mac.lig}</span>
        <span class="kart-saat">${saatFormatla(mac.macZamani)}</span>
      </div>
      <div class="kart-takimlar">
        <span class="kart-takim">${mac.evSahibi}</span>
        <span class="kart-ayrac">vs</span>
        <span class="kart-takim">${mac.deplasman}</span>
      </div>
      <div class="oran-satiri">
        <div class="oran-hucre ${oranGecerle(mac.msKg) === null ? "bos" : ""}"><span class="ad">MS-KG</span><span class="deger">${iddaaOranaCevir(mac.msKg)?.toFixed(2) ?? "—"}</span></div>
        <div class="oran-hucre ${oranGecerle(mac.altUst6) === null ? "bos" : ""}"><span class="ad">6+ Gol</span><span class="deger">${oranGecerle(mac.altUst6)?.toFixed(2) ?? "—"}</span></div>
        <div class="oran-hucre ${oranGecerle(mac.iymsKg) === null ? "bos" : ""}"><span class="ad">İY/MS-KG</span><span class="deger">${oranGecerle(mac.iymsKg)?.toFixed(2) ?? "—"}</span></div>
      </div>
      <div class="alt-satir">
        <div>
          ${etiketCipHtml(hesap.guven)}
          <div class="etiket-detay">${detay}</div>
        </div>
        ${kuponEkleBtnHtml(mac, mac.msKg)}
      </div>
    </article>
  `;
}

function bultenCiz() {
  const hesaplar = VERI.bulten.map((m) => ({ mac: m, hesap: guvenHesapla(m, VERI.statsTablosu) }));
  const kesin = hesaplar.filter((h) => h.hesap.guven === "kesin").length;
  const olasi = hesaplar.filter((h) => h.hesap.guven === "olasi").length;

  document.getElementById("bultenSayim").innerHTML = `
    <span class="sayim-pill">${hesaplar.length} maç</span>
    <span class="sayim-pill kesin">${kesin} kesin</span>
    <span class="sayim-pill olasi">${olasi} olası</span>
  `;

  const filtreli = hesaplar.filter((h) => {
    if (bultenFiltre === "hepsi") return true;
    return h.hesap.guven === bultenFiltre;
  });

  const feed = document.getElementById("bultenFeed");
  feed.innerHTML = filtreli.length
    ? filtreli.map((h) => bultenKartHtml(h.mac, h.hesap)).join("")
    : `<div class="bos-hal">Bu filtreye uyan maç yok.</div>`;
}

document.getElementById("bultenSegment").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment-btn");
  if (!btn) return;
  bultenFiltre = btn.dataset.f;
  document.querySelectorAll("#bultenSegment .segment-btn").forEach((b) => b.classList.toggle("aktif", b === btn));
  bultenCiz();
});

function canliKartHtml(mac) {
  const g = mac.dondurulmusGuven || { guven: null };
  const kaynakOran = mac.canliMsKg != null ? mac.canliMsKg : mac.msKg;
  let sinyalHtml = "";
  if (mac.kirmiziSinyal) {
    const s = mac.kirmiziSinyal;
    sinyalHtml = `<div class="sinyal-not"><strong>⚡ Taktik Sinyali · ${s.taktik}</strong>${s.tahmin} — dk ${s.dk}' skor ${s.skorEv}-${s.skorDep}</div>`;
  }
  let detay = "";
  if (g.guven) detay = `dondurulmuş · ${g.tutma}/${g.toplam}`;
  return `
    <article class="kart" data-guven="${g.guven || "yok"}">
      <div class="kart-ust kart-canli-ust">
        <span class="kart-lig">${mac.lig}</span>
        <span class="canli-rozet"><span class="nokta"></span>${mac.dakika}</span>
      </div>
      <div class="skor-satir">
        <span class="taraf">${mac.evSahibi}</span>
        <span>${mac.skorEv} - ${mac.skorDep}</span>
        <span class="taraf">${mac.deplasman}</span>
      </div>
      <div class="canli-kg-kutu">
        <span class="ad">Canlı KG Oranı</span>
        <span class="deger">${oranGecerle(mac.canliMsKg)?.toFixed(2) ?? "—"}</span>
      </div>
      ${sinyalHtml}
      <div class="alt-satir">
        <div>
          ${etiketCipHtml(g.guven)}
          <div class="etiket-detay">${detay}</div>
        </div>
        ${kuponEkleBtnHtml(mac, kaynakOran)}
      </div>
    </article>
  `;
}

function canliCiz() {
  const feed = document.getElementById("canliFeed");
  feed.innerHTML = VERI.canli.length
    ? VERI.canli.map(canliKartHtml).join("")
    : `<div class="bos-hal">Şu anda canlı maç yok.</div>`;
}

function arsivKartHtml(s, bitenMi) {
  const durumAd = { acik: "AÇIK", kapali: "KAPALI", mac_bulunamadi: "MAÇ BULUNAMADI", hata: "HATA" }[s.durum] || s.durum;
  let market = "";
  if (s.oran !== null && s.oran !== undefined) {
    market = `<div class="market-satir">
      <div class="market-hucre oneri"><span class="ad">${s.yon}</span><div class="val">${s.oran.toFixed(2)}</div></div>
      <div class="market-hucre"><span class="ad">Karşı Yön</span><div class="val">${s.digerOran.toFixed(2)}</div></div>
    </div>`;
  } else {
    market = `<div class="bos-hal" style="padding:14px;">Market oranı alınamadı</div>`;
  }
  return `
    <article class="kart arsiv-kart">
      <div class="kart-ust">
        <span class="kart-lig">${s.taktik} · ${s.lig || ""}</span>
        <span class="durum-cip ${s.durum}">${durumAd}</span>
      </div>
      <div class="arsiv-baslik">${s.tahmin}</div>
      <div class="arsiv-alt">${s.home} ${s.skorEv} - ${s.skorDep} ${s.away} · dk ${s.dk}' · ${s.market}</div>
      ${market}
      ${bitenMi ? `<span class="sonuc-cip ${s.sonuc}">${s.sonuc}</span>` : ""}
    </article>
  `;
}

function arsivCiz() {
  const feed = document.getElementById("arsivFeed");
  const liste = arsivAlt === "aktif" ? VERI.arsiv.aktif : VERI.arsiv.biten;
  feed.innerHTML = liste.length
    ? liste.map((s) => arsivKartHtml(s, arsivAlt === "biten")).join("")
    : `<div class="bos-hal">Bu bölümde kayıt yok.</div>`;
}

document.getElementById("arsivSegment").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment-btn");
  if (!btn) return;
  arsivAlt = btn.dataset.a;
  document.querySelectorAll("#arsivSegment .segment-btn").forEach((b) => b.classList.toggle("aktif", b === btn));
  arsivCiz();
});

function kuponSatirHtml(k) {
  return `
    <article class="kart kupon-satir-kart">
      <div class="kupon-satir-bilgi">
        <span class="takimlar">${k.evSahibi} – ${k.deplasman}</span>
        <span class="pazar">Karşılıklı Gol · Var</span>
      </div>
      <div class="kupon-satir-sag">
        <span class="kupon-oran-deger">${k.oran.toFixed(2)}</span>
        <button class="kupon-cikar-btn" data-cikar-id="${k.id}">×</button>
      </div>
    </article>
  `;
}

function kuponCiz() {
  const liste = kuponOku();
  const feed = document.getElementById("kuponFeed");
  feed.innerHTML = liste.length
    ? liste.map(kuponSatirHtml).join("")
    : `<div class="bos-hal">Kuponunuzda maç bulunmamaktadır.</div>`;

  document.getElementById("kuponAdet").textContent = liste.length;
  const toplamOran = kuponToplamOran();
  document.getElementById("kuponToplamOran").textContent = liste.length ? toplamOran.toFixed(2) : "0.00";

  kazancHesapla();
}

function kazancHesapla() {
  const tutarStr = document.getElementById("kuponTutar").value;
  const tutar = parseFloat(tutarStr.replace(",", ".")) || 0;
  const toplamOran = kuponToplamOran();
  const kazanc = tutar * toplamOran;
  document.getElementById("kuponKazanc").textContent = tlFormatla(kazanc);
}

document.getElementById("kuponTutar").addEventListener("input", kazancHesapla);
document.getElementById("kuponTemizleBtn").addEventListener("click", kuponuTemizle);

function kuponRozetGuncelle() {
  const liste = kuponOku();
  const rozetMetin = document.getElementById("kuponRozetMetin");
  const navSayac = document.getElementById("altNavKuponSayac");
  if (liste.length === 0) {
    rozetMetin.textContent = "Kupon boş";
    navSayac.hidden = true;
  } else {
    rozetMetin.textContent = `${liste.length} maç · ${kuponToplamOran().toFixed(2)}x`;
    navSayac.hidden = false;
    navSayac.textContent = liste.length;
  }
}

/* ---- kupon ekle/çıkar tıklamaları (event delegation) ---- */
document.getElementById("ana-icerik").addEventListener("click", (e) => {
  const ekleBtn = e.target.closest("[data-kupon-id]");
  if (ekleBtn) {
    const id = ekleBtn.dataset.kuponId;
    const tumMaclar = [...VERI.bulten, ...VERI.canli];
    const mac = tumMaclar.find((m) => m.id === id);
    if (mac) {
      const kaynakOran = mac.canliMsKg != null ? mac.canliMsKg : mac.msKg;
      kuponToggle(mac, kaynakOran);
    }
    return;
  }
  const cikarBtn = e.target.closest("[data-cikar-id]");
  if (cikarBtn) {
    kupondanCikar(cikarBtn.dataset.cikarId);
  }
});

/* ---- sayfa/sekme geçişi ---- */
function sayfayaGit(ad) {
  document.querySelectorAll(".sayfa").forEach((s) => s.classList.toggle("aktif", s.id === `sayfa-${ad}`));
  document.querySelectorAll(".alt-nav-btn").forEach((b) => b.classList.toggle("aktif", b.dataset.sayfa === ad));
  window.scrollTo({ top: 0, behavior: "instant" });
}

document.getElementById("altNav").addEventListener("click", (e) => {
  const btn = e.target.closest(".alt-nav-btn");
  if (!btn) return;
  sayfayaGit(btn.dataset.sayfa);
});

document.getElementById("kuponRozet").addEventListener("click", () => sayfayaGit("kupon"));

veriYukle();
