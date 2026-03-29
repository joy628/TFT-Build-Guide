export const SEASONS = [
  "S13: 异常突变",
  "S12: 魔法乱斗",
  "S11: 画中灵",
  "S10: 强音争霸"
];

export interface Hero {
  name: string;
  season: string;
  traits: string[];
}

export const HERO_DATA: Hero[] = [
  // S13 示例
  { name: "斯维因", season: "S13: 异常突变", traits: ["诺克萨斯", "法师", "主宰"] },
  { name: "安蓓萨", season: "S13: 异常突变", traits: ["诺克萨斯", "征服者", "迅捷射手"] },
  { name: "金克丝", season: "S13: 异常突变", traits: ["极客", "伏击者"] },
  { name: "蔚", season: "S13: 异常突变", traits: ["执法官", "格斗家"] },
  { name: "凯特琳", season: "S13: 异常突变", traits: ["执法官", "狙神"] },
  
  // S12 示例
  { name: "卡蜜尔", season: "S12: 魔法乱斗", traits: ["时间学派", "多重打击者"] },
  { name: "泽拉斯", season: "S12: 魔法乱斗", traits: ["命运之子", "飞升者"] },
  { name: "黛安娜", season: "S12: 魔法乱斗", traits: ["堡垒卫士", "冰霜"] },
  { name: "布里茨", season: "S12: 魔法乱斗", traits: ["蜜蜂", "重装战士"] },
  { name: "维迦", season: "S12: 魔法乱斗", traits: ["蜜蜂", "法师"] },

  // S11 示例
  { name: "亚索", season: "S11: 画中灵", traits: ["灵魂莲华", "决斗大师"] },
  { name: "卡莎", season: "S11: 画中灵", traits: ["墨之影", "迅捷射手"] },
  { name: "慧", season: "S11: 画中灵", traits: ["画圣", "山海绘卷"] },
  { name: "瑟提", season: "S11: 画中灵", traits: ["灵魂莲华", "夜幽", "护卫"] },
  { name: "艾希", season: "S11: 画中灵", traits: ["青花瓷", "狙神"] },

  // S10 示例
  { name: "阿卡丽", season: "S10: 强音争霸", traits: ["K/DA", "真实伤害", "裁决使"] },
  { name: "永恩", season: "S10: 强音争霸", traits: ["心之钢", "音浪刺客"] },
  { name: "伊泽瑞尔", season: "S10: 强音争霸", traits: ["心之钢", "大腕枪手"] },
];

export const ENEMY_TYPES = [
  { id: "high_armor", label: "高护甲阵容 (如：山海绘卷、护卫)" },
  { id: "high_mr", label: "高魔抗阵容 (如：龙王、圣贤)" },
  { id: "high_hp", label: "高生命值阵容 (如：斗士、大虫子)" },
  { id: "magic_damage", label: "法系爆发 (如：法师、辛德拉)" },
  { id: "physical_damage", label: "物理爆发 (如：狙神、决斗大师)" },
  { id: "healing", label: "高回复/吸血 (如：天龙、索拉卡)" },
  { id: "shielding", label: "高护盾 (如：擎天卫)" }
];
