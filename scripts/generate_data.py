#!/usr/bin/env python3
"""KG Tahmin demo verisi üretici (tasarım denemesi 3).

Gerçek bir sunucuya bağlanmaz. data.json içine bülten/canlı/arşiv verisi ve
Kesin/Olası hesaplamasında kullanılan istatistik tablosunu yazar. Asıl
guvenHesapla() fonksiyonu app.js içinde, tarayıcıda, ham oranlar üzerinden
çalışır — burada sadece canlı maçların "kickoff öncesi dondurulmuş" etiketini
üretmek için aynı algoritmanın bir kopyası kullanılır.
"""

import json
import random
import re
from datetime import datetime, timedelta, timezone

random.seed(7)

TR_TZ = timezone(timedelta(hours=3))
BUGUN = datetime(2026, 9, 12, tzinfo=TR_TZ)

IZINLI_TAM = [
    "türkiye süper ligi", "ingiltere premier lig", "ispanya la liga", "italya serie a",
    "fransa ligue 1", "suudi arabistan pro lig", "isveç allsvenskan", "norveç eliteserien",
    "finlandiya veikkausliiga", "çin süper lig",
]


def normalize(lig):
    # İ/I harflerini ÖNCE çevir, sonra lower() çağır (Python'da .lower() zaten
    # çağrıldıktan sonra "İ" -> "i̇" (kombine noktalı) olur, bu yanlış eşleşir).
    return lig.replace("İ", "i").replace("I", "ı").lower()


def lig_izinli_mi(lig):
    ham = normalize(lig)
    disari = ["kadın", "bayan", "women", "female", "rezerv", "yedek", "b takım", "b takımı"]
    if any(k in ham for k in disari):
        return False
    if re.search(r"\bu(1[5-9]|2[0-9])\b", ham):
        return False
    govde = ham.split(",")[0].strip()
    if govde in IZINLI_TAM:
        return True
    if "hollanda" in ham and "eredivisie" in ham:
        return True
    if "portekiz" in ham and "premier" in ham:
        return True
    if "güney kore" in ham and "k lig" in ham:
        return True
    return False


def guven_hesapla(iy, alt, lig, stats):
    if iy is None or alt is None or iy <= 1.0 or alt <= 1.0:
        return {"guven": None, "onerilen": False, "tutma": None, "toplam": None, "tutmaOrani": None, "ligUygun": None}
    anahtar = f"{int(iy // 1)},{int(alt // 1)}"
    kayit = stats.get(anahtar)
    if not kayit:
        return {"guven": None, "onerilen": False, "tutma": None, "toplam": None, "tutmaOrani": None, "ligUygun": None}
    oran = kayit["tutma"] / kayit["toplam"]
    lig_uygun = lig_izinli_mi(lig)
    guven = "kesin" if (kayit["toplam"] >= 3 and oran == 1.0 and lig_uygun) else "olasi"
    return {"guven": guven, "onerilen": True, "tutma": kayit["tutma"], "toplam": kayit["toplam"],
            "tutmaOrani": oran, "ligUygun": lig_uygun}


STATS = {}

KESIN_ANAHTAR = ["13,6", "9,4", "17,7", "11,5", "21,8", "8,3", "14,9"]
kesin_toplamlar = [4, 6, 3, 5, 8, 3, 12]
for k, t in zip(KESIN_ANAHTAR, kesin_toplamlar):
    STATS[k] = {"tutma": t, "toplam": t}

OLASI_ANAHTAR = [
    ("18,9", 4, 7), ("14,4", 10, 11), ("6,3", 1, 1), ("22,10", 2, 2),
    ("10,4", 5, 9), ("19,8", 2, 3), ("7,2", 6, 8), ("25,11", 1, 2),
    ("12,5", 3, 6), ("16,6", 7, 13), ("5,2", 2, 2), ("20,9", 4, 4),
    ("9,3", 3, 5), ("23,10", 1, 1), ("15,5", 9, 10),
]
for k, tutma, toplam in OLASI_ANAHTAR:
    STATS[k] = {"tutma": tutma, "toplam": toplam}

STATS["24,12"] = {"tutma": 5, "toplam": 5}  # izinli olmayan ligde bile %100 -> yine de olası (nüans)

IZINLI_ORNEK_LIGLER = [
    "Türkiye Süper Ligi", "İngiltere Premier Lig", "İspanya La Liga", "İtalya Serie A",
    "Fransa Ligue 1", "Suudi Arabistan Pro Lig", "İsveç Allsvenskan", "Norveç Eliteserien",
    "Finlandiya Veikkausliiga", "Çin Süper Lig",
    "Hollanda Eredivisie", "Portekiz Premier Ligi", "Güney Kore K Lig 1",
]

DIGER_LIGLER = [
    "Polonya Ekstraklasa", "Slovenya PrvaLiga", "Güney Afrika Premier Lig", "Şili Premier Lig",
    "Ukrayna Premier Lig", "Romanya Liga 1", "Sırbistan SuperLiga", "Hırvatistan HNL",
    "Bulgaristan Parva Liga", "Danimarka Superligaen", "Belçika Pro Lig", "İsviçre Super Lig",
    "Avusturya Bundesliga", "İskoçya Premiership", "Yunanistan Süper Lig",
    "Meksika Liga MX", "Arjantin Liga Profesyonal", "Brezilya Serie A", "Japonya J1 Lig",
    "Avustralya A-Lig",
]

ISTISNA_LIGLER = [
    "Türkiye Süper Ligi, Kadınlar", "İngiltere Premier Lig U21", "İspanya La Liga B Takımları",
]

TAKIMLAR = [
    ("AL Taawoun", "Al Hilal"), ("Gornik Zabrze", "Lech Poznan"), ("Koper", "O. Ljubljana"),
    ("Chippa Utd", "Mamelodi Sundowns"), ("Nublense", "Everton DV"), ("LNZ Cherkasy", "Obolon Kiev"),
    ("Galatasaray", "Trabzonspor"), ("Fenerbahçe", "Beşiktaş"), ("Arsenal", "Chelsea"),
    ("Liverpool", "Manchester City"), ("Real Madrid", "Sevilla"), ("Barcelona", "Villarreal"),
    ("Juventus", "Napoli"), ("Inter", "Milan"), ("PSG", "Marsilya"), ("Lyon", "Monaco"),
    ("Al Nassr", "Al Ittihad"), ("Al Ahli", "Al Shabab"), ("Malmö FF", "AIK"),
    ("Hammarby", "Djurgarden"), ("Rosenborg", "Molde"), ("Bodo/Glimt", "Viking"),
    ("HJK Helsinki", "KuPS"), ("Shanghai Port", "Shandong Taishan"), ("Beijing Guoan", "Shanghai Shenhua"),
    ("Ajax", "PSV"), ("Feyenoord", "AZ Alkmaar"), ("Benfica", "Porto"), ("Sporting CP", "Braga"),
    ("Ulsan HD", "Jeonbuk Hyundai"), ("Pohang Steelers", "FC Seoul"),
    ("Legia Varşova", "Wisla Krakow"), ("Maribor", "Celje"), ("Kaizer Chiefs", "Orlando Pirates"),
    ("Colo Colo", "Universidad de Chile"), ("Shakhtar Donetsk", "Dinamo Kiev"),
    ("FCSB", "CFR Cluj"), ("Crvena Zvezda", "Partizan"), ("Dinamo Zagreb", "Hajduk Split"),
    ("Ludogorets", "Levski Sofia"), ("Kopenhag", "Brondby"), ("Anderlecht", "Club Brugge"),
    ("Basel", "Young Boys"), ("Salzburg", "Sturm Graz"), ("Celtic", "Rangers"),
    ("Olympiakos", "Panathinaikos"), ("Club America", "Chivas"), ("Boca Juniors", "River Plate"),
    ("Flamengo", "Palmeiras"), ("Yokohama Marinos", "Kawasaki Frontale"), ("Sydney FC", "Melbourne Victory"),
    ("Antalyaspor", "Konyaspor"), ("Everton", "Aston Villa"), ("Atletico Madrid", "Real Sociedad"),
    ("Roma", "Fiorentina"), ("Lille", "Nice"),
]

random.shuffle(TAKIMLAR)
takim_havuzu = iter(TAKIMLAR * 3)


def sonraki_takim():
    return next(takim_havuzu)


def zaman_uret(saat_offset):
    return (BUGUN + timedelta(hours=saat_offset)).isoformat()


bulten = []
mac_id = 3217000


def yeni_id():
    global mac_id
    mac_id += 1
    return str(mac_id)


def oran_uret_anahtar_icin(anahtar):
    iy, alt = anahtar.split(",")
    iy, alt = int(iy), int(alt)
    return round(iy + random.uniform(0.05, 0.95), 2), round(alt + random.uniform(0.05, 0.95), 2)


def rastgele_ms_kg():
    return round(random.uniform(1.25, 2.30), 2)


# 1) KESİN (~5%)
for i in range(3):
    anahtar = KESIN_ANAHTAR[i % len(KESIN_ANAHTAR)]
    iyms, altust = oran_uret_anahtar_icin(anahtar)
    lig = IZINLI_ORNEK_LIGLER[i % len(IZINLI_ORNEK_LIGLER)]
    ev, dep = sonraki_takim()
    bulten.append({
        "id": yeni_id(), "lig": lig, "evSahibi": ev, "deplasman": dep,
        "macZamani": zaman_uret(random.uniform(2, 30)),
        "msKg": rastgele_ms_kg(), "altUst6": altust, "iymsKg": iyms,
    })

# 2) OLASI (~30%)
for i in range(15):
    ev, dep = sonraki_takim()
    secim = i % 4
    if secim == 0:
        anahtar, _, _ = OLASI_ANAHTAR[i % len(OLASI_ANAHTAR)]
        iyms, altust = oran_uret_anahtar_icin(anahtar)
        lig = random.choice(DIGER_LIGLER + IZINLI_ORNEK_LIGLER)
    elif secim == 1:
        anahtar = random.choice(KESIN_ANAHTAR + ["24,12"])
        iyms, altust = oran_uret_anahtar_icin(anahtar)
        lig = random.choice(DIGER_LIGLER)
    elif secim == 2:
        anahtar = random.choice(KESIN_ANAHTAR)
        iyms, altust = oran_uret_anahtar_icin(anahtar)
        lig = random.choice(ISTISNA_LIGLER)
    else:
        anahtar, _, _ = random.choice(OLASI_ANAHTAR)
        iyms, altust = oran_uret_anahtar_icin(anahtar)
        lig = random.choice(DIGER_LIGLER)
    bulten.append({
        "id": yeni_id(), "lig": lig, "evSahibi": ev, "deplasman": dep,
        "macZamani": zaman_uret(random.uniform(1, 40)),
        "msKg": rastgele_ms_kg(), "altUst6": altust, "iymsKg": iyms,
    })

# 3) Etiketsiz (~65%)
kullanilan_anahtarlar = set(STATS.keys())
uretilen = 0
while uretilen < 32:
    iy = random.randint(2, 30)
    alt = random.randint(1, 15)
    anahtar = f"{iy},{alt}"
    if anahtar in kullanilan_anahtarlar:
        continue
    iyms = round(iy + random.uniform(0.05, 0.95), 2)
    altust = round(alt + random.uniform(0.05, 0.95), 2)
    ev, dep = sonraki_takim()
    lig = random.choice(DIGER_LIGLER + IZINLI_ORNEK_LIGLER)
    if uretilen % 11 == 0:
        altust = None
    bulten.append({
        "id": yeni_id(), "lig": lig, "evSahibi": ev, "deplasman": dep,
        "macZamani": zaman_uret(random.uniform(1, 48)),
        "msKg": rastgele_ms_kg(), "altUst6": altust, "iymsKg": iyms,
    })
    uretilen += 1

random.shuffle(bulten)
bulten.sort(key=lambda m: m["macZamani"])

# CANLI
canli = []
canli_sayisi = 18
for i in range(canli_sayisi):
    ev, dep = sonraki_takim()
    lig = random.choice(DIGER_LIGLER + IZINLI_ORNEK_LIGLER)
    dakika_secenek = random.choice(["4'", "12'", "23'", "38'", "45'", "Devre Arası", "52'", "61'", "70'", "78'", "84'", "90'"])
    skor_ev = random.randint(0, 3)
    skor_dep = random.randint(0, 3)
    pre_iyms, pre_altust = None, None
    if random.random() < 0.7:
        r = random.random()
        if r < 0.35:
            anahtar = random.choice(KESIN_ANAHTAR)
            lig = random.choice(IZINLI_ORNEK_LIGLER)
        elif r < 0.6:
            anahtar, _, _ = random.choice(OLASI_ANAHTAR)
        else:
            anahtar = None
        if anahtar:
            pre_iyms, pre_altust = oran_uret_anahtar_icin(anahtar)
    dondurulmus = guven_hesapla(pre_iyms, pre_altust, lig, STATS)
    canli.append({
        "id": yeni_id(), "lig": lig, "evSahibi": ev, "deplasman": dep,
        "macZamani": zaman_uret(-random.uniform(0.1, 1.4)),
        "dakika": dakika_secenek, "skorEv": skor_ev, "skorDep": skor_dep,
        "canliMsKg": round(random.uniform(1.02, 1.85), 2),
        "msKg": rastgele_ms_kg(),
        "dondurulmusGuven": dondurulmus,
        "kirmiziSinyal": None,
    })

TAKTIKLER = ["T1", "T2", "T3"]
for idx in random.sample(range(canli_sayisi), 5):
    mac = canli[idx]
    mac["kirmiziSinyal"] = {
        "taktik": random.choice(TAKTIKLER), "tahmin": "MS 3.5 ÜST",
        "dk": max(1, int(mac["dakika"].rstrip("'")) - 3) if mac["dakika"].endswith("'") else 60,
        "skorEv": mac["skorEv"], "skorDep": mac["skorDep"],
    }

canli.insert(0, {
    "id": "3221730", "lig": "Şili Premier Lig", "evSahibi": "Nublense", "deplasman": "Everton DV",
    "macZamani": zaman_uret(-0.2),
    "dakika": "2'", "skorEv": 0, "skorDep": 0, "canliMsKg": 1.5, "msKg": 1.55,
    "dondurulmusGuven": {"guven": None, "onerilen": False, "tutma": None, "toplam": None, "tutmaOrani": None, "ligUygun": None},
    "kirmiziSinyal": None,
})
canli.insert(1, {
    "id": "3300001", "lig": "Ukrayna Premier Lig", "evSahibi": "LNZ Cherkasy", "deplasman": "Obolon Kiev",
    "macZamani": zaman_uret(-1.3),
    "dakika": "78'", "skorEv": 3, "skorDep": 1, "canliMsKg": 1.05, "msKg": 1.4,
    "dondurulmusGuven": {"guven": "olasi", "onerilen": True, "tutma": 4, "toplam": 7, "tutmaOrani": 4 / 7, "ligUygun": False},
    "kirmiziSinyal": {"taktik": "T1", "tahmin": "MS 3.5 ÜST", "dk": 75, "skorEv": 3, "skorDep": 1},
})

# ARŞİV
arsiv_aktif = []
for i in range(10):
    ev, dep = sonraki_takim()
    ust_oran = round(random.uniform(1.15, 1.65), 2)
    alt_oran = round(random.uniform(1.9, 3.2), 2)
    arsiv_aktif.append({
        "home": ev, "away": dep, "lig": random.choice(DIGER_LIGLER + IZINLI_ORNEK_LIGLER),
        "taktik": random.choice(TAKTIKLER), "tahmin": "MS 3.5 ÜST",
        "dk": random.randint(55, 88), "skorEv": random.randint(1, 4), "skorDep": random.randint(0, 2),
        "market": "Alt/Üst 3.5", "yon": "Üst", "oran": ust_oran, "digerOran": alt_oran,
        "durum": "acik", "sonuc": "BİLİNMİYOR",
        "sinyalZamani": zaman_uret(-random.uniform(0.3, 1.5)),
        "arsivZamani": zaman_uret(-random.uniform(0.05, 0.3)),
    })

arsiv_aktif.insert(0, {
    "home": "LNZ Cherkasy", "away": "Obolon Kiev", "lig": "Premier Lig",
    "taktik": "T1", "tahmin": "MS 3.5 ÜST",
    "dk": 90, "skorEv": 3, "skorDep": 1,
    "market": "Alt/Üst 3.5", "yon": "Üst", "oran": 1.36, "digerOran": 2.14,
    "durum": "acik", "sonuc": "TUTTU",
    "sinyalZamani": "2026-09-12T13:51:00+03:00", "arsivZamani": "2026-09-12T14:31:06+03:00",
})

arsiv_biten = []
DURUMLAR_BITEN = ["kapali"] * 10 + ["mac_bulunamadi", "hata"]
for i in range(15):
    ev, dep = sonraki_takim()
    durum = DURUMLAR_BITEN[i % len(DURUMLAR_BITEN)]
    if durum == "kapali":
        ust_oran = round(random.uniform(1.15, 1.7), 2)
        alt_oran = round(random.uniform(1.9, 3.4), 2)
        sonuc = random.choice(["TUTTU", "TUTTU", "TUTMADI"])
    else:
        ust_oran = None
        alt_oran = None
        sonuc = "BİLİNMİYOR"
    arsiv_biten.append({
        "home": ev, "away": dep, "lig": random.choice(DIGER_LIGLER + IZINLI_ORNEK_LIGLER),
        "taktik": random.choice(TAKTIKLER), "tahmin": "MS 3.5 ÜST",
        "dk": 90, "skorEv": random.randint(1, 4), "skorDep": random.randint(0, 3),
        "market": "Alt/Üst 3.5", "yon": "Üst", "oran": ust_oran, "digerOran": alt_oran,
        "durum": durum, "sonuc": sonuc,
        "sinyalZamani": zaman_uret(-random.uniform(2, 10)),
        "arsivZamani": zaman_uret(-random.uniform(0.5, 2)),
    })

data = {
    "olusturulmaZamani": BUGUN.isoformat(),
    "statsTablosu": STATS,
    "bulten": bulten,
    "canli": canli,
    "arsiv": {"aktif": arsiv_aktif, "biten": arsiv_biten},
}

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Bülten: {len(bulten)}, Canlı: {len(canli)}, Arşiv aktif: {len(arsiv_aktif)}, biten: {len(arsiv_biten)}")
