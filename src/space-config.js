/**
 * space-config.js —— 空间膨胀的**UI 文案 / 升级元数据**（先 UI 后逻辑）
 *
 * ⚠️ 这里放“页面要显示什么”与**唯一价格源**（baseCost / costMult）；
 *   购买/扣款在 `space-upgrades.js`，效果在 `space.js` 的 du 辅助函数 + 各落点。
 *
 * 设计依据：docs/SPACE-EXPANSION-FINAL.md（合并终稿）
 *   · du7 效果口径待接（pending）；du8 / du10 是价格侧，本阶段暂缓
 *   · du1~du6 用 SE 复购；du7~du11 用 ST 单次
 */
export const SPACE_DESIGN = {
  challengePower: 0.5,
  seDivisor: 40,
  seOffset: -7,
  stRate: 0.01,
  /**
   * ★ 2026-10-25 实测修正：挂机 EP 已达 1e1296，旧目标 1e10 已越过。
   * 当前阶段目标 = 1e3600（见 docs/SPACE-EXPANSION-FINAL.md §2.7）。
   */
  targetEp: "1e3600",
  /** 2026-10-25 用户裁定：空间膨胀改为 EP ≥ 1e1200 解锁（不是第一次永恒）。 */
  unlockEp: "1e1200",
  /** UI 阶段：所有按钮先禁用，避免“点了没反应” */
  wired: false,
};

/**
 * 升级表。`cost` 是**展示文案**；实际价格公式等引擎接线时再放进这里。
 * @typedef {{
 *   id:string, name:string, slot:string, currency:"se"|"st",
 *   repeatable:boolean, effect:string, desc:string, cost:string,
 *   baseCost:string, costMult?:number,
 *   pending?:boolean, pendingReason?:string,
 *   deferred?:boolean, deferredReason?:string
 * }} SpaceUpgrade
 * @type {SpaceUpgrade[]}
 */
export const SPACE_UPGRADES = [
  {
    id: "du1", name: "暗物质额外倍率", slot: "暗物质加法项",
    currency: "se", repeatable: true,
    effect: "×10^(n^1.5)",
    desc: "暗物质提供的额外倍率，按购买次数获得一个乘区。",
    cost: "1 SE 起 · ×1.5^n",
    baseCost: "1", costMult: 1.5,
  },
  {
    id: "du2", name: "巧板有效加成", slot: "七巧板三轴参数",
    currency: "se", repeatable: true,
    effect: "×10^(n^1.5)",
    desc: "七巧板的有效加成量按购买次数放大；只取非 IP 的巧板项。",
    cost: "2 SE 起 · ×1.5^n",
    baseCost: "2", costMult: 1.5,
  },
  {
    id: "du3", name: "量子强度", slot: "量子强度入口",
    currency: "se", repeatable: true,
    effect: "×10^(n^1.5)",
    desc: "按购买次数提升量子强度；接的是环上的量子产出。",
    cost: "3 SE 起 · ×1.5^n",
    baseCost: "3", costMult: 1.5,
  },
  {
    id: "du4", name: "免费 ZPE 引擎", slot: "有效引擎等级",
    currency: "se", repeatable: true,
    effect: "+10n 级 · 软上限 1e6 级",
    desc: "按购买次数给七巧板系统增加免费 ZPE 引擎等级；1e6 级前正常，1e8 级时每级效果降到初值 50%，之后继续递减但总量仍增加。",
    cost: "4 SE 起 · ×1.6^n",
    baseCost: "4", costMult: 1.6,
  },
  {
    id: "du5", name: "熵→粒子倍率", slot: "七巧板转化奖励",
    currency: "se", repeatable: true,
    effect: "×10^(√n)",
    desc: "按购买次数提升七巧板提供的熵→粒子转化倍率。",
    cost: "5 SE 起 · ×1.6^n",
    baseCost: "5", costMult: 1.6,
  },
  {
    id: "du6", name: "计数频率倍率", slot: "计数频率加法项",
    currency: "se", repeatable: true,
    effect: "×(1 + 0.5√n) · 软上限 1e8 级",
    desc: "按购买次数的开根，给计数频率一个倍率加成；1e8 级前正常，1e10 级时每级效果降到初值 50%，之后继续递减但总量仍增加。",
    cost: "6 SE 起 · ×1.6^n",
    baseCost: "6", costMult: 1.6,
  },
  {
    id: "du7", name: "量子同频", slot: "量子加成合成点",
    currency: "st", repeatable: false,
    effect: "换口径：按量子个数",
    desc: "量子加成改为按量子**个数**计算，而不是只按每对。",
    cost: "10 ST · 单次",
    baseCost: "10",
    pending: true, pendingReason: "效果口径待定：量子加成按个数/每对的入口还没写死",
  },
  {
    id: "du8", name: "ZPE 引擎价格削弱", slot: "ZPE 引擎价格",
    currency: "st", repeatable: false,
    effect: "渐近 10% 价格",
    desc: "ZPE 倍率削弱 ZPE 引擎购买价格；价格侧，不是环转化速率。",
    cost: "100 ST · 单次",
    baseCost: "100",
    deferred: true, deferredReason: "IP 倍率禁令：本阶段暂缓",
  },
  {
    id: "du9", name: "虚空升级强度", slot: "虚空升级效果",
    currency: "st", repeatable: false,
    effect: "∝ log10(量子数)（封顶）",
    desc: "所有虚空升级的强度按量子数量获得有封顶的倍增。",
    cost: "1e3 ST · 单次",
    baseCost: "1e3",
  },
  {
    id: "du10", name: "膨胀升级价格修正", slot: "SE 升级价格",
    currency: "st", repeatable: false,
    effect: "ZPE 倍率修正价格",
    desc: "ZPE 倍率对可重复膨胀升级执行价格修正；价格侧，暂缓。",
    cost: "1e4 ST · 单次",
    baseCost: "1e4",
    deferred: true, deferredReason: "IP 倍率禁令：本阶段暂缓",
  },
  {
    id: "du11", name: "暗能量超载缓解", slot: "暗能量过载惩罚",
    currency: "st", repeatable: false,
    effect: "超载强度下限 0.3→0.95，随 ST 升高",
    desc: "单次购买；用购买后的当前 ST 抬高暗能量被超载削弱后的强度下限。ST=C 时 0.3×初始，越高越接近 1，但封顶 0.95。",
    cost: "1e5 ST · 单次",
    baseCost: "1e5",
  },
];

export function spaceUpgradeById(id) {
  return SPACE_UPGRADES.find((u) => u.id === id) ?? null;
}
