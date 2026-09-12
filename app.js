/* ==========================================================================
   KG Tahmin — Terminal (havalimanı kalkış tarifesi metaforu)
   guvenHesapla() gerçek algoritma; Kupon = "Biniş Kartı" gerçek çalışan
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

function flap(deger) {
  return `<span class="flap">${[...String(deger)].map((ch) => `<span class="flap-tile">${ch}</span>`).join("")}</span>`;
}

/* ==========================================================================
   KUPON / BİNİŞ KARTI — localStorage tabanlı gerçek hesaplayıcı
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
  document.getElementById("uretimZamani").textContent = saatFormatla(VERI.olusturulmaZamani);
  tumEkraniGuncelle();
}

function tumEkraniGuncelle() {
  if (!VERI) return;
  bultenCiz();
  canliCiz();
  arsivCiz();
  kuponCiz();
  miniRozetGuncelle();
}

function kapiEkleBtnHtml(mac, kaynakOran) {
  const gecerli = oranGecerle(kaynakOran);
  const eklendi = kupondaMi(mac.id);
  if (gecerli === null) {
    return `<button class="kapi-ekle-btn devre-disi" disabled>YOK</button>`;
  }
  const iddaaOran = iddaaOranaCevir(gecerli);
  return `<button class="kapi-ekle-btn ${eklendi ? "eklendi" : ""}" data-kupon-id="${mac.id}">
    ${eklendi ? "✓ " + iddaaOran.toFixed(2) : "BİNDİR · " + iddaaOran.toFixed(2)}
  </button>`;
}

function durumEtiketHtml(guven) {
  if (guven === "kesin") return `<span class="durum-etiket onaylandi">ONAYLANDI</span>`;
  if (guven === "olasi") return `<span class="durum-etiket beklemede">BEKLEMEDE</span>`;
  return `<span class="durum-etiket yok">— — —</span>`;
}

function tarifeSatirHtml(mac, hesap) {
  let detay = "";
  if (hesap.guven) {
    detay = `${hesap.tutma}/${hesap.toplam} · %${(hesap.tutmaOrani * 100).toFixed(0)}${hesap.ligUygun === false ? " · lig dışı" : ""}`;
  }
  const saat = new Date(mac.macZamani).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `
    <article class="tarife-satir" data-guven="${hesap.guven || "yok"}">
      <span class="tarife-saat">${saat}</span>
      <span class="tarife-sefer">
        <span class="tarife-lig">${mac.lig}</span>
        <span class="tarife-takim">${mac.evSahibi} — ${mac.deplasman}</span>
        <span class="tarife-oranlar">MS-KG ${iddaaOranaCevir(mac.msKg)?.toFixed(2) ?? "—"} · 6+G ${oranGecerle(mac.altUst6)?.toFixed(2) ?? "—"} · İY/MS ${oranGecerle(mac.iymsKg)?.toFixed(2) ?? "—"}</span>
      </span>
      <span>
        ${durumEtiketHtml(hesap.guven)}
        <div class="durum-detay">${detay}</div>
      </span>
      ${kapiEkleBtnHtml(mac, mac.msKg)}
    </article>
  `;
}

function bultenCiz() {
  const hesaplar = VERI.bulten.map((m) => ({ mac: m, hesap: guvenHesapla(m, VERI.statsTablosu) }));
  const kesin = hesaplar.filter((h) => h.hesap.guven === "kesin").length;
  const olasi = hesaplar.filter((h) => h.hesap.guven === "olasi").length;

  document.getElementById("bultenOzet").innerHTML = `
    <div class="ozet-hucre"><span class="ozet-sayi">${flap(hesaplar.length)}</span><span class="ozet-ad">SEFER</span></div>
    <div class="ozet-hucre onay"><span class="ozet-sayi">${flap(kesin)}</span><span class="ozet-ad">ONAYLANDI</span></div>
    <div class="ozet-hucre bekle"><span class="ozet-sayi">${flap(olasi)}</span><span class="ozet-ad">BEKLEMEDE</span></div>
  `;

  const filtreli = hesaplar.filter((h) => {
    if (bultenFiltre === "hepsi") return true;
    return h.hesap.guven === bultenFiltre;
  });

  const govde = document.getElementById("bultenTarife");
  govde.innerHTML = filtreli.length
    ? filtreli.map((h) => tarifeSatirHtml(h.mac, h.hesap)).join("")
    : `<div class="bos-hal">Bu tarifede sefer bulunamadı.</div>`;
}

document.getElementById("bultenFiltre").addEventListener("click", (e) => {
  const btn = e.target.closest(".filtre-btn");
  if (!btn) return;
  bultenFiltre = btn.dataset.f;
  document.querySelectorAll("#bultenFiltre .filtre-btn").forEach((b) => b.classList.toggle("aktif", b === btn));
  bultenCiz();
});

function radarKartHtml(mac) {
  const g = mac.dondurulmusGuven || { guven: null };
  const kaynakOran = mac.canliMsKg != null ? mac.canliMsKg : mac.msKg;
  let taktikHtml = "";
  if (mac.kirmiziSinyal) {
    const s = mac.kirmiziSinyal;
    taktikHtml = `<div class="taktik-uyari"><strong>⚡ TAKTİK SİNYALİ · ${s.taktik}</strong>${s.tahmin} — dk ${s.dk}' skor ${s.skorEv}-${s.skorDep}</div>`;
  }
  let detay = "";
  if (g.guven) detay = `donmuş · ${g.tutma}/${g.toplam}`;
  return `
    <article class="radar-kart" data-guven="${g.guven || "yok"}">
      <div class="radar-ust">
        <span>${mac.lig}</span>
        <span class="radar-dk"><span class="blip"></span>${mac.dakika}</span>
      </div>
      <div class="radar-eslesme">
        <span class="taraf">${mac.evSahibi}</span>
        ${flap(`${mac.skorEv}-${mac.skorDep}`)}
        <span class="taraf">${mac.deplasman}</span>
      </div>
      <div class="sinyal-guc-satir">
        <span class="ad">SİNYAL GÜCÜ (Canlı KG)</span>
        <span class="deger">${oranGecerle(mac.canliMsKg)?.toFixed(2) ?? "—"}</span>
      </div>
      ${taktikHtml}
      <div class="radar-alt">
        <span>
          ${durumEtiketHtml(g.guven)}
          <div class="durum-detay">${detay}</div>
        </span>
        ${kapiEkleBtnHtml(mac, kaynakOran)}
      </div>
    </article>
  `;
}

function canliCiz() {
  const govde = document.getElementById("canliRadar");
  govde.innerHTML = VERI.canli.length
    ? VERI.canli.map(radarKartHtml).join("")
    : `<div class="bos-hal">Radar ekranı boş — havada sefer yok.</div>`;
}

function defterSatirHtml(s, bitenMi) {
  const durumAd = { acik: "AÇIK", kapali: "KAPALI", mac_bulunamadi: "MAÇ BULUNAMADI", hata: "HATA" }[s.durum] || s.durum;
  let market = "";
  if (s.oran !== null && s.oran !== undefined) {
    market = `<div class="defter-market-satir">
      <div class="defter-market-hucre oneri"><span class="ad">${s.yon}</span><div class="val">${s.oran.toFixed(2)}</div></div>
      <div class="defter-market-hucre"><span class="ad">KARŞI YÖN</span><div class="val">${s.digerOran.toFixed(2)}</div></div>
    </div>`;
  } else {
    market = `<div class="bos-hal" style="padding:10px;margin:0;">Market oranı alınamadı</div>`;
  }
  return `
    <article class="defter-satir">
      <div class="defter-ust">
        <span>${s.taktik} · ${s.lig || ""}</span>
        <span class="durum-damga ${s.durum}">${durumAd}</span>
      </div>
      <div class="defter-tahmin">${s.tahmin}</div>
      <div class="defter-alt-bilgi">${s.home} ${s.skorEv} - ${s.skorDep} ${s.away} · dk ${s.dk}' · ${s.market}</div>
      ${market}
      ${bitenMi ? `<span class="sonuc-damga ${s.sonuc}">${s.sonuc}</span>` : ""}
    </article>
  `;
}

function arsivCiz() {
  const govde = document.getElementById("arsivDefter");
  const liste = arsivAlt === "aktif" ? VERI.arsiv.aktif : VERI.arsiv.biten;
  govde.innerHTML = liste.length
    ? liste.map((s) => defterSatirHtml(s, arsivAlt === "biten")).join("")
    : `<div class="bos-hal">Defterde kayıt yok.</div>`;
}

document.getElementById("arsivFiltre").addEventListener("click", (e) => {
  const btn = e.target.closest(".filtre-btn");
  if (!btn) return;
  arsivAlt = btn.dataset.a;
  document.querySelectorAll("#arsivFiltre .filtre-btn").forEach((b) => b.classList.toggle("aktif", b === btn));
  arsivCiz();
});

function stubKartHtml(k) {
  return `
    <article class="stub-kart">
      <div class="stub-bilgi">
        <span class="takimlar">${k.evSahibi} – ${k.deplasman}</span>
        <span class="pazar">Karşılıklı Gol · Var</span>
      </div>
      <div class="stub-sag">
        <span class="stub-oran">${k.oran.toFixed(2)}</span>
        <button class="stub-cikar" data-cikar-id="${k.id}">×</button>
      </div>
    </article>
  `;
}

function kuponCiz() {
  const liste = kuponOku();
  const govde = document.getElementById("kuponStubları");
  govde.innerHTML = liste.length
    ? liste.map(stubKartHtml).join("")
    : `<div class="bos-hal">Biniş kartınızda sefer bulunmamaktadır.</div>`;

  document.getElementById("kuponAdet").innerHTML = flap(liste.length);
  const toplamOran = kuponToplamOran();
  document.getElementById("kuponToplamOran").innerHTML = flap(liste.length ? toplamOran.toFixed(2) : "0.00");

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
document.getElementById("kuponIptalBtn").addEventListener("click", kuponuTemizle);

function miniRozetGuncelle() {
  const liste = kuponOku();
  document.getElementById("kuponMiniDeger").textContent = `${liste.length} · ${kuponToplamOran().toFixed(2)}x`;
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

/* ---- kapı paneli (bölüm) geçişi ---- */
function bolumeGit(ad) {
  document.querySelectorAll(".bolum").forEach((s) => s.classList.toggle("aktif", s.id === `bolum-${ad}`));
  document.querySelectorAll(".kapi-btn").forEach((b) => b.classList.toggle("aktif", b.dataset.bolum === ad));
  window.scrollTo({ top: 0, behavior: "instant" });
}

document.getElementById("kapiPanel").addEventListener("click", (e) => {
  const btn = e.target.closest(".kapi-btn");
  if (!btn) return;
  bolumeGit(btn.dataset.bolum);
});

document.getElementById("kuponMiniBtn").addEventListener("click", () => bolumeGit("kupon"));

/* ---- canlı saat ---- */
function saatiGuncelle() {
  document.getElementById("canliSaat").textContent = new Date().toLocaleTimeString("tr-TR", { hour12: false });
}
saatiGuncelle();
setInterval(saatiGuncelle, 1000);

veriYukle();
