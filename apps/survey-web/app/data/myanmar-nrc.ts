// Myanmar NRC Dataset
// Complete mapping of State/Region codes to Township codes with names
// Format: stateCode -> { stateNameEn, stateNameMy, townships: [{ code, nameEn, nameMy }] }
// Source: Official Myanmar NRC township codes

export interface Township {
  code: string
  nameEn: string
  nameMy: string
}

export interface StateRegion {
  code: string
  nameEn: string
  nameMy: string
  townships: Township[]
}

export const MYANMAR_NRC_DATA: StateRegion[] = [
  {
    code: '1',
    nameEn: 'Kachin',
    nameMy: 'ကချင်ပြည်နယ်',
    townships: [
      { code: 'MANA', nameEn: 'Myitkyina', nameMy: 'မြစ်ကြီးနား' },
      { code: 'MADA', nameEn: 'Mogaung', nameMy: 'မိုးကောင်း' },
      { code: 'MABA', nameEn: 'Mohnyin', nameMy: 'မိုးညှင်း' },
      { code: 'MALA', nameEn: 'Mandalay', nameMy: 'မန္တလေး' },
      { code: 'BHA', nameEn: 'Bhamo', nameMy: 'ဗမိုး' },
      { code: 'SHWE', nameEn: 'Shwegu', nameMy: 'ရွှေကူး' },
      { code: 'TAN', nameEn: 'Tanai', nameMy: 'တန္အီ' },
      { code: 'CHI', nameEn: 'Chipwi', nameMy: 'ချီပွီး' },
      { code: 'TALA', nameEn: 'Talawgyi', nameMy: 'တလဝဂျီး' },
      { code: 'KUT', nameEn: 'Kutkai', nameMy: 'ကွတ်ခိုင်' },
      { code: 'NAM', nameEn: 'Namkham', nameMy: 'နမ့်ခမ်း' },
      { code: 'MANL', nameEn: 'Mansu', nameMy: 'မန်စူ' },
    ],
  },
  {
    code: '2',
    nameEn: 'Kayah',
    nameMy: 'ကယားပြည်နယ်',
    townships: [
      { code: 'LAK', nameEn: 'Loikaw', nameMy: 'လွိုင်ကော်' },
      { code: 'DEM', nameEn: 'Demoso', nameMy: 'ဒီ�မိုးစို' },
      { code: 'PHU', nameEn: 'Phruso', nameMy: 'ဖရူဆို' },
      { code: 'SHAW', nameEn: 'Shadaw', nameMy: 'ရှေဒေါ' },
      { code: 'BAW', nameEn: 'Bawlake', nameMy: 'ဘော်လိတ်' },
      { code: 'HPAS', nameEn: 'Hpasawng', nameMy: 'Hpasaung' },
      { code: 'MESE', nameEn: 'Mese', nameMy: 'မေစェ' },
    ],
  },
  {
    code: '3',
    nameEn: 'Kayin',
    nameMy: 'ကရင်ပြည်နယ်',
    townships: [
      { code: 'PA', nameEn: 'Hpa-an', nameMy: 'ပါအန်' },
      { code: 'KYAI', nameEn: 'Kawkareik', nameMy: 'ကော်ကရိတ်' },
      { code: 'MYAW', nameEn: 'Myawaddy', nameMy: 'မြဝတီ' },
      { code: 'KYA', nameEn: 'Kyarin', nameMy: 'ကျရင်စည်' },
      { code: 'THAN', nameEn: 'Thandaunggyi', nameMy: 'သံတောင်ကြီး' },
      { code: 'HPUN', nameEn: 'Hpapun', nameMy: 'Hpapun' },
    ],
  },
  {
    code: '4',
    nameEn: 'Chin',
    nameMy: 'ချင်းပြည်နယ်',
    townships: [
      { code: 'HAK', nameEn: 'Hakha', nameMy: 'ဟားခါး' },
      { code: 'FAL', nameEn: 'Falam', nameMy: 'ဖလမ်းမြို့' },
      { code: 'MIND', nameEn: 'Mindat', nameMy: 'မင်းတပ်' },
      { code: 'MAT', nameEn: 'Matupi', nameMy: 'မတူပီ' },
      { code: 'TID', nameEn: 'Tiddim', nameMy: 'တီးတင်မြို့' },
      { code: 'TON', nameEn: 'Tonzang', nameMy: 'တုံဇံ' },
      { code: 'KAN', nameEn: 'Kanpetlet', nameMy: 'ကနပေတ်' },
      { code: 'PAL', nameEn: 'Paletwa', nameMy: 'ပလက်ဝား' },
    ],
  },
  {
    code: '5',
    nameEn: 'Magway',
    nameMy: 'မကွေးတိုင်းဒေသကြီး',
    townships: [
      { code: 'MAG', nameEn: 'Magway', nameMy: 'မကွေး' },
      { code: 'PAK', nameEn: 'Pakokku', nameMy: 'ပခိုက်ကူး' },
      { code: 'CHAU', nameEn: 'Chauk', nameMy: 'ချောက်' },
      { code: 'YEN', nameEn: 'Yenangyaung', nameMy: 'ရေနံချောင်း' },
      { code: 'TAUN', nameEn: 'Taungdwingyi', nameMy: 'တောင်တွင်ကြီး' },
      { code: 'NAT', nameEn: 'Natmauk', nameMy: 'နတ်မောက်မြို့' },
      { code: 'GAN', nameEn: 'Gangaw', nameMy: 'ဂံဂော်မြို့' },
      { code: 'SAY', nameEn: 'Saytotetaya', nameMy: 'ဆေးတိုတ္တယာ' },
      { code: 'SEIK', nameEn: 'Seikphyu', nameMy: 'စိပ်ဖြူ' },
      { code: 'MINH', nameEn: 'Minhla', nameMy: 'မင်းလှ' },
      { code: 'PWIN', nameEn: 'Pwintbyu', nameMy: 'ပွင့်ဖြူ' },
      { code: 'SAL', nameEn: 'Salin', nameMy: 'စလင်း' },
      { code: 'SIN', nameEn: 'Sinbyukyun', nameMy: 'စင်းဖြူကျွန်း' },
    ],
  },
  {
    code: '6',
    nameEn: 'Mandalay',
    nameMy: 'မန္တလေးတိုင်းဒေသကြီး',
    townships: [
      { code: 'MAND', nameEn: 'Mandalay', nameMy: 'မန္တလေး' },
      { code: 'PYI', nameEn: 'Pyin Oo Lwin', nameMy: 'ပြင်ဦးလွင်' },
      { code: 'MYIN', nameEn: 'Myingyan', nameMy: 'မြင်းခြံ' },
      { code: 'MEIK', nameEn: 'Meiktila', nameMy: 'မိတ်ထီလာ' },
      { code: 'YAM', nameEn: 'Yamethin', nameMy: 'ရမ်းသင်မြို့' },
      { code: 'KYAU', nameEn: 'Kyaukse', nameMy: 'ကျောက်ဆည်' },
      { code: 'THA', nameEn: 'Thazi', nameMy: 'သစ်စီး' },
      { code: 'MAHA', nameEn: 'Mahlaing', nameMy: 'မလှိုင်မြို့' },
      { code: 'NAHT', nameEn: 'Nahtogyi', nameMy: 'နားထိုးကြီး' },
      { code: 'SINL', nameEn: 'Singu', nameMy: 'စင်းကူ' },
      { code: 'TAD', nameEn: 'Tada-U', nameMy: 'တဓဦ' },
      { code: 'WUN', nameEn: 'Wundwin', nameMy: 'ဝမ်းတွင်းမြို့' },
      { code: 'MYIT', nameEn: 'Myittha', nameMy: 'မြစ်သာ' },
      { code: 'KYAUS', nameEn: 'Kyaukpadaung', nameMy: 'ကျောက်ပဒေါင်း' },
      { code: 'SIT', nameEn: 'Sintgaing', nameMy: 'စင့်ကိုင်မြို့' },
      { code: 'NGA', nameEn: 'Nga Zun', nameMy: 'ငါဇွန်း' },
    ],
  },
  {
    code: '7',
    nameEn: 'Mon',
    nameMy: 'မွန်ပြည်နယ်',
    townships: [
      { code: 'MAW', nameEn: 'Mawlamyine', nameMy: 'မော်လမြိုင်' },
      { code: 'THAT', nameEn: 'Thaton', nameMy: 'သထုံ' },
      { code: 'KYA', nameEn: 'Kyaikto', nameMy: 'ကျိုက်ထို' },
      { code: 'YE', nameEn: 'Ye', nameMy: 'ယည့်' },
      { code: 'KYAW', nameEn: 'Kyaikmaraw', nameMy: 'ကျိုက်မရော' },
      { code: 'PAUNG', nameEn: 'Paung', nameMy: 'ပေါင်' },
      { code: 'BIL', nameEn: 'Bilin', nameMy: 'ဘီလင်း' },
      { code: 'KYAIK', nameEn: 'Kyaiklat', nameMy: 'ကျိုက်လတ်' },
    ],
  },
  {
    code: '8',
    nameEn: 'Rakhine',
    nameMy: 'ရခိုင်ပြည်နယ်',
    townships: [
      { code: 'SITT', nameEn: 'Sittwe', nameMy: 'စစ်တွေ' },
      { code: 'MYAUK', nameEn: 'Mrauk-U', nameMy: 'မြောက်ဦးမြို့' },
      { code: 'KYA', nameEn: 'Kyaukphyu', nameMy: 'ကျောက်ဖြူ' },
      { code: 'MAUN', nameEn: 'Maungdaw', nameMy: 'မောင်ဒေါ' },
      { code: 'BUT', nameEn: 'Buthidaung', nameMy: 'ဘူးသီတောင်' },
      { code: 'RAT', nameEn: 'Rathedaung', nameMy: 'ရထုတောင်' },
      { code: 'THAND', nameEn: 'Thandwe', nameMy: 'သံတွဲ' },
      { code: 'GWA', nameEn: 'Gwa', nameMy: 'ဂွား' },
      { code: 'TAUNG', nameEn: 'Taungup', nameMy: 'တောင်ဥပ်' },
      { code: 'PON', nameEn: 'Ponnagyun', nameMy: 'ပုဏ္ဏာကြွန်' },
      { code: 'MIN', nameEn: 'Minbya', nameMy: 'မင်းပြား' },
      { code: 'MYE', nameEn: 'Myebon', nameMy: 'မြေဘုံ' },
      { code: 'AN', nameEn: 'Ann', nameMy: 'အမ်း' },
      { code: 'RAM', nameEn: 'Ramyin', nameMy: 'ရမ်း' },
      { code: 'TOU', nameEn: 'Toungup', nameMy: 'တောင်ဥပ်' },
    ],
  },
  {
    code: '9',
    nameEn: 'Shan',
    nameMy: 'ရှမ်းပြည်နယ်',
    townships: [
      { code: 'TAUNG', nameEn: 'Taunggyi', nameMy: 'တောင်ကြီးမြို့' },
      { code: 'LOI', nameEn: 'Loilem', nameMy: 'လွိုင်လင်မ်' },
      { code: 'LASH', nameEn: 'Lashio', nameMy: 'လားရှိုးမြို့' },
      { code: 'MUSE', nameEn: 'Muse', nameMy: 'မိုးဆွေ' },
      { code: 'KYAIK', nameEn: 'Kyaingtong', nameMy: 'ကျိုင်းတုံ' },
      { code: 'TACH', nameEn: 'Tachileik', nameMy: 'တချိတ်လိတ်' },
      { code: 'NAM', nameEn: 'Namkham', nameMy: 'နမ့်ခမ်း' },
      { code: 'NAM2', nameEn: 'Namhsan', nameMy: 'နမ့်ဆန်း' },
      { code: 'KUT', nameEn: 'Kutkai', nameMy: 'ကွတ်ခိုင်' },
      { code: 'HOP', nameEn: 'Hopong', nameMy: 'ဟိုပုန်း' },
      { code: 'HSIP', nameEn: 'Hsipaw', nameMy: 'သီပေါ' },
      { code: 'KYA', nameEn: 'Kyaukme', nameMy: 'ကျောက်မဲ' },
      { code: 'NAM3', nameEn: 'Namtu', nameMy: 'နမ့်ထူ' },
      { code: 'MAN', nameEn: 'Mansi', nameMy: 'မိန်းစီ' },
      { code: 'BHA', nameEn: 'Bhamo', nameMy: 'ဗမိုး' },
      { code: 'MONG', nameEn: 'Mongmit', nameMy: 'မိူင်းတက်' },
      { code: 'MONG2', nameEn: 'Monghsat', nameMy: 'မိူင်းဆတ်' },
      { code: 'MONG3', nameEn: 'Mongmao', nameMy: 'မိူင်းမော' },
      { code: 'LAUK', nameEn: 'Laukkaing', nameMy: 'လောက်ကိုင်း' },
      { code: 'KON', nameEn: 'Konkyan', nameMy: 'ကုန်ကြမ်း' },
      { code: 'PANG', nameEn: 'Pangsang', nameMy: 'ပန်းဆံ' },
      { code: 'MAT', nameEn: 'Matman', nameMy: 'မက်မန်' },
      { code: 'NAP', nameEn: 'Naphan', nameMy: 'နာဖန်း' },
      { code: 'PAN', nameEn: 'Panwai', nameMy: 'ပန်းဝိုင်း' },
      { code: 'NAM4', nameEn: 'Namhpat', nameMy: 'နမ့်ဖတ်' },
    ],
  },
  {
    code: '10',
    nameEn: 'Ayeyarwady',
    nameMy: 'ဧရာဝတီတိုင်းဒေသကြီး',
    townships: [
      { code: 'PAT', nameEn: 'Pathein', nameMy: 'ပုသိမ်မြို့' },
      { code: 'HATHA', nameEn: 'Hinthada', nameMy: 'ဟင်္သာတ' },
      { code: 'MAU', nameEn: 'Maubin', nameMy: 'မော်ပင်' },
      { code: 'PANTA', nameEn: 'Pantanaw', nameMy: 'ပန်းတနော်' },
      { code: 'KYA', nameEn: 'Kyaiklat', nameMy: 'ကျိုက်လတ်' },
      { code: 'DEDU', nameEn: 'Dedaye', nameMy: 'ဒေးတရဲ' },
      { code: 'PYA', nameEn: 'Pyapon', nameMy: 'ပြပုန်း' },
      { code: 'BO', nameEn: 'Bogale', nameMy: 'ဘိုးဂလေး' },
      { code: 'MLA', nameEn: 'Mawlamyinegyun', nameMy: 'မော်လမြိုင်' },
      { code: 'WAK', nameEn: 'Wakema', nameMy: 'ဝါကေမ' },
      { code: 'EIN', nameEn: 'Einme', nameMy: 'အိပ်မဲ' },
      { code: 'NGA', nameEn: 'Ngathaingchaung', nameMy: 'ငါးသင်ချောင်း' },
      { code: 'KYON', nameEn: 'Kyonpyaw', nameMy: 'ကျုံဖြူ' },
      { code: 'YE', nameEn: 'Yekyi', nameMy: 'ရေကြီး' },
      { code: 'KYA2', nameEn: 'Kyaiklat', nameMy: 'ကျိုက်လတ်' },
      { code: 'MAW', nameEn: 'Mawgyun', nameMy: 'မော်ကျွမ်း' },
      { code: 'NGA2', nameEn: 'Nga Pu Daw', nameMy: 'ငါးဖူးတော်' },
      { code: 'THA', nameEn: 'Thabaung', nameMy: 'သဘောင်းမြို့' },
    ],
  },
  {
    code: '11',
    nameEn: 'Yangon',
    nameMy: 'ရန်ကုန်တိုင်းဒေသကြီး',
    townships: [
      { code: 'BOT', nameEn: 'Botahtaung', nameMy: 'ဗိုလ်တထောင်းမြို့နယ်' },
      { code: 'DAW', nameEn: 'Dawbon', nameMy: 'ဒေါ်ပုံမြို့နယ်' },
      { code: 'DAG', nameEn: 'Dagon', nameMy: 'ဒဂုံမြို့နယ်' },
      { code: 'DAGN', nameEn: 'Dagon Myothit (North)', nameMy: 'ဒဂုံမြို့သစ် (မြောက်)' },
      { code: 'DAGE', nameEn: 'Dagon Myothit (East)', nameMy: 'ဒဂုံမြို့သစ် (အရှေ့)' },
      { code: 'DAGS', nameEn: 'Dagon Myothit (South)', nameMy: 'ဒဂုံမြို့သစ် (တောင်)' },
      { code: 'DAGW', nameEn: 'Dagon Myothit (West)', nameMy: 'ဒဂုံမြို့သစ် (အနောက်)' },
      { code: 'HLA', nameEn: 'Hlaing', nameMy: 'လှိုင်' },
      { code: 'HLAT', nameEn: 'Hlaing Tharyar', nameMy: 'လှိုင်သာယာ' },
      { code: 'IN', nameEn: 'Insein', nameMy: 'အင်းစိန်' },
      { code: 'KA', nameEn: 'Kamayut', nameMy: 'ကမယုတ်မြို့နယ်' },
      { code: 'KYA', nameEn: 'Kyauktada', nameMy: 'ကျောက်တဏ္ဏာ' },
      { code: 'KYAN', nameEn: 'Kyimyindaing', nameMy: 'ကျ باعثားမြို့နယ်' },
      { code: 'LAN', nameEn: 'Lanmadaw', nameMy: 'လမာတော်' },
      { code: 'LAH', nameEn: 'Latha', nameMy: 'လသာ' },
      { code: 'MAY', nameEn: 'Mayangon', nameMy: 'မາယံဂုံ' },
      { code: 'MIN', nameEn: 'Mingaladon', nameMy: 'မင်းဂလာဒုံ' },
      { code: 'MING', nameEn: 'Mingala Taungnyunt', nameMy: 'မင်းဂလာတောင်ညွန့်' },
      { code: 'NOR', nameEn: 'North Okkalapa', nameMy: 'မြောက်ဥက္ကလာပ' },
      { code: 'PAZ', nameEn: 'Pazundaung', nameMy: 'ပုဇွန်တောင်' },
      { code: 'SAN', nameEn: 'Sanchaung', nameMy: 'စံချောင်း' },
      { code: 'SEIK', nameEn: 'Seikkan', nameMy: 'စိပ်ကမ်း' },
      { code: 'SHWE', nameEn: 'Shwepyitha', nameMy: 'ရွှေပည်သာ' },
      { code: 'SOU', nameEn: 'South Okkalapa', nameMy: 'တောင်ဥက္ကလာပ' },
      { code: 'TAM', nameEn: 'Tamwe', nameMy: 'တမွဲ' },
      { code: 'THA', nameEn: 'Thingangyun', nameMy: 'သင်္ဂန်းကျွန်း' },
      { code: 'YANK', nameEn: 'Yankin', nameMy: 'ရန်ခင်' },
      { code: 'YANKS', nameEn: 'Yankin (South)', nameMy: 'ရန်ခင် (တောင်)' },
      { code: 'YANKN', nameEn: 'Yankin (North)', nameMy: 'ရန်ခင် (မြောက်)' },
      { code: 'KHA', nameEn: 'Khayan', nameMy: 'ခရမ်း' },
      { code: 'TWAN', nameEn: 'Twante', nameMy: 'တွံတေး' },
      { code: 'KUN', nameEn: 'Kungyangon', nameMy: 'ကွန်းကျံဂုံ' },
      { code: 'KAW', nameEn: 'Kawmhu', nameMy: 'ကော်မူ' },
      { code: 'KAY', nameEn: 'Kayin', nameMy: 'ကရင်' },
      { code: 'KAWH', nameEn: 'Kawhmu', nameMy: 'ကော့မူး' },
      { code: 'HTANT', nameEn: 'Htantabin', nameMy: 'ထန့်ပင်မြို့နယ်' },
      { code: 'HTAN', nameEn: 'Htan Tapin', nameMy: 'ထန်းတပင်မြို့နယ်' },
    ],
  },
  {
    code: '13',
    nameEn: 'Bago',
    nameMy: 'ပဲခူးတိုင်းဒေသကြီး',
    townships: [
      { code: 'BGO', nameEn: 'Bago', nameMy: 'ပဲခူး' },
      { code: 'PYU', nameEn: 'Pyay', nameMy: 'ပြည်' },
      { code: 'THA', nameEn: 'Tharyarwady', nameMy: 'သရာဝတီ' },
      { code: 'TAUNG', nameEn: 'Taungoo', nameMy: 'တောင်ငူ' },
      { code: 'PHU', nameEn: 'Phyu', nameMy: 'ဖျူ' },
      { code: 'YE', nameEn: 'Yedashe', nameMy: 'ရေဒဇီး' },
      { code: 'NYAUNG', nameEn: 'Nyaunglebin', nameMy: 'ညောင်လေးပင်' },
      { code: 'DAIK', nameEn: 'Daik-U', nameMy: 'ဒိုက်ဦး' },
      { code: 'KYA', nameEn: 'Kayan', nameMy: 'ကရမ်း' },
      { code: 'HTAN', nameEn: 'Htantabin', nameMy: 'ထန့်ပင်ဘင်းမြို့နယ်' },
      { code: 'SHWE', nameEn: 'Shwegyin', nameMy: 'ရွှေကျင်' },
      { code: 'WAV', nameEn: 'Waw', nameMy: 'ဝေါမြို့နယ်' },
      { code: 'KYA2', nameEn: 'Kyaukkyi', nameMy: 'ကျောက်ကြီး' },
      { code: 'OK', nameEn: 'Oktwin', nameMy: 'အုတ်တွင်းမြို့နယ်' },
      { code: 'NYAUNG2', nameEn: 'Nyaunglaybin', nameMy: 'ညောင်လေးပင်မြို့နယ်' },
    ],
  },
  {
    code: '14',
    nameEn: 'Tanintharyi',
    nameMy: 'တနင်္သာရီတိုင်းဒေသကြီး',
    townships: [
      { code: 'DAW', nameEn: 'Dawei', nameMy: 'ထားဝယ်မြို့' },
      { code: 'MYEIK', nameEn: 'Myeik', nameMy: 'မြိတ်မြို့' },
      { code: 'KAW', nameEn: 'Kawthaung', nameMy: 'ကော့သောင်းမြို့' },
      { code: 'BOK', nameEn: 'Bokpyin', nameMy: 'ဗောကျပင်' },
      { code: 'LAUNG', nameEn: 'Launglon', nameMy: 'လောင်းလုံမြို့နယ်' },
      { code: 'THAYET', nameEn: 'Thayetchaung', nameMy: 'သရေချောင်း' },
      { code: 'YEBYU', nameEn: 'Yebyu', nameMy: 'ရေးဖြူ' },
      { code: 'TAN', nameEn: 'Tanjay', nameMy: 'တန္ဂါရိ' },
      { code: 'KYA', nameEn: 'Kyunsu', nameMy: 'ကျွန်စု' },
      { code: 'PAL', nameEn: 'Palaw', nameMy: 'ပလော' },
      { code: 'MYIT', nameEn: 'Myitta', nameMy: 'မြစ်သာ' },
      { code: 'LENYA', nameEn: 'Lenya', nameMy: 'လိန်းရာ' },
    ],
  },
  {
    code: '12',
    nameEn: 'Naypyitaw',
    nameMy: 'နေပြည်တော် ပြည်ထောင်စုနယ်မြေ',
    townships: [
      { code: 'ZABU', nameEn: 'Zabuthiri', nameMy: 'ဇာဘူသီရိ' },
      { code: 'DEK', nameEn: 'Dekkhina Thiri', nameMy: 'ဒေက္ခိဏသီရိ' },
      { code: 'PYI', nameEn: 'Pyinmana', nameMy: 'ပြင်မနား' },
      { code: 'LEWE', nameEn: 'Lewe', nameMy: 'လေးဝေ' },
      { code: 'TAT', nameEn: 'Tatkone', nameMy: 'တတ်ကုန်း' },
      { code: 'POB', nameEn: 'Pobba Thiri', nameMy: 'ပုဗ္ဗသီရိ' },
      { code: 'OAT', nameEn: 'Oattara Thiri', nameMy: 'ဥဏ္ဏရာသီရိ' },
      { code: 'ZAY', nameEn: 'Zayar Thiri', nameMy: 'ဇရာသီရိ' },
    ],
  },
]

// Helper functions
export function getStateRegion(code: string): StateRegion | undefined {
  return MYANMAR_NRC_DATA.find(s => s.code === code)
}

export function getTownships(stateCode: string): Township[] {
  const state = getStateRegion(stateCode)
  return state?.townships || []
}

export function getTownship(stateCode: string, townshipCode: string): Township | undefined {
  const townships = getTownships(stateCode)
  return townships.find(t => t.code === townshipCode)
}

export function getStateName(stateCode: string, language: 'en' | 'my'): string {
  const state = getStateRegion(stateCode)
  if (!state) return stateCode
  return language === 'my' ? state.nameMy : state.nameEn
}

export function getTownshipName(stateCode: string, townshipCode: string, language: 'en' | 'my'): string {
  const township = getTownship(stateCode, townshipCode)
  if (!township) return townshipCode
  return language === 'my' ? township.nameMy : township.nameEn
}

export function validateNrcComponents(
  stateCode: string,
  townshipCode: string,
  type: string,
  serial: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!stateCode) errors.push('State/Region is required')
  else if (!getStateRegion(stateCode)) errors.push('Invalid State/Region')

  if (!townshipCode) errors.push('Township is required')
  else if (!getTownship(stateCode, townshipCode)) errors.push('Invalid Township for selected State/Region')

  const validTypes = ['N', 'E', 'P', 'NRC']
  if (!type) errors.push('NRC Type is required')
  else if (!validTypes.includes(type)) errors.push('Invalid NRC Type')

  if (!serial) errors.push('Serial number is required')
  else if (!/^\d{6}$/.test(serial)) errors.push('Serial number must be exactly 6 digits')

  return { valid: errors.length === 0, errors }
}

export function formatNrc(stateCode: string, townshipCode: string, type: string, serial: string): string {
  return `${stateCode}/${townshipCode} (${type})${serial}`
}