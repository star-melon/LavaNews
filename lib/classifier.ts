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
// Expanded in 2026-04 to align closer to newsroom-grade coverage:
//   - country/region entities for 地缘
//   - macro indicator vocabulary (IMF / NBS / BEA terminology)
//   - market microstructure terms (市值 / 估值 / 涨跌停 / margin)
//   - corporate strategy verbs (发布会 / 门店 / market entry)
//   - policy & regulation nouns (法案 / 监管 / 立法)

// AI: LLM products, major labs, terminology in EN + 中文.
export const AI_KEYWORDS = new RegExp(
  // English
  '\\b(' +
  // Foundation-model families
  'claude|anthropic|opus\\s?[3-9]|sonnet\\s?[3-9]|haiku\\s?[3-9]|' +
  'gpt-?[3-9]|openai|chatgpt|sora|dall-?e|whisper|o1-preview|o3|' +
  'gemini|deepmind|bard|imagen|veo|' +
  'grok|x\\.ai|xai|' +
  'llama|meta\\s+ai|mistral|mixtral|deepseek|qwen|kimi|wenxin|yi-?34b|baichuan|doubao|minimax|zhipu|ernie|' +
  'mythos|' +
  // Coding / agent tools
  'copilot|github\\s+copilot|cursor|windsurf|devin|codeium|tabnine|amazon\\s+q|' +
  // Research concepts
  'agi|asi|singularity|superalignment|' +
  'transformer|diffusion|stable\\s+diffusion|midjourney|flux|runway|pika|' +
  'huggingface|langchain|llamaindex|vector\\s+database|rag|retrieval[-\\s]?augmented|' +
  'fine-?tun(?:e|ing|ed)|pretrain|prompt\\s+engineering|chain[-\\s]?of[-\\s]?thought|' +
  'mixture\\s+of\\s+experts|moe|reasoning\\s+model|' +
  'ai\\s+(?:model|agent|agents|agentic|chip|training|inference|coding|safety|alignment|governance|doom|hype|regulation|act|bill|law|ethics|startup|labs?|company|native)|' +
  // Generic AI
  'llm|large\\s+language\\s+model|slm|small\\s+language\\s+model|vlm|multimodal|' +
  'artificial\\s+intelligence|machine\\s+learning|deep\\s+learning|reinforcement\\s+learning|' +
  'generative\\s+ai|genai|neural\\s+network|foundation\\s+model|world\\s+model|embodied\\s+ai|' +
  'autonomous\\s+(?:agent|agents|driving|vehicle)|' +
  'robotax(?:i|is)|humanoid\\s+robot|self-?driving|' +
  // Hardware/infra for AI
  'gpu\\s+(?:cluster|shortage|export\\s+control)|h100|h200|b100|b200|mi300|nvlink|' +
  // Policy/legal on AI
  'ai\\s+act|eu\\s+ai\\s+act|executive\\s+order\\s+on\\s+ai|ai\\s+bill|ai\\s+safety\\s+institute|' +
  'responsible\\s+ai|ai\\s+ethics|ai\\s+alignment|model\\s+evaluation|red[-\\s]?team' +
  ')\\b' +
  // Chinese (no \\b since Chinese has no word boundaries)
  '|人工智能|通用人工智能|大模型|大语言模型|小模型|语言模型|预训练模型|基础模型|' +
  '生成式|机器学习|神经网络|深度学习|强化学习|联邦学习|迁移学习|' +
  '智能体|具身智能?|自动驾驶|无人驾驶|智能驾驶|辅助驾驶|机器人(?:出租车|技术)?|人形机器人|仿生机器人|' +
  '多模态|单模态|大语言|预训练|微调|对齐|向量数据库|提示工程|' +
  '扩散模型|推理模型|世界模型|思维链|混合专家|' +
  'AI ?(?:芯片|模型|训练|推理|算力|智能|助手|编程|安全|治理|原生|应用|法案|法规|监管|伦理|立法|合规|备案|白皮书|生态|产业|赛道|创业|独角兽|算法|创新|落地|技术|赋能|初创|实验室|公司|人才|工程|指南)|' +
  '大模型(?:备案|合规|安全|伦理|法案|治理|监管|能力|评测|基准)|' +
  '百度文心|阿里通义|腾讯混元|字节豆包|月之暗面|智谱清言|讯飞星火|昆仑万维|零一万物|DeepSeek',
  'i'
);

// 能源: oil, gas, coal, renewable, nuclear, electricity grid.
const ENERGY_KEYWORDS = new RegExp(
  '\\b(' +
  'oil|crude|brent|wti|petroleum|gasoline|diesel|jet\\s+fuel|fuel\\s+oil|' +
  'natural\\s+gas|lng|liquefied\\s+natural\\s+gas|shale\\s+gas|shale\\s+oil|' +
  'coal|thermal\\s+coal|coking\\s+coal|mining|' +
  'electricity|power\\s+grid|blackout|brownout|outage|power\\s+plant|' +
  'renewable(?:s)?|solar\\s+(?:power|panel|cell|farm|plant)|wind\\s+(?:power|farm|energy|turbine)|' +
  'hydroelectric|hydro\\s+power|geothermal|tidal\\s+power|' +
  'nuclear\\s+(?:power|reactor|plant|energy|fuel)|uranium|thorium|smr|small\\s+modular\\s+reactor|' +
  'fusion\\s+(?:energy|reactor)|tokamak|iter|' +
  'opec(?:\\+)?|iea|eia|' +
  'saudi\\s+aramco|exxon\\s*mobil|chevron|bp\\s+plc|total\\s*energies|equinor|petrobras|gazprom|rosneft|shell|conoco|eni|repsol|oxy|' +
  'pipeline|refinery|refiner|petrochemical|tanker|oil\\s+tanker|' +
  'lithium|cobalt|nickel|graphite|rare\\s+earth|battery\\s+(?:storage|energy|maker|giga)|ev\\s+battery|solid[-\\s]?state\\s+battery|' +
  'carbon\\s+(?:emission|tax|credit|capture|market|trading|neutral)|ccus|net[-\\s]?zero|decarbon|' +
  'emission\\s+(?:target|reduction|standards?)|green\\s+(?:hydrogen|energy|deal)|energy\\s+transition|' +
  'clean\\s+energy|climate\\s+(?:policy|deal|target)|cop\\s?\\d+' +
  ')\\b' +
  '|原油|石油|成品油|汽油|柴油|航油|燃料油|布伦特|WTI' +
  '|天然气|液化(?:天然)?气|页岩油|页岩气|煤炭|动力煤|焦煤|炼焦煤' +
  '|炼油|炼厂|石化|化工' +
  '|电网|电力|停电|限电|缺电|供电|输电|发电|电厂' +
  '|核电|核能|核反应堆|铀|小型模块化反应堆|可控核聚变|核聚变|托卡马克' +
  '|风电|海上风电|光伏|光伏电站|太阳能|水电|水力发电|地热|潮汐能|新能源' +
  '|欧佩克|沙特阿美|中石油|中石化|中海油|国家电网|南方电网|三峡集团|国家能源' +
  '|锂电|钠离子电池|固态电池|储能|储能电站|动力电池|充电桩|换电|锂矿|钴|镍|稀土' +
  '|碳排放|碳中和|碳达峰|碳交易|碳市场|碳关税|碳捕集|CCUS' +
  '|绿氢|绿电|清洁能源|能源转型|可再生能源|气候(?:政策|协议|目标|大会)|COP\\s?\\d+|巴黎协定',
  'i'
);

// 地缘: wars, sanctions, diplomacy, elections, cross-border conflict.
const GEOPOLITICS_KEYWORDS = new RegExp(
  '\\b(' +
  // War & military
  'war|invasion|ceasefire|armistice|truce|occupation|annex|' +
  'airstrike|missile\\s+strike|drone\\s+strike|rocket\\s+attack|artillery|shelling|' +
  'military\\s+(?:operation|strike|drill|exercise|aid|buildup)|armed\\s+forces|' +
  'insurgent|insurgency|militant|militia|paramilitary|' +
  'warship|aircraft\\s+carrier|submarine|fighter\\s+jet|' +
  // Diplomacy
  'sanction(?:s|ed|ing)?|embargo|export\\s+control|' +
  'tariff(?:s)?|trade\\s+(?:war|dispute|deal|agreement|talks)|wto|' +
  'nato|un\\s+security\\s+council|un\\s+general\\s+assembly|icj|icc|' +
  'diplomacy|diplomat(?:ic)?|embassy|consulate|summit|bilateral|multilateral|g7|g20|brics|' +
  'border\\s+(?:clash|dispute|incident|tension|crossing)|' +
  'election|president-?elect|prime\\s+minister|white\\s+house|kremlin|pentagon|state\\s+department|' +
  'foreign\\s+minister|foreign\\s+ministry|' +
  'voices?\\s+concerns?|express(?:ed)?\\s+concerns?|concerns?\\s+over|' +
  'condemns?|condemn(?:ed|ation)|protests?|rall(?:y|ies)|riots?|unrest|' +
  'seize(?:d|s)?|seizure|detain(?:ed|s)?|detention|custody|' +
  'extradit(?:e|ion|ed)|deport(?:ed|ation)?|' +
  'summon(?:ed)?\\s+ambassador|recall(?:ed)?\\s+ambassador|expel(?:led)?|expulsion|persona\\s+non\\s+grata|' +
  'joint\\s+statement|communique|' +
  'espionage|spy(?:ing)?|intelligence\\s+(?:agency|service|officer)|mole|' +
  'disputed\\s+(?:territory|waters|borders?|region)|territorial\\s+(?:claim|waters|dispute)|airspace\\s+violation|' +
  // Regions & actors with strong geopolitical signal
  'israel(?:i)?|palestin(?:e|ian)|gaza|hamas|hezbollah|houthi|west\\s+bank|idf|' +
  'ukrain(?:e|ian)|russia(?:n)?|kyiv|moscow|putin|zelensky|kremlin|donbas|crimea|' +
  'china-?us|us-?china|taiwan\\s+strait|south\\s+china\\s+sea|senkaku|diaoyu|' +
  'north\\s+korea|dprk|kim\\s+jong-?un|nuclear\\s+test|icbm|' +
  'iran(?:ian)?|tehran|iaea|revolutionary\\s+guard|hormuz|red\\s+sea|' +
  'afghanistan|afghan|taliban|syria|assad|yemen|lebanon|hezbollah|turkey|erdo[gğ]an|egypt|' +
  'sudan|ethiopia|eritrea|somalia|libya|mali|niger|burkina\\s+faso|' +
  'venezuela|nicaragua|cuba|haiti|' +
  'myanmar|burma|junta|' +
  'belarus|lukashenko|moldova|georgia|armenia|azerbaijan|nagorno|kosovo|serbia|' +
  // Institutions & doctrine
  'coup|regime\\s+change|asylum|refugee|migrant\\s+caravan|humanitarian\\s+crisis|' +
  'genocide|ethnic\\s+cleansing|war\\s+crime|crimes?\\s+against\\s+humanity|' +
  'proxy\\s+war|cold\\s+war|arms\\s+race|nuclear\\s+proliferation|' +
  'hybrid\\s+warfare|cyber\\s+(?:attack|warfare|espionage)|disinformation\\s+campaign|' +
  'terror(?:ist|ism)|counter-?terror|hijack|kidnap|hostage|' +
  'geopolitic' +
  ')\\b' +
  // Chinese geopolitics vocabulary
  '|战争|武装冲突|冲突|停火|停战|休战|占领|侵略|吞并' +
  '|空袭|导弹(?:袭击)?|无人机(?:袭击)?|火箭弹|炮击|轰炸|军事行动|军演|联合军演' +
  '|叛军|武装分子|民兵|叛乱|叛变' +
  '|军舰|航母|航空母舰|潜艇|战机|战斗机' +
  '|制裁|禁令|出口管制|实体清单|关税|贸易战|贸易摩擦|贸易磋商|经贸磋商' +
  '|北约|联合国|安理会|国际法院|国际刑事法院|金砖|G7|G20' +
  '|外交|外交部|外交官|使馆|领事馆|峰会|双边|多边|斡旋|会谈' +
  '|边境|领海|领空|领土|主权|主权争议|水域争议' +
  '|大选|总统|首相|白宫|克里姆林|五角大楼|国务院|外长' +
  '|谴责|抗议|示威|动乱|内乱|暴动' +
  '|扣押|扣留|拘留|逮捕|引渡|遣返|驱逐|递解出境' +
  '|召见(?:大使)?|召回大使|驱逐大使|联合声明|公报|交涉' +
  '|间谍|谍报|情报机构|情报部门' +
  '|以色列|巴勒斯坦|加沙|哈马斯|真主党|胡塞|约旦河西岸' +
  '|乌克兰|俄罗斯|基辅|莫斯科|普京|泽连斯基|顿巴斯|克里米亚' +
  '|中美|台海|台湾海峡|南海|南中国海|钓鱼岛' +
  '|朝鲜|金正恩|核试验|洲际弹道导弹' +
  '|伊朗|德黑兰|革命卫队|霍尔木兹|红海' +
  '|阿富汗|塔利班|叙利亚|也门|黎巴嫩|土耳其|埃及' +
  '|苏丹|埃塞俄比亚|索马里|利比亚|马里|尼日尔|布基纳法索' +
  '|委内瑞拉|尼加拉瓜|古巴|海地' +
  '|缅甸|军政府|军方' +
  '|白俄罗斯|摩尔多瓦|格鲁吉亚|亚美尼亚|阿塞拜疆|纳卡|科索沃|塞尔维亚' +
  '|政变|政权更替|庇护|难民|人道主义危机' +
  '|种族灭绝|种族清洗|战争罪|反人类罪' +
  '|代理人战争|冷战|军备竞赛|核扩散' +
  '|混合战争|网络战|网络攻击|网络间谍|虚假信息' +
  '|恐怖主义|恐怖分子|反恐|劫持|绑架|人质' +
  '|地缘政治|地缘博弈',
  'i'
);

// 宏观: central banks, interest rates, inflation, GDP, fiscal policy.
const MACRO_KEYWORDS = new RegExp(
  '\\b(' +
  // Central banks
  'federal\\s+reserve|fed\\s+(?:chair|meeting|decision|rate|minutes)|fomc|jerome\\s+powell|' +
  'ecb|european\\s+central\\s+bank|christine\\s+lagarde|' +
  'bank\\s+of\\s+japan|boj|ueda|' +
  'bank\\s+of\\s+england|boe|bailey|' +
  'pboc|people.?s\\s+bank\\s+of\\s+china|' +
  'bank\\s+of\\s+korea|reserve\\s+bank\\s+of\\s+india|rbi|reserve\\s+bank\\s+of\\s+australia|rba|' +
  'swiss\\s+national\\s+bank|snb|bank\\s+of\\s+canada|boc|' +
  'central\\s+bank|' +
  // Rates & policy
  'interest\\s+rate|rate\\s+(?:cut|hike|decision|path|hold|pause)|dot\\s+plot|summary\\s+of\\s+economic\\s+projections|' +
  'policy\\s+rate|discount\\s+rate|repo\\s+rate|reverse\\s+repo|' +
  'monetary\\s+policy|fiscal\\s+policy|quantitative\\s+(?:easing|tightening)|qe|qt|' +
  'stimulus\\s+package|tax\\s+(?:reform|cut|hike|break)|' +
  // Price indices
  'inflation|cpi|ppi|pce|core\\s+(?:cpi|pce|inflation)|deflation|stagflation|disinflation|' +
  // Growth
  'gdp|gross\\s+domestic\\s+product|recession|expansion|contraction|slowdown|' +
  // Labor market
  'unemployment|jobless\\s+claims|non-?farm\\s+payroll|nfp|labor\\s+market|jolts|adp\\s+employment|' +
  'wage\\s+growth|labor\\s+force\\s+participation|' +
  // Trade & accounts
  'trade\\s+(?:deficit|surplus|balance|data)|current\\s+account|balance\\s+of\\s+payments|' +
  'budget\\s+deficit|national\\s+debt|debt\\s+ceiling|sovereign\\s+(?:debt|rating|downgrade|upgrade)|' +
  'credit\\s+rating|moody|fitch|s&p\\s+global|' +
  // Indicators
  'retail\\s+sales|industrial\\s+production|durable\\s+goods|housing\\s+starts|building\\s+permits|' +
  'consumer\\s+confidence|consumer\\s+sentiment|ism\\s+(?:manufacturing|services)|pmi\\s+(?:manufacturing|services|composite)|' +
  'capacity\\s+utilization|factory\\s+orders|' +
  // Currency & market context
  'yield\\s+curve|inversion|soft\\s+landing|hard\\s+landing|reflation|' +
  'dollar\\s+index|dxy|yuan|renminbi|rmb|yen|euro|pound\\s+sterling|swiss\\s+franc|' +
  // IMF / World Bank
  'imf|international\\s+monetary\\s+fund|world\\s+bank|oecd|davos|world\\s+economic\\s+forum' +
  ')\\b' +
  // Chinese macro vocabulary
  '|美联储|欧洲央行|欧央行|日本央行|日央行|英国央行|中国人民银行|人民银行|央行|韩国央行|印度央行|澳洲央行|瑞士央行' +
  '|利率|加息|降息|点阵图|议息|政策利率|贴现率|回购利率|逆回购|MLF|SLF|OMO|LPR' +
  '|通胀|通缩|滞胀|反通胀|CPI|PPI|PCE|核心(?:CPI|PCE|通胀)' +
  '|GDP|国内生产总值|经济衰退|经济扩张|经济放缓|经济复苏|软着陆|硬着陆' +
  '|货币政策|财政政策|量化宽松|量化紧缩|缩表|扩表|刺激计划|减税|增税|税改|减免' +
  '|失业(?:率)?|就业|非农|劳动力市场|劳动参与率|工资增长' +
  '|贸易(?:逆差|顺差|差额|数据)|经常账户|国际收支' +
  '|财政赤字|国债|地方债|债务上限|主权评级|主权债务' +
  '|评级下调|评级上调|穆迪|惠誉|标普全球' +
  '|社会消费品零售|社零|工业增加值|固定资产投资|社会融资规模|社融|新增社融|信贷' +
  '|M0|M1|M2|货币供应|基础货币|信贷增速' +
  '|PMI|官方PMI|财新PMI|制造业PMI|服务业PMI|综合PMI|非制造业' +
  '|进出口|外贸|海关数据|外汇储备|外储' +
  '|三驾马车|中央经济工作会议|经济工作会议|政府工作报告|两会' +
  '|IMF|国际货币基金|世界银行|经合组织|OECD|达沃斯' +
  '|收益率曲线|倒挂|美元指数|人民币|日元|欧元|英镑|瑞郎|宏观经济',
  'i'
);

// 市场: equities, fixed income, commodities markets, FX, crypto, IPO.
const MARKET_KEYWORDS = new RegExp(
  '\\b(' +
  // Broad market moves
  'stock\\s+(?:market|exchange|price|rally|plunge|crash|surge|slump)|' +
  'equity\\s+(?:market|rally|selloff)|' +
  // Indices
  'nasdaq|dow\\s+jones|dow\\s+industrial|s&p\\s*500|russell\\s*2000|russell\\s*1000|' +
  'hang\\s+seng|hsi|nikkei|topix|ftse|dax|cac\\s*40|stoxx|euro\\s+stoxx|ibex|mib|' +
  'csi\\s*300|csi\\s*500|shanghai\\s+composite|shenzhen\\s+component|star\\s+50|chinext|' +
  'kospi|sensex|nifty|bovespa|tsx|' +
  // Fixed income
  'bond\\s+(?:yield|market|auction|issuance)|treasur(?:y|ies)\\s+yield|treasury\\s+bond|gilt|bund|jgb|' +
  'credit\\s+(?:spread|default\\s+swap|cds)|high\\s+yield|junk\\s+bond|investment\\s+grade|' +
  // Funds & structures
  'etf|index\\s+fund|mutual\\s+fund|money\\s+market\\s+fund|' +
  'ipo|spac|direct\\s+listing|secondary\\s+listing|dual\\s+listing|de-?spac|' +
  // Crypto
  'cryptocurrency|crypto|bitcoin|btc|ethereum|eth|solana|stablecoin|usdt|usdc|tether|' +
  // Derivatives
  'futures|options|derivatives|swap|cds|covered\\s+call|put\\s+option|call\\s+option|' +
  // FX
  'forex|fx\\s+market|exchange\\s+rate|currency\\s+(?:peg|devaluation|intervention)|' +
  // Sentiment/moves
  'bullish|bearish|rally|sell-?off|correction|bear\\s+market|bull\\s+market|' +
  'flash\\s+crash|circuit\\s+breaker|trading\\s+halt|' +
  // Participants
  'hedge\\s+fund|mutual\\s+fund|portfolio|asset\\s+(?:manager|management|flow)|family\\s+office|' +
  'short\\s+(?:selling|squeeze|seller|interest)|margin\\s+call|leverage|' +
  // Corporate actions affecting stock
  'dividend|buyback|share\\s+repurchase|tender\\s+offer|secondary\\s+offering|' +
  // Volatility & metrics
  'volatility|vix|vxn|move\\s+index|' +
  'market\\s+cap(?:italization)?|market[-\\s]?cap|valuation|p/?e\\s+ratio|p/?b\\s+ratio|earnings\\s+multiple|eps|' +
  'trading\\s+volume|turnover|float|lock-?up|' +
  'insider\\s+(?:buying|selling)|activist\\s+stake|' +
  // Commodities markets
  'commodit(?:y|ies)|gold\\s+price|silver\\s+price|copper|iron\\s+ore|wheat|corn|soybean|cocoa|coffee|sugar' +
  ')\\b' +
  // Chinese market vocabulary
  '|股市|股票|股指|大盘|沪指|深指|创业板|科创板|北交所|港股|美股|A股|B股|H股|新股' +
  '|上证(?:指数|综指)?|深证(?:成指|综指)?|恒生(?:指数|科技)?|纳指|道琼斯|标普|日经|欧洲股指' +
  '|债市|国债|地方债|企业债|信用债|可转债|收益率|信用利差' +
  '|基金|公募|私募|ETF|指数基金|货币基金|货基|FOF' +
  '|IPO|上市|新股|破发|询价|询价区间|路演|配售' +
  '|比特币|以太坊|加密货币|稳定币|区块链资产' +
  '|期货|期权|衍生品|交易所' +
  '|外汇|汇率|贬值|升值|干预汇率' +
  '|牛市|熊市|震荡|反弹|抛售|回调|调整|闪崩|熔断' +
  '|对冲基金|资产管理|投资组合|家族办公室' +
  '|做空|做多|融资|融券|杠杆|爆仓|强平|两融' +
  '|股息|分红|回购|派息' +
  '|市值|估值|市盈率|市净率|PE|PB|EPS|股价' +
  '|成交量|成交额|日均成交|换手率|周转率|流通股|流通市值' +
  '|涨停|跌停|涨停板|跌停板|破发|破净' +
  '|增持|减持|大宗交易|解禁|限售|要约' +
  '|内幕交易|操纵市场' +
  '|商品|黄金|白银|铜|铁矿石|大豆|玉米|棉花|原油价格|咖啡|可可|糖',
  'i'
);

// 公司: earnings, M&A, executive changes, layoffs, lawsuits, bankruptcy.
const COMPANY_KEYWORDS = new RegExp(
  '\\b(' +
  // Earnings
  'earnings\\s+(?:report|call|season|beat|miss|release)|quarterly\\s+(?:results|earnings)|' +
  'q[1-4]\\s+(?:earnings|results|revenue)|' +
  'revenue\\s+(?:growth|miss|beat|decline)|net\\s+(?:income|loss|profit)|profit\\s+(?:margin|warning)|' +
  'guidance\\s+(?:raise|cut|beat|unchanged)|forecast\\s+(?:raise|cut)|' +
  // M&A
  'merger|acquisition|acquired|acquires|m&a|takeover|bid|buyout|lbo|going\\s+private|' +
  'spin-?off|divestiture|carve-?out|strategic\\s+review|' +
  'restructur(?:e|ing|ed)|reorganization|turnaround|' +
  // Workforce
  'layoff|job\\s+cuts|workforce\\s+reduction|downsizing|redundancy|' +
  'hiring\\s+freeze|headcount\\s+reduction|' +
  // Executives
  'ceo|chief\\s+executive|cfo|chief\\s+financial|coo|chief\\s+operating|cto|chief\\s+technology|' +
  'cmo|chief\\s+marketing|cpo|chief\\s+product|cio|chief\\s+information|' +
  'resign(?:s|ed|ation)?|step(?:s|ped)?\\s+down|appointed|named\\s+(?:new|as)|successor|succession|' +
  'board\\s+(?:of\\s+directors|member|seat|meeting)|chairman|chairwoman|' +
  'shareholder|stockholder|activist\\s+investor|proxy\\s+fight|' +
  // Distribution
  'buyback|share\\s+repurchase|dividend\\s+(?:cut|raise|announcement|hike|suspend)|special\\s+dividend|' +
  // Product/strategy
  'product\\s+launch|launch(?:ed|ing)?\\s+(?:new|its?|a|an)|unveil(?:ed|s)?|rollout|rolling\\s+out|' +
  'flagship\\s+(?:store|product|launch)|press\\s+event|product\\s+event|keynote|' +
  'market\\s+entry|enters?\\s+market|exits?\\s+market|launches?\\s+in|' +
  'opens?\\s+(?:store|office|factory|plant)|' +
  // Regulatory/legal
  'antitrust|monopoly|price\\s+fixing|cartel|regulatory\\s+(?:probe|crackdown|review)|' +
  'lawsuit|class\\s+action|settlement|fine|penalty|injunction|' +
  'bankruptcy|chapter\\s+11|chapter\\s+7|liquidation|insolvency|default|debt\\s+restructuring' +
  ')\\b' +
  // Chinese company vocabulary
  '|财报|年报|季报|半年报|业绩(?:报告|预告|快报)?|业绩说明会' +
  '|营收|营业收入|净利润|亏损|毛利率|净利率|毛利|净利' +
  '|业绩指引|盈利预测|下调(?:指引|预期)|上调(?:指引|预期)' +
  '|并购|收购|兼并|合并|要约收购|敌意收购|私有化' +
  '|分拆|剥离|出售|重组|改组|战略评估' +
  '|裁员|减员|优化|岗位调整|冻结招聘|缩编|人员优化|组织架构(?:调整)?' +
  '|CEO|首席执行官|CFO|首席财务官|COO|首席运营官|CTO|首席技术官|CMO|CPO|CIO' +
  '|董事长|董事会|副董事长|联席|总裁|总经理|副总裁|辞任|辞职|就任|继任|接任|离任|高管变动|人事变动' +
  '|股东(?:大会)?|大股东|控股股东|实控人|一致行动人|激进投资者|维权投资者' +
  '|回购|股息|分红|派息|特别分红' +
  '|产品发布|新品发布|发布会|新品|上新|旗舰(?:店|产品)|首发' +
  '|开业|关店|闭店|门店|扩张|扩店|新店|新工厂|投产' +
  '|进入(?:市场|中国|海外)|退出(?:市场|业务)|业务调整|战略(?:调整|升级|转型)' +
  '|反垄断|垄断|价格操纵|卡特尔|反垄断调查|监管调查' +
  '|诉讼|集体诉讼|和解|罚款|处罚|禁令|裁定' +
  '|破产|清算|重整|违约|暴雷|爆雷|债务重组',
  'i'
);

// 科技: tech catch-all (semiconductors, platforms, devices, cyber).
const TECH_KEYWORDS = new RegExp(
  '\\b(' +
  // Semiconductors
  'semiconductor|chip(?:maker|set)?|cpu|gpu|tpu|npu|soc|wafer|fab|foundry|' +
  'tsmc|samsung\\s+electronics|intel|nvidia|amd|arm\\s+holdings|broadcom|qualcomm|micron|sk\\s+hynix|' +
  'asml|applied\\s+materials|lam\\s+research|kla|tokyo\\s+electron|' +
  'lithography|euv|duv|3nm|2nm|5nm|7nm|' +
  // Devices & platforms
  'smartphone|iphone|ipad|android|pixel|samsung\\s+galaxy|huawei\\s+mate|vivo|oppo|xiaomi\\s+redmi|' +
  'apple|google|microsoft|meta\\s+(?:platforms|inc)|amazon|tesla|spacex|blue\\s+origin|' +
  'starlink|satellite|low\\s+earth\\s+orbit|starship|falcon\\s+9|' +
  // Cyber
  'cybersecurity|data\\s+breach|ransomware|hack(?:er)?|malware|phishing|zero-?day|exploit|' +
  'crowdstrike|palo\\s+alto\\s+networks|fortinet|cloudflare|' +
  // Cloud & platforms
  'cloud\\s+(?:computing|service|infrastructure|provider)|aws|azure|google\\s+cloud|gcp|alibaba\\s+cloud|' +
  'saas|iaas|paas|kubernetes|docker|' +
  // Apps & devs
  'platform|startup|unicorn|decacorn|' +
  'app\\s+store|play\\s+store|app\\s+launch|' +
  'software|operating\\s+system|kernel|open\\s+source|github|gitlab|linux|windows|macos|ios|' +
  'browser|chrome|firefox|safari|edge|' +
  // XR / metaverse / connectivity
  'vr|virtual\\s+reality|ar|augmented\\s+reality|xr|mixed\\s+reality|vision\\s+pro|apple\\s+vision|metaverse|' +
  '5g|6g|wifi|iot|internet\\s+of\\s+things|edge\\s+computing|' +
  // Deep tech
  'quantum\\s+(?:computing|supremacy|processor|chip)|' +
  'biotech|crispr|mrna|gene\\s+editing|synthetic\\s+biology|brain[-\\s]?computer\\s+interface|bci|neuralink|' +
  '3d\\s+printing|additive\\s+manufacturing' +
  ')\\b' +
  '|芯片|半导体|晶圆|晶圆厂|代工|流片|封测|光刻机|EUV|DUV|3纳米|2纳米|5纳米|7纳米' +
  '|台积电|三星电子|英伟达|英特尔|超微|高通|博通|美光|海力士|中芯国际|紫光展锐' +
  '|智能手机|手机厂商|手机厂|国产手机' +
  '|华为|小米|vivo|OPPO|荣耀|苹果|谷歌|微软|脸书|亚马逊|特斯拉|字节|字节跳动|阿里|腾讯|百度|京东|拼多多|美团' +
  '|星链|卫星|低轨|星舰|火箭回收' +
  '|网络安全|数据泄露|勒索|黑客|木马|漏洞|零日|APT' +
  '|云计算|云服务|华为云|阿里云|腾讯云|百度云|SaaS|PaaS|IaaS|容器|Kubernetes' +
  '|平台|创业公司|独角兽|十角兽' +
  '|应用商店|应用上架' +
  '|操作系统|鸿蒙|安卓|开源|Linux|内核' +
  '|浏览器' +
  '|虚拟现实|增强现实|混合现实|元宇宙|Vision Pro' +
  '|5G|6G|WiFi|物联网|边缘计算' +
  '|量子计算|量子芯片|量子(?:霸权|处理器)' +
  '|生物科技|基因编辑|mRNA|合成生物|脑机接口|神经链' +
  '|3D打印|增材制造',
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
