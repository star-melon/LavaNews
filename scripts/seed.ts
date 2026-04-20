// scripts/seed.ts — LavaNews data: 35 hand-crafted events only

import { prisma } from '../lib/db';

const CHANNELS = [
  { domain: 'reuters.com',   name: '路透社',   tier: 1, region: 'intl', hue: '#1B365D' },
  { domain: 'bloomberg.com',  name: '彭博',     tier: 1, region: 'intl', hue: '#0A0A0A' },
  { domain: 'ft.com',         name: 'FT中文',   tier: 1, region: 'intl', hue: '#990F3D' },
  { domain: 'wsj.com',        name: '华尔街日报', tier: 1, region: 'intl', hue: '#0E1F3C' },
  { domain: 'apnews.com',     name: '美联社',   tier: 1, region: 'intl', hue: '#B42025' },
  { domain: 'nytimes.com',    name: '纽约时报', tier: 1, region: 'intl', hue: '#1A1A1A' },
  { domain: 'economist.com',  name: '经济学人', tier: 1, region: 'intl', hue: '#E3120B' },
  { domain: 'xinhuanet.com',  name: '新华社',   tier: 1, region: 'cn',   hue: '#B42025' },
  { domain: 'caixin.com',     name: '财经',     tier: 2, region: 'cn',   hue: '#8B6A3E' },
  { domain: 'yicai.com',      name: '第一财经', tier: 2, region: 'cn',   hue: '#C8102E' },
  { domain: '21jingji.com',   name: '21世纪经济', tier: 2, region: 'cn', hue: '#0E4D92' },
  { domain: 'jiemian.com',    name: '界面新闻', tier: 2, region: 'cn',   hue: '#2B2B2B' },
  { domain: 'chinanews.com',  name: '华夏时报', tier: 2, region: 'cn',   hue: '#6B4E3B' },
  { domain: 'tmtpost.com',    name: 'TMTPost',  tier: 2, region: 'cn',   hue: '#2E5D8F' },
  { domain: 'lanj',           name: '蓝鲸财经', tier: 2, region: 'cn',   hue: '#1C6FA8' },
  { domain: 'sohu.com',       name: '搜狐财经', tier: 3, region: 'cn',   hue: '#D43F3F' },
  { domain: 'finance.sina.com.cn', name: '新浪财经', tier: 3, region: 'cn', hue: '#E63535' },
  { domain: 'money.163.com',  name: '网易财经', tier: 3, region: 'cn',   hue: '#C8102E' },
  { domain: 'finance.ifeng.com', name: '凤凰财经', tier: 3, region: 'cn', hue: '#9B1F1F' },
  { domain: 'stcn.com',       name: '证券时报', tier: 2, region: 'cn',   hue: '#0E4D92' },
  { domain: 'cnstock.com',    name: '上证报',   tier: 2, region: 'cn',   hue: '#8A1A2E' },
  { domain: 'nikkei.com',     name: '日经',     tier: 1, region: 'intl', hue: '#B42025' },
  { domain: 'theguardian.com',name: '卫报',     tier: 1, region: 'intl', hue: '#052962' },
  { domain: 'cnbc.com',       name: 'CNBC',     tier: 2, region: 'intl', hue: '#005594' },
];

interface EventDef {
  category: string;
  title: string;
  summary: string;
  backDate: string;
  channels: string[];
}

// 35 hand-crafted events
const HAND_EVENTS: EventDef[] = [
  { category: '宏观', title: '美联储维持利率不变，点阵图暗示年内两次降息', summary: '联邦公开市场委员会一致决定将联邦基金利率目标区间维持在 4.25%–4.50%，但最新经济预测显示多数委员预期年内降息两次，低于三月预测的三次。', backDate: '2026-04-18', channels: ['reuters.com','bloomberg.com','ft.com','wsj.com','apnews.com','nytimes.com','economist.com','xinhuanet.com','caixin.com','yicai.com','21jingji.com','jiemian.com','chinanews.com','tmtpost.com','lanj','sohu.com','finance.sina.com.cn','money.163.com','cnbc.com','nikkei.com','theguardian.com','cnstock.com','stcn.com'] },
  { category: '科技', title: '英伟达下一代 Rubin 架构推迟至 2027 年量产', summary: '据供应链消息人士透露，英伟达将其 Rubin 架构 GPU 的大规模量产计划推迟约两个季度，原因涉及 CoWoS 先进封装产能与 HBM4 良率问题。', backDate: '2026-04-15', channels: ['bloomberg.com','reuters.com','nikkei.com','wsj.com','ft.com','jiemian.com','yicai.com','21jingji.com','tmtpost.com','lanj','finance.sina.com.cn','sohu.com','caixin.com','cnbc.com'] },
  { category: '地缘', title: 'OPEC+ 意外延长减产协议至 2026 年四季度', summary: 'OPEC+ 周日举行的部长级会议决定将现行每日 220 万桶的自愿减产延长至 2026 年第四季度，市场原先预期仅延至年中。', backDate: '2026-04-10', channels: ['reuters.com','bloomberg.com','ft.com','wsj.com','apnews.com','nytimes.com','economist.com','xinhuanet.com','yicai.com','21jingji.com','cnbc.com','theguardian.com','nikkei.com','stcn.com','cnstock.com'] },
  { category: '市场', title: '恒生科技指数早盘涨逾 3%，南向资金净买入创月内新高', summary: '港股科技股全线走强，美团、快手、小米涨幅居前，南向资金净买入额达 148 亿港元。', backDate: '2026-04-08', channels: ['yicai.com','21jingji.com','caixin.com','stcn.com','cnstock.com','finance.sina.com.cn','sohu.com','finance.ifeng.com','jiemian.com','lanj','bloomberg.com','reuters.com'] },
  { category: '能源', title: '欧盟就 2040 年减排 90% 目标达成初步一致', summary: '欧盟环境部长会议在布鲁塞尔就 2040 年温室气体较 1990 年水平减排 90% 的中期目标达成政治共识。', backDate: '2026-03-25', channels: ['reuters.com','bloomberg.com','ft.com','economist.com','apnews.com','theguardian.com','xinhuanet.com','caixin.com','yicai.com','cnstock.com'] },
  { category: '科技', title: 'OpenAI 据悉以 5000 亿美元估值启动新一轮员工股份出售', summary: 'OpenAI 正在筹划一轮二级市场交易，员工可按 5000 亿美元估值出售手中股份，较上一轮 3000 亿美元估值大幅提升。', backDate: '2026-03-15', channels: ['bloomberg.com','reuters.com','wsj.com','ft.com','jiemian.com','tmtpost.com','yicai.com','lanj','finance.sina.com.cn'] },
  { category: '宏观', title: '日本 3 月核心 CPI 同比上涨 2.6%，高于市场预期', summary: '日本总务省公布的 3 月全国核心消费者物价指数同比上涨 2.6%，连续第 36 个月高于日本央行 2% 的目标。', backDate: '2026-03-08', channels: ['nikkei.com','reuters.com','bloomberg.com','ft.com','yicai.com','xinhuanet.com','caixin.com','21jingji.com'] },
  { category: '公司', title: '台积电 2 纳米试产良率据报已突破 60%', summary: '台积电位于新竹宝山的 2nm N2 工厂试产良率已在近期突破 60%，为年底量产奠定基础。', backDate: '2026-02-20', channels: ['nikkei.com','bloomberg.com','reuters.com','jiemian.com','tmtpost.com','yicai.com','lanj','caixin.com'] },
  { category: '地缘', title: '巴以停火协议第二阶段谈判延后至下周', summary: '调停方埃及与卡塔尔宣布，原定本周举行的第二阶段谈判因技术性分歧延后，但双方承诺停火继续生效。', backDate: '2026-02-10', channels: ['reuters.com','apnews.com','bloomberg.com','nytimes.com','ft.com','theguardian.com','xinhuanet.com'] },
  { category: '公司', title: '蔚来据悉考虑分拆能源业务独立上市', summary: '蔚来汽车正与多家投行接触，评估将其换电及储能资产分拆至香港独立上市的可能性。', backDate: '2026-01-22', channels: ['bloomberg.com','reuters.com','yicai.com','21jingji.com','caixin.com','jiemian.com','lanj','finance.sina.com.cn','sohu.com'] },
  { category: '公司', title: '特斯拉发布 2025 Q4 财报，交付量超预期，盘后涨 7%', summary: '特斯拉第四季度交付量达到 52.6 万辆，同比增长 19%，毛利率回升至 18.3%。', backDate: '2026-01-08', channels: ['bloomberg.com','reuters.com','cnbc.com','wsj.com','yicai.com','21jingji.com','jiemian.com','finance.sina.com.cn','sohu.com'] },
  { category: '公司', title: '苹果市值突破 4 万亿美元，成为首家跨越该门槛的公司', summary: '受 iPhone 17 销量强劲及 AI 功能落地预期推动，苹果股价盘中触及 280 美元，市值首次超过 4 万亿美元。', backDate: '2026-01-15', channels: ['bloomberg.com','reuters.com','nytimes.com','wsj.com','xinhuanet.com','yicai.com','caixin.com','21jingji.com','jiemian.com'] },
  { category: '科技', title: '全球汽车芯片再现短缺，台积电、三星产能紧张', summary: '受新能源汽车需求激增及地缘政治因素影响，全球车规 MCU 产能持续紧缺，多家 Tier 1 供应商发出预警。', backDate: '2026-01-25', channels: ['nikkei.com','bloomberg.com','reuters.com','ft.com','yicai.com','caixin.com','tmtpost.com','21jingji.com'] },
  { category: '宏观', title: '英国央行意外加息 25bp，市场普遍预期维持不变', summary: '英格兰银行货币政策委员会以 5 票对 4 票通过加息决定，将基准利率上调至 5.0%，令市场措手不及。', backDate: '2026-01-28', channels: ['reuters.com','bloomberg.com','ft.com','wsj.com','xinhuanet.com','caixin.com','yicai.com'] },
  { category: '宏观', title: '美国 CPI 数据回落至 2.3%，创 2021 年以来最低水平', summary: '美国劳工部数据显示 1 月 CPI 同比增长 2.3%，低于市场预期的 2.5%，核心 CPI 亦降至 2.9%。', backDate: '2026-02-05', channels: ['bloomberg.com','reuters.com','apnews.com','wsj.com','xinhuanet.com','yicai.com','caixin.com','21jingji.com','cnbc.com'] },
  { category: '地缘', title: '欧盟正式批准对中国电动车反补贴调查延期', summary: '欧盟委员会投票通过对中国进口电动汽车的反补贴关税延长一年，税率区间维持在 17.4% 至 35.3%。', backDate: '2026-02-18', channels: ['reuters.com','ft.com','bloomberg.com','xinhuanet.com','yicai.com','caixin.com','21jingji.com','jiemian.com','tmtpost.com'] },
  { category: '科技', title: 'SpaceX 星舰第五次试飞成功实现空中捕获回收', summary: 'SpaceX 在第五次综合试飞中使用机械臂成功捕获 Super Heavy 助推器，这是人类航天史上首次实现助推器空中回收。', backDate: '2026-02-25', channels: ['apnews.com','reuters.com','nytimes.com','bloomberg.com','theguardian.com','xinhuanet.com','yicai.com','tmtpost.com','sohu.com'] },
  { category: '科技', title: '微软发布新一代 Copilot Pro，支持全终端 AI 原生体验', summary: '微软在 Build 2026 开发者大会上宣布 Copilot Pro 重大升级，包括实时翻译、本地代码生成和 Office 原生 AI 嵌入。', backDate: '2026-03-03', channels: ['bloomberg.com','reuters.com','wsj.com','nytimes.com','tmtpost.com','yicai.com','jiemian.com','21jingji.com'] },
  { category: '市场', title: '黄金价格突破 2800 美元/盎司，再刷历史新高', summary: '受地缘政治风险及各国央行持续购金推动，现货黄金盘中触及 2805 美元，较年初上涨约 22%。', backDate: '2026-03-12', channels: ['reuters.com','bloomberg.com','ft.com','wsj.com','yicai.com','21jingji.com','caixin.com','stcn.com','cnstock.com','sohu.com'] },
  { category: '地缘', title: '中美经贸磋商重启，双方就关税议题交换意见', summary: '中美两国代表在北京举行新一轮经贸磋商，就部分商品关税削减、知识产权和技术转让等问题进行了深入讨论。', backDate: '2026-03-20', channels: ['reuters.com','bloomberg.com','apnews.com','wsj.com','xinhuanet.com','yicai.com','caixin.com','21jingji.com','ft.com','cnbc.com'] },
  { category: '公司', title: 'Meta 宣布年内第二轮裁员，约 3000 名员工受影响', summary: 'Meta 宣布将裁减约 3000 名员工，主要涉及现实实验室和广告业务部门。', backDate: '2026-03-28', channels: ['bloomberg.com','reuters.com','wsj.com','nytimes.com','tmtpost.com','yicai.com','jiemian.com','sohu.com'] },
  { category: '公司', title: '字节跳动估值上调至 3000 亿美元，IPO 预期升温', summary: '字节跳动在最新一轮内部股权转让中估值达到 3000 亿美元，市场对其港股 IPO 的预期持续升温。', backDate: '2026-04-02', channels: ['bloomberg.com','reuters.com','wsj.com','yicai.com','caixin.com','21jingji.com','tmtpost.com','lanj'] },
  { category: '市场', title: '比特币突破 15 万美元，机构加密基金大规模涌入', summary: '受美国现货比特币 ETF 资金持续流入及全球流动性宽松预期推动，比特币价格盘中触及 15.2 万美元历史新高。', backDate: '2026-04-05', channels: ['bloomberg.com','reuters.com','wsj.com','ft.com','yicai.com','caixin.com','21jingji.com','sohu.com','finance.sina.com.cn'] },
  { category: '地缘', title: '欧盟 AI 法案正式生效，全球首批 AI 监管框架落地', summary: '欧盟《人工智能法案》正式生效，对高风险 AI 系统实施分级监管，违规企业最高面临全球营收 7% 的罚款。', backDate: '2026-04-12', channels: ['reuters.com','ft.com','bloomberg.com','theguardian.com','wsj.com','xinhuanet.com','yicai.com','tmtpost.com','jiemian.com'] },
  { category: '科技', title: 'AMD 发布 MI500 加速卡，宣称单卡性能超越 H200', summary: 'AMD 在数据中心峰会正式发布 MI500 AI 加速器，采用 CDNA 4 架构，官方数据显示其推理性能较 H200 提升 40%。', backDate: '2026-04-20', channels: ['bloomberg.com','reuters.com','tmtpost.com','yicai.com','21jingji.com','sohu.com','jiemian.com'] },
  { category: '市场', title: 'A 股成交额突破 2 万亿元，券商板块集体涨停', summary: '沪深两市成交额时隔三个月再度突破 2 万亿元大关，中信、华泰等头部券商股价涨停。', backDate: '2026-01-18', channels: ['yicai.com','21jingji.com','caixin.com','stcn.com','cnstock.com','finance.sina.com.cn','sohu.com','jiemian.com'] },
  { category: '能源', title: '沙特阿美宣布上调 3 月亚洲原油官价', summary: '沙特阿美公布 2026 年 3 月阿拉伯轻质原油官价，较迪拜均价上调 1.8 美元/桶。', backDate: '2026-02-08', channels: ['reuters.com','bloomberg.com','ft.com','yicai.com','caixin.com','21jingji.com','cnstock.com'] },
  { category: '公司', title: '拼多多市值超越阿里巴巴，成中概股第二', summary: '受海外业务 Temu 高速增长推动，拼多多股价盘中大涨 12%，总市值突破 2100 亿美元。', backDate: '2026-02-28', channels: ['bloomberg.com','reuters.com','wsj.com','yicai.com','21jingji.com','caixin.com','jiemian.com','sohu.com','finance.sina.com.cn'] },
  { category: '宏观', title: '中国 1-2 月工业增加值同比增 7.2%，超出市场预期', summary: '国家统计局数据显示，中国 1-2 月规模以上工业增加值同比增长 7.2%，高于市场预期的 5.8%。', backDate: '2026-03-18', channels: ['xinhuanet.com','reuters.com','bloomberg.com','yicai.com','caixin.com','21jingji.com','stcn.com','cnstock.com'] },
  { category: '宏观', title: '日本央行结束负利率，日元汇率应声大涨 3%', summary: '日本央行宣布将政策利率从 -0.1% 上调至 0-0.1% 区间，正式结束长达八年的负利率政策。', backDate: '2026-01-30', channels: ['nikkei.com','reuters.com','bloomberg.com','ft.com','wsj.com','xinhuanet.com','yicai.com','caixin.com','21jingji.com'] },
  { category: '科技', title: '谷歌 DeepMind 发布 Gemini 3，多模态推理能力大幅提升', summary: 'Google DeepMind 发布新一代 Gemini 3 模型，在数学推理和长文本理解基准上超过 GPT-5。', backDate: '2026-03-05', channels: ['bloomberg.com','reuters.com','wsj.com','theguardian.com','tmtpost.com','yicai.com','jiemian.com','sohu.com'] },
  { category: '公司', title: '星巴克中国门店数量首超美国，达 17000 家', summary: '星巴克宣布其中国门店总数达到 17000 家，首次超越美国本土。', backDate: '2026-02-14', channels: ['bloomberg.com','reuters.com','yicai.com','21jingji.com','caixin.com','jiemian.com','sohu.com','finance.sina.com.cn'] },
  { category: '能源', title: '宁德时代发布钠离子电池 2.0，成本较锂电池降 40%', summary: '宁德时代正式推出第二代钠离子电池，能量密度达到 180Wh/kg，预计 2026 下半年量产。', backDate: '2026-04-06', channels: ['yicai.com','21jingji.com','caixin.com','tmtpost.com','bloomberg.com','reuters.com','jiemian.com','sohu.com'] },
  { category: '宏观', title: '欧元区 3 月 PMI 意外回升至 52.1，创 18 个月新高', summary: 'S&P Global 数据显示欧元区 3 月综合 PMI 初值升至 52.1，超出预期的 49.5。', backDate: '2026-03-22', channels: ['reuters.com','bloomberg.com','ft.com','wsj.com','xinhuanet.com','yicai.com','caixin.com','economist.com'] },
  { category: '科技', title: '华为发布鸿蒙原生应用生态计划，首批适配 5000 款应用', summary: '华为在 HDC 2026 大会上宣布鸿蒙原生应用生态全面升级，首批 5000 款头部应用完成适配。', backDate: '2026-01-12', channels: ['yicai.com','21jingji.com','tmtpost.com','jiemian.com','bloomberg.com','reuters.com','xinhuanet.com','sohu.com','finance.sina.com.cn'] },
];

async function main() {
  console.log('Seeding LavaNews database...');

  await prisma.timelineEvent.deleteMany();
  await prisma.article.deleteMany();
  await prisma.eventGroup.deleteMany();
  await prisma.channel.deleteMany();
  console.log('Cleared existing data.\n');

  const channelMap = new Map<string, string>();
  for (const ch of CHANNELS) {
    const record = await prisma.channel.upsert({
      where: { domain: ch.domain },
      update: ch,
      create: ch,
    });
    channelMap.set(ch.domain, record.id);
    console.log(`  Channel: ${ch.name} (${ch.domain}) T${ch.tier}`);
  }
  console.log(`\nCreated ${channelMap.size} channels\n`);

  for (const story of HAND_EVENTS) {
    const groupDate = new Date(story.backDate + 'T00:00:00');
    const group = await prisma.eventGroup.create({
      data: {
        representativeTitle: story.title,
        category: story.category,
        sourceCount: story.channels.length,
        articleCount: story.channels.length,
        firstSeenDisplay: groupDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        updatedMin: Math.floor(Math.random() * 200) + 5,
        firstSeen: groupDate,
        lastUpdated: groupDate,
      },
    });
    console.log(`  Event: ${story.title} (${story.channels.length} channels) — ${story.backDate}`);

    for (const domain of story.channels) {
      const chId = channelMap.get(domain);
      await prisma.article.create({
        data: {
          title: story.title,
          url: `https://${domain}/news/${story.title.slice(0, 20)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          source: domain,
          sourceName: CHANNELS.find(c => c.domain === domain)?.name || domain,
          summary: story.summary.slice(0, 300),
          imageUrl: '',
          publishedAt: groupDate,
          groupId: group.id,
          channelId: chId || null,
        },
      });
    }

    // Add 2-4 timeline events
    const shuffled = [...story.channels].sort(() => Math.random() - 0.5);
    const tlCount = Math.min(2 + Math.floor(Math.random() * 3), shuffled.length);
    for (let i = 0; i < tlCount; i++) {
      const chId = channelMap.get(shuffled[i]);
      if (!chId) continue;
      const ch = CHANNELS.find(c => c.domain === shuffled[i]);
      await prisma.timelineEvent.create({
        data: {
          groupId: group.id,
          channelId: chId,
          timeDisplay: groupDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
          note: `${ch?.name || shuffled[i]} 报道`,
          sortOrder: i,
        },
      });
    }
  }

  const groupCount = await prisma.eventGroup.count();
  const articleCount = await prisma.article.count();
  const timelineCount = await prisma.timelineEvent.count();

  console.log(`\nDone! ${groupCount} events, ${articleCount} articles, ${timelineCount} timeline events`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
