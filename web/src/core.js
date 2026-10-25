/* =====================================================================
   DebtID — core (no DOM): interest math, formatting, QR codes,
   digital signatures (ECDSA P-256), verification codes and backups.
   ===================================================================== */
const DebtID = (() => {
  'use strict';

  // Secret for the visual scrambling. Kept from "Fiado" so old (v1) codes still open.
  // It is not protection: v2 codes are secured by the digital signatures.
  const SEGREDO = 'fiado·v1·7c2e91d4-b83f-4a6e-9f15-2d0ac4e8b6f3';
  const MODOS = ['total', 'mes', 'ano'];
  const PAPEIS = ['credor', 'devedor'];
  // valor and totals are in the currency's smallest unit (cents, satoshis...) and must stay below 2^53
  // obsBytes: note on the loan (UTF-8 bytes) · parcelas: most installments · multa: late fee (percent × 10,000)
  const LIMITES = { valor: 1e15, taxa: 10000000, dias: 36500, nomeBytes: 320, obsBytes: 280, parcelas: 120, multa: 1000000 };

  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8', { fatal: true });
  const subtle = () => {
    if (!globalThis.crypto || !crypto.subtle) throw new ChaveErro('SEM_CRIPTO');
    return crypto.subtle;
  };

  class ChaveErro extends Error {
    constructor(codigo) { super(codigo); this.codigo = codigo; }
  }

  /* =================== currencies ===================
     code|decimals|symbol|pt singular|pt plural|pt gender (m/f)|en singular|en plural|pt list name|en list name|subunit
     Empty list names use the capitalized singular. Empty subunit: cents (2 decimals) or none (0 decimals).
     ISO 4217 active currencies (as of 2026: no BGN or HRK, which became the euro; XCG replaced ANG; SLE, ZWG),
     plus Bitcoin (default), Ether and Tether. */
  const DADOS_MOEDAS = `
BTC|8|₿|bitcoin|bitcoins|m|bitcoin|bitcoins|Bitcoin|Bitcoin|sat
ETH|9|Ξ|ether|ethers|m|ether|ether|Ether (Ethereum)|Ether (Ethereum)|gwei
USDT|2|USDT|tether|tethers|m|tether|tethers|Tether (USDT)|Tether (USDT)|
BRL|2|R$|real|reais|m|real|reais|Real brasileiro|Brazilian real|centavo
USD|2|US$|dólar americano|dólares americanos|m|US dollar|US dollars|||
EUR|2|€|euro|euros|m|euro|euros|||eur
GBP|2|£|libra esterlina|libras esterlinas|f|pound sterling|pounds sterling||British pound|gbp
JPY|0|JP¥|iene|ienes|m|yen|yen|Iene japonês|Japanese yen|
CNY|2|CN¥|yuan|yuans|m|yuan|yuan|Yuan chinês|Chinese yuan|fen
CHF|2|CHF|franco suíço|francos suíços|m|Swiss franc|Swiss francs|||
CAD|2|CA$|dólar canadense|dólares canadenses|m|Canadian dollar|Canadian dollars|||
AUD|2|AU$|dólar australiano|dólares australianos|m|Australian dollar|Australian dollars|||
ARS|2|ARS|peso argentino|pesos argentinos|m|Argentine peso|Argentine pesos|||centavo
MXN|2|MX$|peso mexicano|pesos mexicanos|m|Mexican peso|Mexican pesos|||centavo
INR|2|₹|rupia indiana|rupias indianas|f|Indian rupee|Indian rupees|||paisa
AED|2|AED|dirham dos Emirados Árabes|dirhams dos Emirados Árabes|m|UAE dirham|UAE dirhams|||fils
AFN|2|AFN|afegane|afeganes|m|afghani|afghanis|Afegane afegão|Afghan afghani|
ALL|2|ALL|lek albanês|leks albaneses|m|Albanian lek|Albanian leks|||
AMD|2|֏|dram armênio|drams armênios|m|Armenian dram|Armenian drams|||
AOA|2|AOA|kwanza|kwanzas|m|kwanza|kwanzas|Kwanza angolano|Angolan kwanza|
AWG|2|AWG|florim arubano|florins arubanos|m|Aruban florin|Aruban florins|||
AZN|2|₼|manat azerbaijano|manats azerbaijanos|m|Azerbaijani manat|Azerbaijani manats|||
BAM|2|BAM|marco conversível|marcos conversíveis|m|convertible mark|convertible marks|Marco conversível (Bósnia)|Convertible mark (Bosnia)|
BBD|2|BBD|dólar barbadiano|dólares barbadianos|m|Barbadian dollar|Barbadian dollars|||
BDT|2|৳|taka|takas|m|taka|takas|Taka bengali|Bangladeshi taka|
BHD|3|BHD|dinar bareinita|dinares bareinitas|m|Bahraini dinar|Bahraini dinars|||fils
BIF|0|BIF|franco burundinês|francos burundineses|m|Burundian franc|Burundian francs|||
BMD|2|BMD|dólar bermudense|dólares bermudenses|m|Bermudian dollar|Bermudian dollars|||
BND|2|BND|dólar bruneano|dólares bruneanos|m|Brunei dollar|Brunei dollars|||
BOB|2|BOB|boliviano|bolivianos|m|boliviano|bolivianos|Boliviano (Bolívia)|Bolivian boliviano|centavo
BSD|2|BSD|dólar bahamense|dólares bahamenses|m|Bahamian dollar|Bahamian dollars|||
BTN|2|BTN|ngultrum|ngultruns|m|ngultrum|ngultrums|Ngultrum butanês|Bhutanese ngultrum|
BWP|2|BWP|pula|pulas|f|pula|pula|Pula (Botsuana)|Botswana pula|
BYN|2|BYN|rublo bielorrusso|rublos bielorrussos|m|Belarusian ruble|Belarusian rubles|||kop
BZD|2|BZD|dólar belizenho|dólares belizenhos|m|Belize dollar|Belize dollars|||
CDF|2|CDF|franco congolês|francos congoleses|m|Congolese franc|Congolese francs|||
CLP|0|CLP|peso chileno|pesos chilenos|m|Chilean peso|Chilean pesos|||
COP|2|COP|peso colombiano|pesos colombianos|m|Colombian peso|Colombian pesos|||centavo
CRC|2|₡|colón costa-riquenho|colones costa-riquenhos|m|Costa Rican colón|Costa Rican colones|||
CUP|2|CUP|peso cubano|pesos cubanos|m|Cuban peso|Cuban pesos|||centavo
CVE|2|CVE|escudo cabo-verdiano|escudos cabo-verdianos|m|Cape Verdean escudo|Cape Verdean escudos|||centavo
CZK|2|Kč|coroa tcheca|coroas tchecas|f|Czech koruna|Czech korunas|||
DJF|0|DJF|franco djibutiano|francos djibutianos|m|Djiboutian franc|Djiboutian francs|||
DKK|2|DKK|coroa dinamarquesa|coroas dinamarquesas|f|Danish krone|Danish kroner|||
DOP|2|DOP|peso dominicano|pesos dominicanos|m|Dominican peso|Dominican pesos|||centavo
DZD|2|DZD|dinar argelino|dinares argelinos|m|Algerian dinar|Algerian dinars|||
EGP|2|EGP|libra egípcia|libras egípcias|f|Egyptian pound|Egyptian pounds|||
ERN|2|ERN|nakfa|nakfas|m|nakfa|nakfas|Nakfa eritreu|Eritrean nakfa|
ETB|2|ETB|birr etíope|birrs etíopes|m|Ethiopian birr|Ethiopian birrs|||
FJD|2|FJD|dólar fijiano|dólares fijianos|m|Fijian dollar|Fijian dollars|||
FKP|2|FKP|libra das Malvinas|libras das Malvinas|f|Falkland Islands pound|Falkland Islands pounds|||gbp
GEL|2|₾|lari georgiano|laris georgianos|m|Georgian lari|Georgian laris|||
GHS|2|₵|cedi ganês|cedis ganeses|m|Ghanaian cedi|Ghanaian cedis|||
GIP|2|GIP|libra de Gibraltar|libras de Gibraltar|f|Gibraltar pound|Gibraltar pounds|||gbp
GMD|2|GMD|dalasi gambiano|dalasis gambianos|m|Gambian dalasi|Gambian dalasis|||
GNF|0|GNF|franco guineano|francos guineanos|m|Guinean franc|Guinean francs|||
GTQ|2|GTQ|quetzal guatemalteco|quetzais guatemaltecos|m|Guatemalan quetzal|Guatemalan quetzales|||centavo
GYD|2|GYD|dólar guianense|dólares guianenses|m|Guyanese dollar|Guyanese dollars|||
HKD|2|HK$|dólar de Hong Kong|dólares de Hong Kong|m|Hong Kong dollar|Hong Kong dollars|||
HNL|2|HNL|lempira hondurenha|lempiras hondurenhas|f|Honduran lempira|Honduran lempiras|||centavo
HTG|2|HTG|gourde haitiano|gourdes haitianos|m|Haitian gourde|Haitian gourdes|||
HUF|2|HUF|florim húngaro|florins húngaros|m|Hungarian forint|Hungarian forints|||
IDR|2|IDR|rupia indonésia|rupias indonésias|f|Indonesian rupiah|Indonesian rupiahs|||
ILS|2|₪|shekel israelense|shekels israelenses|m|Israeli shekel|Israeli shekels|Novo shekel israelense|Israeli new shekel|
IQD|3|IQD|dinar iraquiano|dinares iraquianos|m|Iraqi dinar|Iraqi dinars|||fils
IRR|2|IRR|rial iraniano|riais iranianos|m|Iranian rial|Iranian rials|||
ISK|0|ISK|coroa islandesa|coroas islandesas|f|Icelandic króna|Icelandic krónur|||
JMD|2|JMD|dólar jamaicano|dólares jamaicanos|m|Jamaican dollar|Jamaican dollars|||
JOD|3|JOD|dinar jordaniano|dinares jordanianos|m|Jordanian dinar|Jordanian dinars|||fils
KES|2|KES|xelim queniano|xelins quenianos|m|Kenyan shilling|Kenyan shillings|||
KGS|2|KGS|som quirguiz|soms quirguizes|m|Kyrgyzstani som|Kyrgyzstani soms|||
KHR|2|KHR|riel cambojano|riels cambojanos|m|Cambodian riel|Cambodian riels|||
KMF|0|KMF|franco comorense|francos comorenses|m|Comorian franc|Comorian francs|||
KPW|2|KPW|won norte-coreano|wons norte-coreanos|m|North Korean won|North Korean won|||
KRW|0|₩|won sul-coreano|wons sul-coreanos|m|South Korean won|South Korean won|||
KWD|3|KWD|dinar kuwaitiano|dinares kuwaitianos|m|Kuwaiti dinar|Kuwaiti dinars|||fils
KYD|2|KYD|dólar das Ilhas Cayman|dólares das Ilhas Cayman|m|Cayman Islands dollar|Cayman Islands dollars|||
KZT|2|₸|tenge cazaque|tenges cazaques|m|Kazakhstani tenge|Kazakhstani tenges|||
LAK|2|₭|kip laosiano|kips laosianos|m|Lao kip|Lao kips|||
LBP|2|LBP|libra libanesa|libras libanesas|f|Lebanese pound|Lebanese pounds|||
LKR|2|LKR|rupia do Sri Lanka|rupias do Sri Lanka|f|Sri Lankan rupee|Sri Lankan rupees|||
LRD|2|LRD|dólar liberiano|dólares liberianos|m|Liberian dollar|Liberian dollars|||
LSL|2|LSL|loti|malotis|m|loti|maloti|Loti (Lesoto)|Lesotho loti|
LYD|3|LYD|dinar líbio|dinares líbios|m|Libyan dinar|Libyan dinars|||dirham
MAD|2|MAD|dirham marroquino|dirhams marroquinos|m|Moroccan dirham|Moroccan dirhams|||
MDL|2|MDL|leu moldávio|lei moldávios|m|Moldovan leu|Moldovan lei|||
MGA|2|MGA|ariary|ariarys|m|ariary|ariary|Ariary malgaxe|Malagasy ariary|
MKD|2|MKD|dinar macedônio|dinares macedônios|m|Macedonian denar|Macedonian denars|||
MMK|2|MMK|kyat birmanês|kyats birmaneses|m|Myanmar kyat|Myanmar kyats|||
MNT|2|₮|tugrik mongol|tugriks mongóis|m|Mongolian tögrög|Mongolian tögrögs|||
MOP|2|MOP|pataca de Macau|patacas de Macau|f|Macanese pataca|Macanese patacas|||
MRU|2|MRU|uguia mauritana|uguias mauritanas|f|Mauritanian ouguiya|Mauritanian ouguiyas|||
MUR|2|MUR|rupia mauriciana|rupias mauricianas|f|Mauritian rupee|Mauritian rupees|||
MVR|2|MVR|rufia maldiva|rufias maldivas|f|Maldivian rufiyaa|Maldivian rufiyaa|||
MWK|2|MWK|kwacha malauiano|kwachas malauianos|m|Malawian kwacha|Malawian kwacha|||
MYR|2|MYR|ringgit malaio|ringgits malaios|m|Malaysian ringgit|Malaysian ringgits|||
MZN|2|MZN|metical|meticais|m|metical|meticais|Metical moçambicano|Mozambican metical|centavo
NAD|2|NAD|dólar namibiano|dólares namibianos|m|Namibian dollar|Namibian dollars|||
NGN|2|₦|naira|nairas|f|naira|naira|Naira nigeriana|Nigerian naira|
NIO|2|NIO|córdoba nicaraguense|córdobas nicaraguenses|m|Nicaraguan córdoba|Nicaraguan córdobas|||centavo
NOK|2|NOK|coroa norueguesa|coroas norueguesas|f|Norwegian krone|Norwegian kroner|||
NPR|2|NPR|rupia nepalesa|rupias nepalesas|f|Nepalese rupee|Nepalese rupees|||paisa
NZD|2|NZ$|dólar neozelandês|dólares neozelandeses|m|New Zealand dollar|New Zealand dollars|||
OMR|3|OMR|rial omanense|riais omanenses|m|Omani rial|Omani rials|||baisa
PAB|2|PAB|balboa|balboas|m|balboa|balboas|Balboa panamenho|Panamanian balboa|
PEN|2|PEN|sol peruano|sóis peruanos|m|Peruvian sol|Peruvian soles|||
PGK|2|PGK|kina|kinas|f|kina|kina|Kina (Papua-Nova Guiné)|Papua New Guinean kina|
PHP|2|₱|peso filipino|pesos filipinos|m|Philippine peso|Philippine pesos|||
PKR|2|PKR|rupia paquistanesa|rupias paquistanesas|f|Pakistani rupee|Pakistani rupees|||paisa
PLN|2|zł|zloty|zlotys|m|złoty|złotys|Zloty polonês|Polish złoty|grosz
PYG|0|₲|guarani|guaranis|m|guaraní|guaranís|Guarani paraguaio|Paraguayan guaraní|
QAR|2|QAR|rial catariano|riais catarianos|m|Qatari riyal|Qatari riyals|||
RON|2|RON|leu romeno|lei romenos|m|Romanian leu|Romanian lei|||
RSD|2|RSD|dinar sérvio|dinares sérvios|m|Serbian dinar|Serbian dinars|||
RUB|2|₽|rublo russo|rublos russos|m|Russian ruble|Russian rubles|||kop
RWF|0|RWF|franco ruandês|francos ruandeses|m|Rwandan franc|Rwandan francs|||
SAR|2|SAR|rial saudita|riais sauditas|m|Saudi riyal|Saudi riyals|||
SBD|2|SBD|dólar das Ilhas Salomão|dólares das Ilhas Salomão|m|Solomon Islands dollar|Solomon Islands dollars|||
SCR|2|SCR|rupia seichelense|rupias seichelenses|f|Seychellois rupee|Seychellois rupees|||
SDG|2|SDG|libra sudanesa|libras sudanesas|f|Sudanese pound|Sudanese pounds|||
SEK|2|SEK|coroa sueca|coroas suecas|f|Swedish krona|Swedish kronor|||
SGD|2|SGD|dólar de Singapura|dólares de Singapura|m|Singapore dollar|Singapore dollars|||
SHP|2|SHP|libra de Santa Helena|libras de Santa Helena|f|Saint Helena pound|Saint Helena pounds|||gbp
SLE|2|SLE|leone|leones|m|leone|leones|Leone (Serra Leoa)|Sierra Leonean leone|
SOS|2|SOS|xelim somali|xelins somalis|m|Somali shilling|Somali shillings|||
SRD|2|SRD|dólar surinamês|dólares surinameses|m|Surinamese dollar|Surinamese dollars|||
SSP|2|SSP|libra sul-sudanesa|libras sul-sudanesas|f|South Sudanese pound|South Sudanese pounds|||
STN|2|STN|dobra|dobras|f|dobra|dobras|Dobra (São Tomé e Príncipe)|São Tomé and Príncipe dobra|
SYP|2|SYP|libra síria|libras sírias|f|Syrian pound|Syrian pounds|||
SZL|2|SZL|lilangeni|emalangeni|m|lilangeni|emalangeni|Lilangeni (Essuatíni)|Swazi lilangeni|
THB|2|฿|baht|bahts|m|baht|baht|Baht tailandês|Thai baht|
TJS|2|TJS|somoni|somonis|m|somoni|somonis|Somoni tadjique|Tajikistani somoni|
TMT|2|TMT|manat turcomeno|manats turcomenos|m|Turkmen manat|Turkmen manats|||
TND|3|TND|dinar tunisiano|dinares tunisianos|m|Tunisian dinar|Tunisian dinars|||mill
TOP|2|TOP|paanga|paangas|f|paʻanga|paʻanga|Paanga tonganesa|Tongan paʻanga|
TRY|2|₺|lira turca|liras turcas|f|Turkish lira|Turkish liras|||kurus
TTD|2|TTD|dólar de Trinidad e Tobago|dólares de Trinidad e Tobago|m|Trinidad and Tobago dollar|Trinidad and Tobago dollars|||
TWD|2|NT$|novo dólar taiwanês|novos dólares taiwaneses|m|New Taiwan dollar|New Taiwan dollars|||
TZS|2|TZS|xelim tanzaniano|xelins tanzanianos|m|Tanzanian shilling|Tanzanian shillings|||
UAH|2|₴|grívnia|grívnias|f|hryvnia|hryvnias|Grívnia ucraniana|Ukrainian hryvnia|kop
UGX|0|UGX|xelim ugandense|xelins ugandenses|m|Ugandan shilling|Ugandan shillings|||
UYU|2|UYU|peso uruguaio|pesos uruguaios|m|Uruguayan peso|Uruguayan pesos|||centavo
UZS|2|UZS|som uzbeque|soms uzbeques|m|Uzbekistani som|Uzbekistani soms|||
VES|2|VES|bolívar|bolívares|m|bolívar|bolívares|Bolívar venezuelano|Venezuelan bolívar|
VND|0|₫|dong|dongs|m|dong|dong|Dong vietnamita|Vietnamese dong|
VUV|0|VUV|vatu|vatus|m|vatu|vatu|Vatu (Vanuatu)|Vanuatu vatu|
WST|2|WST|tala|talas|m|tala|tala|Tala samoano|Samoan tala|
XAF|0|FCFA|franco CFA|francos CFA|m|CFA franc|CFA francs|Franco CFA da África Central|Central African CFA franc|
XCD|2|XCD|dólar do Caribe Oriental|dólares do Caribe Oriental|m|East Caribbean dollar|East Caribbean dollars|||
XCG|2|XCG|florim caribenho|florins caribenhos|m|Caribbean guilder|Caribbean guilders|||
XOF|0|CFA|franco CFA|francos CFA|m|CFA franc|CFA francs|Franco CFA da África Ocidental|West African CFA franc|
XPF|0|XPF|franco CFP|francos CFP|m|CFP franc|CFP francs|||
YER|2|YER|rial iemenita|riais iemenitas|m|Yemeni rial|Yemeni rials|||
ZAR|2|ZAR|rand|rands|m|rand|rand|Rand sul-africano|South African rand|
ZMW|2|ZMW|kwacha zambiano|kwachas zambianos|m|Zambian kwacha|Zambian kwacha|||
ZWG|2|ZiG|ZiG|ZiG|m|ZiG|ZiG|ZiG (ouro do Zimbábue)|Zimbabwe Gold (ZiG)|`;
  // subunit names: pt [singular, plural], en [singular, plural]
  const SUBUNIDADES = {
    cent: { pt: ['centavo', 'centavos'], en: ['cent', 'cents'] },
    centavo: { pt: ['centavo', 'centavos'], en: ['centavo', 'centavos'] },
    eur: { pt: ['cêntimo', 'cêntimos'], en: ['cent', 'cents'] },
    gbp: { pt: ['penny', 'pence'], en: ['penny', 'pence'] },
    sat: { pt: ['satoshi', 'satoshis'], en: ['satoshi', 'satoshis'] },
    gwei: { pt: ['gwei', 'gwei'], en: ['gwei', 'gwei'] },
    fen: { pt: ['fen', 'fens'], en: ['fen', 'fen'] },
    paisa: { pt: ['paisa', 'paisas'], en: ['paisa', 'paise'] },
    kop: { pt: ['copeque', 'copeques'], en: ['kopeck', 'kopecks'] },
    grosz: { pt: ['grosz', 'groszy'], en: ['grosz', 'groszy'] },
    kurus: { pt: ['kuruş', 'kuruş'], en: ['kuruş', 'kuruş'] },
    fils: { pt: ['fils', 'fils'], en: ['fils', 'fils'] },
    baisa: { pt: ['baisa', 'baisas'], en: ['baisa', 'baisa'] },
    mill: { pt: ['milésimo', 'milésimos'], en: ['millime', 'millimes'] },
    dirham: { pt: ['dirham', 'dirhams'], en: ['dirham', 'dirhams'] }
  };
  const maiuscula = s => s.charAt(0).toUpperCase() + s.slice(1);
  const MOEDAS = {};
  const CODIGOS_MOEDAS = [];
  for (const linha of DADOS_MOEDAS.trim().split('\n')) {
    const [codigo, casas, simbolo, ptS, ptP, g, enS, enP, ptNome, enNome, sub] = linha.split('|');
    MOEDAS[codigo] = {
      codigo, casas: +casas, simbolo,
      pt: { s: ptS, p: ptP, fem: g === 'f', nome: ptNome || maiuscula(ptS) },
      en: { s: enS, p: enP, nome: enNome || maiuscula(enS) },
      sub: +casas === 0 ? null : SUBUNIDADES[sub || 'cent']
    };
    CODIGOS_MOEDAS.push(codigo);
  }
  const MOEDAS_POPULARES = ['BTC', 'USD', 'EUR', 'BRL', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'AUD', 'ARS', 'MXN', 'INR', 'ETH', 'USDT'];
  const CODIGO_MOEDA_VALIDO = /^[A-Z0-9]{2,8}$/;
  /** Currency details. Unknown codes (from a newer app version) still display, by code. */
  function infoMoeda(codigo, casas) {
    const m = MOEDAS[codigo];
    if (m && (casas == null || casas === m.casas)) return m;
    const c = casas == null ? 2 : casas;
    if (m) return { ...m, casas: c, sub: null };
    return { codigo, casas: c, simbolo: codigo, pt: { s: codigo, p: codigo, fem: false, nome: codigo }, en: { s: codigo, p: codigo, nome: codigo }, sub: null };
  }

  /* =================== interest math =================== */
  // x in the smallest unit of the currency (cents, satoshis...; may be fractional). toFixed(4) strips
  // binary noise (e.g. 26438.000000000004) before ALWAYS rounding up.
  const ceilCentavos = x => Math.ceil(Number(x.toFixed(4)));

  // d.valor: smallest currency unit · d.taxa: percent × 10,000 · d.de/d.dp: days since 1970
  // Simple:   I = P · i · n
  // Compound: A = P · (1 + i)^n  (n may be fractional: exponential convention)
  // n = days/30 (monthly, 30-day month) or days/365 (yearly); "total" applies the rate once.
  function calcular(d) {
    const dias = d.dp - d.de;
    const periodos = d.modo === 'mes' ? dias / 30 : d.modo === 'ano' ? dias / 365 : 1;
    let juros;
    if (d.composto && d.modo !== 'total') {
      juros = d.valor * (Math.pow(1 + d.taxa / 1e6, periodos) - 1);
    } else {
      let num = d.valor * d.taxa, den = 1e6;
      if (d.modo === 'mes') { num *= dias; den *= 30; }
      if (d.modo === 'ano') { num *= dias; den *= 365; }
      juros = num / den;
    }
    const jurosCentavos = Number(juros.toFixed(4));
    const total = ceilCentavos(d.valor + juros);
    return { dias, periodos, jurosCentavos, total, lucro: total - d.valor };
  }
  // For compound interest, accept a 1-cent difference on recalculation (Math.pow may differ
  // in the last digit across browsers). The signed total is authoritative.
  function conferirTotal(d, total) {
    const c = calcular(d);
    if (c.total === total) return c;
    if (d.composto && Math.abs(c.total - total) <= 1) return { ...c, total, lucro: total - d.valor };
    throw new ChaveErro('INCONSISTENTE');
  }

  /* =================== bytes =================== */
  const juntar = (...partes) => {
    let n = 0;
    for (const p of partes) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of partes) { out.set(p, o); o += p.length; }
    return out;
  };
  const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const iguais = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const sha256 = async b => new Uint8Array(await subtle().digest('SHA-256', b));

  class Escritor {
    constructor() { this.a = []; }
    byte(n) { this.a.push(n & 255); }
    bytes(b) { for (const x of b) this.a.push(x); }
    num(n) { // unsigned varint (LEB128), safe up to 2^53
      if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('número fora do intervalo');
      while (n >= 128) { this.a.push((n % 128) + 128); n = Math.floor(n / 128); }
      this.a.push(n);
    }
    texto(s) { const b = enc.encode(s); this.num(b.length); this.bytes(b); }
    fim() { return Uint8Array.from(this.a); }
  }
  class Leitor {
    constructor(buf) { this.b = buf; this.i = 0; }
    byte() { if (this.i >= this.b.length) throw new ChaveErro('CORROMPIDA'); return this.b[this.i++]; }
    bytes(n) {
      if (this.i + n > this.b.length) throw new ChaveErro('CORROMPIDA');
      const s = this.b.slice(this.i, this.i + n); this.i += n; return s;
    }
    num() {
      let n = 0, mul = 1, b, passos = 0;
      do {
        if (++passos > 8) throw new ChaveErro('CORROMPIDA');
        b = this.byte(); n += (b & 127) * mul; mul *= 128;
      } while (b & 128);
      return n;
    }
    texto(max = LIMITES.nomeBytes) {
      const len = this.num();
      if (len < 1 || len > max) throw new ChaveErro('CORROMPIDA');
      let s;
      try { s = dec.decode(this.bytes(len)); } catch (e) { throw new ChaveErro('CORROMPIDA'); }
      if (!s.trim()) throw new ChaveErro('CORROMPIDA');
      return s;
    }
    acabou() { return this.i === this.b.length; }
  }

  /* =================== code wrapping =================== */
  // base64url( [salt ⊕ stream(secret)] + [data ⊕ stream(secret+salt)] ) + "-" + checksum
  function fnv1a(bytes, h = 0x811c9dc5) {
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function fluxo(semente, n) { // mulberry32
    let s = semente >>> 0;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i += 4) {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      t = (t ^ (t >>> 14)) >>> 0;
      for (let k = 0; k < 4 && i + k < n; k++) out[i + k] = (t >>> (k * 8)) & 255;
    }
    return out;
  }
  const SEG = enc.encode(SEGREDO);
  const SEMENTE_SAL = fnv1a(SEG);
  const sementeDados = sal => fnv1a(sal, fnv1a(SEG) ^ 0x9E3779B9);
  const xor = (a, b) => a.map((v, i) => v ^ b[i]);

  function b64url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function deB64url(str) {
    if (!/^[A-Za-z0-9_-]+$/.test(str) || str.length % 4 === 1) throw new ChaveErro('FORMATO');
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    s += '='.repeat((4 - (s.length % 4)) % 4);
    let bin;
    try { bin = atob(s); } catch (e) { throw new ChaveErro('FORMATO'); }
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const checksum = corpo => (fnv1a(enc.encode(corpo)) % 1679616).toString(36).toUpperCase().padStart(4, '0');

  function embalar(dados) {
    const sal = crypto.getRandomValues(new Uint8Array(4));
    const bruto = juntar(xor(sal, fluxo(SEMENTE_SAL, 4)), xor(dados, fluxo(sementeDados(sal), dados.length)));
    const corpo = b64url(bruto);
    return corpo + '-' + checksum(corpo);
  }
  // Code candidates inside pasted text (a WhatsApp message, a PDF with line breaks, etc.)
  const PADRAO_CODIGO = /[A-Za-z0-9_-]{24,}-[0-9A-Za-z]{4}(?![A-Za-z0-9_-])/g;
  function candidatos(txt) {
    const s = String(txt || '');
    const lista = [s.replace(/[\s"'`]/g, '')];
    for (const fonte of [s, s.replace(/[ \t]*\r?\n[ \t]*/g, '')]) {
      for (const m of fonte.match(PADRAO_CODIGO) || []) lista.push(m);
    }
    return [...new Set(lista.filter(Boolean))];
  }
  function separar(s) {
    const corte = s.lastIndexOf('-');
    if (corte < 1) return null;
    const corpo = s.slice(0, corte), soma = s.slice(corte + 1).toUpperCase();
    if (!/^[0-9A-Z]{4}$/.test(soma) || !/^[A-Za-z0-9_-]+$/.test(corpo)) return null;
    return { corpo, soma };
  }
  function extrairCodigo(txt) {
    let comFormato = null;
    for (const c of candidatos(txt)) {
      const p = separar(c);
      if (!p) continue;
      if (checksum(p.corpo) === p.soma) return p.corpo + '-' + p.soma;
      comFormato = comFormato || c;
    }
    return comFormato ? { erro: 'CHECKSUM' } : { erro: String(txt || '').trim() ? 'FORMATO' : 'VAZIA' };
  }
  function desembalar(txt) {
    const achado = extrairCodigo(txt);
    if (typeof achado !== 'string') throw new ChaveErro(achado.erro);
    const { corpo, soma } = separar(achado);
    const bruto = deB64url(corpo);
    if (bruto.length < 4 + 14) throw new ChaveErro('CORROMPIDA');
    const sal = xor(bruto.subarray(0, 4), fluxo(SEMENTE_SAL, 4));
    const resto = bruto.subarray(4);
    return { dados: xor(resto, fluxo(sementeDados(sal), resto.length)), codigo: corpo + '-' + soma };
  }

  /* =================== legacy codes (v1, unsigned) =================== */
  function lerV1(buf) {
    const L = new Leitor(buf);
    if (L.byte() !== 1) throw new ChaveErro('VERSAO');
    const modo = MODOS[L.byte()];
    if (!modo) throw new ChaveErro('CORROMPIDA');
    const valor = L.num(), taxa = L.num(), de = L.num(), dias = L.num();
    const ts = L.num(), tz = L.num() - 64, total = L.num();
    const credor = L.texto(), devedor = L.texto();
    if (!L.acabou()) throw new ChaveErro('CORROMPIDA');
    const d = { valor, taxa, modo, de, dp: de + dias, ts, tz };
    validarDados(d);
    if (calcular(d).total !== total) throw new ChaveErro('INCONSISTENTE');
    d.total = total;
    return { d, credor, devedor };
  }
  function validarDados(d) {
    if (d.valor < 1 || d.valor > LIMITES.valor || d.taxa > LIMITES.taxa || d.dp - d.de > LIMITES.dias ||
        d.de > 120000 || d.ts > 8e9 || d.tz < -60 || d.tz > 60) throw new ChaveErro('CORROMPIDA');
    if (d.total != null && !Number.isSafeInteger(d.total)) throw new ChaveErro('CORROMPIDA');
    // each installment needs its own day and at least one unit of the currency
    if (d.parcelas > 1 && (d.parcelas > d.dp - d.de || (d.total != null && d.total < d.parcelas))) throw new ChaveErro('CORROMPIDA');
  }

  /* =================== signing keys (ECDSA P-256) =================== */
  const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
  const B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;
  const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
  const ALG_ASSINAR = { name: 'ECDSA', hash: 'SHA-256' };

  const bigDe = b => BigInt('0x' + (hex(b) || '0'));
  const bytesDe = (n, len) => {
    const h = n.toString(16).padStart(len * 2, '0');
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  };
  const mod = n => ((n % P) + P) % P;
  function potencia(base, exp) {
    let r = 1n; base = mod(base);
    while (exp > 0n) { if (exp & 1n) r = (r * base) % P; base = (base * base) % P; exp >>= 1n; }
    return r;
  }
  // 65 bytes (04|X|Y) → 33 bytes (02/03|X)
  function comprimir(raw) {
    if (raw.length !== 65 || raw[0] !== 4) throw new Error('chave pública inesperada');
    return juntar([2 | (raw[64] & 1)], raw.slice(1, 33));
  }
  function descomprimir(c) {
    if (c.length !== 33 || (c[0] !== 2 && c[0] !== 3)) throw new ChaveErro('CORROMPIDA');
    const x = bigDe(c.slice(1));
    if (x >= P) throw new ChaveErro('CORROMPIDA');
    const y2 = mod(x * x * x - 3n * x + B);
    let y = potencia(y2, (P + 1n) / 4n);
    if ((y * y) % P !== y2) throw new ChaveErro('CORROMPIDA');
    if (Number(y & 1n) !== (c[0] & 1)) y = P - y;
    return juntar([4], c.slice(1), bytesDe(y, 32));
  }

  async function idDe(pub33) {
    const h = hex(await sha256(pub33)).slice(0, 12).toUpperCase();
    return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
  }
  // Full ID (96 bits, 6 groups): starts with the short ID. Copying it would take ~2^96 tries,
  // so comparing it in person is safe even against someone who can afford to copy the short ID.
  async function idLongoDe(pub33) {
    const h = hex(await sha256(pub33)).slice(0, 24).toUpperCase();
    return h.match(/.{4}/g).join('-');
  }

  // ECDSA signatures have two valid forms (s and n − s). New codes always use the low one and
  // refuse the other, so a code cannot be rewritten into a second, different-looking valid code.
  const ORDEM = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
  const sDe = sig => bigDe(sig.slice(32, 64));
  const sBaixo = sig => sDe(sig) <= ORDEM / 2n;
  function normalizarS(sig) {
    if (sBaixo(sig)) return sig;
    return juntar(sig.slice(0, 32), bytesDe(ORDEM - sDe(sig), 32));
  }

  const cacheChaves = new WeakMap();
  async function chavePrivada(perfil) {
    if (!cacheChaves.has(perfil)) {
      cacheChaves.set(perfil, await subtle().importKey('jwk', perfil.jwk, ALG, false, ['sign']));
    }
    return cacheChaves.get(perfil);
  }
  async function criarPerfil(nome) {
    const par = await subtle().generateKey(ALG, true, ['sign', 'verify']);
    const jwk = await subtle().exportKey('jwk', par.privateKey);
    const raw = new Uint8Array(await subtle().exportKey('raw', par.publicKey));
    const pub = comprimir(raw);
    return { v: 1, nome, criadoEm: Date.now(), jwk: { kty: jwk.kty, crv: jwk.crv, d: jwk.d, x: jwk.x, y: jwk.y }, pub: b64url(pub), id: await idDe(pub) };
  }
  const pubDoPerfil = perfil => deB64url(perfil.pub);
  async function assinar(perfil, msg) {
    return normalizarS(new Uint8Array(await subtle().sign(ALG_ASSINAR, await chavePrivada(perfil), msg)));
  }
  async function confere(pub33, msg, sig) {
    try {
      const k = await subtle().importKey('raw', descomprimir(pub33), ALG, false, ['verify']);
      return await subtle().verify(ALG_ASSINAR, k, sig, msg);
    } catch (e) {
      return false;
    }
  }

  /* =================== signed codes (v2: reais; v3: any currency; v4: extras and receipts) =================== */
  // [version][type] + P (loan) + issuer signature (+ C (confirmation) + confirmer signature)
  // v3 adds the currency code and its number of decimals right after the flags.
  // v4 adds, after the issuer's key, one byte saying which extras follow, then the extras:
  //   1 a note ("for the car repair") · 2 number of installments · 4 late fee and late interest
  //   8 the other person's key (only that person can confirm)
  // v4 also has receipts, signed by the creditor: [4][3] + R + signature (see escreverR).
  // Older codes keep opening exactly as before.
  const VERSAO = 4, PROPOSTA = 1, VALIDADO = 2, RECIBO = 3;
  const TAGS = {
    2: { p: enc.encode('DebtID/v2/proposta'), c: enc.encode('DebtID/v2/confirma') },
    3: { p: enc.encode('DebtID/v3/proposta'), c: enc.encode('DebtID/v3/confirma') },
    4: { p: enc.encode('DebtID/v4/proposta'), c: enc.encode('DebtID/v4/confirma'), r: enc.encode('DebtID/v4/recibo') }
  };
  const TAG_HASH = enc.encode('DebtID/emprestimo');
  const EXTRA = { obs: 1, parcelas: 2, atraso: 4, outro: 8 };
  const TIPOS_RECIBO = ['pagamento', 'quitacao', 'cancelamento'];
  const hexParaBytes = h => Uint8Array.from(h.match(/../g) || [], x => parseInt(x, 16));
  const bytesObs = s => enc.encode(s).length;

  function escreverP(d, versao) {
    const e = new Escritor();
    e.bytes(d.id);
    e.byte(MODOS.indexOf(d.modo) | (PAPEIS.indexOf(d.papel) << 2) | (d.composto ? 8 : 0));
    if (versao >= 3) { e.texto(d.moeda); e.byte(d.casas); }
    e.num(d.valor); e.num(d.taxa); e.num(d.de); e.num(d.dp - d.de);
    e.num(d.ts); e.num(d.tz + 64); e.num(d.total);
    e.texto(d.nomeEmissor); e.texto(d.nomeOutro);
    e.bytes(d.pubEmissor);
    if (versao >= 4) {
      const atraso = d.multa > 0 || d.mora > 0;
      e.byte((d.obs ? EXTRA.obs : 0) | (d.parcelas > 1 ? EXTRA.parcelas : 0) | (atraso ? EXTRA.atraso : 0) | (d.pubOutro ? EXTRA.outro : 0));
      if (d.obs) e.texto(d.obs);
      if (d.parcelas > 1) e.num(d.parcelas);
      if (atraso) { e.num(d.multa || 0); e.num(d.mora || 0); }
      if (d.pubOutro) e.bytes(d.pubOutro);
    }
    return e.fim();
  }
  function lerP(L, versao) {
    const ini = L.i;
    const id = L.bytes(6);
    const f = L.byte();
    const modo = MODOS[f & 3], papel = PAPEIS[(f >> 2) & 1], composto = !!(f & 8);
    if (!modo || f > 15) throw new ChaveErro('CORROMPIDA');
    let moeda = 'BRL', casas = 2;
    if (versao >= 3) {
      moeda = L.texto(); casas = L.byte();
      if (!CODIGO_MOEDA_VALIDO.test(moeda) || casas > 9) throw new ChaveErro('CORROMPIDA');
    }
    const valor = L.num(), taxa = L.num(), de = L.num(), dias = L.num();
    const ts = L.num(), tz = L.num() - 64, total = L.num();
    const nomeEmissor = L.texto(), nomeOutro = L.texto();
    const pubEmissor = L.bytes(33);
    let obs = '', parcelas = 1, multa = 0, mora = 0, pubOutro = null;
    if (versao >= 4) {
      const x = L.byte();
      if (x > 15) throw new ChaveErro('CORROMPIDA');
      if (x & EXTRA.obs) obs = L.texto(LIMITES.obsBytes);
      if (x & EXTRA.parcelas) {
        parcelas = L.num();
        if (parcelas < 2 || parcelas > LIMITES.parcelas) throw new ChaveErro('CORROMPIDA');
      }
      if (x & EXTRA.atraso) {
        multa = L.num(); mora = L.num();
        if (!(multa || mora) || multa > LIMITES.multa || mora > LIMITES.taxa) throw new ChaveErro('CORROMPIDA');
      }
      if (x & EXTRA.outro) {
        pubOutro = L.bytes(33);
        if (iguais(pubOutro, pubEmissor)) throw new ChaveErro('CORROMPIDA');
      }
    }
    const d = { id, modo, composto, papel, moeda, casas, valor, taxa, de, dp: de + dias, ts, tz, total, nomeEmissor, nomeOutro, pubEmissor, obs, parcelas, multa, mora, pubOutro };
    validarDados(d);
    conferirTotal(d, total);
    return { d, bytes: L.b.slice(ini, L.i) };
  }
  function escreverC(c) {
    const e = new Escritor();
    e.num(c.ts); e.num(c.tz + 64); e.texto(c.nome); e.bytes(c.pub);
    return e.fim();
  }
  function lerC(L) {
    const ini = L.i;
    const ts = L.num(), tz = L.num() - 64, nome = L.texto(), pub = L.bytes(33);
    if (ts > 8e9 || tz < -60 || tz > 60) throw new ChaveErro('CORROMPIDA');
    return { c: { ts, tz, nome, pub }, bytes: L.b.slice(ini, L.i) };
  }
  const agora = () => {
    const dt = new Date();
    return { ts: Math.floor(dt.getTime() / 1000), tz: Math.round(-dt.getTimezoneOffset() / 15) };
  };
  // A loan's fingerprint: the same for its proposal and its validated code; receipts point to it.
  const hashDe = async (versao, pBytes) => hex((await sha256(juntar(TAG_HASH, [versao], pBytes))).slice(0, 16));

  // dados: { papel ('credor'|'devedor' — the issuer's role), nomeOutro, moeda (code, default BRL),
  //          valor (smallest unit of that currency), taxa, modo, composto, de, dp,
  //          obs (optional note), parcelas (optional, 2+), multa and mora (optional, percent × 10,000),
  //          pubOutro (optional: the other person's key, base64url, from your contacts) }
  async function criarProposta(perfil, dados) {
    const { ts, tz } = agora();
    const moeda = dados.moeda || 'BRL';
    if (!CODIGO_MOEDA_VALIDO.test(moeda)) throw new RangeError('moeda inválida');
    const obs = String(dados.obs || '').normalize('NFC').replace(/\s+/g, ' ').trim();
    if (bytesObs(obs) > LIMITES.obsBytes) throw new RangeError('observação longa demais');
    const parcelas = dados.parcelas > 1 ? dados.parcelas : 1;
    if (!Number.isSafeInteger(parcelas) || parcelas > LIMITES.parcelas) throw new RangeError('parcelas');
    const multa = dados.multa || 0, mora = dados.mora || 0;
    if (!Number.isSafeInteger(multa) || multa < 0 || multa > LIMITES.multa || !Number.isSafeInteger(mora) || mora < 0 || mora > LIMITES.taxa) throw new RangeError('encargos');
    const minha = pubDoPerfil(perfil);
    let pubOutro = null;
    if (dados.pubOutro) {
      pubOutro = typeof dados.pubOutro === 'string' ? deB64url(dados.pubOutro) : Uint8Array.from(dados.pubOutro);
      descomprimir(pubOutro); // throws if it is not a valid key
      if (iguais(pubOutro, minha)) throw new ChaveErro('PROPRIA');
    }
    const d = {
      id: crypto.getRandomValues(new Uint8Array(6)),
      modo: dados.modo, composto: !!dados.composto && dados.modo !== 'total', papel: dados.papel,
      moeda, casas: infoMoeda(moeda).casas,
      valor: dados.valor, taxa: dados.taxa, de: dados.de, dp: dados.dp,
      ts, tz, nomeEmissor: perfil.nome, nomeOutro: dados.nomeOutro, pubEmissor: minha,
      obs, parcelas, multa, mora, pubOutro
    };
    d.total = calcular(d).total;
    validarDados(d);
    const p = escreverP(d, VERSAO);
    const sig = await assinar(perfil, juntar(TAGS[VERSAO].p, p));
    return embalar(juntar([VERSAO, PROPOSTA], p, sig));
  }

  // Confirms someone else's proposal and returns the code validated by both sides.
  async function confirmarProposta(perfil, codigoProposta) {
    const m = await lerCodigo(codigoProposta);
    if (m.tipo !== 'proposta') throw new ChaveErro('NAO_E_PROPOSTA');
    const minha = pubDoPerfil(perfil);
    if (iguais(minha, m.bruto.p.pubEmissor)) throw new ChaveErro('PROPRIA');
    if (m.bruto.p.pubOutro && !iguais(minha, m.bruto.p.pubOutro)) throw new ChaveErro('OUTRA_PESSOA');
    const { ts, tz } = agora();
    const c = escreverC({ ts, tz, nome: perfil.nome, pub: minha });
    const v = m.bruto.versao; // a v2/v3 proposal is confirmed in its own version: the signatures cover its exact bytes
    const sig2 = await assinar(perfil, juntar(TAGS[v].c, m.bruto.pBytes, m.bruto.sig1, c));
    return embalar(juntar([v, VALIDADO], m.bruto.pBytes, m.bruto.sig1, c, sig2));
  }

  // Reads any code (v1 to v4: loans and receipts), checks the signatures and builds a model for display.
  async function lerCodigo(txt) {
    const { dados, codigo } = desembalar(txt);
    if (dados[0] === 1) {
      const { d, credor, devedor } = lerV1(dados);
      return {
        tipo: 'v1', codigo, idHex: null, hash: null, ref: codigo.slice(-4),
        dados: { ...d, moeda: 'BRL', casas: 2, obs: '', parcelas: 1, multa: 0, mora: 0 }, calc: calcular(d), emissor: null,
        credor: { nome: credor, assinou: false }, devedor: { nome: devedor, assinou: false }
      };
    }
    const versao = dados[0];
    if (!TAGS[versao]) throw new ChaveErro('VERSAO');
    const tipo = dados[1];
    if (tipo === RECIBO && versao >= 4) return lerRecibo(dados, codigo);
    if (tipo !== PROPOSTA && tipo !== VALIDADO) throw new ChaveErro('VERSAO');
    const L = new Leitor(dados);
    L.i = 2;
    const { d, bytes: pBytes } = lerP(L, versao);
    const sig1 = L.bytes(64);
    let c = null, cBytes = null, sig2 = null;
    if (tipo === VALIDADO) {
      ({ c, bytes: cBytes } = lerC(L));
      sig2 = L.bytes(64);
    }
    if (!L.acabou()) throw new ChaveErro('CORROMPIDA');
    if (versao >= 4 && (!sBaixo(sig1) || (sig2 && !sBaixo(sig2)))) throw new ChaveErro('ASSINATURA');
    if (!(await confere(d.pubEmissor, juntar(TAGS[versao].p, pBytes), sig1))) throw new ChaveErro('ASSINATURA');
    if (c) {
      if (iguais(c.pub, d.pubEmissor)) throw new ChaveErro('PROPRIA');
      if (d.pubOutro && !iguais(c.pub, d.pubOutro)) throw new ChaveErro('OUTRA_PESSOA');
      if (!(await confere(c.pub, juntar(TAGS[versao].c, pBytes, sig1, cBytes), sig2))) throw new ChaveErro('ASSINATURA');
    }
    const parteEmissor = {
      nome: d.nomeEmissor, id: await idDe(d.pubEmissor), idLongo: await idLongoDe(d.pubEmissor),
      pub: b64url(d.pubEmissor), assinou: true, ts: d.ts, tz: d.tz
    };
    const parteOutra = c
      ? { nome: c.nome, id: await idDe(c.pub), idLongo: await idLongoDe(c.pub), pub: b64url(c.pub), assinou: true, ts: c.ts, tz: c.tz, nomeInformado: d.nomeOutro }
      : d.pubOutro
        ? { nome: d.nomeOutro, id: await idDe(d.pubOutro), idLongo: await idLongoDe(d.pubOutro), pub: b64url(d.pubOutro), assinou: false, fixo: true }
        : { nome: d.nomeOutro, assinou: false };
    const dadosExibir = {
      moeda: d.moeda, casas: d.casas, valor: d.valor, taxa: d.taxa, modo: d.modo, composto: d.composto, de: d.de, dp: d.dp, ts: d.ts, tz: d.tz, total: d.total,
      obs: d.obs, parcelas: d.parcelas, multa: d.multa, mora: d.mora
    };
    const idHex = hex(d.id).toUpperCase();
    return {
      tipo: c ? 'validado' : 'proposta', codigo, idHex, ref: `${idHex.slice(0, 4)}-${idHex.slice(4, 8)}`,
      hash: await hashDe(versao, pBytes), versao,
      dados: dadosExibir, calc: conferirTotal(d, d.total), emissor: d.papel,
      credor: d.papel === 'credor' ? parteEmissor : parteOutra,
      devedor: d.papel === 'devedor' ? parteEmissor : parteOutra,
      confirmadoEm: c ? { ts: c.ts, tz: c.tz } : null,
      bruto: { p: d, pBytes, sig1, versao }
    };
  }

  /* =================== receipts (payment, settlement, cancellation) =================== */
  // Only the creditor signs a receipt: it is the creditor who gives up the right to charge, so the
  // debtor keeps the receipt as proof. A cancellation (a loan entered by mistake) works the same way.
  // R: loan fingerprint (16) · loan id (6) · kind · currency · decimals · amount · payment day ·
  //    moment · random (4, so two equal payments still get different receipts) · creditor name · key
  function escreverR(r) {
    const e = new Escritor();
    e.bytes(r.hash); e.bytes(r.id); e.byte(TIPOS_RECIBO.indexOf(r.tipo));
    e.texto(r.moeda); e.byte(r.casas);
    e.num(r.valor); e.num(r.dia); e.num(r.ts); e.num(r.tz + 64);
    e.bytes(r.rid); e.texto(r.nome); e.bytes(r.pub);
    return e.fim();
  }
  // m: a loan model (from lerCodigo) where this profile is the creditor and has signed.
  // tipo: 'pagamento' (valor ≥ 1) · 'quitacao' (valor = the last payment, may be 0) · 'cancelamento' (valor 0)
  async function criarRecibo(perfil, m, { tipo, valor = 0, dia }) {
    if (!m || (m.tipo !== 'proposta' && m.tipo !== 'validado')) throw new ChaveErro('NAO_E_EMPRESTIMO');
    const minha = pubDoPerfil(perfil);
    if (!m.credor.pub || m.credor.pub !== b64url(minha)) throw new ChaveErro('NAO_CREDOR');
    if (!TIPOS_RECIBO.includes(tipo)) throw new RangeError('tipo de recibo');
    if (tipo === 'cancelamento') valor = 0;
    if (!Number.isSafeInteger(valor) || valor < (tipo === 'pagamento' ? 1 : 0) || valor > LIMITES.valor) throw new RangeError('valor');
    if (!Number.isSafeInteger(dia) || dia < m.dados.de || dia > 120000) throw new RangeError('data');
    const { ts, tz } = agora();
    const r = {
      hash: hexParaBytes(m.hash), id: hexParaBytes(m.idHex), tipo, moeda: m.dados.moeda, casas: m.dados.casas,
      valor, dia, ts, tz, rid: crypto.getRandomValues(new Uint8Array(4)), nome: perfil.nome, pub: minha
    };
    const rb = escreverR(r);
    const sig = await assinar(perfil, juntar(TAGS[4].r, rb));
    return embalar(juntar([4, RECIBO], rb, sig));
  }
  async function lerRecibo(dados, codigo) {
    const L = new Leitor(dados);
    L.i = 2;
    const ini = L.i;
    const hash = L.bytes(16), id = L.bytes(6), tipo = TIPOS_RECIBO[L.byte()];
    if (!tipo) throw new ChaveErro('CORROMPIDA');
    const moeda = L.texto(), casas = L.byte();
    if (!CODIGO_MOEDA_VALIDO.test(moeda) || casas > 9) throw new ChaveErro('CORROMPIDA');
    const valor = L.num(), dia = L.num(), ts = L.num(), tz = L.num() - 64;
    const rid = L.bytes(4), nome = L.texto(), pub = L.bytes(33);
    const rb = L.b.slice(ini, L.i);
    const sig = L.bytes(64);
    if (!L.acabou()) throw new ChaveErro('CORROMPIDA');
    if (valor > LIMITES.valor || (tipo === 'pagamento' && valor < 1) || (tipo === 'cancelamento' && valor !== 0) ||
        dia > 120000 || ts > 8e9 || tz < -60 || tz > 60) throw new ChaveErro('CORROMPIDA');
    if (!sBaixo(sig) || !(await confere(pub, juntar(TAGS[4].r, rb), sig))) throw new ChaveErro('ASSINATURA');
    const idHex = hex(id).toUpperCase();
    return {
      tipo: 'recibo', codigo, idHex, ref: `${idHex.slice(0, 4)}-${idHex.slice(4, 8)}`, hash: hex(hash),
      recibo: { tipo, moeda, casas, valor, dia, ts, tz, rid: hex(rid), nome, pub: b64url(pub), id: await idDe(pub), idLongo: await idLongoDe(pub) }
    };
  }
  // Does this receipt belong to this loan, signed by its creditor? Returns null if so, or an error code.
  function conferirRecibo(mEmprestimo, mRecibo) {
    if (!mRecibo || mRecibo.tipo !== 'recibo') return 'NAO_E_RECIBO';
    if (!mEmprestimo || !mEmprestimo.hash || mRecibo.hash !== mEmprestimo.hash) return 'OUTRO_EMPRESTIMO';
    const r = mRecibo.recibo;
    if (r.moeda !== mEmprestimo.dados.moeda || r.casas !== mEmprestimo.dados.casas) return 'OUTRO_EMPRESTIMO';
    if (!mEmprestimo.credor.pub || mEmprestimo.credor.pub !== r.pub) return 'NAO_CREDOR';
    return null;
  }

  /* =================== installments, payments and late charges =================== */
  // Installments: the total split in equal parts (the last one takes the remainder), due on days
  // spread evenly from the loan day; the last one is due on the payment day.
  function parcelasDe(d, total = d.total) {
    const n = d.parcelas > 1 ? d.parcelas : 1, dias = d.dp - d.de;
    const base = Math.floor(total / n), lista = [];
    for (let k = 1; k <= n; k++) {
      lista.push({ n: k, dia: k === n ? d.dp : d.de + Math.round(dias * k / n), valor: k === n ? total - base * (n - 1) : base });
    }
    return lista;
  }
  // Balance on day `hoje`, given the payments [{ dia, valor }] from signed receipts.
  // Payments pay the installments in order; whatever is left over pays the late charges.
  // Late fee (multa): once, on what was still unpaid of an installment after its due day.
  // Late interest (mora): simple, per 30-day month, on what stays unpaid of each installment,
  // for each day after its due day. Both are rounded up, like the total.
  function situacao(d, total, pagamentos, hoje) {
    const multa = d.multa || 0, mora = d.mora || 0;
    const parcelas = parcelasDe(d, total).map(p => ({ ...p, restante: p.valor, multa: 0, mora: 0, desde: p.dia, multou: false, pagaEm: null }));
    const acumular = ate => {
      if (!multa && !mora) return;
      for (const p of parcelas) {
        if (ate <= p.dia || p.restante <= 0) continue;
        if (!p.multou) { p.multou = true; p.multa = p.restante * multa / 1e6; }
        const ini = Math.max(p.desde, p.dia);
        if (ate > ini) { p.mora += p.restante * mora / 1e6 * (ate - ini) / 30; p.desde = ate; }
      }
    };
    let pago = 0, sobra = 0;
    const lista = (pagamentos || []).filter(p => p && p.valor > 0).slice().sort((a, b) => a.dia - b.dia);
    for (const pg of lista) {
      acumular(pg.dia);
      let resto = pg.valor;
      pago += pg.valor;
      for (const p of parcelas) {
        if (resto <= 0) break;
        if (p.restante <= 0) continue;
        const x = Math.min(resto, p.restante);
        p.restante -= x; resto -= x;
        if (p.restante === 0) p.pagaEm = pg.dia;
      }
      sobra += resto;
    }
    acumular(hoje);
    const encargos = Math.ceil(Number(parcelas.reduce((s, p) => s + p.multa + p.mora, 0).toFixed(4)));
    const principal = parcelas.reduce((s, p) => s + p.restante, 0);
    return {
      parcelas: parcelas.map(({ desde, multou, ...p }) => p),
      pago, principal, encargos,
      encargosPagos: Math.min(sobra, encargos),
      saldo: Math.max(0, principal + encargos - sobra),
      credito: Math.max(0, sobra - encargos),
      atrasadas: parcelas.filter(p => p.restante > 0 && p.dia < hoje).length,
      proxima: parcelas.find(p => p.restante > 0) || null
    };
  }

  /* =================== password-protected backup =================== */
  // v1: 210,000 PBKDF2 rounds (still opens) · v2: 600,000 rounds (OWASP's figure for PBKDF2-SHA256)
  const MAGICO = enc.encode('DIDB');
  const RODADAS = { 1: 210000, 2: 600000 };
  async function chaveDaSenha(senha, sal, rodadas) {
    const base = await subtle().importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: rodadas },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function exportarBackup(objeto, senha) {
    const sal = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const chave = await chaveDaSenha(senha, sal, RODADAS[2]);
    const cifrado = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, chave, enc.encode(JSON.stringify(objeto))));
    const corpo = b64url(juntar(MAGICO, [2], sal, iv, cifrado));
    return 'DIDB-' + corpo + '-' + checksum(corpo);
  }
  async function importarBackup(txt, senha) {
    const s = String(txt || '').replace(/\s+/g, '');
    const m = /^DIDB-([A-Za-z0-9_-]+)-([0-9A-Za-z]{4})$/.exec(s);
    if (!m) throw new ChaveErro('BACKUP_FORMATO');
    if (checksum(m[1]) !== m[2].toUpperCase()) throw new ChaveErro('BACKUP_FORMATO');
    const b = deB64url(m[1]);
    if (b.length < 4 + 1 + 16 + 12 + 17 || !iguais(b.slice(0, 4), MAGICO) || !RODADAS[b[4]]) throw new ChaveErro('BACKUP_FORMATO');
    const chave = await chaveDaSenha(senha, b.slice(5, 21), RODADAS[b[4]]);
    let texto;
    try {
      texto = dec.decode(new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: b.slice(21, 33) }, chave, b.slice(33))));
    } catch (e) {
      throw new ChaveErro('SENHA');
    }
    return JSON.parse(texto);
  }
  // A rough password strength score (0 to 4) for the backup form; it never blocks a long password.
  function forcaSenha(s) {
    s = String(s || '');
    if (s.length < 10) return 0;
    const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(s)).length;
    const repetida = /^(.)\1+$/.test(s) || /^(?:0123456789|1234567890|abcdefghij|qwertyuiop)/i.test(s);
    if (repetida) return 0;
    let p = s.length >= 16 ? 3 : s.length >= 12 ? 2 : 1;
    if (tipos >= 3) p++;
    if (s.split(' ').filter(Boolean).length >= 4) p++;
    return Math.min(4, p);
  }

  /* =================== PIN for the app lock =================== */
  // The PIN only locks the screen (the device's own lock protects the files). It is stored as a
  // PBKDF2 hash, never in the clear.
  async function hashPin(pin, salB64) {
    const sal = salB64 ? deB64url(salB64) : crypto.getRandomValues(new Uint8Array(16));
    const base = await subtle().importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 100000 }, base, 256));
    return { sal: b64url(sal), hash: b64url(bits) };
  }
  async function conferirPin(pin, trava) {
    if (!trava || !trava.sal || !trava.hash) return false;
    const { hash } = await hashPin(pin, trava.sal);
    const a = enc.encode(hash), b = enc.encode(trava.hash);
    let dif = a.length ^ b.length;
    for (let i = 0; i < Math.min(a.length, b.length); i++) dif |= a[i] ^ b[i];
    return dif === 0;
  }

  /* =================== QR code (byte mode, levels L/M/Q/H) =================== */
  const QR = (() => {
    const NIVEL = { L: [0, 1], M: [1, 0], Q: [2, 3], H: [3, 2] }; // [table index, format bits]
    const ECC = [
      [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
      [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
    ];
    const BLOCOS = [
      [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
      [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
      [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
      [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
    ];
    const bit = (x, i) => ((x >>> i) & 1) !== 0;
    function modulosBrutos(v) {
      let r = (16 * v + 128) * v + 64;
      if (v >= 2) {
        const n = Math.floor(v / 7) + 2;
        r -= (25 * n - 10) * n - 55;
        if (v >= 7) r -= 36;
      }
      return r;
    }
    const palavrasDados = (v, e) => Math.floor(modulosBrutos(v) / 8) - ECC[e][v] * BLOCOS[e][v];
    function mult(x, y) { // GF(256), polynomial 0x11D
      let z = 0;
      for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
      return z;
    }
    function divisor(grau) {
      const r = new Array(grau).fill(0);
      r[grau - 1] = 1;
      let raiz = 1;
      for (let i = 0; i < grau; i++) {
        for (let j = 0; j < r.length; j++) { r[j] = mult(r[j], raiz); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
        raiz = mult(raiz, 0x02);
      }
      return r;
    }
    function resto(dados, div) {
      const r = div.map(() => 0);
      for (const b of dados) {
        const fator = b ^ r.shift();
        r.push(0);
        div.forEach((c, i) => { r[i] ^= mult(c, fator); });
      }
      return r;
    }
    function posicoesAlinhamento(v) {
      if (v === 1) return [];
      const n = Math.floor(v / 7) + 2, tam = v * 4 + 17;
      const passo = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
      const r = [6];
      for (let p = tam - 7; r.length < n; p -= passo) r.splice(1, 0, p);
      return r;
    }
    function gerar(texto, nivel = 'M') {
      const [e, bitsFormato] = NIVEL[nivel];
      const dados = enc.encode(texto);
      let v = 1;
      for (; v <= 40; v++) {
        const bitsContagem = v <= 9 ? 8 : 16;
        if (4 + bitsContagem + dados.length * 8 <= palavrasDados(v, e) * 8) break;
      }
      if (v > 40) throw new Error('texto grande demais para um QR code');
      const cap = palavrasDados(v, e) * 8;
      const bits = [];
      const poe = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
      poe(4, 4); poe(dados.length, v <= 9 ? 8 : 16);
      for (const b of dados) poe(b, 8);
      poe(0, Math.min(4, cap - bits.length));
      poe(0, (8 - (bits.length % 8)) % 8);
      for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) poe(pad, 8);
      const palavras = [];
      for (let i = 0; i < bits.length; i += 8) {
        let b = 0;
        for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
        palavras.push(b);
      }
      // blocks + error correction, interleaved
      const nBlocos = BLOCOS[e][v], eccLen = ECC[e][v], brutas = Math.floor(modulosBrutos(v) / 8);
      const nCurtos = nBlocos - (brutas % nBlocos), lenCurto = Math.floor(brutas / nBlocos);
      const div = divisor(eccLen), blocos = [];
      for (let i = 0, k = 0; i < nBlocos; i++) {
        const dat = palavras.slice(k, k + lenCurto - eccLen + (i < nCurtos ? 0 : 1));
        k += dat.length;
        const ecc = resto(dat, div);
        if (i < nCurtos) dat.push(0);
        blocos.push(dat.concat(ecc));
      }
      const final = [];
      for (let i = 0; i < blocos[0].length; i++) {
        blocos.forEach((bl, j) => { if (i !== lenCurto - eccLen || j >= nCurtos) final.push(bl[i]); });
      }
      // matrix
      const tam = v * 4 + 17;
      const m = Array.from({ length: tam }, () => new Array(tam).fill(false));
      const fn = Array.from({ length: tam }, () => new Array(tam).fill(false));
      const fixa = (x, y, escuro) => { m[y][x] = escuro; fn[y][x] = true; };
      for (let i = 0; i < tam; i++) { fixa(6, i, i % 2 === 0); fixa(i, 6, i % 2 === 0); }
      const localizador = (cx, cy) => {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx, y = cy + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (x >= 0 && x < tam && y >= 0 && y < tam) fixa(x, y, dist !== 2 && dist !== 4);
        }
      };
      localizador(3, 3); localizador(tam - 4, 3); localizador(3, tam - 4);
      const al = posicoesAlinhamento(v), na = al.length;
      for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fixa(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
      const formato = mascara => {
        const d = (bitsFormato << 3) | mascara;
        let r = d;
        for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        const b = ((d << 10) | r) ^ 0x5412;
        for (let i = 0; i <= 5; i++) fixa(8, i, bit(b, i));
        fixa(8, 7, bit(b, 6)); fixa(8, 8, bit(b, 7)); fixa(7, 8, bit(b, 8));
        for (let i = 9; i < 15; i++) fixa(14 - i, 8, bit(b, i));
        for (let i = 0; i < 8; i++) fixa(tam - 1 - i, 8, bit(b, i));
        for (let i = 8; i < 15; i++) fixa(8, tam - 15 + i, bit(b, i));
        fixa(8, tam - 8, true);
      };
      formato(0);
      if (v >= 7) {
        let r = v;
        for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
        const b = (v << 12) | r;
        for (let i = 0; i < 18; i++) {
          const a = tam - 11 + (i % 3), c = Math.floor(i / 3);
          fixa(a, c, bit(b, i)); fixa(c, a, bit(b, i));
        }
      }
      // data in zigzag order
      let i = 0;
      for (let dir = tam - 1; dir >= 1; dir -= 2) {
        if (dir === 6) dir = 5;
        for (let vert = 0; vert < tam; vert++) for (let j = 0; j < 2; j++) {
          const x = dir - j, subindo = ((dir + 1) & 2) === 0, y = subindo ? tam - 1 - vert : vert;
          if (!fn[y][x] && i < final.length * 8) { m[y][x] = bit(final[i >>> 3], 7 - (i & 7)); i++; }
        }
      }
      const MASCARAS = [
        (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
        (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
        (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
      ];
      const aplica = k => {
        for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (!fn[y][x] && MASCARAS[k](x, y)) m[y][x] = !m[y][x];
      };
      const penalidade = () => { // rules 1, 2 and 4 of the spec (enough to pick a mask)
        let p = 0, escuros = 0;
        for (let a = 0; a < tam; a++) {
          let h = 1, v = 1;
          for (let b = 1; b < tam; b++) {
            if (m[a][b] === m[a][b - 1]) h++; else { if (h >= 5) p += h - 2; h = 1; }
            if (m[b][a] === m[b - 1][a]) v++; else { if (v >= 5) p += v - 2; v = 1; }
          }
          if (h >= 5) p += h - 2;
          if (v >= 5) p += v - 2;
        }
        for (let y = 0; y < tam; y++) {
          for (let x = 0; x < tam; x++) {
            if (m[y][x]) escuros++;
            if (x < tam - 1 && y < tam - 1) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
          }
        }
        const total = tam * tam;
        p += Math.floor(Math.abs(escuros * 20 - total * 10) / total) * 10;
        return p;
      };
      let melhor = 0, menor = Infinity;
      for (let k = 0; k < 8; k++) {
        aplica(k); formato(k);
        const p = penalidade();
        if (p < menor) { menor = p; melhor = k; }
        aplica(k);
      }
      aplica(melhor); formato(melhor);
      return { versao: v, tamanho: tam, modulos: m };
    }
    function svg(texto, { nivel = 'M', margem = 4, rotulo = 'QR code' } = {}) {
      const { tamanho, modulos } = gerar(texto, nivel);
      const t = tamanho + margem * 2;
      let d = '';
      for (let y = 0; y < tamanho; y++) {
        for (let x = 0; x < tamanho; x++) {
          if (!modulos[y][x]) continue;
          let w = 1;
          while (x + w < tamanho && modulos[y][x + w]) w++;
          d += `M${x + margem} ${y + margem}h${w}v1h-${w}z`;
          x += w - 1;
        }
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="${rotulo}"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
    }
    return { gerar, svg };
  })();

  /* =================== formatting (pt-BR or English) =================== */
  const LOC = {
    pt: {
      tag: 'pt-BR',
      meses: ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'],
      modo: { total: 'no total', mes: 'ao mês', ano: 'ao ano' }, dia: 'dia', dias: 'dias', as: 'às',
      milhar: '.', decimal: ','
    },
    en: {
      tag: 'en-US',
      meses: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      modo: { total: 'in total', mes: 'per month', ano: 'per year' }, dia: 'day', dias: 'days', as: 'at',
      milhar: ',', decimal: '.'
    }
  };
  let idioma = 'pt', L = LOC.pt, nfT;
  /** Sets the language used by fmt, extenso and lerNumero ('pt' or 'en'). Stored codes are not affected. */
  function definirIdioma(l) {
    idioma = l === 'en' ? 'en' : 'pt';
    L = LOC[idioma];
    nfT = new Intl.NumberFormat(L.tag, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
    return idioma;
  }
  definirIdioma('pt');
  const p2 = n => String(n).padStart(2, '0');
  const dataUTC = dia => new Date(dia * 86400000);
  const curto = m => L.meses[m].slice(0, 3);
  const cacheNF = {};
  const nf = (min, max) => {
    const k = `${L.tag}|${min}|${max}`;
    return cacheNF[k] || (cacheNF[k] = new Intl.NumberFormat(L.tag, { minimumFractionDigits: min, maximumFractionDigits: max }));
  };
  // exact formatting of an integer amount in the smallest unit (no floating point in the decimals)
  function numMoeda(v, casas, minCasas = casas) {
    const neg = v < 0, a = Math.abs(v), mult = 10 ** casas, inteiro = Math.floor(a / mult);
    let fr = casas ? String(a - inteiro * mult).padStart(casas, '0') : '';
    while (fr.length > minCasas && fr.endsWith('0')) fr = fr.slice(0, -1);
    return (neg ? '-' : '') + nf(0, 0).format(inteiro) + (fr ? L.decimal + fr : '');
  }
  const BRL = MOEDAS.BRL;
  const fmt = {
    idioma: () => idioma,
    num: n => nfT.format(n),
    /** amount (smallest unit) with the currency symbol, e.g. "₿ 0.00125000", "R$ 1.250,00" */
    dinheiro: (v, m = BRL) => m.simbolo + '\u00a0' + numMoeda(v, m.casas), // no-break space: symbol never wraps alone
    /** fractional amount (smallest unit) with up to 2 extra decimals, for the raw interest */
    dinheiro4: (x, m = BRL) => m.simbolo + '\u00a0' + nf(m.casas, m.casas + 2).format(x / 10 ** m.casas),
    numMoeda,
    /** number for an input field: no thousands separator, so it reads back the same ("1000", not "1.000") */
    numEntrada: n => new Intl.NumberFormat(L.tag, { maximumFractionDigits: 4, useGrouping: false }).format(n),
    nomeMoeda: m => m[idioma].nome,
    brl: c => fmt.dinheiro(c, BRL),
    brl4: c => fmt.dinheiro4(c, BRL),
    taxa: t => nfT.format(t / 10000) + '%',
    modo: m => L.modo[m],
    dias: n => n + ' ' + (n === 1 ? L.dia : L.dias),
    data: dia => {
      const x = dataUTC(dia);
      return idioma === 'en' ? `${curto(x.getUTCMonth())} ${x.getUTCDate()}, ${x.getUTCFullYear()}`
                             : `${p2(x.getUTCDate())}/${p2(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`;
    },
    dataCurta: dia => {
      const x = dataUTC(dia);
      return idioma === 'en' ? `${curto(x.getUTCMonth())} ${x.getUTCDate()}` : `${p2(x.getUTCDate())}/${p2(x.getUTCMonth() + 1)}`;
    },
    dataExtenso: dia => {
      const x = dataUTC(dia), dd = x.getUTCDate(), m = L.meses[x.getUTCMonth()];
      return idioma === 'en' ? `${m} ${dd}, ${x.getUTCFullYear()}` : `${dd === 1 ? '1º' : dd} de ${m} de ${x.getUTCFullYear()}`;
    },
    momento: (ts, tz) => {
      const x = new Date((ts + tz * 900) * 1000), off = tz * 15, a = Math.abs(off);
      const dia = Math.floor((ts + tz * 900) / 86400);
      return `${fmt.data(dia)} ${L.as} ${p2(x.getUTCHours())}:${p2(x.getUTCMinutes())} ` +
             `(UTC${off < 0 ? '−' : '+'}${p2(Math.floor(a / 60))}:${p2(a % 60)})`;
    }
  };

  /* =================== amounts in words =================== */
  // Brazilian Portuguese
  const UN = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const DZ = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const CT = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
  const ESCALAS = [null, null, ['milhão','milhões'], ['bilhão','bilhões'], ['trilhão','trilhões']];
  const UN_F = UN.map((x, i) => (i === 1 ? 'uma' : i === 2 ? 'duas' : x));
  const CT_F = CT.map(x => x.replace(/os$/, 'as'));
  function ate999(n, fem) {
    if (n === 100) return 'cem';
    const U = fem ? UN_F : UN, C = fem ? CT_F : CT;
    const c = Math.floor(n / 100), r = n % 100, partes = [];
    if (c) partes.push(C[c]);
    if (r) partes.push(r < 20 ? U[r] : DZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + U[r % 10] : ''));
    return partes.join(' e ');
  }
  function inteiroExtenso(n, fem = false) {
    if (n === 0) return 'zero';
    const grupos = [];
    while (n > 0) { grupos.push(n % 1000); n = Math.floor(n / 1000); }
    const partes = [];
    for (let k = grupos.length - 1; k >= 0; k--) {
      const v = grupos[k];
      if (!v) continue;
      let s;
      if (k === 0) s = ate999(v, fem);
      else if (k === 1) s = v === 1 ? 'mil' : ate999(v, fem) + ' mil';
      else s = ate999(v, false) + ' ' + ESCALAS[k][v === 1 ? 0 : 1];
      partes.push({ s, v });
    }
    let out = partes[0].s;
    for (let j = 1; j < partes.length; j++) {
      const ultimo = j === partes.length - 1, v = partes[j].v;
      out += (ultimo && (v < 100 || v % 100 === 0)) ? ' e ' : (partes.length > 2 ? ', ' : ' ');
      out += partes[j].s;
    }
    return out;
  }
  // English
  const EN_UN = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const EN_DZ = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  const EN_ESC = ['', 'thousand', 'million', 'billion', 'trillion'];
  function ate999En(n) {
    const c = Math.floor(n / 100), r = n % 100, partes = [];
    if (c) partes.push(EN_UN[c] + ' hundred');
    if (r) partes.push(r < 20 ? EN_UN[r] : EN_DZ[Math.floor(r / 10)] + (r % 10 ? '-' + EN_UN[r % 10] : ''));
    return partes.join(' ');
  }
  function inteiroExtensoEn(n) {
    if (n === 0) return 'zero';
    const partes = [];
    for (let k = 0; n > 0; k++, n = Math.floor(n / 1000)) {
      const v = n % 1000;
      if (v) partes.unshift(ate999En(v) + (k ? ' ' + EN_ESC[k] : ''));
    }
    return partes.join(' ');
  }
  /** Amount (smallest unit) in words, e.g. "duzentos e quarenta reais e trinta e cinco centavos". */
  function extenso(v, m = BRL) {
    const mult = 10 ** m.casas, r = Math.floor(v / mult), c = v - r * mult, partes = [];
    const nome = m[idioma], sub = m.sub && m.sub[idioma];
    if (c && !sub) return numMoeda(v, m.casas) + ' ' + nome.p; // currency unknown to this version: digits only
    if (idioma === 'en') {
      if (r) partes.push(inteiroExtensoEn(r) + ' ' + (r === 1 ? nome.s : nome.p));
      if (c) partes.push(inteiroExtensoEn(c) + ' ' + sub[c === 1 ? 0 : 1]);
      return partes.length ? partes.join(' and ') : 'zero ' + nome.p;
    }
    if (r) partes.push(inteiroExtenso(r, nome.fem) + (r >= 1e6 && r % 1e6 === 0 ? ' de ' : ' ') + (r === 1 ? nome.s : nome.p));
    if (c) partes.push(inteiroExtenso(c) + ' ' + sub[c === 1 ? 0 : 1]);
    return partes.length ? partes.join(' e ') : 'zero ' + nome.p;
  }

  /* =================== typed numbers (lenient parsing) ===================
     Accepts both "1.250,50" and "1,250.50". When only one kind of separator appears, the
     current language decides: the decimal mark is "," in Portuguese and "." in English. */
  function lerNumero(bruto, milhar) {
    let s = String(bruto).replace(/[R$\s% ]/g, '');
    if (!s || !/^\d[\d.,]*$|^[.,]\d+$/.test(s)) return NaN;
    const vg = s.lastIndexOf(','), pt = s.lastIndexOf('.');
    if (vg > -1 && pt > -1) {
      const decimal = vg > pt ? ',' : '.';
      s = s.split(decimal === ',' ? '.' : ',').join('').replace(decimal, '.');
    } else if (vg > -1 || pt > -1) {
      const sep = vg > -1 ? ',' : '.', partes = s.split(sep);
      if (sep === L.decimal) s = partes.length > 2 ? partes.join('') : partes.join('.');
      else if (partes.length > 2 || (milhar && partes[1].length === 3)) s = partes.join('');
      else s = partes.join('.');
    }
    if ((s.match(/\./g) || []).length > 1) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  return {
    calcular, ceilCentavos, fmt, extenso, lerNumero, definirIdioma, LIMITES, MODOS, ChaveErro,
    MOEDAS, CODIGOS_MOEDAS, MOEDAS_POPULARES, infoMoeda,
    criarPerfil, idDe, idLongoDe, criarProposta, confirmarProposta, lerCodigo, extrairCodigo,
    criarRecibo, conferirRecibo, TIPOS_RECIBO, parcelasDe, situacao,
    exportarBackup, importarBackup, forcaSenha, hashPin, conferirPin, QR,
    _interno: { embalar, desembalar, comprimir, descomprimir, b64url, deB64url, checksum, sBaixo, normalizarS, ORDEM }
  };
})();
