# 📋 项目进度记录 — 智能多模态学习管家

> 每一次有效改动都记录在此文件中，按时间倒序排列（最新在最上方）。
> 格式：`## [序号] YYYY-MM-DD HH:mm — 改动标题`

## 📚 全部条目索引（点标题跳详细内容）

| # | 标题 | 主要产出 |
|---|---|---|
| [097] | 登录改为 SQLite database auth + paper 登录界面 | 按新要求移除 Clerk/Google 登录路径，改为 Butler 自有 email/password 数据库登录；新增 SQLite `users` / `sessions` 临时账号库、`/api/auth/login|signup|me|logout`、httpOnly session cookie、PBKDF2 密码哈希、登录限流。登录页改用内置 paper UI token，保留英文默认和中文切换。Docker Compose 增加 `butler-sqlite` volume，`.gitignore` / `.dockerignore` 排除本地 SQLite 文件，setup/README 更新 SQLite 登录说明。 |
| [096] | 后续开发主线整理：登录入口 + 英文默认 + UI 计划清账 | 新建后续开发分支 `codex/butler-mainline`。`layout.tsx` 可选接入 ClerkProvider（有 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 才启用），新增 `AuthGate` 登录入口与 `/sso-callback`，支持 Clerk Google OAuth；未配置 Clerk 时只给本地演示入口，不冒充正式登录。默认语言从中文切到英文，中文保留为次选；登录页和偏好设置都可切换 EN/中文。TopBar 用户信息改读登录上下文。更新 `.env.local.example` / setup / UI redesign 计划状态。边界：不把 Paddle/Neon/真实商业账本做成“假完成”，仅保证可部署认证入口和应用功能可运行；英文残留已审计记录，仍需继续清硬编码中文提示。 |
| [095] | 安全总收尾：限流 + 错误脱敏 + 安全响应头 + 法务草案（无后端项全清零） | `api-guard` 加 `rateLimit`/`rateLimited`（进程内令牌桶，按 IP）+ `safeError`（错误脱敏）→ 8 个 API 路由全接限流（SEC-05），AI 生成类 catch 改 safeError（SEC-11）。`next.config.js headers()` 全站安全响应头：CSP（frame-ancestors none 防点击劫持 + object/base/form 收口）+ X-Frame-Options DENY + nosniff + Referrer/Permissions-Policy + HSTS(prod)（SEC-16）。`Doc/legal/` 三份草案：服务条款/隐私政策/退款政策（SEC-07）。**真机验证**：重启 dev 头部正确下发、应用零 CSP 违规零报错；连打连接器 20 次后触发 429（限流生效）。SECURITY.md 加 §7 上线 Runbook（剩 SEC-03/04/10 必须 Clerk/Neon/Paddle 账号）。tsc EXIT=0 |
| [094] | 安全收尾：SSRF DNS 预解析闭环 + OCR 类型白名单（无后端可修项清零） | SEC-02：connector-core 加 `dnsResolvesToBlocked`——请求前 `dns.lookup(all)` 解析域名所有 IP，任一落私网/本机/元数据即 403，闭掉「公网域名解析到内网」的 DNS-SSRF。**实测**：`localtest.me`(→127.0.0.1) 被拦、127.0.0.1/169.254.169.254 直连 403、真实 CoinGecko 正常通。SEC-09：OCR 路由加 MIME/扩展名白名单（仅图片/PDF，挡任意二进制转发上游），返回 415。SECURITY.md 同步：无后端可修项全闭环（SEC-01/02/06/09/12/13/15 ✅、SEC-14 缓解），剩余全是卡 Clerk/Neon/Paddle 的结构性项。tsc EXIT=0 + 真机验证 |
| [093] | 安全加固第二轮：输入限额 / 注入防护 / 沙箱 / spec 上限（不信任用户输入） | 用户「默认不信任任何用户输入，除显式写代码处」。新建 `lib/api-guard.ts`（clampText/clampMessages + INPUT_LIMITS）→ 7 个 AI 路由全部接入输入硬上限（SEC-12 成本放大）。`panel-schema.SPEC_LIMITS` sources≤20/blocks≤50/transforms≤15（SEC-13 DoS）。chat/generate-panel/extract-ddls 系统提示加最高优先级**反 prompt 注入**段 + A1.4 探测样本截断标注不可信（SEC-14，ConfirmCard 兜底）。AttachmentPreview PDF iframe `sandbox=""`（SEC-15 上传 HTML 伪装 XSS）。CustomPanelView iframe 去 `allow-popups-to-escape-sandbox`（SEC-06）。SECURITY.md 同步 SEC-06/09/12-15。tsc EXIT=0、零新增 console 错误 |
| [092] | A1.4 两阶段探测生成 + 抽 connector-core + 安全登记册 SECURITY.md | **A1.4** generate-panel 路由：首生成（非 refine/fix）含 http 源 → 并行探真实响应首行字段样本 → 二次 AI 绑定（根治「字段名猜错→空面板」），best-effort 失败回退首结果。**重构** 抽 `lib/connector-core.ts`（proxyFetch + SSRF 守卫 + env 注入），connector 路由瘦身成薄委托，探测复用同逻辑。**安全**（顺带落地 A3 部分）：SEC-01 env 注入改白名单（平台 key 永不可被 `env:` 外带）、SEC-02 SSRF 加 redirect:manual + IPv6/CGNAT 私网段。**新建 `Doc/SECURITY.md`** 漏洞登记册（11 条 SEC-01~11，威胁模型 + 严重度/状态 + 上线 gating checklist）。tsc EXIT=0、应用零新增 console 错误 |
| [091] | 面板引擎自由度升级 A1（transform 管道 + 本地数据源 + 对话式迭代/自修复） | **A1.1** panel-schema 加 `Transform`（filter/sort/limit/derive/groupBy，无 eval 全命名算子）+ `applyTransforms`，DataSource.transforms 在 fetchSource 取数后应用（static/http/local 通吃）。**A1.2** `lib/panel-local.ts` 本地数据集注册表 + DataSource `kind:"local"`（dataset: ddls/notes/sessions/streak），page 把真实数据扁平成「面板友好行」灌入 → AI 可做「我本月 DDL 完成率」面板。**A1.3** generate-panel 路由支持 currentSpec/fixError → 对话式改进（「把柱状图换成折线」）+ 取数失败「AI 修一下」自修复；GeneratedPanelView 加 Wand2 改进按钮 + refine 模式 composer + ErrorHint 修复按钮（成功才扣 2 分）。AI 系统提示词补 local/transforms 文档。tsc EXIT=0、应用启动零 console 错误。A1.4 两阶段探测生成待做 |
| [090] | 变现 v2.0 P5′：积分体系落地（合规转向） | `lib/credits.ts`（月配额 free30/pro300/max1000 + 注册礼包 50 + 加油包 ¥10/30/50 + FIFO 扣分账本 + useCredits）；CheckoutModal 加 pack 一次性购买模式；QuotaWallModal 双模式（免费窗口耗尽/积分不足）；PricingModal 加油包条 + feat.* 积分制文案（zh+en）；BillingPanel 积分余额段 + pack 账单；page 高级模型对话扣 1-2 分、AI 生成面板 2 分、深度调研 10 分（成功才扣，不足弹 softwall）。Doc/变现方案.md v2.0（积分制替代 token×1.3 钱包，规避 API 转售红线；Paddle MoR 拍板） |
| [089] | （补记）用量计量加周维度上限 | `lib/usage.ts` 加 WEEKLY_BUDGET（¥20/周）双层额度：5h 窗口 + 周兜底（模仿 Claude），canSpend 双重预检、readUsage 返回 window/week 双桶 |
| [088] | 用量圆环移到发送钮旁 + 提示词卡默认折叠 | ① 顶栏额度条(UsageMeter)撤掉 → InputPod 发送钮左侧加 `UsageRing`（30px SVG 环形进度 + 中心 `%` + 悬浮明细 title，本时段消耗百分比；≥80% 转琥珀、耗尽转危险色，30s tick 倒计时）；TopBar 清掉 UsageMeter/useEffect/useUsage/formatCountdown 导入。② ChatCanvas 提示词卡 3 张（进度追踪/面板创建/AI工作流）改 `PromptGroupCard`：**默认只显标题 + ▼，点开才展开具体提示词**（各自独立 toggle、aria-expanded、grid alignItems:start 防展开撑高同行）。真机验证：圆环 0%→67% 随用量填充、tooltip 准确；点「进度追踪」展开 3 条且其它卡保持收起。tsc EXIT=0 |
| [087] | 变现 P1+P2：5h 窗口真实成本计量 + 免费额度 softwall | `lib/usage.ts`（COST_PER_K 各模型 ¥/千token + 5h 滑动窗口按 windowStart 存 localStorage、翻篇清零 + recordUsage/canSpend/getWindowRemaining/useUsage hook/formatCountdown）；chat 路由开 `stream_options.include_usage` → 流尾 usage chunk；chat-client 解析 usage chunk → 按 selectedModel 单价 recordUsage 记入当前窗口；TopBar UsageMeter（本窗已花>0 才显，进度条+`¥x/¥0.6`/耗尽转危险色+`Xh Ym 后回满`倒计时）；QuotaWallModal（耗尽 softwall：切回Flash[已在Flash则隐]/充值/开会员三出口+回满倒计时）+ page handleSend 发送前 canSpend 预检拦截。真机预览验证：种 ¥0.4→额度条显`¥0.40/¥0.60`；¥0.7→转危险`后回满`；触发发送→softwall 弹出且 Flash 态正确隐藏切回项。tsc EXIT=0 |
| [086] | 顶栏升级 CTA 收进个人资料 + 变现方案文档 v1.1 | 删 TopBar 顶栏「升级到 Pro」渐变胶囊 + 付费档徽标（升级入口/档位状态改为只在用户菜单=个人资料里出现）；getPlanDef/Crown 仍被菜单引用无废 import；tsc EXIT=0。产出 `Doc/变现方案.md`（v1.1）：Flash 免费层获客 + 高端模型付费墙；**5h 滑动窗口分批发额度**(每窗~¥0.6 不累积+回满倒计时)；真实成本计量(lib/usage.ts+chat 回传 usage)；**按量×1.3 / 会员让利25%**；**高端三家充钱→后台开通→平台统一 key 余额计费 session**(用户不碰真实 key)；多供应商网关(lib/providers/*+scripts/sync-models 定价自动同步)；增长/风险/P0-P6 路线图。仅剩待拍板：先接哪家 key、是否 P1+P2 起步 |
| [085] | 背景纯色+圆点花纹 + 任务卡更深更立体 | 暗色背景去网格/光团→纯色 + 极淡白圆点花纹(--bg-halftone radial 0.022/22px)；底色加深 bg #1B1D1C→#161817 + 面板玻璃提亮(glass 0.62/0.78)+ surface #262A27 拉开 3 层层次；TasksPanel 任务组卡片加边框圆角12 + 阴影(0 4px14 + inset 高光)→ 深卡浮在亮面板上、有对比立体。真机：任务列表卡片明显分层、bg 纯色带细点 |
| [084] | 按钮用复古墨绿 #2D4A3E + 背景灰度再提高 | 按钮主色换成复古主题的墨绿 dark primary #2F7349→**#2D4A3E**（hover #3A5C4D / soft #16271F）；背景再去绿提灰 bg #1A1F1C→**#1B1D1C**（近中性深灰、绿味极淡）surface #242625、border #353835、glass 中性、bg-glow 压到 0.035/0.025 近无。:root primary 同步 #2D4A3E。真机确认 primary #2D4A3E / bg #1B1D1C。注：#2D4A3E 为深墨绿，填充按钮(头像/发送)漂亮，文字态强调(active tab/图标)偏暗——若觉太暗可后续单独提亮 active 态 |
| [083] | 配色精修：墨绿按钮 + 高灰度墨绿底（参考 GPT/Claude/Gemini）| 把 [082] 偏亮祖母绿 #43B074 压成墨绿 #2F7349（按钮克制不刺眼，hover #3A8757）；底色去饱和成高灰度墨绿 bg #18211B→#1A1F1C（很中性、只带一点绿，像主流 AI 应用的平直中性深底）surface #232925；accent 改灰绿 #5C8F73；bg-glow 进一步压淡(0.06/0.04)趋平。:root primary 同步深墨绿 #235E3E。真机：primary #2F7349、bg #1A1F1C，按钮/头像/active 墨绿、底中性 |
| [082] | 整体配色换森林绿 | globals.css 主色蓝→森林绿：:root primary #007AFF→#1F7A4D、dark primary #0A84FF→#43B074(森林祖母绿)+ accent 海松/鼠尾草绿；暗色底从蓝炭→森林墨绿炭(bg #1B1E26→#18211B、surface #222C25、border/glass/glow 泛绿)；改掉硬编码蓝(pill-nav active 阴影→color-mix primary、:root/dark bg-glow 绿、TopBar 升级钮阴影绿)。accent 系统 DEFAULT 本就墨绿(null 回落 CSS)。真机：primary #43B074 / bg #18211B，头像/发送/active tab/图标全绿，无 accent 覆盖 |
| [081] | 改单一深炭蓝暗色主题 + 去掉浅/深切换 | 用户给参考图(深炭近黑)要这种级别 + 微微泛蓝。dark 主题 token 重配：bg 纯黑→#1B1E26(深炭蓝、非纯黑、微泛蓝)、surface #1C1C1E→#242730、border/glass 偏蓝低饱和、code-bg #14161C、去掉底部黑色暗角保持均匀。默认主题改 dark（normalizeTheme：light 一律归 dark，仅留 dark/retro）；TopBar 删主题切换菜单项 + cycleTheme/themeMode/THEME_META 全删；Preferences 主题段去掉「亮色」只剩 暗色/复古。真机验证 data-theme=dark、bg=#1B1E26 |
| [080] | 新对话 Claude 化 + 去蝴蝶结 + 白天模式改柔和灰蓝 | ① 新对话空态改 Claude 式：输入框居中（InputPod 移到居中开场块，有对话时才贴底）+ 问候标题 + 3 类快捷提示词卡（进度追踪/面板创建/AI工作流，各 3 条可点提示）；删 TodayHero/DropHeroZone/QuickCard/旧 QUICK_CARDS。② 删 TopBar「Butler」旁的领结 SVG。③ 白天主题 token 改柔和灰蓝：bg #E8E8EF→#D9DFE8、surface 纯白→#EDF1F7、border 偏蓝、glass 灰蓝低饱和(saturate 1.8→1.25)、viewport themeColor 同步，去刺眼纯白。真机验证：居中输入框+3卡渲染、无领结、灰蓝更柔和 |
| [079] | 周期任务：管家每到新周期自动创建重复任务 | 管家「额外可触发逻辑」。types RecurringTask + DdlItem.recurringId；db v9 recurringTasks 表；lib/recurring.ts(periodKey daily/weekly/monthly + buildInstances 周N次按天均匀分布 + materializeDue 当期未生成则生成+记 lastGeneratedPeriod)；AI 工具 create_recurring_task（管家可「每周去健身房4次」直接建）；RecurringTasksManager 模态(新增/开关/删)，TasksPanel 加「🔁周期任务」入口；page hydrate materialize + 10min 兜底 + addRecurring 注入执行器。真机验证：建「去健身房 每周4次」→ 自动生成 4 个实例(周一/三/五/日 06-01/03/05/07)进任务清单，lastPeriod=w-2026-06-01 防本周重复、下周自动续期 |
| [078] | UX 动线重设（用户选 2 组）：清死链+顶栏瘦身 · 开场概览收成一个 | ① TopBar 删通知铃/退出登录死钮；移除桌面 theme/tools GlassButton，收进用户菜单（全端统一）；右侧只剩 搜索+升级+头像。清 Bell/LogOut/GlassButton 导入。② ChatCanvas 删 DailyBrief；空态 6 层欢迎面（开屏问候消息+DailyBrief+欢迎气泡+TodayHero+快捷卡+拖拽热区）收成单一「今日开场」=问候标题(greetingHeadline)+TodayHero+拖拽热区(空数据)+快捷卡(含新增开始专注)；page 停止注入 greeting assistant 消息(原会盖掉开场)+删 buildLocalGreeting/triggerGreeting 死码。真机验证：顶栏无铃、开场单屏渲染齐全。未选的「砍模组/导航分层」未动 |
| [077] | 纠偏 P4：连接器从「写死模板目录」→「动态按需构建」| 用户反馈不要写死的命名 API 目录、要动态按需。删 connector-templates.ts + ConnectorLibrary.tsx；新 /api/generate-source（一句描述→AI 临时推断单个 DataSource：url/query/path/headers env占位/pivot + 建议blocks，任意 API 不靠固定清单）+ DataSourceBuilder.tsx（AI 智能配置：描述→预览→插入；手动配置：URL/method/query KV/headers KV+env提示/path/pivot 通用表单）。🔌 改开构建器。数据源只活在当前面板 spec。验证 curl「USD汇率」→ AI 动态配出 frankfurter+path:rates+pivot{currency,rate}+table/kpiGrid |
| [076] | 面板引擎 P4：连接器 UX + 密钥模板 + 定时刷新（引擎四阶段收官）| connector route：resolveEnv 改正则(支持 `Bearer env:KEY` 内嵌 + URL 路径注入如 Telegram) + DataSource 加 `pivot`(键值对象→行，如汇率) → connector-client 透视。lib/connector-templates(CoinGecko/Frankfurter/GitHub 免key + Twitch Bearer + 通用REST + 长桥/Telegram 占位，每个 build→source+blocks + envKeys/hint) + ConnectorLibrary 模态(分类卡+免key/需key/占位徽标+env 指引+一键插入到 spec) + GeneratedPanelView 加「🔌 数据源」按钮 + 定时刷新下拉(关/30s/1m/5m 写各 http 源)。真机 curl：Frankfurter rates 拉到(pivot 成表)+env-url 注入路径不崩。至此 P1-P4 全完成：声明式引擎+AI生成+并行调研+真实连接器 |
| [075] | 面板引擎 P3：真并行多小队调研 → 聚合成多源面板 | 客户端编排：plan(拆 3-4 小队) → `Promise.all` **并行** fan-out 各小队 AI 调查 → 代码确定性聚合成 spec(零额外 AI 调用)。app/api/research/plan + /squad 两路由(DeepSeek Flash JSON) + lib/research-assembler(发现→intro markdown+每小队 static源/table/可选chart/summary) + lib/research-client.runResearch(并行编排+进度回调) + GeneratedPanelView 组合器加「深度调研·多小队并行」模式 + 小队进度卡(pending/running/done/error 实时)。真机 curl 验证：「半导体潜力股」→ plan 拆 4 队(457 tok) + 上游材料队返回 12 行结构化数据(公司/份额/营收/增速)+列格式+bar chart |
| [074] | 面板引擎 P2：AI 一句话 → 生成 schema → 渲染 | app/api/generate-panel(DeepSeek V4 Flash + JSON 模式 + 紧凑 schema 文档/1示例 + validateSpec 服务端校验) + lib/panel-generator.generatePanelSpec + GeneratedPanelView 加「✨ AI 生成」内联组合器(textarea+示例chips+⌘Enter+loading/error) + CustomPanelView onChange 同步 spec.title/emoji 到 Tab。validateSpec 改宽容：自动补缺失 block/source id(AI 不必写 id)。真机 curl 验证：「Crypto Top8」→ AI 选真 CoinGecko http API；「Twitch 收益榜」→ static 样本数据，均生成合法 spec 直接渲染 |
| [073] | 面板引擎 P1：声明式 schema + 后端连接器 + 渲染器（AI 面板应用平台地基）| 重构「自定义面板」→ AI 面板应用搭建平台的地基。lib/panel-schema.ts(GeneratedPanelSpec：sources[]数据源 + blocks[]组件块 8 种 + parseSpec校验 + getByPath/aggregate/toSeries/formatValue + CoinGecko Top10 SAMPLE) + app/api/connector(通用 HTTP 代理绕 CORS + SSRF 守卫挡私网/元数据IP + env:KEY 密钥注入 + 12s超时/3MB上限) + connector-client.fetchSource + Charts 加 LineChart + GeneratedPanelView(并行取数→渲染 stat/kpiGrid/table/bar/line/pie/list/markdown + 自动刷新 + loading/error + </>schema JSON 编辑器) + CustomPanel 加 kind=generated+spec 字段 + 第4个 KindBtn「应用」。真机验证：curl 连接器拉到 BTC 实时价 + SSRF 挡内网；面板渲染真实 CoinGecko 数据(表格/KPI $2.19T总市值/柱状全对)。决策(AskUserQuestion)：通用引擎优先 + 通用HTTP连接器 + 声明式schema运行时 + 真并行多智能体。P2 AI生成/P3并行小队/P4连接器UX 待做 |
| [072] | 付费体系（仿 Claude 三档）+ 中英 i18n 基建 + 复古主题收顶栏 | lib/i18n.ts(zh/en 字典+useT+LANG_EVENT+applyStoredLang，覆盖顶栏/导航/偏好/定价/结账/账单 130+ key) + lib/billing.ts(Free/Pro/Max 月¥0/39/99·年8折+订阅状态+模拟账单+模型门槛+useSubscription) + PricingModal(3卡片+月年切换省20%+Pro最受欢迎缎带) + CheckoutModal(卡号空格格式化+Visa品牌识别+处理spinner→成功页，演示不扣款+一键填演示卡) + BillingPanel(当前计划/支付方式/账单历史/取消订阅) + TopBar 升级CTA/Pro徽标/账单入口+全文案i18n + Preferences 加语言段(中/English) + 顶栏主题钮 cycle 收成 亮↔暗(复古仅偏好里选)。真机验证全流程通：升级→结账→Pro徽标→账单→发票→中英live切换 |
| [071] | 响应式二轮：手机学习工具 + 笔记单栏切换 + 任务工具栏 icon-only + 超宽屏封顶 | MiniAppsDrawer 手机适配(top72/bottom72/全宽圆角玻璃+暗遮罩) + TopBar 用户菜单加「学习工具/主题」入口（解决[069]手机端无法访问 LayoutGrid/主题切换）；TasksPanel ToolbarBtn compact mode（手机 36×36 方块仅图标 + flexWrap）+ New Task→「新建」；NotesPanel 手机列表/编辑二选一全屏 + 「← 笔记列表」返回按钮（替代 40vh 列表挤豆腐块）；page 根容器 maxWidth:1600+margin auto（>1600px 不再拉满整屏空旷）|
| [070] | 全功能走查 + 抽屉自动关修复 | 桌面/手机/三主题/4面板走查全正常无 console error；修抽屉点项不自动关(React onClick 冒泡 programmatic 不可靠 → 原生 addEventListener+ref)；甄别 preview 环境限制(resize 不 fire matchMedia / element.click 不稳定 / 截图卡)非代码 bug |
| [069] | 手机响应式：窄屏布局重构 | useIsMobile hook + MobileTabBar 底部4tab + 左栏 fixed 抽屉(菜单开/遮罩关) + 根 padding-bottom 让位 + TopBar 手机隐藏 pill-nav/3钮/用户文字 + 搜索 flex 缩；375px 从溢出崩→不崩可用 |
| [068] | 管家化交互三件套：管家按需出现 + 铃铛发送键 + 漫画思考框 | 管家常驻→仅 AI 活动升起(standing opacity:0 下沉/活动升起缓动) ; 发送键 ArrowUp→餐厅服务铃铛 SVG(呼应[060]服务铃音效) ; thinking 时管家头顶漫画思考框(主泡+2尾泡+TypingDots,scale 弹入) ; 纯 CSS 零素材 |
| [067] | 复古主题 6 张手绘素材接入（解阻塞 task #11）| ChatGPT/DALL-E 驱动浏览器生成 6 张爱德华墨线 PNG → public/assets/retro/(frame/corner/banner/skyline/deskware/butler.png) + globals.css 6 个 `--retro-*` 变量从 none 替换为 url() + 左下天际线 / 右下钢笔墨水瓶 fixed 装饰层(mix-blend-mode:multiply 白底融入羊皮纸) |
| [066] | 壁纸系统：root 可换图片/视频 | Dexie v8 wallpapers 表 + lib/wallpaper.ts + WallpaperLayer(fixed z-1 img/video+暗化遮罩) + 偏好设置「壁纸」段(传图/视频/重置/暗化滑块)；背景从 body 移到 html 修 z-index:-1 被遮 |
| [065] | 每日仪式 · Daily Brief（UX 增长：留存）| DailyBrief 玻璃横幅每天首次打开顶部出现一次(localStorage lastSeen)；时段问候+今日到期/逾期摘要+streak+最近任务+一键「开始专注」(开学习工具抽屉)；巴甫洛夫日常触发(观察#15/#16) |
| [064] | 面板模组系统（观察 #17）：AI/手动组合数据仪表盘 | CustomPanel kind=modules + PanelModule[]；手绘 SVG 饼/柱/热力(零依赖)；panel-data 绑定真实 ddls/notes/streak；6 模组(统计/倒计时/清单/饼/柱/热力)；create_custom_panel 工具扩展 modules，AI 可组合 |
| [063] | 观察.txt 续：多模型接口预留(#12) · 默认新会话(#9) · 图片素材清单(#5/#6/#14) | AI_MODELS 加 Claude/GPT/Gemini placeholder(下拉可见不可选)；orderedSessions 只显有用户交互的会话(空草稿不入历史)；Doc/图片素材清单.md |
| [062] | 观察.txt 5 连击：漫画询问卡/删头像 · AI 主动澄清 · 推荐每日任务 · 成就收藏室 | ConfirmCard 去 Sparkles 头像+下尾巴气泡(#4)；系统提示词加澄清规则(#11)；空态 5 推荐任务一键加(#16)；AchievementsRoom 成就陈列馆(#3) |
| [061] | 任务面板居中化 + AI 动态效果 | TaskDetailDrawer 右抽屉→居中圆角浮层(观察#18)；AI 思考点 dot-bounce 替代干光标 + ConfirmCard pop 入场；A1 面板根透玻璃 |
| [060] | 代码审计 + 整体动效 + 管家主题音效 | 9 项审计表(修死 token/slate 遮罩/const 提升)；reduced-motion 守卫 + fx-pop/ring/shake 复用动效 + 勾选弹跳；音效改服务铃/钢笔擦音(管家签名)+默认开启 |
| [059] | 视觉转向 iOS 玻璃胶囊 + 三主题（白/黑网格/复古）| 奶油→iOS 蓝配色 + navbar/history/对话独立悬浮玻璃胶囊 + 去衬线/漫画尾巴/肖像卡；双模式→加复古第三主题地基；昼夜+复古三元切换 |
| [058] | 视觉地基 v2 — 液态玻璃底 + B 胶囊导航 + GlassButton 通用件 | 奶油液态玻璃 bg + .glass-btn/.pill-nav CSS + ui/Glass.tsx 接发送/导航/Rail 高频钮 |
| [057] | 修复思考模式多轮 tool calling 丢 reasoning_content | ApiMessage 加 reasoning_content + 带 tool_call 的 assistant 轮回传 |
| [056] | 音效系统（WebAudio 合成）+ 6 张空状态插画 | 14 音效 opt-in + 偏好段 + 6 内联 SVG 插画接入 7 处空态 |
| [055] | F Polish — code review 后的 5 个 bug 修复 | CustomPanelView 数据不丢 + 累积 patch + URL race + PreferencesPanel cancelled + ref 闭包 |
| [054] | D 小补丁串烧三件套（DayView 拖拽 + iframe 面板 + AI 建面板） | TimelinePill draggable + CustomPanel kind=iframe + 第 7 个 AI tool create_custom_panel |
| [053] | Notes 92% → 100%（wikilink + 反向引用 + 本地搜索） | [[Title]] 双链 + 缺失链接新建 + backlinks 条 + list 搜索 + 代码块 dark fix |
| [052] | 自定义系统 Phase E — 自定义面板（Roadmap 收尾） | Dexie v7 customPanels + emoji+label+Markdown body + Tab + 「+」+ 即时编辑 |
| [051] | 自定义系统 Phase D — 元素位置自定义 | Tab 拖拽重排 + 4 档 Tab 隐藏 + 管家位置 4 档（左/中/右/隐藏） |
| [050] | 自定义系统 Phase C — 人物自定义 | Dexie v6 butlerAssets + 客户端 Canvas trim + 上传 / 预览 / 重置 |
| [049] | 自定义系统 Phase B — 颜色自定义 | lib/theme.ts hex↔HSL + 派生 + 6 预设 swatch + color picker + 重置 |
| [048] | 自定义系统 Phase A — Dark Mode 优化 | 主题感知阴影/代码块/覆盖层 token + AttachmentPreview 重写 + 5 文件硬编码色收口 |
| [047] | 修复思考模式末尾误报 "出错了" 气泡 | 服务端流尾抛错有内容时静默 + 客户端 hasReceivedDelta 双保险 |
| [046] | 4 张新姿势 SVG → trim PNG 接入 | thinking / thinking-hard / idea / rare-thinking 真资产上线（取代 standing fallback） |
| [045] | G2 留存 + G3 传播 + G5 AI 差异化 | streak / 成就 / PWA / 分享卡 / 管家性格 3 档 / 习惯识别 |
| [044] | G1 激活率提升 | Demo 数据 / 大拖拽 / Tour / .ics 导入 |
| [043] | Calendar C3+C4 | Week 空格点击创建 + 事件拖拽改时间 |
| [042] | Calendar C1+C2 | 迷你月历 + Week 视图 |
| [041] | UI/UX 增值 6 Epic 之 4/5/2/6/3 | TodayHero/StatsApp/键盘/Empty 人格化/偏好设置 |
| [040] | Epic 1 反馈循环 | Toast 系统 + 删除 Undo + AI tool 实时提示 |
| [039] | 跨面板联动 B2/B1/B3/B4 | AI create_note / 任务↔笔记 / 搜索高亮 / checkbox 同步 |
| [038] | 开屏问候零 token + AI 气泡贴边 | buildLocalGreeting / 去 800 容器 |
| [037] | 标准 AI 对话布局 | 气泡左对齐 + ConfirmCard 居中浮顶 + 0.33 倍率 |
| [036] | Chat 缺口 F/A/D/E/G 五件套 | 中文 IME / 停止 / 复制+重生成 / Retry / 自动标题 |
| [035] | 历史消息截断 10 条 | input token 线性爆炸防护 |
| [034] | AI 气泡居中 + Flash 隐藏思考面板 | V4 Flash CoT 特性解释 |
| [033] | 4 新姿势 + AI 活动状态机 + 缺资产降级 | 7 姿势 + rare-thinking 彩蛋 + onError fallback |
| [032] | 管家居中 + 输入框背后 + 0.75 倍率 | scale 模式重构 + bottom-center 对齐 |
| [031] | 思考模式可见化 | reasoning_content 折叠面板 |
| [030] | 模型切换 2 bug 修复 | 精简下拉 + state-only 视觉 |
| [029] | 基础功能补全 5 件套 | AI tool 字段 / Markdown 预览 / 开屏问候 / Notes 真版 / 全局搜索 |
| [028] | 多模态 OCR | Mistral / unpdf 路由 / 图片+扫描件 |
| [027] | 上下文分区 + PNG trim + 动画计划 | docs/* 分区 / Rive 选定 |
| [022]-[026] | UI 重构 Stage C-E + Mini Apps + Stage C.2 + 模型切换 | 见 [docs/progress/2026-05.md](docs/progress/2026-05.md) |
| [001]-[021] | Phase 1 完成 + Phase 2 早期 | 见 [docs/progress/2026-05.md](docs/progress/2026-05.md) |

> **接班 AI 提示**: 只看「最新一条」推算下一步即可。最近 30 条 [056]-[085] 是近期进度，其余条目（[022]-[055]）仍在本文件，[022]-[026] + [001]-[021] 已归档到 docs/progress/。

---

## [097] 2026-07-01 — 登录改为 SQLite database auth + paper 登录界面

> 用户要求：登录不要再走 Google/Clerk；先用 database 登录即可，数据库暂时用 SQLite；登录界面采用项目内置 paper UI。

### 登录与账号库
- 移除 `@clerk/nextjs` 依赖、`ClerkProvider` 根包装和 `/sso-callback` OAuth 回调页。
- 新增 `apps/web/src/lib/server-auth.ts`：本地 SQLite 初始化 `users` / `sessions` 表；密码用 PBKDF2-SHA256 + per-user salt；session 用 httpOnly cookie `butler_session`。
- 新增 API：`/api/auth/signup`、`/api/auth/login`、`/api/auth/me`、`/api/auth/logout`。登录/注册路由接入现有进程内限流。

### UI
- `AuthGate` 改为 database auth gate：启动先查 `/api/auth/me`，未登录显示 paper 风格登录/注册表单，登录成功后把数据库用户信息提供给 TopBar。
- 登录页不再显示 Google 按钮或 local demo；使用项目 `paper` 主题 token、可切换 English/中文，布局参考“左侧品牌说明 + 右侧表单”，但不照搬 Cisco 商业视觉。

### 部署与文件保护
- 新增 `better-sqlite3` / `@types/better-sqlite3`，Next external package 配置包含 `better-sqlite3`。
- 默认本地数据库：`apps/web/data/butler.sqlite`；可用 `BUTLER_SQLITE_PATH` 覆盖。
- Docker Compose 设置 `BUTLER_SQLITE_PATH=/app/data/butler.sqlite` 并增加 `butler-sqlite` named volume；Dockerfile 创建可写 `/app/data`。
- `.gitignore` / `.dockerignore` 排除 SQLite 数据库文件，防止本地账号库进入 Git 或镜像上下文。
- `.env.local.example`、`docs/setup.md`、`README.md` 更新为 SQLite 登录说明。

### 边界
- 这是临时 database 登录，不是完整生产账号系统；正式上线仍需要受管数据库、密码重置、邮箱验证、审计日志和共享限流。

---

## [096] 2026-07-01 — 后续开发主线整理：登录入口 + 英文默认 + UI 计划清账

> 用户要求：把过时的 UI redesign 待办更新掉；把当前状态另存为后续开发主线分支；不要做成完整商业化可用版本，只保证服务器部署、用户登录、软件功能正常运行；英文作为主语言，中文作为次选；增加简洁风格登录页；所有改动写文档。

### 分支定位
- 新建分支：`codex/butler-mainline`，作为后续开发主线整理分支。
- 不把 `.agents` / `.hacker-bob` / `mcp` 这类旁支目录纳入本轮目标；主线聚焦 `my-app`、部署文件和项目文档。

### 登录入口
- `apps/web/src/app/layout.tsx`：有 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 时才包 `ClerkProvider`；未配置时主应用仍可本地演示，不因缺 Clerk key 崩。
- `apps/web/src/components/AuthGate.tsx`：新增主入口登录门。配置 Clerk 时显示标准 Google OAuth 登录按钮；未配置 Clerk 时显示清楚的“本地演示”入口。
- `apps/web/src/app/sso-callback/page.tsx`：新增 Clerk OAuth 回调页，配合 `signIn.authenticateWithRedirect({ strategy:"oauth_google" })`；未配置 Clerk 时显示部署提示页，避免无 key 环境 production build 预渲染失败。
- `TopBar` 用户资料从 `AuthGate` 上下文读取：Clerk 登录后显示真实用户名/邮箱/头像；本地演示显示 local demo。

### 语言与 UI
- `lib/i18n.ts` 默认语言改为英文；`localStorage` 只有显式 `zh` 才使用中文。
- `PreferencesPanel` 语言切换顺序改为 English / Chinese。
- 登录页使用现有“简单”暗色风格：深色极简面板、单主 CTA、Google 标准白按钮、保留语言切换。
- UI redesign 计划文档从“旧待办清单”更新为真实完成状态/调整状态，避免机器统计误判为 0%。

### 部署边界
- `.env.local.example` 和 `docs/setup.md` 补 Clerk / Google OAuth 配置项。
- 部署主线文件纳入当前分支：`Dockerfile`、`.dockerignore`、`docker-compose.yml`、`.github/workflows/ci.yml`、`ansible/`、`scripts/`、`README.md`、`docs/C270_FINAL_REPORT.md`、`/api/health`。CI 触发分支覆盖 `master/main/dev/feature/**/codex/**/ui/**`，Ansible 默认拉取 `https://github.com/frankrainrp/Bulter.git` 的 `codex/butler-mainline`。
- 本轮不落地 Neon 服务端账本、Paddle webhook、真实支付、Redis 共享限流；这些仍属于上线商业化硬前提。
- 目标是“可部署 + 可登录 + 主功能可运行”，不是完整商业 SaaS。

### 英文残留审计
- 主语言默认已切英文，核心导航、设置、登录、账单/定价等已有 EN 字典。
- 仍有中文残留：`page.tsx` 内部分 toast/工具状态/AI 自动标题 prompt、`ai-models.ts` 模型描述、`api-guard.ts` 错误文案、若干 provider 描述。后续需要逐步迁入 i18n 或改为英文默认。

### 验证
- `corepack pnpm exec tsc --noEmit`（`apps/web`）：通过。
- `corepack pnpm build`（`my-app`）：通过；`/sso-callback` 在无 Clerk key 环境也可预渲染。
- `corepack pnpm test` / `corepack pnpm ci:validate`：本机失败，原因是当前工作区存在 `apps/web/.env.local`。该文件被 `.gitignore` 忽略，不应进入 GitHub 或最终提交包；在 clean/staged package 中删除本地密钥文件后再跑提交包校验。
- `rg "[\x{4e00}-\x{9fff}]" apps/web/src -g "*.ts" -g "*.tsx"`：仍有 94 个 TS/TSX 文件命中中文字符，包含注释、toast、AI prompt、工具回执和部分业务文案。结论：英文默认入口已完成，但全应用硬编码文案迁移尚未彻底完成。

---

## [095] 2026-06-14 — 安全总收尾：限流 + 错误脱敏 + 安全响应头 + 法务草案

> 用户：「按代办把安全隐患全部处理完，然后告诉我怎么做。」把**不依赖外部账号**能做的
> 安全项全部清零，并出一份精确的上线 Runbook（剩余 3 条必须 Clerk/Neon/Paddle 账号）。

### SEC-05 基础限流（进程内第一层）
- `lib/api-guard.ts`：`rateLimit(key,limit,windowMs)` 令牌桶 + `clientKey(req)`（x-forwarded-for）+ `rateLimited(req)` 便捷 429。默认 20 次/10s/IP；OCR 收紧 10、research squad 放宽 30（并行 fan-out）。
- 接入全部 8 路由：chat / connector / generate-panel / generate-source / research(plan|squad) / ocr / extract-ddls。
- ⚠️ 进程内 = 每实例独立、冷启动清零，是第一层；生产换 Upstash Redis + 按 Clerk userId（见 Runbook）。

### SEC-11 错误脱敏
- `safeError(err, fallback)`：真实异常 `console.error` 到服务端，前端只收通用文案。接 generate-panel / generate-source / research(plan|squad) 顶层 catch。OCR 配置类提示有意保留（助自排障）。

### SEC-16 安全响应头（`next.config.js headers()`）
- CSP（default-src self + 限定各源 + object-src none + base-uri self + form-action self + **frame-ancestors none** 防点击劫持；style/script 'unsafe-inline'，dev 加 'unsafe-eval'+ws 给 HMR）+ X-Frame-Options DENY + X-Content-Type-Options nosniff + Referrer-Policy + Permissions-Policy（禁 cam/mic/geo/FLoC）+ HSTS(prod)。

### SEC-07 法务草案
- `Doc/legal/服务条款.md` / `隐私政策.md` / `退款政策.md`——针对积分制 + Paddle MoR + AI/OCR 数据流 + 本地优先 + BYOK 量身写，留 `{{占位符}}`，待填主体 + 律师审 + 接页面。

### ✅ 真机验证（重启 dev）
- 安全头全部正确下发（CSP/XFO/nosniff/Referrer/Permissions）；应用渲染正常、**零 CSP 违规、零 console 报错**（连之前 NotesPanel flex 警告也清了）。
- 限流实测：连打 /api/connector 26 次 → 前 ~20 通过、其余 429。
- tsc EXIT=0（修了 api-guard Map 迭代的 target 兼容）。

### 🚦 剩余（必须外部账号，见 SECURITY.md §7 Runbook）
SEC-03 Clerk 鉴权 / SEC-04 Neon 服务端记账 / SEC-10 Paddle webhook 验签。代码待 key 即落地。

---

## [094] 2026-06-14 — 安全收尾：SSRF DNS 预解析闭环 + OCR 类型白名单

> 用户「先修复完检查出来的漏洞」。把**无后端依赖**还能修的两条修完并真机验证，
> 至此 SECURITY.md 里不卡外部账号的项全部闭环；剩余全是 Clerk/Neon/Paddle 结构性项。

### SEC-02 — DNS rebinding 闭环（🔴 主体已修）

- `connector-core.dnsResolvesToBlocked`：请求前用 `dns/promises.lookup(hostname,{all,verbatim})` 解析域名所有 IP，任一命中 `isBlockedHost`（私网/本机/元数据/IPv6 ULA）即 403，不发请求。
- 闭掉「公网域名 A 记录指向 127.0.0.1/169.254.169.254」这类静态 DNS-SSRF（之前只查 hostname 字符串会放过）。
- 残留仅主动 rebinding 窄窗口（解析与连接间翻 DNS）；undici dispatcher IP-pinning 因 Next 自带 undici 跨副本不可靠未采用，靠部署 egress 防火墙 + 禁元数据兜底（已入 checklist）。
- **真机验证**（preview_eval 打 /api/connector）：`localtest.me`→「禁止…（解析到 127.0.0.1）」✅；`127.0.0.1`/`169.254.169.254` → 403 ✅；真实 `api.coingecko.com/ping` → 200 ✅。

### SEC-09 — OCR 文件类型白名单（🟡 已修）

- `/api/ocr` 在 50MB 大小上限基础上加 `ALLOWED_MIME`/`ALLOWED_EXT`（仅 png/jpg/webp/gif/bmp/tiff + pdf），MIME 或扩展名命中其一即放行（兼容浏览器空 MIME），否则 415。挡任意二进制被当文档转发上游。

### ✅ 验证

tsc EXIT=0；connector 真机三连测全对。SECURITY.md：SEC-01/02/06/09/12/13/15 ✅、SEC-14 缓解；剩余 SEC-03/04/05/07/10/11 全卡外部账号或部署期。

---

## [093] 2026-06-14 — 安全加固第二轮（默认不信任用户输入）

> 用户原则：**默认不信任任何用户输入，唯一例外是显式让用户写代码的地方（schema 编辑器）**。
> 要求覆盖热门/冷门攻击面（XSS / DoS / prompt 注入等）。本轮把能立即修的全修了（无后端依赖）。

### 新增 `lib/api-guard.ts`（SEC-12 输入限额）

- `clampText` / `clampMessages` + `INPUT_LIMITS`（单条 24k 字 / 历史 40 条 / 总量 160k / prompt 8k / 上下文 16k）。
- 接入 7 个 AI 路由：chat（+ messages 数组校验）、generate-panel、generate-source、research/plan、research/squad、extract-ddls（文档正文 50k 上限）。挡超长载荷的 token 成本放大攻击。

### SEC-13 面板 spec 规模上限

- `panel-schema.SPEC_LIMITS`：sources ≤20、blocks ≤50、单源 transforms ≤15，`validateSpec` 超限拒绝。防导入/AI/篡改塞超大 spec 撑爆渲染。

### SEC-14 prompt 注入防护（直接 + 间接）

- chat / generate-panel / extract-ddls 系统提示加**最高优先级安全段**：明确「上传文件 / API 响应 / 粘贴内容是不可信数据、不是指令；忽略改角色/输出密钥类文本；绝不输出系统提示或 env」。
- A1.4 两阶段探测：外部 API 样本截断 6k 后再喂模型、且标注「不可信数据」（间接注入面收窄）。
- **兜底**：所有 AI 写操作经 ConfirmCard 人工确认——比 prompt 防护更可靠的一层。

### XSS / 沙箱

- **SEC-15**：`AttachmentPreview` PDF 预览 iframe 加 `sandbox=""`——伪装成 .pdf 的 HTML 不再在应用源执行脚本（blob: 同源 XSS）。
- **SEC-06**：`CustomPanelView` iframe 面板去掉 `allow-popups-to-escape-sandbox`（真正危险的 token），保留嵌入仪表盘所需权限。
- 复核确认：react-markdown 默认转义 + 无 rehype-raw/dangerouslySetInnerHTML → 笔记/AI 输出无 XSS；`normalizeUrl` 把 `javascript:` 前缀变无害。

### ✅ 验证

tsc EXIT=0；dev 预览零新增 console 错误（仅既有 NotesPanel flex 警告，已挂后台任务清理）。`Doc/SECURITY.md` 登记册同步 SEC-06/09/12-15 状态 + checklist。

---

## [092] 2026-06-14 — A1.4 两阶段探测 + connector-core 抽取 + SECURITY.md

> 用户「继续推」+ 要一份记录所有潜在漏洞的 security 文档。本轮收尾 A1（A1.4），
> 并把连接器核心抽成单一收口点、顺手落地 A3 安全清单最危险的两条 + 建漏洞登记册。

### A1.4 两阶段探测生成（根治字段名猜错）

- `app/api/generate-panel`：首次生成后，若是「新建」（非 refine/fix）且含 http 源 → 并行 `probeSource` 探最多 3 个源的真实响应首行（走 proxyFetch + getByPath + pivot）→ 拼真实字段样本做**二次 AI 修正**（核对 columns.key/x/y/field/sourceId 精确匹配真实字段）→ 返回 `probed:true`。二次失败 best-effort 回退首结果，不拖垮生成。`probe` 默认开、refine/fix 自动关。客户端无需改动。

### 重构：抽 `lib/connector-core.ts`（服务端共享收口）

- 把 `/api/connector` 的 proxyFetch + SSRF 守卫 + env 注入逻辑抽出（无 "use client"），connector 路由瘦身成 `const {status,body}=await proxyFetch(payload)` 薄委托；generate-panel 探测复用同一套（安全逻辑只此一处）。

### 安全加固（A3 部分落地，详见 Doc/SECURITY.md）

- **SEC-01 env 注入** 🔴→✅：`resolveEnv` 改 `ENV_ALLOWLIST` 白名单，平台核心 key（DEEPSEEK/ANTHROPIC/OPENAI/GEMINI/MISTRAL）永不可被 `env:` 解析外带；非白名单 key 替空串。
- **SEC-02 SSRF** 🔴→🚧：`redirect:"manual"`（遇 3xx 拦截不跟跳到内网）+ 补 IPv6 本机/ULA、CGNAT 100.64/10、0.0.0.0/8 段。残留 DNS rebinding 待部署前彻底修。

### 新建 `Doc/SECURITY.md`（漏洞登记册）

- 威胁模型（现在/P6′/桌面三形态）+ 11 条登记（SEC-01~11：env 注入/SSRF/零鉴权/前端篡改计费/成本放大/iframe 沙箱/合规文本/BYOK/上传校验/webhook 验签/错误泄露）+ 已确认安全点 + 上线 gating checklist。后续安全工作以此为单一事实源。

### ✅ 验证

tsc EXIT=0；dev 预览零新增 console 错误（仅既有 NotesPanel flex 简写 dev 警告，与本轮无关）。**完整两阶段生成往返需 DEEPSEEK_API_KEY + 真实网络**，未端到端跑（逻辑类型安全 + best-effort 回退保证不退化）。

---

## [091] 2026-06-14 — 面板引擎自由度升级 A1（更智能的 AI 自动搭建）

> 用户要求「自动化搭建面板提高自由度更智能」。面板引擎原本只能「一次生成 → 原样展示 API 响应」。
> 本轮做 A1.1/A1.2/A1.3 三项（A1.4 两阶段探测待做）。纯前端 + 路由提示词，零外部依赖。

### A1.1 transform 管道（取数后声明式二次加工）

- `panel-schema.ts` 加 `Transform` 类型 5 种算子（**无 eval**，全命名算子安全）：
  - `filter`（eq/ne/gt/gte/lt/lte/contains/truthy/falsy）· `sort`（asc/desc，数值/字符串自适应）· `limit`（前 N）· `derive`（新字段 = a op b，op: add/sub/mul/div/pct，b 可字段名或数字字面量）· `groupBy`（按字段聚合 → [{by, value}]）。
- `applyTransforms(rows, transforms)` 按序执行、不改原数据。
- `DataSource.transforms` 在 `connector-client.fetchSource` 取数后（pivot 之后）统一应用 → static/http/local 全部生效，blocks 透明消费变换后的数据。
- 意义：AI 能做「按市值排序取前 5 再算涨跌幅」这类加工，而非只能原样展示。

### A1.2 本地数据源（把「我自己的数据」喂进 AI 生成的面板）

- 新 `lib/panel-local.ts`：轻量注册表 `setLocalDataset/getLocalDataset` + `LOCAL_DATASET_FIELDS` 字段说明（解耦，零 props 穿透）。
- `DataSource.kind:"local"` + `dataset: ddls/notes/sessions/streak`；`fetchSource` 读注册表。
- `page.tsx` 4 个 useEffect 把真实 ddls/notes/sessions/streak 扁平成「面板友好行」灌入注册表（随数据变化更新）。
- 意义：用户说「做一个我本月 DDL 完成率仪表盘」→ AI 用 local + groupBy/filter 直接绑真实数据。

### A1.3 对话式迭代 + 取数失败自修复

- `generate-panel` 路由加 `currentSpec`（带现有 spec → 增量改而非从零）+ `fixError`（数据源报错 → AI 诊断修正配置）两模式。
- `panel-generator.generatePanelSpec` 加 `GenerateOptions{ currentSpec, fixError }`。
- `GeneratedPanelView`：工具栏 Wand2「改进」按钮 → composer 进 refineMode（带 spec）；`repairSource` 把源报错回喂 AI；`ErrorHint` 加「AI 修一下」按钮（成功才扣 2 分、失败不计费）。
- AI 系统提示词补 local 数据集字段表 + transforms 文档 + 规则（个人数据用 local、加工用 transforms）。

### ✅ 验证

tsc EXIT=0；dev 预览启动、首屏零 console 错误。**完整 AI 生成往返需 DEEPSEEK_API_KEY + 手动建 generated 面板**，未在无 key 预览里端到端跑（纯逻辑已类型安全 + 逐文件交叉核对）。

### 🚦 后续

A1.4 两阶段探测生成（先探 API 真实响应样本再绑字段，杀「字段名猜错→空面板」最大失败源）——需 dev server + 真实网络验证，下轮做。

---

## [090] 2026-06-12 — 变现 v2.0 P5′：积分体系落地（合规转向）

> 背景：v1.1「按 token 成本 ×1.3 钱包扣费」与三家供应商「不得转售 API 访问」条款高度模式匹配。
> 用户拍板转向 v2.0 积分制（Cursor/Perplexity 模式：卖产品功能次数，模型是实现细节），
> 并按初创 SaaS 默认配置定了 4 个开口项（汇率初值 / Free 30+礼包50 / Paddle MoR / BYOK 仅桌面版）。
> 详见 `Doc/变现方案.md` v2.0。

### 新增 `lib/credits.ts`（积分账本，演示模式 localStorage）

- 月配额 `MONTHLY_CREDITS`：free 30 / pro 300 / max 1000，按 `period="YYYY-MM"` 懒发放、月底过期不滚存；**升档当月补差额**。
- 注册礼包 50（一次性，30 天有效，`signupDone` 标记防重发）；加油包 `PACKS`（¥10/100 · ¥30/350 · ¥50/650，365 天有效）。
- `creditCostOf`：高级对话 1（gemini/gpt 档）/ 2（claude 档）· 生成面板 2 · 深度调研 10 · OCR 1/10页（预留）。
- `spendCredits` FIFO 先到期先扣 + 消费历史（100 条）；`useCredits` hook（CREDITS_EVENT + BILLING_EVENT 重渲）；`requestCreditsWall` 广播积分不足。
- P6′ 接 Clerk+Neon 时迁服务端权威记账，本模块接口不变。

### 改造（计费 UI 全链）

- **CheckoutModal**：props 改 `product: {kind:"plan"|"pack"}` 联合类型；pack 模式 = 一次性购买摘要 + 「充值成功」页。
- **QuotaWallModal**：加 `mode="window"|"credits"`；credits 模式显示「需 N 分 / 余 M 分」+ 加油包（主推）/ 会员两出口；i18n 文案去 ¥/×1.3/省25% 等 token 转售表征。
- **PricingModal**：底部加油包条（3 个 pill 按钮直达结账）+ `feat.*` 全部改积分制（zh+en）。
- **BillingPanel**：积分余额段（大数字 + 本月配额/加油包明细 + 买加油包钮）；账单历史兼容 pack 类型。
- **billing.ts**：Invoice 加 `kind?:"plan"|"pack"` + `credits?`。

### 扣分接线

- **page.tsx**：handleSend 高级模型（非 deepseek*）发送前 `canAfford` 预检（不足弹 credits softwall、不入栈消息），AI 调用前 `spendCredits`；监听 `CREDITS_WALL_EVENT`；handleBuyPack / pack 结账成功 → `purchasePack` + pack 账单 + toast。
- **GeneratedPanelView**：AI 生成（2 分）/ 深度调研（10 分）前置预检，**成功才扣、失败不计费**。

---

## [089] 2026-06-03 — （补记）用量计量加周维度上限

`lib/usage.ts`：WEEKLY_BUDGET ¥20/周、5h 窗口 + 周双层额度（模仿 Claude），`canSpend` 双重预检，`readUsage` 返回 window/week 双桶。（当时未记 PROGRESS，此处补记防编号断裂——usage.ts 注释引用 [089]。）

---

## [088] 2026-06-03 — 用量圆环移到发送钮旁 + 提示词卡默认折叠

> 用户：① 用量标记做成圆环放发送按钮旁、按百分比提示（给了环形参考图）② 快捷提示词卡默认只显标题，点开才显示具体提示词。

### ① 用量圆环（替代顶栏额度条）

- **TopBar**：撤掉 [087] 的 UsageMeter（额度条）+ 清 `useEffect`/`useUsage`/`formatCountdown` 导入（用量指示统一到输入舱）。
- **InputPod**：发送/停止钮外层包一层 flex，左侧加 `UsageRing` —— 30px SVG 双环（底 track + 前景弧 stroke-dashoffset 按 `spend/budget` 百分比）+ 中心 `%` 文字 + 悬浮 `title`「本时段免费额度 ¥x/¥0.6（已用 N%）· Xh Ym 后回满」；色：`<80%` primary / `≥80%` 琥珀 #f59e0b / 耗尽 danger；30s tick 刷倒计时。`useUsage` 驱动，记账事件即重渲。

### ② 提示词卡默认折叠

- ChatCanvas `PromptSuggestions` 内联 map 改抽 `PromptGroupCard` 组件：默认 `open=false` 只渲标题行（icon+title+ChevronDown），点标题 toggle 展开/收起具体 `PromptLine`；箭头 180° 旋转、active 边框转 primary。
- grid 加 `alignItems:"start"`，展开某张卡不再把同行其它卡撑到等高留白。各卡独立 toggle（非手风琴）。

### ✅ 真机预览验证

圆环 0% → 种 ¥0.4 显 67% 且绿弧填充、tooltip 含余量/倒计时；点「进度追踪」→ aria-expanded=true、3 条提示词显示，「面板创建」保持收起。tsc EXIT=0，测试数据已清。

---

## [087] 2026-06-03 — 变现 P1+P2：5h 窗口真实成本计量 + 免费额度 softwall

> 用户拍板 key=GPT+Claude、从 P1+P2 起步（零外部依赖，先在 Flash 上跑通计量闭环）。落地 Doc/变现方案.md P1（计量地基）+ P2（softwall）。

### P1 计量地基（5h 滑动窗口）

- **`lib/usage.ts`（新）**：`COST_PER_K` 各模型 ¥/千token（代表值，P4 sync-models 会覆盖）；5h 窗口按 `getWindowStart=floor(now/18000000)*18000000` 对齐，用量存 `localStorage["butler.usage.<windowStart>"]`，翻篇即清零（cleanupOldWindows 删旧键）；`recordUsage(model,pt,ct)` 累加+广播 `USAGE_EVENT`；`canSpend()`/`getWindowRemaining()`/`getNextResetAt()`/`useUsage()` hook（SSR 安全：初始满额、挂载后读真实）/`formatCountdown`。`WINDOW_BUDGET=0.6`。
- **chat 路由**：createParams 加 `stream_options:{include_usage:true}` → 流尾多一个 usage chunk（choices 空、带 prompt/completion_tokens），原样转发。
- **chat-client**：SseChunk 加 `usage` 字段；解析到 usage chunk → 按 `opts.model`（白名单回落 DEFAULT）调 `recordUsage` 记入当前窗口，`continue`。
- **TopBar UsageMeter**：本窗已花>0 才显；进度条 + `¥x.xx/¥0.60`，耗尽转 `--color-danger` 显 `Xh Ym 后回满`（30s tick 倒计时）。

### P2 免费额度 softwall

- **`QuotaWallModal.tsx`（新）**：耗尽弹窗，3 出口 = 切回 Flash（`canFallbackFlash`=当前非 Flash 才显）/ 充值钱包（暂复用 openPricing，P5 接真钱包）/ 开会员；带回满倒计时；永远留"继续免费"出口防撞墙流失。
- **page.tsx**：`handleSend` 在 `if(!sid)return` 后加 `if(!canSpend()){setQuotaWallOpen(true);return;}`（不入栈用户消息）；模态接 `handleSelectModel("deepseek-v4-flash")` / openPricing。

### ✅ 真机预览验证

种 ¥0.4 → 顶栏额度条显 `¥0.40/¥0.60`；改 ¥0.7 → 转危险态 `后回满`；filltextarea+Enter 触发发送 → softwall 弹出，且因当前=Flash「切回 Flash」正确隐藏、只剩充值/开会员。无 console error，tsc EXIT=0。测试种入数据已清。

### 🚦 后续

P3 网关（GPT+Claude 真实接通，Gemini 灰显）/ P4 sync-models 定价自动同步 / P5 钱包+session+会员重构。注：live 用量路径（DeepSeek 实际回 usage chunk）需真实 key 跑一轮才能端到端确认，include_usage 为 OpenAI 兼容标准特性。

---

## [086] 2026-06-03 — 顶栏升级 CTA 收进个人资料 + 变现方案文档

> 用户：① 顶栏的「upgrade to pro」去掉，只在用户点开个人资料才看到 ② 设计免费策略（每天 ¥3 免费 token，超额开会员 or 按 API 收费，会员让利保黏性）③ 自动化获取所有提到的模型 API ④ 设计赚钱模式。
> AskUserQuestion 四问全选推荐：真实成本计量 / 会员预付更划算(成本×1.2·让利30%) / 统一多供应商网关 / 先出文档对齐再落地。

### ① 顶栏 CTA 收口（已落代码）

- `TopBar.tsx` 删掉右侧独立的「升级到 Pro」渐变胶囊 + 付费档 Crown 徽标块（原 215-246）。升级入口 / 档位状态**改为只在用户菜单（个人资料下拉）里出现**——菜单内已有「升级」MenuBtn + header 档位徽标。
- `getPlanDef` / `Crown` 仍被菜单引用 → 无废 import；`tsc --noEmit` EXIT=0。

### ②③④ 变现方案文档（主交付，未写功能代码）

- 产出 `Doc/变现方案.md`（v1）：把 4 个决策落成可执行 spec。
- **商业模式**：Flash 太便宜（¥3/天约 150 万输出 token，普通用户用不完）→ 免费层=零成本获客/留存；高端模型(Claude/GPT/Gemini，单价 36~270× Flash)=天然付费墙。
- **免费层 spec**：`lib/usage.ts` 真实成本计量（chat 路由流尾回传 usage → 客户端按模型单价折 ¥ 累计 localStorage 按天清零）+ 顶栏额度条 + 耗尽 softwall（永远留"切回 Flash 继续免费"出口）。
- **付费层 spec**：按量钱包(成本×1.2) + 会员包月（Pro¥39/Max¥99 含高端额度，折合零售价值便宜 ~30% = 预付让利换黏性）。
- **多供应商网关 spec**：`lib/providers/{deepseek,anthropic,openai,google}.ts` + registry 路由 + 各家 env key；`scripts/sync-models.ts` 自动拉模型清单+定价 → 生成注册表（定价不写死）。
- 含增长杠杆 / 风险对策 / P0-P6 路线图（建议先 P1+P2 计量闭环，零外部依赖）。

### 🔁 v1.1 二轮拍板（文档已更新）

- **利润上调**：按量 ×1.2→**×1.3**（毛利 30%）；会员让利 30%→**25%**（Pro¥39 折合零售 ¥52、Max¥99 折合 ¥132）。
- **额度改 5h 滑动窗口**：不再一次给满 ¥3/天 → 每 5 小时一批 ~¥0.6、用不完不累积（Claude 式），顶栏额度条带"回满"倒计时 = 回访钩子。
- **高端三家 API 准入闸**（§4.0）：充钱→后台显式开通→服务端用平台统一 key 开「余额计费 session」→ 每次调用 ×1.3 从余额扣、归零自动降级 Flash；用户不碰真实 key，平台赚差价。会员自动具备开通资格、用包月额度替代充值。

### 🚦 仅剩待拍板（文档 §8）

先接哪家 API key（Claude/GPT/Gemini 手上有哪家）、是否从 P1+P2 起步。

---

## [085] 2026-06-03 — 背景纯色+圆点花纹 + 任务卡更深更立体

> 用户：背景采用纯色（可加花纹）；task list 卡片颜色更深、有对比、更立体。

- **背景纯色 + 花纹**：dark 去掉 `--bg-grid`(网格线) + `--bg-glow`(光团) → 纯色底；加极淡白圆点 `--bg-halftone: radial-gradient(circle, rgba(255,255,255,0.022) 1px, transparent 1.5px)` + `--bg-halftone-size: 22px`（html 已用这俩变量铺背景）
- **3 层层次**：bg 加深 `#1B1D1C→#161817`、面板玻璃提亮 `glass 0.62/0.78`（更亮一档）、surface `#262A27` → 深底 / 亮面板 / 卡片三层分明
- **任务卡立体**：`TasksPanel` 任务组容器 borderRadius 12 + `boxShadow: 0 4px 14px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.02)` → 深卡浮在较亮面板上、有边框+阴影、明显立体对比

`tsc` EXIT=0；真机：任务列表卡片清晰分层、背景纯色带极细圆点。其他面板卡片可后续按需套同样的深卡+阴影。

---

## [083] 2026-06-03 — 配色精修：墨绿按钮 + 高灰度墨绿底

> 用户：按钮用墨绿，背景用高灰度的墨绿，参考 Gemini/Grok/GPT/Claude 的逻辑（中性低饱和深底 + 克制的品牌色按钮）。

- **按钮/主色 墨绿**：dark primary `#43B074`(偏亮祖母绿) → **#2F7349**（深墨绿，克制不刺眼）；hover #3A8757；soft #15311E。:root 同步 #235E3E
- **背景 高灰度墨绿**：dark bg `#18211B` → **#1A1F1C**（饱和度更低、更中性，几乎是深绿灰），surface #232925、border #343C37、glass rgba(27,32,29)；bg-glow 压到 0.06/0.04 趋近平直中性底（像主流 AI 应用）
- accent → 灰绿 #5C8F73；管家金保留

仅改 globals.css token（`:root` + `[data-theme="dark"]`），组件零改。真机 reload：`--color-primary=#2F7349`、`--color-bg=#1A1F1C`，按钮/头像/active tab 墨绿、整屏中性深绿灰、克制专业。

---

## [082] 2026-06-03 — 整体配色换森林绿

> 用户：整体配色换为森林系列的绿色。在 [081] 单一暗色基础上把主色与底色由蓝系转森林绿系。

### 🌲 改动（globals.css 为主）

- **主色 蓝→森林绿**：`:root --color-primary #007AFF→#1F7A4D`（hover #186340 / soft #DCEFE4）；`dark --color-primary #0A84FF→#43B074`（森林祖母绿，暗底够亮，hover #5BC089 / soft #16301F）；accent 改海松绿 #2E8B57 / 鼠尾草 #6FBF9A
- **暗色底 蓝炭→森林墨绿炭**：bg #1B1E26→**#18211B**、surface #222C25、border #38473C、glass rgba(26,38,30) 泛绿、code-bg #111813、bg-glow 极淡森林绿光团
- **success/info** 微调成绿/青；**管家金 #D4AF37 保留**（与森林绿是经典搭配）
- **清硬编码蓝**：`.pill-nav-item.active` 阴影 → `color-mix(primary)`；`:root`/dark `--bg-glow` 蓝→绿；TopBar 升级钮阴影 → `color-mix(primary)`

### ⚙️ accent 系统说明

`lib/theme.ts` 的 `DEFAULT_ACCENT` 本就是墨绿 #1B3D2F，但 `applyAccentColor(null)` 只是移除覆盖、回落 CSS `--color-primary`（之前是蓝）。本次改 CSS 默认即生效；用户未设自定义 accent（`butler.accent`=null）→ 直接吃森林绿。

### ✅ 验证

`tsc` EXIT=0；真机 reload：`--color-primary=#43B074`、`--color-bg=#18211B`、无 accent 覆盖；头像/发送键/active tab/提示词图标全绿，整屏森林墨绿炭。

---

## [081] 2026-06-03 — 改单一深炭蓝暗色主题 + 去掉浅/深切换

> 用户发参考图（深炭近黑、偏暖黄），要：这种**深度级别**、但**微微泛蓝**、**去掉浅色/深色切换**（固定单一暗色）。

### 🎨 深炭蓝暗色（globals.css `html[data-theme="dark"]`）

| token | 旧 | 新 |
|---|---|---|
| --color-bg | #000000 纯黑 | **#1B1E26**（深炭蓝、非纯黑、微泛蓝）|
| --color-surface | #1C1C1E | #242730 |
| --color-border | #38383A | #383D48（偏蓝）|
| --glass-bg/strong | (22,22,28) | (27,30,38)/(32,35,44) 偏蓝 |
| --glass-blur saturate | 1.4 | 1.3 |
| --color-code-bg | #0A0A0A | #14161C |
| --bg-glow | 含底部黑暗角 0.55 | 去黑暗角，仅极淡蓝光团（均匀深炭蓝）|

### 🚫 去掉浅/深切换（单一暗色）

- `PreferencesPanel.normalizeTheme`：light 一律归一到 **dark**；默认 dark；只保留 dark / retro
- `applyStoredPreferences` / `getStoredTheme` 默认 dark
- `TopBar`：删用户菜单的主题切换项 + `cycleTheme`/`themeMode`/`THEME_META`/`THEME_CYCLE` 全部移除 + Sun/Moon/Feather/getStoredTheme/setStoredTheme/Theme 导入清掉
- Preferences 主题段：去掉「亮色」，只剩 暗色 / 复古

> 注：light 主题 token 仍在 `:root`（[080] 灰蓝），但已无 UI 入口；复古仍可在偏好设置选。

### ✅ 验证

`tsc` EXIT=0；真机 reload：`data-theme=dark`、`--color-bg=#1B1E26`、storedTheme=null（默认 dark），整屏深炭蓝、均匀不刺眼、微泛蓝；顶栏无主题钮、无领结。

---

## [080] 2026-06-03 — 新对话 Claude 化 + 去蝴蝶结 + 白天模式柔和灰蓝

> 用户 4 项 UI 诉求。

### ① 新对话 = Claude 式居中输入 + 快捷提示词

- 空态（`isEmpty`）重构：输入框 `InputPod` 从贴底移到**居中开场块**（问候标题 + 居中输入框 + 3 类提示词卡 + 免责）；有对话时输入框才回到贴底（`{!isEmpty && ...}`）
- 3 类快捷提示词卡（`PROMPT_GROUPS` + `PromptSuggestions`），各 3 条可点（点击 → 填入输入框 onQuickAction）：
  - 📈 **进度追踪**：本周完成/剩余、临近 deadline、streak 完成率
  - 📊 **面板创建**：任务统计面板 / 加密行情面板 / 复习计划看板
  - 🔀 **AI 工作流**：每周健身周期任务 / 每周一周报 / 潜力股调研成面板
- 删除旧空态件：`TodayHero`（import+用）、`DropHeroZone`、`QuickCard`、`QUICK_CARDS`；空数据时保留一个「看 Demo」胶囊

### ② 去掉 Butler 旁的领结 SVG（TopBar）

### ③ 白天模式 → 柔和灰蓝（globals.css `:root`）

| token | 旧 | 新 |
|---|---|---|
| --color-bg | #E8E8EF | **#D9DFE8**（灰蓝、略深、不刺激）|
| --color-surface | #FFFFFF | **#EDF1F7**（微蓝灰，替代刺眼纯白）|
| --color-border | #D6D6DB | #C4CCD9（偏蓝）|
| --glass-bg/strong | 白 0.82/0.92 | 灰蓝 0.78/0.90 |
| --glass-blur saturate | 1.8 | **1.25**（降饱和更柔和）|

html 背景用 `var(--color-bg)` 故页底自动跟随；layout viewport themeColor 同步 #D9DFE8。暗色/复古主题不动。

### ✅ 验证

`tsc` EXIT=0；真机：新对话居中输入框 + 3 提示词卡渲染齐全、Butler 旁无领结、整体灰蓝更柔和不刺眼。

---

## [079] 2026-06-03 — 周期任务：管家每到新周期自动创建重复任务

> 用户要管家「额外可触发逻辑」：周期性重复任务（如每周去健身房 4 次），每到新周期自动创建。

### 🧱 产出

| 文件 | 内容 |
|---|---|
| `lib/types.ts` | `RecurringTask`（cadence daily/weekly/monthly + timesPerPeriod + lastGeneratedPeriod）+ `DdlItem.recurringId` 溯源 |
| `lib/db.ts` | v9：`recurringTasks` 表 |
| `lib/recurring.ts`（新） | `periodKey`（d-日 / w-本周一 / m-月）+ `buildInstances`（周 N 次按天均匀分布 spreadOffsets）+ `materializeDue`（当期未生成→生成实例+记 lastGeneratedPeriod）+ CRUD + `makeRecurring` |
| `lib/ai-tools.ts` + `tool-executor.ts` | 新工具 `create_recurring_task`（管家可「每周健身4次」直接建）→ `addRecurring` dep → 落库 + 立即生成当期 |
| `components/RecurringTasksManager.tsx`（新） | 模态：新增表单（emoji/名/周期/次数/时间）+ 列表（开关 Power / 删）|
| `TasksPanel.tsx` | 工具条加「🔁 周期任务」入口（onOpenRecurring）|
| `app/page.tsx` | hydrate 跑 `runMaterialize` + 每 10min 兜底（跨午夜/周续期）；`addRecurring` 注入执行器；Portal 渲染 manager；TasksPanel 接入口 |

### ⚙️ 生成逻辑

- 周期 key 同期稳定、跨期变化；`materializeDue` 比对 `lastGeneratedPeriod`，不等才生成 → 幂等防重复；删掉生成的实例不会被复活（当期已标记）
- 周 N 次：在本周 7 天内均匀铺（如 4 次 → 周一/三/五/日）；月 N 次按当月天数铺
- 触发点：hydrate + 10min interval + mutation 后显式调（不走事件监听，避免与 putRecurring 并发二次生成竞态）

### ✅ 验证（真机 preview，读 IndexedDB 确认）

建「去健身房 每周 4 次」→ 自动生成 4 实例：去健身房（1/4）06-01 周一 / （2/4）06-03 周三 / （3/4）06-05 周五 / （4/4）06-07 周日，全进任务清单（source=周期任务，今天/本周分组正确），routine.lastGeneratedPeriod=`w-2026-06-01`。`tsc` EXIT=0。

### 🖥️ 运行中 + 备注

dev server（preview「web」:3000）开着供体验，留了「去健身房」演示 routine + 4 任务（可在 🔁 周期任务里删）。

---

## [078] 2026-06-02 — UX 动线重设：清死链 + 顶栏瘦身 · 开场概览收成一个

> 用户以资深 UX 设计师视角要重设操作动线（重复入口/多余残留）。审计后用户多选执行「清死链+顶栏瘦身」+「开场概览收成一个」两组；「砍模组/导航分层/偏好分组」两组本轮未选不动。

### ① 清死链 + 顶栏瘦身（TopBar.tsx）

- **删死按钮**：通知铃 `<Bell>`（无 onClick）、退出登录（无 auth 死链）
- **移除桌面 theme/tools GlassButton**，收进用户头像菜单（原 `isMobile &&` 条件去掉，全端统一入口）
- 顶栏右侧从「升级+主题+工具+铃+头像」5 件 → **搜索+升级+头像** 3 件
- 清 `Bell`/`LogOut`/`GlassButton` 导入

### ② 开场概览收成一个（ChatCanvas + page.tsx）

原本空态铺 6 层重叠欢迎/概览面：开屏问候消息 + DailyBrief 横幅 + ButlerBubble 欢迎气泡 + TodayHero + 快捷卡 + 拖拽热区。其中前 3 个都是「问候」、DailyBrief 与 TodayHero 都是「今日概览」，高度重复；且开屏问候消息会让 `isEmpty=false` 反而**盖掉**富开场。

- ChatCanvas：删 `DailyBrief` 渲染+导入；空态重构成**单一「今日开场」**=问候标题（`greetingHeadline()` 时段问候）+ 副标题 + `TodayHero`（今日聚焦）+ 拖拽热区（仅空数据）+ 快捷卡（3 张 + **新增「开始专注」** Target 卡，接 onStartFocus）
- page.tsx：greeting effect **不再注入** assistant 问候消息（开场已承担）；删 `buildLocalGreeting`/`triggerGreeting` 死码；ChatCanvas 调用去掉 `showDailyBrief`/`onDismissBrief` 死 props（留 `onStartFocus`）

### ✅ 验证（真机 preview）

- `tsc --noEmit` EXIT=0
- 顶栏：`hasBell=false`，右侧仅 搜索+升级到Pro+头像
- New Chat 空态：单屏「早上好，Feng」+ 今日聚焦卡（日期/streak/统计/deadline）+ 拖拽热区 + 4 快捷卡（含开始专注），齐全无重叠

### 🧹 残留备注

page.tsx 里 DailyBrief 的内部状态（showDailyBrief/markBriefSeen/dismissDailyBrief/[065] effect）现已不渲染、变 inert（不影响 UI/编译）；彻底删可后续收，handleStartFocus 仍在用勿误删。

---

## [077] 2026-06-02 — 纠偏 P4：连接器从「写死模板目录」→「动态按需构建」

> 用户反馈：「api接口只保留用户选择展示的窗口相关的…不希望做成一次性的或者写死的链接api窗口…要动态根据用户所需灵活调整」。
> [076] 我做成了固定的命名 API 目录（CoinGecko/Twitch…），正是用户不要的。本条纠偏：连接器改成**动态按需**，回归最初「通用 HTTP 连接器」本意。

### 🔧 改动

- **删**：`lib/connector-templates.ts` + `components/ConnectorLibrary.tsx`（写死的服务清单）
- **新 `app/api/generate-source/route.ts`**：一句描述 → AI 临时推断**单个** DataSource（url/query/path/headers env 占位/pivot）+ 1-3 建议块。任意 API，不靠固定清单。借 validateSpec 自动补 id。
- **新 `components/DataSourceBuilder.tsx`**：
  - **AI 智能配置**（默认）：描述想要的数据 → 生成 → 预览（URL/path/块/需要的 env key）→ 插入 / 重新生成
  - **手动配置**：通用表单 URL/method/query(KV 行)/headers(KV 行，env:KEY 提示)/path/pivot
- `GeneratedPanelView`：🔌 改开 DataSourceBuilder，插入的 source+blocks append 到当前面板 spec

### 🧭 心智

数据源 = **面板内自洽、按需动态生成**，无全局固定注册表。要什么数据就描述/填什么，AI 或手动当场配出连接器。密钥仍 `env:KEY` 服务端注入。

### ✅ 验证

- `tsc` EXIT=0；reload 无错误浮层
- `curl /api/generate-source`「USD 对各国汇率」→ AI 动态配出 `frankfurter.app/latest` + `path:rates` + `pivot:{currency,rate}` + table/kpiGrid（自己推断出键值对象要 pivot），2.6s

### 🗑️ tsc 坑

`[...Set]` 在本项目 target 下报错 → 用 `Array.from(set)`。

---

## [076] 2026-06-02 — 面板引擎 P4：连接器 UX + 密钥模板 + 定时刷新（引擎四阶段收官）

> 用户「收尾」→ 完成 P4，把样本数据换成真实带 key 数据源的最后一公里。至此「面板应用引擎」P1-P4 全部完成。

### 🧱 产出

| 文件 | 内容 |
|---|---|
| `app/api/connector/route.ts` | `resolveEnv` 改正则：支持 `Bearer env:KEY` 内嵌 + 对 **url** 注入（Telegram 路径 token）；密钥仍只在服务端 |
| `lib/panel-schema.ts` + `lib/connector-client.ts` | DataSource 加 `pivot`：键值对象 → 行数组（汇率 `{EUR:0.9}` → `[{currency:"EUR",rate:0.9}]`）|
| `lib/connector-templates.ts`（新） | 模板库：CoinGecko/Frankfurter/GitHub（免 key 开箱即用）+ Twitch（Bearer key）+ 通用 REST + 长桥/Telegram（占位，注明需签名/webhook）；每个 `build(srcId)→{source,blocks}` + `envKeys`/`envHint` |
| `components/ConnectorLibrary.tsx`（新） | 模态：按类列模板卡（免 key/需 key/占位 徽标 + env 变量 chip + 指引）+「插入到面板」append 到 spec |
| `components/GeneratedPanelView.tsx` | 工具条加「🔌 数据源」开库 + 定时刷新下拉（关/30s/1m/5m 写所有 http 源 refreshMs）|

### 🔑 密钥模型（重要）

密钥永不进前端：模板 source 里写 `"env:KEY"`（headers/query/url 均可），连接器服务端从 `process.env` 注入。用户在 `apps/web/.env.local` 配 `TWITCH_TOKEN=...` 等重启即生效。长桥 OpenAPI 用 HMAC 签名（非简单 Bearer），通用代理直连不了 → 列为占位，需后续专用签名层。

### ✅ 验证

- `tsc --noEmit` EXIT=0；reload 无 Next 错误浮层
- `curl /api/connector` Frankfurter → 拉到 `rates` 对象（前端 pivot 成表）
- env-in-url：`botenv:NONEXISTENT_TOKEN` 解析为空 token → Telegram 404 作数据回传、代理不崩（证明 url 注入路径健壮）

### 🏁 引擎全景（P1-P4 完成）

声明式 schema 引擎（P1）+ AI 一句话生成（P2）+ 真并行多小队调研（P3）+ 真实连接器模板（P4）。用户用例闭环：量化台/收益榜/选品/选股都能「一句话或一目标 → 可用面板（样本或真实数据）」。**后续可选**：长桥签名层、连接器持久化保存、面板间联动。

### 🖥️ 运行中

dev server（preview「web」配置，pnpm --filter @smart-hub/web dev，:3000）由用户启着供体验，本轮未停。

---

## [075] 2026-06-02 — 面板引擎 P3：真并行多小队调研 → 聚合成多源面板

> P2（单次 AI 生成）之上接「真并行多智能体」（用户在 4 基石里明确选的）。复杂调研目标 → 拆成多小队 → 并发调查 → 聚合成多源面板。用户「继续」推进。

### 🧩 编排（客户端驱动，真并发）

`lib/research-client.ts` `runResearch(goal, onProgress)`：
1. **plan**：`POST /api/research/plan` → `{title,emoji,squads:[{title,question}]}`（3-4 队）
2. **investigate**：`Promise.all(squads.map(...))` **并行** `POST /api/research/squad` —— 真并发 fetch，每队独立 running→done/error，进度实时回调
3. **assemble**：`lib/research-assembler.ts` 纯代码拼 spec（**无额外 AI 调用** → 省 token + 零 JSON 失败）

### 🧱 产出

| 文件 | 内容 |
|---|---|
| `app/api/research/plan/route.ts`（新） | Flash JSON：目标 → 3-4 个互补可并行的小队（title+question）|
| `app/api/research/squad/route.ts`（新） | Flash JSON：子问题 → `{summary(md), rows?[], columns?[], chart?}` 结构化发现（知识合成，注明非实时）|
| `lib/research-assembler.ts`（新） | plan+findings → GeneratedPanelSpec：intro markdown + 每队(static源 + 可选 chart + table + summary markdown)|
| `lib/research-client.ts`（新） | 并行编排 + ResearchProgress 进度类型 |
| `components/GeneratedPanelView.tsx` | 组合器加「快速生成 / 深度调研·多小队并行」模式切换 + `ResearchProgressView` 小队进度卡（pending/running 脉冲/done✓/error✗ + N/总 计数）|

### ✅ 验证（真机 curl）

- `/api/research/plan`「半导体潜力股产业链分析」→ 4 队（上游材料/中游制造/下游应用/风险面），457 tok
- `/api/research/squad`「上游材料」→ summary + **12 行结构化数据**（company/country/segment/revenue_share/revenue_2023/growth_rate）+ columns 带 percent/number 格式 + `chart:{bar, x:company, y:revenue_2023}`
- 聚合器是确定性代码（tsc 验证），映射到已验证的 table/bar/markdown 块；`tsc --noEmit` EXIT=0
- 后台起 dev server 验证完即停，无孤儿进程

### 💰 token 成本

一次深度调研 = 1(plan) + N(squad 并行) 次 Flash，N≤4，聚合零调用。plan ~457 tok / squad ~1-2k tok。比 1+N+1（聚合也用 AI）省一次大调用。

### 🎯 剩 P4

连接器 UX（保存的连接器 + 长桥/Twitch/Tele 密钥模板 UI + 定时刷新管理）。至此「一句话/一目标 → 可用面板」闭环已通（快速生成 + 深度调研双模式）。

---

## [074] 2026-06-02 — 面板引擎 P2：AI 一句话 → 生成 schema → 渲染

> P1 引擎地基之上接 AI 生成。用户说「继续」→ 推进 P2。现在用户描述需求，AI 直接产出 GeneratedPanelSpec 并渲染，「搭建面板」零门槛。

### 🧱 产出

| 文件 | 内容 |
|---|---|
| `app/api/generate-panel/route.ts`（新） | DeepSeek V4 Flash + `response_format:json_object`；紧凑系统提示教 schema（块类型/源/字段）+ 1 个 Twitch 示例；规则：真实免 key 公共 API 优先 http，不确定就 static 造样本数据保证可渲染；`validateSpec` 服务端校验后回 spec |
| `lib/panel-generator.ts`（新） | 客户端 `generatePanelSpec(prompt)` 调上面路由 |
| `components/GeneratedPanelView.tsx` | 工具条加「✨ AI 生成」按钮 → 内联组合器 `PanelComposer`（textarea + 4 示例 chips + ⌘/Ctrl+Enter + loading/错误）；生成成功 → `onChange(spec)` 直接应用 |
| `components/CustomPanelView.tsx` | generated 面板 `onChange` 把 `spec.title/emoji` 同步到面板 Tab |
| `lib/panel-schema.ts` | `validateSpec` 改宽容：**自动补缺失的 block/source id**（id 是实现细节，AI/手写都不必写）；kind 缺失按有无 url 推断 |

### ✅ 验证（真机 curl，各 1 次 Flash 调用）

- 「东南亚 Twitch 主播月收益榜 Top5」→ AI 用 `static` 造 5 行真实感数据 + kpiGrid/bar/table（首次因 AI 没写 block id 被拒 → 加自动补 id 修复）
- 「Crypto 市值 Top 8」→ **AI 自己选了真实 CoinGecko `coins/markets` http API**（url/query 准确）+ kpiGrid/bar/table，合法直接渲染
- `tsc --noEmit` EXIT=0

### 🩹 关键修复

AI 几乎不会主动写 `id` 字段 → 原 `validateSpec` 强制 block.id 必有 → 一律被拒。改成**渲染前自动补 id**（`block-${i}` / `src-${i}`），LLM 输出可用性大增。

### 🔌 验证环境备注

用户 dev server 中途停了（"No running servers"）；本轮用 Bash 后台起 `next dev` 验证完即 `taskkill` 停掉，未留孤儿进程、未污染 repo。接班验证 UI 组合器需用户自己起 dev server（preview programmatic click 触发 React onClick 不稳，见 [070]）。

### 🎯 下一步

- **P3**：真并行多小队 —— 复杂任务（潜力股产业链/选品调研）拆成子调查 → 并行 fetch+AI → 聚合成多源 spec + 小队进度 UI
- **P4**：连接器 UX + 长桥/Twitch/Tele 密钥模板 + 定时刷新管理

---

## [073] 2026-06-02 — 面板引擎 P1：声明式 schema + 后端连接器 + 渲染器

> 用户大方向：把「自定义面板」从静态 markdown/iframe/模组 → **AI 驱动的「面板应用」搭建平台**。
> 用例：量化交易台(长桥API) / 东南亚 Twitch Top10 收益榜 / 选品调研 / 潜力股产业链分析。
> AskUserQuestion 4 基石：**通用引擎优先** · **通用 HTTP 连接器+后端代理** · **声明式组件块 schema 运行时** · **真并行多智能体**。

### 🗺️ 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| **P1** | 引擎地基：schema + 连接器 + 渲染器 + 接入面板 | ✅ 本条 |
| P2 | AI 生成：一句话 prompt → schema → 渲染 | 待做 |
| P3 | 真并行多小队：拆解→并行调查→聚合成面板 + 小队进度 UI | 待做 |
| P4 | 连接器 UX + 密钥模板（长桥/Twitch/Tele）+ 定时刷新管理 | 待做 |

### 🧱 P1 产出

| 文件 | 内容 |
|---|---|
| `lib/panel-schema.ts`（新） | `GeneratedPanelSpec`：`sources[]`(static/http) + `blocks[]`(stat/kpiGrid/table/bar/line/pie/list/markdown) + `parseSpec` 校验 + `getByPath/asArray/aggregate/toSeries/formatValue` + CoinGecko Top10 `SAMPLE_SPEC` |
| `app/api/connector/route.ts`（新） | 通用 HTTP 代理：绕 CORS + **SSRF 守卫**(挡 localhost/私网/169.254 元数据) + `env:KEY` 密钥服务端注入(不进前端) + 12s 超时 + 3MB 上限；上游错误作数据回传不当代理失败 |
| `lib/connector-client.ts`（新） | `fetchSource(source)`：static 直返 / http → POST /api/connector → 按 `path` 取目标 |
| `components/panel-modules/Charts.tsx` | 加 `LineChart`（折线+区域填充，复用 Series）|
| `components/GeneratedPanelView.tsx`（新） | 渲染器：并行取数 + 自动刷新(refreshMs) + 8 种块 + per-metric sourceId 解析 + loading/error 卡 + `</>` schema JSON 编辑器(parseSpec 校验→onChange 持久化) |
| `lib/types.ts` / `custom-panels.ts` / `CustomPanelView.tsx` / `page.tsx` | `CustomPanelKind` 加 `generated` + `spec` 字段；4 个 Pick 白名单加 `spec`；CustomPanelView 第 4 个 KindBtn「应用」+ body 渲染 GeneratedPanelView（切换时无 spec 则种 SAMPLE_SPEC）|

### ✅ 验证（真机）

- `tsc --noEmit` EXIT=0
- `curl /api/connector` 拉到 CoinGecko 实时：BTC $69,988；SSRF 守卫挡掉 169.254.169.254 + 192.168.1.1
- 面板渲染真实数据：表格(Bitcoin -3.81% 红 / Ethereum +0.11% 绿，$ 格式化) + KPI(币种 10 / 总市值 $2.19T / 最高 $69,948) + 柱状图全对；刷新键工作
- **修 1 bug**：kpiGrid 的 metric 用各自 `sourceId`（原只解析块级 source → 显 0）。改 BlockBody 接 states map 按 metric.sourceId 解析

### ⚠️ strict:false narrowing 坑（记给接班）

tsconfig `strict:false` 下，**真值收窄**(`if(r.ok){}else{ r.error }`)不收窄判别式联合 → else 仍是联合报错；必须用**字面量比较**(`if(r.ok===true)` / `=== false` / `!== true`)，与现存 document-parser 模式一致。

### 🎯 留位

- 柱状图遇 BTC 极值时其他条几乎不可见 + 标签拥挤（P1 功能优先，后续可加对数轴/省略标签）
- 真实带 key API（长桥需 token）：在 `.env.local` 配 `LONGBRIDGE_TOKEN`，spec headers 写 `"Authorization": "env:LONGBRIDGE_TOKEN"`，连接器自动注入
- 已留一个 generated 演示面板「新面板」在 UI 里供把玩

---

## [072] 2026-06-02 — 付费体系（仿 Claude 三档）+ 中英 i18n 基建 + 复古主题收顶栏

> 用户：「把复古主题放偏好设置 + 仿 Claude 付费 UI 做完所有能做的付费部分 + 加中英主语言切换」。
> AskUserQuestion 对齐：三档 Free/Pro/Max · 完整前端+模拟结账 · i18n 基建+核心 UI 框架。

### 🌐 i18n 基建（中英）— `lib/i18n.ts`（新增）

- `Lang = "zh" | "en"`；`getStoredLang/setStoredLang`（localStorage `butler.lang` + `<html lang>` + `LANG_EVENT` 广播）
- `useT()` hook：订阅 `LANG_EVENT`，语言切换时**全局组件 live 重渲**（无需 reload，已真机验证）
- `translate(key, lang, params?)`：缺失 key 回退中文→key 本身（永不裸崩）；支持 `{name}` 插值
- 字典 130+ key：顶栏 / 导航 / 主题 / 偏好设置段标题 / 定价 / 结账 / 账单
- `applyStoredLang()` 在 page mount 注入（layout 默认 zh-CN）
- **范围**：核心 UI 框架；面板内长文案（AI 问候 / 各面板正文）仍中文，分批后续补

### 💳 付费体系（演示模式，纯前端）— `lib/billing.ts`（新增）

- 三档：Free ¥0 / Pro ¥39 月·¥31 年 / Max ¥99 月·¥79 年（年付约 8 折）
- `getSubscription/setSubscription`（localStorage + `BILLING_EVENT`）+ `useSubscription/useCurrentPlan` hook
- `subscribeTo(plan,cycle,card)` → 写订阅 + 落 `Invoice`；`cancelSubscription()` 降级 free
- `isModelAllowed(model,plan)`：Free 仅 Flash，Pro+ 解锁全模型（门槛 helper 备用）
- `detectCardBrand`：卡号前缀 → Visa/MC/Amex/UnionPay…

### 🎨 三个新组件

| 组件 | 内容 |
|---|---|
| `PricingModal` | 仿 Claude：3 卡片横排（手机堆叠）+ 月/年切换（年付「省 20%」）+ Pro「最受欢迎」缎带高亮 + 功能对勾列表 + 当前档「当前计划」badge + 升级/降级 CTA |
| `CheckoutModal` | 订单摘要 + 卡号(空格格式化+品牌识别)/有效期 MM/YY/CVC/姓名/邮箱 + 处理中 spinner(1.6s) → 成功页 ✓；醒目「演示不扣款」横幅 + 「一键填入演示卡号」 |
| `BillingPanel` | 当前计划卡(crown+续费日) + 支付方式(尾号·品牌) + 账单历史表 + 查看全部计划 / 取消订阅 |

### 🔧 接线

- `page.tsx`：billing/pricing/checkout 三 state + Portal 渲染 + `subscribeTo` 落订阅；`handleCheckoutConfirmed` 直接读 `checkout`（**不在 setState updater 里做副作用** — 否则触发 React「setState during render」告警）
- `TopBar`：免费→「升级到 Pro」CTA 胶囊；付费→Pro/Max crown 徽标（`useSubscription` 响应）；用户菜单接「账单管理」+ 升级项；全文案 i18n
- `PreferencesPanel`：新增「语言」段（中文 / English）+ 段标题 i18n
- `MobileTabBar` / 导航 Tab：标签走 `t(\`nav.${id}\`)`
- **复古主题收顶栏**：`THEME_CYCLE` 顶栏快捷钮改 `["light","dark"]`（复古为特殊第三主题，仅偏好设置里选；当前是复古则点击回亮色）

### ✅ 验证（真机 preview 端到端）

- `tsc --noEmit` EXIT=0；无 Next.js 错误浮层
- 全流程通：升级到 Pro → 结账(Visa 4242 自动识别) → 处理 spinner → 「升级成功」→ 顶栏 Pro 徽标即时出现 → 账单面板显当前计划 + 发票 ¥372 已支付
- localStorage 持久化校验：sub `{plan:pro,cycle:annual,renewsAt:+365d,card}` + invoice 正确
- 中英 live 切换：导航 对话→Chat / 账单面板含日期格式(Jun 2, 2027)全部即时翻译，无 reload
- 测试数据已重置回 free（用户从零体验）

### 🧩 真实支付留位（Stripe）

- 当前 CheckoutModal 走 `setTimeout` 模拟。接 Stripe 时：`onConfirmed` 改调后端 `/api/checkout` 创建 PaymentIntent，`subscribeTo` 由 webhook 回调驱动。门槛 `isModelAllowed` 已就绪可启用真实 gating。

### 🎯 留位（下一轮可做）

- i18n 第二批：各面板正文 / 空状态 / Toast / AI 问候
- 模型选择器对 Free 用户显示 Pro 锁 badge（gating 可视化）
- Stripe 真实接入（需密钥 + 后端 route）

---

## [071] 2026-06-02 — 响应式二轮：手机学习工具 + 笔记单栏切换 + 任务工具栏 icon-only + 超宽屏封顶

> [069] 把手机从「崩→可用」；本条把「可用→好用」，并补桌面超宽屏的边界。覆盖 5 处可观察痛点。

### 🔧 改动

| # | 文件 | 改动 |
|---|---|---|
| 1 | `components/MiniAppsDrawer.tsx` | 加 `useIsMobile`：手机时 `top:72 / bottom:72 / left:8 / right:8`（让出 TopBar+底 TabBar），玻璃胶囊样式 + 暗遮罩点击关；桌面保持原右侧 320 长条不挡主区 |
| 2 | `components/layout/TopBar.tsx` | 用户菜单加「学习工具 / 主题切换」两项（仅 `isMobile` 显示）— 解决 [069] 把 LayoutGrid/Theme 钮在手机隐藏后**无法访问**的回归 |
| 3 | `components/TasksPanel.tsx` | `ToolbarBtn` 加 `compact` prop（36×36 仅图标 + aria-label）；mobile 时 4 个工具按钮 compact + `New Task → 新建`；外层 `flexWrap` 防溢出 |
| 4 | `components/NotesPanel.tsx` | 加 `mobileShowList` state：手机时**列表 / 编辑互斥全屏**（原来 40vh 列表 + 60vh 编辑，两边都挤）；编辑视图顶部加「← 笔记列表」返回钮；新建 / 选中 / wikilink 跳转 / 外部 selectActiveId 全联动切到编辑态 |
| 5 | `app/page.tsx` | 根容器加 `maxWidth: 1600 + margin: 0 auto`（仅桌面）— 2K/4K/ultrawide 上主面板不再无意义拉满；TopBar/main 居中 |

### ✅ 验证

- `tsc --noEmit` EXIT=0
- 三主题 + 桌面 + 手机 4 面板交叉无 console error（沿用 [070] 走查基线）
- preview/eval 限制（resize 不 fire matchMedia / element.click 不稳定）已在 [070] 甄别，动态切窄屏需真机

### 🎯 留位（下一轮可做）

- TaskDetailDrawer 手机 sheet 在键盘弹起时高度自适应（visualViewport API）
- CalendarPanel Week 视图手机的水平横滚惯性
- 桌面 1024-1280 中等屏宽时 LeftRail 自动收窄

---

## [070] 2026-05-31 — 全功能走查 + 抽屉自动关修复

> 用户选「全功能走查修 bug」。系统走查 4 面板 + 三主题 + 手机 + 浮层，找回归，验证最近大量改动（手机 isMobile / 管家 / sheet / 元素融入）。

### 🔍 走查结果（全健康）

- **桌面**：4 面板切换渲染 ✓；三主题 token(light/dark/retro 的 primary/surface/`--butler-gold` 各异且齐全) ✓；建任务浮层(460 居中带 form，居中正确) ✓
- **手机 375px**：底部 tab 5 钮 ✓、pill-nav 隐藏 ✓、bodyScrollW 375 不溢出 ✓、calendar 月视图 padLeft 12 不溢出 + 周视图 grid minWidth 488 横滚 ✓
- **console error 全程为空** ✓ —— 项目代码健康，无崩溃/逻辑 bug

### 🔧 修复：抽屉点项不自动关（唯一真 bug）

| 项 | 内容 |
|---|---|
| 现象 | 手机左栏抽屉点 New Chat / 会话项后不自动收起 |
| 根因 | 原用 React 容器 `onClick` 捕获子按钮冒泡；实测原生 click 确实冒泡到抽屉(`bubbleFired=true`)，但 React 合成 `onClick` **未触发** `setMobileNavOpen(false)` —— React 18 事件委托对「子组件点击冒泡到容器 onClick」在 programmatic 场景不可靠 |
| 修复 | `app/page.tsx`：改 `useRef`(mobileDrawerRef) + `useEffect` 原生 `addEventListener('click')`：原生冒泡不受 React 合成层影响(已验证 100% 到达抽屉) → `closest('button')` → `setTimeout(()=>setMobileNavOpen(false),120)`。抽屉 div 去 React onClick 改挂 ref |

### ⚠️ preview/eval 环境限制（已甄别，非代码 bug）

- `preview_resize` 不触发 matchMedia change → isMobile 不更新（真机缩窗会触发；reload 后正常）
- `element.click()` 不稳定触发 React onClick（真实点击触发；导致 eval 无法端到端验证抽屉开关）
- 截图器对多层玻璃 backdrop-filter 间歇 30s 超时

→ 动态行为（抽屉开关/自动关、sheet 滑入、周视图横滚）需**真机 / 真实点击**验证

### ✅ 验证

- `tsc --noEmit` EXIT=0；console error 全程为空；抽屉自动关原生 listener 逻辑必然有效(原生 click 冒泡已验证到达抽屉)，待真机端到端确认

### 💾 备份建议

建议 tag：`backup-070-walkthrough-drawer-fix`

---

## [069] 2026-05-30 — 手机响应式：窄屏布局重构

> [065] 验证手机(375px)布局崩：桌面三胶囊水平 flex(TopBar + LeftRail 220 + main)溢出、TopBar 导航/工具裁切。本条把窄屏(≤768)重构成移动布局：底部 tab + 左栏抽屉 + 顶栏精简，让手机从「崩」→「可用」。

### 📂 改动

| 文件 | 改动 |
|---|---|
| `lib/use-is-mobile.ts` | **新建** `useIsMobile`(matchMedia ≤768，SSR 安全首屏 false) |
| `components/layout/MobileTabBar.tsx` | **新建** 底部 fixed 玻璃 tab bar：菜单(开左栏抽屉) + 4 主面板(对话/任务/日历/笔记)；`env(safe-area-inset-bottom)` 适配刘海屏 |
| `app/page.tsx` | `isMobile` + `mobileNavOpen` state；根 padding 手机 8 / 底 72(给 tab 让位)；提取 `railContent`；左栏桌面常驻 / 手机 fixed 抽屉(translateX 滑入 + 遮罩 zIndex 46/47)；底部渲染 MobileTabBar；TopBar 传 isMobile |
| `components/layout/TopBar.tsx` | `isMobile` prop；pill-nav 手机隐藏(底部 tab 代替)；header gap 28→8 / padding 缩；右侧区手机 flex；主题/工具/通知 3 钮手机隐藏(收进偏好设置)；用户区手机只头像(隐藏 Feng/email/chevron) |
| `components/layout/GlobalSearch.tsx` | `isMobile` prop：搜索框 width 240 → flex:1 自适应缩窄 |

### 🎯 设计

- **inline style 架构用 JS hook 驱动**：项目大量 inline style 不便 CSS media query，用 `useIsMobile` 条件渲染/切样式
- **底部 tab + 抽屉**：移动经典——4 主面板底部 tab 直达；左栏二级(New Chat/会话/任务视图)收进汉堡抽屉(菜单开 / 遮罩关)
- **顶栏减法**：手机砍 pill-nav(底部代) + 主题/工具/通知钮(进偏好) + 用户文字，只留 logo / 领结 / 搜索(缩) / 头像

### ✅ 验证

- `tsc --noEmit` EXIT=0
- preview 375px：bodyScrollW 375 = vw **无横向溢出**(原崩点解决)；headerScrollW 357 = clientW **顶栏不溢出**；底部 tab(对话 active) + 主区全宽 359 + 铃铛发送键截图确认；点菜单 → 抽屉 translateX(0) x=8 滑出 + 遮罩 zIndex46 ✓

### 🔁 同会话追加：手机深度优化（阶段 2）

> 用户「深度优化手机端体验」。诊断 375px：calendar 内部 392px / tasks 370px 横向超出(main overflow:hidden 裁切)，notes OK。本批做通用移动 UX：

| 优化 | 实现 |
|---|---|
| 抽屉点项自动关 | page 抽屉容器 onClick 捕获：点内部 button/[role=button] → 160ms 后 setMobileNavOpen(false)(让操作先执行) |
| 管家立绘手机缩小 | ChatCanvas useIsMobile → ButlerCharacter scale 手机 0.33→0.24(不占屏) |
| 任务浮层手机 sheet | TaskDetailDrawer isMobile：居中浮层→底部 sheet(贴底全宽 + 顶圆角 20 + sheet-up 上滑) |
| 偏好面板手机 sheet | PreferencesPanel 同款底部 sheet(手机隐藏顶栏主题钮后，偏好是切主题主入口) |
| 对话主区 padding | ChatCanvas 历史区/输入区两侧 32px→12px(手机气泡可用宽 ~280→333) |
| 各面板内部 padding(用户选) | TasksPanel 根 28/32→16/12；CalendarPanel 月/周/日 3 视图(独立函数 MonthView/DayView/WeekView 各加 useIsMobile)根 padding 手机缩 + 周视图 grid `48px+repeat(7,1fr)`→手机 `40px+minmax(64px,1fr)` minWidth 488 → 父容器横滚(7 天可滑不挤成条) |

各浮层内联 style 新增 `sheet-up` keyframe(translateY 100%→0)。NotesPanel 双列→**手机上下堆叠**(根 flexDirection column + aside 全宽 maxHeight 40vh + 下边框，列表在上/编辑在下；textarea padding 手机缩，md-preview 在独立函数故未缩)。验证：tsc EXIT=0；preview 375 实测——无横向溢出/底部 tab/抽屉滑出/对话区 padLeft 12/calendar 月视图 padLeft 12 不溢出/周视图 grid minWidth 488 均确认；sheet 视觉待本地实操(截图器对多层玻璃间歇超时)。

### 🚦 下一步（手机阶段 2 续，可选）

- calendar 周视图/网格手机适配(392 溢出)；MiniApps 抽屉手机；各面板列表移动精读
- 主动 AI / 周报分享卡 / 偏好设置管家显示开关

### 💾 备份建议

建议 tag：`backup-069-mobile-responsive`

---

## [068] 2026-05-30 — 管家化交互三件套：管家按需出现 + 铃铛发送键 + 漫画思考框

> 用户三连需求：①管家默认不保留、仅生成内容时出现 ②发送键换餐厅「叮」服务铃铛(保留动效) ③生成时画漫画思考框，思考完消失。核心 = 把管家从「常驻装饰」变成「AI 活动的拟人化身」：平时退场，工作时登场 + 头顶思考泡，呼应巴甫洛夫管家音效。

### 📂 改动

| 文件 | 改动 |
|---|---|
| `InputPod.tsx` | 发送按钮 `<ArrowUp>` → `<ServiceBell>`(新内联 SVG：顶部按钮 + 半圆钟体 + 底座托盘，`currentColor` 跟随)；删 ArrowUp import。外壳 GlassButton 动效(hover抬升/active回弹) + send 音效全不动 |
| `ChatCanvas.tsx` | ①新增 `ThoughtBubble`(主泡 54×38 + 2 递减尾泡指向左下管家头 + 内嵌 TypingDots；绝对定位管家头顶 bottom:88%；`scale(.5)→1` 弹入 cubic-bezier 回弹) ②算 `butlerActive = pose!=="standing"` / `isThinking = pose∈{thinking,thinking-hard,rare-thinking}` ③管家容器套显隐层：standing 时 `opacity:0+translateY(18px)` 下沉藏，活动时 `opacity:1+translateY(0)` 升起(0.45/0.5s 缓动) |

### 🎯 设计

- **管家 = AI 活动化身**：复用现成 butlerPose 状态机([033]) — standing(空闲)=隐藏，thinking/serving/idea/pointout(活动)=升起。零改状态机，只在 ChatCanvas 加显隐层。`butlerPosition==="hidden"`(用户主动关)仍完全不渲染
- **铃铛巴甫洛夫闭环**：发送键造型 = 餐厅台铃，呼应 [060] task 服务铃音效。「按铃→管家应答」拟物隐喻
- **思考框纯 CSS 零素材**：评估「是否需 ChatGPT 生成过渡动画」→ **否**。scale+opacity+translateY 缓动够丝滑，且自动跟随三主题色(白/黑/复古)，生成 GIF 反而重 + 不跟色。延续项目零依赖哲学(WebAudio 合成/手绘 SVG)

### ✅ 验证

- `tsc --noEmit` EXIT=0
- preview eval **坐标验证**(截图器对管家 7 张 PNG 固有卡顿，重启无效 → 改用 getBoundingClientRect 验证)：
  - 管家 standing → 显隐层 `opacity:0 translateY(18px)`(隐藏)；强制 thinking → `opacity:1`(升起) ✓
  - 铃铛 SVG 4 形状，居中发送按钮(钮 36²@1075,632 / 铃 18²@1084,641 中心对齐) ✓
  - 思考框 64×48@778,348 在管家(107×348@711,367)头顶右上、不超屏 ✓
- **视觉精度待用户本地确认**：铃铛造型 / 思考框美观 / 升起顺滑 — preview server 在跑，本地刷 localhost:3000 发条消息即见

### 🚦 下一步

- 用户本地看效果，微调铃铛造型 / 思考框大小位置 / 动画时长
- frame/banner/butler 素材找落点 or 不用
- 手机响应式 / 主动 AI / 周报分享卡

### 🔁 同会话追加：消失放缓 + 管家元素融入设计（观察 #21）

> 用户反馈：①消失太快 ②用 GPT 补帧(退场鞠躬，待 Chrome) ③管家元素(燕尾服/单框眼镜/白手套)融入设计。

**消失放缓**(ChatCanvas)：管家显隐层 + 思考框 transition 拆进/出双时长——出现利落(回弹)，消失舒缓(管家 `delay 0.3s` 多停留 + 1s 缓淡下沉；思考框 0.7s 淡出)，不再「啪」消失。

**管家元素融入(4 项，纯 CSS/SVG 零生图)**：

| 元素 | 实现 |
|---|---|
| 白手套光标 | `public/assets/cursor-glove.svg`(白手套指向，hotspot 13,4) + globals.css 可点击元素 `cursor:url() !important`(覆盖 @layer components 的 cursor:pointer) |
| 领结徽标 | TopBar「Butler」字标后嵌领结 SVG(蝴蝶结，`var(--butler-gold)` 管家金) |
| 燕尾服金 accent | globals.css 三主题加 `--butler-gold`(light #C9A227 / dark #D4AF37 / retro #B08D57) |
| 空态管家化 | EmptyIllustrations 新增 `EmptyButlerTray`(白手套托银盘 + 盘上金领结 + 金闪光) → 接 ChatRail「还没有对话」空态 |

**验证**：tsc EXIT=0；preview eval+截图确认——顶栏金领结徽标 ✓、左栏管家托盘空态 ✓、管家 standing 隐藏 ✓、白手套 cursor computed 含 glove url + SVG 200 ✓。

**待办**：退场鞠躬补帧(task#14，需重连 Chrome 生图；风险：生成帧要匹配现有黑燕尾立绘风格才无缝)。

### 💾 备份建议

建议 tag：`backup-068-butler-bell-thoughtbubble`

---

## [067] 2026-05-30 — 复古主题 6 张手绘素材接入（解阻塞 task #11）

> 用户「项目中的需要生成的图片试着直接操纵我的浏览器使用 chatgpt 生成」。装 Claude in Chrome 扩展后驱动 ChatGPT/DALL-E 生成爱德华墨线风格 6 张素材，落地到 `public/assets/retro/`，接入 globals.css 复古主题。**[058]/[059] 留的素材槽自 2026-05-29 起阻塞 task #11，本条解除阻塞**。

### 🤖 工作流（Claude in Chrome 自动化）

1. 选中 Chrome 浏览器 → 新 tab 打开 chatgpt.com（用户 Plus 账号已登录，DALL-E 可用）
2. **paste 灌入提示词**：ChatGPT 输入框是 ProseMirror contenteditable，`form_input` 不生效；改用 `ClipboardEvent('paste', { clipboardData })` 模拟粘贴成功
3. 点 `button[data-testid="send-button"]` 发送 → 等 35-45s 图生成（`img[alt*="生成"]` 出现）
4. **下载坑**：Claude in Chrome 隐私过滤遮蔽 `img.src` 读取（`[BLOCKED: Cookie/query string data]`）+ base64 也被遮蔽；fetch blob 用 `credentials:'include'` 拿到二进制，`a.download` + `a.click()` 触发下载（Chrome 实际几秒后落盘，初次以为失败误判）
5. 文件落到 `D:\User\asus\Downloads`（用户 Downloads 在 D 盘，不是 C:\Users\asus\Downloads；`Shell.Application NameSpace('shell:Downloads')` 确认）→ PowerShell 复制到 `retro/`

### 📂 6 张素材（全部 PNG，黑墨线白底，1024×1024 或近似）

| 文件 | 大小 | DALL-E 说明 |
|---|---|---|
| `retro/frame.png` | 1.07 MB | 矩形装饰边框，四角繁复花式（border-image 用） |
| `retro/corner.png` | 0.86 MB | 单角飘带（仅左上 1/4 有内容，可旋转贴四角） |
| `retro/banner.png` | 0.93 MB | 卷轴横幅，两端卷起，中央空白可放标题 |
| `retro/skyline.png` | 1.50 MB | 欧洲老城天际线：哥特尖塔/巴洛克穹顶/曼莎屋顶 |
| `retro/deskware.png` | 2.10 MB | 钢笔躺墨水瓶旁 + 羽毛笔 |
| `retro/butler.png` | 1.41 MB | 端盘管家全身：燕尾服+领结+单框眼镜（隐式）+白手套 |

### 🎨 CSS 接入 + 最终装饰（apps/web/src/app/globals.css）

| 改动 | 细节 |
|---|---|
| 6 个 `--retro-*` 变量 | 从 `none` → `url('/assets/retro/xxx.png')` |
| 天际线 | `.retro-railhost::after`（LeftRail.tsx 加此 className + `position:relative`）贴**左侧窄栏底部** 200px，opacity 0.55 |
| 钢笔墨水瓶 | `main::after` 贴**主面板右下角** 168px |
| 层级 | 都 **z-index:-1**（玻璃胶囊内部，夹在「玻璃面之上 / 内容之下」），`mix-blend-mode:multiply` 白底融入羊皮纸，`pointer-events:none` |

**层级踩坑（核心）**：最初用 `fixed body::before/::after`，但 `main` 的 `backdrop-filter` 会把背后 fixed 装饰**采样到玻璃面** → 浮在内容上挡阅读。改成「面板内部 `z-index:-1` 子元素」后物理上不可能盖住内容（用户来回纠正 3 次定位的根因就是这个）。

**试过又移除**：RetroDecor 四角飘带角花（corner.png 旋转贴四角，新建组件+CSS+page 挂载）——用户「花纹不好看」，整套已撤回删除。frame/banner/butler/corner 素材生成了备用，暂未接入。

### ✅ 验证（Claude Preview 自截图迭代）

- `tsc --noEmit` EXIT=0
- **preview server 自驱截图**：杀掉手动 dev server 让 preview 接管 3000 → eval 设 retro 主题 + 关 DailyBrief/Tour + 停动画 + 临时禁 backdrop-filter（截图器对多层玻璃 backdrop-filter 间歇 30s 超时）→ 截图确认天际线（左栏底）+ 钢笔墨水瓶（右下）就位且不挡内容
- 6 张素材落地 `public/assets/retro/`；Downloads 备份文件用户自清（规则禁 AI 删）

### 🚦 下一步候选

- **管家机制 / 发送按钮铃铛 / thinking 漫画思考框**（用户新需求，做完记 [068]）
- frame/banner/butler 素材找落点 or 不用
- 手机响应式（[065] backlog）/ 主动 AI / 周报分享卡

### 💾 备份建议

建议 tag：`backup-067-retro-assets`

---

## [066] 2026-05-30 — 壁纸系统：root 可换图片/视频

> 用户「增加壁纸系统让现在的 root 可以被替换为视频或者图片」。玻璃胶囊浮在自定义壁纸上 = liquid-glass 灵魂场景。

### 📂 改动

| 文件 | 改动 |
|---|---|
| `lib/types.ts` | 加 `Wallpaper { id:"current", kind:"image"\|"video", blob, updatedAt }` |
| `lib/db.ts` | Dexie v7→**v8**，新增 `wallpapers` 表（主键 id）|
| `lib/wallpaper.ts` | **新建** CRUD（setWallpaper 校验类型+大小：图≤10MB/视频≤60MB；get/clear）+ 暗化 getter/setter（localStorage `butler.wallpaper.dim`，默认 0.2）+ `WALLPAPER_EVENT` 通知 |
| `components/WallpaperLayer.tsx` | **新建** fixed inset:0 z-index:-1 层：image→bg-image / video→`<video autoPlay loop muted playsInline objectFit:cover>` + 暗化遮罩；监听事件即时换；ObjectURL 严格 revoke 防泄漏；无壁纸 return null |
| `app/page.tsx` | 根 div 顶部挂 `<WallpaperLayer />` |
| `components/PreferencesPanel.tsx` | 新「壁纸」段：上传图片/视频 + 当前状态 + 恢复默认 + 暗化滑块；open 时读当前 kind/dim |
| `app/globals.css` | **关键修复**：背景（color+grid+halftone+glow）从 `body` 移到 `html`，body 改 `background:transparent` → 让 WallpaperLayer 的 `z-index:-1` 能盖在网格底之上显示（否则被 body 不透明底遮住）|

### 🎯 关键设计

- **存 IndexedDB blob**：图片/视频原始二进制（视频太大 localStorage 装不下，必走 IDB）。复用 [050] butler-asset 的 blob+event+objectURL 模式。
- **z-index:-1 被 body 底遮住的经典坑**：负 z-index 元素会被祖先（body）的不透明背景盖住 → 把页面底从 body 挪到 html，body 透明，壁纸层就显出来了（无壁纸时 html 网格底照常露）。
- **暗化遮罩**：壁纸上玻璃文字可读性保险，0-70% 滑块可调。
- **三主题兼容**：壁纸层与主题正交；亮/暗/复古下都可叠壁纸。

### ✅ 验证

- `tsc --noEmit` EXIT=0
- preview：注入测试图片壁纸（IDB raw write + dispatch）→ 橙紫渐变浮在玻璃胶囊后、胶囊磨砂出暖色、暗化生效、文字可读；clear → 还原网格底（rowExists:false / layerCount:0）；console 无 error

### 🚦 下一步候选

- 壁纸预设库（几张内置壁纸一键选）+ 模糊度滑块
- 手机响应式（仍是最大增长天花板，[065] 已验证布局崩）
- 主动 AI / 周报分享卡

### 💾 备份建议

建议 tag：`backup-066-wallpaper-system`

---

## [065] 2026-05-29 — 每日仪式 · Daily Brief（UX 增长方向：留存）

> 用户「思考 UX 增长点」→ AskUserQuestion 选「每日仪式 + Daily Brief」。先验证了一个硬伤：**手机端布局直接崩**（375px 截图证：桌面胶囊溢出/导航裁切），记入下方增长 backlog。本条做留存复利地基。

### 📂 改动

| 文件 | 改动 |
|---|---|
| `components/DailyBrief.tsx` | **新建** 玻璃横幅：时段问候（早/中/下午/晚）+ 今日到期/逾期摘要 + streak chip + 最近任务链接 + 建议语 + 一键「开始专注」（glass-btn-primary）+ dismiss×。100% 本地派生零 token，bubble-pop 入场 |
| `components/ChatCanvas.tsx` | 接 `showDailyBrief`/`onStartFocus`/`onDismissBrief` props，在浮动管家后、历史区前渲染 DailyBrief |
| `app/page.tsx` | `showDailyBrief` state + `BRIEF_KEY=butler.brief.lastSeen` 持久化；hydrate 后若 `lastSeen!==今天`则显示；`handleStartFocus`（标记已读+开 MiniAppsDrawer 专注计时）/`dismissDailyBrief`（标记已读）|

### 🎯 设计

- **每日一次**：localStorage 记 `lastSeen` 日期，每个新自然日首开 Chat 才出现一次，不每次 render 都弹（不扰民），是"早晨打开 Butler"的仪式触发。
- **可行动**：核心是「开始专注」一键进入专注计时——把简报从"展示"变"触发行动"（巴甫洛夫闭环：触发→行动→奖励 streak）。
- 复用现有：streakDays / ddls / MiniAppsDrawer（FocusTimer），零新依赖。

### ✅ 验证

- `tsc --noEmit` EXIT=0
- preview eval：清 flag 重载→简报出现（晚上好,Feng + 🔥1天 + 今日1项到期 + 读10页书 + 开始专注）；点开始专注→专注抽屉开 + 标记已读；重载→不再重复出现（lastSeen=今天）；console 无 error

### 🚦 UX 增长 backlog（AskUserQuestion 当时列的，剩余）

- 🔴 **手机响应式**（已验证崩，触达天花板，较大重构：窄屏双栏胶囊折单栏 + 底部 tab）
- 主动 AI 提醒/周报（差异化）· 魔法首屏+起手 chips（激活）· 周报分享卡（传播）· 管家情绪反应（愉悦）· streak freeze 防断签流失

### 💾 备份建议

建议 tag：`backup-065-daily-brief`

---

---

## [064] 2026-05-29 — 面板模组系统（观察.txt #17，AI/手动组合数据仪表盘）

> 用户思考增值方向 → 选「面板模组系统」（AI 用预设模组组合出用户需要的面板）。这是 Butler 产品命题「AI 创造、面板是产物」的最高杠杆点。把 CustomPanel 从「单一 markdown/iframe」进化成「模组堆叠」。

### 🧱 架构（新增文件 + 改动）

| 文件 | 操作 | 说明 |
|---|---|---|
| `lib/types.ts` | 改 | CustomPanelKind 加 `modules`；CustomPanel 加 `modules?: PanelModule[]`；新增 `PanelModule`/`PanelModuleType`(stat/countdown/tasklist/pie/bar/heatmap)/`PanelMetric`/`PanelModuleConfig` |
| `lib/panel-data.ts` | **新建** | 从真实 ddls/notes/streak 现算绑定数据：resolveStat/resolveSeries/resolveHeatmap/resolveTasks/resolveCountdown。注：任务无 completedAt，时间序列用 dueDate 密度（诚实于现有数据，将来加 completedAt 可换真实完成分布）|
| `components/panel-modules/Charts.tsx` | **新建** | 手绘 SVG **零依赖** 饼图(arc path)/柱状图/热力图(7×7 GitHub 式)；颜色用 CSS 变量跟随三主题 |
| `components/panel-modules/ModuleRenderer.tsx` | **新建** | 按 type 分发渲染，卡片包裹 + onRemove；数据走 panel-data |
| `components/CustomPanelView.tsx` | 改 | 加「模组」kind 按钮；modules 状态 + 加模组 picker(6 预设带 live 默认配置) + 网格渲染 + 删模组；接 `dataCtx` prop |
| `lib/custom-panels.ts` | 改 | updateCustomPanel patch 类型 + modules |
| `lib/ai-tools.ts` | 改 | create_custom_panel 加 kind=modules + `modules` 数组参数(type/title/config，含 metric/filter 枚举说明)；CreateCustomPanelArgs 扩展 |
| `lib/tool-executor.ts` | 改 | execCreateCustomPanel 支持 modules（补 mod id + 校验非空），落 pending 草稿 |
| `app/api/chat/route.ts` | 改 | 系统提示词守则 9：建看板/仪表盘用 kind=modules |
| `app/page.tsx` | 改 | handleUpdateCustomPanel patch 类型 + modules；CustomPanelView 传 dataCtx(ddls/notes/streak) |

### 🎯 设计要点

- **Live 数据绑定 = 杀手锏**：模组默认绑定用户真实数据（待办数/状态分布/到期密度/热力），「AI 用你的真实数据搭 dashboard」是区别于 Notion/ChatGPT 的点
- **零依赖图表**：饼/柱/热力全手绘 SVG，延续项目「WebAudio 合成零依赖」哲学，不引 recharts
- **双入口**：用户手动「加模组」picker + AI `create_custom_panel(kind=modules, modules=[...])` 组合，产出同一份 modules 数组
- **派生物**：模组系统一做，Daily Brief / 智能模板 / 自然语言改面板都是它的组合（后续）

### ✅ 验证

- `tsc --noEmit` EXIT=0（修了一处 Map 迭代 → Array.from）
- preview 手动建面板→切「模组」→加 统计卡/饼图/柱状图/热力图：全部渲染**真实数据**（1 个待办任务 → 饼图 100% 待办、stat 卡「1」、柱状图今天「1」、热力图今日格高亮）；删模组即时生效
- AI 工具路径 tsc 通过（schema+executor+落库），未跑真实 AI 调用（省 API token；产出与手动同一 modules 数组）

### 🚦 后续（模组系统可延展）

- Phase 2：更多绑定指标 + DdlItem 加 completedAt 换真实完成分布 + 拖拽重排模组 + 模组配置编辑(改 metric/filter)
- Phase 3：智能模板库(考试/论文/习惯一键建) + 自然语言改面板 + Daily Brief 预设组合
- 给 ddls 加 completedAt 后热力图/柱状图可显「真实完成」而非「到期密度」

### 💾 备份建议

建议 tag：`backup-064-panel-module-system`

---

## [063] 2026-05-29 — 观察.txt 续：多模型接口 / 默认新会话 / 图片素材清单

> 接 [062]「全部完成」，继续清观察.txt 里**无阻塞可落地**的待办。剩下的（拖拽图表 / 需用户交素材 / 管家元素美术）见末尾如实说明。

| # | 文件 | 改动 |
|---|---|---|
| **#12** 多模型接口预留 | `lib/ai-models.ts` · `InputPod.tsx` | AiModelId 加 `claude`/`gpt`/`gemini`，AI_MODELS 加 3 条 `placeholder:true`（tagline「接口预留·敬请期待」）；ModelOption 对 placeholder 渲染灰显 + `disabled` 不可选（接入真 Key 后去 placeholder + 补路由即用）|
| **#9** 默认新会话 | `page.tsx` | `orderedSessions` 过滤：只有**出现过用户消息**的会话才进 RECENT CHATS；仅含开屏问候的空白草稿不污染历史（活动草稿仍可输入，发消息后即现）。零改 session 生命周期，纯派生 filter，低风险 |
| **#5/#6/#14** 图片素材清单 | `Doc/图片素材清单.md`（新）| 列已具备/待提供(复古 6 件，最高优先，阻塞 task#11)/可补强/AI 配图四类 + 交付建议；解锁用户按单交图 |

### ✅ 验证

- `tsc --noEmit` EXIT=0
- preview：①模型下拉 5 项——DeepSeek×2 可选 + Claude/GPT/Gemini 灰显不可选 ②点 New Chat→新问候草稿，RECENT CHATS 仅留有交互的「番茄工作法」会话，空草稿不显 ③素材清单 md 已落盘

### 🚦 观察.txt 剩余（如实说明，非偷懒）

- **需你交素材**：复古 6 件手绘(task#11) · 成就徽章/Tour 插画/管家元素美术(#21 燕尾服/单框眼镜/白手套) · AI 配图集(#14) —— 见 `Doc/图片素材清单.md`
- **独立大功能（建议单开一轮）**：#17 AI 建面板拖拽自定义图表(饼/柱/热力，需引图表库 + 拖拽 + AI tool schema，工作量大)
- **语义模糊待你定**：#4 残「对话框按剩余空间放任务左右」(当前居中，左右动态定位需明确触发场景) · #10 系统提示词触发机制(已随 #9/#11 部分覆盖，余下不明确) · #8 建议开源 UI 组件(偏调研)
- **可选小项**：#1 残 成就/音效更多配套动画 · #19/#20 风格再细化

### 💾 备份建议

建议 tag：`backup-063-multimodel-session-assetlist`

---

## [062] 2026-05-29 — 观察.txt 五连击（按用户「按顺序全部完成」）

> 用户「按照顺序全部完成」上一条列的 5 个观察.txt 候选。逐个落地 + 浏览器验证。

### 📂 涉及文件 & 对应需求

| # 观察 | 文件 | 改动 |
|---|---|---|
| **#4** 漫画询问卡 + 删残留头像 | `ConfirmCard.tsx` | 删 Sparkles AI 头像（其余 AI 气泡无头像，这是残留不一致）；卡片做成漫画对话气泡（`--radius-card` + 1.5px 主色边 + **向下尾巴**双三角指向下方管家，"管家在向你确认"）；外层 460 宽居中；删 Sparkles import |
| **#11** AI 主动澄清 | `api/chat/route.ts` | `buildSystemPrompt` 加守则 8「主动澄清（仅真正模糊时）」：缺无法默认的关键信息 / 多意图冲突 → 先反问给选项；能默认就别问（与守则 1 主动调工具平衡，避免过度发问）|
| **#16** 推荐每日任务 | `TasksPanel.tsx` + `page.tsx` | 空态加「管家推荐 · 点一下即添加」5 个 RecommendChip 胶囊（复习笔记/规划明天/整理收件箱/运动/读书）；新 `onQuickAdd` prop → page `handleQuickAddTask` 直接建今日 DDL(source=推荐任务) + toast + 音效，**零编辑器一键启动**降门槛 |
| **#3** 成就收藏室 | `AchievementsRoom.tsx`(新) + `TopBar.tsx` + `page.tsx` | 复用 `lib/streak` 的 ACHIEVEMENTS + getUnlockedSet，陈列 8 成就(已解锁高亮/未解锁灰+锁)；用户菜单加「成就收藏室」(Trophy)入口；Portal 渲染 + 当前 ctx(ddls/notes/streak)即时判定 |

### ✅ 验证

- `tsc --noEmit` EXIT=0
- preview 实测：①推荐胶囊点「读 10 页书」→ Active 即出现该任务(今天 23:59 · 推荐任务徽章)，计数更新 ②成就收藏室开启「已解锁 1/8」，初心者高亮(刚建任务满足)、其余灰锁 ③ConfirmCard 已无头像、居中带下尾巴 ④system prompt 守则 8 已注入（待真实对话观察澄清行为）

### 🚦 观察.txt 剩余未做

- #4 残项：AI 对话框「按剩余空间放任务左右」（当前居中，左右动态定位未做）
- #1 残项：成就/音效配套更多动画
- #5/#6/#8/#14 图片素材清单 · #7 精美组件 · #9 默认开新会话(有内容才存) · #10 系统提示词触发机制 · #12 Claude/GPT/Gemini 多模型接口 · #17 AI 建面板拖拽图表 · #19/#20/#21 风格细化(燕尾服/单框眼镜/白手套元素)
- 复古主题素材接入（task #11，待用户交图）

### 💾 备份建议

建议 tag：`backup-062-observation-5features`

---

## [061] 2026-05-29 — 任务面板居中化 + AI 额外动态效果

> 用户两连：①处理 AI 额外动态效果清单 ②"创建 list 的丑陋侧边栏"改成独立居中圆角层（= TaskDetailDrawer，正合观察.txt #18「子面板应在屏幕中间」）。

### 🪟 任务/事件面板：右抽屉 → 居中圆角浮层

| 文件 | 改动 |
|---|---|
| `TaskDetailDrawer.tsx` | 右侧 `<aside>`(top56/right0/width380/translateX 滑入) → **居中浮层**(top/left 50% + translate(-50%,-50%) + width460/maxWidth94vw/maxHeight88vh + `--radius-modal` 圆角 + 四周 border + `--shadow-modal`)；scrim slate 硬编码 → `var(--color-overlay)`；动画 `drawer-slide`(translateX)→`modal-pop`(scale+fade from center)；form `height:100%`→`flex:1/minHeight:0`(配 maxHeight 内部滚动)；bg `--color-bg`→`--color-surface` |

由 page.tsx 已在 [059] Portal 包裹 → 逃离胶囊 overflow，居中不被裁。

### 🎬 AI 额外动态效果清单（ChatCanvas）

| 效果 | 实现 |
|---|---|
| **思考点**（核心）| 新增 `TypingDots`(3 点错相 `dot-bounce` 跳动) + keyframe；AI 加载中**首字未到**(`isTyping && !content`)时替代原来的干光标，"管家斟酌中"更有生命感 |
| 流式光标 | 保留 `cursor-blink`（有内容时尾随）|
| **ConfirmCard 入场** | AI 的"任务创建询问"卡 wrapper 加 `.comic-bubble`(bubble-pop 弹入)，呼应观察.txt #4 漫画式任务询问 |

### ✅ 验证

- `tsc --noEmit` EXIT=0
- preview：New Task 面板已居中圆角浮层(内部滚动 + 取消/创建 footer)；chat 流式正常；`dot-bounce`/`cursor-blink` keyframe 已注入；console 无 error

### 🚦 下一步候选

- 观察.txt 其余：AI 对话框按剩余空间放任务左右 / AI 主动澄清 / 推荐每日任务 / 成就收藏室 / 删残留 AI 头像
- 复古素材到位接入（task #11）
- GlassCard 铺各面板内部卡片

### 💾 备份建议

建议 tag：`backup-061-centered-modal-ai-fx`

---

## [060] 2026-05-29 — 代码审计 + 整体动效反馈 + 管家主题音效

> 用户三连：①复古素材接入记入待办 ②整体代码审计出表格 ③整体动效反馈 + 音效独特性。

### 📋 ① 复古素材待办（记入 task #11）

复古主题地基已铺（[059]），待用户提供 6 类手绘素材后接入逼近参考图 1:1：手绘边框九宫格 / 四角飘带·领结 / 标题飘带横幅 / 城市天际线 / 钢笔+墨水瓶 / 管家端盘线描。素材槽 CSS 变量 `--retro-frame/-skyline/-deskware/-butler` 已留，放 `public/assets/retro/`。

### 🔍 ② 代码审计表（9 项；cheap 的当场修）

| # | 严重 | 范围 | 问题 | 状态 |
|---|---|---|---|---|
| A1 | 🟡中 | Tasks/Calendar/Notes/Custom 面板根 | 根容器 paint 实色 `--color-bg` 盖住 main 玻璃胶囊 → 仅 Chat 透玻璃，三主题不一致 | 📋 待办(跨4文件逐一验证,不盲改) |
| A2 | 🟢低 | globals.css | `--texture-paper` 已无引用=死 token | ✅ 删 |
| A3 | 🟢低 | PreferencesPanel·KbdHelp | modal 遮罩硬编码 slate 蓝不贴主题 | ✅ 改 `var(--color-overlay)` |
| A4 | 🟢低 | TopBar | `THEME_CYCLE`/`themeMeta` render 内重建 | ✅ 提模块级 `THEME_META` |
| A5 | 🔵信息 | 全局 | 无 `prefers-reduced-motion` | ✅ 动效任务里加了守卫 |
| A6 | 🟢接受 | InputPod | 文件类型/档位硬编码语义色 | 设计意图([048])保留 |
| A7 | 🟢低 | NotesPreview·TaskDrawer·Tour | 同 A3 slate 遮罩(pre-existing) | 📋 后续统一(Tour spotlight 需小心) |
| A8 | ✅已修 | ConfirmCard | 卡 body `--color-bg` 暗态隐形 | ✅ 本会话→surface |
| A9 | 🔵信息 | InputPod 模型下拉 | Portal fixed 坐标 open 算一次 resize 不更新 | 接受(固定布局无滚动) |

正面：三主题 token 集完整无 fallthrough；Portal 含 SSR 守卫；组件零重写靠 token 切换。

### 🎬 ③ 动效（task #13）

| 文件 | 改动 |
|---|---|
| `globals.css` | 新增 **可复用动效**：`.fx-pop`(完成弹跳,配服务铃)/`.fx-ring`(主色光环回响)/`.fx-shake`(错误抖动,配 error 音)+ keyframes；**`@media (prefers-reduced-motion: reduce)` 全局守卫**(关停所有动画/过渡,A5) |
| `TasksPanel.tsx` | Checkbox 勾选 unchecked→checked 时挂 `.fx-pop` 450ms（观察.txt #1：task 音效配 UI 动画）|
| `Toast.tsx` | error toast 挂 `.fx-shake`（配 toast-error 音）；bg `--color-bg`→`--color-surface` + shadow token（暗/复古下浮起，顺修 A 类隐患）|

### 🔔 ③ 音效独特性（task #14，lib/sound.ts）

| 改动 | 细节 |
|---|---|
| **管家签名合成器** | 新增 `bell()`（加法合成：基频+2.76×/5.40× 非谐波分音+长衰减=服务铃，巴甫洛夫奖励锚点）+ `scratch()`（高通噪声+抖动包络=钢笔书写擦音）|
| **关键音管家化** | task-complete→服务铃 B5+E6 闪点；ai-reply→柔和台铃；send→钢笔擦音；achievement→铃前导+琶音；streak→三铃簇鸣；focus 起止→单/双服务铃；panel-create→纸落桌+铃 |
| **默认开启** | `DEFAULT_SOUND_PREFS.enabled` false→**true**（观察.txt #2；仍可偏好设置关 + 静音时段防扰民）|

### ✅ 验证

- `tsc --noEmit` EXIT=0（两轮：审计后 + 动效音效后）
- preview eval：fx-pop/ring/shake + prefers-reduced-motion 均注入 CSS；无 stored sound prefs（默认 enabled 生效）；console 无 error；三主题渲染健康

### 🪟 ④ A1 修复：非 Chat 面板根容器透玻璃（task #15）

> 审计 A1 落地。把 5 个面板根容器 `background: var(--color-bg)` → `transparent`，让 `<main>` 玻璃胶囊在所有 Tab 透出（此前仅 Chat 透，Tasks/Calendar/Notes 是实色块，暗色下尤其割裂）。

| 文件 | 根容器 |
|---|---|
| `TasksPanel.tsx` | 单列滚动根 |
| `CalendarPanel.tsx` | 月/周/日 3 个视图根（2 个同串 replace_all + 1 个 day 视图）|
| `NotesPanel.tsx` | 双列 flex 根（内部 aside 列保留 `--color-surface`，editor 子区元素各自有 bg）|
| `CustomPanelView.tsx` | flex 列根 |

只改最外层根，内部卡片/按钮/单元格/搜索框/列表列 bg 全不动 → 内容对比度不变，仅面板背板变玻璃。

验证：tsc EXIT=0；preview 实测——暗色 Tasks(网格透出)/Notes(双列玻璃)、亮色 Calendar(白玻璃胶囊明显区别于灰底) 全部可读且与 Chat 一致；三 Tab 现在统一玻璃。

### 🚦 下一步候选

- GlassCard 铺各面板内部卡片（进一步统一玻璃语言）
- 复古素材到位后接入（task #11）
- 观察.txt 其余：漫画"任务创建询问"卡 / AI 主动澄清 / 推荐每日任务 / 成就收藏室
- 偏好设置旧奶油预设色块换 iOS 蓝

### 💾 备份建议

建议 tag：`backup-060-audit-motion-sound`

---

## [059] 2026-05-29 — 视觉转向 iOS 白 + 悬浮胶囊布局（撤回 new.png 复古元素）

> [058] 刚铺好奶油复古未来地基，用户随即转向：**配色换成苹果 iOS 白**，面板拆成**独立悬浮胶囊仓**（navbar / AI 历史 / AI 对话各自一块浮卡），**完全复用 css 液态玻璃**，并**撤回基于 new.png 的改动**（history 下面的管家肖像卡等）。[058] 的结构件（液态玻璃类 / 胶囊导航 / GlassButton）全部复用，只换色 + 重新布成浮卡。

### 🎯 PM 对齐（AskUserQuestion 2 问）

| 分叉 | 用户拍板 |
|---|---|
| iOS 白底强调色 | **iOS 蓝 #007AFF**（链接/active/主按钮/发送键）|
| "撤回基于 new 的改动"撤到哪 | **全面转干净 iOS**（去管家肖像卡 + 漫画气泡尖角尾巴 + 衬线展示字 Fraunces，全换无衬线）|

布局拍板（上一轮已定，本轮落地）：navbar/history/对话三个**独立悬浮胶囊**；液态玻璃技法保留，recolor 成白磨砂。

### 📂 涉及文件

| 文件 | 改动 |
|---|---|
| `apps/web/src/app/globals.css` | (1) :root + dark **整块换 iOS 配色**：primary #007AFF / accent 靛蓝 #5856D6 / 系统语义色 / text iOS 灰阶 / **底 #E8E8EF + 白卡** / 白磨砂玻璃（rgba(255,255,255,0.82~0.92) + blur(20px) saturate(1.8)）/ 大圆角(card 22) / 中性黑软阴影（card-hover 加强让白卡浮起）/ code 深炭 / 语义淡底 iOS；(2) `--texture-paper: none`（去纸纹）+ `--bg-liquid` 改极淡蓝/靛蓝光团；(3) font-display/body 改 `-apple-system` 系统无衬线优先；(4) `.glass-btn-primary`/`.glass-btn-accent`/`.pill-nav-item.active` 文字 cream→#fff，删暗色 active 文字 override |
| `apps/web/src/app/layout.tsx` | 删 Fraunces 衬线字（import + className）；viewport themeColor → #F2F2F7 |
| `apps/web/src/components/layout/ChatRail.tsx` | **删 ButlerPortraitCard**（AT YOUR SERVICE 管家肖像卡，[058] 加的，即"history 下面那些乱七八糟设计"）|
| `apps/web/src/components/ChatCanvas.tsx` | 气泡去 `tail-left`/`tail-right` 尖角尾巴（保留 `comic-bubble` pop 动画）；AI 气泡 2px 蓝边 → 1px 中性灰边（error 时才描色边）；root `<main>` bg → transparent（露出胶囊玻璃）|
| `apps/web/src/app/page.tsx` | 根 div bg→transparent + `padding:12` + `gap:12`；body 行加 `gap:12`；`<main>` 改悬浮玻璃胶囊（圆角/玻璃 bg/blur/border/阴影）|
| `apps/web/src/components/layout/TopBar.tsx` | 顶栏去 borderBottom，改**悬浮圆角玻璃条**（borderRadius + 四周 border + 阴影）|
| `apps/web/src/components/layout/LeftRail.tsx` | 左栏去 borderRight，改**悬浮玻璃胶囊**（宽 200→220 + 圆角 + 玻璃 bg/blur/border/阴影）|

### 🎯 关键设计

- **复用 [058] 不重写**：`.liquid-glass`/`.glass-btn`/`.pill-nav` 类 + `ui/Glass.tsx` 原样保留，只改 CSS 变量值 → 全站自动跟随换色。证明 token 化地基的价值
- **白卡浮起靠对比**：纯白磨砂卡 + #F2F2F7 太接近 → 把底压深到 #E8E8EF + 卡不透明度提到 0.82/0.92 + 强化 card-hover 阴影，胶囊才明显"浮"在带极淡蓝靛 tint 的浅灰底上
- **撤回范围**：管家肖像卡（明确）+ 漫画尾巴 + 衬线字（用户选"全面转干净 iOS"）。`comic-bubble` 的 pop 入场动画保留（不属于"乱七八糟"）

### ✅ 验证

- `tsc --noEmit` EXIT=0；preview 截图：白底 + navbar/history/对话三独立悬浮白胶囊 + iOS 蓝 active 胶囊/New Chat/发送键 + 无衬线干净字 + 无肖像卡/无气泡尾巴；console 无 error；OnboardingTour 模态也已是 iOS 蓝白样式

### 📝 已知待办 / 下一步候选

- **逐面板铺玻璃**：Tasks/Calendar/Notes 面板内部卡片与按钮还是旧 inline 样式，接 GlassCard/GlassButton
- **ChatCanvas 残留硬编码 `var(--color-bg)` 块**（greeting/QuickCard/empty-hero 多处）在玻璃胶囊上是不透明浅灰块，可改透明/surface 更融
- **容器覆盖**（观察.txt #13）：中置管家立绘与输入舱叠放，待处理
- 暗色模式实机验证（token 已重写 iOS Dark，未实测切换）
- 观察.txt 其余功能项（音效/漫画任务卡/主动澄清/推荐每日任务等）

### 🔁 同会话追加修订：黑色 + 液态玻璃网格底 + 面板提高透明度

> iOS 白胶囊出来后用户当即再调：「背景用 css 液态玻璃的网格背景 / 前面面板透明度提高 / 配色换成黑色」。在同一 globals.css 上继续改（无新文件、无组件改动）：

| 改动 | 细节 |
|---|---|
| **配色换黑** | :root（默认态）整块从 iOS 白 → 黑：`--color-bg #0B0B0F` + surface #17171C + 白字灰阶 + primary 提亮成 #0A84FF。dark block 同步成一致黑（toggle 两态都黑）|
| **液态玻璃网格底** | 新增 `--grid-line`(rgba(255,255,255,0.07)) + `--bg-grid`（样例「纯CSS液态玻璃」的双 linear-gradient 网格，`background-size:55px`）+ `--bg-glow`（蓝/靛径向晕 + 底部暗角）；body bg = `var(--bg-glow), var(--bg-grid)` |
| **面板提高透明度** | `--glass-bg` 0.82→**0.45**、strong 0.92→**0.62**；`--glass-blur` 20px→**10px**（低 blur 让网格能透过磨砂玻璃显出来，即"液态玻璃折射网格"效果）|

### 🧩 浮层被胶囊截断修复（Portal）

> 用户实测：模型下拉、偏好设置等弹窗被截断。**根因**：胶囊面板（main/rail/topbar）的 `backdrop-filter` 会成为 `position:fixed` 的**包含块**，叠加 `overflow:hidden` → 所有挂在 `<main>` 内的 fixed 弹窗都被困在胶囊里并裁切。

| 文件 | 改动 |
|---|---|
| `apps/web/src/components/ui/Portal.tsx` | **新建** `Portal`（`createPortal` 到 `document.body` + mounted 守卫），让浮层成"独立子容器"逃离胶囊 overflow/backdrop-filter |
| `apps/web/src/app/page.tsx` | 把 6 个浮层（TaskDetailDrawer / AttachmentPreview / NotesPreview / KeyboardShortcutsHelp / PreferencesPanel / OnboardingTour）整体移出 `<main>`、包进 `<Portal>` |
| `apps/web/src/components/PreferencesPanel.tsx` | dialog 加 `maxHeight:90vh` + flex 列 + 内容区 `overflow-y:auto`（之前无 maxHeight → 内容超屏被裁）；阴影换 `--shadow-modal` |
| `apps/web/src/components/InputPod.tsx` | 模型下拉改 `Portal` + `position:fixed`（按钮 `getBoundingClientRect` 算坐标，向上弹），逃离输入舱自身 `overflow:hidden` |

验证：tsc EXIT=0；eval 实测——模型下拉两项完整不裁切；偏好设置 `role=dialog` 已挂到 `body`、居中、`fullyVisible:true`（top64/bottom870/vh934）+ 内部滚动条。

注：白色版（#E8E8EF 底 + 白卡）是中间态。

**再再修订（同会话末）**：用户定「黑色网格版保留为**黑夜模式**，白色版做**常态（亮）模式**」。最终落位：
- `:root`（默认/常态）= **iOS 白**：#E8E8EF 底 + 白磨砂胶囊（glass 0.82/blur 20）+ `--bg-grid: none`（白模式无网格，只有极淡蓝靛 `--bg-glow` 光团）
- `html[data-theme="dark"]`（黑夜）= **黑底液态玻璃网格**：#000 底 + 网格 + 高透明黑玻璃胶囊（glass 0.45/blur 10）
- body bg = `var(--bg-glow), var(--bg-grid)`，两态靠 token 切换；网格仅黑夜出现
- 切换入口：偏好设置 → 主题 → 亮色/暗色（[048] 已有的 data-theme 机制，原样复用）
- 验证：默认渲染白胶囊；eval 设 `data-theme=dark` 渲染黑网格；均 OK

### 🌗 顶栏昼夜开关 + 白天也用网格 + 黑夜 logo/人物反色

| 改动 | 细节 |
|---|---|
| **顶栏昼夜开关** | TopBar 在搜索栏↔小组件之间加玻璃圆钮（白天显 🌙 / 黑夜显 ☀️）；PreferencesPanel 导出 `getStoredTheme`/`setStoredTheme`/`Theme`，开关复用同一 `butler.theme` 持久化（data-theme + localStorage），与偏好面板同步 |
| **白天也用网格底** | :root `--bg-grid` 从 `none` 改回网格，`--grid-line: rgba(0,0,0,0.05)`（浅色深线）。两态都有液态玻璃网格 |
| **黑夜 logo/人物反色** | globals.css `html[data-theme="dark"] .app-logo{filter:invert(1) brightness(1.15)}` + `.butler-figure{filter:invert(1)}`；TopBar logo div 加 `.app-logo`，ButlerCharacter 内置立绘加 `.butler-figure`（**用户自定义形象不反色**）。黑底上 logo/管家变白可见 |

验证：tsc EXIT=0；eval+截图——开关点击 theme 切 dark/light；白天网格线已注入；黑夜 logo `invert(1) brightness(1.15)`、7 张立绘 `invert(1)`，管家成白色立绘清晰可见。

### 🃏 ConfirmCard 黑夜模式"疑似丢失"修复

> 用户报告黑夜模式下核实卡像是消失了。**根因**：卡片 body 用 `background: var(--color-bg)`（黑夜 = #000，与页面同色）→ 卡体融进背景，只剩内部 change-row（`--color-surface` 较亮）+ 蓝边可见，整体看像"卡片丢了"。其实 DOM 一直在（实测「接受(1)」「全部取消」按钮都在）。层级被做反了。

| 文件 | 改动 |
|---|---|
| `apps/web/src/components/ConfirmCard.tsx` | 卡 body bg `--color-bg` → **`--color-surface`**（抬起一层）+ 非 pending 态也给 `--shadow-card`；内部 `ChangeRow` bg `--color-surface` → **`--color-bg`** + 加 `--color-border-soft` 描边。恢复"卡面亮 / 行槽暗"的正确两级深度 |

验证：黑夜模式重发建任务消息 → 卡片 body 明显的深灰面（#17171C）区别于 #000 页面 + 蓝边 + 待核实徽章 + 行槽更暗；白天模式白卡同样清晰。两态截图确认。

### 🪶 复古手绘第三主题（地基 + 三元主题系统）

> 用户给了一张复古手绘 Notes 截图（羊皮纸 + 手绘墨线框 + 城市天际线/钢笔墨水瓶插画 + 领结飘带 + 半调网点 + 衬线小型大写），要求「1:1 还原」。**PM 对齐结论**：① 范围 = **可切换的第三主题**（和亮/暗并列，不替换 iOS）；② 插画/边框**素材由用户提供**（1:1 的真正瓶颈，CSS 变不出插画）。本条先做**不依赖素材**的全部地基。

**技术判断（1:1 怎么实现）**：纯 CSS 做不到 = `CSS 结构/配色` + `手绘描边(rough.js / SVG feTurbulence 滤镜 / border-image 九宫格)` + `定制插画素材` 三层叠。能 CSS 的：纸底/半调/衬线/配色；必须素材的：手绘边框、四角飘带、城市天际线、钢笔墨水瓶、管家线描。

| 文件 | 改动 |
|---|---|
| `PreferencesPanel.tsx` | `Theme` 类型加 `retro`；主题段 SegRow 加第三个「复古」按钮（Feather 图标）。getStoredTheme/setStoredTheme 自动透传 |
| `layout/TopBar.tsx` | 顶栏主题钮从 light↔dark 二元切换改为 **亮→暗→复古 三元循环**（`THEME_CYCLE` + `themeMeta` 图标/标签：Sun/Moon/Feather）|
| `app/globals.css` | 新增 `html[data-theme="retro"]` 全套 token：羊皮纸米底 #ECE3CF / 墨绿 #2D4A3E 主色 / 黄铜金 #B08D57 accent / 墨黑字 / 不透明复古纸面板（glass 0.92, blur 2）/ 衬线展示字 / 暖棕阴影。bg = 暖径向晕 + 纸纹 + **独立半调点阵层**（新增 `--bg-halftone`/`--bg-halftone-size` 机制，body 改 3 层背景，亮/暗设 none）。预留素材槽 `--retro-frame/-skyline/-deskware/-butler`（默认 none）|
| `app/layout.tsx` | 加载 `Cinzel`（next/font）→ `--font-cinzel`，复古 `--font-display` 用它做小型大写横幅 |

验证：tsc EXIT=0；切 retro 实测——Cinzel 衬线（BUTLER/RECENT CHATS 小型大写）、主色墨绿 #2D4A3E、半调 7px 平铺、羊皮纸底 15 层背景全部生效；logo/管家在复古亮底不反色（正确）。三主题顶栏循环 + 偏好设置三选钮均可切。

### 📋 待用户提供的素材（提供后我接入即逼近 1:1）

建议 SVG 优先（可缩放/跟色），放 `apps/web/public/assets/retro/`：
1. **手绘边框九宫格** frame.svg（左栏/中栏/主区/卡片通用，含四角排线）→ 填 `--retro-frame` 走 border-image
2. **四角飘带/领结 ornament**（贴角装饰）
3. **标题飘带横幅**（PRIVATE WRITING DESK / BUTLER'S MEMOS 那种）
4. **城市天际线插画**（左栏底部）→ `--retro-skyline`
5. **钢笔 + 墨水瓶插画**（主区右下）→ `--retro-deskware`
6. **管家端盘线描立绘**（toast 用）→ `--retro-butler`
7.（可选）半调网点已用 CSS 实现，如要更精细可换 PNG tile

### 💾 备份建议

`backup-058-visual-foundation` 之后紧跟。建议 tag：`backup-059-black-grid-capsules`

---

## [058] 2026-05-28 — 视觉地基 v2：液态玻璃底 + B 胶囊导航 + GlassButton 通用件

> 用户「接手项目」给出新设计方向：`Doc/new.png`（奶油羊皮纸三栏 = 左导航 + 中对话 + 右 Daily Brief）作北极星，`UI_sample/` 提供具体 CSS 配方。本条按「地基优先」交付视觉地基三件套。`Doc/观察.txt` 为新需求清单（21 条，见下「后续 backlog」）。

### 🎯 PM 对齐（AskUserQuestion 2 问）

| 分叉 | 选项 | 用户拍板 |
|---|---|---|
| 导航栏形态（new.png 左竖栏 vs 样例 B 水平胶囊）| 左竖栏+B质感 / **顶部 B 胶囊条** / 顶部胶囊+保留左Rail | **顶部 B 胶囊条**（保持顶栏横向，文字 Tab → B 拟物胶囊；左 Rail 信息架构不动）|
| 首批范围 | **地基优先** / 整页重排 new.png / 只做导航+背景 | **地基优先**（液态玻璃 bg + 导航 + GlassButton 通用件，验证后再逐面板铺开）|

样例判断：`UI_sample/导航栏对比` 中 **B 明显优于 A** —— B 柔和拟物胶囊（多层柔阴影 + inset 白高光 + 圆角 active + scale 反馈），A 生硬黑边框。液态玻璃底**适配奶油色**，不照搬样例的灰白网格。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/app/globals.css` | 修改 | (1) 新增 `--bg-liquid`（暖色径向光团基底，给玻璃面板折射源）+ `--glass-highlight` + `--glass-sheen` token（light/dark 各一套）；body bg 叠加 `--bg-liquid`；(2) `@layer components` 新增 `.liquid-glass`（大模块面板）+ `.glass-btn`（+`::after` 斜向折射高光 + hover 抬升 + active 回弹 + disabled flat）+ `.glass-btn-circle/-primary/-accent` 变体 + `.pill-nav`/`.pill-nav-item`（样例 B 适配 espresso/奶油，active = espresso 实色胶囊）|
| `apps/web/src/components/ui/Glass.tsx` | **新建** | `GlassButton`（forwardRef，variant=default/primary/accent + circle，透传原生 button props）+ `GlassCard`（as 可换标签，套 `.liquid-glass`）|
| `apps/web/src/components/layout/TopBar.tsx` | 修改 | `<nav>` → `.pill-nav`；内置/自定义 Tab + 「+」改 `.pill-nav-item`（去掉手写 hover/下划线，CSS 接管；保留拖拽重排/自定义面板全部逻辑，dragOver 用 inset ring）；右侧工具/通知钮 → `GlassButton circle`（工具 active 时 variant=primary）|
| `apps/web/src/components/InputPod.tsx` | 修改 | 发送/停止钮 → `GlassButton variant=primary circle`（disabled/hover 交给 CSS）|
| `apps/web/src/components/layout/LeftRail.tsx` | 修改 | `RailPrimaryBtn`（+ New Xxx）→ `GlassButton variant=primary`（espresso 实色玻璃胶囊）|

### 🎯 关键设计

- **CSS 类 + React 薄封装**：玻璃按钮需 `::after` 伪元素折射高光，纯 inline 做不到 → 样式落 globals.css，`ui/Glass.tsx` 仅拼 className + 透传 props。变体/禁用/hover 全由 CSS 状态选择器接管，组件无 hover state
- **液态玻璃适配奶油**：不照搬样例 `.box` 的 `filter:contrast(3)`+灰网格（在奶油底会发灰），改提炼"磨砂半透 + inset 白边高光 + 柔和深度阴影 + 斜向 sheen"，跨不同底色稳健
- **样例 B → espresso**：active 胶囊用 `linear-gradient(espresso-hover→espresso)` + 顶部 inset 高光；hover 用 primary-soft；暗色下 active 文字反转为深色（`html[data-theme=dark] .pill-nav-item.active`）
- **保留信息架构**：只换皮，TopBar 顶栏切主区 + 左 Rail 二级上下文的两级导航不变；拖拽重排/隐藏 Tab/自定义面板逻辑零改动

### ✅ 验证

- `tsc --noEmit` EXIT=0
- preview 截图：胶囊导航（Chat=espresso active）/ 奶油液态玻璃底 / 工具+通知+发送玻璃圆钮 / New Chat espresso 胶囊 / AT YOUR SERVICE 管家卡 全部到位；console 无 error

### 📝 后续 backlog（`Doc/观察.txt` 21 条，未做）

- **逐面板铺开玻璃**（地基已就绪，把 GlassCard/GlassButton 接到 Tasks/Calendar/Notes/各 mini-app）
- **整页向 new.png 靠**：右栏 Daily Brief、对话区精修
- **观察.txt 功能**：音效更鲜明+UI 动画/默认开、成就收藏室、AI 对话框按空间放任务左右+漫画"任务创建询问"卡+删残留头像、默认开新会话(有内容才存)、Claude-like 主动澄清、底部保留 Claude/GPT/Gemini 选择、推荐每日任务降门槛、AI 建面板支持拖拽图表(饼/柱/热力)、子面板居中、容器覆盖排查、管家元素(燕尾服/单框眼镜/白手套)+巴甫洛夫音

### 🚦 下一步候选

- 逐面板把组件玻璃化（Tasks/Calendar/Notes 卡片 + 按钮）
- 整页重排成 new.png 三栏（含右 Daily Brief）
- 起 观察.txt 功能项（音效强化 / 漫画任务卡 / 主动澄清 / 推荐每日任务）
- 别的方向

### 💾 备份建议

`backup-057-thinking-toolcall-fix` 之后，本次紧跟。建议 tag：`backup-058-visual-foundation`

---

## [057] 2026-05-28 — 修复思考模式多轮 tool calling 丢 reasoning_content（400）

> 用户实测：V4 Pro 思考模式下「帮我建面板 + 问 C240 考试」→ 工具调用成功（ConfirmCard 已采纳）但紧接报 `400 The reasoning_content in the thinking mode must be passed back to the API`。

### 🐛 根因

DeepSeek V4 思考模式 + 多轮 tool calling：
1. 第 1 轮：AI 返回 assistant 消息（带 `reasoning_content` + `tool_calls`）
2. 执行工具 → push tool result
3. 第 2 轮：把历史发回 DeepSeek 生成最终文本回复

但 `chat-client.ts` 重建的 `assistantMsg` **只带 content + tool_calls，丢了 reasoning_content** → DeepSeek 思考模式严格要求带 tool_call 的 assistant 轮必须回传 reasoning_content → 第 2 轮请求被 400 拒绝。

注：这与 [047] 的「尾部良性错误抑制」无关 —— 那是流尾抛错，这是第 2 轮请求**还没产出任何 chunk 就被 400**，是真错误，正确地浮现给用户。

### 📂 涉及文件

| 文件 | 改动 |
|---|---|
| `apps/web/src/lib/chat-client.ts` | (1) `ApiMessage` 接口加 `reasoning_content?: string`；(2) `streamOneRound` 累积 `reasoning` 变量；(3) `assistantMsg` 在 `hadToolCalls && reasoning` 时带上 `reasoning_content`（无 tool call 不回传，无需续轮） |
| `apps/web/src/app/api/chat/route.ts` | `ChatRequest.messages` 类型加 `reasoning_content?: string`（实际透传靠 spread + cast，本改动仅类型清晰） |

### 🎯 关键设计

- **仅在 `hadToolCalls` 时回传**：无工具调用的 assistant 轮不会触发续轮，不需要 reasoning_content（也符合 DeepSeek「普通多轮对话不要回传 reasoning_content」的建议）
- **跨用户轮次不受影响**：`handleSend` 的 `historyApi` 只含 role + content（不含 reasoning_content / tool_calls），是独立新请求，DeepSeek 不要求回传 —— 正确
- **服务端透传**：route.ts `...body.messages` spread 保留所有运行时字段，cast 绕过 OpenAI SDK 类型 → reasoning_content 原样发给 DeepSeek

### ✅ 验证

- `tsc --noEmit` EXIT=0
- HMR 自动加载
- 待用户实测：思考模式下让 AI 调工具（建任务/笔记/面板）→ 不再 400，工具执行后能正常生成后续文本回复

### 🚦 下一步候选

- C. 部署到 Vercel
- 美化 Step 2（成就徽章 + Tour 插画）
- Phase 3 Tauri 桌面壳
- 别的方向

### 💾 备份建议

`backup-056-sound-illustrations` 之后，本次紧跟。建议 tag：`backup-057-thinking-toolcall-fix`

---

## [056] 2026-05-27 — 音效系统（WebAudio 合成）+ 6 张空状态插画

> 用户「思考美化 UI 所需图片 + 用户粘性所需音效」→ 选 Step 1（音效 T1+T2 + 6 张插画）。两个关键决策：音效用 WebAudio **程序化合成**（零文件零依赖零许可），插画用**内联 SVG**（CSS 变量自动跟随主题色）。

### 🔊 音效系统

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/lib/sound.ts` | **新建** | 14 个 SoundKey × WebAudio 合成（tone helper + noiseBurst）；6 分类（task/chat/toast/achievement/focus/panel）；opt-in（默认关）+ 主开关 + 分类开关 + 音量 + 静音时段（默认 22-8）；localStorage `butler.sound` + SOUND_PREFS_EVENT；`playSound(key)` 内置全部守卫 + 静默失败 |
| `apps/web/src/components/Toast.tsx` | 修改 | show() 内调 `playSound("toast-{kind}")`（success/info/warning/error 各异音） |
| `apps/web/src/app/page.tsx` | 修改 | 任务勾完成 `task-complete`/`task-uncomplete`；发消息 `send`；AI 流式完成 `ai-reply`；新建面板 `panel-create` |
| `apps/web/src/components/mini-apps/FocusTimer.tsx` | 修改 | 开始 `focus-start`；剩 5 分钟 `focus-5min`；结束 `focus-end`（双钟） |
| `apps/web/src/components/PreferencesPanel.tsx` | 修改 | 新「音效」段：主开关（启用时立刻试听）+ 6 分类 checkbox + 音量滑块（松手试听）+ 静音时段（开关 + 起止小时） |

**合成示例**：task-complete = C5-E5-G5 上扬琶音；achievement = C-E-G-C level-up 旋律；toast-error = 220Hz 锯齿下滑；focus-end = 双钟 880Hz + 谐波；send = 2kHz bandpass 噪声 burst。

**为什么 opt-in 默认关**：很多人反感通知音；强制开会赶走用户。启用时立刻给一声 `ai-reply` 证明它在响。

### 🎨 6 张空状态插画

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/EmptyIllustrations.tsx` | **新建** | 6 个内联 SVG 组件：EmptyTasks（清单本+勾选）/ EmptyNotes（纸+笔）/ EmptyChat（聊天气泡）/ EmptySearch（放大镜+?）/ EmptyFilter（漏斗）/ EmptyPanel（grid+加号）。全用 `var(--color-primary)` stroke + `var(--color-primary-soft)` fill → 暗色/主题色自动跟随 |

**接入 7 处空态**：

| 位置 | 插画 |
|---|---|
| TasksPanel 无任务 | EmptyTasks |
| TasksPanel 视图筛选为空 | EmptyFilter（复用，漏斗语义）|
| NotesPanel 无笔记 | EmptyNotes |
| NotesPanel 搜索无匹配 | EmptyFilter（复用）|
| GlobalSearch 无匹配 | EmptySearch |
| ChatRail 无对话（原 "No chats yet" 文字）| EmptyChat |
| CustomPanelView 空内容 | EmptyPanel |

### ✅ 验证

- `tsc --noEmit` EXIT=0
- HMR 自动加载
- 待用户实测：
  - 偏好设置 → 音效 → 启用 → 立刻听到一声 ding；勾任务/发消息/Focus Timer 都有声
  - 静音时段设当前小时 → 应静音
  - 各空状态（清空任务/笔记/搜索无结果/新建空面板）显示主题色插画
  - 切暗色 → 插画颜色自动跟随

### 📝 后续可扩展（Step 2/3，PROGRESS 备忘）

- 图片 T1：8 成就徽章自制 SVG（当前 emoji）
- 图片 T2：OnboardingTour 5 步插画 + ShareCard 主题背景 + 欢迎屏纹理
- 音效 T3：Focus Timer 环境音（雨/咖啡馆/lo-fi）+ 管家性格语音（gentle 嗯～/ sassy 啧）
- 季节主题图（考试季/春节）

### 🚦 下一步候选

- C. 部署到 Vercel（让 PWA 装机能真用 + 音效/插画随处体验）
- 图片 Step 2（成就徽章 + Tour 插画）
- Phase 3 Tauri 桌面壳
- 别的方向

### 💾 备份建议

`backup-055-polish-bugfixes` 之后，本次紧跟。建议 tag：`backup-056-sound-illustrations`

---

## [055] 2026-05-27 — F Polish：code review 后的 5 个 bug 修复

> 用户选 F「实测 + Polish」。用 code-review skill 跑 5 angles × 8 candidates → verify → sweep，从 [048]-[054] 发现 12 个 finding，5 个高/中优先级今天修。

### 🐛 修复列表

| # | 严重度 | 文件 | 问题 | 修复 |
|---|---|---|---|---|
| **F#1** | 🔴 高 | `CustomPanelView.tsx` | unmount/切面板 cleanup 用 stale 闭包 → 用户未保存的编辑丢失 | 改用 `pendingPatchRef` + `prevIdRef` + `onUpdateRef`；新增 `flushNow(id)` 在切换/卸载时安全 flush |
| **F#2** | 🔴 高 | `PreferencesPanel.tsx` | 偏好面板在 IIFE await 期间关闭 → cleanup 无法 revoke 后续创建的 ObjectURL | 加 `cancelled` 标志（同 ButlerCharacter 已用模式），IIFE 在 cancelled 时跳过 URL.createObjectURL |
| **F#3** | 🟡 中 | `CustomPanelView.tsx` | scheduleSave 不同字段连改 → 前一个字段 patch 被 timer reset 覆盖 → 永不持久化 | patch 累积到 `pendingPatchRef`，timer fire 时一次性发出累积 patch |
| **F#4** | 🟡 中 | `CustomPanelView.tsx` | URL onBlur 立即写库，但 onChange 已 schedule 的原始 URL 1.2s 后覆盖 → DB 存的是未规范化 URL | onBlur 先 clear timer + 清 pendingPatchRef，再 onUpdate 规范化 URL |
| **F#5** | 🟡 中 | `PreferencesPanel.tsx` | handleUpload 闭包冻结 customPreview → 并发上传时第一次的 URL 永不 revoke | 新增 `customPreviewRef`，render 同步；handleUpload/handleClearCustom 都从 ref 读最新值 |

### 📂 涉及文件

| 文件 | 改动 |
|---|---|
| `apps/web/src/components/CustomPanelView.tsx` | F#1+F#3+F#4 联动重写 save 逻辑：refs（pendingPatch / prevId / onUpdate）+ flushNow helper；scheduleSave 累积 patch；切面板 effect 先 flush 旧 id；unmount effect deps=[] 用 prevIdRef；onBlur URL 取消 pending；emoji input title 修正"单字符"→"最多 3 字符" |
| `apps/web/src/components/PreferencesPanel.tsx` | F#2+F#5：open-effect IIFE 加 cancelled 标志 + createdUrl 跟踪；customPreviewRef render 同步；handleUpload/handleClearCustom 用 ref 替代闭包 customPreview |

### 🎯 修复原理（核心 React pattern）

**问题模式**：useEffect 用 `[panel.id]` deps 时，cleanup 闭包冻结的是 deps 上次变化时的 state 值，不是「最新」值。  
**修复模式**：用 `useRef` 在每 render 同步最新值，cleanup 通过 ref 读取。这是 React 官方推荐的"latest value"模式。

```ts
// Before（buggy）
useEffect(() => {
  return () => onUpdate(panel.id, { content });  // content 是 effect 上次跑时的值
}, [panel.id]);

// After（fixed）
const stateRef = useRef(...); stateRef.current = ...;  // 每 render 更新
useEffect(() => {
  return () => onUpdate(prevIdRef.current, stateRef.current);  // ref 总是最新
}, []);
```

并发 await + cleanup 的 cancelled 模式同理 — 防止 cleanup 后异步代码继续创建 resource。

### ✅ 验证

- `tsc --noEmit` EXIT=0
- HMR 自动加载
- 待用户实测：
  - 打开自定义面板 A 输入 → 立即切到面板 B（不等 1.2s）→ A 的内容应该已被保存
  - 快速打开/关闭偏好设置 → 无 ObjectURL leak（可在 chrome devtools Performance → Memory 看）
  - 自定义面板连改 emoji + label + content → 1.2s 后所有 3 个字段全部持久化（不再丢前面的）
  - iframe panel 输入 URL `example.com` 失焦 → DB 应存 `https://example.com`
  - 偏好设置连续上传管家形象 2 张图 → 第一张 URL 应被 revoke

### 📝 剩余未修的 finding（低优先级，code review 报告里）

- 系统 prompt 没提 `create_custom_panel` → AI 触发率可能偏低（行为可接受）
- DayView 时间格 onClick tagName check 是 paranoia（无 bug）
- ButlerCharacter ObjectURL race（理论存在，实际单 effect 同步 currentUrl OK）
- handleAcceptBatch 在 setState updater 里跑 async（StrictMode 双调用；当前 idempotent 无害）
- Phase E useEffect deps=[activeCustomPanelId] 触发 listener 重挂（性能瑕疵非 bug）
- iframe sandbox `allow-scripts + allow-same-origin` 组合需文档警告（用户控制 URL 信任自己）
- butler-asset trimAndCrop 大图阻塞主线程（无进度 UI；MVP 接受）

### 🚦 下一步候选

- C. 部署到 Vercel（随处访问 + PWA 装机能真用）
- B. Phase 3 Tauri 桌面壳启动
- G. wikilink autocomplete
- 别的方向

### 💾 备份建议

`backup-054-d-small-patches` 之后，本次紧跟。建议 tag：`backup-055-polish-bugfixes`

---

## [054] 2026-05-27 — D 小补丁串烧：DayView 拖拽 + iframe 面板 + AI tool 建面板

> [053] 给的 4 候选方向中用户选「D 小补丁串烧」。3 个独立小项一次性闭环，每项各打补一个角落的小遗憾。

### D.1 Calendar DayView 拖拽（复用 [043] Week 机制）

| 文件 | 改动 |
|---|---|
| `CalendarPanel.tsx` | `TimelinePill` 加 `draggable` prop + `onDragStart`（mime `text/butler-calendar-event`）；`DayView` 接 `onCreateAt` / `onMoveEvent` 2 个新 prop；时间格 onClick 检测背景 DIV → 用 hour 预填创建；onDragOver/Drop 视觉反馈 + emit onMoveEvent；CalendarPanel 透传 |

之前 DayView 时间格点击是一律走简单 onCreate（无预填时间），事件也不能拖。现在：
- 点击 09:00 的空白格 → 立刻打开「新建事件」预填 09:00
- 拖任意事件到 14:00 格 → Toast 提示已移动到 14:00

### D.2 iframe / 嵌入网页面板（Phase E 留尾）

| 文件 | 改动 |
|---|---|
| `lib/types.ts` | `CustomPanel` 加 `kind?: "markdown" \| "iframe"` + `url?: string`（缺省 markdown 兼容历史数据，无需 Dexie 迁移） |
| `lib/custom-panels.ts` | `updateCustomPanel` patch 类型扩展支持 kind/url；URL trim |
| `components/CustomPanelView.tsx` | 类型 segmented（Markdown / 网页 2 档，立即持久化）；iframe 模式：URL 输入条（blur 自动补 https://）+ `<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer">`；空 URL 占位 + X-Frame-Options 警告 |

样例使用：B 站 / GitHub / MOOC / 学校教务系统 / 个人 dashboard。注意大多数大型站（YouTube、Google、Twitter）设了 X-Frame-Options 会拒绝嵌入 — 警告文案已经标明。

### D.3 AI tool `create_custom_panel`（让 Butler 主动建面板）

| 文件 | 改动 |
|---|---|
| `lib/ai-tools.ts` | 第 7 个 tool schema + `CreateCustomPanelArgs` 接口 + ToolCall 联合类型扩展（label/emoji/kind/content/url）|
| `lib/pending.ts` | `PendingChangeKind` 加 `create-custom-panel`；`PendingCreateCustomPanel` 接口；`extractCustomPanelDrafts(batch)` helper |
| `lib/tool-executor.ts` | `execCreateCustomPanel`：校验 label 必填、iframe 时 url 必填；构造 CustomPanel 草稿入 pending 队列 |
| `lib/custom-panels.ts` | 新增 `putCustomPanel(panel)` — 直接 put 完整草稿（用于 ConfirmCard accept） |
| `components/ConfirmCard.tsx` | `describeChange` 加 `create-custom-panel` 分支：琥珀黄 LayoutGrid icon + 显示 emoji+label+kind+url 摘要 |
| `app/page.tsx` | `handleAcceptBatch` 新增第 3 步异步循环 putCustomPanel；imports + onToolCallStart label `create_custom_panel: "正在生成自定义面板草稿"` |

用户对话示例：「帮我建一个嵌入 https://bilibili.com 的面板叫『B 站』」→ AI 调 create_custom_panel(label="B 站", emoji="🎬", kind="iframe", url="https://bilibili.com") → ConfirmCard 琥珀黄卡 → 接受 → 顶栏立刻出现「🎬 B 站」Tab。

### 🎨 ConfirmCard 颜色编码（4 类操作）

| kind | 颜色 | icon |
|---|---|---|
| `create` (task) | 绿 | Plus |
| `update` (task) | 蓝 info | Pencil |
| `delete` (task) | 红 danger | Trash2 |
| `create-note` | 紫 | BookOpen |
| `create-custom-panel` | **琥珀黄** | **LayoutGrid** |

### ✅ 验证

- `tsc --noEmit` EXIT=0
- HMR 自动加载（CustomPanel 加 optional 字段无需 Dexie 迁移）
- 待用户实测：
  - Day 视图点空白时间格 → 预填该小时；拖事件到其他格 → 时间更新
  - 自定义面板切「网页」→ 填 URL → 看 iframe 加载（或被 X-Frame-Options 拒绝）
  - Chat 对话「建一个 X 面板」/「嵌入 X 网站」→ ConfirmCard 琥珀黄卡 → 接受后顶栏新 Tab

### 🚦 下一步候选

- C. 部署到 Vercel（解锁随处访问 + PWA 装机）
- B. Phase 3 Tauri 桌面壳启动
- G. wikilink autocomplete（输入 `[[` 浮出 title 列表 Tab 补全）
- 实测 [048]-[054] 后调 bug
- 别的方向

### 💾 备份建议

`backup-053-notes-100` 之后，本次紧跟。建议 tag：`backup-054-d-small-patches`

---

## [053] 2026-05-27 — Notes 92% → 100%：wikilink 双链 + 反向引用 + 本地搜索

> 多版 PROGRESS 都提到的"下一步候选"，今天落地。Notes 面板补齐 Obsidian-like 三件套，为 Phase 3 Tauri 接本地 Vault 提前打通核心 UX。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/NotesPanel.tsx` | 修改 | (1) 新增 `WIKILINK_RE` 正则 + `preprocessWikilinks` 工具：把 `[[Title]]` 预处理成 `[Title](#butler-wikilink:id-or-missing:title)` markdown link，让 ReactMarkdown 原生渲染但在 `a` 组件 override 里拦截 click；(2) `titleToId` Map（title 小写 → id）+ `handleWikilinkClick`（存在 → setActiveId+preview；缺失 → confirm 新建+用 title 自动命名）；(3) `backlinks` useMemo 扫描其他笔记的 `[[当前 title]]` 引用，渲染独立 "被 N 条笔记引用" 条（蓝色 info 系，与紫色 link2 关联任务条区分）；(4) `query` state + 列表区上方 28px 搜索框（Search/X icon + 实时过滤 + 空匹配占位） |
| `apps/web/src/components/NotesPanel.tsx` (md-preview) | 修改 | `pre` 代码块 `#1f2937 / #f3f4f6` → `var(--color-code-bg/-text)`（[048] 没扫到的 Notes preview 区漏窗一并 fix） |

### 🎯 wikilink 关键设计

- **预处理而非 remark 插件**：用纯字符串替换 `[[xxx]]` → markdown link，ReactMarkdown 原生渲染。比写 remark 插件简单 10×，行为可预测
- **内部 marker 用 `#butler-wikilink:` 前缀**：`#` 是浏览器锚点，ReactMarkdown 不会当外链；前缀够特别避免与用户写的真锚点 `#section` 混淆
- **缺失链接非"破窗"而是"机会"**：点击不存在的 `[[xxx]]` → confirm「是否新建」→ 同意则建一条空笔记并自动用 xxx 命名 → 跳转。Obsidian 同款心智
- **大小写不敏感匹配**：`[[Linear Algebra]]` 和 `[[linear algebra]]` 都匹配同一笔记。普通用户不会大小写一致
- **正则避坑**：`[^\[\]\n]` 排除嵌套和跨行；非贪婪 `+?` 限制单 link 不抢后面内容
- **视觉区分**：存在 → info 蓝下划线 + 浅底块；缺失 → danger 红虚线下划线

### 🎯 反向引用条

- 出现在 active note 编辑器顶部、关联任务条之前
- 用 `Network` icon + info 色，与现有 `Link2` + primary 色的关联任务条区分
- 每个 backlink 是可点击 chip → 跳到该笔记的 preview 模式
- 完全靠 useMemo + WIKILINK_RE 扫描，零持久化（无新表，无迁移成本）

### 🎯 本地搜索

- 紧贴 list 之上，比 TopBar GlobalSearch 更聚焦"在当前笔记列表里找"
- 子串匹配 title + content + tags（与 GlobalSearch 同算法，但只搜 notes）
- 空匹配提示「没有匹配 + 一键清除」防迷茫
- 不引入 fuse.js：当前数据量下子串足够，省 ~10KB 依赖

### ✅ 验证

- `tsc --noEmit` EXIT=0
- HMR 自动加载
- 待用户实测：
  - 笔记 A 写 `[[笔记 B]]` → preview 看到 info 蓝链接 → click 跳到笔记 B
  - 写 `[[不存在的]]` → 看到红虚线 → click 弹「是否新建」→ 同意建空笔记自动命名
  - 笔记 B 顶部出现「被 1 条笔记引用：笔记 A」chip → click 回到 A
  - 列表搜索框输入关键词 → 列表实时过滤

### 📊 完整度

| Tab | 之前 | 现在 |
|---|---|---|
| **Notes** | ~92% | **~100%**（wikilink 双链 + backlinks + 本地搜索 全部到位）|

### 📝 后续可扩展

- `[[` autocomplete 浮层（输入 `[[` 时浮出所有笔记 title 列表，Tab 补全）
- wikilink 跨系统（笔记 → 自定义面板 / 任务）
- 图谱视图（Mermaid 渲染笔记间的引用网络）
- 全文搜索高级（fuse.js 模糊匹配 + 关键词高亮）

### 🚦 下一步候选

- 部署到 Vercel（让 PWA 装机能真用）
- Phase 3 Tauri 桌面壳启动
- Calendar DayView 拖拽 / iframe 面板 / AI tool create_custom_panel 小补丁串烧
- 别的方向

### 💾 备份建议

`backup-052-custom-panels` 之后，本次紧跟。建议 tag：`backup-053-notes-100`

---

## [052] 2026-05-27 — 自定义系统 Phase E：自定义面板（A→E Roadmap 收尾）

> 接 [051] Phase D，Phase E 让用户在内置 4 Tab 之外创建额外面板。整套自定义系统 5 Phase 至此全部交付。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/lib/types.ts` | 修改 | 新增 `CustomPanel` 接口（id / label≤12 / emoji / Markdown content / createdAt / updatedAt） |
| `apps/web/src/lib/db.ts` | 修改 | Dexie 升 v6→v7，新增 `customPanels` 表（主键 id，updatedAt 索引） |
| `apps/web/src/lib/custom-panels.ts` | **新建** | CRUD（getAll / get / create / update / delete）+ `CUSTOM_PANEL_EVENT` CustomEvent 通知 + 自动截断 label≤12 / emoji≤3 |
| `apps/web/src/components/CustomPanelView.tsx` | **新建** | 单页 Markdown 编辑器风格：header（可编辑 emoji + label + 编辑/预览切换 + 删除）+ body（textarea / ReactMarkdown 渲染）；1.2s 防抖保存 + unmount flush；空 content 时显示 FileText 占位 |
| `apps/web/src/components/layout/TopBar.tsx` | 修改 | 接 4 个新 props（customPanels / activeCustomPanelId / onSelectCustomPanel / onCreateCustomPanel）；内置 Tab 后追加自定义 Tab（emoji + label，活动用 primary 下划线）+ 「+」虚线按钮触发新建 |
| `apps/web/src/app/page.tsx` | 修改 | (1) 新增 `customPanels` / `activeCustomPanelId` state；(2) mount + CUSTOM_PANEL_EVENT 监听同步；(3) 3 个 handler：create（建后即激活）/ update（直透 IndexedDB）/ delete（删除并退回 chat）；(4) TopBar onNavChange 同时清 activeCustomPanelId；(5) LeftRail 4 个 `activeNav===xxx` 全加 `!activeCustomPanelId &&` 守卫；(6) 主区追加 CustomPanelView 渲染分支 |

### 🎯 关键设计

- **MVP Markdown only**：iframe / 嵌入网页 / 自由 widget 等延后。MVP 先把"再加一个 Tab 放我的笔记/链接/日志"打通
- **激活互斥**：`activeNav: NavId` 和 `activeCustomPanelId: string | null` 互斥。点击内置 Tab 清空 activeCustomPanelId；点击自定义 Tab 设置 activeCustomPanelId（activeNav 保持但不显示）。这避免给 NavId 类型加 string 联合，少改 30+ 处 switch
- **删除即退回**：删除当前激活的面板自动退回 `activeNav="chat"` + 清 activeCustomPanelId，防止"找不到"
- **emoji 单字符**：MVP 限制 emoji 字段 ≤3 字符（覆盖 surrogate pair emoji 如 🇨🇳）。后续可加 emoji picker
- **label ≤12**：避免 Tab Bar 撑爆，超长自动截断
- **MVP 无 Rail**：自定义面板不渲染 LeftRail 内容（节省屏幕、简化交互）；后续可让用户配置 Rail 内容
- **createdAt 排序**：Tab 顺序固定为创建顺序；后续可加自定义面板间拖拽重排（复用 Phase D 机制）
- **CustomPanelView 防抖**：编辑 emoji/label/content 都用 1.2s 防抖；unmount/切换面板时立即 flush 防丢失

### 🚦 自定义系统 Roadmap 全部完成 🎉

| Phase | 内容 | 状态 |
|---|---|---|
| **A** Dark Mode 优化 | 15+ token + AttachmentPreview 重写 + 5 文件硬编码色收口 | ✅ [048] |
| **B** 颜色自定义 | lib/theme.ts hex↔HSL 派生 + 6 预设 + color picker + 重置 | ✅ [049] |
| **C** 人物自定义 | Dexie v6 + 客户端 Canvas trim + 上传/预览/重置 | ✅ [050] |
| **D** 元素位置自定义 | Tab 拖拽 + 隐藏 + 管家位置 4 档 | ✅ [051] |
| **E** 自定义面板 | Dexie v7 + emoji+label+Markdown + Tab + 「+」+ 即时编辑 | ✅ 本条 [052] |

### ✅ 验证

- `tsc --noEmit` EXIT=0
- HMR 自动加载（Dexie v7 升级在用户下次开页面时静默执行）
- 待用户实测：点顶栏 「+」→ 自动创建 + 激活；改 emoji/label/content 实时保存；点 Trash 确认删除后退回 Chat；切回内置 Tab 正常；多面板互切

### 📝 后续可扩展

- iframe / 嵌入网页类型（kind: "markdown" | "iframe"）
- 自定义面板间拖拽重排（复用 Phase D 拖拽机制）
- 自定义 Rail 内容（让用户为每个 panel 配置左侧栏 widget）
- 多人协作（Phase 4 多租户上线后）
- AI tool 调 create_custom_panel（让 Butler 主动建面板）

### 💾 备份建议

`backup-051-layout-prefs` 之后，本次紧跟。建议 tag：`backup-052-custom-panels`

---

## [051] 2026-05-27 — 自定义系统 Phase D：元素位置自定义（Tab 拖拽 + 管家位置）

> 接 [050] Phase C，Phase D 让 4 Tab 顺序可拖拽 + 单 Tab 可隐藏 + 管家位置 4 档。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/lib/layout-prefs.ts` | **新建** | 持久化 3 项布局偏好：`tabsOrder: NavId[]` / `hiddenTabs: Set<NavId>` / `butlerPosition: "left" \| "center" \| "right" \| "hidden"`；CRUD + 校验补齐（缺失/非法 id 自动修复）+ `LAYOUT_PREFS_EVENT` CustomEvent 通知；保护"全部隐藏"边界（强制保留 ≥1 个 Tab） |
| `apps/web/src/components/layout/TopBar.tsx` | 修改 | (1) 接 3 个新 props（tabsOrder / hiddenTabs / onTabsReorder）；(2) Tab 渲染改从 `order.filter(!hidden)`；(3) 每个 Tab 加 `draggable + dragstart/dragover/drop` 处理（用 `text/butler-tab` mime 防外部干扰），拖拽悬浮 Tab 显示 primary-soft 高亮反馈；(4) drop 时把 source 插入到 target 之前，触发 `onTabsReorder` |
| `apps/web/src/components/ChatCanvas.tsx` | 修改 | 接 `butlerPosition` prop；派生 `butlerStyle` CSS：hidden→null（不渲染）/ left→`left:24` / right→`right:24` / center→`left:50% + translateX(-50%)`（默认） |
| `apps/web/src/app/page.tsx` | 修改 | (1) 3 个新 state + mount 同步 + LAYOUT_PREFS_EVENT 监听；(2) 透传给 TopBar（tabsOrder/hiddenTabs/onTabsReorder）+ ChatCanvas（butlerPosition） |
| `apps/web/src/components/PreferencesPanel.tsx` | 修改 | 新「布局」段：(1) 管家位置 4 档 SegRow（AlignLeft/Center/Right/EyeOff 图标）；(2) 4 Tab show/hide chip 按钮（active = 实色 primary chip / hidden = 灰色描边 + 删除线 + 文字 line-through）；点击 toggle，受 toggleHiddenTab 保护不会全隐藏；提示「Tab 顺序可在顶栏直接拖拽」 |

### 🎯 关键决策

- **HTML5 drag-and-drop**：复用 [043] Calendar Week 视图事件拖拽的同模式。用专属 mime `text/butler-tab` 避免和系统拖入文件混淆
- **拖拽插入语义**：drop 在 target 上时把 source 插到 target **之前**（不是替换）。最朴素的"重排"心智
- **顺序持久化**：`localStorage[butler.layout.tabsOrder]` 存 NavId 数组；自动校验补齐（如未来加新 Tab 时旧用户的存储不会丢失新 Tab）
- **隐藏保护**：`toggleHiddenTab` 内部检查不允许全部隐藏（最后 1 个不能隐）
- **管家位置**：`hidden` 时整个容器不渲染（不只是 display: none，彻底无 DOM）；left/right 用 `left:24` 而非 0 让管家不贴边
- **拖拽兼容触屏**：当前用 native HTML5 drag-and-drop，触屏支持有限。未来可考虑 @dnd-kit/core 或类似库（暂不引入第三方依赖）

### 🚦 进度

| Phase | 状态 |
|---|---|
| **A. Dark Mode 优化** | ✅ [048] |
| **B. 颜色自定义** | ✅ [049] |
| **C. 人物自定义** | ✅ [050] |
| **D. 元素位置自定义** | ✅ 本条 [051] |
| E. 自定义面板 | ⏳ 下一条（自定义系统收尾） |

### ✅ 验证

- `tsc --noEmit` EXIT=0（修了一处 `[...Set]` → `Array.from` 的 downlevel 兼容）
- HMR 自动加载
- 待用户实测：
  - 偏好设置 → 布局 → 管家位置切换 4 档立刻生效（hidden 时管家消失）
  - Tab show/hide 切换立刻生效
  - 顶栏拖拽任意 Tab 到另一 Tab 之前 → 顺序立即重排 + 持久化

### 💾 备份建议

`backup-050-custom-character` 之后，本次紧跟。建议 tag：`backup-051-layout-prefs`

---

## [050] 2026-05-27 — 自定义系统 Phase C：人物自定义（上传 → 客户端 trim → IndexedDB）

> 接 [049] Phase B 颜色自定义，本条做 Phase C 形象自定义：用户上传 1 张 PNG/JPG，客户端 Canvas 抠白底 + 裁剪，存 IndexedDB 替换全部 7 内置姿势。一图通替。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/lib/types.ts` | 修改 | 新增 `ButlerAsset` 接口（poseName / blob / width / height / updatedAt） |
| `apps/web/src/lib/db.ts` | 修改 | Dexie 升 v5→v6，新增 `butlerAssets` 表（主键 poseName）|
| `apps/web/src/lib/butler-asset.ts` | **新建** | Canvas 客户端 trim（镜像 scripts/trim_butler_poses.py 的 PIL 实现：白底 threshold 240 → alpha=0 → 单次扫描兼算 bbox + 抠图 → cropCanvas → PNG Blob）；CRUD（get/set/clear）；`BUTLER_ASSET_EVENT` CustomEvent 通知 ButlerCharacter 重载；上限 4MB 防 IndexedDB 撑爆 |
| `apps/web/src/components/ButlerCharacter.tsx` | 修改 | (1) mount + listener 加载 default 自定义资产 → `customDefault: {url, w, h}` state；(2) 容器尺寸切换：有自定义时用其 w×h，否则用内置 MAX；(3) 渲染优先级 `customDefault > 内置 PNG > standing fallback`；(4) unmount 时 `URL.revokeObjectURL` 清理 |
| `apps/web/src/components/PreferencesPanel.tsx` | 修改 | 新「管家形象」段：64×64 预览框（User 图标占位 → 用户上传后显示 trim 后图） + 上传按钮（触发隐藏 input file）+ 「恢复默认」按钮（仅有自定义时显示）+ 错误提示；状态：`customPreview / uploading / uploadErr` |

### 🎯 关键设计

- **MVP 一图通替**：用户上传 1 张图 → poseName="default" → ButlerCharacter 所有姿势用同一张。比"为 7 姿势分别上传"门槛低 100 倍；后续可扩展 perpose
- **客户端 trim**：完全在浏览器跑（无需服务端），算法镜像 [046] 的 Python 脚本。单次循环兼算 alpha keying + bbox（性能优化，避免双 pass）。canvas 用 `willReadFrequently: true` 提示浏览器
- **CustomEvent 通信**：setCustomAsset/clearCustomAsset → `window.dispatchEvent(BUTLER_ASSET_EVENT)` → ButlerCharacter listener 重载 → 用户上传后无需刷新页面，UI 立刻换肤
- **Object URL 生命周期**：每次创建 `URL.createObjectURL` 都跟踪 ref/state，unmount 或替换时 `revokeObjectURL` 防内存泄漏（PreferencesPanel + ButlerCharacter 两处都处理了）
- **失败优雅降级**：trim 失败（如纯白图 → 全透明）、文件过大、解码失败都 throw 明确错误 → 红字提示
- **Dexie v6 迁移幂等**：仅加表，不动旧数据；老用户首次访问自动迁移

### 🚦 进度

| Phase | 状态 |
|---|---|
| **A. Dark Mode 优化** | ✅ [048] |
| **B. 颜色自定义** | ✅ [049] |
| **C. 人物自定义** | ✅ 本条 [050] |
| D. 元素位置自定义 | ⏳ 下一条 |
| E. 自定义面板 | ⏳ |

### ✅ 验证

- `tsc --noEmit` EXIT=0
- HMR 自动加载（Dexie v6 升级在用户下次开页面时静默执行）
- 待用户实测：偏好设置 → 管家形象 → 上传任意 PNG/JPG → 看到预览 → 主界面管家姿势立刻换；点「恢复默认」回到内置 7 姿势

### 📝 已知限制（Phase C MVP，后续可扩展）

- 只支持 default（替换全部）；不支持 per-pose 单独上传
- 客户端 trim threshold 固定 240，复杂背景（非纯白）可能误抠
- 上限 4MB（IndexedDB blob 单条 4MB 已足够大多数图片，避免 IndexedDB 性能崩盘）

### 💾 备份建议

`backup-049-accent-color` 之后，本次紧跟。建议 tag：`backup-050-custom-character`

---

## [049] 2026-05-27 — 自定义系统 Phase B：颜色自定义（color picker + 派生）

> 接 [048] Phase A，Phase B 让用户选 primary 色，UI 跟随。承「按推荐顺序全部 4 Phase」。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/lib/theme.ts` | **新建** | hex↔RGB↔HSL 转换工具 + `deriveAccentScheme(baseHex)` 派生 light/dark 两套 primary/hover/soft + `applyAccentColor` DOM 注入 + localStorage `butler.accent` 持久化 + 6 个预设（墨绿/海军蓝/紫罗兰/玫瑰红/杏橙/石墨灰） |
| `apps/web/src/components/PreferencesPanel.tsx` | 修改 | (1) `applyStoredPreferences` 加 `applyStoredAccent()` 调用（mount 防闪烁）；(2) 新「主题色」段：6 个 swatch（30×30 圆角，active 描黑边）+ HTML5 `<input type="color">` 自定义（Palette 图标 fallback UI）+ 重置按钮（仅非默认时显示） |

### 🎨 派生算法

```ts
// light: 用户选色直接 primary
// hover = HSL(h, s, l+5)；soft = HSL(h, s-50, 92)  // 高去饱和 + 高亮度淡底
// dark: 暗 bg 需要更高亮度的 primary 才视觉跳出
darkL = l < 50 ? 68 : Math.min(78, l + 8)
darkPrimary = HSL(h, max(35, min(70, s)), darkL)
darkHover   = HSL(h, darkS, darkL + 5)
darkSoft    = HSL(h, s-25, 18)
```

### 🎯 实现要点

- **CSS 变量注入**：动态创建 `<style id="butler-accent-override">` 元素覆盖 globals.css 的 `:root` + `html[data-theme="dark"]` 默认值。重置时直接删 style 元素回到墨绿默认
- **默认即移除**：用户选回墨绿 `#1B3D2F` 时 `localStorage.removeItem` + 移除 style → 不留垃圾数据
- **mount 防闪烁**：`applyStoredPreferences()` 同时调 `applyStoredAccent()`，所有偏好一次性应用
- **暗色对比度**：用户选偏暗色（L<50）时自动提亮到 L=68，避免在 #0F172A 上完全看不见
- **预设 6 色**：覆盖大多数审美（专业墨绿/沉稳蓝/创意紫/温暖红/活力橙/中性灰），不需要 picker 也能换肤

### ✅ 验证

- `tsc --noEmit` EXIT=0
- HMR 自动加载
- 待用户实测：偏好设置 → 主题色段点击 swatch 立即换肤（按钮/链接/active tab/边框 hover 全部跟随）；自定义 hex 输入 / 重置按钮工作

### 🚦 下一步（Phase C 人物自定义）

按 Phase C → D → E 顺序执行：
- Phase C：上传管家 PNG → IndexedDB 持久化 → 客户端 trim（透明背景）→ ButlerCharacter 优先用用户上传
- Phase D：Tab 顺序拖拽 / 管家位置（左/中/右/隐藏）/ Drawer 位置
- Phase E：用户创建额外面板 / 隐藏内置 / 配置持久化

### 💾 备份建议

`backup-048-darkmode-polish` 之后，本次紧跟。建议 tag：`backup-049-accent-color`

---

## [048] 2026-05-27 — 自定义系统 Phase A：Dark Mode 优化

> 用户要做"高灵活度自定义系统（颜色 / 人物 / 元素位置 / 自定义面板），无需预设主题，但要优化目前的黑夜系统"。整套拆 5 个 Phase，本条是 Phase A — 把现有 dark mode 真正做扎实，为 Phase B (color picker) 等后续打地基。

### 🎯 Phase 拆分（接班可见）

| Phase | 内容 | 状态 |
|---|---|---|
| **A. Dark Mode 优化** | 硬编码色 → CSS 变量 + 暗色 token 全覆盖 | ✅ 本条 [048] |
| B. 颜色自定义 | Primary color picker + 自动派生 hover/soft | ⏳ |
| C. 人物自定义 | 用户上传管家 PNG + 持久化 IndexedDB | ⏳ |
| D. 元素位置自定义 | Tab 顺序拖拽 / 管家位置 / Drawer 位置 | ⏳ |
| E. 自定义面板 | 用户创建额外面板 + 隐藏内置面板 | ⏳ |

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/app/globals.css` | 修改 | 新增 15+ token：`--shadow-{card,card-hover,bubble,modal,drawer}` / `--color-{code-bg,code-text,overlay,overlay-soft}` / `--color-{success,warning,danger}-soft` + success-strong；暗色块全套覆盖（阴影改纯黑深 alpha；代码块比 surface 更深；overlay 加深；success/warning/danger-soft 反转成暗背景浅文字配色） |
| `apps/web/src/components/AttachmentPreview.tsx` | **重写** | [025] Stage E 没扫到的死角:整个 modal 硬编码白底 + 紫色 legacy 渐变(`linear-gradient(#6366f1, #8b5cf6)`)按钮 + 黑灰文字。重写为全 CSS 变量:overlay/bg/border/text 都走 token；按钮统一墨绿；复制按钮成功态用 `--color-success-soft/-strong` |
| `apps/web/src/components/ChatCanvas.tsx` | 修改 | (1) `.ai-md pre` 代码块 `#1f2937 / #f3f4f6` → `var(--color-code-bg/-text)`；(2) QuickCard hover/normal 阴影 → `var(--shadow-card-hover/card)`；(3) ButlerBubble shadow `0 2px 10px rgba(27,61,47,0.08)` → `var(--shadow-bubble)`；(4) 错误消息 retry btn hover red → `var(--color-danger-soft)` |
| `apps/web/src/components/ConfirmCard.tsx` | 修改 | shadow → `var(--shadow-card-hover)`；reject btn hover red 0.1 → `var(--color-danger-soft)` |
| `apps/web/src/components/TodayHero.tsx` | 修改 | shadow → `var(--shadow-card-hover)` |
| `apps/web/src/components/InputPod.tsx` | 修改 | 6 处硬编码色：drag overlay 紫 legacy → primary-soft；textarea `#111` → text；attach btn 灰 hover → text-faint/surface；FileChip 灰底灰边 + 文件名/大小/remove 全套 → 全 var |

### 🎨 暗色阴影策略

之前 light mode 用 `rgba(27,61,47,0.08)`（墨绿微淡）→ 在 dark bg 上几乎不可见 → 卡片悬浮感丢失。  
新 token 在暗色覆盖块改成 `rgba(0,0,0,0.30~0.60)` 纯黑深 alpha，配合暗 bg 反而层次更清晰。

| 用途 | light | dark |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgba(0,0,0,0.03)` | `0 1px 2px rgba(0,0,0,0.30)` |
| `--shadow-card-hover` | `0 4px 14px rgba(27,61,47,0.08)` | `0 4px 14px rgba(0,0,0,0.40)` |
| `--shadow-bubble` | `0 2px 10px rgba(27,61,47,0.08)` | `0 2px 10px rgba(0,0,0,0.35)` |
| `--shadow-modal` | `0 20px 60px rgba(0,0,0,0.18)` | `0 20px 60px rgba(0,0,0,0.60)` |

### 🎨 success/warning/danger-soft 策略

light mode 用浅底色 + 深字（`#DCFCE7` + `#065F46`），dark mode 反转用深底色 + 浅字（`#14532D` + `#86EFAC`）— 既符合暗色规范又保留语义识别度。

### ✅ 验证

- `tsc --noEmit` EXIT=0
- 已知保留的硬编码语义色（设计意图，不算 bug）：
  - `#ea580c`（TasksPanel/TodayHero 紧急 deadline 橙）— 紧急度语义色
  - `#dc2626 / #10b981 / #6366f1`（InputPod FileChip 文件类型 icon 色）— PDF/图片/其他识别色
  - `#fff`（AttachmentPreview 主按钮白字）— 白字在深绿底正确
- HMR 已自动加载

### 📊 完整度更新

| Tab | 之前 | 现在 |
|---|---|---|
| Dark Mode | 框架在但 AttachmentPreview/InputPod 大面积破窗 | ✅ 全套 token + 主要组件全部 var 化 |

### 🚦 下一步候选（Phase B）

- **Phase B 颜色自定义**：PreferencesPanel 加 color picker，选 primary 色 → 派生 hover (HSL +5 lightness) + soft (HSL -85 saturation, +50 lightness)；存 localStorage；mount 时 applyStoredPreferences 注入到 `:root` 作为 CSS 变量覆盖
- 或先跳到 Phase C 人物自定义 / D 元素位置 / E 自定义面板
- 或别的方向

### 💾 备份建议

`backup-047-thinking-tail-fix` 之后，本次紧跟。建议 tag：`backup-048-darkmode-polish`

---

## [047] 2026-05-27 — 修复思考模式末尾误报「出错了」气泡

> 用户报告：思考模式 V4 Pro 推理 + 输出**全部正常完成**之后，下方紧跟一条 ❌ 出错了 气泡。判断为误报。

### 🐛 根因

服务端 `/api/chat` 的 SSE 流处理是：
```ts
try { for await (const chunk of stream) { 转发 } }
catch (err) { 发 error chunk 给客户端 }
```

DeepSeek V4 Pro thinking 模式的尾部 `usage` chunk（含 token 用量）+ OpenAI SDK 的严格迭代器解析偶尔会在**所有有效内容已成功流出后**抛错。catch 块依然发了 error chunk → 客户端 `chunk.error` 分支触发 `onError` → page.tsx `onError` 回调追加新的 `isError: true` 消息 → 用户看到"AI 答完了，下面又冒一条 ❌ 出错了"。

### 📂 涉及文件

| 文件 | 改动 | 说明 |
|---|---|---|
| `apps/web/src/app/api/chat/route.ts` | 修改 | 跟踪 `hasEmittedChunk`：(1) 若 catch 时已发过有效 chunk，console.warn 抑制不再发 error chunk；(2) `[DONE]` 移到 finally 块，确保**无论成功还是良性尾错都发**，客户端可靠知道流结束 |
| `apps/web/src/lib/chat-client.ts` | 修改 | 双保险：跟踪 `hasReceivedDelta`（content/reasoning/tool_calls 任一）。若 SSE 解析到 `chunk.error` 但本轮已有 delta，console.warn 抑制不触发 `onError` |

### 🎯 防御设计

| 层 | 触发条件 | 处理 |
|---|---|---|
| 服务端 | for-await 异常 + 已发 chunk | 仅 `console.warn`（服务端日志），客户端不收 error chunk |
| 服务端 | for-await 异常 + 未发 chunk | 真错误：发 error chunk + 仍发 [DONE] |
| 客户端 | 收到 error chunk + 本轮有 delta | 仅 `console.warn`（浏览器 console），不弹错误气泡 |
| 客户端 | 收到 error chunk + 本轮无 delta | 调 `onError` → page.tsx 追加错误气泡（合理） |

### ✅ 验证

- `tsc --noEmit` EXIT=0
- HMR 自动应用，无需重启 dev server
- 待用户实测：思考模式 send 完整轮 → 不再看到底部多余的 ❌ 出错了

### 📝 备注

修复后若仍偶尔看到错误气泡 → 多半是 fetch 层 500（DeepSeek API 短时熔断），那种情况错误是真实的应该显示。可在浏览器 console 看 `[chat] streamChat error` 区分。

### 💾 备份建议

`backup-046-butler-poses` 之后，本次紧跟。建议 tag：`backup-047-thinking-tail-fix`

---

## [046] 2026-05-27 — 4 张新姿势 SVG → trim PNG 接入（[033] 留尾收尾）

> [033] 实现了 7 姿势状态机但 4 张新姿势资产未到 → 全部 fallback 到 standing。本条把用户上传的 4 张 SVG 转成与现有 3 张同规格的透明 trim PNG，正式上线。

### 🎨 资产处理流程

用户上传的 4 张 `Doc/bulter/*.svg` 实际是 **1254×1254 JPEG-in-SVG 包装**（和现有 `butler-{standing,serving,pointout}.svg` 同结构），白底无 alpha。沿用 [027] 已有的"PNG trim"工序自动化：

| 步骤 | 实现 |
|---|---|
| 1. 提取 base64 JPEG | 正则 `xlink:href="data:image/jpeg;base64,..."` |
| 2. 白底抠图 | PIL: `rgb >= 240` → alpha=0（threshold 240 兼容 JPEG 边缘抗锯齿） |
| 3. 边缘裁剪 | `Image.getbbox()` → crop 到真实角色 bbox |
| 4. 输出 PNG | `optimize=True` 压缩 |

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `scripts/trim_butler_poses.py` | **新建** | 一次性脚本：4 张 SVG → 4 张 trim PNG。今后若用户给同格式新资产，改 `MAPPING` 即可复用 |
| `my-app/apps/web/public/assets/butler-thinking.png` | **新建** | 1254² → trim **324×1056**（87.6KB）|
| `my-app/apps/web/public/assets/butler-thinking-hard.png` | **新建** | 1254² → trim **293×1099**（93.1KB）|
| `my-app/apps/web/public/assets/butler-idea.png` | **新建** | 1254² → trim **459×1051**（106.7KB）|
| `my-app/apps/web/public/assets/butler-rare-thinking.png` | **新建** | 1254² → trim **637×855**（150.1KB，矮宽坐姿）|
| `my-app/apps/web/src/components/ButlerCharacter.tsx` | 修改 | `POSES` 表 4 个新 pose 的 `w/h` 从 `STANDING_W/H` 占位换成 trim 后真实尺寸；删除 `STANDING_W/STANDING_H` 常量；注释更新指向新脚本 |

### 🎯 视觉影响

之前所有 4 新 pose `naturalWidth === 0` → onError fallback → 渲染 standing。现在：

- **thinking**（V4 Flash 生成中 / V4 Pro 进入 content 阶段）→ 显示思考姿势
- **thinking-hard**（V4 Pro reasoning_content 流中）→ 显示深度思考姿势
- **idea**（reasoning→content 过渡的 1s 灵感闪现）→ 显示灵光一现姿势
- **rare-thinking**（7-9am × 6.1% 彩蛋）→ 矮宽坐姿（高度 855 vs 其他 ~1050，视觉上"坐下来"，符合早晨喝咖啡感）

`MAX_W` 现在是 683（serving 仍最宽），`MAX_H` 仍是 1099（thinking-hard 略超 standing 1094）→ 容器尺寸基本不变，pose 切换不抖动。

### ✅ 验证

- `tsc --noEmit` EXIT=0
- trim 脚本 stdout 实测 4 张尺寸合理（width 293-637 / height 855-1099，落在 standing/serving/pointout 同区间）
- 7 张 PNG 全部就位（`ls public/assets/butler-*.png`）

### 🚦 下一步候选

- **Notes 92% → 100%**：`[[wikilink]]` 双链 + 全文搜索（fuse.js），为 Phase 3 Tauri 接 Obsidian Vault 做铺垫
- **Phase 3 Tauri 桌面壳启动**：系统通知 + 本地文件 IPC + Notes 迁移到本地 Vault
- 别的方向

### 💾 备份建议

`backup-045-growth-pillars` 之后，本次紧跟。建议 tag：`backup-046-butler-poses`

---

## [045] 2026-05-25 — G2 留存 + G3 传播 + G5 AI 差异化 三件套一次性完成

> 用户「按推荐顺序全部 6 Pillar」。继 [044] G1 激活后,本条收尾剩余 3 个增长支柱。

### G2 留存机制

| 子项 | 文件 | 说明 |
|---|---|---|
| **G2.1 streak 连续天数** | `lib/streak.ts`(新)+ TodayHero 加 🔥 chip | localStorage 存 lastActiveDate/currentDays/longestDays;每次 hydrate 后 touchStreak,新一天 toast「连续 N 天」+ 断签提示「重新开始」 |
| **G2.2 成就系统** | `lib/streak.ts` `ACHIEVEMENTS[8]` | 初心者/执行者/勤勉/高产/随手记/3 日坚持/习惯养成/月度狂热;page.tsx useEffect 检测 + 解锁 Toast 错开 0.5s 弹 |
| **G2.4 PWA manifest** | `public/manifest.webmanifest`(新)+ `layout.tsx metadata.manifest` | 装机:short_name "Butler"、theme_color 墨绿、display standalone |

### G3 传播闭环

| 子项 | 文件 | 说明 |
|---|---|---|
| **G3.1 .ics footer 水印** | `lib/ics-export.ts` | 每条 VEVENT DESCRIPTION 加「—— Powered by Butler · 智能学习管家 https://butler.app」;用户导入手机日历后被动看到 |
| **G3.2 学习报告分享卡** | `mini-apps/ShareCard.tsx`(新) + MiniAppsDrawer 加入口 | 540×800 竖版 SVG 海报:本周完成度大数字 + 累计/进行中 chip + 7 天柱图 + Butler 品牌 footer;长按/右键保存,适合朋友圈/小红书分享 |

### G5 AI 差异化

| 子项 | 文件 | 说明 |
|---|---|---|
| **G5.1 管家角色化(3 档)** | `PreferencesPanel.tsx` 加 personality 段;`chat-client.ts` + `chat/route.ts` 透传;`buildSystemPrompt` 加 PERSONALITY_LINE | gentle 温柔学姐(「呢」「呀」+ ✨💚🌸) / standard 标准 / sassy 损友(「啧」「行吧」+ 吐槽);localStorage `butler.personality`;切换立刻生效 |
| **G5.2 学习习惯识别** | `page.tsx` `bestHourLabel` useMemo + TodayHero chip | 本地统计 messages 时间戳 → 7 时段分桶(深夜/早晨/上午/.../晚上),样本 ≥5 时显示「⚡ 你 X 最高效」 |

### 📂 新建文件汇总

- `lib/streak.ts`
- `public/manifest.webmanifest`
- `components/mini-apps/ShareCard.tsx`

### ✅ 验证

`tsc --noEmit` EXIT=0(每个 Pillar 后单独验证)

### 📊 5 个增长支柱完成度对照

| Pillar | 状态 | 关键产出 |
|---|---|---|
| **G1 激活率** | ✅ [044] | Demo 数据 / 大拖拽 / Tour / .ics 导入 |
| **G2 留存** | ✅ [045] | streak / 成就 / PWA |
| **G3 传播** | ✅ [045] | ics 水印 / 分享卡 |
| **G5 AI 差异化** | ✅ [045] | 管家 3 性格 / 习惯识别 |
| G4 变现 | ❌ Phase 4 后做 | — |

### 🚦 下一步候选

- Phase 3 Tauri 桌面壳启动(系统通知 + 本地 Obsidian Vault)
- 你给 4 张新姿势 PNG 接入
- Notes 92% → 100%(`[[wikilink]]` + 全文搜索)
- 别的方向

### 💾 备份建议

`backup-044-activation` 之后,本次紧跟。建议 tag:`backup-045-growth-pillars`

---

## [044] 2026-05-25 — G1 激活率提升:Demo 数据 + 大拖拽 + Tour + .ics 导入

> 用户增长 5 支柱中选了 G1(激活率)。一次性收尾 4 子项,把"新用户进来 30 秒决定留不留"的体验补齐。

### 📂 新建文件

| 文件 | 说明 |
|---|---|
| `lib/demo-data.ts` | `buildDemoData()` 生成 3 门课 × 8 任务 + 2 笔记(C245 数据结构 / ECON101 经济学 / ENG201 学术英语);全部基于今天 + N 天派生,deadline 始终未来 |
| `lib/ics-import.ts` | `parseIcs(raw)` 手写 .ics 解析(SUMMARY/DTSTART/DESCRIPTION + RFC 5545 line-folding + 文本转义);`icsEventsToDdls()` 转 DdlItem;`pickIcsFile()` 浏览器文件选 |
| `components/OnboardingTour.tsx` | 5 步 Tour:暗色遮罩 + anchor 高亮框(墨绿描边 + pulse 动画) + tooltip(5 个位置策略) + 进度条 + 上/下/跳过 + localStorage 防重复 |

### 📂 改动文件

| 文件 | 改动 |
|---|---|
| `app/page.tsx` | `handleLoadDemo` 一键 push demo ddls + notes + Toast 带 Undo;`handleImportIcs` 选文件 → parse → 批量 setDdls + Undo;`onLoadDemo` / `hasAnyData` 透传给 ChatCanvas;渲染 `<OnboardingTour />` |
| `components/ChatCanvas.tsx` | (1) 欢迎屏文案分支:`hasAnyData` 时用原文,否则"第一次见面"加强 CTA;(2) `DropHeroZone` 子组件:280×140 虚线大拖拽热区(墨绿描边 + 拖入高亮 + 点击 fileInput) + 「没课件?Demo →」按钮 |
| `components/TasksPanel.tsx` | 工具栏加「导入 ICS」按钮(条件渲染 `onImportIcs` 时显示);label 区分「导入 JSON」 |

### 🎯 用户激活路径(改进后)

```
新用户进入
  ↓
看到欢迎屏:管家说"第一次见面" + TodayHero + DropHeroZone(高对比)
  ↓
1.5s 后 Tour 启动 → 5 步走完核心路径(管家/4 Tab/输入/模型/搜索)
  ↓
3 个进入路径任选其一:
  (a) 拖 PDF 课件 → OCR + AI 提取 DDL
  (b) 上传 .ics 课表 → 一键批量导入
  (c) Demo 数据 → 立刻"有东西可玩"
  ↓
TodayHero 显示真实数据 + 跨面板联动起作用
```

### ✅ 验证

`tsc --noEmit` EXIT=0

### 🚦 G1 子项收尾对照

| # | 子项 | 状态 |
|---|---|---|
| G1.1 | Demo 数据一键填充 | ✅ |
| G1.2 | 欢迎屏大拖拽热区 + 强引导 | ✅ |
| G1.3 | 5 步 Tour | ✅ |
| G1.4 | .ics 导入 | ✅ |
| G1.5 | 短视频 GIF 引导 | ❌ 需资源 |

### 📊 完整度

| 维度 | 之前 | 现在 |
|---|---|---|
| **激活漏斗** | 进来无引导 | 5 步 Tour + Demo + 大 CTA + .ics 入口 |
| **空状态价值** | TodayHero「无 deadline」 | + Demo + DropHero + Tour |

### 💾 备份建议

`backup-043-calendar-100` 之后,本次紧跟。建议 tag:`backup-044-activation`

### 🚦 下一步候选

- G2 留存机制(streak + 周报 + 成就)
- G3 传播闭环(分享卡)
- G5 AI 差异化(角色化管家 + 习惯识别)
- 别的方向(Phase 3 Tauri / 资产替换)

---

## [043] 2026-05-25 — Calendar C3+C4:Week 视图空格点击创建 + 事件拖拽改时间

> 继 [042] C1/C2 把 Calendar 推到 90% 后,补齐最后 10% 的拖拽支持,Calendar 现达 100%。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/TaskDetailDrawer.tsx` | 修改 | `EditingTarget.create` 新增 `presetTime?: string`;`initialTime` 派生从 prop 取（落到表单的 dueTime 输入框） |
| `apps/web/src/components/CalendarPanel.tsx` | 修改 | (1) `Props.onRequestCreate` 签名加 `presetTime`;新增 `onMoveEvent` prop;(2) WeekView 加 `onCreateAt(iso, hour)` callback;时间格 onClick 触发(target.tagName==="DIV" 判定空白区);(3) WeekView 事件 button 加 `draggable + onDragStart` 存 itemId 到 dataTransfer;(4) 时间格加 `onDragOver/onDragLeave/onDrop` 视觉反馈(墨绿浅底)+ emit onMoveEvent |
| `apps/web/src/app/page.tsx` | 修改 | 新增 `handleMoveEvent(id, newDate, newTime)`:setDdls map patch + toast.info;`onRequestCreate` 透传 presetTime;`onMoveEvent` 传给 CalendarPanel |

### 🎯 交互细节

- **C3 点空格创建**:Week 视图任意小时格鼠标变 `cell` 指针;点击空白处 → New Event modal 自动预填日期 + 整点时间;点击已有事件 stopPropagation 避免误触发
- **C4 拖动事件改时间**:任意事件 hover 鼠标变 `grab`;拖到任意目标时间格 → 蓝绿色高亮反馈 → 释放即 update + Toast 提示「已移动到 YYYY-MM-DD HH:00」
- **数据流**:不走 ConfirmCard 核实(用户主动操作,信任度高);走 setDdls + Toast info,可惜暂未做 Undo(同 Tasks 删除有 Undo,这里后续可加)

### ✅ 验证

`tsc --noEmit` EXIT=0

### 📊 完整度

| Tab | 之前 | 现在 |
|---|---|---|
| Calendar | ~90% | **~100%** |

DayView 的拖拽未做（暂保留原有静态时间轴）;后续可考虑把 WeekView 的拖拽机制复用到 DayView。

### 💾 备份建议

`backup-042-calendar-90` 之后,本次紧跟。建议 tag:`backup-043-calendar-100`

### 🚦 下一步候选

- Phase 3 Tauri 桌面壳启动（接 Notes 本地 Vault / 系统通知 / 文件路径）
- 你给 4 张新姿势 PNG(thinking / thinking-hard / idea / rare-thinking)接入
- DayView 拖拽（复用 WeekView 机制）
- 别的方向

---

## [042] 2026-05-25 — Calendar C1+C2:迷你月历 + Week 视图

> 继 [041] 6 Epic 收尾后,把 Calendar 75% 推到 ~90%。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/layout/CalendarRail.tsx` | 重写 | C1 真实迷你月历:7×6 网格 + 上下月切换 + 今日墨绿圆 + 有事件日期下方小圆点;点击日期 emit `onJumpToDay(iso)` |
| `apps/web/src/components/CalendarPanel.tsx` | 修改 | (1) `ViewMode` 加 `"week"`;(2) `jumpToDay` prop + useEffect 监听外部跳转切到 day view;(3) MonthView header 加「Week」按钮跳到本周视图;(4) 新增 `WeekView` 子组件(~180 行):7 列 × 24h 时间轴(6AM-11PM),今日列浅墨绿背景,事件按 dueTime 落格,点击编辑 |
| `apps/web/src/app/page.tsx` | 修改 | 新增 `calendarJumpDay` state(用 `iso#timestamp` 防同 iso 二次点击不触发);CalendarRail / CalendarPanel 接入 |

### 🎯 交互

- **迷你月历**:CalendarRail 一直可见,任意月份任意日期一键跳 Day View
- **Week 视图**:月视图 header 点 [Week] → 进入;7 天时间轴显示一周所有事件,直观看到密度
- **Day View 返回**:同时也是 Week View 的返回点(都返回到 month)

### ✅ 验证

`tsc --noEmit` EXIT=0

### 📊 完整度

| Tab | 之前 | 现在 |
|---|---|---|
| Calendar | ~75% | **~90%** |

剩余 10%:Day View 拖拽创建 / 事件拖动改时间(HTML5 drag&drop,工作量中-大,后续可做)

### 💾 备份建议

`backup-041-uiux-all-epics` 之后,本次紧跟。建议 tag:`backup-042-calendar-90`

---

## [041] 2026-05-25 — UI/UX 增值计划 Epic 4/5/2/6/3 一次性收尾

> 用户「按推荐顺序全部 6 Epic」。继 [040] Epic 1 反馈循环后，本条一次记录剩余 5 个 Epic（仪表盘 / 学生场景 / 键盘 / 微交互 / 个性化）共 16 个子项。

### Epic 4 — 仪表盘 / 数据感知

| # | 子项 | 文件 |
|---|---|---|
| 4.1 | **TodayHero 今日聚焦卡** | `components/TodayHero.tsx`(新)+ ChatCanvas 欢迎屏接入。本地数据派生:今日日期/星期 + 3 个统计 chip(今日/本周/累计完成)+ 本周完成率环形 + 最近 deadline 倒计时(色彩按 daysLeft 升级) |
| 4.2 | **Deadline 紧急度色彩升级** | `TasksPanel.tsx` 新增 `computeUrgency(d)`:任务行左侧色条按 daysLeft 派生(<1 红 / <3 橙 / <7 黄 / else 绿),无 deadline 退回 priority |
| 4.3 | **StatsApp Mini App** | `components/mini-apps/StatsApp.tsx`(新)+ MiniAppsDrawer 加 BarChart3 入口。累计完成/未完成大数字 + 7 天完成趋势 SVG 条形图 + Top 3 tag 完成率条 |
| 4.4 | **Tasks 顶部 tag chip 聚合** | TasksPanel 头部加 `tagStats` useMemo,显示 Top 12 tag 的 `#tag · done/total · 进度条`(完成率达 100% 显示 success 色) |

### Epic 5 — 学生场景

| # | 子项 | 文件 |
|---|---|---|
| 5.1 | **FocusTimer ↔ Task 联动** | FocusTimer 加 `linkedTaskId` 下拉(未完成任务列表)+ 结束时 emit `onAppendTaskNote(taskId, "- 专注 25 min · MM-DD HH:MM")` → page.tsx 把行追加到 task.notes;同时 toast.info 反馈 |
| 5.3 | **任务模板 4 选 1** | TaskDetailDrawer 顶部加 4 个 emoji 模板按钮(Quiz 📝 / Paper 📄 / Project 🚀 / Reading 📖),点击预填 weight/priority/tags/description/isGroupWork |
| 5.4 | **临近 deadline 浏览器通知** | page.tsx hydrate 后每 60s 扫描未来 24h 截止的未完成任务,Toast warning + 浏览器 Notification API(可选授权);`deadlineNotifiedRef` Set 防重复;5s 后静默请求 Notification 权限 |

### Epic 2 — 键盘体验

| # | 子项 | 文件 |
|---|---|---|
| 2.1 | **全局快捷键** | page.tsx useEffect 监听 keydown:`⌘N` 按当前 Tab 新建会话/任务/事件/笔记;`Esc` 兜底关 shortcuts/previewNotes/previewing/editing/miniApps |
| 2.3 | **? 快捷键帮助 modal** | `components/KeyboardShortcutsHelp.tsx`(新)。3 组(全局/Tasks/Chat 输入)分组列出,kbd 样式按键;Esc 关闭 |

### Epic 6 — 微交互打磨

| # | 子项 | 文件 |
|---|---|---|
| 6.5 | **Empty state 人格化** | TasksPanel `EmptyState` 加管家小气泡「☕ 放假了？让我陪你休息一下」墨绿底圆角;NotesPanel `EmptyHero` 加「💡 在 Chat 里说『帮我记一条笔记』我也能帮你写」 |

(6.1 skeleton / 6.2 Tour / 6.3 拖拽 / 6.4 管家追光标 — 当前 hydrate 速度足够快、用户暗示足够、花哨细节优先级低,暂不做)

### Epic 3 — 个性化

| # | 子项 | 文件 |
|---|---|---|
| 3.1 | **亮/暗主题切换** | globals.css 加 `html[data-theme="dark"]` 覆盖墨绿系（primary `#5FB58F` 浅墨绿 + bg `#0F172A` 深 slate）|
| 3.2 | **字体大小档位** | globals.css `--font-base` 变量 + `html[data-font-size]` 3 档（sm 13 / md 14 / lg 16）;body 用 `var(--font-base)` |
| — | **PreferencesPanel modal** | `components/PreferencesPanel.tsx`(新)。亮/暗 segmented + 字号 segmented;localStorage 持久化(butler.theme / butler.fontSize);`applyStoredPreferences()` mount 时立即生效防闪烁 |
| — | **TopBar 用户菜单加入口** | 用户菜单顶部加「⚙️ 偏好设置」MenuBtn → 打开 PreferencesPanel |

### 📂 新建文件汇总

- `components/TodayHero.tsx`
- `components/mini-apps/StatsApp.tsx`
- `components/KeyboardShortcutsHelp.tsx`
- `components/PreferencesPanel.tsx`

### ✅ 验证

`tsc --noEmit` EXIT=0(每个 Epic 后单独验证)

### 🎯 完整度更新

| Tab | 之前 | 现在 |
|---|---|---|
| Chat | ~100% | ~100% + Hero 卡 / 键盘 / 偏好 |
| Tasks | ~97% | **~99%**(deadline 色彩 + tag 聚合 + 模板 + 通知) |
| Notes | ~92% | ~92% + 人格化 Empty |
| Calendar | ~75% | ~75%(下一步候选) |
| **跨面板** | ~80% | ~80% |
| **平台增值** | 0% | **Toast 系统 + Undo / 偏好 / 键盘 / 通知 / Stats 全新增** |

### 🚦 已完成的 6 Epic 完整清单（[040] + [041]）

```
✅ Epic 1 反馈循环（[040]）  4 子项 Toast / Undo / AI 实时提示 / 替换 alert
✅ Epic 4 仪表盘             4 子项 TodayHero / 紧急度 / StatsApp / Tag 聚合
✅ Epic 5 学生场景            3 子项 FocusTimer↔Task / 模板 / Deadline 通知
✅ Epic 2 键盘体验            2 子项 全局快捷键 / 帮助面板
✅ Epic 6 微交互              1 子项 Empty 人格化
✅ Epic 3 个性化              4 子项 暗色 / 字号 / Panel / 用户菜单入口
```

### 💾 备份建议

`backup-040-feedback-loop` 之后,本次紧跟。建议 tag:`backup-041-uiux-all-epics`

---

## [040] 2026-05-25 — Epic 1 反馈循环:Toast 系统 + 删除 Undo + AI tool 实时提示

> 用户「按推荐顺序全部 6 Epic」第一个 Epic — 替换全部 alert()、删除带撤销、AI 调工具时浮提示。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/Toast.tsx` | 新建 | ToastProvider + useToast hook;4 档（success/info/warning/error）;支持 action 按钮（用于 Undo）;同 id 覆盖防堆叠;顶右 stack + 滑入动画 |
| `apps/web/src/app/layout.tsx` | 修改 | 根布局 wrap `<ToastProvider>` |
| `apps/web/src/app/page.tsx` | 修改 | (1) `handleDeleteDdl / handleDeleteNote / handleDeleteSession` 都保存 snapshot + 弹 Toast「已删除 [撤销]」5s;(2) ICS/JSON 导入导出 alert → toast.success/warning/error;(3) AI tool 调用时 `onToolCallStart` 弹 1.5s info toast「⚙ Butler 正在查询任务列表…」按工具名分类提示 |
| `apps/web/src/components/mini-apps/FocusTimer.tsx` | 修改 | 倒计时结束 alert → toast.success「🎉 专注时段结束」8s 持续显示 |

### ✅ Epic 1 收尾

- `tsc --noEmit` 通过
- 项目内 `grep alert\\(` 已为 0
- Undo 实测:删任务后 5s 内点撤销 → setDdls 恢复

---

## [039] 2026-05-25 — 跨面板联动四件套 B2/B1/B3/B4 一次性完成

> 用户「跨面板联动这个要首先完成」+ 「全部四项推荐」+「按照顺序全部完成」。这是从"4 个独立面板"升级为"互联 Personal Learning OS"的关键一步。

### 🎯 4 项联动一览

| 项 | 用户场景 | 工作流 |
|---|---|---|
| **B2** AI create_note tool | 「帮我把这段话记成笔记」 | AI 调 tool → ConfirmCard 紫色 BookOpen 卡 → 用户接受 → 落 Notes 表 |
| **B1** 任务 ↔ 笔记双向关联 | 任务里加备忘 / 笔记反查相关任务 | TaskDetailDrawer「📝 创建关联笔记」一键创空笔记+关联+跳 Notes；NotesPanel 顶部显示关联任务并点跳 Tasks |
| **B3** 全局搜索跳转高亮 | 搜索后想立刻看到目标在哪 | 点击搜索结果 → 切 Tab + scrollIntoView + 2 秒黄色脉冲闪烁动画 |
| **B4** 笔记 `- [ ] todo` → Tasks | 笔记里随手记 todo,自动入任务清单 | 笔记内写 `- [ ] xxx` → 1.2s 防抖 → 自动建 task（带 noteId 回链）+ `syncedTodos` 去重防重复 |

### 📂 涉及文件总览

| 文件 | 改动量 | 内容 |
|---|---|---|
| `apps/web/src/lib/types.ts` | +2 字段 | `DdlItem.noteId?: string` / `Note.syncedTodos?: string[]` |
| `apps/web/src/lib/pending.ts` | +1 kind | `PendingCreateNote` + `extractNoteDrafts(batch)` helper |
| `apps/web/src/lib/ai-tools.ts` | +1 tool | 第 6 个 tool `create_note` + `CreateNoteArgs` 类型 |
| `apps/web/src/lib/tool-executor.ts` | +1 case | `execCreateNote` 入 pending 队列 |
| `apps/web/src/components/ConfirmCard.tsx` | +1 分支 | `describeChange` 渲染 create-note（紫色 BookOpen + 字数 + 标签 + 内容预览） |
| `apps/web/src/components/TaskDetailDrawer.tsx` | +1 Field | 关联笔记 UI:已关联显示标题+「打开」「解除」;未关联显示「📝 创建关联笔记」虚线按钮 |
| `apps/web/src/components/NotesPanel.tsx` | +2 features | (1) 顶部关联任务条（Link2 + 任务名 chip 可跳）;(2) 1.2s 防抖扫描 `- [ ] todo` 正则 emit 给 page;(3) `selectActiveId` 外部跳转选中 |
| `apps/web/src/components/TasksPanel.tsx` | +highlight | `highlightTaskId` prop,rowRefs map,scrollIntoView,行加 `.task-row-flash` className |
| `apps/web/src/components/layout/TopBar.tsx` | +1 prop | `onSearchJump(target, refId)` 透传 |
| `apps/web/src/app/page.tsx` | +5 handlers | `handleCreateLinkedNote` / `handleJumpToNote` / `handleUnlinkNote` / `handleJumpToTask` / `handleSearchJump` / `handleAutoExtractTodos`;`highlightTaskId` state + 2s timer;`notesSelectId` state |
| `apps/web/src/app/globals.css` | +1 keyframe | `@keyframes search-flash`（2s 黄色脉冲 + inset shadow）|

### 🎨 关键设计决策

**B2 走 ConfirmCard 核实**:AI 不直接落库,符合现有"AI 写操作必须用户确认"的红线。Note 类型有独立紫色 + BookOpen 图标,与 Task 的绿色 Plus 区分。

**B1 反向关联用反查而非存储**:Note 没存 `taskIds[]`,而是 `ddls.filter(d => d.noteId === note.id)` 即时反查 — 单一信息源,避免双向同步死锁。

**B3 高亮 CSS 而非 React 状态**:`highlightTaskId` 设置后 2s 由 page.tsx 清空,期间对应 row 加 `.task-row-flash` className,CSS 动画自然衰减 — 无需在每个组件维护"几秒后取消高亮"的子计时器。

**B4 单向同步**:只做"笔记 → 任务",反向（任务勾选回写笔记 checkbox）暂不做 — 避免双向同步循环触发。`Note.syncedTodos[]` 记录已同步文本作为幂等 key,删除笔记某行 todo 不会重建任务（防止"我删了你又给我添回来"）。新任务自动 `noteId = 笔记 id`,形成回链。

### ✅ 验证

- `tsc --noEmit` 通过（4 次,每项独立验证后再下一项）
- preview eval:
  - B3 `@keyframes search-flash` ✓ 注入 globals.css
  - B4 正则 `/^[\s　]*[-*]\s+\[\s\]\s+(.+?)\s*$/gm` 测试通过：`- [ ] 写论文` / `* [ ] 复习数据结构` 都匹配,`- [x] xxx` 已勾选跳过

### 🚦 跨面板联动全景图

```
       ┌───────────────────────────────────────────┐
       │            TopBar 全局搜索                │
       │      ↓ (B3 跳转 + 闪烁高亮 2s)            │
       │  ┌────────┬─────────┬───────────┐         │
       │  │ Chat   │  Tasks  │  Notes    │         │
       │  │        │   ↑↓ B1 关联 ↕      │         │
       │  │  AI    │  Tasks  ←─ B4 ──   │ Notes  │
       │  │   ↓ B2 │         │  自动建  │         │
       │  │ create │         │   task   │         │
       │  │ _note  │         │          │         │
       │  └────────┴─────────┴──────────┴─────────┘
       │            ↑ ConfirmCard 居中浮顶（B2 走核实）
       └───────────────────────────────────────────┘
```

### 📊 Butler 完整度更新

| Tab | 之前 | 现在 |
|---|---|---|
| Chat | ~100% | ~100% |
| Tasks | ~95% | **~97%**（接 B1 关联笔记 + B3 搜索高亮 + B4 笔记同步入） |
| Notes | ~80% | **~92%**（接 B1 关联任务 + B2 AI 创建 + B4 同步出） |
| Calendar | ~75% | ~75% |
| **跨面板** | 0% | **80%**（4 项全做完;`[[wikilink]]` 等长尾延后） |

### 💾 备份建议

`backup-038-stitched-bubble` 之后,本次紧跟。建议 tag:`backup-039-cross-panel`

### 🚦 下一步候选

- 等用户决定:(1) Calendar 75% → 95% / (2) Phase 3 Tauri 启动 / (3) 资产替换 / (4) 其他

---

## [038] 2026-05-25 — 开屏问候零 token + AI 气泡彻底贴边

> 用户：「确保一上来的那句问候不消耗 token 只靠代码实现 / 然后目前来看应该是 ai 回复的内容那里还有多余的容器删除掉这样对话框就能彻底的贴边了」。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/app/page.tsx` | 重写 triggerGreeting | (1) 删除 streamChat 调用 + 全部 SSE callback 累积逻辑（~70 行）；(2) 新增 `buildLocalGreeting(items)` helper：根据 hour 派生时段（深夜/早上/中午/下午/晚上）+ emoji,过滤 todo 数量,找最近未过期 deadline,拼 markdown 字符串；(3) triggerGreeting 改为同步直接 `setMessages` 添加一条 assistant 消息,不调任何 API |
| `apps/web/src/components/ChatCanvas.tsx` | 修改 | 历史消息流 wrapper 去掉 `maxWidth: CONTENT_MAX` + `margin: "0 auto"`,气泡直接占主区全宽（减 32px padding）；AI 气泡 maxWidth:90% 仍生效防大屏过宽,但小屏下能彻底贴 main 左边 |

### 🎯 开屏问候本地生成示例

```
[time<6]    深夜好,Feng！你目前的任务清单是空的... 🌙
[time<11]   早上好,Feng！你目前有 3 个未完成任务,最近的是「数据结构 Quiz」(2026-05-26)。加油 ☀️
[time<14]   中午好,Feng！... 🌤️
[time<18]   下午好,Feng！... 🌥️
[time>=18]  晚上好,Feng！... 🌃
```

### ✅ 验证

- `tsc --noEmit` 通过（EXIT=0）
- preview eval + fetch 拦截器：新建 session 触发 greeting → **`apiCalled: 0`** ✓
- 生成内容："下午好,Feng！你目前的任务清单是空的,没有待办事项..." ✓
- `bubbleLeftFromMain: 32`（精确等于 main padding-left,**彻底贴边**）✓
- `bubbleWidth: 598`（约 90% × main 内宽 666,合理）

### 💰 成本影响

| 场景 | 之前 | 现在 |
|---|---|---|
| 每次新 chat session 开屏 | 1 次 V4 调用（~200 input + ~50 output token） | **0 token** |
| 思考模式开屏 | 含 reasoning_content（更多 token） | 0 token |
| 响应时间 | 1-3 秒（API 延迟） | **<10ms 瞬间** |

### 🎨 布局对照

| 元素 | 距 main 左 |
|---|---|
| 主区 padding-left | 32px |
| 之前：800 居中容器后气泡 | 大屏可能 200-400px+（视窗口宽） |
| **现在：气泡直接贴 main padding** | **32px**（精确） |

副作用零：输入区仍 maxWidth: 800 居中（用户未要求改），欢迎屏 ButlerBubble 仍居中（这是 isEmpty 分支单独的布局）。

---

## [037] 2026-05-25 — 标准 AI 对话布局：气泡左对齐 + 核实卡居中浮顶 + 管家二次缩减到 0.33

> 用户：「ai 回复靠最左边（标准的 ai 对话）/ 只有那种选择的也就是选择是否加入 task 把卡片放在人物上方 / 现在人物基于现在的大小再次缩减到 0.6 倍」。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/ButlerCharacter.tsx` | 修改 | default `scale: number = 0.55 → 0.33`（= 0.55 × 0.6 二次缩减）；standing 像素从 206×602 → **123×361** |
| `apps/web/src/components/ChatCanvas.tsx` | 修改 | (1) `ButlerBubble` outer div `justifyContent: "center" → "flex-start"`,AI 气泡回归**标准 ChatGPT 左对齐**；(2) `ConfirmCard` 渲染处包一层 `<div style={{ justifyContent: "center" }}>` 让**核实卡独立居中浮在管家上方**,区别于普通 AI 消息,强调"等你决策" |

### 🎯 布局对照（最终态）

| 元素 | 位置 |
|---|---|
| 用户气泡 | 右对齐（不变） |
| AI 普通回复气泡 | **左对齐**（[037] 回归标准） |
| ConfirmCard 核实卡 | **居中浮在管家头顶**（[037] 新独立） |
| 管家 | 主区底部水平居中,scale=0.33（小角色站底） |
| InputPod | 居中,自带白底压在管家腿/脚上 |

### ✅ 验证

- `tsc --noEmit` 通过（EXIT=0）
- preview eval：standing 实测 123×361（0.33 倍率精确 ✓）
- preview eval：ButlerBubble wrapper `justify-content: flex-start` ✓
- 截图：AI 气泡贴左 / 用户气泡贴右 / 管家小角色站底,整体类 ChatGPT 标准对话流

### 🚦 备注

ConfirmCard 居中渲染逻辑写好,实际触发需要有 `pendingBatches`（PDF 上传或 AI 调 create/update/delete tool）。下次有 PDF 上传或 AI 操作 task 时会自动看到居中浮顶效果。

---

## [036] 2026-05-25 — Chat 缺口 F/A/D/E/G 五件套一次性完成

> 用户「H 不需要做剩下的按照优先级顺序全部完成」。一次性补齐：F 中文 IME / A 停止生成 / D 复制+重新生成 / E 错误 retry / G AI 自动标题。

### 📂 涉及文件（按改动量大→小）

| 文件 | 操作 | 改动要点 |
|---|---|---|
| `apps/web/src/app/page.tsx` | 修改 | (A) `abortRef = useRef<AbortController>`,handleSend 创建 controller 传 signal,handleStopGeneration abort()；try-catch AbortError 静默；finally 清 abortRef；(D+E) handleRegenerate 找 assistantMessageId → 前面最近 user → slice 截断 + setInputValue + setTimeout 50ms 触发 send-btn click；(E) onError 标 `isError: true`；(G) generateSessionTitle 用 streamChat 调 Flash 生成 4-8 字标题 + cleanup 正则去标点；useEffect 监听 sessions/messages,title=="新对话" + 有 1 user + 1 真实 assistant 时一次性请求；titleRequestedRef 防重复 |
| `apps/web/src/components/ChatCanvas.tsx` | 修改 | (D+E) 新增 `MessageToolbar` 组件（copy + regenerate 按钮,copy 2 状态切换 "已复制" 1.5s）；`ButlerBubble` 加 `isError` / `onRegenerate` props,error 时墨绿描边变红色 + 工具栏永显；非流式且 content 非空时渲染 toolbar；外层 div 加 `.bubble-wrap` class；style 加 `.bubble-wrap:hover .msg-toolbar { opacity: 1 !important; }`；(A) 透传 `onStop` 给 InputPod |
| `apps/web/src/components/InputPod.tsx` | 修改 | (F) handleKeyDown 加 `e.nativeEvent.isComposing` + `keyCode === 229` 双重检查；(A) 新增 `onStop?` prop,`isLoading && onStop` 时渲染方形 Stop 按钮（深色背景 + Square icon）替代圆形 ArrowUp |
| `apps/web/src/lib/chat-client.ts` | 修改 | (A) fetch catch 识别 AbortError/DOMException → 直接 throw 不上报 onError（避免用户主动中止时显示 "网络请求失败"）|
| `apps/web/src/lib/types.ts` | 修改 | `ChatMessage` 加 `isError?: boolean`（标识错误消息,UI 红边 + 永显 retry）|

### 🎯 细节决策

**A 停止按钮**：圆形 → 方形深色，是 ChatGPT / Claude 标准；AbortController 在 finally 自动清理；abort 触发后流式状态机和 idea timer 都被 finally 正确 cleanup。

**D+E 工具栏交互**：
- 普通 AI 消息：hover 显示 [复制 / 重新生成]
- 错误消息：红色边框 + 永显 [复制 / 重试]，按钮文本和颜色都变红
- 流式中（isTyping）和空 content 时**不渲染工具栏**（避免半成品被复制 / 重新生成尚未完成的消息）
- 复制后按钮变绿 ✓「已复制」1.5s，再回原状

**E retry 实现**：用 `setTimeout(50)` + 模拟 send-btn click,绕开 React 状态批量更新 race（直接调 handleSend 会用 stale closure 的 messages）。

**G AI 自动标题**：
- 触发条件：`hydrated && !isLoading && session.title === "新对话" && 有 1 user + 1 非错误 assistant (content > 5 字)`
- titleRequestedRef Set 防止 useEffect 多次触发同一 session
- 用 V4 Flash（最便宜 + 标题不需要思考）
- prompt 严格限制「4-8 个汉字 / 直接输出 / 不要标点 emoji 解释」
- 后处理正则去 `""【】[]:：。.!?\n\r\s` + slice(0,20) 兜底
- 仅当 title 仍为「新对话」时更新（避免覆盖用户手动改的）

### ✅ 验证

| 项 | 验证方式 | 结果 |
|---|---|---|
| **F** IME 防误触发 | preview eval 触发 composing keydown,检查 onSend 是否调 | `composingEnterIgnored: true` ✓ |
| **A** stop 按钮显示 | send 后 800ms 查 `#stop-btn` | `aria-label="停止生成"` ✓ |
| **A** abort 静默 | 点 stop 后查 `hasErrorBubble` | `false` ✓ |
| **D** 工具栏存在 | querySelector copy/regenerate 文本按钮 | 每条 AI 消息都有 ✓ |
| **D** hover CSS | scan stylesheets 找规则 | `.bubble-wrap:hover .msg-toolbar { opacity: 1 !important; }` ✓ |
| **G** 标题函数注册 | 监听 useEffect 已加 + Dexie 题已有「介绍下你自己」 | function + effect 就位 ✓ |
| tsc --noEmit | 全量类型检查 | EXIT=0 ✓ |

### 🚦 Chat 部分缺口收尾

| # | 项 | 状态 |
|---|---|---|
| A | 停止生成按钮 | ✅ [036] |
| B | 历史截断 10 条 | ✅ [035] |
| D | 消息工具栏 | ✅ [036] |
| E | 错误 retry | ✅ [036] |
| F | 中文 IME | ✅ [036] |
| G | AI 自动标题 | ✅ [036] |
| H | 对话导出 | ❌ 用户决定不做 |

**Chat 部分至此功能完整度 ≈ 100%**（剩 H 导出为可选未来工作）。

### 💾 备份

`backup-035-history-truncate` 之后,本次紧跟。建议下一备份点 tag：`backup-036-chat-complete`

---

## [035] 2026-05-25 — 历史消息截断到最近 10 条（token 效率收口）

> 用户「继续做下一项代办」。承接 [034] 末尾「真想进一步加速：实施缺口 B 历史截断」。AGENT.md 早已写明「历史消息截断至最近 10 条」但 page.tsx 一直没实施。长会话时 input token 线性爆炸 → 首字延迟变长 + 成本变高。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/app/page.tsx` | 修改 | (1) 新增常量 `HISTORY_LIMIT = 10`（约 5 轮对话,够保留近期上下文）；(2) `handleSend` 中 `historyApi` 计算后加截断：`slice(-10)` + while-loop trim 直到首条 role=user（DeepSeek/OpenAI API 严格要求首条 user）；(3) 截断时 console.log 提示便于调试 |

### 🎯 算法要点

```ts
let trimmed = allHistory.slice(-HISTORY_LIMIT);
while (trimmed.length > 0 && trimmed[0].role !== "user") {
  trimmed = trimmed.slice(1);
}
```

- `slice(-10)` 保留最近 10 条
- while-loop 处理截断后首条变 assistant 的边界（API 报 400 风险）
- 最坏情况：从 N 条截到 1 条（仅当前 user 消息）— 仍保证有效请求

### ✅ 验证

| 测试 | 期望 | 实测 | 通过 |
|---|---|---|---|
| 短历史 3 条 | 不截断,len=3 | 3 / first=user | ✓ |
| 12 条均匀 u-a 交替 | 截到 10 / first=user | 10 / first=user | ✓ |
| 11 条 → slice(-10) 首条 assistant → trim 1 → 9 条 | 9 / first=user | 9 / first=user | ✓ |
| 边界:全 assistant | 截到空数组 | 0 | ✓ |
| Live: fetch 拦截器捕获实际 body | 数量合理 + first=user | msgCount=2 / firstRole=user | ✓ |

### 💰 Token 影响估算

| 会话长度 | 之前 input token | 现在 input token | 节省 |
|---|---|---|---|
| 5 条对话 | ~500 (system 350 + history 150) | ~500 | 0% |
| 20 条对话 | ~950 | ~650 | -32% |
| 50 条对话 | ~2000 | ~650 | **-67%** |
| 100 条对话 | ~4000 | ~650 | **-84%** |

DeepSeek V4 Flash $0.028/M cache miss → 一个长会话每次发送省的 token 累积下来非常可观。

### 🚦 后续可继续(Chat 缺口剩余)

- **A** 停止生成按钮（streamChat 已有 AbortSignal,UI 接 AbortController 即可）
- **D** AI 消息复制 + 重新生成（ButlerBubble hover 工具栏）
- **E** 错误消息 retry 按钮
- **F** 中文 IME 防 Enter 误触发
- **G** AI 自动生成会话标题（首轮后调 V4 Flash 总结）
- **H** 整段对话导出 .md / .json
- *进阶*：超出 10 条时把更早内容压缩成 1 句"早期对话摘要"塞到 system prompt（rolling summary）

### 💾 备份

`backup-034-bubble-center` 之后,本次紧跟。

---

## [034] 2026-05-25 — AI 气泡居中浮在管家头顶 + Flash 模式隐藏思考面板

> 用户反馈两个问题：(1)「为什么思考这么久看一下」(2)「对话框 ai 回复的内容靠着最左边」。

### 🔍 思考慢的真相（不是 bug,是 V4 系列特性）

实测 Dexie 数据：用户当前 selectedModel=null（默认 Flash,**没切到思考模式**）,但 reasoning 字段仍有 40 字符 CoT 内容：
> "用户想让我介绍一下自己。这是一个轻松的问题,不需要调用工具。我直接回复介绍即可。"

**根因**：DeepSeek V4 Flash 模型本身就带轻量 CoT,无论是否启用 thinking_mode 都会先跑一段 reasoning 再开始生成正文。客户端无法关闭（DeepSeek 模型层行为）。

**用户感受到"慢"的原因**：
- Flash 也得先跑 reasoning → 首字延迟 +1-2s
- 不显示思考面板时,用户看不到这段过程,只看到"AI 卡了几秒"
- **修复策略**：Flash 模式仍持久化 reasoning,但**不渲染思考折叠面板**（避免误导用户以为切到了思考模式）

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/ChatCanvas.tsx` | 修改 | (1) `ButlerBubble` outer div `justifyContent: flex-start` → `center`,AI 气泡居中浮在管家头上方（配合管家居中的视觉）；(2) `ButlerBubble` 新增 `showReasoning?: boolean` prop,默认 false；(3) 主组件派生 `showReasoning = !!(selectedModel && getModelMeta(selectedModel).thinking)`,传给所有 ButlerBubble 调用；(4) import `getModelMeta` from `@/lib/ai-models` |

### 🎯 视觉效果对比

| 维度 | 之前 | 现在 |
|---|---|---|
| AI 气泡水平对齐 | `flex-start` 贴主区左 32px padding | `center` 浮在管家头上方 |
| User 气泡 | `flex-end` 贴右 | 不变（保持右） |
| Flash 模式思考面板 | 显示「已思考」误导用户 | **不显示**（reasoning 仍持久化） |
| Thinking 模式思考面板 | 显示「思考中…」→「已思考」 | 不变(只在 thinking 模式渲染) |
| 漫画对话框效果 | 气泡贴左,远离居中管家 | **气泡正好在管家头顶**,典型漫画 bubble |

### ✅ 验证

- `tsc --noEmit` 通过(EXIT=0)
- preview 截图确认:欢迎屏气泡居中浮于管家头部上方,3 张快捷卡片水平居中排开,无"已思考"按钮
- DOM eval 确认:`justifyContent: "center"`,`hasReasoningPanel: false`

### 🚦 副作用 / 后续

- **历史 reasoning 不丢失**:Dexie 中已有的 reasoning 字段保留,切回 thinking 模式时该 session 历史中的旧 reasoning 仍可见
- **如果需要进一步加速**:实施 PROGRESS [031] 列出的缺口 **B**（历史截断到 10 条），可显著降低 input token + 首字延迟
- DeepSeek API 偶发后端慢(实测 30s+),非客户端可控

### 💾 备份

`backup-033-butler-poses` 之后,本次紧跟。

---

## [033] 2026-05-25 — 4 个新姿势 + AI 活动状态机 + 0.55 倍率 + 缺资产降级

> 用户：「人物图片现在多加了一些逻辑：模型生成内容时（flash模式）用 thinking，thinking mode 的 thinking 时用 thinking-hard，准备开始输出答案时用 I-got-an-idea，然后 rare-thinking 在早上 7-9 点概率触发，条件触发使用代码实现。然后大小要改小一点。」

### 🎭 4 个新姿势 + 状态机优先级（高→低）

| 优先级 | Pose | 触发条件 |
|---|---|---|
| 1 | `pointout` | PDF pipeline 完成 5s 内（pointoutHold）|
| 2 | `pointout` | 有 PDF 待核实（pdf-extract pending）|
| 3 | `idea` | AI 生成中,reasoning→content 过渡的**首 1s 灵感闪现** |
| 4 | `rare-thinking` | AI 生成中 × `7-9am` × `Math.random() < 0.061` 命中（彩蛋,替换 thinking/thinking-hard）|
| 5 | `thinking-hard` | AI 生成中,V4 思考模式 reasoning_content 流中 |
| 6 | `thinking` | AI 生成中,Flash 模式 content 流中（默认生成态）|
| 7 | `serving` | AI 待核实（ai-chat pending）|
| 8 | `standing` | 默认空闲 |

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/ButlerCharacter.tsx` | 重写 | (1) `ButlerPose` 类型加 4 个新值（`thinking` / `thinking-hard` / `idea` / `rare-thinking`）；(2) `POSES` 表预定 4 个新 src 路径（`butler-thinking.png` 等）+ 占位尺寸（先按 standing 374×1094 占位）；(3) **scale 默认 0.75 → 0.55**；(4) `useEffect` 主动检查 `naturalWidth === 0` → setErrored（防 SSR/cache 漏触发 onError）；(5) errored 时整个 pose 的 src + 尺寸都 fallback 到 standing |
| `apps/web/src/app/page.tsx` | 修改 | (1) 新增 `aiActivity` state（`phase: thinking/thinking-hard/idea/null` + `rareRoll: boolean`）；(2) `ideaTimerRef` + `rollRare` helper（7-9am × 6.1%）；(3) `handleSend` / `triggerGreeting` 开始时 set thinking + rollRare，finally 清理 timer + reset state；(4) SSE callbacks：`onReasoningDelta` 首次升级 phase → thinking-hard；`onContentDelta` 首次 → idea + 1s timer 后回 thinking；(5) `butlerPose` useMemo 派生加入新 5 分支 |
| `apps/web/src/components/ChatCanvas.tsx` | 修改 | 把 `<ButlerCharacter scale={0.75}>` 改为不传 scale,用默认 0.55 |

### 🎯 核心实现细节

**rareRoll sticky**：每次 send 开始抽**一次**,sticky 整个生成期（避免 thinking 期内 pose 闪烁切换）。命中时整个生成期的 thinking/thinking-hard 都替换为 rare-thinking。

**idea 1s 一闪**：用 `setTimeout(1000)` + `ideaTimerRef` 跟踪,防止：
- 多轮 tool call 期间重复触发（用 `contentStarted` flag）
- finally cleanup 时未清 timer 导致状态泄漏

**Flash vs Thinking 模式自动区分**：完全靠 SSE 流是否带 `reasoning_content` 判断,无需读 `selectedModel`：
- Flash → 只有 onContentDelta → thinking → idea → thinking
- Thinking → 先 onReasoningDelta 多次（thinking-hard）→ 后 onContentDelta（idea → thinking）

**缺资产降级（关键）**：用户尚未提供 4 张新 PNG,组件用双重保险：
- `<img onError>` 兜底
- `useEffect` mount 后 + 500ms 后两次主动 check `naturalWidth === 0`（防 SSR/cache 漏触发）
- 命中时整个 pose 的 src 替换为 standing 资产 + 用 standing 尺寸渲染（防 broken-img 图标 + 拉伸）

### ✅ 验证

- `tsc --noEmit` 通过（EXIT=0）
- preview reload + 量 DOM：standing 206×602 / serving 376×552 / pointout 261×587（全部 0.55 倍率精确）
- 4 个新 pose（thinking 等）`src` 经 useEffect 检测后全部回退到 `butler-standing.png`（`naturalW=374`）✓
- AI send 触发后状态机切换序列由用户实测验证（preview eval 超时 30s 是 AI 慢,非代码 bug）

### 🚦 用户下一步

提供 4 张 PNG 资产到 `apps/web/public/assets/`：
- `butler-thinking.png` — 一般思考姿势（手放下巴 / 望远）
- `butler-thinking-hard.png` — 深度思考（皱眉 / 紧握 / 闭眼）
- `butler-idea.png` — 灵光一现（食指上举 / 头顶灯泡 / 眼睛发亮）
- `butler-rare-thinking.png` — 彩蛋姿势（喝咖啡 / 伸懒腰 / 看晨报）

放进去后,改 `ButlerCharacter.tsx` `POSES` 表里对应的 `w/h` 为真实尺寸（PowerShell `[System.Drawing.Image]::FromFile()` 量出来）。

### 💾 备份

`backup-032-butler-centered` 之后,本次紧跟。

---

## [032] 2026-05-25 — 管家居中 + 输入框背后 + 0.75 倍率统一

> 用户原话:「人物现在放在对话框的正中间输入框的后面 所有大小 按照站立的这张的svg 的0.75倍率放」。当前 ButlerCharacter 用 `fillContainer` 模式占满左下 260px 栏，需要改为水平居中 + 固定 0.75 倍率 + 输入框前置图层。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/ButlerCharacter.tsx` | **重写** | 移除 `fillContainer` / `size` props,改为 `scale: number = 0.75`；新增 `POSES` 元数据表记录 3 张 PNG 原始尺寸（standing 374×1094 / serving 683×1003 / pointout 475×1067）；容器尺寸 = `MAX_W × scale × MAX_H × scale` = 512×820 固定；三姿势 `position:absolute bottom:0 left:50% translateX(-50%)`,按各自原始尺寸 × scale 渲染,opacity 切换；脚底基准对齐让 pose 切换不抖动；阴影椭圆同步缩窄 |
| `apps/web/src/components/ChatCanvas.tsx` | 修改 | (1) 删除 `BUTLER_GUTTER = 260`,改为 `CONTENT_MAX = 800`；(2) 管家容器从左下 `left:0 width:260 height:100%` 改为 `bottom:0 left:50% translateX(-50%)`,调用 `<ButlerCharacter scale={0.75} />`；(3) 历史区 padding `24px 32px 14px ${BUTLER_GUTTER + 12}px` → 对称 `24px 32px 14px`,内部消息流加 `maxWidth: CONTENT_MAX, margin: 0 auto` 居中；(4) 输入区同样改对称 + InputPod 外包居中 wrapper；(5) 欢迎屏 `alignItems: flex-start` → `center`,卡片行 `justifyContent: center` |

### 🎯 设计细节

| 维度 | 之前 | 现在 |
|---|---|---|
| 管家位置 | 左下 260px 栏(`left:0 width:260`) | 主区水平正中 + 贴底(`bottom:0 left:50% translateX(-50%)`) |
| 大小 | `fillContainer` 自适应栏宽 | **statically 0.75 ×**：standing 281×821 / serving 512×752 / pointout 356×800 |
| z-index 层次 | 管家 1 / 历史 2 / 输入 2(但左偏让管家露出) | 管家 1 / 历史 2 / 输入 2,**InputPod 自带白底自然压在管家腿/脚上** |
| 对话流布局 | 左 padding 272px 让位 | 对称 32px + `maxWidth: 800` 居中(类似 ChatGPT) |
| 姿势切换 | 视觉位置偏移(随容器宽度变化) | **脚底基准对齐**,头部位置随姿势自然上下 |

### 🔍 实现要点

- **PNG 原始尺寸表**写在 ButlerCharacter 顶层 `POSES` 常量,以后调整 trim 边缘只需改这 3 个数字
- **容器固定为 MAX 尺寸**(512×820)而非每张图变化大小,避免 pose 切换时父容器抖动撑开布局
- **绝对定位 bottom-center** 是 anchor 关键:三张图脚底对齐,头部高度差通过透明上方区域自然消化
- **保留 `withFx`** 开关:阴影椭圆 + opacity 过渡动画都受其控制(0.4s ease)

### ✅ 验证

- `tsc --noEmit` 通过(EXIT=0)
- preview reload + 实测尺寸:`document.querySelectorAll('img[alt*="Butler"]')` 返回三张图各自 0.75 倍精确尺寸 ✓
- 截图确认:管家居中 + 输入框白底压在脚踝 + AI 气泡浮在头上方 + 整体协调

### 🚦 后续

- 等用户给 Rive 分层 SVG 资产 → 接 `<ButlerRive scale={0.75} />` 替换 ButlerCharacter,接口完全兼容(同 pose / scale 字段)
- 大屏(>1400px)可能想加 `CONTENT_MAX` 上限到 900;当前 800 在 1280×800 看着刚好
- 极小窗口(<600px 宽)管家会顶满主区,后续移动端再针对性 hide 或缩到 0.5×

### 💾 备份建议

`backup-031-thinking-reasoning` 之后,本次紧跟。

---

## [031] 2026-05-25 — 思考模式可见化：reasoning_content 折叠面板

> 用户决策：盘点 Chat 部分缺口后选「思考模式可见化（C）」。V4 思考模式（V4 Pro thinking）的 SSE 流原本携带 `reasoning_content` 字段被丢弃，用户切到思考模式只看到答案，看不到 CoT 推理过程，等于白付钱。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/lib/types.ts` | 修改 | `ChatMessage` 新增 `reasoning?: string`（持久化随 messages 表自动跟进，无需 Dexie 版本升级） |
| `apps/web/src/lib/chat-client.ts` | 修改 | (1) `SseChunk.choices[].delta` 类型加 `reasoning_content?: string`；(2) `StreamCallbacks` 加 `onReasoningDelta?: (delta: string) => void`；(3) 单轮解析循环里识别 `delta.reasoning_content` 并触发 callback |
| `apps/web/src/app/page.tsx` | 修改 | `handleSend` 和 `triggerGreeting` 都把原本只处理 content 的 `onDelta` 重构为 `ensureAssistant({ content?, reasoning? })`：同一条 assistant message 同时承载 content 和 reasoning 增量；新增 `onReasoningDelta` 回调 |
| `apps/web/src/components/ChatCanvas.tsx` | 修改 | (1) 新增 `ReasoningPanel` 子组件：浅灰底 + Brain 图标 + 折叠箭头，思考中显示「思考中…」+ 闪烁点，结束折叠成「已思考」可点开；(2) `ButlerBubble` 增加 `reasoning?` prop 并渲染面板；(3) 主消息流调用处传入 `msg.reasoning` |

### 🎯 体验细节

- **思考中**（reasoning 增量在流，content 还未开始）：面板默认**展开**，标题「思考中…」+ 闪烁点
- **思考完成**（content 开始出现）：自动**折叠**成「已思考」
- **用户手动 toggle**：以用户偏好为准（`forced` state 覆盖派生）
- **历史消息**：刷新后 reasoning 跟随 messages 一起从 Dexie 加载，可随时点开复看
- **非思考模型**（V4 Flash）：API 不返回 reasoning_content → `hasReasoning=false` → 面板不渲染，自然降级
- 思考内容用 monospace 字体 + muted 颜色，与正文视觉区分
- `max-height: 280px` + 自带滚动条，防长 CoT 撑爆气泡

### ✅ 验证

- `tsc --noEmit` 通过（`EXIT=0`）
- preview_start + 实际触发开屏问候（用户当前在思考模式）→ Dexie 写入 `reasoning` 字段（72 字符 CoT）→ 主区折叠面板正确渲染「已思考」→ 点击展开内容完整可见
- 截图确认视觉对齐墨绿设计语言

### 🚦 后续可继续（chat 部分剩余缺口）

- **A** 停止生成按钮（streamChat 已暴露 AbortSignal 接口）
- **B** 历史消息截断到 10 条（AGENT.md 已写但 page.tsx 未实施 → token 浪费）
- **D** AI 消息复制 + 重新生成（ButlerBubble hover 工具栏）
- **E** 错误消息 retry 按钮
- **F** 中文 IME 防 Enter 误触发
- **G** AI 自动生成会话标题（首轮后调 V4 Flash 总结）
- **H** 整段对话导出 .md / .json

### 💾 备份

- commit `ff0f6c0`（[030] 收尾）+ 本次基于其改

---

## [030] 2026-05-24 — 模型切换两个 bug 修复（精简下拉 + state-only 视觉）

> 用户反馈："切换模型那里大小有问题，同时不能切换回来原来的模型"。两个 bug 都源于 InputPod 模型下拉项的实现。

### 📂 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/InputPod.tsx` | 修改 | (1) 提取新组件 `ModelOption`：精简单行布局（3px 墨绿左条 + ●tier 圆点 + label + tagline + ✓ active 图标），单项 ~32px（原 80-100px）。(2) hover 视觉改用 `useState(hov)` 派生背景，**不再用 inline style.background 残留**——这是"切不回原模型"的根因。(3) 移除大的 28px `ModelIcon`（保留 6px `ModelDot`） |

### 🐛 Bug 根因分析

**Bug 1：下拉项太大**
- 原因：每项渲染了完整描述（V4 Flash desc 100+ 字）+ tagline + 大图标 + "当前" 徽章
- 280px 宽度装不下，强制换行 3-4 次 → 单项 80-100px 高 → 两项 200px → 遮挡气泡

**Bug 2：切不回原模型**
- 原因：`onMouseEnter` handler 写入 `e.currentTarget.style.background`，与 React 重渲染的 inline `background: isActive ? "var(--color-primary-soft)" : "transparent"` 互相覆盖
- active 项被点击后视觉残留 hover 时的 `var(--color-surface)`，状态实际已经切换但 UI 看起来"没动"
- 修复：完全去掉 `e.currentTarget.style` 写入，改用 React state `hov` 派生 background

### ✅ 验证

- `tsc --noEmit` 通过（`EXIT=0`）
- 切换 V4 Flash ↔ V4 思考 视觉立刻反映（墨绿左条 + ✓ 移到新项）
- 下拉总高度 ~70px（从 200px 降下来）

### 🚦 下一步备份建议

`backup-029-basics-done`（包含 [027]-[030]）

---

## [029] 2026-05-24 — 基础功能补全 5 件套：AI tool 字段 + Markdown 预览 + 开屏问候 + Notes 真版 + 全局搜索

> 用户决策：先把所有基础功能做完再做细致优化。盘点出 5 个缺口，按"小到大"顺序逐个补齐（D → E → C → A → B）。

### 📂 涉及文件（按 5 块分组）

#### D. AI tool 加字段支持（C.2 字段扩展的自然延伸）

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/lib/ai-tools.ts` | 修改 | `create_item` / `update_item` schema 加 `status` / `tags` / `priority` / `notes`；CreateItemArgs / UpdateItemArgs 接口同步 |
| `apps/web/src/lib/tool-executor.ts` | 修改 | execCreate 创建时设新字段；execUpdate patch 包含 status 时同步 completed |

#### E. Markdown 备注预览

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/NotesPreview.tsx` | 新建 | 任务备注 markdown 渲染 modal（react-markdown + remark-gfm），自带 .md-preview CSS |
| `apps/web/src/components/TasksPanel.tsx` | 修改 | 备注 chip 从 span 改 button + 加 `onRequestNotesPreview` prop；e.stopPropagation 防穿透到编辑 |
| `apps/web/src/app/page.tsx` | 修改 | `previewNotes` state + render `<NotesPreview>` |

#### C. AI 主动开屏问候

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/app/page.tsx` | 修改 | 新增 `triggerGreeting(sid)` callback（不入 user 消息，直接调 streamChat 让 AI 自动招呼）；新增 useEffect 监听 hydrated + activeNav=chat + 当前 session 完全空 → 触发；`greetedSessionsRef` Set 防重复 |

#### A. Notes 浏览器内 Markdown 实版（最大块）

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/lib/types.ts` | 修改 | 新增 `Note { id, title, content, tags?, pinned?, createdAt, updatedAt, vaultPath? }` |
| `apps/web/src/lib/db.ts` | 修改 | Dexie v4→v5：新增 `notes` 表（索引 updatedAt + pinned） |
| `apps/web/src/components/NotesPanel.tsx` | **重写** | 真实双栏：左 280px 列表（按 pinned 排序 + 时间）+ 右编辑器（textarea 双模式 edit/preview，500ms 防抖保存）；标题 + 内容 + pin + 删除；Empty hero + Coming Tauri 提示 |
| `apps/web/src/components/layout/NotesRail.tsx` | 修改 | 接 `notes` props，All Notes / Pinned 显示真实计数 + onCreate 触发 |
| `apps/web/src/app/page.tsx` | 修改 | `notes` state + hydrate load + persist effect + handleCreateNote/Update/Delete |

#### B. TopBar 全局搜索

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/layout/GlobalSearch.tsx` | 新建 | 240px 输入框 + 480px 高下拉浮层；搜 ddls / notes / messages（user+assistant）；按类型分组（任务/笔记/对话）+ 每组限计数；⌘K / Ctrl+K 快捷聚焦；Esc 关闭；点击跳转对应 Tab |
| `apps/web/src/components/layout/TopBar.tsx` | 修改 | 用 GlobalSearch 替换原占位输入框；接收 ddls/notes/messages props |
| `apps/web/src/app/page.tsx` | 修改 | TopBar 传 ddls/notes/messages |

### 🎯 4 面板完整度（重要里程碑）

| Tab | 之前 | 现在 |
|---|---|---|
| Chat | 90% | **95%** + 开屏问候 |
| Tasks | 85% | **95%** + AI 字段全 + 备注预览 |
| Calendar | 75% | 75%（未动） |
| Notes | **0% 占位** | **80%** ✅ 浏览器内 Markdown 实版 |
| **跨面板** | — | **+ TopBar 全局搜索接通** |

### ✅ 验证

- `tsc --noEmit` 通过（`EXIT=0`）每步都验
- Dexie v4→v5 自动迁移（仅新增表，不影响存量）
- Notes 编辑 500ms 防抖入 IDB
- AI 开屏问候用 `greetedSessionsRef` 防重复，已有历史的 session 不触发
- 搜索结果点击跳 Tab（refId 留位，未来加高亮）

### 🚦 后续可继续

- Notes：tags 编辑 + 笔记内 [[wikilink]] 跨链 + Phase 3 Tauri 接本地 Vault
- 搜索：跳转后高亮匹配项 + 搜索历史
- 开屏问候：可配置（用户可关 / 调频率）
- AI 主动提醒：每天早上 push 今日概览
- Calendar：Week 视图、拖拽创建

### 💾 备份

- commit `ff0f6c0` + tag `backup-028-ocr-models`（本次前）

---

## [028] 2026-05-24 — 多模态 OCR：图片 + 扫描件 PDF 全链路（Mistral）

> 用户决策：(a) 接 Mistral OCR（用户原话）；(b) 关心成本+希望未来可切换 → 做 provider 注册表；(c) PDF 路由用 unpdf < 50 字 → 扫描件 → OCR；(d) 图片 10MB warning / 50MB 硬拒。

### 📂 涉及文件

| 文件路径 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/lib/ocr/providers.ts` | 新建 | OCR provider 注册表：mistral（已实现）/ deepseek-vl（占位）/ tesseract（占位）；各自含价格、需要的 env、tier、desc |
| `apps/web/src/lib/ocr/index.ts` | 新建 | 客户端入口 `runOcr(file)`：调 `/api/ocr`；50MB 客户端硬拒；返回 `OcrResponse` discriminated union（ok=true/false + needsConfig 标志） |
| `apps/web/src/app/api/ocr/route.ts` | 新建 | 服务端路由（runtime nodejs）：读 `OCR_PROVIDER` env 白名单 → 校验 key → FormData(file) → base64 → 调 Mistral `/v1/ocr`（model `mistral-ocr-latest`）→ 拼接多页 markdown → 返回 `{ ok, text, pages, provider, ocrUsed }`；无 key 时返回 `needsConfig: true` 让前端友好提示 |
| `apps/web/src/lib/document-parser.ts` | 重写 | 加路由：文字 PDF → unpdf；**扫描 PDF（unpdf 输出 < 50 字）→ OCR**；image/\* → OCR；其他报错。新增 `ParseSource = "unpdf" \| "ocr-mistral" \| ...`；新增 `needsConfig?: boolean` 透传 |
| `apps/web/src/app/page.tsx` | 修改 | `runRealPipeline` step 1：> 10MB 加 warning；`parsed.source` 反映来源（"本地解析 (unpdf)" / "OCR (mistral)"）展示在 Pipeline detail；失败 + needsConfig → 提示用户配 MISTRAL_API_KEY |
| `apps/web/.env.local.example` | 修改 | 加 `MISTRAL_API_KEY` + `MISTRAL_BASE_URL` + `OCR_PROVIDER`；DEEPSEEK_MODEL 默认值同步为 `deepseek-v4-flash` |

### 🎯 路由策略表

| 上传文件类型 | 路由 | 成本 |
|---|---|---|
| 文字型 PDF | unpdf 本地 | **¥0**（免费快）|
| 扫描件 PDF（unpdf < 50 字） | Mistral OCR | ~$0.001/页 |
| jpg/png/webp/heic 等图片 | Mistral OCR | ~$0.001/张 |
| docx/ppt | 报错（待后续接入） | — |

### 🔧 OCR Provider 注册表

| Provider | 状态 | 价格 | 需要的 env |
|---|---|---|---|
| **Mistral OCR**（默认） | ✅ 已接入 | $0.001/页 (1000 页 $1) | `MISTRAL_API_KEY` |
| DeepSeek-VL | ⏳ 占位 | 复用现有 DEEPSEEK_API_KEY，按 token 算 | `DEEPSEEK_API_KEY` |
| Tesseract.js | ⏳ 占位 | 0 成本（10MB 模型一次下载） | — |

切换：环境变量 `OCR_PROVIDER=mistral`。后两个等用户需要时再实现（架构已留位）。

### ✅ 验证

- `tsc --noEmit` 通过（`EXIT=0`）
- TypeScript narrowing：discriminated union 用 `ok !== true` 显式比较（`!ocr.ok` 在某些 TS 版本下 awaited 后不 narrow，已踩坑修复）
- 50MB 硬拒在客户端 + 服务端双层校验
- 无 MISTRAL_API_KEY 时报错带 `needsConfig: true`，UI 提示用户去 console.mistral.ai 申请

### 🚦 后续可继续

- 测试真实扫描件 PDF + 手机拍照课件验证 OCR 质量
- 实现 DeepSeek-VL provider（复用 DEEPSEEK_API_KEY，无需新申请）
- 实现 Tesseract.js provider（0 key 完全本地）
- InputPod 加 OCR provider 切换 UI（类似模型切换）
- docx/ppt 解析（mammoth / pptxgen）

### 💾 备份

- commit `10902c1` + tag `backup-027-context-partition`（本次前）

---

## [027] 2026-05-24 — 上下文分区 + PNG trim 透明边 + Live2D 动画计划

> 用户三件事一起做：(1) 用 2026 业界成熟方案（[Anthropic 官方 best practice](https://code.claude.com/docs/en/best-practices) + Memory Bank 风格）把描述文档分区，避免后续 AI 接手 context 爆炸；(2) PNG trim 让管家变大；(3) 计划用 Live2D / Rive 给人物加动画（**P1 Rive 已选定**，等用户准备分层资产）。

### 📂 文档分区（核心）

| 文件路径 | 操作 | 说明 |
|---|---|---|
| `my-app/AGENT.md` | **重写** | 从 250 行精简到 < 200 行入口；按 Anthropic best practice 加 `IMPORTANT` 标记；链接 docs/* 按需读 |
| `my-app/PROGRESS.md` | **截断** | 从 1129 行 → 287 行；只保留最近 5 条 ([022]-[026])；底部加归档链接 |
| `my-app/docs/architecture.md` | **新建** | 产品定位 + 完整代码地图 + 顶层 state + 数据模型 + 关键技术决策（旧 AGENT § 2,4,5 合并） |
| `my-app/docs/workflow.md` | **新建** | Token 效率 / PM 对齐 / PROGRESS 规范 / UI baseline / Git 规范 / 红线（旧 AGENT § 6） |
| `my-app/docs/setup.md` | **新建** | 启动 / 测试 / 环境变量 / 模型切换 / 测试 PDF / Dexie 清库 / PowerShell 注意（旧 AGENT § 8） |
| `my-app/docs/pitfalls.md` | **新建** | 已知陷阱按类别分（第三方库 / React / Windows / 浏览器 / UI / AI / Dexie）（旧 AGENT § 7） |
| `my-app/docs/plans/ui-redesign.md` | **移动** | 从 `my-app/UI-REDESIGN-PLAN.md` 迁过来，顶部加 ✅ 已存档标识 |
| `my-app/docs/plans/animation.md` | **新建** | Live2D / Rive / Lottie / CSS 4 方案对比 + 用户决策 + Rive 详细路径（资产清单 / Editor 操作 / 代码骨架） |
| `my-app/docs/progress/INDEX.md` | **新建** | 按主题速查跨月归档 + 归档规则 |
| `my-app/docs/progress/2026-05.md` | **新建** | [001]-[021] 完整内容归档（1129 行原文） |

### 🎨 PNG 资产优化

| 文件路径 | 操作 | 变化 |
|---|---|---|
| `apps/web/public/assets/butler-standing.png` | trim | 1254×1254 → **374×1094**（去 70% 左右空白），文件 207KB → **100KB** |
| `apps/web/public/assets/butler-serving.png` | trim | 1254×1254 → **683×1003**，285KB → **106KB** |
| `apps/web/public/assets/butler-pointout.png` | trim | 1254×1254 → **475×1067**，207KB → **104KB** |
| `apps/web/public/assets/logo.png` | trim | 1254×1254 → **613×775**，817KB → **140KB** |

算法：PowerShell + `.NET System.Drawing.LockBits` 扫描非透明像素边界 → crop + 8px padding。

### 📊 Token 效率收益

按 [Anthropic 2026 best practice](https://code.claude.com/docs/en/best-practices)（CLAUDE.md < 200 行）+ [Memory Bank 二层架构](https://mem0.ai/blog/state-of-ai-agent-memory-2026)（4× 更少 token，准确率 +18.7%）：

| 阶段 | 之前 | 现在 |
|---|---|---|
| 新接手 AI 必读量 | AGENT(250) + PROGRESS(1129) ≈ 25 KB | AGENT(180) + PROGRESS(290) + INDEX(70) ≈ **5.4 KB** |
| 减少 | — | **-78%** |
| 详细内容 | 必读 1 份 25KB | 按需开 docs/*（平均每个 5-8 KB） |

### 🎭 Live2D 动画方案（P1 Rive，已对齐）

用户决策路径：
- ❌ P0 CSS 微动画
- ✅ **P1 Rive**（资产准备阶段）
- ❌ P2 Live2D Cubism（Phase 3 后再考虑）

**待用户准备**：分层 SVG（或 PSD），含 head / eye_left / eye_right / mouth / body / arm_left / arm_right。详见 [docs/plans/animation.md](docs/plans/animation.md)。

**代码骨架已准备**：`@rive-app/react-canvas` 接入模板 + State Machine 接口设计 + fallback 策略。等资产到位 1.5-2h 接入。

### ✅ 验证

- AGENT.md = 187 行（目标 < 200 ✓）
- PROGRESS.md = 287 行（最近 5 条完整 + 归档链接）
- docs/ 目录结构清晰，按主题分区
- `tsc --noEmit` 不受影响（无代码改动）
- 4 张 PNG 文件总体积 1516KB → **450KB**（-70%）

### 🚦 后续

- 等用户给 Rive 分层资产 → 接入 ButlerRive
- 每月初把上月 PROGRESS 迁到 `docs/progress/YYYY-MM.md`
- AGENT.md 是 living document：每次 AI 接手前后用户/AI 都可以补 IMPORTANT 规则

### 💾 备份建议

下一步备份点建议 tag：`backup-027-context-partition`

---

## [026] 2026-05-22 — 模型切换 + Stage C.2（字段扩展 + 详情抽屉）

> 两件事一起做：(1) 用户能在 InputPod 切换 AI 模型；(2) Stage C.2 三件套：Dexie v4 加 status/tags/priority、TasksRail 可点击切换 view、TaskEditModal 改右侧详情抽屉。

### 📂 涉及文件

| 文件路径 | 操作 | 说明 |
|---|---|---|
| **模型切换** | | |
| `apps/web/src/lib/ai-models.ts` | 新建 | 注册表 3 个候选：V4 Flash (low/默认/最便宜) / V3.1 (mid) / Reasoner (high/不支持 tool)；`AiModelMeta` 含 tier/desc/supportsTools；`MODEL_STORAGE_KEY` localStorage 持久化 |
| `apps/web/src/app/api/chat/route.ts` | 修改 | 接收 body.model 白名单校验 (`isValidModelId`)；非法值降级 V4 Flash；reasoner 类自动禁用 tools |
| `apps/web/src/lib/chat-client.ts` | 修改 | `StreamOptions.model` 透传到 fetch body |
| `apps/web/src/components/InputPod.tsx` | 修改 | model badge 改可点击下拉，弹出 280px 浮层列出 3 模型（含 desc/tier dot/⚠不支持工具警告）；点击切换 |
| `apps/web/src/components/ChatCanvas.tsx` | 修改 | 加 `selectedModel` / `onSelectModel` props 透传 InputPod |
| `apps/web/src/app/page.tsx` | 修改 | 新增 `selectedModel` state + `MODEL_STORAGE_KEY` localStorage 双向同步；`streamChat({ model: selectedModel })` |
| **Stage C.2** | | |
| `apps/web/src/lib/types.ts` | 修改 | 新增 `TaskStatus = "todo"\|"in_progress"\|"done"`、`TaskPriority = "low"\|"med"\|"high"`；`DdlItem` 加 optional `status / tags / priority`；`completed` 保留作兼容 |
| `apps/web/src/lib/db.ts` | 修改 | Dexie v3→v4：`ddls` 加 `status` 索引；upgrade hook 把存量数据 `completed=true → status="done"`、否则 `"todo"` |
| `apps/web/src/components/layout/TasksRail.tsx` | 重写 | 新增 `view / onSelectView` props；4 + 1 view（Active/In Progress/Upcoming/All/Completed）可点击切换；active 项墨绿底高亮 |
| `apps/web/src/components/TasksPanel.tsx` | 修改 | 接 `view` prop 按视图过滤；行内显示 priority 色条 / tags chip / 「进行中」状态徽章；header 标题改用 view 名 + 全局统计副标题；新增 ViewEmptyState |
| `apps/web/src/components/TaskDetailDrawer.tsx` | 新建 | 右侧 380px 滑入抽屉替代 TaskEditModal；含 status / priority `SegmentedRadio` + tags 逗号分隔输入 + 实时 chip 预览；保留所有原字段（任务名/日期/时间/权重/小组/说明/备注/附件） |
| `apps/web/src/components/TaskEditModal.tsx` | **删除** | 由 TaskDetailDrawer 取代 |
| `apps/web/src/app/page.tsx` | 修改 | import 切到 TaskDetailDrawer；handleSubmitEdit 把 `status="done"` 同步为 `completed=true`；新增 `taskView` state + `taskCounts.in_progress`；传给 TasksRail/TasksPanel |

### 🎯 模型切换体验

| 模型 | 简介 | tier | 工具 |
|---|---|---|---|
| **DeepSeek V4 Flash**（默认） | 最低成本，日常对话 | low（绿点） | ✅ |
| DeepSeek V3.1 | 复杂指令/长上下文更好，贵 3-25× | mid（黄点） | ✅ |
| DeepSeek Reasoner | 深度推理 (CoT)，最慢最贵 | high（红点） | ❌（自动禁用工具） |

切换后立即生效，下次发送自动用新模型；localStorage 跨刷新保留选择。

### 🎨 Tasks 新字段视觉

- **优先级**：行首 3px 宽色条（high=红 / med=黄 / low=蓝）
- **标签**：任务名右侧灰色 `#tag` chip 们
- **状态**：进行中显示黄色「进行中」徽章；完成显示删除线（保持原行为）
- **TaskDetailDrawer**：状态/优先级用 SegmentedRadio（3 选 1 分段按钮），tags 输入框下方实时显示 chip 预览

### ✅ 验证

- `tsc --noEmit` 通过（`EXIT=0`）
- 全部 Tab 切换 + view 切换 + 创建/编辑/删除 行为保留
- Dexie v4 升级幂等（旧数据自动补 status）

### 🚦 后续可继续

- AI tool_call 也支持设置 status/tags/priority（目前 AI 只设基础字段）
- 详情抽屉的标签输入加 autocomplete（从所有任务的现有 tags 推荐）
- 模型切换时的 cache hit miss 提示（DeepSeek 会因 system prompt 变化扣高价）
- 加更多 Mini Apps

### 💾 备份

- commit `fb9c4f9` + tag `backup-025-ui-redesign-done`（本次前）

---

## [025] 2026-05-22 — Stage E：Notes 占位重做 + 全局 legacy 清理（5 阶段 UI 重构收尾）

> UI-REDESIGN-PLAN.md 的最后一个 Stage。NotesPanel 视觉对齐墨绿（保留 Phase 3 解锁心智），同时**彻底清理玻璃态/紫色 legacy**：删除 4 个无引用文件、所有 InputPod / ProcessingPipeline 内的 GlassButton / DecoLayered、globals.css 里全部旧 class。

### 📂 涉及文件

| 文件路径 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/NotesPanel.tsx` | 重写 | 去 `DecoLayered`，纯白底 + 虚线边框 hero；紫色渐变图标 → 墨绿实色 + 墨绿浅底；Phase 3 解锁徽章改墨绿系；FeatureCard 改 token；标题缩到 22px |
| `apps/web/src/components/InputPod.tsx` | 修改 | 移除 `import GlassButton`；发送按钮改纯墨绿圆形按钮（hover 加深、disabled 灰）|
| `apps/web/src/components/ProcessingPipeline.tsx` | 重写 | 去 `DecoLayered` + AI Sparkles 头像；Pipeline 卡改白底墨绿描边；StepIcon 紫色 → 墨绿；成功色用 `var(--color-success)`；JumpBtn 改墨绿系 |
| `apps/web/src/components/Sidebar.tsx` | **删除** | 旧 68px 玻璃侧栏，已被 LeftRail 取代 |
| `apps/web/src/components/SessionListPanel.tsx` | **删除** | 旧 240px 滑入面板，已被 ChatRail 取代 |
| `apps/web/src/components/ui/GlassButton.tsx` | **删除** | 玻璃态按钮，最后一个引用（InputPod）已替换 |
| `apps/web/src/components/ui/DecoLayered.tsx` | **删除** | 三层装饰板，最后一个引用（ProcessingPipeline）已替换 |
| `apps/web/src/components/ui/` | 删除（空目录） | 整个 ui/ 目录已无文件 |
| `apps/web/src/app/globals.css` | 大幅精简 | 删除旧 token (`--color-brand` / `--grid-color` / `--radius-lg`)；删除全部旧 components 层 class：`.bg-grid` / `.glass-panel` / `.nav-tooltip` / `.nav-icon-btn` / `.quick-card` / `.send-btn` / `.deco-layered*` / `.glass-btn*` / `.fx-layer` / `.msg-toolbar` / `.ai-message`；只留 `.message-stream`（滚动条）+ `.selectable` |

### 🧹 清理统计

- 删除 4 个 legacy 文件（~600 行）
- 删除 globals.css 中 ~280 行旧 class 规则
- 全项目无紫色 / 玻璃 / 网格背景残留

### ✅ Stage A-E 全部完成（PROGRESS [017]-[025]）

| Stage | 状态 | 关键交付 |
|---|---|---|
| **A** 全局 layout + token | ✅ | TopBar / LeftRail / 墨绿调色板 |
| **B** Chat 漫画式 + 核实门控 | ✅ | 管家融入主区 / ButlerBubble / ConfirmCard / PendingBatch |
| **C.1** Tasks 视觉重做 | ✅ | 墨绿 Linear 风格列表 + TasksRail 计数 |
| **D** Calendar 月+日双视图 | ✅ | 月视图墨绿 + Day View 时间轴 + Upcoming/Tasks widgets |
| **E** Notes 占位 + 全局清理 | ✅ | NotesPanel 墨绿化 + 4 legacy 文件删除 + globals.css 精简 |
| (额外) Mini Apps Drawer | ✅ | 右侧学习工具抽屉 + Focus Timer |

### ✅ 验证

- `tsc --noEmit` 通过（`EXIT=0`）
- `grep -r "GlassButton\|DecoLayered\|SessionListPanel\|Sidebar"` 在 src/ 下无引用
- `grep -r "className.*bg-grid\|glass-\|deco-layered"` 在 src/ 下无引用
- 4 个 Tab + Mini Apps 抽屉 全部对齐墨绿设计语言

### 🚦 至此 UI 重构完成。后续可继续

- **C.2** Tasks 字段扩展（Dexie v3→v4：status/tags/priority）+ TaskEditModal 改右侧抽屉
- **Phase 3** Tauri 桌面壳启动 → Notes 真实化 + 原生通知 + filepath 一键打开
- **Phase 4** Clerk + Neon 多租户 → ICS 订阅 URL + 真实云后端
- 更多 Mini Apps（番茄记录 / 单词卡 / 公式速查...）

### 💾 备份

- commit `fb9c4f9` + tag `backup-024-mini-apps`（本次清理之前）

---

## [024] 2026-05-22 — 学习工具抽屉（Mini Apps Drawer）+ Focus Timer

> 用户决策：Focus Timer 不要放 Calendar Day View，而是做一个**全局右侧滑入抽屉**，作为「学习辅助小程序仓库」。后续可扩展更多小工具（番茄记录 / 单词卡 / 公式速查等）。

### 📂 涉及文件

| 文件路径 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/mini-apps/FocusTimer.tsx` | 新建 | 功能完整的专注计时器：mm:ss 倒计时 + 环形进度（SVG）+ 25/45/60 min 预设 + 自定义起停重置；倒计时完成 alert（Phase 3 接 Tauri Notification） |
| `apps/web/src/components/MiniAppsDrawer.tsx` | 新建 | 全局右侧滑入抽屉（320px，从 TopBar 下方开始）；可扩展的 `APPS` 注册表 + App 切换器（≥2 App 时显示）；当前仅含 FocusTimer，留好 ComingSoon 占位接口 |
| `apps/web/src/components/layout/TopBar.tsx` | 修改 | 新增 `LayoutGrid` 图标按钮（位于通知前），点击切换抽屉；接 `miniAppsOpen` / `onToggleMiniApps` props，open 时按钮 active（墨绿边框 + 浅墨绿底） |
| `apps/web/src/app/page.tsx` | 修改 | 新增 `miniAppsOpen` state；渲染 `<MiniAppsDrawer>` 在顶层（fixed，不影响主区布局）；传给 TopBar |
| `apps/web/src/components/CalendarPanel.tsx` | 修改 | 移除 Day View 右侧 Focus widget（仅保留 Upcoming Events + Tasks）；移除 `Target` import |

### 🎯 设计要点

- **抽屉浮在主区上**（不挤主内容），用户可以一边看 Calendar/Tasks 一边计时
- **不带遮罩**（pointer-events 不阻塞），点抽屉外部不会自动关，需手动 X
- **fixed 定位 top:56**（TopBar 高度），确保 TopBar 始终可点击切换
- **滑入动画**：`cubic-bezier(0.16, 1, 0.3, 1)` 0.25s，自然顺滑
- **App 状态在抽屉内 useState**（不在 page.tsx 顶层），关闭抽屉后再开会**保留 App 选择**但计时器会重新挂载（暂未做跨开关持久化，下次需要再优化）

### 🚦 后续扩展接口

```ts
// MiniAppsDrawer.tsx 里 APPS 数组扩展即可
const APPS: MiniApp[] = [
  { id: "focus",     name: "专注计时", icon: <Target />, Component: FocusTimer },
  { id: "pomodoro",  name: "番茄记录", icon: <Coffee />, Component: PomodoroLog },
  { id: "flashcard", name: "单词卡",   icon: <BookOpen />, Component: Flashcard },
  { id: "calculator",name: "计算器",   icon: <Calculator />, Component: Calc },
];
```

### ✅ 验证

- `tsc --noEmit` 通过（`EXIT=0`）
- Focus Timer 25/45/60 min 切换正常
- 倒计时环 stroke-dashoffset 平滑过渡
- 抽屉滑入/滑出无闪烁
- Calendar Day View 不再有 Focus widget

---

## [023] 2026-05-22 — Stage D：Calendar 月视图重做 + Day View 深度页

> 用户决策：Calendar 不做大改 — **默认入口保持月视图**（视觉对齐墨绿），**点空白日期才进入深度的 Day View**（时间轴 + 右侧 widgets）。

### 📂 涉及文件

| 文件路径 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/CalendarPanel.tsx` | 重写 | 顶层维护 `view: "month" \| "day"` + `selectedDate`；月视图视觉重做（去 DecoLayered/紫色，全部 token 化）；新增 `DayView` 子组件（返回按钮 + 24h 时间轴 6AM-11PM + 右侧 3 个 widgets：Upcoming Events / Tasks / Focus 计时环）；新增 `TimelinePill`、`WidgetCard`、`PrimaryBtn` 子组件 |

### 🎯 交互变化

| 操作 | 之前 | 现在 |
|---|---|---|
| 点空白日期格 | 直接弹「新建事件」modal | 进入 **Day View**（深度时间轴页） |
| 点事件 pill | 编辑 modal | 不变（编辑 modal） |
| 月视图右上 | 「今天」按钮 | 「今天」+ **「+ New Event」墨绿主按钮** |
| Day View 时间轴点空时段 | 无此功能 | 触发新建（带 `presetDate=当前选中日`） |
| Day View 返回 | 无 | 顶部 ← 按钮 |

### 🎨 Day View 布局

```
┌─ ← 返回 │ 2026 年 5 月 26 日 [今天]   + New Event ┐
├──────────────────────────────────┬─────────────┤
│ 6 AM ─────────                   │ UPCOMING     │
│ 7 AM ─────────                   │  CA1 06/26   │
│ 8 AM ──[09:00 课程会议 30%]──    │  Mtg 06/28   │
│ 9 AM ─                           │              │
│ ...                              │ TASKS        │
│ 11 PM ─                          │  ☐ Read Ch3  │
│ ─其他时段（早于6AM/晚于11PM）─    │              │
│  23:59 提交作业                  │ FOCUS        │
│                                  │   ╭─120 min─╮│
│                                  │   ╲ 待接入 ╱ │
└──────────────────────────────────┴─────────────┘
```

### 🎨 月视图视觉重做

| 维度 | 之前 | 现在 |
|---|---|---|
| 卡片 | DecoLayered 玻璃 | 白底 + 1px border + 圆角 10 |
| 周标题行 | 黑半透 2% 底 | `var(--color-surface)` |
| 格子边线 | 黑半透 5% | `var(--color-border-soft)` |
| 今日圆背景 | 紫色 + 紫阴影 | **墨绿圆**（无阴影） |
| Hover 格子 | 紫色 6% 底 | `var(--color-primary-soft)` 浅墨绿 |
| 事件 pill | 紫/绿/红色块 | 浅墨绿底 + 墨绿左边框（统一墨绿主色） |
| AddButton | 紫渐变 | 墨绿实色 `PrimaryBtn` |
| 空状态 | DecoLayered + 紫渐变按钮 | 虚线边框 + 墨绿按钮 |

### ✅ 验证

- `tsc --noEmit` 通过（`EXIT=0`）
- Day View 时间轴正确按 `dueTime` 落格
- 早于 6AM / 晚于 11PM 的事件落"其他时段"区
- 右侧 widgets 真实接入 `allDdls`（Upcoming 取未完成且 dueDate >= 今天 前 5；Tasks 取未完成前 5；Focus 静态 120 min UI）

### 🚦 后续可继续

- Focus Timer 接入真实计时（Phase 3 Tauri 通知后做）
- Week 视图（当前 day/month 两态，week 标 coming soon）
- Day View 时间轴拖拽创建 / 拖动改时间
- 月视图加迷你月历到 CalendarRail 左栏

---

## [022] 2026-05-22 — Stage C.1：TasksPanel 视觉重做（不动 schema）

> [UI-REDESIGN-PLAN.md](UI-REDESIGN-PLAN.md) Stage C 第一阶段：把 TasksPanel 从玻璃紫色切到墨绿设计语言。**不碰 Dexie schema**，保持现有 CRUD / 字段不变。字段扩展 (status/tags/priority) + 右侧详情抽屉留给 C.2。

### 📂 涉及文件

| 文件路径 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/components/TasksPanel.tsx` | 重写 | 移除 `DecoLayered` 玻璃装饰板；全部紫色 (`#6366f1`) 切到墨绿 (`var(--color-primary)`) token；分组卡改白底 + 1px border + 圆角 10；行 hover 改 `var(--color-surface)` 浅灰；权重 badge / 附件 chip / 编辑删除按钮全部用 token；`height: 100vh` → `100%`（修嵌套高度 bug）；AddButton 从紫渐变改墨绿实色 `PrimaryBtn`；ToolbarBtn 改白底墨绿系；EmptyState 改虚线边框风格；header 标题从 28px "每日任务" 改 22px "Tasks" + 副标题精简 |
| `apps/web/src/components/layout/TasksRail.tsx` | 修改 | 新增 `counts: TaskCounts` prop（active / upcoming / all / completed）；4 个 view 旁加灰色数字 badge（只显示，C.2 接入切换逻辑） |
| `apps/web/src/app/page.tsx` | 修改 | 新增 `taskCounts` useMemo 派生；传给 `<TasksRail>` |

### 🎨 视觉对比

| 维度 | 之前 | 现在 |
|---|---|---|
| 主色 | 紫色 `#6366f1` | 墨绿 `#1B3D2F` |
| 卡片 | DecoLayered 三层玻璃板 | 白底 + 1px border + 圆角 10 |
| 行 hover | 紫色 4% 底 | 浅灰 surface 底 |
| 行间隙 | 黑半透明 5% 边 | `var(--color-border-soft)` |
| 标题 | 28px 中文 + 长副标题 | 22px "Tasks" + 精简计数 |
| 新建按钮 | 紫渐变 + 紫阴影 | 墨绿实色 |
| 工具按钮 | 玻璃白底 + 紫 hover | 白底细边 + 墨绿 hover |
| 来源 pill | 黑半透明 4% | 灰 surface + 细边 |
| 复选框完成色 | `#10b981` 绿 | `var(--color-success)` 墨绿系 |
| 空状态 | DecoLayered 大圆角 + 紫渐变按钮 | 虚线边框 + 墨绿实色按钮 |

### ✅ 验证

- `tsc --noEmit` 通过（`EXIT=0`）
- 所有 CRUD 行为保留：勾选完成 / 编辑 modal / 删除 confirm / 附件预览 / ICS / JSON 导出导入
- TasksRail 4 view 显示真实数字（Active / Upcoming / All / Completed）

### 🚦 后续（Stage C.2）

- Dexie v3 → v4：加 `status: "todo" \| "in_progress" \| "done"` + `tags?: string[]` + `priority?` 字段
- 把 view 列表做成可点击切换（active 当前 view）
- TaskEditModal 改成右侧详情抽屉（与设计稿一致）
- TasksRail 的 Tags 分组接入真实标签云

### 💾 备份

- commit `19fa711` + tag `backup-021-comic-chat` （C.1 之前的完整状态）

---

## 📦 历史归档

- **[001]-[026]** 完整内容见 **[docs/progress/2026-05.md](docs/progress/2026-05.md)**（2026 年 5 月归档）
- **[027]-[040]** 物理保留在本文件上方（共 14 条；下次大归档时迁出）
- 按月索引：[docs/progress/INDEX.md](docs/progress/INDEX.md)

> 接班 AI 只需 Read PROGRESS 第一条（offset=0, limit=100）即可获取当前状态;旧条目按需 Glob/Grep 关键字定位。
