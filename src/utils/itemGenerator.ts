/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Item, ItemType } from '../types';

const RARITIES: Array<'common' | 'rare' | 'epic' | 'legendary'> = ['common', 'rare', 'epic', 'legendary'];

const RARITY_COLORS = {
  common: '#9ca3af',     // Silver/Gray
  rare: '#3b82f6',       // Blue
  epic: '#a855f7',       // Purple
  legendary: '#f59e0b',  // Orange/Gold
};

// Item Prefixes based on Area
const AREA_PREFIXES: Record<number, string[]> = {
  1: ['「旅立ちの」', '「見習いの」', '「草原の」', '「のどかな」'],
  2: ['「古代遺跡の」', '「灼砂の」', '「渇きの」', '「迷宮の」'],
  3: ['「熔鉄の」', '「獄炎の」', '「黒曜石の」', '「マグマ弾の」'],
  4: ['「鳳氷の」', '「絶対零度の」', '「極光の」', '「オーロラ」'],
  5: ['「深淵の」', '「虚無竜の」', '「冥闇の」', '「終焉の」'],
};

// Names per category
const CATEGORY_NAMES: Record<ItemType, string[]> = {
  hat: ['フード', 'ハット', '兜', 'ヘルム', 'クラウン'],
  armor: ['ローブ', 'レザーベスト', 'チェストプレート', 'フルアーマー', '魔道メイル'],
  pants: ['ズボン', 'レギンス', 'タイツ', 'グリーブ', 'クイス'],
  sword: ['ショートソード', 'クレイモア', 'カタナ', '神剣', 'ブレイズバスター'],
  potion: ['不思議な薬瓶'],
};

// Boss specific items (Guaranteed Legendary)
const BOSS_ITEMS: Record<number, Record<ItemType, string>> = {
  1: {
    hat: '「喰種スライム」スライムベレー',
    armor: '「粘体主」リキッドジャケット',
    pants: '「分裂歩む」スライムショート',
    sword: '「王泥」スライムカリバー',
    potion: '「万能薬」スライムエリクシル',
  },
  2: {
    hat: '「古代王」ファラオマター',
    armor: '「砂漠王」ゴールデンプレート',
    pants: '「守護神」アヌビスレガース',
    sword: '「死冥」アヌビス・サイズ',
    potion: '「黄金液」ゴールデンネクター',
  },
  3: {
    hat: '「重撃」火竜王の角兜',
    armor: '「焔帝」プロミネンスメイル',
    pants: '「灼熱」マグマフットガード',
    sword: '「獄滅」レグザール・ブレイザー',
    potion: '「溶岩滴」マグマエリクシル',
  },
  4: {
    hat: '「氷華」エルサラ・ティアラ',
    armor: '「氷皇」ダイヤモンドダストローブ',
    pants: '「氷河」フロストガード',
    sword: '「氷晶」エルシクル・シュレッダー',
    potion: '「氷晶液」フリーズエリクシル',
  },
  5: {
    hat: '「混沌」カオス・ファナティック',
    armor: '「奈落」アビス・ダークアーマー',
    pants: '「無窮」ウルトラ・ヴォイドレガース',
    sword: '「破滅」エンドレス・カオスディバイン',
    potion: '「深淵水」カオスエリクシル',
  },
};

export function getDefaultEquipment(): { hat: Item; armor: Item; pants: Item; sword: Item } {
  return {
    hat: {
      id: 'default-hat',
      name: '初心者の古びた帽子',
      type: 'hat',
      statValue: 1,
      rarity: 'common',
      area: 1,
      description: '少し頭を守るための古い布切れで作られた帽子。防御力 +1',
      color: '#9ca3af',
    },
    armor: {
      id: 'default-armor',
      name: '初心者のボロい上着',
      type: 'armor',
      statValue: 2,
      rarity: 'common',
      area: 1,
      description: '旅立ちの際に手に入れたボロボロの服。防御力 +2',
      color: '#9ca3af',
    },
    pants: {
      id: 'default-pants',
      name: '初心者の古びたズボン',
      type: 'pants',
      statValue: 1,
      rarity: 'common',
      area: 1,
      description: '穴のあいたズボン。防御力 +1',
      color: '#9ca3af',
    },
    sword: {
      id: 'default-sword',
      name: '初心者の木刀',
      type: 'sword',
      statValue: 5,
      rarity: 'common',
      area: 1,
      description: '旅立ちの時に削ったただの細木の棒。攻撃力 +5',
      color: '#9ca3af',
    },
  };
}

export function generateItem(area: number, isBossDrop: boolean = false): Item {
  const id = `item-${Math.random().toString(36).substr(2, 9)}`;
  
  // Choose item type
  const types: ItemType[] = ['hat', 'armor', 'pants', 'sword'];
  const type = types[Math.floor(Math.random() * types.length)];

  let rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common';
  
  if (isBossDrop) {
    rarity = 'legendary';
  } else {
    const roll = Math.random() * 100;
    if (roll < 3) rarity = 'legendary';
    else if (roll < 15) rarity = 'epic';
    else if (roll < 40) rarity = 'rare';
    else rarity = 'common';
  }

  // Calculate base stat values dynamically according to area and rarity
  // Area 1: base stats = Hat/Armor/Pants: +2..+5, Sword: +8..+15
  // Area scaling: multiplier roughly (area * 1.8)
  const isWeapon = type === 'sword';
  const baseRangeMin = isWeapon ? 6 * area : 2 * area;
  const baseRangeMax = isWeapon ? 12 * area : 5 * area;
  
  // Rarity multipliers
  const rarityMult = {
    common: 1.0,
    rare: 1.4,
    epic: 2.0,
    legendary: 3.2,
  }[rarity];

  const randomBase = baseRangeMin + Math.random() * (baseRangeMax - baseRangeMin);
  const statValue = Math.round(randomBase * rarityMult);

  let name = '';
  if (isBossDrop) {
    name = BOSS_ITEMS[area]?.[type] || '伝説の秘宝';
  } else {
    const prefixes = AREA_PREFIXES[area] || ['未知の'];
    const partNames = CATEGORY_NAMES[type];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const partName = partNames[Math.floor(Math.random() * partNames.length)];
    
    // Add bonus mark to sound interesting
    let bonusSuffix = '';
    if (rarity === 'rare') bonusSuffix = ' +1';
    else if (rarity === 'epic') bonusSuffix = ' +2';
    else if (rarity === 'legendary') bonusSuffix = ' +4';
    
    name = `${prefix}${partName}${bonusSuffix}`;
  }

  const statLabel = isWeapon ? '攻撃力' : '防御力';
  const rarityLabel = {
    common: 'コモン',
    rare: 'レア',
    epic: 'エピック',
    legendary: 'レジェンダリー',
  }[rarity];

  const description = `${rarityLabel}品質の装備。エリア ${area} で発見された。装備すると ${statLabel} が ${statValue} 上昇する。`;
  const color = RARITY_COLORS[rarity];

  return {
    id,
    name,
    type,
    statValue,
    rarity,
    area,
    description,
    color,
  };
}

export function generateRareItemForCarrier(area: number): Item {
  const id = `item-rare-carrier-${Math.random().toString(36).substr(2, 9)}`;
  const types: ItemType[] = ['hat', 'armor', 'pants', 'sword'];
  const type = types[Math.floor(Math.random() * types.length)];
  
  const rarity: 'epic' | 'legendary' = Math.random() < 0.3 ? 'legendary' : 'epic';
  
  const isWeapon = type === 'sword';
  const baseRangeMin = isWeapon ? 6 * area : 2 * area;
  const baseRangeMax = isWeapon ? 12 * area : 5 * area;
  
  const rarityMult = {
    epic: 2.0,
    legendary: 3.2,
  }[rarity];

  const randomBase = baseRangeMin + Math.random() * (baseRangeMax - baseRangeMin);
  const statValue = Math.round(randomBase * rarityMult);

  const prefixes = AREA_PREFIXES[area] || ['未知の'];
  const partNames = CATEGORY_NAMES[type];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const partName = partNames[Math.floor(Math.random() * partNames.length)];
  
  let bonusSuffix = rarity === 'epic' ? ' +2(輝)' : ' +4(輝)';
  const name = `✨輝の${prefix}${partName}${bonusSuffix}`;

  const statLabel = isWeapon ? '攻撃力' : '防御力';
  const rarityLabel = rarity === 'legendary' ? 'レジェンダリー' : 'エピック';

  const description = `✨輝きし極光の鍵守よりドロップした限定の${rarityLabel}品質。エリア ${area} の奇跡の宿る装備。装備すると ${statLabel} が ${statValue} 上昇する。`;
  const color = RARITY_COLORS[rarity];

  return {
    id,
    name,
    type,
    statValue,
    rarity,
    area,
    description,
    color,
  };
}

