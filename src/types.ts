/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ItemType = 'hat' | 'armor' | 'pants' | 'sword' | 'potion' | 'shield';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  statValue: number; // ATK increase for sword, DEF increase for others
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  area: number;
  description: string;
  color: string;
}

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  baseAtk: number;
  baseDef: number;
  dir: 'up' | 'down' | 'left' | 'right';
  screenX: number; // 0 to 2
  screenY: number; // 0 to 2
  speed: number;
  level: number;
  exp: number;
  kills: number;
  frozenTimer?: number; // 2秒間の氷結 (動けなくなる)
  shieldActiveTimer?: number; // 盾ガードの有効フレーム数
  shieldCooldown?: number; // 盾ガードの秒数フレーム
}

export type EnemyType = 'mob1' | 'mob2' | 'boss' | 'key_carrier';

export interface Enemy {
  id: string;
  type: EnemyType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  color: string;
  isAggressive: boolean;
  shootCooldown: number; // in frames or ms
  behavior: 'wander' | 'chase' | 'charge';
  screenX: number;
  screenY: number;
  shootTimer?: number;
  stiffenTimer?: number; // 硬直タイマー (フレーム数)
  stiffenDuration?: number; // 硬直時間最大
  isAttackingChain?: boolean; // 溜めから硬直終了までを走らせるかのフラグ
  lockedAngle?: number; // 溜め開始時にロックオンしたプレイヤー of 角度
  isKeyCarrier?: boolean; // 輝く鍵守フラグ
  bossAttackCycle?: number;  // ボスの攻撃サイクル管理
  breathWarningTimer?: number; // 氷のブレス予兆カウント
  breathAngle?: number;       // 氷のブレス発角
}

export interface Projectile {
  id: string;
  shooterId?: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  damage: number;
  color: string;
  screenX: number;
  screenY: number;
  isWeb?: boolean; // 草原の牙グモの蜘蛛糸
  isPoison?: boolean; // 針コパスコーピオンの毒
  isBurn?: boolean; // マグマバット・獄炎トカゲの燃焼
  isFreeze?: boolean; // フリーズスプライトの氷結弾
  isLizardKingFire?: boolean; // 魔トカゲの王の炎弾
  isChimeraFire?: boolean; // キマイラの獅子紅炎弾 (Area 2 Boss Lion Fire)
  isChimeraCursedSand?: boolean; // キマイラの山羊呪詛砂弾 (Area 2 Boss Goat Sand)
  isGlaciosIceCrystal?: boolean; // グラキオス：優麗なる氷晶弾
  isGlaciosIceBreath?: boolean;  // グラキオス：極寒の氷のブレス
}

export interface DropItem {
  id: string;
  item: Item;
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  bounceY: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  life: number; // in frames
  fontSize?: string;
}

export interface GameArea {
  id: number;
  name: string;
  theme: 'forest' | 'desert' | 'volcano' | 'ice' | 'abyss';
  description: string;
  bgColor: string;
  accentColor: string;
  borderColor: string;
  obstacleColor: string;
  bossName: string;
  bossColor: string;
}
