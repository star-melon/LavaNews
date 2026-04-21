// lib/classifier.ts — Multi-category news classifier.
//
// Priority order (first match wins):
//   AI > 能源 > 地缘 > 宏观 > 市场 > 公司 > 科技 > (unclassified → caller decides)
//
// Rationale:
//   - AI beats 科技 because AI is a more specific slice of tech.
//   - 能源 / 地缘 / 宏观 have very distinctive vocab with low false-positive rate,
//     so we match them before the broader 市场 / 公司 buckets.
//   - 公司 (earnings, layoffs, CEO moves) is intentionally below 市场 so that a
//     story about a stock that also mentions the company name still lands in 市场.
//   - 科技 is the catch-all bucket for hardware/software/platform news that
//     isn't AI, finance, or geopolitics.
//
// Keyword lists draw from the IPTC Media Topics taxonomy (economy, energy,
// conflict, computing, business) plus mainland-Chinese financial press usage.

// AI: LLM products, major labs, terminology in EN + 中文.
export const AI_KEYWORDS = new RegExp(
  // English
  '\\b(' +
  'claude|anthropic|opus\\s?[3-9]|sonnet\\s?[3-9]|haiku\\s?[3-9]|' +
  'gpt-?[3-9]|openai|chatgpt|sora|dall-?e|' +
  'gemini|deepmind|bard|' +
  'grok|x\\.ai|' +
  'llama|meta\\s+ai|mistral|deepseek|qwen|kimi|wenxin|yi-?34b|' +
  'mythos|' +
  'copilot|github\\s+copilot|cursor|windsurf|' +
  'agi|asi|' +
  'transformer|diffusion|stable\\s+diffusion|midjourney|flux|' +
  'huggingface|langchain|vector\\s+database|rag|retrieval[-\\s]?augmented|' +
  'fine-?tun(?:e|ing|ed)|pretrain|prompt\\s+engineering|' +
  'ai\\s+(?:model|agent|agents|agentic|chip|training|inference|coding|safety|alignment|governance|doom|hype)|' +
  'llm|large\\s+language\\s+model|slm|small\\s+language\\s+model|' +
  'artificial\\s+intelligence|machine\\s+learning|deep\\s+learning|reinforcement\\s+learning|' +
  'generative\\s+ai|genai|neural\\s+network|foundation\\s+model|world\\s+model|embodied\\s+ai|' +
  'autonomous\\s+(?:agent|agents|driving)|' +
  'robotax(?:i|is)|humanoid\\s+robot|self-?driving' +
  ')\\b' +
  // Chinese (no \\b since Chinese has no word boundaries)
  '|人工智能|大模型|大语言模型|生成式|机器学习|神经网络|深度学习|强化学习' +
  '|智能体|具身|通用人工智能|自动驾驶|无人驾驶|机器人(?:出租车)?' +
  '|大语言|多模态|预训练|微调|向量数据库|智能驾驶' +
  '|AI ?(?:芯片|模型|训练|推理|算力|智能|助手|编程|安全|治理|原生|应用)',
  'i'
);

// 能源: oil, gas, coal, renewable, nuclear, electricity grid.
const ENERGY_KEYWORDS = new RegExp(
  '\\b(' +
  'oil|crude|petroleum|gasoline|diesel|' +
  'natural\\s+gas|lng|liquefied\\s+natural\\s+gas|' +
  'coal|mining|' +
  'electricity|power\\s+grid|blackout|outage|' +
  'renewable(?:s)?|solar\\s+(?:power|panel|cell)|wind\\s+(?:power|farm|energy|turbine)|hydroelectric|hydro\\s+power|' +
  'nuclear\\s+(?:power|reactor|plant|energy)|uranium|' +
  'opec(?:\\+)?|' +
  'saudi\\s+aramco|exxon\\s*mobil|chevron|bp\\s+plc|total\\s*energies|equinor|petrobras|gazprom|rosneft|' +
  'pipeline|refinery|refiner|petrochemical|lithium|battery\\s+(?:storage|energy)|ev\\s+battery|' +
  'carbon\\s+(?:emission|tax|credit|capture)|net[-\\s]?zero|decarbon' +
  ')\\b' +
  '|原油|石油|天然气|液化(?:天然)?气|汽油|柴油|煤炭|动力煤|焦煤' +
  '|炼油|炼厂|石化|页岩油|页岩气' +
  '|电网|电力|停电|缺电|供电|输电|发电' +
  '|核电|核能|铀|风电|光伏|太阳能|水电|水力发电|新能源' +
  '|欧佩克|沙特阿美|中石油|中石化|中海油|国家电网|南方电网' +
  '|锂电|储能|动力电池|充电桩|碳排放|碳中和|碳达峰|碳交易',
  'i'
);

// 地缘: wars, sanctions, diplomacy, elections, cross-border conflict.
const GEOPOLITICS_KEYWORDS = new RegExp(
  '\\b(' +
  'war|invasion|ceasefire|armistice|truce|' +
  'sanction(?:s)?|embargo|export\\s+control|' +
  'tariff(?:s)?|trade\\s+(?:war|dispute|deal|agreement)|wto|' +
  'nato|un\\s+security\\s+council|un\\s+general\\s+assembly|icj|icc|' +
  'diplomacy|diplomat(?:ic)?|embassy|consulate|summit|bilateral|multilateral|' +
  'border\\s+(?:clash|dispute|incident)|' +
  'election|president-?elect|prime\\s+minister|white\\s+house|kremlin|pentagon|state\\s+department|' +
  'airstrike|missile\\s+strike|drone\\s+strike|rocket\\s+attack|artillery|military\\s+(?:operation|strike|drill)|' +
  'israel|palestine|palestinian|gaza|hamas|hezbollah|west\\s+bank|idf|' +
  'ukraine|russia|kyiv|moscow|putin|zelensky|' +
  'china-?us|us-?china|taiwan\\s+strait|taiwan\\s+strait|south\\s+china\\s+sea|' +
  'north\\s+korea|dprk|kim\\s+jong-?un|nuclear\\s+test|' +
  'iran|tehran|iaea|houthi|red\\s+sea|' +
  'afghanistan|taliban|syria|assad|yemen|lebanon|turkey|erdoğan|erdogan|' +
  'coup|regime\\s+change|asylum|refugee|migrant\\s+caravan|' +
  'genocide|ethnic\\s+cleansing|war\\s+crime|' +
  'geopolitic' +
  ')\\b' +
  '|战争|冲突|停火|停战|休战' +
  '|制裁|禁令|出口管制|关税|贸易战|贸易摩擦' +
  '|北约|联合国|安理会|国际法院|国际刑事法院' +
  '|外交|外交官|使馆|领事馆|峰会|双边|多边' +
  '|边境|领海|领土|主权' +
  '|大选|总统|首相|白宫|克里姆林|五角大楼|国务院' +
  '|空袭|导弹|无人机|火箭弹|炮击|军事行动|军演' +
  '|以色列|巴勒斯坦|加沙|哈马斯|真主党|约旦河西岸' +
  '|乌克兰|俄罗斯|基辅|莫斯科|普京|泽连斯基' +
  '|中美|台海|南海|台湾海峡' +
  '|朝鲜|金正恩|核试验' +
  '|伊朗|德黑兰|胡塞|红海' +
  '|阿富汗|塔利班|叙利亚|也门|黎巴嫩|土耳其' +
  '|政变|政权更替|庇护|难民|地缘政治',
  'i'
);

// 宏观: central banks, interest rates, inflation, GDP, fiscal policy.
const MACRO_KEYWORDS = new RegExp(
  '\\b(' +
  'federal\\s+reserve|fed\\s+(?:chair|meeting|decision|rate)|fomc|jerome\\s+powell|' +
  'ecb|european\\s+central\\s+bank|christine\\s+lagarde|' +
  'bank\\s+of\\s+japan|boj|' +
  'bank\\s+of\\s+england|boe|' +
  'pboc|people.?s\\s+bank\\s+of\\s+china|' +
  'central\\s+bank|' +
  'interest\\s+rate|rate\\s+(?:cut|hike|decision|path)|dot\\s+plot|' +
  'inflation|cpi|ppi|pce|deflation|stagflation|disinflation|' +
  'gdp|gross\\s+domestic\\s+product|recession|expansion|contraction|' +
  'monetary\\s+policy|fiscal\\s+policy|quantitative\\s+(?:easing|tightening)|qe|qt|' +
  'stimulus\\s+package|tax\\s+(?:reform|cut|hike)|' +
  'unemployment|jobless\\s+claims|non-?farm\\s+payroll|nfp|labor\\s+market|' +
  'trade\\s+(?:deficit|surplus|balance)|current\\s+account|' +
  'budget\\s+deficit|national\\s+debt|debt\\s+ceiling|sovereign\\s+debt|' +
  'yield\\s+curve|inversion|soft\\s+landing|hard\\s+landing|' +
  'dollar\\s+index|dxy|yuan|renminbi|rmb|yen|euro' +
  ')\\b' +
  '|美联储|欧洲央行|欧央行|日央行|英国央行|中国人民银行|央行' +
  '|利率|加息|降息|点阵图|议息' +
  '|通胀|通缩|滞胀|CPI|PPI|PCE' +
  '|GDP|国内生产总值|经济衰退|经济扩张|经济放缓|经济复苏' +
  '|货币政策|财政政策|量化宽松|量化紧缩|缩表' +
  '|刺激计划|减税|增税' +
  '|失业(?:率)?|就业|非农|劳动力市场' +
  '|贸易(?:逆差|顺差|差额)|经常账户' +
  '|财政赤字|国债|债务上限' +
  '|收益率曲线|软着陆|硬着陆|美元指数|人民币|日元|欧元|宏观经济',
  'i'
);

// 市场: equities, fixed income, commodities markets, FX, crypto, IPO.
const MARKET_KEYWORDS = new RegExp(
  '\\b(' +
  'stock\\s+(?:market|exchange|price|rally|plunge|crash)|' +
  'nasdaq|dow\\s+jones|dow\\s+industrial|s&p\\s*500|russell\\s*2000|' +
  'hang\\s+seng|nikkei|ftse|dax|cac\\s*40|' +
  'csi\\s*300|shanghai\\s+composite|shenzhen\\s+component|star\\s+50|' +
  'bond\\s+(?:yield|market|auction)|treasury(?:\\s+yield|\\s+bond)?|gilt|bund|jgb|' +
  'etf|index\\s+fund|mutual\\s+fund|' +
  'ipo|spac|secondary\\s+listing|dual\\s+listing|' +
  'cryptocurrency|crypto|bitcoin|btc|ethereum|eth|stablecoin|usdt|usdc|' +
  'futures|options|derivatives|swap|' +
  'forex|fx\\s+market|exchange\\s+rate|currency\\s+(?:peg|devaluation)|' +
  'bullish|bearish|rally|sell-?off|correction|bear\\s+market|bull\\s+market|' +
  'hedge\\s+fund|mutual\\s+fund|portfolio|asset\\s+(?:manager|management)|' +
  'short\\s+(?:selling|squeeze|seller)|margin\\s+call|' +
  'dividend|buyback|share\\s+repurchase|' +
  'volatility|vix|' +
  'commodities?|gold\\s+price|silver\\s+price|copper|iron\\s+ore|wheat|corn|soybean' +
  ')\\b' +
  '|股市|股票|股指|大盘|沪指|深指|创业板|科创板|港股|美股|A股|B股' +
  '|上证(?:指数|综指)?|深证(?:成指|综指)?|恒生(?:指数|科技)?|纳指|道琼斯|标普|日经' +
  '|债市|国债|地方债|企业债|信用债|可转债|收益率' +
  '|基金|公募|私募|ETF|指数基金' +
  '|IPO|上市|新股|破发|询价' +
  '|比特币|以太坊|加密货币|稳定币|区块链资产' +
  '|期货|期权|衍生品|交易所' +
  '|外汇|汇率|贬值|升值' +
  '|牛市|熊市|震荡|反弹|抛售|回调|调整' +
  '|对冲基金|资产管理|投资组合' +
  '|做空|做多|融资|融券|杠杆|爆仓|强平' +
  '|股息|分红|回购' +
  '|商品|黄金|白银|铜|铁矿石|大豆|玉米|棉花|原油价格',
  'i'
);

// 公司: earnings, M&A, executive changes, layoffs, lawsuits, bankruptcy.
const COMPANY_KEYWORDS = new RegExp(
  '\\b(' +
  'earnings\\s+(?:report|call|season|beat|miss)|quarterly\\s+(?:results|earnings)|' +
  'revenue\\s+(?:growth|miss|beat)|net\\s+(?:income|loss)|profit\\s+(?:margin|warning)|' +
  'guidance\\s+(?:raise|cut|beat)|forecast\\s+(?:raise|cut)|' +
  'merger|acquisition|acquired|acquires|m&a|takeover|bid|buyout|' +
  'spin-?off|divestiture|carve-?out|' +
  'restructur(?:e|ing|ed)|reorganization|turnaround|' +
  'layoff|job\\s+cuts|workforce\\s+reduction|downsizing|redundancy|' +
  'hiring\\s+freeze|' +
  'ceo|chief\\s+executive|cfo|chief\\s+financial|coo|chief\\s+operating|cto|chief\\s+technology|' +
  'resign(?:s|ed|ation)?|step(?:s|ped)?\\s+down|appointed|named\\s+(?:new|as)|succession|' +
  'board\\s+(?:of\\s+directors|member|seat)|shareholder|stockholder|activist\\s+investor|proxy\\s+fight|' +
  'buyback|share\\s+repurchase|dividend\\s+(?:cut|raise|announcement)|' +
  'antitrust|monopoly|price\\s+fixing|cartel|regulatory\\s+probe|' +
  'lawsuit|class\\s+action|settlement|fine|penalty|' +
  'bankruptcy|chapter\\s+11|chapter\\s+7|liquidation|insolvency|default' +
  ')\\b' +
  '|财报|年报|季报|半年报|业绩(?:报告|预告|快报)?' +
  '|营收|营业收入|净利润|亏损|毛利率|净利率' +
  '|业绩指引|盈利预测|下调|上调' +
  '|并购|收购|兼并|合并|要约收购|敌意收购' +
  '|分拆|剥离|出售|重组|改组' +
  '|裁员|减员|优化|冻结招聘' +
  '|CEO|首席执行官|CFO|首席财务官|COO|首席运营官|CTO|首席技术官' +
  '|董事长|董事会|总裁|总经理|辞任|辞职|就任|继任|接任' +
  '|股东(?:大会)?|大股东|实控人|激进投资者|维权投资者' +
  '|回购|股息|分红|派息' +
  '|反垄断|垄断|价格操纵|卡特尔' +
  '|诉讼|集体诉讼|和解|罚款|处罚' +
  '|破产|清算|重整|违约|暴雷',
  'i'
);

// 科技: tech catch-all (semiconductors, platforms, devices, cyber).
const TECH_KEYWORDS = new RegExp(
  '\\b(' +
  'semiconductor|chip(?:maker)?|cpu|gpu|tpu|npu|soc|wafer|fab|foundry|' +
  'tsmc|samsung\\s+electronics|intel|nvidia|amd|arm\\s+holdings|broadcom|qualcomm|micron|' +
  'smartphone|iphone|ipad|android|pixel|samsung\\s+galaxy|' +
  'apple|google|microsoft|meta\\s+(?:platforms|inc)|amazon|tesla|spacex|blue\\s+origin|' +
  'starlink|satellite|low\\s+earth\\s+orbit|' +
  'cybersecurity|data\\s+breach|ransomware|hack(?:er)?|malware|phishing|zero-?day|' +
  'cloud\\s+(?:computing|service|infrastructure)|aws|azure|google\\s+cloud|saas|iaas|paas|' +
  'platform|startup|unicorn|' +
  'app\\s+store|play\\s+store|app\\s+launch|' +
  'software|operating\\s+system|kernel|open\\s+source|github|gitlab|linux|windows|macos|ios|' +
  'browser|chrome|firefox|safari|edge|' +
  'vr|virtual\\s+reality|ar|augmented\\s+reality|xr|metaverse|' +
  '5g|6g|wifi|iot|internet\\s+of\\s+things|edge\\s+computing|' +
  'quantum\\s+(?:computing|supremacy|processor)|' +
  'biotech|crispr|mrna|gene\\s+editing' +
  ')\\b' +
  '|芯片|半导体|晶圆|晶圆厂|代工|台积电|三星电子|英伟达|英特尔|超微|高通|博通|美光|中芯国际' +
  '|智能手机|手机厂商|华为|小米|vivo|OPPO|苹果|谷歌|微软|脸书|亚马逊|特斯拉' +
  '|星链|卫星|低轨' +
  '|网络安全|数据泄露|勒索|黑客|木马|漏洞|零日' +
  '|云计算|云服务|华为云|阿里云|腾讯云|百度云|SaaS|PaaS|IaaS' +
  '|平台|创业公司|独角兽' +
  '|应用商店|应用上架' +
  '|操作系统|鸿蒙|安卓|开源|Linux|内核' +
  '|浏览器' +
  '|虚拟现实|增强现实|元宇宙' +
  '|5G|6G|WiFi|物联网|边缘计算' +
  '|量子计算|量子(?:霸权|处理器)' +
  '|生物科技|基因编辑|mRNA',
  'i'
);

// Priority-ordered list; first match wins.
const CATEGORY_PIPELINE: Array<[string, RegExp]> = [
  ['AI', AI_KEYWORDS],
  ['能源', ENERGY_KEYWORDS],
  ['地缘', GEOPOLITICS_KEYWORDS],
  ['宏观', MACRO_KEYWORDS],
  ['市场', MARKET_KEYWORDS],
  ['公司', COMPANY_KEYWORDS],
  ['科技', TECH_KEYWORDS],
];

/** Returns the best-matching category for a headline, or null if no rule fires. */
export function classifyByTitle(title: string): string | null {
  if (!title) return null;
  for (const [cat, re] of CATEGORY_PIPELINE) {
    if (re.test(title)) return cat;
  }
  return null;
}

/** Combine feed hints with title classification. Title always wins when it fires. */
export function resolveCategoryForFeed(feedCategory: string | undefined, title: string): string | undefined {
  const byTitle = classifyByTitle(title);
  if (byTitle) return byTitle;
  // AI sub-feeds that publish editorial columns shouldn't dump non-AI posts
  // into the AI bucket — downgrade to 综合 when title didn't match.
  if (feedCategory === 'AI') return '综合';
  return feedCategory;
}
