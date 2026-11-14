// src/components/adminUnits.js
//
// Administrative units (الوحدات الإدارية) under each locality: the level below
// STATE_LOCALITIES, keyed the same way (state key → locality key → units).
// Source: the Ministry list "وحدات ادارية.xlsx" sent by Qusay on 2026-11-14.
// Arabic names are as in that list; English names are transliterations and
// can be corrected here. Forms store the Arabic name (`ar`), which stays the
// same if an English spelling is corrected.
//
// Not in the sheet: Kassala; South Kordofan's Al Buram, Heiban and Um Durein;
// West Kordofan's Abyei administrative area and As Salam. Left out because no
// matching locality exists in STATE_LOCALITIES: Al Fula (West Kordofan), Ulu
// area (Blue Nile), nomads/refugees (South Darfur), special population groups
// (Gezira). Where a locality has no units, forms take free text instead.

export const ADMIN_UNITS = {
  "Gezira": {
    "Medani Al Kubra": [
      { en: "Al Shabaraga", ar: "الشبارقة" },
      { en: "Hanatoub", ar: "حنتوب" },
      { en: "Madani Central", ar: "مدني وسط" },
      { en: "Madani South", ar: "مدني جنوب" },
      { en: "Madani North", ar: "مدني شمال" },
      { en: "Souq Central", ar: "السوق المركزي" },
      { en: "Al Waha", ar: "الواحة" },
    ],
    "Janub Al Jazirah": [
      { en: "Barakat", ar: "بركات" },
      { en: "Wad Al Na'eim", ar: "ود النعيم" },
      { en: "Al Haj Abdalla", ar: "الحاج عبدالله" },
      { en: "Al Hadad", ar: "الحداد" },
      { en: "Al Housh", ar: "الحوش" },
      { en: "City Arab", ar: "المدينة عرب" },
      { en: "Wad Ra'eia", ar: "ود رعية" },
    ],
    "Al Hasahisa": [
      { en: "Tabat", ar: "طابت" },
      { en: "Al Hasahisa", ar: "الحصاحيصا" },
      { en: "Al Maheireiba", ar: "المحيريبا" },
      { en: "Abu Gouta", ar: "أبوقوتة" },
      { en: "Wad Habouba", ar: "ودحبوبة" },
      { en: "Al Raba", ar: "الربع" },
      { en: "Al Masalameia", ar: "المسلمية" },
    ],
    "Al Kamlin": [
      { en: "Al Maseid", ar: "المسيد" },
      { en: "Al Kamlin", ar: "الكاملين" },
      { en: "Al Sana'at", ar: "الصناعات" },
      { en: "Al Ma'eilag", ar: "المعيلق" },
      { en: "Al Sareiha", ar: "السريحة" },
    ],
    "Sharg Al Jazirah": [
      { en: "City Rafa'a", ar: "مدينة رفاعة" },
      { en: "Rural Rafa'a", ar: "ريفى رفاعة" },
      { en: "Al Halaleia", ar: "الهلالية" },
      { en: "Tamaboul", ar: "تمبول" },
      { en: "Wad Raoua", ar: "ودراوة" },
    ],
    "Um Algura": [
      { en: "Central Um Al Gari", ar: "وسط أم القرى" },
      { en: "South Um Al Gari", ar: "جنوب أم القرى" },
      { en: "North Um Al Gari", ar: "شمال أم القرى" },
    ],
    "Al Manaqil": [
      { en: "City Al Manaqil", ar: "مدينه المناقل" },
      { en: "Rural Al Manaqil", ar: "ريفى المناقل" },
      { en: "Al Jamousi", ar: "الجاموسى" },
      { en: "Al Hadi", ar: "الهدى" },
      { en: "Al Kareimat", ar: "الكريمت" },
    ],
    "Al Qurashi": [
      { en: "Al Azazi", ar: "العزازي" },
      { en: "Al Matouri", ar: "الماطوري" },
      { en: "Al Qurashi", ar: "القرشي" },
      { en: "Wad Al Noura", ar: "ودالنورة" },
      { en: "Wad Adam", ar: "ودادم" },
      { en: "Ma'toug", ar: "معتوق" },
    ],
  },
  "Red Sea": {
    "Port Sudan": [
      { en: "Port Sudan Central", ar: "بورتسودان وسط" },
      { en: "Port Sudan East", ar: "بورتسودان شرق" },
      { en: "Port Sudan South", ar: "بورتسودان جنوب" },
    ],
    "Sawakin": [
      { en: "Sawakin", ar: "سواكن" },
    ],
    "Al Ganab": [
      { en: "Al Aouleib", ar: "الاوليب" },
      { en: "Al Ganab", ar: "القنب" },
    ],
    "Sinkat": [
      { en: "Sinkat", ar: "سنكات" },
      { en: "Jabeit", ar: "جبيت" },
    ],
    "Haya": [
      { en: "Haya", ar: "هيا" },
      { en: "East Haya", ar: "شرق هيا" },
    ],
    "Dordieb": [
      { en: "Dordieb", ar: "درديب" },
    ],
    "Tawkar": [
      { en: "Tawkar", ar: "طوكر" },
      { en: "Rural Tawkar", ar: "ريفى طوكر" },
    ],
    "Agig": [
      { en: "Agig", ar: "عقيق" },
      { en: "Garoura", ar: "قرورة" },
    ],
    "Jubayt Elma'aadin": [
      { en: "Mahamad Goul", ar: "محمد قول" },
      { en: "Jabeiit Al Ma'adan", ar: "جبييت المعادن" },
    ],
    "Hala'ib": [
      { en: "Aouseif", ar: "اوسيف" },
    ],
  },
  "Khartoum": {
    "Khartoum": [
      { en: "Khartoum", ar: "الخرطوم" },
      { en: "Khartoum East", ar: "الخرطوم شرق" },
      { en: "Khartoum Central", ar: "الخرطوم وسط" },
      { en: "Khartoum West", ar: "الخرطوم غرب" },
      { en: "Al Shahada", ar: "الشهداء" },
      { en: "Souba", ar: "سوبا" },
      { en: "Arakouitat", ar: "اركويتات" },
      { en: "Al Jareifat", ar: "الجريفات" },
    ],
    "Jebel Awlia": [
      { en: "Al Kalakalat", ar: "الكلاكلات" },
      { en: "Al Jabal", ar: "الجبل" },
      { en: "Al Nasar", ar: "النصر" },
      { en: "Al Azahari", ar: "الازهرى" },
    ],
    "Um Durman": [
      { en: "Omdurman North", ar: "ام درمان شمال" },
      { en: "Omdurman South", ar: "ام درمان جنوب" },
      { en: "Abu Sa'd", ar: "ابوسعد" },
      { en: "Salahat", ar: "صالحات" },
      { en: "Rural South", ar: "الريف الجنوبي" },
    ],
    "Karrari": [
      { en: "Al Thoura", ar: "الثورة" },
      { en: "Karari", ar: "كررى" },
      { en: "Al Fatah", ar: "الفتح" },
      { en: "Rural", ar: "الريف" },
    ],
    "Um Bada": [
      { en: "Al Ameir", ar: "الامير" },
      { en: "Al Baga'a", ar: "البقعه" },
      { en: "As Salam", ar: "السلام" },
      { en: "Rural", ar: "الريف" },
    ],
    "Bahri": [
      { en: "Bahri", ar: "بحرى" },
      { en: "Al Makhatar", ar: "المختار" },
      { en: "Al Halafaya", ar: "الحلفايا" },
      { en: "Al Daroushab", ar: "الدروشاب" },
      { en: "Al Saleit", ar: "السليت" },
      { en: "Al Jeili", ar: "الجيلى" },
    ],
    "Sharg An Neel": [
      { en: "Al Haj Yousaf West", ar: "الحاج يوسف غرب" },
      { en: "Al Haj Yousaf East", ar: "الحاج يوسف شرق" },
      { en: "Al Jareifat (a)", ar: "الجريفات (أ)" },
      { en: "Al Jareifat (b)", ar: "الجريفات (ب)" },
      { en: "Um Dwaban", ar: "ام ضوابان" },
      { en: "Al Aseilat", ar: "العسيلات" },
      { en: "Al Eilafoun", ar: "العيلفون" },
      { en: "Wadi Souba", ar: "وادي سوبا" },
      { en: "Wad Abu Salah", ar: "ودابوصالح" },
      { en: "Abu Daleig", ar: "ابودليق" },
    ],
  },
  "Northern": {
    "Halfa": [
      { en: "Halfa", ar: "حلفا" },
      { en: "Abari", ar: "عبري" },
    ],
    "Delgo": [
      { en: "Delgo", ar: "دلقو" },
      { en: "Fareig", ar: "فريق" },
      { en: "Al Tara'a", ar: "الترعة" },
    ],
    "Al Burgaig": [
      { en: "Karama", ar: "كرمة" },
      { en: "Aragou", ar: "أرقو" },
    ],
    "Dongola": [
      { en: "Dongola", ar: "دنقلا" },
      { en: "Sharg An Neel", ar: "شرق النيل" },
      { en: "Al Hafeir", ar: "الحفير" },
    ],
    "Al Golid": [
      { en: "Al Golid", ar: "القولد" },
      { en: "Dongola Al Ajouz", ar: "دنقلا العجوز" },
    ],
    "Ad Dabbah": [
      { en: "Ad Dabbah", ar: "الدبة" },
      { en: "At Tadamon", ar: "التضامن" },
      { en: "Al Ghaba", ar: "الغابة" },
    ],
    "Merwoe": [
      { en: "Al Gareir", ar: "القرير" },
      { en: "Amari Al Jadeida", ar: "امرى الجديده" },
      { en: "Marwi", ar: "مروى" },
      { en: "Al Shahada", ar: "الشهداء" },
      { en: "Kareima", ar: "كريمه" },
      { en: "Um Jwaseir", ar: "ام جواسير" },
    ],
  },
  "Gedaref": {
    "Madeinat Al Gedaref": [
      { en: "Al Gadaraf", ar: "القضارف" },
    ],
    "Wasat Al Gedaref": [
      { en: "Wasat Al Gedaref", ar: "وسط القضارف" },
    ],
    "Al Butanah": [
      { en: "Al Batana", ar: "البطانه" },
    ],
    "Al Fashaga": [
      { en: "Al Shwak", ar: "الشواك" },
      { en: "Al Lakadi", ar: "اللكدى" },
      { en: "Basalam", ar: "باسلام" },
    ],
    "Ar Rahad": [
      { en: "Al Hwata", ar: "الحواته" },
      { en: "Wad Al Sha'r", ar: "ودالشاعر" },
    ],
    "Gala'a Al Nahal": [
      { en: "Al Nahal", ar: "النحل" },
      { en: "Ban", ar: "بان" },
    ],
    "Al Fao": [
      { en: "North Al Fao", ar: "شمال الفاو" },
      { en: "Central Al Fao", ar: "وسط الفاو" },
      { en: "South Al Fao", ar: "جنوب الفاو" },
    ],
    "Galabat Ash-Shargiah": [
      { en: "Douka", ar: "دوكة" },
    ],
    "Al Mafaza": [
      { en: "Al Mafaza", ar: "المفازه" },
    ],
    "Basundah": [
      { en: "Basanada", ar: "باسنده" },
    ],
    "Al Qureisha": [
      { en: "Al Qureisha", ar: "القريشة" },
      { en: "Al Magaran", ar: "المقرن" },
    ],
    "Al Galabat Al Gharbyah - Kassab": [
      { en: "Kasab", ar: "كساب" },
      { en: "Al Houri", ar: "الحورى" },
      { en: "Banadagheiou", ar: "باندغيو" },
    ],
  },
  "Blue Nile": {
    "Ed Damazine": [
      { en: "Ed Damazine", ar: "الدمازين" },
      { en: "Al Sareiou", ar: "السريو" },
    ],
    "At Tadamon - BN": [
      { en: "Rourou", ar: "رورو" },
      { en: "Bout", ar: "بوط" },
    ],
    "Ar Rusayris": [
      { en: "City Al Raseiras", ar: "مدينه الرصيرص" },
      { en: "North Al Raseiras", ar: "شمال الرصيرص" },
    ],
    "Wad Al Mahi": [
      { en: "Wad Al Mahi", ar: "ودالماحي" },
      { en: "Al Kadalou", ar: "الكدالو" },
    ],
    "Baw": [
      { en: "Wad Abouk", ar: "ودابوك" },
      { en: "Baw", ar: "باو" },
      { en: "Masafa", ar: "مصفا" },
    ],
    "Geisan": [
      { en: "Afad", ar: "افد" },
      { en: "Geisan", ar: "قيسان" },
    ],
    "Al Kurmuk": [
      { en: "Al Keili", ar: "الكيلي" },
      { en: "Karan Karan", ar: "كرن كرن" },
      { en: "Al Kurmuk", ar: "الكرمك" },
    ],
  },
  "South Kordofan": {
    "Kadugli": [
      { en: "City", ar: "المدينة" },
    ],
    "Ar Reif Ash Shargi": [
      { en: "Al Kouik", ar: "الكويك" },
    ],
    "Dilling": [
      { en: "City", ar: "المدينة" },
      { en: "Al Farashaia", ar: "الفرشاية" },
    ],
    "Habila - SK": [
      { en: "Habeila", ar: "هبيلا" },
      { en: "Al Karagal", ar: "الكرقل" },
      { en: "Karatala", ar: "كرتالا" },
      { en: "Hajar Al Jwad", ar: "حجر الجواد" },
    ],
    "Delami": [
      { en: "Delami", ar: "دلامي" },
    ],
    "Al Quoz": [
      { en: "Al Dabeibat", ar: "الدبيبات" },
      { en: "Al Hamadi", ar: "الحمادي" },
      { en: "Dabeikar", ar: "دبيكر" },
      { en: "Al Seisaban", ar: "السيسبان" },
    ],
    "Abu Kershola": [
      { en: "Abu Karashoula", ar: "ابوكرشولا" },
      { en: "Al Feid", ar: "الفيض" },
      { en: "Um Baramabeita", ar: "ام برمبيطة" },
    ],
    "Abassiya": [
      { en: "Abassiya", ar: "العباسية" },
      { en: "Al Moureib", ar: "الموريب" },
      { en: "Tabasa", ar: "تبسة" },
      { en: "Tajour", ar: "تجور" },
      { en: "Al Jabal", ar: "الجبل" },
    ],
    "Ar Rashad": [
      { en: "Rashad", ar: "رشاد" },
      { en: "Tanadak", ar: "تاندك" },
      { en: "Tajamala", ar: "تجملا" },
      { en: "Kabous", ar: "كابوس" },
    ],
    "At Tadamon - SK": [
      { en: "Al Taratar", ar: "الترتر" },
      { en: "Wkra", ar: "وكرة" },
    ],
    "Abu Jubayhah": [
      { en: "Abu Jabeiha", ar: "ابوجبيهه" },
      { en: "Al Sarajeia", ar: "السراجيه" },
      { en: "Jadeid", ar: "جديد" },
    ],
    "Ghadeer": [
      { en: "Kalougi", ar: "كالوقي" },
      { en: "Maranaj", ar: "مرنج" },
      { en: "Um Daheileib", ar: "ام دحيليب" },
      { en: "Gadeir", ar: "قدير" },
    ],
    "Talawdi": [
      { en: "Taloudi", ar: "تالودي" },
    ],
    "Al Leri": [
      { en: "Al Leri East", ar: "الليري شرق" },
      { en: "Al Leri West", ar: "الليري غرب" },
    ],
  },
  "Sennar": {
    "Sennar": [
      { en: "City Sennar", ar: "مدينة سنار" },
      { en: "Al Sakar", ar: "السكر" },
      { en: "Al Gharabi", ar: "الغربى" },
    ],
    "Sharg Sennar": [
      { en: "Wad Al Abas", ar: "ود العباس" },
      { en: "Al Sharagi", ar: "الشرقى" },
      { en: "Takatouk", ar: "تكتوك" },
      { en: "Douba", ar: "دوبا" },
    ],
    "Sinja": [
      { en: "City Sinja", ar: "مدينة سنجة" },
      { en: "Rural Sinja", ar: "ريفى سنجة" },
      { en: "Um Banein", ar: "ام بنين" },
    ],
    "Abu Hujar": [
      { en: "Abu Hajar", ar: "ابوحجار" },
      { en: "Wad Al Neil", ar: "ود النيل" },
    ],
    "Ad Dali": [
      { en: "Al Dali", ar: "الدالى" },
      { en: "Al Mazamoum", ar: "المزموم" },
    ],
    "As Suki": [
      { en: "City Al Souki", ar: "مدينة السوكى" },
      { en: "Rural Al Souki", ar: "ريفى السوكى" },
      { en: "Karakouj", ar: "كركوج" },
      { en: "Al Lakanadi", ar: "اللكندى" },
    ],
    "Ad Dinder": [
      { en: "City Ad Dinder", ar: "مدينة الدندر" },
      { en: "East Ad Dinder", ar: "شرق الدندر" },
      { en: "West Ad Dinder", ar: "غرب الدندر" },
    ],
  },
  "East Darfur": {
    "Ad Du'ayn": [
      { en: "Ad Du'ayn North", ar: "الضعين شمال" },
      { en: "Ad Du'ayn South", ar: "الضعين جنوب" },
    ],
    "Al Firdous": [
      { en: "Al Firdous", ar: "الفردوس" },
      { en: "Al Ryad", ar: "الرياض" },
    ],
    "Bahr Al Arab": [
      { en: "Abu Matarag", ar: "ابومطارق" },
      { en: "Sarahan", ar: "سرحان" },
    ],
    "Abu Jabrah": [
      { en: "Abu Jabara", ar: "ابوجابرة" },
      { en: "Al Joughan", ar: "الجوغان" },
    ],
    "Abu Karinka": [
      { en: "Abu Karanaka", ar: "ابوكارنكا" },
      { en: "Jad Al Seid", ar: "جاد السيد" },
    ],
    "Assalaya": [
      { en: "Assalaya", ar: "عسلاية" },
      { en: "Kaleikal", ar: "كليكل" },
    ],
    "Adila": [
      { en: "Adila", ar: "عديلة" },
      { en: "Sharaf", ar: "شارف" },
    ],
    "Yassin": [
      { en: "Ys", ar: "يس" },
      { en: "Mahajareia", ar: "مهاجرية" },
    ],
    "Shia'ria": [
      { en: "Shia'ria", ar: "شعيرية" },
      { en: "Khazan Jadeid", ar: "خزان جديد" },
    ],
  },
  "North Darfur": {
    "Al Fasher": [
      { en: "City Al Fasher", ar: "مدينة الفاشر" },
      { en: "Camp Abu Shouk", ar: "معسكر ابوشوك" },
      { en: "Camp As Salam", ar: "معسكر السلام" },
      { en: "Camp Zamazam", ar: "معسكر زمزم" },
      { en: "Rural Al Fasher", ar: "ريفى الفاشر" },
      { en: "Kourama", ar: "كورما" },
    ],
    "Um Kadadah": [
      { en: "Um Kadada", ar: "ام كدادة" },
    ],
    "Kebkabiya": [
      { en: "Kebkabiya", ar: "كبكابية" },
      { en: "Jebel Si", ar: "جبل سي" },
    ],
    "Kutum": [
      { en: "City Kutum", ar: "مدينة كتم" },
      { en: "Camp Kasab", ar: "معسكر كساب" },
      { en: "Fatabaranou", ar: "فتابرنو" },
      { en: "Rural Kutum", ar: "ريفى كتم" },
    ],
    "Um Baru": [
      { en: "Amabarou", ar: "امبرو" },
    ],
    "Melit": [
      { en: "Melit", ar: "مليط" },
      { en: "Al Syah", ar: "الصياح" },
    ],
    "Dar As Salam": [
      { en: "Dar As Salam", ar: "دار السلام" },
    ],
    "Al Koma": [
      { en: "Al Koma", ar: "الكومة" },
    ],
    "Kelemando": [
      { en: "Kaleimanadou", ar: "كليمندو" },
    ],
    "Al Lait": [
      { en: "Al Lait", ar: "اللعيت" },
    ],
    "At Tawisha": [
      { en: "At Tawisha", ar: "الطويشة" },
    ],
    "As Serief": [
      { en: "As Serief", ar: "السريف" },
    ],
    "Saraf Omra": [
      { en: "Saraf Omra", ar: "سرف عمرة" },
    ],
    "Al Malha": [
      { en: "Al Malha", ar: "المالحة" },
    ],
    "At Tina": [
      { en: "At Tina", ar: "الطينة" },
    ],
    "Al Waha": [
      { en: "Al Waha", ar: "الواحة" },
    ],
    "Tawila": [
      { en: "Tawila", ar: "طويلة" },
    ],
    "Kernoi": [
      { en: "Kernoi", ar: "كرنوي" },
    ],
  },
  "North Kordofan": {
    "Sheikan": [
      { en: "Al Abeid", ar: "الابيض" },
      { en: "Abu Haraz", ar: "ابو حراز" },
      { en: "Rural Sheikan", ar: "ارياف شيكان" },
      { en: "Kazageil", ar: "كازقيل" },
    ],
    "Um Rawaba": [
      { en: "Central Um Rwaba", ar: "وسط ام روابة" },
      { en: "Ashana", ar: "عشانا" },
      { en: "City", ar: "المدينة" },
    ],
    "Um Dam Haj Ahmed": [
      { en: "Um Dam", ar: "أم دم" },
      { en: "Al Bahareia", ar: "البحرية" },
      { en: "Um Sameima", ar: "أم صميمة" },
      { en: "Al Mazadalafa", ar: "المزدلفة" },
    ],
    "Ar Rahad": [
      { en: "City", ar: "المدينة" },
      { en: "Rural Ar Rahad", ar: "ارياف الرهد" },
    ],
    "Bara": [
      { en: "Bara Central", ar: "بارا الوسطى" },
      { en: "East Bara", ar: "شرق بارا" },
    ],
    "Gharb Bara": [
      { en: "Teiba", ar: "طيبه" },
      { en: "Um Kareidam", ar: "ام كريدم" },
      { en: "Al Mazaroub", ar: "المزروب" },
    ],
    "Soudari": [
      { en: "Um Badar", ar: "ام بادر" },
      { en: "Hamara Al Sheikh", ar: "حمرة الشيخ" },
      { en: "Soudari", ar: "سودري" },
    ],
    "Gebrat Al Sheikh": [
      { en: "Gebrat Al Sheikh", ar: "جبرة الشيخ" },
      { en: "Hamara Al Wz", ar: "حمرة الوز" },
    ],
  },
  "West Darfur": {
    "Ag Geneina": [
      { en: "Al Janeina", ar: "الجنينه" },
      { en: "Aradamata", ar: "اردمتا" },
      { en: "East Al Wadi", ar: "شرق الوادي" },
      { en: "Tendalti", ar: "تندلتي" },
      { en: "Eish Bara", ar: "عيش بره" },
    ],
    "Kereneik": [
      { en: "Kereneik", ar: "كرينك" },
      { en: "Mourani", ar: "مورني" },
      { en: "Um Tajouk", ar: "ام تجوك" },
      { en: "Azarani", ar: "ازرني" },
      { en: "Ganadarani", ar: "قندرني" },
    ],
    "Habila - WD": [
      { en: "Habeila", ar: "هبيلا" },
      { en: "Swani", ar: "سواني" },
      { en: "Gabi", ar: "قبي" },
    ],
    "Foro Baranga": [
      { en: "Foro Baranga", ar: "فوربرنقا" },
      { en: "Jameiza", ar: "جميزه" },
      { en: "Managharasa", ar: "منغرسه" },
      { en: "Tatadousa", ar: "تتدوسه" },
    ],
    "Beida": [
      { en: "Beida", ar: "بيضه" },
      { en: "Kanagou Haraza", ar: "كنقو حرازه" },
      { en: "Arara", ar: "ارارا" },
      { en: "Masatari", ar: "مستري" },
    ],
    "Kulbus": [
      { en: "Kulbus", ar: "كلبس" },
      { en: "Daramagata", ar: "دارمقطاع" },
      { en: "Masatoura", ar: "مستوره" },
    ],
    "Jebel Moon": [
      { en: "Salei'a", ar: "صليعه" },
      { en: "Abu Rameil", ar: "ابورميل" },
    ],
    "Sirba": [
      { en: "Sirba", ar: "سربا" },
      { en: "Abu Sarouj", ar: "ابوسروج" },
      { en: "Saraf Jadad", ar: "سرف جداد" },
    ],
  },
  "West Kordofan": {
    "Babanusa": [
      { en: "Babanusa", ar: "بابنوسة" },
      { en: "Al Taboun", ar: "التبون" },
    ],
    "Al Lagowa": [
      { en: "Al Lagowa", ar: "لقاوة" },
    ],
    "As Sunut": [
      { en: "As Sunut", ar: "السنوط" },
      { en: "Kadam", ar: "كدام" },
    ],
    "Keilak": [
      { en: "Al Buhaira", ar: "البحيرة" },
      { en: "Al Kharasana", ar: "الخرصانة" },
      { en: "Abu Al Lakari", ar: "ابو اللكري" },
    ],
    "Abyei": [
      { en: "Al Majalad", ar: "المجلد" },
      { en: "Al Sateib", ar: "الستيب" },
    ],
    "Al Dibab": [
      { en: "Al Dibab", ar: "الدبب" },
    ],
    "Al Meiram": [
      { en: "Al Meiram", ar: "الميرم" },
    ],
    "Ghubaish": [
      { en: "Ghubaish", ar: "غبيش" },
      { en: "Abu Rai", ar: "ابو رأي" },
    ],
    "Wad Bandah": [
      { en: "Wad Bandah", ar: "ود بندة" },
      { en: "Al Saga", ar: "الصقع" },
      { en: "Aramal", ar: "أرمل" },
    ],
    "An Nuhud": [
      { en: "City", ar: "المدينة" },
      { en: "Rural An Nuhud", ar: "ريفي النهود" },
      { en: "Fouja", ar: "فوجا" },
    ],
    "Al Idia": [
      { en: "Al Adeia", ar: "الاضية" },
      { en: "Al Majarour", ar: "المجرور" },
    ],
    "Al Khiwai": [
      { en: "Al Khiwai", ar: "الخوي" },
      { en: "Yal Bakheit", ar: "عيال بخيت" },
    ],
    "Abu Zabad": [
      { en: "Abu Zabad", ar: "ابوزبد" },
    ],
  },
  "River Nile": {
    "Shendi": [
      { en: "Shendi City", ar: "شندي المدينه" },
      { en: "South Shendi", ar: "جنوب شندي" },
      { en: "North Shendi", ar: "شمال شندي" },
      { en: "Kabousheia", ar: "كبوشيه" },
      { en: "Al Basabeir", ar: "البسابير" },
      { en: "Hajar Al Asal", ar: "حجر العسل" },
    ],
    "Al Matama": [
      { en: "Teiba", ar: "طيبة" },
      { en: "Al Matama", ar: "المتمة" },
      { en: "Wad Hamad", ar: "ودحامد" },
    ],
    "Ad Damar": [
      { en: "City", ar: "المدينة" },
      { en: "Al Neil", ar: "النيل" },
      { en: "Al Atabarawi", ar: "الاتبراوى" },
      { en: "Al Zeidab", ar: "الزيداب" },
      { en: "Al Anagath", ar: "الانقاذ" },
      { en: "Seidoun West", ar: "سيدون غرب" },
      { en: "Seidoun East", ar: "سيدون شرق" },
    ],
    "Atbara": [
      { en: "Atbara North", ar: "عطبرة شمال" },
      { en: "Atbara Central", ar: "عطبرة وسط" },
      { en: "Atbara South", ar: "عطبرة جنوب" },
      { en: "Soula", ar: "سولا" },
    ],
    "Barbar": [
      { en: "South Barbar", ar: "جنوب بربر" },
      { en: "West Barbar", ar: "غرب بربر" },
      { en: "Al Baouga", ar: "الباوقة" },
      { en: "City", ar: "المدينة" },
      { en: "Al Abeideia", ar: "العبيدية" },
    ],
    "Abu Hamad": [
      { en: "Al Shareik", ar: "الشريك" },
      { en: "Rural Abu Hamad", ar: "ريفي ابوحمد" },
      { en: "Abu Hamad East", ar: "ابوحمد شرق" },
      { en: "Al Fada", ar: "الفداء" },
    ],
    "Al Buhaira": [
      { en: "Shari", ar: "شرى" },
      { en: "Al Kab", ar: "الكاب" },
    ],
  },
  "Central Darfur": {
    "Zalingi": [
      { en: "Zalingi", ar: "زالنجي" },
      { en: "Abata", ar: "ابطا" },
      { en: "Tareij", ar: "تريج" },
    ],
    "Wadi Salih": [
      { en: "Garaseila", ar: "قارسيلا" },
      { en: "Daleij", ar: "دليج" },
      { en: "Um Kheir", ar: "ام خير" },
      { en: "Anajoukati", ar: "انجوكتى" },
    ],
    "Bendasi": [
      { en: "Banadas", ar: "بندس" },
      { en: "Jaghama Al Gharabeia", ar: "جغمة الغربية" },
    ],
    "Azum": [
      { en: "Salou", ar: "سلو" },
      { en: "Um Shalaya", ar: "ام شالايا" },
      { en: "Rounagatas", ar: "رونقتاس" },
    ],
    "Gharb Jabal Marrah": [
      { en: "Neiratati", ar: "نيرتتي" },
      { en: "Jaladou", ar: "جلدو" },
    ],
    "Wasat Jabal Marrah": [
      { en: "Goulou", ar: "قولو" },
      { en: "Kalanaj", ar: "كلنج" },
      { en: "Bari Ari", ar: "باري اري" },
      { en: "Bouri", ar: "بوري" },
    ],
    "Shamal Jabal Marrah": [
      { en: "Roukarou", ar: "روكرو" },
      { en: "Tara", ar: "طرة" },
      { en: "Nasakam", ar: "نسكم" },
    ],
    "Mukjar": [
      { en: "Mukjar", ar: "مكجر" },
      { en: "Aratala", ar: "ارتالا" },
      { en: "Damabar", ar: "دمبار" },
    ],
    "Um Dukhun": [
      { en: "Um Dakhan", ar: "ام دخن" },
      { en: "Abu Jaradal", ar: "ابو جرادل" },
      { en: "Kabar", ar: "كابار" },
      { en: "Magan", ar: "مقن" },
    ],
  },
  "White Nile": {
    "Kosti": [
      { en: "Kousati", ar: "كوستى" },
      { en: "Um Hani", ar: "ام هانى" },
    ],
    "Guli": [
      { en: "Gali Sh", ar: "قلى ش" },
      { en: "Gali Gh", ar: "قلى غ" },
    ],
    "Tendalti": [
      { en: "Tanadalati", ar: "تندلتى" },
      { en: "Rural Al Shamali", ar: "الريف الشمالى" },
      { en: "Abu Rakaba", ar: "ابو ركبة" },
    ],
    "As Salam / Ar Rawat": [
      { en: "Al Na'eim", ar: "النعيم" },
      { en: "Al Rawat", ar: "الراوات" },
      { en: "Camps As Salam", ar: "معسكرات السلام" },
    ],
    "Rabak": [
      { en: "Rabak", ar: "ربك" },
      { en: "Assalaya", ar: "عسلاية" },
      { en: "Al Jazeira Aba", ar: "الجزيرة ابا" },
    ],
    "Aj Jabalain": [
      { en: "Kanana", ar: "كنانة" },
      { en: "Aj Jabalain", ar: "الجبلين" },
      { en: "Jouda", ar: "جودة" },
      { en: "Camps Aj Jabalain", ar: "معسكرات الجبلين" },
    ],
    "Ad Diwaim": [
      { en: "Ad Diwaim", ar: "الدويم" },
      { en: "At Tadamon", ar: "التضامن" },
      { en: "Shabasha", ar: "شبشة" },
      { en: "Al Wihda", ar: "الوحدة" },
    ],
    "Um Rimta": [
      { en: "Um Ramata Sh", ar: "ام رمته ش" },
      { en: "Um Ramata J", ar: "ام رمته ج" },
    ],
    "Al Gitaina": [
      { en: "Al Gitaina", ar: "القطينة" },
      { en: "Al Koua", ar: "الكوة" },
      { en: "Al Sheikh Al Sadeig", ar: "الشيخ الصديق" },
    ],
  },
  "South Darfur": {
    "Nyala Janoub": [
      { en: "Nyala Janoub", ar: "نيالا جنوب" },
      { en: "Nyala Central", ar: "نيالا وسط" },
      { en: "Camp Dareij", ar: "معسكر دريج" },
    ],
    "Nyala Shimal": [
      { en: "Nyala Shimal", ar: "نيالا شمال" },
      { en: "Camp Atash", ar: "معسكر عطاش" },
    ],
    "Al Wihda": [
      { en: "Al Malam", ar: "الملم" },
    ],
    "Mershing": [
      { en: "Marashanaj", ar: "مرشنج" },
      { en: "Yara", ar: "يارا" },
    ],
    "Beliel": [
      { en: "Beliel", ar: "بليل" },
      { en: "Camp Kalama", ar: "معسكر كلمة" },
      { en: "Camp As Serief", ar: "معسكر السريف" },
      { en: "Camp As Salam", ar: "معسكر السلام" },
    ],
    "Nitega": [
      { en: "Nitega", ar: "نتيقة" },
    ],
    "As Salam - SD": [
      { en: "As Salam", ar: "السلام" },
    ],
    "Sharg Aj Jabal": [
      { en: "Sharg Aj Jabal", ar: "شرق الجبل" },
    ],
    "Kas": [
      { en: "Kas", ar: "كاس" },
      { en: "South Al Jabal", ar: "جنوب الجبل" },
    ],
    "Shattaya": [
      { en: "Shattaya", ar: "شطاية" },
    ],
    "Buram": [
      { en: "Buram", ar: "برام" },
    ],
    "As Sunta": [
      { en: "As Sunta", ar: "السنطة" },
    ],
    "Gereida": [
      { en: "Gereida", ar: "قريضة" },
      { en: "Al Joughana", ar: "الجوغانة" },
    ],
    "Al Radoum": [
      { en: "Al Radoum", ar: "الردوم" },
      { en: "Wad Hajam", ar: "ودهجام" },
      { en: "Al Quoz", ar: "القوز" },
    ],
    "Ed Al Fursan": [
      { en: "Adalafarasan", ar: "عدالفرسان" },
    ],
    "Kateila": [
      { en: "Kateila", ar: "كتيلا" },
      { en: "Anatakeina", ar: "انتكينا" },
    ],
    "Kubum": [
      { en: "Kubum", ar: "كبم" },
      { en: "Marakanadi", ar: "مركندي" },
      { en: "Um Labasa", ar: "ام لباسة" },
    ],
    "Tulus": [
      { en: "Tulus", ar: "تلس" },
      { en: "Sarageila", ar: "سرقيلا" },
    ],
    "Damso": [
      { en: "Damso", ar: "دمسو" },
    ],
    "Rehaid Albirdi": [
      { en: "Rehaid Albirdi", ar: "رهيد البردي" },
      { en: "Twal", ar: "طوال" },
    ],
    "Um Dafoug": [
      { en: "Um Dafoug", ar: "ام دافوق" },
    ],
  },
};

/** The units of one locality ([] when none are listed). */
export const adminUnitsFor = (stateKey, localityKey) => ADMIN_UNITS[stateKey]?.[localityKey] || [];

/** The label of a stored unit (its Arabic name) in the language shown; unknown values as they are. */
export function adminUnitLabel(stateKey, localityKey, value, isArabic) {
    if (!value) return '';
    const unit = adminUnitsFor(stateKey, localityKey).find((u) => u.ar === value || u.en === value);
    if (!unit) return value;
    return isArabic ? unit.ar : unit.en;
}
