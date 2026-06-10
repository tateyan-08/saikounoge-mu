/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Shield, 
  Sword, 
  Volume2, 
  VolumeX, 
  Trophy, 
  HelpCircle, 
  RefreshCw, 
  Flame, 
  Sparkles, 
  Backpack, 
  MapPin, 
  RotateCcw, 
  Gamepad2, 
  Compass, 
  Skull, 
  ChevronRight,
  Info,
  Key
} from 'lucide-react';
import { Player, Enemy, Projectile, DropItem, FloatingText, Particle, GameArea, Item, ItemType } from './types';
import { gameAudio } from './utils/audio';
import { getDefaultEquipment, generateItem, generateRareItemForCarrier } from './utils/itemGenerator';

// Canvas Size
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;

// Game Config Areas
const AREAS: Record<number, GameArea> = {
  1: {
    id: 1,
    name: '始まりの草原',
    theme: 'forest',
    description: '冒険が始まる穏やかな緑の平原。魔物も弱く、基本操作を学ぶのに最適。',
    bgColor: '#1e3a1e',
    accentColor: '#4ade80',
    borderColor: '#166534',
    obstacleColor: '#052e16',
    bossName: 'マザー・スライム',
    bossColor: '#22c55e'
  },
  2: {
    id: 2,
    name: '砂漠と魔物の遺跡',
    theme: 'desert',
    description: '砂嵐が吹き荒れる広大な遺跡群。動きの速い針サソリや魔導の罠が仕掛けられている。',
    bgColor: '#3f2e1b',
    accentColor: '#facc15',
    borderColor: '#854d0e',
    obstacleColor: '#451a03',
    bossName: '双頭魔獣キマイラ',
    bossColor: '#d97706'
  },
  3: {
    id: 3,
    name: '灼熱の火山洞窟',
    theme: 'volcano',
    description: '煮えたぎるマグマの熱気が立ち込める洞窟。一撃が痛い灼熱の魔獣たちが住処とする。',
    bgColor: '#3b1111',
    accentColor: '#f87171',
    borderColor: '#991b1b',
    obstacleColor: '#450a0a',
    bossName: '三頭蛇竜ヒュドラ',
    bossColor: '#ef4444'
  },
  4: {
    id: 4,
    name: '氷晶と吹雪の世界',
    theme: 'ice',
    description: '美しくも冷酷な結晶と氷塊地帯。攻撃を食らうと移動速度が著しく低下する極寒 of 奈落。',
    bgColor: '#172554',
    accentColor: '#38bdf8',
    borderColor: '#1e40af',
    obstacleColor: '#0c4a6e',
    bossName: '氷牙蒼龍グラキオス',
    bossColor: '#93c5fd'
  },
  5: {
    id: 5,
    name: '混沌の虚無深淵',
    theme: 'abyss',
    description: '時空がねじれ、光すら飲み込まれた最終エリア。深淵の支配者が魔術の弾幕を放つ。',
    bgColor: '#11101b',
    accentColor: '#c084fc',
    borderColor: '#581c87',
    obstacleColor: '#3b0764',
    bossName: '終焉魔神龍ヘルアビス',
    bossColor: '#a855f7'
  }
};

// Procedural screen obstruction layout generator based on coordinates, consistent per screen
interface Obstacle {
  x: number;
  y: number;
  r: number; // circular obstacles are easier and feel smoother for collision
  type: string;
}

function getObstaclesForScreen(areaId: number, screenX: number, screenY: number, gateOpened: boolean = true): Obstacle[] {
  // Simple seed generator to keep obstacles static but varied per screen coords
  const seed = areaId * 13 + screenX * 37 + screenY * 73;
  const obstacles: Obstacle[] = [];
  
  // Predictable pseudorandom function
  let randCount = 0;
  const nextRand = () => {
    const val = Math.sin(seed + randCount) * 10000;
    randCount++;
    return val - Math.floor(val);
  };

  // Boss screen (2, 2) has a clean, wide boss arena so the combat is comfortable!
  if (screenX === 2 && screenY === 2) {
    const list: Obstacle[] = [];
    
    // Gimmick gates when door is closed
    if (!gateOpened) {
      // West entry gate (from 1, 2)
      for (let wy = 20; wy <= CANVAS_HEIGHT - 20; wy += 35) {
        const isDoor = (wy >= 200 && wy <= 280);
        list.push({
          x: 140,
          y: wy,
          r: 16,
          type: isDoor ? 'gate_left' : 'gate_wall'
        });
      }
      
      // North entry gate (from 2, 1)
      for (let wx = 20; wx <= CANVAS_WIDTH - 20; wx += 35) {
        const isDoor = (wx >= 360 && wx <= 440);
        list.push({
          x: wx,
          y: 120,
          r: 16,
          type: isDoor ? 'gate_top' : 'gate_wall'
        });
      }
    }

    // Just four decorative pillars in corners
    list.push({ x: 150, y: 120, r: 25, type: 'pillar' });
    list.push({ x: 650, y: 120, r: 25, type: 'pillar' });
    list.push({ x: 150, y: 360, r: 25, type: 'pillar' });
    list.push({ x: 650, y: 360, r: 25, type: 'pillar' });
    return list;
  }

  // Adjacent maps: show gateway gating if door is closed
  if (screenX === 1 && screenY === 2 && !gateOpened) {
    for (let wy = 20; wy <= CANVAS_HEIGHT - 20; wy += 35) {
      const isDoor = (wy >= 200 && wy <= 280);
      obstacles.push({
        x: CANVAS_WIDTH - 22,
        y: wy,
        r: 16,
        type: isDoor ? 'gate_left' : 'gate_wall'
      });
    }
  }
  if (screenX === 2 && screenY === 1 && !gateOpened) {
    for (let wx = 20; wx <= CANVAS_WIDTH - 20; wx += 35) {
      const isDoor = (wx >= 360 && wx <= 440);
      obstacles.push({
        x: wx,
        y: CANVAS_HEIGHT - 22,
        r: 16,
        type: isDoor ? 'gate_top' : 'gate_wall'
      });
    }
  }

  // Normal screen obstacle generator count: 4 to 7 hurdles
  const count = 4 + Math.floor(nextRand() * 4);
  for (let i = 0; i < count; i++) {
    // Ensure obstacles are positioned safely away from screen boundaries (min 100px from walls)
    const x = 120 + nextRand() * (CANVAS_WIDTH - 240);
    const y = 90 + nextRand() * (CANVAS_HEIGHT - 180);
    const r = 18 + nextRand() * 15; // Radius: 18px to 33px
    
    // Choose type of obstacle
    const randVal = nextRand();
    let type = 'rock';
    let finalR = r;
    if (randVal < 0.40) {
      type = 'tree';
    } else if (randVal < 0.70) {
      type = 'rock';
    } else if (randVal < 0.85) {
      type = 'pillar';
    } else {
      type = 'hut';
      finalR = 32; // Huts are slightly larger structures
    }
    
    // Avoid double overlays
    const overlaps = obstacles.some(obs => {
      const dx = obs.x - x;
      const dy = obs.y - y;
      const minSpacing = (type === 'hut' || obs.type === 'hut') ? 70 : 45;
      return Math.sqrt(dx * dx + dy * dy) < (obs.r + finalR + minSpacing);
    });

    if (!overlaps) {
      obstacles.push({ x, y, r: finalR, type });
    }
  }
  return obstacles;
}

export default function App() {
  // Game reactive state (Mirrored from refs for UI rendering)
  const [currentArea, setCurrentArea] = useState<number>(1);
  const [playerLevel, setPlayerLevel] = useState<number>(1);
  const [playerHP, setPlayerHP] = useState<number>(100);
  const [playerMaxHP, setPlayerMaxHP] = useState<number>(100);
  const [playerExp, setPlayerExp] = useState<number>(0);
  const [playerKills, setPlayerKills] = useState<number>(0);
  const [currentGold, setCurrentGold] = useState<number>(0);

  // Equipped states
  const [equippedHat, setEquippedHat] = useState<Item>(getDefaultEquipment().hat);
  const [equippedArmor, setEquippedArmor] = useState<Item>(getDefaultEquipment().armor);
  const [equippedPants, setEquippedPants] = useState<Item>(getDefaultEquipment().pants);
  const [equippedSword, setEquippedSword] = useState<Item>(getDefaultEquipment().sword);

  // Inventory & Game controls
  const [inventory, setInventory] = useState<Item[]>([
    getDefaultEquipment().hat,
    getDefaultEquipment().armor,
    getDefaultEquipment().pants,
    getDefaultEquipment().sword,
  ]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Map state
  const [screenCoordinates, setScreenCoordinates] = useState({ x: 0, y: 0 });
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [gameLog, setGameLog] = useState<string[]>(['ゲームが開始されました。草原エリア(0, 0)からスタート！']);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [hasWonFinal, setHasWonFinal] = useState<boolean>(false);
  const [testPlayMode, setTestPlayMode] = useState<boolean>(false);
  const [hasAreaKey, setHasAreaKey] = useState<boolean>(false);
  const [gateOpened, setGateOpened] = useState<boolean>(false);
  const [carrierDefeated, setCarrierDefeated] = useState<boolean>(false);
  const [areaKills, setAreaKills] = useState<number>(0);
  const [isBagOpen, setIsBagOpen] = useState<boolean>(false);
  const [boostTimeLeft, setBoostTimeLeft] = useState<number>(0);
  const [isPlayerFrozen, setIsPlayerFrozen] = useState<boolean>(false);

  // Ref refs for core rendering loops without lag
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Game Engine Coordinates and Lists
  const gameRef = useRef({
    area: 1,
    testPlayMode: false,
    hasAreaKey: false,
    gateOpened: false,
    keyCarrierScreenX: -1,
    keyCarrierScreenY: -1,
    keyCarrierDefeated: true,
    gateAlertTimer: 0,
    areaKills: 0,
    isBagOpen: false,
    boostDuration: 0,
    player: {
      x: 150,
      y: 240,
      width: 28,
      height: 38,
      hp: 100,
      maxHp: 100,
      baseAtk: 10,
      baseDef: 2,
      dir: 'right' as 'up' | 'down' | 'left' | 'right',
      screenX: 0,
      screenY: 0,
      speed: 3,
      level: 1,
      exp: 0,
      kills: 0,
      gold: 0,
      isAttacking: false,
      attackCooldown: 0, // cooldown counter
      attackAnimFrame: 0,
      lastHurtTime: 0,
      freezeDuration: 0,
    },
    keys: {} as Record<string, boolean>,
    enemies: [] as Enemy[],
    projectiles: [] as Projectile[],
    dropItems: [] as DropItem[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    portal: {
      x: 0,
      y: 0,
      active: false,
      screenX: 2,
      screenY: 2,
    },
    screenShake: 0,
    lastFrameTime: 0,
    respawnTimer: 0,
    bossSpawned: false,
  });

  // Calculate current effective fighting stats
  const coreStats = useMemo(() => {
    const defenseBonus = equippedHat.statValue + equippedArmor.statValue + equippedPants.statValue;
    const attackBonus = equippedSword.statValue;
    return {
      atk: gameRef.current.player.baseAtk + attackBonus + (boostTimeLeft > 0 ? 10 : 0),
      def: gameRef.current.player.baseDef + defenseBonus,
    };
  }, [equippedHat, equippedArmor, equippedPants, equippedSword, playerLevel, boostTimeLeft]);

  // Audio switcher
  const handleSoundToggle = () => {
    const nextVal = gameAudio.toggleSound();
    setSoundOn(nextVal);
  };

  // Game log appender
  const addLog = (msg: string) => {
    setGameLog(prev => {
      const next = [msg, ...prev];
      return next.slice(0, 35); // Keep last 35
    });
  };

  // Initialize the lock gating and key-carrier spawning properties for the given area
  const initAreaGimmick = (areaId: number) => {
    setAreaKills(0);
    gameRef.current.areaKills = 0;

    // 非ボス画面(2, 2)およびスタート地点(0,0)以外に輝きし敵（極光の鍵守）を配置
    const possibleCoords = [
      { x: 0, y: 1 }, { x: 0, y: 2 },
      { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 },
      { x: 2, y: 0 }, { x: 2, y: 1 }
    ];
    const selected = possibleCoords[Math.floor(Math.random() * possibleCoords.length)];
    gameRef.current.keyCarrierScreenX = selected.x;
    gameRef.current.keyCarrierScreenY = selected.y;
    gameRef.current.keyCarrierDefeated = false;
    setCarrierDefeated(false);

    if (areaId === 2) {
      // エリア2のみ: 門を開けるのに鍵が必要。初期状態は未所持、未開。
      setHasAreaKey(false);
      setGateOpened(false);
      gameRef.current.hasAreaKey = false;
      gameRef.current.gateOpened = false;
    } else if (areaId === 1) {
      // エリア1: 10体撃破で自動で門が開く。鍵は不要。
      setHasAreaKey(false);
      setGateOpened(false);
      gameRef.current.hasAreaKey = false;
      gameRef.current.gateOpened = false;
    } else {
      // エリア3, 4, 5: 鍵不要、最初から開門済み
      setHasAreaKey(true);
      setGateOpened(true);
      gameRef.current.hasAreaKey = true;
      gameRef.current.gateOpened = true;
    }
    gameRef.current.gateAlertTimer = 0;
  };

  // Inventory equipping handler
  const handleEquipItem = (item: Item) => {
    if (item.id === equippedHat.id || item.id === equippedArmor.id || item.id === equippedPants.id || item.id === equippedSword.id) {
      addLog(`「${item.name}」は既に装備されています。`);
      return;
    }

    gameAudio.playCollect();
    if (item.type === 'hat') {
      setEquippedHat(item);
    } else if (item.type === 'armor') {
      setEquippedArmor(item);
    } else if (item.type === 'pants') {
      setEquippedPants(item);
    } else if (item.type === 'sword') {
      setEquippedSword(item);
    }
    addLog(`🛡 装備しました: ${item.name} (${item.type === 'sword' ? '攻撃力' : '防御力'} +${item.statValue})`);
  };

  const handleSellItem = (itemToDelete: Item) => {
    // Cannot sell equipped items
    if (
      itemToDelete.id === equippedHat.id || 
      itemToDelete.id === equippedArmor.id || 
      itemToDelete.id === equippedPants.id || 
      itemToDelete.id === equippedSword.id
    ) {
      addLog(`❌ 装備中のアイテム「${itemToDelete.name}」は売却できません。`);
      return;
    }

    const goldValue = itemToDelete.area * 15 + (itemToDelete.rarity === 'legendary' ? 100 : itemToDelete.rarity === 'epic' ? 50 : 20);
    gameRef.current.player.gold += goldValue;
    setCurrentGold(gameRef.current.player.gold);
    
    setInventory(prev => prev.filter(item => item.id !== itemToDelete.id));
    if (selectedItem?.id === itemToDelete.id) {
      setSelectedItem(null);
    }
    gameAudio.playCollect();
    addLog(`💰 「${itemToDelete.name}」を売却し、ゴールド x${goldValue} を得ました。`);
  };

  // Drink/Use Potion Handler
  const handleUsePotion = (itemToUse: Item) => {
    if (itemToUse.type !== 'potion') return;

    // Remove the potion from inventory
    setInventory(prev => prev.filter(item => item.id !== itemToUse.id));
    
    // Clear selection
    setSelectedItem(null);

    // Set boost duration inside loop (60 seconds at 60fps)
    (gameRef.current as any).boostDuration = 3600;
    setBoostTimeLeft(60);

    // Play gulp sound / bubble sound using available playWebShoot
    if (gameAudio.playWebShoot) {
      gameAudio.playWebShoot();
    }
    gameAudio.playCollect();

    // Spawn massive fiery geyser of sparks around player
    const player = gameRef.current.player;
    for (let f = 0; f < 35; f++) {
      gameRef.current.particles.push({
        id: `potion-boost-init-${Math.random()}`,
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        dx: (Math.random() - 0.5) * 6,
        dy: (Math.random() - 0.5) * 6 - 2,
        color: '#f97316',
        size: 3 + Math.random() * 4,
        life: 30,
        maxLife: 30,
      });
    }

    addLog(`🔥【ブーストモード！】マグマポーションを飲み干した！ 60秒間、攻撃力＋10 ＆ 極光結晶ゴーレムの耐性シールドを破壊可能！`);
  };

  // Spawns enemies on current screen
  const spawnMobsForCurrentScreen = (areaId: number, screenX: number, screenY: number) => {
    const enemiesList: Enemy[] = [];
    const area = AREAS[areaId];
    
    // Boss room at screen (2, 2)
    if (screenX === 2 && screenY === 2) {
      // Spawn Boss!
      if (!gameRef.current.portal.active) {
        enemiesList.push({
          id: `boss-${areaId}`,
          type: 'boss',
          name: `【エリアボス】${area.bossName}`,
          x: CANVAS_WIDTH / 2 - 30,
          y: CANVAS_HEIGHT / 2 - 30,
          width: 70,
          height: 70,
          hp: areaId * 180 + 100,
          maxHp: areaId * 180 + 100,
          atk: areaId * 12 + 10,
          def: areaId * 4 + 3,
          speed: 0.9 + (areaId * 0.08),
          color: area.bossColor,
          isAggressive: true,
          shootCooldown: 0,
          behavior: 'charge',
          screenX,
          screenY,
          shootTimer: 0,
        });
        gameRef.current.bossSpawned = true;
      }
    } else {
      // Normal map screens: Spawn 2 to 4 mobs depending on Area difficulty
      const mobCount = 2 + (areaId > 2 ? 2 : 1);
      
      const mobNames = {
        1: ['グリーンスライム', '草原の牙蜘蛛'],
        2: ['針コパースコーピオン', '砂漠の魔石兵'],
        3: ['獄炎トカゲ', 'マグマバット'],
        4: ['フリーズスプライト', '極光結晶ゴーレム'],
        5: ['エンドレスビクター', '深淵虚黒這い']
      }[areaId] || ['魔物', '異形の獣'];

      const mobColors = {
        1: ['#4ade80', '#22c55e'],
        2: ['#fbbf24', '#b45309'],
        3: ['#ef4444', '#b91c1c'],
        4: ['#67e8f9', '#2563eb'],
        5: ['#c084fc', '#6b21a8']
      }[areaId] || ['#9ca3af', '#4b5563'];

      for (let i = 0; i < mobCount; i++) {
        const typeIndex = i % 2 === 0 ? 'mob1' : 'mob2';
        const name = mobNames[i % mobNames.length];
        
        // Random safe coords away from center (to avoid spawning on player)
        let rx = 100 + Math.random() * (CANVAS_WIDTH - 200);
        let ry = 100 + Math.random() * (CANVAS_HEIGHT - 200);
        
        const enemySize = areaId === 1 ? 27 : Math.round(36 + areaId * 2.5);

        enemiesList.push({
          id: `mob-${screenX}-${screenY}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          type: typeIndex,
          name,
          x: rx,
          y: ry,
          width: enemySize,
          height: enemySize,
          hp: areaId * 24 + 16,
          maxHp: areaId * 24 + 16,
          atk: areaId * 4 + 5,
          def: areaId * 1 + 1,
          speed: 0.7 + Math.random() * 0.4 + (areaId * 0.05),
          color: mobColors[i % mobColors.length],
          isAggressive: true,
          shootCooldown: Math.max(90, 180 - areaId * 15), // ranged shoot rate
          behavior: areaId > 1 && i % 2 === 1 ? 'charge' : 'wander',
          screenX,
          screenY,
          shootTimer: Math.floor(Math.random() * 100),
        });
      }

      // Spawn exactly one extra "glowing enemy" (輝きし敵) in non-boss screens if it's the Key Carrier Screen of this area
      if (areaId >= 1 && screenX === gameRef.current.keyCarrierScreenX && screenY === gameRef.current.keyCarrierScreenY && !gameRef.current.keyCarrierDefeated) {
        enemiesList.push({
          id: `key-carrier-${areaId}-${Math.random()}`,
          type: 'key_carrier',
          name: '✨輝きし極光の鍵守✨',
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT / 2,
          width: 32 + areaId * 2,
          height: 32 + areaId * 2,
          hp: areaId * 40 + 70,
          maxHp: areaId * 40 + 70,
          atk: areaId * 4 + 7,
          def: areaId * 1.5 + 2,
          speed: 1.1 + areaId * 0.05,
          color: '#fbbf24', // glowing golden aura
          isAggressive: true,
          shootCooldown: Math.max(70, 140 - areaId * 10),
          behavior: 'charge',
          screenX,
          screenY,
          shootTimer: 0,
          isKeyCarrier: true,
        });
      }
    }
    
    gameRef.current.enemies = enemiesList;
    gameRef.current.projectiles = []; // clear remaining projectiles from other screens
  };

  // Revive logic
  const handleRespawn = () => {
    setIsGameOver(false);
    gameRef.current.player.hp = gameRef.current.player.maxHp;
    gameRef.current.player.x = 100;
    gameRef.current.player.y = 200;
    gameRef.current.player.screenX = 0;
    gameRef.current.player.screenY = 0;
    gameRef.current.player.speed = 3;
    (gameRef.current.player as any).poisonDuration = 0;
    (gameRef.current.player as any).poisonTick = 0;
    (gameRef.current.player as any).burnDuration = 0;
    (gameRef.current.player as any).burnTick = 0;
    if ((gameRef.current.player as any).speedTimer) {
      clearTimeout((gameRef.current.player as any).speedTimer);
      (gameRef.current.player as any).speedTimer = null;
    }
    setScreenCoordinates({ x: 0, y: 0 });
    setPlayerHP(gameRef.current.player.maxHp);
    spawnMobsForCurrentScreen(gameRef.current.area, 0, 0);
    addLog(`🔁 キャラクターが復活しました。草原 (0, 0) から再出発！`);
  };

  // Setup loop
  useEffect(() => {
    // Synchronize default equipped properties
    const defaultHat = getDefaultEquipment().hat;
    const defaultArmor = getDefaultEquipment().armor;
    const defaultPants = getDefaultEquipment().pants;
    const defaultSword = getDefaultEquipment().sword;

    setEquippedHat(defaultHat);
    setEquippedArmor(defaultArmor);
    setEquippedPants(defaultPants);
    setEquippedSword(defaultSword);

    setInventory([defaultHat, defaultArmor, defaultPants, defaultSword]);
    
    // Set game stats ref safely
    gameRef.current.player.maxHp = 100;
    gameRef.current.player.hp = 100;
    gameRef.current.player.baseAtk = 10;
    gameRef.current.player.baseDef = 2;
    
    // Initialize Area 1 locks and trial requirement
    initAreaGimmick(1);

    // Spawn initial mobs on 0,0
    spawnMobsForCurrentScreen(1, 0, 0);

    // Binds
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      gameRef.current.keys[key] = true;
      
      // Prevent scrolling
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault();
      }

      // Quick slash with space or 'f'
      if (e.key === ' ' || key === 'f') {
        triggerPlayerAttack();
      }

      // Portal level entry with 'e' or Enter
      if (key === 'e' || e.key === 'Enter') {
        triggerPortalTransition();
      }

      // Stage jumping shortcut for test play mode (keys: 'h')
      if (key === 'h' && gameRef.current.testPlayMode) {
        const player = gameRef.current.player;
        const currentAreaId = gameRef.current.area;
        // Area levels go from 1 to 5. If 5, rotate back to 1, else go to next.
        const nextAreaId = currentAreaId === 5 ? 1 : currentAreaId + 1;

        gameRef.current.area = nextAreaId;
        setCurrentArea(nextAreaId);
        initAreaGimmick(nextAreaId);

        // Reset portals and boss spawns
        gameRef.current.portal.active = false;
        gameRef.current.bossSpawned = false;

        // Reset locks/keys
        gameRef.current.hasAreaKey = false;
        setHasAreaKey(false);
        gameRef.current.keyCarrierDefeated = false;
        gameRef.current.gateOpened = false;
        setGateOpened(false);

        // Teleport player back to start screen (0,0) safe coordinates
        player.screenX = 0;
        player.screenY = 0;
        setScreenCoordinates({ x: 0, y: 0 });
        player.x = 100;
        player.y = 240;

        // Fully restore player stats and clear debuffs
        player.hp = player.maxHp;
        setPlayerHP(player.hp);
        player.speed = 3;
        (player as any).poisonDuration = 0;
        (player as any).poisonTick = 0;
        (player as any).burnDuration = 0;
        (player as any).burnTick = 0;
        if ((player as any).speedTimer) {
          clearTimeout((player as any).speedTimer);
          (player as any).speedTimer = null;
        }

        // Play feedback sounds and log action
        gameAudio.playPortal();
        addLog(`🧪【テストプレイ】Hキーでステージをスキップ！ 次の世界「${AREAS[nextAreaId]?.name || '未知のエリア'}」へ転送されました。`);

        // Spawn mobs
        spawnMobsForCurrentScreen(nextAreaId, 0, 0);

        // Teleport feedback particles
        for (let f = 0; f < 30; f++) {
          gameRef.current.particles.push({
            id: `trans-h-${Math.random()}`,
            x: player.x,
            y: player.y,
            dx: (Math.random() - 0.5) * 8,
            dy: (Math.random() - 0.5) * 8,
            color: '#38bdf8',
            size: 3 + Math.random() * 5,
            life: 40,
            maxLife: 40,
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gameRef.current.keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Attack Trigger
  const triggerPlayerAttack = () => {
    if (isBagOpen || gameRef.current.isBagOpen) return;
    const player = gameRef.current.player;
    if (player.attackCooldown > 0 || player.hp <= 0) return;
    if ((player as any).freezeDuration > 0) return;

    player.isAttacking = true;
    player.attackCooldown = 20; // frame rate chill/cooldown
    player.attackAnimFrame = 10; // visual durability in ticks

    // Play retro blade sweep
    gameAudio.playSlash();

    // Spawn wind slash particles in active facing direction
    let startX = player.x + player.width / 2;
    let startY = player.y + player.height / 2;
    let dx = 0;
    let dy = 0;

    if (player.dir === 'right') dx = 3;
    else if (player.dir === 'left') dx = -3;
    else if (player.dir === 'up') dy = -3;
    else if (player.dir === 'down') dy = 3;

    // generate slash trail particles
    for (let i = 0; i < 8; i++) {
      const rx = startX + (player.dir === 'right' || player.dir === 'left' ? 0 : (Math.random() - 0.5) * 30);
      const ry = startY + (player.dir === 'up' || player.dir === 'down' ? 0 : (Math.random() - 0.5) * 30);
      gameRef.current.particles.push({
        id: `slash-${Math.random()}`,
        x: rx,
        y: ry,
        dx: dx + (Math.random() - 0.5) * 1.5,
        dy: dy + (Math.random() - 0.5) * 1.5,
        color: '#fef08a',
        size: 2 + Math.random() * 4,
        life: 15,
        maxLife: 15,
      });
    }

    // Damage enemies calculation
    // Arc logic: Check enemies close enough and in facing direction
    const range = 72;
    // Deal massive 999999 damage in test play mode so absolutely any enemy is instantly defeated
    const isBoosted = (gameRef.current as any).boostDuration > 0;
    const currentAtk = gameRef.current.testPlayMode ? 999999 : (player.baseAtk + equippedSword.statValue + (isBoosted ? 10 : 0));

    gameRef.current.enemies.forEach(enemy => {
      const ex = enemy.x + enemy.width / 2;
      const ey = enemy.y + enemy.height / 2;
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;

      const dist = Math.sqrt((ex - px) ** 2 + (ey - py) ** 2);
      if (dist <= range) {
        let isClockwise = false;
        
        // Direction verification check
        if (player.dir === 'right' && ex > px - 5) isClockwise = true;
        else if (player.dir === 'left' && ex < px + 5) isClockwise = true;
        else if (player.dir === 'down' && ey > py - 5) isClockwise = true;
        else if (player.dir === 'up' && ey < py + 5) isClockwise = true;

        if (isClockwise) {
          // Resolve damage
          const rawDamage = Math.max(1, currentAtk - enemy.def);
          const variance = Math.max(1, Math.floor(Math.random() * 4));
          const actualDamage = rawDamage + variance;
          
          const areaNum = gameRef.current.area;
          const isGolem = areaNum === 4 && enemy.type === 'mob2';
          let finalDamage = actualDamage;
          let shieldBroken = false;

          if (isGolem) {
            if ((enemy as any).hasShield) {
              if (isBoosted) {
                // Break shield!
                (enemy as any).hasShield = false;
                shieldBroken = true;
                addLog(`🔥【バリア破壊】マグマポーションのブースト熱が極光結晶ゴーレムの結晶シールドを打ち砕いた！`);
                
                // Spawn break particles (Cyan crystals flying)
                for (let cp = 0; cp < 20; cp++) {
                  gameRef.current.particles.push({
                    id: `shield-break-${Math.random()}`,
                    x: ex,
                    y: ey,
                    dx: (Math.random() - 0.5) * 8,
                    dy: (Math.random() - 0.5) * 8,
                    color: '#22d3ee',
                    size: 3 + Math.random() * 4,
                    life: 25,
                    maxLife: 25,
                  });
                }
              } else {
                // Shield holds! Damage is 0 (unbreakable shields)
                finalDamage = 0;
                addLog(`🛡️【シールド中】極光結晶ゴーレムのバリアは物理攻撃を通さない！ マグマポーションのブーストが必要だ！`);
                
                // Add "SHIELDED" floating text
                gameRef.current.floatingTexts.push({
                  id: `shielded-dmg-${Math.random()}`,
                  text: `🛡️ IMMUNE`,
                  x: enemy.x + Math.random() * 10,
                  y: enemy.y - 12,
                  color: '#38bdf8',
                  alpha: 1,
                  life: 30
                });

                // Unbreakable sparks
                for (let cp = 0; cp < 8; cp++) {
                  gameRef.current.particles.push({
                    id: `shield-spark-${Math.random()}`,
                    x: ex,
                    y: ey,
                    dx: (Math.random() - 0.5) * 4,
                    dy: (Math.random() - 0.5) * 4,
                    color: '#67e8f9',
                    size: 1.5 + Math.random() * 2,
                    life: 15,
                    maxLife: 15,
                  });
                }
              }
            }
          }

          if (finalDamage > 0) {
            enemy.hp -= finalDamage;

            // Shock screen with flash feedback
            gameRef.current.screenShake = 6;
            gameAudio.playHit();

            // Spawn hit particle flares
            for (let p = 0; p < 6; p++) {
              gameRef.current.particles.push({
                id: `hit-${Math.random()}`,
                x: ex,
                y: ey,
                dx: (Math.random() - 0.5) * 6,
                dy: (Math.random() - 0.5) * 6,
                color: '#f97316',
                size: 2 + Math.random() * 3,
                life: 12,
                maxLife: 12,
              });
            }

            // Spawn floating damage numbers
            gameRef.current.floatingTexts.push({
              id: `dmg-${Math.random()}`,
              text: `-${finalDamage}`,
              x: enemy.x + Math.random() * 15,
              y: enemy.y - 10,
              color: '#f97316',
              alpha: 1,
              life: 35
            });

            // Check if dead
            if (enemy.hp <= 0) {
              handleEnemyDefeat(enemy);
            }
          }

          // Check if this hit triggers Golem shield for the first time
          if (isGolem && !(enemy as any).hasShield && !shieldBroken && !(enemy as any).shieldUsed && enemy.hp > 0) {
            (enemy as any).hasShield = true;
            (enemy as any).shieldUsed = true;
            addLog(`🔮【シールド発動】極光結晶ゴーレムが一度限りの結晶シールドを貼った！ 通常攻撃は無効化される！(マグマブーストのみ打破可能)`);
            for (let cp = 0; cp < 15; cp++) {
              gameRef.current.particles.push({
                id: `shield-init-${Math.random()}`,
                x: ex,
                y: ey,
                dx: (Math.random() - 0.5) * 5,
                dy: (Math.random() - 0.5) * 5,
                color: '#38bdf8',
                size: 2 + Math.random() * 3,
                life: 20,
                maxLife: 20,
              });
            }
          }
        }
      }
    });
  };

  // Enemy Defeat Trigger
  const handleEnemyDefeat = (enemy: Enemy) => {
    const area = gameRef.current.area;
    gameRef.current.player.kills += 1;
    setPlayerKills(gameRef.current.player.kills);

    // Track area-specific kills
    if (enemy.type !== 'boss') {
      gameRef.current.areaKills += 1;
      setAreaKills(gameRef.current.areaKills);

      // Area 1 Trial: Defeat 10 enemies to unlock Boss Room
      if (area === 1 && gameRef.current.areaKills === 10) {
        gameRef.current.hasAreaKey = true;
        setHasAreaKey(true);
        gameRef.current.gateOpened = true;
        setGateOpened(true);
        gameAudio.playPortal();
        addLog(`🚪 🔓 【草原の試練突破】: 敵を10体撃破！ ボス部屋 (2, 2) の「大門」が自動的に開門されました！`);
        
        // Green trial completion circles and flares
        for (let s = 0; s < 30; s++) {
          gameRef.current.particles.push({
            id: `trial-flare-${Math.random()}`,
            x: gameRef.current.player.x + 14,
            y: gameRef.current.player.y + 20,
            dx: (Math.random() - 0.5) * 6,
            dy: (Math.random() - 0.5) * 6,
            color: '#10b981',
            size: 4 + Math.random() * 4,
            life: 45,
            maxLife: 45,
          });
        }
      }
    }

    // Gained Experience
    const expGain = enemy.type === 'boss' ? area * 100 : area * 10 + 5;
    gameRef.current.player.exp += expGain;
    
    // Check level up (e.g. cumulative curves)
    const requiredExp = gameRef.current.player.level * 80 + 50;
    if (gameRef.current.player.exp >= requiredExp) {
      gameRef.current.player.exp -= requiredExp;
      gameRef.current.player.level += 1;
      gameRef.current.player.maxHp = 100 + (gameRef.current.player.level * 15);
      gameRef.current.player.hp = gameRef.current.player.maxHp;
      gameRef.current.player.baseAtk += 3;
      gameRef.current.player.baseDef += 1;

      setPlayerLevel(gameRef.current.player.level);
      setPlayerMaxHP(gameRef.current.player.maxHp);
      setPlayerHP(gameRef.current.player.hp);

      addLog(`⭐ レベルアップ！ レベル ${gameRef.current.player.level} に到達しました！ HP・攻撃力・防御力が上昇！`);
      
      // Level particles
      for (let l = 0; l < 20; l++) {
        gameRef.current.particles.push({
          id: `lvl-${Math.random()}`,
          x: gameRef.current.player.x + 14,
          y: gameRef.current.player.y + 20,
          dx: (Math.random() - 0.5) * 4,
          dy: -1.5 - Math.random() * 3,
          color: '#eab308',
          size: 3 + Math.random() * 4,
          life: 30,
          maxLife: 30,
        });
      }
    }

    setPlayerExp(gameRef.current.player.exp);

    // Spawn massive death spiral sparks
    for (let i = 0; i < 15; i++) {
      gameRef.current.particles.push({
        id: `die-${Math.random()}`,
        x: enemy.x + enemy.width / 2,
        y: enemy.y + enemy.height / 2,
        dx: Math.cos(i) * (2 + Math.random() * 2),
        dy: Math.sin(i) * (2 + Math.random() * 2),
        color: enemy.color,
        size: 3 + Math.random() * 3,
        life: 25,
        maxLife: 25,
      });
    }

    addLog(`⚔「${enemy.name}」を倒した！ (経験値 +${expGain})`);

    // Drops Generator
    // 100% guarantee drop on Boss, or 40% chance on mobs
    const isBoss = enemy.type === 'boss';
    if (isBoss || Math.random() < 0.45) {
      const newItem = generateItem(area, isBoss);
      
      gameRef.current.dropItems.push({
        id: `drop-${Math.random().toString(36).substr(2, 4)}`,
        item: newItem,
        x: enemy.x + enemy.width / 2,
        y: enemy.y + enemy.height / 2,
        screenX: gameRef.current.player.screenX,
        screenY: gameRef.current.player.screenY,
        bounceY: 0,
      });

      // Special alert logging
      const rarityBadge = newItem.rarity === 'legendary' ? '✨伝説品' : newItem.rarity === 'epic' ? '🟣超レア' : newItem.rarity === 'rare' ? '🔵希少品' : '⚪一般品';
      addLog(`🎁 ドロップ品が出現: ${newItem.name} [${rarityBadge}] (触れて拾いましょう)`);
    }

    // Special Magma Potion 10% extra drop from Magma Bat (Area 3, mob2)
    const isMagmaBat = area === 3 && enemy.type === 'mob2';
    if (isMagmaBat && Math.random() < 0.10) {
      const potionItem: Item = {
        id: `magma-potion-${Math.random().toString(36).substr(2, 5)}`,
        name: '🔥マグマポーション',
        type: 'potion',
        statValue: 0,
        rarity: 'epic',
        area: 3,
        description: '飲むことで周囲を烈火に包むブーストモードになり、60秒間攻撃力が＋10アップする。さらに極光結晶ゴーレムの結晶シールドを破壊できるようになる！',
        color: '#f97316',
      };

      gameRef.current.dropItems.push({
        id: `drop-potion-${Math.random().toString(36).substr(2, 4)}`,
        item: potionItem,
        x: enemy.x + enemy.width / 2 + (Math.random() - 0.5) * 20,
        y: enemy.y + enemy.height / 2 + (Math.random() - 0.5) * 20,
        screenX: gameRef.current.player.screenX,
        screenY: gameRef.current.player.screenY,
        bounceY: 0,
      });

      addLog(`✨レアドロップ！マグマバットから「🔥マグマポーション」がドロップしました！ (10%の確率)`);
    }

    // If Boss, trigger world portal generation right where they died
    if (isBoss) {
      gameRef.current.portal.x = enemy.x + enemy.width / 2;
      gameRef.current.portal.y = enemy.y + enemy.height / 2;
      gameRef.current.portal.screenX = gameRef.current.player.screenX;
      gameRef.current.portal.screenY = gameRef.current.player.screenY;
      gameRef.current.portal.active = true;

      gameAudio.playBossDefeat();
      addLog(`🌌 「${enemy.name}」が崩れ去り、別次元へのポータルがその血中に開いた！ 入ることで次のエリアへ進めます。`);

      // Spawn Portal particles
      for (let p = 0; p < 25; p++) {
        gameRef.current.particles.push({
          id: `p-${Math.random()}`,
          x: gameRef.current.portal.x,
          y: gameRef.current.portal.y,
          dx: Math.cos(p) * 1.5,
          dy: Math.sin(p) * 1.5,
          color: '#a855f7',
          size: 4 + Math.random() * 3,
          life: 40,
          maxLife: 40,
        });
      }
    }

    // If Key Carrier was defeated
    if (enemy.isKeyCarrier) {
      gameRef.current.keyCarrierDefeated = true;
      setCarrierDefeated(true);

      if (area === 2) {
        // エリア2のみ鍵をドロップする
        gameRef.current.hasAreaKey = true;
        setHasAreaKey(true);
        gameAudio.playPortal(); // Play epic portal level chime for key acquisition
        addLog(`🔑 【エリア門の鍵】を獲得しました！ ボス部屋 (2, 2) の「大門」を開けることができます！`);

        // Gorgeous gold flares
        for (let s = 0; s < 30; s++) {
          gameRef.current.particles.push({
            id: `key-flare-${Math.random()}`,
            x: enemy.x + enemy.width / 2,
            y: enemy.y + enemy.height / 2,
            dx: (Math.random() - 0.5) * 6,
            dy: (Math.random() - 0.5) * 6,
            color: '#fbbf24',
            size: 4 + Math.random() * 4,
            life: 45,
            maxLife: 45,
          });
        }
      } else {
        // エリア2以外では鍵はドロップせず、代わりにレア装備をドロップする
        const newItem = generateRareItemForCarrier(area);
        gameRef.current.dropItems.push({
          id: `drop-${Math.random().toString(36).substr(2, 4)}`,
          item: newItem,
          x: enemy.x + enemy.width / 2,
          y: enemy.y + enemy.height / 2,
          screenX: gameRef.current.player.screenX,
          screenY: gameRef.current.player.screenY,
          bounceY: 0,
        });

        gameAudio.playCollect(); // Play item drop or acquisition sound
        const rarityBadge = newItem.rarity === 'legendary' ? '✨伝説品' : '🟣超レア';
        addLog(`🎁 輝きし極光の鍵守が秘宝をドロップ: 「${newItem.name}」 [${rarityBadge}] (触れて拾いましょう)`);

        // Visual sparkles matching the item's rarity color
        for (let s = 0; s < 25; s++) {
          gameRef.current.particles.push({
            id: `rare-flare-${Math.random()}`,
            x: enemy.x + enemy.width / 2,
            y: enemy.y + enemy.height / 2,
            dx: (Math.random() - 0.5) * 5,
            dy: (Math.random() - 0.5) * 5,
            color: newItem.color,
            size: 3 + Math.random() * 4,
            life: 40,
            maxLife: 40,
          });
        }
      }
    }

    // Clean enemy
    gameRef.current.enemies = gameRef.current.enemies.filter(e => e.id !== enemy.id);
  };

  // Portal entering
  const triggerPortalTransition = () => {
    if (isBagOpen || gameRef.current.isBagOpen) return;
    const portal = gameRef.current.portal;
    const player = gameRef.current.player;

    if (!portal.active) return;
    if (player.screenX !== portal.screenX || player.screenY !== portal.screenY) return;

    // Check spatial collision closeness
    const dx = player.x + player.width / 2 - portal.x;
    const dy = player.y + player.height / 2 - portal.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= 65) {
      // Enter portal!
      const currentAreaId = gameRef.current.area;
      if (currentAreaId === 5) {
        // Complete the final game!
        setHasWonFinal(true);
        gameAudio.playPortal();
        addLog(`🏆 混沌の終焉王を討ち果たし、ついに世界の理は守られた！ 冒険者の偉大なる旅はクリアを迎えました！`);
        return;
      }

      // Proceed to next Area
      const nextAreaId = currentAreaId + 1;
      gameRef.current.area = nextAreaId;
      setCurrentArea(nextAreaId);
      initAreaGimmick(nextAreaId);

      // Reset portal
      portal.active = false;
      gameRef.current.bossSpawned = false;

      // Start player back safely on screen coordinates (0,0) center-ish
      player.screenX = 0;
      player.screenY = 0;
      setScreenCoordinates({ x: 0, y: 0 });
      player.x = 100;
      player.y = 240;

      // Restores character HP back to max as a stage reward
      player.hp = player.maxHp;
      setPlayerHP(player.hp);

      gameAudio.playPortal();
      addLog(`🌌 次の世界「${AREAS[nextAreaId].name}」への転送が完了しました！ 新たな手強い魔物たちに備えてください！`);
      
      // Spawn new stage mobs
      spawnMobsForCurrentScreen(nextAreaId, 0, 0);

      // Portal flash particles
      for (let f = 0; f < 30; f++) {
        gameRef.current.particles.push({
          id: `trans-${Math.random()}`,
          x: player.x,
          y: player.y,
          dx: (Math.random() - 0.5) * 8,
          dy: (Math.random() - 0.5) * 8,
          color: '#c084fc',
          size: 3 + Math.random() * 5,
          life: 40,
          maxLife: 40,
        });
      }
    }
  };

  // Game Logic tick (60 FPS Engine loop)
  useEffect(() => {
    let active = true;
    let animationId: number;

    const gameLoop = (timestamp: number) => {
      if (!active) return;
      // Manage cooldowns inside loop
      updateGamePhysics();
      renderGameCanvas();
      animationId = requestAnimationFrame(gameLoop);
    };

    // Physics Engine Update
    const updateGamePhysics = () => {
      const keys = gameRef.current.keys;
      const player = gameRef.current.player;
      const area = gameRef.current.area;
      const activeArea = AREAS[area];

      if (isGameOver || hasWonFinal || isBagOpen || gameRef.current.isBagOpen) return;

      // 毒デバフ処理 (毎秒5ダメージ、5秒間継続=300フレーム)
      if ((player as any).poisonDuration === undefined) (player as any).poisonDuration = 0;
      if ((player as any).poisonTick === undefined) (player as any).poisonTick = 0;
      if ((player as any).poisonDuration > 0) {
        (player as any).poisonDuration--;
        (player as any).poisonTick++;
        if ((player as any).poisonTick >= 60) {
          (player as any).poisonTick = 0;
          
          if (!gameRef.current.testPlayMode) {
            player.hp = Math.max(0, player.hp - 5);
            setPlayerHP(player.hp);
            
            // Floating Text (Purple for poison)
            gameRef.current.floatingTexts.push({
              id: `poison-dmg-${Math.random()}`,
              text: `-5 🧪`,
              x: player.x,
              y: player.y - 12,
              color: '#c084fc',
              alpha: 1,
              life: 40
            });
            addLog(`🧪 毒の継続ダメージによって 5 ダメージ！ (残り約 ${Math.ceil((player as any).poisonDuration / 60)}秒)`);
          }
        }
        // 毒のエフェクトパーティクルを時々生成
        if (Math.random() < 0.12) {
          gameRef.current.particles.push({
            id: `poison-bubble-${Math.random()}`,
            x: player.x + Math.random() * player.width,
            y: player.y + Math.random() * player.height,
            dx: (Math.random() - 0.5) * 0.8,
            dy: -0.6 - Math.random() * 0.6,
            color: '#a855f7',
            size: 2.0 + Math.random() * 2,
            life: 25,
            maxLife: 25
          });
        }
      } else {
        (player as any).poisonTick = 0;
      }

      // 燃焼デバフ処理 (毎秒10ダメージ、3秒間継続=180フレーム)
      if ((player as any).burnDuration === undefined) (player as any).burnDuration = 0;
      if ((player as any).burnTick === undefined) (player as any).burnTick = 0;
      if ((player as any).burnDuration > 0) {
        (player as any).burnDuration--;
        (player as any).burnTick++;
        if ((player as any).burnTick >= 60) {
          (player as any).burnTick = 0;

          if (!gameRef.current.testPlayMode) {
            player.hp = Math.max(0, player.hp - 10);
            setPlayerHP(player.hp);

            // Floating Text (Orange for burn)
            gameRef.current.floatingTexts.push({
              id: `burn-dmg-${Math.random()}`,
              text: `-10 🔥`,
              x: player.x,
              y: player.y - 12,
              color: '#f97316',
              alpha: 1,
              life: 40
            });
            addLog(`🔥 燃焼の継続ダメージによって 10 ダメージ！ (残り約 ${Math.ceil((player as any).burnDuration / 60)}秒)`);
          }
        }
        // 燃焼のエフェクトパーティクル（上昇する火花）
        if (Math.random() < 0.20) {
          gameRef.current.particles.push({
            id: `burn-spark-${Math.random()}`,
            x: player.x + Math.random() * player.width,
            y: player.y + Math.random() * player.height,
            dx: (Math.random() - 0.5) * 1.2,
            dy: -1.0 - Math.random() * 0.8,
            color: '#ef4444',
            size: 1.5 + Math.random() * 1.5,
            life: 20,
            maxLife: 20
          });
        }
      } else {
        (player as any).burnTick = 0;
      }

      // 凍結デバフ処理 (1秒＝60フレーム)
      if ((player as any).freezeDuration === undefined) (player as any).freezeDuration = 0;
      if ((player as any).freezeDuration > 0) {
        (player as any).freezeDuration--;
        if (!isPlayerFrozen) setIsPlayerFrozen(true);
        // 凍結のエフェクト
        if (Math.random() < 0.15) {
          gameRef.current.particles.push({
            id: `freeze-ice-${Math.random()}`,
            x: player.x + Math.random() * player.width,
            y: player.y + Math.random() * player.height,
            dx: (Math.random() - 0.5) * 0.5,
            dy: (Math.random() - 0.5) * 0.5,
            color: '#a5f3fc',
            size: 1.5 + Math.random() * 2,
            life: 15,
            maxLife: 15,
          });
        }
      } else {
        if (isPlayerFrozen) setIsPlayerFrozen(false);
      }

      // ブースト期間処理
      if ((gameRef.current as any).boostDuration === undefined) (gameRef.current as any).boostDuration = 0;
      if ((gameRef.current as any).boostDuration > 0) {
        (gameRef.current as any).boostDuration--;
        const secondsLeft = Math.ceil((gameRef.current as any).boostDuration / 60);
        if (boostTimeLeft !== secondsLeft) {
          setBoostTimeLeft(secondsLeft);
        }
        
        // 炎の超ブースト粒子エフェクト
        if (Math.random() < 0.3) {
          gameRef.current.particles.push({
            id: `boost-flame-${Math.random()}`,
            x: player.x + Math.random() * player.width,
            y: player.y + player.height,
            dx: (Math.random() - 0.5) * 0.8,
            dy: -1.5 - Math.random() * 1.5,
            color: '#f97316',
            size: 2 + Math.random() * 2,
            life: 25,
            maxLife: 25,
          });
        }
      } else {
        if (boostTimeLeft > 0) {
          setBoostTimeLeft(0);
          addLog(`⚠️ ブーストモードの効果時間が切れました。通常状態に戻ります。`);
        }
      }

      // Character Death conditions
      if (player.hp <= 0) {
        setIsGameOver(true);
        gameAudio.playGameOver();
        addLog(`💀 冒険者は力尽きました... 装備は失われません。復活ボタンから草原より再挑戦できます。`);
        return;
      }

      // Decrement gate alert warning duration
      if (gameRef.current.gateAlertTimer > 0) {
        gameRef.current.gateAlertTimer--;
      }

      // Attack cooldown timers
      if (player.attackCooldown > 0) {
        player.attackCooldown--;
      }
      if (player.attackAnimFrame > 0) {
        player.attackAnimFrame--;
        if (player.attackAnimFrame === 0) {
          player.isAttacking = false;
        }
      }

      // Screen shaking decay
      if (gameRef.current.screenShake > 0) {
        gameRef.current.screenShake *= 0.85;
        if (gameRef.current.screenShake < 0.2) gameRef.current.screenShake = 0;
      }

      // Movements
      let dx = 0;
      let dy = 0;

      if ((player as any).freezeDuration <= 0) {
        if (keys['w'] || keys['arrowup']) dy = -1;
        if (keys['s'] || keys['arrowdown']) dy = 1;
        if (keys['a'] || keys['arrowleft']) dx = -1;
        if (keys['d'] || keys['arrowright']) dx = 1;
      }

      // Handle Directional updates
      if (dx > 0) player.dir = 'right';
      else if (dx < 0) player.dir = 'left';
      else if (dy > 0) player.dir = 'down';
      else if (dy < 0) player.dir = 'up';

      // Normalize diagonal vectors speed
      if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
      }

      const originalX = player.x;
      const originalY = player.y;

      const spd = player.speed;
      player.x += dx * spd;
      player.y += dy * spd;

      // Obstacles collision detection
      const obstacles = getObstaclesForScreen(area, player.screenX, player.screenY, gameRef.current.gateOpened);
      
      // Rectangular box vs Circle collisions
      obstacles.forEach(obs => {
        // Player circle approximate collision
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const dist = Math.sqrt((px - obs.x) ** 2 + (py - obs.y) ** 2);
        
        // Push boundaries
        const minDist = obs.r + 14;
        if (dist < minDist) {
          // Gimmick: approach closed Gate with key to open
          if (obs.type === 'gate_left' || obs.type === 'gate_top') {
            if (gameRef.current.hasAreaKey && !gameRef.current.gateOpened) {
              gameRef.current.gateOpened = true;
              setGateOpened(true);
              gameAudio.playPortal(); // Plays awesome door unlocking sound
              addLog(`🚪 🔑 鍵を利用して「エリアボスの門」を開門させました！ 大門が開き、ボスエリアへの進路が拓かれました！`);
              
              // Spark particles
              for (let k = 0; k < 25; k++) {
                gameRef.current.particles.push({
                  id: `unlock-g-${Math.random()}`,
                  x: obs.x,
                  y: obs.y,
                  dx: (Math.random() - 0.5) * 6,
                  dy: (Math.random() - 0.5) * 6,
                  color: '#fbbf24',
                  size: 3 + Math.random() * 4,
                  life: 30,
                  maxLife: 30,
                });
              }
              return;
            } else if (!gameRef.current.hasAreaKey && !gameRef.current.gateOpened) {
              gameRef.current.gateAlertTimer = 120;
            }
          }

          const angle = Math.atan2(py - obs.y, px - obs.x);
          // Restore coordinates
          player.x = obs.x + Math.cos(angle) * minDist - player.width / 2;
          player.y = obs.y + Math.sin(angle) * minDist - player.height / 2;
        }
      });

      // Clamp limits + Transition Screens (3x3 grid coordinates)
      // Screen X coordinate shifts
      if (player.x < -10) {
        if (player.screenX > 0) {
          player.screenX -= 1;
          player.x = CANVAS_WIDTH - player.width - 30;
          setScreenCoordinates({ x: player.screenX, y: player.screenY });
          spawnMobsForCurrentScreen(area, player.screenX, player.screenY);
          if (player.screenX === 2 && player.screenY === 2) {
            addLog(`💀 エリアボスの部屋 (${player.screenX}, ${player.screenY}) に突入しました！`);
          } else {
            addLog(`🗺 画面を跨ぎました。エリア位置(${player.screenX}, ${player.screenY}) に進入。(2, 2)にボス。`);
          }
        } else {
          player.x = 0;
        }
      } else if (player.x + player.width > CANVAS_WIDTH + 10) {
        if (player.screenX < 2) {
          // Gating check for Area Boss Screen (2, 2)
          if (player.screenX + 1 === 2 && player.screenY === 2 && !gameRef.current.hasAreaKey) {
            player.x = CANVAS_WIDTH - player.width - 25; // Block and push back
            gameRef.current.gateAlertTimer = 120;
            return;
          }
          player.screenX += 1;
          player.x = 30;
          setScreenCoordinates({ x: player.screenX, y: player.screenY });
          spawnMobsForCurrentScreen(area, player.screenX, player.screenY);
          if (player.screenX === 2 && player.screenY === 2) {
            addLog(`💀 エリアボスの部屋 (${player.screenX}, ${player.screenY}) に突入しました！`);
          } else {
            addLog(`🗺 画面を跨ぎました。エリア位置(${player.screenX}, ${player.screenY}) に進入。(2, 2)にボス。`);
          }
        } else {
          player.x = CANVAS_WIDTH - player.width;
        }
      }

      // Screen Y coordinate shifts
      if (player.y < -10) {
        if (player.screenY > 0) {
          player.screenY -= 1;
          player.y = CANVAS_HEIGHT - player.height - 30;
          setScreenCoordinates({ x: player.screenX, y: player.screenY });
          spawnMobsForCurrentScreen(area, player.screenX, player.screenY);
          if (player.screenX === 2 && player.screenY === 2) {
            addLog(`💀 エリアボスの部屋 (${player.screenX}, ${player.screenY}) に突入しました！`);
          } else {
            addLog(`🗺 画面を跨ぎました。エリア位置(${player.screenX}, ${player.screenY}) に進入。(2, 2)にボス。`);
          }
        } else {
          player.y = 0;
        }
      } else if (player.y + player.height > CANVAS_HEIGHT + 10) {
        if (player.screenY < 2) {
          // Gating check for Area Boss Screen (2, 2)
          if (player.screenX === 2 && player.screenY + 1 === 2 && !gameRef.current.hasAreaKey) {
            player.y = CANVAS_HEIGHT - player.height - 25; // Block and push back
            gameRef.current.gateAlertTimer = 120;
            return;
          }
          player.screenY += 1;
          player.y = 30;
          setScreenCoordinates({ x: player.screenX, y: player.screenY });
          spawnMobsForCurrentScreen(area, player.screenX, player.screenY);
          if (player.screenX === 2 && player.screenY === 2) {
            addLog(`💀 エリアボスの部屋 (${player.screenX}, ${player.screenY}) に突入しました！`);
          } else {
            addLog(`🗺 画面を跨ぎました。エリア位置(${player.screenX}, ${player.screenY}) に進入。(2, 2)にボス。`);
          }
        } else {
          player.y = CANVAS_HEIGHT - player.height;
        }
      }

      // Respawn timer on mobs: if not in Boss screen and count of enemies is lower, let mobs respawn
      if (player.screenX !== 2 || player.screenY !== 2) {
        if (gameRef.current.enemies.length < 2 && Math.random() < 0.003) {
          // Respawn mob
          const mobNames = {
            1: ['グリーンスライム', '草原の牙蜘蛛'],
            2: ['針コパースコーピオン', '砂漠の魔石兵'],
            3: ['獄炎トカゲ', 'マグマバット'],
            4: ['フリーズスプライト', '極光結晶ゴーレム'],
            5: ['エンドレスビクター', '深淵虚黒這い']
          }[area] || ['魔物'];
          const mobColors = {
            1: ['#4ade80', '#22c55e'],
            2: ['#fbbf24', '#b45309'],
            3: ['#ef4444', '#b91c1c'],
            4: ['#67e8f9', '#2563eb'],
            5: ['#c084fc', '#6b21a8']
          }[area] || ['#9ca3af'];

          const rx = 100 + Math.random() * (CANVAS_WIDTH - 200);
          const ry = 100 + Math.random() * (CANVAS_HEIGHT - 200);
          
          gameRef.current.enemies.push({
            id: `respawn-${Math.random().toString(36).substr(2, 4)}`,
            type: 'mob1',
            name: mobNames[Math.floor(Math.random() * mobNames.length)],
            x: rx,
            y: ry,
            width: 25 + area * 2,
            height: 25 + area * 2,
            hp: area * 24 + 10,
            maxHp: area * 24 + 10,
            atk: area * 4 + 4,
            def: area * 1,
            speed: 0.7 + Math.random() * 0.4 + (area * 0.05),
            color: mobColors[Math.floor(Math.random() * mobColors.length)],
            isAggressive: true,
            shootCooldown: 140 - area * 10,
            behavior: 'wander',
            screenX: player.screenX,
            screenY: player.screenY,
            shootTimer: 0,
          });
        }
      }

      // Enemies Intelligence (AI pathfinding / Charge Attacks)
      gameRef.current.enemies.forEach(enemy => {
        const ex = enemy.x + enemy.width / 2;
        const ey = enemy.y + enemy.height / 2;
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        
        const dist = Math.sqrt((px - ex) ** 2 + (py - ey) ** 2);

        // Ensure optional states are initialized
        if (enemy.stiffenTimer === undefined) enemy.stiffenTimer = 0;
        if (enemy.isAttackingChain === undefined) enemy.isAttackingChain = false;

        // 1. Recover stiffen timer (Wait in place after attack)
        if (enemy.stiffenTimer > 0) {
          enemy.stiffenTimer--;
          if (enemy.stiffenTimer <= 0) {
            enemy.isAttackingChain = false;
          }

          // Push away from obstacles even while stiffened so they don't clip walls
          obstacles.forEach(obs => {
            const edist = Math.sqrt((enemy.x + enemy.width/2 - obs.x) ** 2 + (enemy.y + enemy.height/2 - obs.y) ** 2);
            const minEDist = obs.r + enemy.width/2;
            if (edist < minEDist) {
              const eAngle = Math.atan2(enemy.y + enemy.height/2 - obs.y, enemy.x + enemy.width/2 - obs.x);
              enemy.x = obs.x + Math.cos(eAngle) * minEDist - enemy.width / 2;
              enemy.y = obs.y + Math.sin(eAngle) * minEDist - enemy.height / 2;
            }
          });
          return; // Skip normal chase/wander actions during recovery
        }

        // 2. Active locked attack sequence: forces attack to execute immediately once charge starts
        if (enemy.isAttackingChain) {
          const triggerShootCap = enemy.type === 'boss' ? 55 : (enemy.shootCooldown || 120);

          if (!enemy.shootTimer) {
            enemy.shootTimer = 0;
          }
          enemy.shootTimer++;

          // Push from physical obstacles during charging/stopping
          obstacles.forEach(obs => {
            const edist = Math.sqrt((enemy.x + enemy.width/2 - obs.x) ** 2 + (enemy.y + enemy.height/2 - obs.y) ** 2);
            const minEDist = obs.r + enemy.width/2;
            if (edist < minEDist) {
              const eAngle = Math.atan2(enemy.y + enemy.height/2 - obs.y, enemy.x + enemy.width/2 - obs.x);
              enemy.x = obs.x + Math.cos(eAngle) * minEDist - enemy.width / 2;
              enemy.y = obs.y + Math.sin(eAngle) * minEDist - enemy.height / 2;
            }
          });

          // Shoot / strike event triggered when timer threshold is reached!
          if (enemy.shootTimer >= triggerShootCap) {
            enemy.shootTimer = 0;

            // Use locked angle during charging sequence, or dynamic angle as fallback
            const angle = enemy.lockedAngle !== undefined ? enemy.lockedAngle : Math.atan2(py - ey, px - ex);
            let stiffenLen = 25; // Default stiffness: (approx 0.42 seconds)

            if (enemy.type === 'boss') {
              // Boss shoots dynamic circle patterns!
              const projectilesCount = 4 + area * 2;
              const baseAngle = Math.random() * Math.PI;

              for (let bl = 0; bl < projectilesCount; bl++) {
                const pAngle = baseAngle + (Math.PI * 2 / projectilesCount) * bl;
                gameRef.current.projectiles.push({
                  id: `p-${Math.random()}`,
                  x: ex,
                  y: ey,
                  dx: Math.cos(pAngle) * (2.2 + area * 0.3),
                  dy: Math.sin(pAngle) * (2.2 + area * 0.3),
                  radius: 7 + area,
                  damage: area * 6 + 6,
                  color: activeArea.accentColor,
                  screenX: player.screenX,
                  screenY: player.screenY,
                });
              }
              stiffenLen = 38; // Boss recovery: 38 frames (approx 0.63 seconds)
            } else if (area >= 2) {
              // Normal ranged monster shoots targeted orb
              const isScorpion = area === 2 && enemy.type === 'mob1'; // 針コパスコーピオン
              const isLizard = area === 3 && enemy.type === 'mob1'; // 獄炎トカゲ
              const isBat = area === 3 && enemy.type === 'mob2'; // マグマバット
              const isFreezeSprite = area === 4 && enemy.type === 'mob1'; // フリーズスプライト

              gameRef.current.projectiles.push({
                id: `p-${Math.random()}`,
                x: ex,
                y: ey,
                dx: Math.cos(angle) * 3.5,
                dy: Math.sin(angle) * 3.5,
                radius: 6,
                damage: area * 4 + 2,
                color: enemy.color,
                screenX: player.screenX,
                screenY: player.screenY,
                isPoison: isScorpion,
                isBurn: isLizard || isBat,
                isFreeze: isFreezeSprite,
              });
              stiffenLen = 22; // Ranged monster post-shot recovery: 22 frames (approx 0.37 seconds)
            } else if (area === 1 && enemy.type === 'mob2') {
              // 「草原の牙グモ」は突進ではなく、プレイヤー目がけて蜘蛛糸弾を発射
              gameRef.current.projectiles.push({
                id: `p-${Math.random()}`,
                x: ex,
                y: ey,
                dx: Math.cos(angle) * 3.8,
                dy: Math.sin(angle) * 3.8,
                radius: 7,
                damage: enemy.atk,
                color: '#ffffff',
                screenX: player.screenX,
                screenY: player.screenY,
                isWeb: true,
              });

              stiffenLen = 25; // 射撃後の硬直

              // 蜘蛛の糸発射時の美しい飛散エフェクト
              for (let k = 0; k < 8; k++) {
                gameRef.current.particles.push({
                  id: `web-shoot-${Math.random()}`,
                  x: ex + Math.cos(angle) * 10,
                  y: ey + Math.sin(angle) * 10,
                  dx: Math.cos(angle) * 1.5 + (Math.random() - 0.5) * 2.5,
                  dy: Math.sin(angle) * 1.5 + (Math.random() - 0.5) * 2.5,
                  color: '#e2e8f0',
                  size: 2.0,
                  life: 14,
                  maxLife: 14,
                });
              }

              // 発射音のフック
              if (gameAudio.playWebShoot) {
                gameAudio.playWebShoot();
              }
            } else {
              // Melee monsters (Area 1) lunge forward to simulate a dramatic swipe/strike!
              const strikeDistance = Math.sqrt((px - ex) ** 2 + (py - ey) ** 2);
              
              enemy.x += Math.cos(angle) * 18;
              enemy.y += Math.sin(angle) * 18;

              // Spawn beautiful slash particles
              for (let k = 0; k < 6; k++) {
                gameRef.current.particles.push({
                  id: `slash-${Math.random()}`,
                  x: ex + Math.cos(angle) * 12,
                  y: ey + Math.sin(angle) * 12,
                  dx: (Math.random() - 0.5) * 3 + Math.cos(angle) * 2,
                  dy: (Math.random() - 0.5) * 3 + Math.sin(angle) * 2,
                  color: '#fbbf24',
                  size: 2.5,
                  life: 12,
                  maxLife: 12,
                });
              }

              // Active melee hitbox check (range: player.width/2 + enemy.width/2 + 15 offset)
              const hitRadius = (player.width / 2) + (enemy.width / 2) + 15;
              if (strikeDistance < hitRadius && !gameRef.current.testPlayMode) {
                const now = Date.now();
                if (now - player.lastHurtTime > 600) {
                  player.lastHurtTime = now;
                  
                  // Def calculations (Hat + Armor + Pants)
                  const defenseRating = gameRef.current.player.baseDef + equippedHat.statValue + equippedArmor.statValue + equippedPants.statValue;
                  const finalDmg = Math.max(1, enemy.atk - defenseRating);
                  player.hp -= finalDmg;

                  // Update state
                  setPlayerHP(player.hp);
                  gameRef.current.screenShake = 12;
                  gameAudio.playPlayerHurt();

                  // Spawn dramatic blood splatters
                  for (let b = 0; b < 10; b++) {
                    gameRef.current.particles.push({
                      id: `blood-${Math.random()}`,
                      x: player.x + player.width / 2,
                      y: player.y + player.height / 2,
                      dx: (Math.random() - 0.5) * 5,
                      dy: (Math.random() - 0.5) * 5,
                      color: '#ef4444',
                      size: 2 + Math.random() * 4,
                      life: 18,
                      maxLife: 18,
                    });
                  }

                  // Damage Text
                  gameRef.current.floatingTexts.push({
                    id: `hurt-${Math.random()}`,
                    text: `-${finalDmg}`,
                    x: player.x,
                    y: player.y - 12,
                    color: '#f87171',
                    alpha: 1,
                    life: 40
                  });

                  addLog(`💔 「${enemy.name}」の素早い直接打撃！ ${finalDmg} のダメージを受けた。 (防御力により護られたダメージ: ${equippedHat.statValue + equippedArmor.statValue + equippedPants.statValue})`);
                }
              }

              stiffenLen = 50; // Melee dashes fully on strike so it has 50 frames (approx 0.83 seconds) recovery!
            }

            enemy.stiffenTimer = stiffenLen;
            enemy.stiffenDuration = stiffenLen;
          }
          return; // Lock and bypass other behaviors until attack sequence finishes
        }

        // 3. Normal behavior (Either ordinary chasing or launching onto attack sequence)
        if (enemy.isAggressive && dist < 320) {
          // Calculate attack & preparation timings. Every aggressive enemy stops to prepare their attack first!
          const angle = Math.atan2(py - ey, px - ex);
          
          const triggerShootCap = enemy.type === 'boss' ? 55 : (enemy.shootCooldown || 120);
          const prepDuration = enemy.type === 'boss' ? 24 : 35; // Pause frames before striking / shooting
          
          if (!enemy.shootTimer) {
            enemy.shootTimer = 0;
          }
          enemy.shootTimer++;

          const isPreparingAttack = enemy.shootTimer > (triggerShootCap - prepDuration);

          if (isPreparingAttack) {
            // Force committing to the attack state sequence! Once here, it'll charge and strike regardless of distance
            enemy.isAttackingChain = true;
            enemy.lockedAngle = angle; // Lock player target path
          } else {
            // Standard pursuit when not preparing attack
            enemy.x += Math.cos(angle) * enemy.speed;
            enemy.y += Math.sin(angle) * enemy.speed;
          }

          // Resolve obstacles for enemies too! So they don't clip walls/pillars even while lunging
          obstacles.forEach(obs => {
            const edist = Math.sqrt((enemy.x + enemy.width/2 - obs.x) ** 2 + (enemy.y + enemy.height/2 - obs.y) ** 2);
            const minEDist = obs.r + enemy.width/2;
            if (edist < minEDist) {
              const eAngle = Math.atan2(enemy.y + enemy.height/2 - obs.y, enemy.x + enemy.width/2 - obs.x);
              enemy.x = obs.x + Math.cos(eAngle) * minEDist - enemy.width / 2;
              enemy.y = obs.y + Math.sin(eAngle) * minEDist - enemy.height / 2;
            }
          });
        } else {
          // Wander around casually
          if (Math.random() < 0.02) {
            enemy.shootTimer = (Math.random() - 0.5) * Math.PI * 2; // reuse for drift angle
          }
          const driftAngle = enemy.shootTimer || 0;
          enemy.x += Math.cos(driftAngle) * 0.4 * enemy.speed;
          enemy.y += Math.sin(driftAngle) * 0.4 * enemy.speed;

          // Block walls
          if (enemy.x < 50) enemy.x = 50;
          if (enemy.x > CANVAS_WIDTH - 80) enemy.x = CANVAS_WIDTH - 80;
          if (enemy.y < 50) enemy.y = 50;
          if (enemy.y > CANVAS_HEIGHT - 80) enemy.y = CANVAS_HEIGHT - 80;
        }

        // Touch collision with adventurer (Removed to avoid damage purely on contact; damage is now handled exclusively by active strikes and shot projectiles)
        // Feel free to walk right through or near enemies safely between their attacks!
      });

      // Projectiles Ticks & Collisions
      gameRef.current.projectiles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;

        // Player collision
        const pSize = player.width / 2;
        const dx = p.x - (player.x + player.width / 2);
        const dy = p.y - (player.y + player.height / 2);
        const pDist = Math.sqrt(dx * dx + dy * dy);

        if (pDist < p.radius + pSize - 2) {
          p.radius = 0; // mark for death

          if (gameRef.current.testPlayMode) {
            return; // Ignore damage and slow effects in test play mode, but clear the projectile
          }

          const now = Date.now();
          if (now - player.lastHurtTime > 600) {
            player.lastHurtTime = now;
            
            const defenseRating = gameRef.current.player.baseDef + equippedHat.statValue + equippedArmor.statValue + equippedPants.statValue;
            const finalDmg = Math.max(1, p.damage - defenseRating);
            player.hp -= finalDmg;
            setPlayerHP(player.hp);

            // Special ice speed reduction on Area 4
            if (area === 4) {
              player.speed = 2; // slow down player
              setTimeout(() => {
                gameRef.current.player.speed = 4;
              }, 1800);
              addLog(`❄ 極寒の氷霜弾により足元が氷結した！ 一時的に移動速度低下！`);
            }

            // 草原の牙グモの蜘蛛糸弾に当たった場合の速度低下（2秒間）
            if (p.isWeb) {
              player.speed = 1.2; // 移動速度大幅低下
              
              if ((player as any).speedTimer) {
                clearTimeout((player as any).speedTimer);
              }

              (player as any).speedTimer = setTimeout(() => {
                gameRef.current.player.speed = 3;
                (gameRef.current.player as any).speedTimer = null;
              }, 2000);

              addLog(`🕸 草原の牙グモ de 粘着糸に絡みとられた！ 2秒間移動速度が大きく低下！`);

              // 被弾時に周囲に飛び散る粘着糸のエフェクト
              for (let b = 0; b < 12; b++) {
                gameRef.current.particles.push({
                  id: `web-hit-${Math.random()}`,
                  x: player.x + player.width / 2,
                  y: player.y + player.height / 2,
                  dx: (Math.random() - 0.5) * 4,
                  dy: (Math.random() - 0.5) * 4,
                  color: '#ffffff',
                  size: 3.0,
                  life: 20,
                  maxLife: 20,
                });
              }
            }

            // 針コパスコーピオンの毒針弾
            if (p.isPoison) {
              (player as any).poisonDuration = 300; // 5秒間
              (player as any).poisonTick = 0;
              addLog(`🧪 針コパスコーピオンの毒針に刺された！ 5秒間、毒ダメージ(毎秒5ダメージ)を受ける！`);

              // 被弾時に飛び散る紫のエフェクト
              for (let b = 0; b < 10; b++) {
                gameRef.current.particles.push({
                  id: `poison-hit-${Math.random()}`,
                  x: player.x + player.width / 2,
                  y: player.y + player.height / 2,
                  dx: (Math.random() - 0.5) * 3,
                  dy: (Math.random() - 0.5) * 3,
                  color: '#d946ef',
                  size: 2.5,
                  life: 15,
                  maxLife: 15,
                });
              }
            }

            // マグマバット・獄炎トカゲの燃焼弾
            if (p.isBurn) {
              (player as any).burnDuration = 180; // 3秒間
              (player as any).burnTick = 0;
              addLog(`🔥 燃え盛る継続ダメージ！ 3秒間、燃焼ダメージ(毎秒10ダメージ)を受ける！`);

              // 被弾時に飛び散る火花エフェクト
              for (let b = 0; b < 15; b++) {
                gameRef.current.particles.push({
                  id: `burn-hit-${Math.random()}`,
                  x: player.x + player.width / 2,
                  y: player.y + player.height / 2,
                  dx: (Math.random() - 0.5) * 4,
                  dy: (Math.random() - 0.5) * 4,
                  color: '#f97316',
                  size: 2.5,
                  life: 12,
                  maxLife: 12,
                });
              }
            }

            // フリーズスプライトの氷結弾
            if (p.isFreeze) {
              (player as any).freezeDuration = 60; // 1秒 = 60フレーム
              addLog(`❄️ フリーズスプライトの氷結魔法を喰らった！ 1秒間氷に包まれ、移動・攻撃アクションが取れなくなった！`);

              // 被弾時に飛び散る美しい結晶・氷エフェクト
              for (let b = 0; b < 18; b++) {
                gameRef.current.particles.push({
                  id: `freeze-hit-${Math.random()}`,
                  x: player.x + player.width / 2,
                  y: player.y + player.height / 2,
                  dx: (Math.random() - 0.5) * 5,
                  dy: (Math.random() - 0.5) * 5,
                  color: '#a5f3fc',
                  size: 2.0 + Math.random() * 2.5,
                  life: 18,
                  maxLife: 18,
                });
              }
            }

            gameRef.current.screenShake = 10;
            gameAudio.playPlayerHurt();

            gameRef.current.floatingTexts.push({
              id: `p-hurt-${Math.random()}`,
              text: `-${finalDmg}`,
              x: player.x,
              y: player.y - 10,
              color: area === 4 ? '#38bdf8' : '#f87171',
              alpha: 1,
              life: 40
            });

            addLog(`⚡ 魔術の罠弾を被弾！ ${finalDmg} ダメージ！`);
          }
        }
      });

      // Clear off-screen or collided projectiles
      gameRef.current.projectiles = gameRef.current.projectiles.filter(p => 
        p.radius > 0 && 
        p.x > 0 && p.x < CANVAS_WIDTH && 
        p.y > 0 && p.y < CANVAS_HEIGHT
      );

      // Drops collection check
      gameRef.current.dropItems.forEach(drop => {
        if (drop.screenX !== player.screenX || drop.screenY !== player.screenY) return;

        const dx = (player.x + player.width / 2) - drop.x;
        const dy = (player.y + player.height / 2) - drop.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 38) {
          // Collected!
          const item = drop.item;

          if (item.name.includes('マグマポーション')) {
            gameRef.current.floatingTexts.push({
              id: `potion-obt-${Math.random()}`,
              text: 'マグマポーション会得',
              x: player.x - 24,
              y: player.y - 14,
              color: '#f97316',
              alpha: 1,
              life: 90,
              fontSize: 'bold 11px sans-serif'
            });
          }
          
          setInventory(prev => {
            const next = [...prev, item];
            // Sort by newest
            return next;
          });

          gameAudio.playCollect();
          addLog(`🎒 アイテム「${item.name}」をインベントリに回収しました！`);

          // Spawn shiny star flare
          for (let s = 0; s < 12; s++) {
            gameRef.current.particles.push({
              id: `star-${Math.random()}`,
              x: drop.x,
              y: drop.y,
              dx: (Math.random() - 0.5) * 4,
              dy: (Math.random() - 0.5) * 4,
              color: '#eab308',
              size: 2 + Math.random() * 3,
              life: 20,
              maxLife: 20,
            });
          }

          // Delete drop
          drop.x = -9999;
        }
      });

      // Clean inactive collectable drops
      gameRef.current.dropItems = gameRef.current.dropItems.filter(d => d.x > -100);

      // Particles lifecycle update
      gameRef.current.particles.forEach(part => {
        part.x += part.dx;
        part.y += part.dy;
        part.life--;
      });
      gameRef.current.particles = gameRef.current.particles.filter(p => p.life > 0);

      // Floating Texts fade lifecycle
      gameRef.current.floatingTexts.forEach(txt => {
        txt.y -= 0.6;
        txt.life--;
        txt.alpha = txt.life / 40;
      });
      gameRef.current.floatingTexts = gameRef.current.floatingTexts.filter(t => t.life > 0);
    };

    // Core Canvas Art/Render Logic
    const renderGameCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const player = gameRef.current.player;
      const area = gameRef.current.area;
      const activeArea = AREAS[area];

      ctx.save();
      
      // Screen Shake
      if (gameRef.current.screenShake > 0) {
        const dx = (Math.random() - 0.5) * gameRef.current.screenShake;
        const dy = (Math.random() - 0.5) * gameRef.current.screenShake;
        ctx.translate(dx, dy);
      }

      // Draw background floor
      ctx.fillStyle = activeArea.bgColor;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 1. Draw beautiful retro Zelda-style tiles on the floor (40x40 pixel grids)
      const theme = activeArea.theme;

      // Draw paved dirt/stone pathways (Crossroad PLUS-shape to show direction options)
      // Horizontal path: y = 180 to 300
      // Vertical path: x = 340 to 460
      let pathFill = '#5c4033';
      let pathBorder = '#3d2b1f';
      if (theme === 'forest') { pathFill = '#8c6239'; pathBorder = '#5c4033'; }
      else if (theme === 'desert') { pathFill = '#ca8a04'; pathBorder = '#854d0e'; }
      else if (theme === 'volcano') { pathFill = '#2a0808'; pathBorder = '#450a0a'; }
      else if (theme === 'ice') { pathFill = '#0369a1'; pathBorder = '#075985'; }
      else if (theme === 'abyss') { pathFill = '#3b0764'; pathBorder = '#581c87'; }

      // Draw vertical path
      ctx.fillStyle = pathFill;
      ctx.fillRect(340, 0, 120, CANVAS_HEIGHT);
      // Draw horizontal path
      ctx.fillStyle = pathFill;
      ctx.fillRect(0, 180, CANVAS_WIDTH, 120);

      // Draw paved pathway stones inside the roads (retro bricks!)
      ctx.fillStyle = pathBorder;
      ctx.globalAlpha = 0.3;
      // Horizontal stones
      for (let rx = 20; rx < CANVAS_WIDTH; rx += 60) {
        ctx.fillRect(rx, 190, 24, 12);
        ctx.fillRect(rx + 30, 220, 24, 12);
        ctx.fillRect(rx, 250, 24, 12);
        ctx.fillRect(rx + 30, 280, 24, 12);
      }
      // Vertical stones
      for (let ry = 20; ry < CANVAS_HEIGHT; ry += 60) {
        ctx.fillRect(350, ry, 12, 24);
        ctx.fillRect(380, ry + 30, 12, 24);
        ctx.fillRect(410, ry, 12, 24);
        ctx.fillRect(440, ry + 30, 12, 24);
      }
      ctx.globalAlpha = 1.0;

      // Draw organic scattered background details (grass clumps, sandy wind-arcs, ice tiles)
      // Let's seed background decorations consistently per screen using basic math
      const decorationSeed = player.screenX * 17 + player.screenY * 41 + area * 23;
      for (let tileI = 0; tileI < 30; tileI++) {
        const dx = Math.abs(Math.sin(decorationSeed + tileI) * 10000) % CANVAS_WIDTH;
        const dy = Math.abs(Math.cos(decorationSeed + tileI) * 10000) % CANVAS_HEIGHT;
        
        // Skip path locations to avoid clutter
        if ((dx >= 330 && dx <= 470) || (dy >= 170 && dy <= 310)) continue;

        if (theme === 'forest') {
          // Draw a small 2D grass tuft/flower petal
          ctx.strokeStyle = activeArea.accentColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(dx, dy);
          ctx.lineTo(dx - 3, dy - 6);
          ctx.moveTo(dx, dy);
          ctx.lineTo(dx, dy - 8);
          ctx.moveTo(dx, dy);
          ctx.lineTo(dx + 3, dy - 6);
          ctx.stroke();

          // Wildflowers (1 in 3)
          if (tileI % 3 === 0) {
            ctx.fillStyle = tileI % 2 === 0 ? '#ef4444' : '#facc15';
            ctx.beginPath();
            ctx.arc(dx, dy - 9, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (theme === 'desert') {
          // Wind sand ridges or pebble stones
          ctx.fillStyle = '#fef08a';
          ctx.globalAlpha = 0.25;
          ctx.beginPath();
          ctx.arc(dx, dy, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = activeArea.accentColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(dx, dy, 12, 3, Math.PI / 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        } else if (theme === 'volcano') {
          // Magma crack lines or lava droplets
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#f97316';
          ctx.globalAlpha = 0.35 + Math.sin(Date.now() / 300) * 0.15;
          ctx.beginPath();
          ctx.moveTo(dx, dy);
          ctx.lineTo(dx + 8, dy + 4);
          ctx.lineTo(dx + 15, dy - 2);
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        } else if (theme === 'ice') {
          // Snowflake crosses or frozen cracks
          ctx.strokeStyle = '#bae6fd';
          ctx.globalAlpha = 0.4;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(dx - 5, dy);
          ctx.lineTo(dx + 5, dy);
          ctx.moveTo(dx, dy - 5);
          ctx.lineTo(dx, dy + 5);
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        } else {
          // Abyss star sparkles or constellation connections
          ctx.fillStyle = '#c084fc';
          ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 400) * 0.3;
          ctx.fillRect(dx, dy, 2, 2);
          ctx.globalAlpha = 1.0;
        }
      }

      // 2. Render perimeter wall frames with gateway doorways!
      // This forms a gorgeous physical framework like top-down Zelda rooms!
      // Let's use colors depending on theme
      let wallFill = '#152d11';
      let wallTop = '#22521a';
      let wallBricks = '#071505';

      if (theme === 'forest') { wallFill = '#163b15'; wallTop = '#2d6a2c'; wallBricks = '#0c220b'; }
      else if (theme === 'desert') { wallFill = '#5c3e21'; wallTop = '#8c5e32'; wallBricks = '#3b2510'; }
      else if (theme === 'volcano') { wallFill = '#220b0b'; wallTop = '#471414'; wallBricks = '#0f0404'; }
      else if (theme === 'ice') { wallFill = '#0d2557'; wallTop = '#224a9e'; wallBricks = '#061129'; }
      else if (theme === 'abyss') { wallFill = '#110722'; wallTop = '#2c1254'; wallBricks = '#080112'; }

      ctx.save();
      const wallThickness = 16;

      // Draw Top Wall
      ctx.fillStyle = wallFill;
      if (player.screenY === 0) {
        // Solid wall
        ctx.fillRect(0, 0, CANVAS_WIDTH, wallThickness);
        // Draw top edge shadow highlight
        ctx.fillStyle = wallTop;
        ctx.fillRect(0, 0, CANVAS_WIDTH, 4);
      } else {
        // Leaves gateways open from 340 to 460
        ctx.fillRect(0, 0, 340, wallThickness);
        ctx.fillRect(460, 0, CANVAS_WIDTH - 460, wallThickness);
        ctx.fillStyle = wallTop;
        ctx.fillRect(0, 0, 340, 4);
        ctx.fillRect(460, 0, CANVAS_WIDTH - 460, 4);

        // Gateway ornamental entrance stones/pedestals
        ctx.fillStyle = wallTop;
        ctx.fillRect(332, 0, 8, wallThickness);
        ctx.fillRect(460, 0, 8, wallThickness);
        ctx.strokeStyle = wallBricks;
        ctx.strokeRect(332, 0, 8, wallThickness);
        ctx.strokeRect(460, 0, 8, wallThickness);
      }

      // Draw Bottom Wall
      ctx.fillStyle = wallFill;
      if (player.screenY === 2) {
        ctx.fillRect(0, CANVAS_HEIGHT - wallThickness, CANVAS_WIDTH, wallThickness);
        ctx.fillStyle = wallTop;
        ctx.fillRect(0, CANVAS_HEIGHT - wallThickness, CANVAS_WIDTH, 4);
      } else {
        ctx.fillRect(0, CANVAS_HEIGHT - wallThickness, 340, wallThickness);
        ctx.fillRect(460, CANVAS_HEIGHT - wallThickness, CANVAS_WIDTH - 460, wallThickness);
        ctx.fillStyle = wallTop;
        ctx.fillRect(0, CANVAS_HEIGHT - wallThickness, 340, 4);
        ctx.fillRect(460, CANVAS_HEIGHT - wallThickness, CANVAS_WIDTH - 460, 4);

        ctx.fillStyle = wallTop;
        ctx.fillRect(332, CANVAS_HEIGHT - wallThickness, 8, wallThickness);
        ctx.fillRect(460, CANVAS_HEIGHT - wallThickness, 8, wallThickness);
        ctx.strokeStyle = wallBricks;
        ctx.strokeRect(332, CANVAS_HEIGHT - wallThickness, 8, wallThickness);
        ctx.strokeRect(460, CANVAS_HEIGHT - wallThickness, 8, wallThickness);
      }

      // Draw Left Wall
      ctx.fillStyle = wallFill;
      if (player.screenX === 0) {
        ctx.fillRect(0, 0, wallThickness, CANVAS_HEIGHT);
        ctx.fillStyle = wallTop;
        ctx.fillRect(0, 0, 4, CANVAS_HEIGHT);
      } else {
        ctx.fillRect(0, 0, wallThickness, 180);
        ctx.fillRect(0, 300, wallThickness, CANVAS_HEIGHT - 300);
        ctx.fillStyle = wallTop;
        ctx.fillRect(0, 0, 4, 180);
        ctx.fillRect(0, 300, 4, CANVAS_HEIGHT - 300);

        ctx.fillStyle = wallTop;
        ctx.fillRect(0, 172, wallThickness, 8);
        ctx.fillRect(0, 300, wallThickness, 8);
        ctx.strokeStyle = wallBricks;
        ctx.strokeRect(0, 172, wallThickness, 8);
        ctx.strokeRect(0, 300, wallThickness, 8);
      }

      // Draw Right Wall
      ctx.fillStyle = wallFill;
      if (player.screenX === 2) {
        ctx.fillRect(CANVAS_WIDTH - wallThickness, 0, wallThickness, CANVAS_HEIGHT);
        ctx.fillStyle = wallTop;
        ctx.fillRect(CANVAS_WIDTH - wallThickness, 0, 4, CANVAS_HEIGHT);
      } else {
        ctx.fillRect(CANVAS_WIDTH - wallThickness, 0, wallThickness, 180);
        ctx.fillRect(CANVAS_WIDTH - wallThickness, 300, wallThickness, CANVAS_HEIGHT - 300);
        ctx.fillStyle = wallTop;
        ctx.fillRect(CANVAS_WIDTH - wallThickness, 0, 4, 180);
        ctx.fillRect(CANVAS_WIDTH - wallThickness, 300, 4, CANVAS_HEIGHT - 300);

        ctx.fillStyle = wallTop;
        ctx.fillRect(CANVAS_WIDTH - wallThickness, 172, wallThickness, 8);
        ctx.fillRect(CANVAS_WIDTH - wallThickness, 300, wallThickness, 8);
        ctx.strokeStyle = wallBricks;
        ctx.strokeRect(CANVAS_WIDTH - wallThickness, 172, wallThickness, 8);
        ctx.strokeRect(CANVAS_WIDTH - wallThickness, 300, wallThickness, 8);
      }
      ctx.restore();

      // Draw screen coordinate coordinates label top-left (Retro LCD design element helper)
      ctx.fillStyle = activeArea.accentColor;
      ctx.font = '10px monospace';
      ctx.fillText(`WORLD AREA ${area} | COORDINATE [${player.screenX}, ${player.screenY}]`, 24, 48);

      // Render Obstacles (Rocks, Trees, Lava blocks, Cabins)
      const obstacles = getObstaclesForScreen(area, player.screenX, player.screenY, gameRef.current.gateOpened);
      obstacles.forEach(obs => {
        const time = Date.now();
        
        ctx.save();
        
        // 1. Draw smooth bottom shadow (Retro circular shadow offset)
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.ellipse(obs.x, obs.y + obs.r * 0.4, obs.r * 1.0, obs.r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Draw styled items depending on type and theme
        if (obs.type === 'tree') {
          if (theme === 'forest') {
            // Oak / Pine Tree: trunk and detailed leafy canopies
            // trunk
            ctx.fillStyle = '#5c4033';
            ctx.fillRect(obs.x - 6, obs.y, 12, obs.r * 0.9);
            ctx.strokeStyle = '#271911';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(obs.x - 6, obs.y, 12, obs.r * 0.9);

            // canopy layered circles
            const foliageColors = ['#1e3a1e', '#14532d', '#22c55e', '#4ade80'];
            // layers from bottom up
            for (let layer = 0; layer < 3; layer++) {
              ctx.beginPath();
              const layerY = obs.y - (layer * obs.r * 0.4);
              const layerR = obs.r - (layer * obs.r * 0.18);
              ctx.fillStyle = layer === 0 ? foliageColors[1] : (layer === 1 ? foliageColors[2] : foliageColors[3]);
              ctx.arc(obs.x, layerY, layerR, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = foliageColors[0];
              ctx.lineWidth = 1.5;
              ctx.stroke();

              // Shine dot
              ctx.beginPath();
              ctx.fillStyle = '#ffffff';
              ctx.globalAlpha = 0.25;
              ctx.arc(obs.x - layerR * 0.3, layerY - layerR * 0.3, layerR * 0.25, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1.0;
            }
          } else if (theme === 'desert') {
            // Cactus
            ctx.strokeStyle = '#14532d';
            ctx.lineWidth = 2;

            // Trunk column
            ctx.fillStyle = '#16a34a';
            ctx.fillRect(obs.x - 7, obs.y - obs.r, 14, obs.r * 2);
            ctx.strokeRect(obs.x - 7, obs.y - obs.r, 14, obs.r * 2);

            // Left arm
            ctx.beginPath();
            ctx.fillStyle = '#15803d';
            ctx.fillRect(obs.x - 20, obs.y - obs.r * 0.3, 13, 8);
            ctx.fillRect(obs.x - 20, obs.y - obs.r * 0.8, 8, obs.r * 0.6);
            ctx.strokeRect(obs.x - 20, obs.y - obs.r * 0.3, 13, 8);
            ctx.strokeRect(obs.x - 20, obs.y - obs.r * 0.8, 8, obs.r * 0.6);

            // Right arm
            ctx.beginPath();
            ctx.fillStyle = '#15803d';
            ctx.fillRect(obs.x + 7, obs.y, 13, 8);
            ctx.fillRect(obs.x + 12, obs.y - obs.r * 0.5, 8, obs.r * 0.6);
            ctx.strokeRect(obs.x + 7, obs.y, 13, 8);
            ctx.strokeRect(obs.x + 12, obs.y - obs.r * 0.5, 8, obs.r * 0.6);

            // Flower blossom
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(obs.x, obs.y - obs.r - 3, 4, 0, Math.PI * 2);
            ctx.fill();
          } else if (theme === 'volcano') {
            // Dead scorched charred tree
            ctx.fillStyle = '#090707';
            ctx.strokeStyle = '#220b0b';
            ctx.lineWidth = 2;

            // Burned trunk
            ctx.beginPath();
            ctx.moveTo(obs.x - 10, obs.y + obs.r * 0.8);
            ctx.lineTo(obs.x - 3, obs.y - obs.r * 0.8);
            ctx.lineTo(obs.x + 3, obs.y - obs.r * 0.8);
            ctx.lineTo(obs.x + 10, obs.y + obs.r * 0.8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Charcoal branching branches
            ctx.strokeStyle = '#090707';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(obs.x - 2, obs.y - obs.r * 0.3);
            ctx.quadraticCurveTo(obs.x - 18, obs.y - obs.r * 0.6, obs.x - 15, obs.y - obs.r * 1.1);
            ctx.moveTo(obs.x + 2, obs.y - obs.r * 0.2);
            ctx.quadraticCurveTo(obs.x + 18, obs.y - obs.r * 0.5, obs.x + 15, obs.y - obs.r * 0.9);
            ctx.stroke();

            // Molten magma pulse vein
            if (time % 1000 > 500) {
              ctx.strokeStyle = '#f97316';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(obs.x, obs.y - obs.r * 0.7);
              ctx.lineTo(obs.x - 1, obs.y + obs.r * 0.6);
              ctx.stroke();
            }
          } else if (theme === 'ice') {
            // Snowy Christmas Tree (Frost Pine)
            ctx.fillStyle = '#0284c7'; // dark blue pine back
            ctx.beginPath();
            ctx.moveTo(obs.x, obs.y - obs.r * 1.3);
            ctx.lineTo(obs.x + obs.r, obs.y + obs.r * 0.8);
            ctx.lineTo(obs.x - obs.r, obs.y + obs.r * 0.8);
            ctx.closePath();
            ctx.fill();

            // Snow layer layers
            ctx.fillStyle = '#f1f5f9';
            // Layer 1
            ctx.beginPath();
            ctx.moveTo(obs.x, obs.y - obs.r * 1.3);
            ctx.lineTo(obs.x + obs.r * 0.4, obs.y - obs.r * 0.3);
            ctx.lineTo(obs.x - obs.r * 0.4, obs.y - obs.r * 0.3);
            ctx.closePath();
            ctx.fill();
            // Layer 2
            ctx.beginPath();
            ctx.moveTo(obs.x, obs.y - obs.r * 0.4);
            ctx.lineTo(obs.x + obs.r * 0.8, obs.y + obs.r * 0.3);
            ctx.lineTo(obs.x - obs.r * 0.8, obs.y + obs.r * 0.3);
            ctx.closePath();
            ctx.fill();

            // Pine trunk
            ctx.fillStyle = '#082f49';
            ctx.fillRect(obs.x - 4, obs.y + obs.r * 0.8, 8, 8);
          } else {
            // Abyss shadow eyeball tree
            ctx.fillStyle = '#22003c';
            ctx.beginPath();
            ctx.arc(obs.x, obs.y - 10, obs.r * 0.8, 0, Math.PI * 2);
            ctx.fill();

            // Glowing dynamic violet eye
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(obs.x, obs.y - 12, obs.r * 0.4, obs.r * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();

            // Dynamic iris coordinates (stares at player!)
            const dx = player.x - obs.x;
            const dy = player.y - obs.y;
            const targetDist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            const pupilOffsetMultiplier = 3.5;
            const pupilX = (dx / targetDist) * pupilOffsetMultiplier;
            const pupilY = (dy / targetDist) * pupilOffsetMultiplier;

            ctx.fillStyle = '#a855f7';
            ctx.beginPath();
            ctx.arc(obs.x + pupilX, obs.y - 12 + pupilY, obs.r * 0.15, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(obs.x + pupilX, obs.y - 12 + pupilY, obs.r * 0.07, 0, Math.PI * 2);
            ctx.fill();

            // Eldritch writhing branches below eyeball
            ctx.strokeStyle = '#22003c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(obs.x, obs.y);
            ctx.lineTo(obs.x, obs.y + obs.r * 0.8);
            ctx.stroke();
          }
        } 
        else if (obs.type === 'rock') {
          // Robust rock rendering customized by biome!
          let rockColor1 = '#94a3b8'; // Grassland rocks
          let rockColor2 = '#64748b';
          let rockColor3 = '#e2e8f0'; // highlights
          let shadowStroke = '#334155';

          if (theme === 'desert') {
            rockColor1 = '#b45309'; rockColor2 = '#78350f'; rockColor3 = '#f59e0b'; shadowStroke = '#451a03';
          } else if (theme === 'volcano') {
            rockColor1 = '#181212'; rockColor2 = '#0d0707'; rockColor3 = '#e11d48'; shadowStroke = '#000000';
          } else if (theme === 'ice') {
            rockColor1 = '#cbd5e1'; rockColor2 = '#94a3b8'; rockColor3 = '#f8fafc'; shadowStroke = '#475569';
          } else if (theme === 'abyss') {
            rockColor1 = '#3b0764'; rockColor2 = '#1e1b4b'; rockColor3 = '#a855f7'; shadowStroke = '#090514';
          }

          // Draw faceted polygon rock
          ctx.fillStyle = rockColor1;
          ctx.beginPath();
          ctx.moveTo(obs.x - obs.r, obs.y + obs.r * 0.3);
          ctx.lineTo(obs.x - obs.r * 0.6, obs.y - obs.r * 0.9);
          ctx.lineTo(obs.x + obs.r * 0.3, obs.y - obs.r * 1.0);
          ctx.lineTo(obs.x + obs.r * 1.0, obs.y - obs.r * 0.2);
          ctx.lineTo(obs.x + obs.r * 0.7, obs.y + obs.r * 0.8);
          ctx.lineTo(obs.x - obs.r * 0.5, obs.y + obs.r * 1.0);
          ctx.closePath();
          ctx.fill();

          // Dark shadowed side
          ctx.fillStyle = rockColor2;
          ctx.beginPath();
          ctx.moveTo(obs.x + obs.r * 0.3, obs.y - obs.r * 1.0);
          ctx.lineTo(obs.x + obs.r * 1.0, obs.y - obs.r * 0.2);
          ctx.lineTo(obs.x + obs.r * 0.7, obs.y + obs.r * 0.8);
          ctx.lineTo(obs.x, obs.y);
          ctx.closePath();
          ctx.fill();

          // Light highlighted side
          ctx.fillStyle = rockColor3;
          ctx.beginPath();
          ctx.moveTo(obs.x - obs.r, obs.y + obs.r * 0.3);
          ctx.lineTo(obs.x - obs.r * 0.6, obs.y - obs.r * 0.9);
          ctx.lineTo(obs.x + obs.r * 0.3, obs.y - obs.r * 1.0);
          ctx.lineTo(obs.x, obs.y);
          ctx.closePath();
          ctx.fill();

          // Outer stroke for vintage retro look
          ctx.strokeStyle = shadowStroke;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(obs.x - obs.r, obs.y + obs.r * 0.3);
          ctx.lineTo(obs.x - obs.r * 0.6, obs.y - obs.r * 0.9);
          ctx.lineTo(obs.x + obs.r * 0.3, obs.y - obs.r * 1.0);
          ctx.lineTo(obs.x + obs.r * 1.0, obs.y - obs.r * 0.2);
          ctx.lineTo(obs.x + obs.r * 0.7, obs.y + obs.r * 0.8);
          ctx.lineTo(obs.x - obs.r * 0.5, obs.y + obs.r * 1.0);
          ctx.closePath();
          ctx.stroke();

          // Fissures / cracks
          ctx.strokeStyle = shadowStroke;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(obs.x - obs.r * 0.2, obs.y - obs.r * 0.4);
          ctx.lineTo(obs.x + obs.r * 0.1, obs.y + obs.r * 0.4);
          ctx.stroke();
        } 
        else if (obs.type === 'pillar') {
          // Classic 2D Zelda dungeon / ancient ruin pillars
          let pilBase = '#475569';
          let pilBody = '#64748b';
          let pilTop = '#cbd5e1';
          let strokeCol = '#1e293b';

          if (theme === 'desert') {
            pilBase = '#78350f'; pilBody = '#b45309'; pilTop = '#f59e0b'; strokeCol = '#451a03';
          } else if (theme === 'volcano') {
            pilBase = '#110202'; pilBody = '#290505'; pilTop = '#dc2626'; strokeCol = '#020000';
          } else if (theme === 'ice') {
            pilBase = '#0c4a6e'; pilBody = '#0284c7'; pilTop = '#e0f2fe'; strokeCol = '#042d44';
          } else if (theme === 'abyss') {
            pilBase = '#1e1b4b'; pilBody = '#311054'; pilTop = '#c084fc'; strokeCol = '#0b001a';
          }

          const hHeight = obs.r * 1.3;

          // Pedestal Base
          ctx.fillStyle = pilBase;
          ctx.fillRect(obs.x - obs.r * 0.8, obs.y + hHeight - 14, obs.r * 1.6, 14);
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(obs.x - obs.r * 0.8, obs.y + hHeight - 14, obs.r * 1.6, 14);

          // Central Pillar Column Shaft
          ctx.fillStyle = pilBody;
          ctx.fillRect(obs.x - obs.r * 0.6, obs.y - hHeight + 8, obs.r * 1.2, hHeight * 2 - 20);
          ctx.strokeRect(obs.x - obs.r * 0.6, obs.y - hHeight + 8, obs.r * 1.2, hHeight * 2 - 20);

          // Vertical fluting groves on column
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(obs.x - obs.r * 0.2, obs.y - hHeight + 12);
          ctx.lineTo(obs.x - obs.r * 0.2, obs.y + hHeight - 16);
          ctx.moveTo(obs.x + obs.r * 0.2, obs.y - hHeight + 12);
          ctx.lineTo(obs.x + obs.r * 0.2, obs.y + hHeight - 16);
          ctx.stroke();

          // Ornate Capital (Triglyphs) Top
          ctx.fillStyle = pilTop;
          ctx.fillRect(obs.x - obs.r * 0.76, obs.y - hHeight - 4, obs.r * 1.52, 12);
          ctx.strokeRect(obs.x - obs.r * 0.76, obs.y - hHeight - 4, obs.r * 1.52, 12);

          // Tiny crumbling chip detailing
          ctx.fillStyle = strokeCol;
          ctx.fillRect(obs.x - obs.r * 0.4, obs.y - 4, 3, 2);
          ctx.fillRect(obs.x + obs.r * 0.3, obs.y + 12, 3, 3);
        } 
        else if (obs.type === 'hut') {
          // BEAUTIFUL 2D RETRO CABIN / HUT ("ちょっとした小屋"!)
          // Walls
          let wallCol = '#854d0e';
          let roofCol = '#dc2626';
          let doorCol = '#451a03';
          let stroke = '#271201';

          if (theme === 'desert') {
            wallCol = '#b45309'; roofCol = '#eab308'; doorCol = '#451a03'; stroke = '#2d0f02';
          } else if (theme === 'volcano') {
            wallCol = '#1a0505'; roofCol = '#991b1b'; doorCol = '#000000'; stroke = '#000000';
          } else if (theme === 'ice') {
            wallCol = '#0369a1'; roofCol = '#f1f5f9'; doorCol = '#075985'; stroke = '#022d42';
          } else if (theme === 'abyss') {
            wallCol = '#2e1065'; roofCol = '#6b21a8'; doorCol = '#1e1b4b'; stroke = '#090317';
          }

          // Cabin main room width & height
          const cW = obs.r * 1.8;
          const cH = obs.r * 1.3;

          // Main Cabin Body Walls
          ctx.fillStyle = wallCol;
          ctx.fillRect(obs.x - cW / 2, obs.y - cH / 2 + 10, cW, cH);
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 2;
          ctx.strokeRect(obs.x - cW / 2, obs.y - cH / 2 + 10, cW, cH);

          // Log panel horizontal lines
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(obs.x - cW / 2, obs.y);
          ctx.lineTo(obs.x + cW / 2, obs.y);
          ctx.moveTo(obs.x - cW / 2, obs.y + 14);
          ctx.lineTo(obs.x + cW / 2, obs.y + 14);
          ctx.stroke();

          // Small entrance Doorways
          ctx.fillStyle = doorCol;
          ctx.fillRect(obs.x - 10, obs.y + 12, 20, cH - 12);
          ctx.strokeStyle = stroke;
          ctx.strokeRect(obs.x - 10, obs.y + 12, 20, cH - 12);

          // Door knob
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(obs.x + 6, obs.y + 24, 2, 0, Math.PI * 2);
          ctx.fill();

          // Cozy circular window with bright yellow glow!
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(obs.x - cW / 4, obs.y + 2, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(obs.x - cW / 4, obs.y + 2, 7, 0, Math.PI * 2);
          ctx.stroke();

          // Window pane lines
          ctx.beginPath();
          ctx.moveTo(obs.x - cW / 4 - 7, obs.y + 2);
          ctx.lineTo(obs.x - cW / 4 + 7, obs.y + 2);
          ctx.moveTo(obs.x - cW / 4, obs.y + 2 - 7);
          ctx.lineTo(obs.x - cW / 4, obs.y + 2 + 7);
          ctx.stroke();

          // Triangle Roof
          ctx.fillStyle = roofCol;
          ctx.beginPath();
          ctx.moveTo(obs.x - cW / 2 - 6, obs.y - cH / 2 + 10);
          ctx.lineTo(obs.x, obs.y - cH * 1.1);
          ctx.lineTo(obs.x + cW / 2 + 6, obs.y - cH / 2 + 10);
          ctx.closePath();
          ctx.fill();
          // roof stroke outline
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(obs.x - cW / 2 - 6, obs.y - cH / 2 + 10);
          ctx.lineTo(obs.x, obs.y - cH * 1.1);
          ctx.lineTo(obs.x + cW / 2 + 6, obs.y - cH / 2 + 10);
          ctx.closePath();
          ctx.stroke();

          // Roof tile horizontal rib pattern lines
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(obs.x - cW / 3, obs.y - cH / 2 - 2);
          ctx.lineTo(obs.x + cW / 3, obs.y - cH / 2 - 2);
          ctx.moveTo(obs.x - cW / 5, obs.y - cH * 0.75);
          ctx.lineTo(obs.x + cW / 5, obs.y - cH * 0.75);
          ctx.stroke();
          ctx.globalAlpha = 1.0;

          // Tiny Stone Chimney with dynamic smoke!
          ctx.fillStyle = '#64748b';
          ctx.fillRect(obs.x + cW / 4, obs.y - cH * 0.9, 10, 16);
          ctx.strokeStyle = stroke;
          ctx.strokeRect(obs.x + cW / 4, obs.y - cH * 0.9, 10, 16);

          // Chimney smoke ring animation lines
          const smokeIndex = Math.floor((time / 250) % 3);
          ctx.fillStyle = 'rgba(240, 240, 240, 0.4)';
          for (let s = 0; s <= smokeIndex; s++) {
            const smokeY = obs.y - cH * 0.95 - (s * 10) - ((time % 250) / 25);
            const smokeRadius = 4 + (s * 3);
            ctx.beginPath();
            ctx.arc(obs.x + cW / 4 + 5, smokeY, smokeRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        else if (obs.type === 'gate_wall') {
          // Robust stone/iron dungeon fence pillar
          ctx.fillStyle = '#334155'; // Slate dark gray
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.roundRect(obs.x - 8, obs.y - 14, 16, 28, 4);
          ctx.fill();
          ctx.stroke();

          // Iron vertical bars
          ctx.fillStyle = '#475569';
          ctx.fillRect(obs.x - 2, obs.y - 10, 4, 20);

          // Top post sphere
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(obs.x, obs.y - 14, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        else if (obs.type === 'gate_left' || obs.type === 'gate_top') {
          // Closed gate dynamic latch/door mechanism
          ctx.fillStyle = '#78350f'; // Dark bronze door panel
          ctx.strokeStyle = '#facc15'; // Glowing gold edge
          ctx.lineWidth = 2.5;

          ctx.beginPath();
          ctx.roundRect(obs.x - 14, obs.y - 14, 28, 28, 6);
          ctx.fill();
          ctx.stroke();

          // Draw double borders
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.0;
          ctx.strokeRect(obs.x - 10, obs.y - 10, 20, 20);

          // Giant keyhole design
          ctx.fillStyle = '#1e293b'; // deep cut keyhole
          ctx.beginPath();
          ctx.arc(obs.x, obs.y - 3, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(obs.x - 2, obs.y - 3);
          ctx.lineTo(obs.x + 2, obs.y - 3);
          ctx.lineTo(obs.x + 4, obs.y + 7);
          ctx.lineTo(obs.x - 4, obs.y + 7);
          ctx.closePath();
          ctx.fill();

          // If they have the key, draw dynamic golden pulsing sparkles to guide them!
          if (gameRef.current.hasAreaKey) {
            const glowPulse = 0.5 + Math.sin(Date.now() / 150) * 0.5;
            ctx.strokeStyle = `rgba(250, 204, 21, ${0.4 + glowPulse * 0.6})`;
            ctx.lineWidth = 2 + glowPulse * 2;
            ctx.beginPath();
            ctx.arc(obs.x, obs.y, 20 + glowPulse * 6, 0, Math.PI * 2);
            ctx.stroke();

            // Tiny sparkles
            if (Math.floor(Date.now() / 100) % 2 === 0) {
              ctx.save();
              ctx.font = '11px sans-serif';
              ctx.fillStyle = '#fbbf24';
              ctx.fillText("✨", obs.x - 18, obs.y - 12);
              ctx.fillText("✨", obs.x + 10, obs.y + 16);
              ctx.restore();
            }
          }
        }

        ctx.restore();
      });

      // Render Level Portal gateway if spawned here
      const portal = gameRef.current.portal;
      if (portal.active && portal.screenX === player.screenX && portal.screenY === player.screenY) {
        const time = Date.now() / 200;
        
        ctx.save();
        ctx.translate(portal.x, portal.y);
        ctx.rotate(time);

        // Draw multiple glowing rotating circles (purple void halo)
        ctx.globalAlpha = 0.45;
        const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 52);
        grad.addColorStop(0, '#c084fc');
        grad.addColorStop(0.5, '#7e22ce');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 55, 0, Math.PI * 2);
        ctx.fill();

        // Gateway spikes
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = activeArea.accentColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const rotationAngle = (Math.PI * 2 / 6) * s;
          ctx.moveTo(Math.cos(rotationAngle) * 20, Math.sin(rotationAngle) * 20);
          ctx.lineTo(Math.cos(rotationAngle) * 44, Math.sin(rotationAngle) * 44);
        }
        ctx.stroke();

        ctx.restore();

        // Label portal interaction
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText('⚡ ゲートウェイポータル ⚡', portal.x, portal.y - 60);
        ctx.font = '9px monospace';
        ctx.fillStyle = activeArea.accentColor;
        ctx.fillText('[E] キーで次のエリアへ転送', portal.x, portal.y + 60);
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
      }

      // Render Drop Items on Floor
      gameRef.current.dropItems.forEach(drop => {
        if (drop.screenX !== player.screenX || drop.screenY !== player.screenY) return;

        const time = Date.now() / 150;
        const hoverOffsetY = Math.sin(time) * 4;

        // Shiny ground ring
        ctx.fillStyle = 'rgba(253, 224, 71, 0.45)';
        ctx.beginPath();
        ctx.ellipse(drop.x, drop.y + 10, 15, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Render drop package chest
        ctx.fillStyle = drop.item.color;
        ctx.fillRect(drop.x - 10, drop.y - 12 + hoverOffsetY, 20, 16);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(drop.x - 10, drop.y - 12 + hoverOffsetY, 20, 16);

        // Golden details
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(drop.x - 2, drop.y - 12 + hoverOffsetY, 4, 16);

        // Name above
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 3;
        ctx.fillText(drop.item.name, drop.x, drop.y - 20 + hoverOffsetY);
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
      });

      // Render Projectiles
      gameRef.current.projectiles.forEach(p => {
        if (p.screenX !== player.screenX || p.screenY !== player.screenY) return;

        if (p.isWeb) {
          // 蜘蛛糸(Web Projectile)のレンダリング：放射状の美しい不規則な蜘蛛の巣
          ctx.save();
          ctx.shadowColor = '#e2e8f0';
          ctx.shadowBlur = 6;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;

          const segments = 8;
          const rad = p.radius * 1.5; // やや大きめの蜘蛛の巣として描画
          
          ctx.beginPath();
          for (let i = 0; i < segments; i++) {
            const angle = (Math.PI * 2 / segments) * i;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + Math.cos(angle) * rad, p.y + Math.sin(angle) * rad);
          }
          ctx.stroke();

          // 同心円（ウェブの同心多角形）
          ctx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
          ctx.beginPath();
          for (let rFactor = 0; rFactor <= 1.0; rFactor += 0.3) {
            const currentRad = rad * rFactor;
            for (let i = 0; i <= segments; i++) {
              const angle = (Math.PI * 2 / segments) * i;
              const px = p.x + Math.cos(angle) * currentRad;
              const py = p.y + Math.sin(angle) * currentRad;
              if (i === 0) {
                ctx.moveTo(px, py);
              } else {
                ctx.lineTo(px, py);
              }
            }
          }
          ctx.stroke();

          // 核心
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(p.x, p.y, rad * 0.25, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        } else if (p.isPoison) {
          // 毒針弾(Poison Projectile)のレンダリング：怪しい揺らめく紫の泡
          ctx.save();
          ctx.shadowColor = '#d946ef';
          ctx.shadowBlur = 10;

          const pulseSize = p.radius * (1.1 + Math.sin(Date.now() / 80) * 0.15);
          ctx.fillStyle = '#a855f7';
          ctx.beginPath();
          ctx.arc(p.x, p.y, pulseSize, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f5f3ff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, pulseSize * 0.42, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        } else if (p.isBurn) {
          // 燃焼弾(Burn Projectile)のレンダリング：小さな燃え盛る火の玉（進行方向と逆に火炎の尾を引く）
          ctx.save();
          ctx.shadowColor = '#f97316';
          ctx.shadowBlur = 12;

          const time = Date.now() / 60;
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 1.2, 0, Math.PI * 2);
          ctx.fill();

          // 進行方向と逆（弾速ベクトルの逆）に向けて尾を描画
          const travelAngle = Math.atan2(p.dy, p.dx);
          ctx.fillStyle = '#f97316';
          for (let i = 0; i < 3; i++) {
            const angle = travelAngle + Math.PI + (i - 1) * 0.45;
            const ox = p.x + Math.cos(angle) * (p.radius * 1.1);
            const oy = p.y + Math.sin(angle) * (p.radius * 1.1);
            ctx.beginPath();
            ctx.arc(ox, oy, p.radius * 0.6 * (0.85 + Math.sin(time + i) * 0.15), 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        } else {
          // Glowing outer arc
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI*2);
          ctx.fill();

          ctx.shadowBlur = 0;
        }
      });

      // Render Enemies & Bosses
      gameRef.current.enemies.forEach(enemy => {
        if (enemy.screenX !== player.screenX || enemy.screenY !== player.screenY) return;

        const pulse = 1 + (Math.sin(Date.now() / 120) * 0.05);
        const isBoss = enemy.type === 'boss';
        
        const isStiffened = (enemy.stiffenTimer || 0) > 0;

        const triggerShootCap = isBoss ? 55 : (enemy.shootCooldown || 120);
        const prepDuration = isBoss ? 24 : 35;
        // Preparing attack is only possible if not currently stiffened and actually within charge windows
        const isPreparingAttack = !isStiffened && (enemy.shootTimer || 0) > (triggerShootCap - prepDuration) && (enemy.isAttackingChain || false);

        let jitterX = 0;
        let jitterY = 0;
        if (isPreparingAttack) {
          // Classic retro shaking vibe during charging
          jitterX = (Math.random() - 0.5) * 3.5;
          jitterY = (Math.random() - 0.5) * 3.5;
        }

        // Apply scale. Squish vertical direction while tired, or use normal pulse
        let scaleX = pulse;
        let scaleY = pulse;
        if (isStiffened) {
          const pantTime = Math.sin(Date.now() / 70) * 0.08;
          scaleX = 1.06 + pantTime;
          scaleY = 0.85 - pantTime; // squished vertical look to show exhaustion!
        }

        ctx.save();
        ctx.translate(enemy.x + enemy.width / 2 + jitterX, enemy.y + enemy.height / 2 + jitterY);
        ctx.scale(scaleX, scaleY);

        // Render shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, enemy.height / 2 - 2, enemy.width * 0.5, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glowing key carrier aura under their feet
        if (enemy.isKeyCarrier) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 3]);
          ctx.beginPath();
          ctx.arc(0, enemy.height / 2 - 2, enemy.width * 0.9 * (1.1 + Math.sin(Date.now() / 100) * 0.12), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]); // Reset line dash

          // Draw floating sparkling key symbols above their head
          ctx.save();
          ctx.font = 'bold 12px sans-serif';
          ctx.fillStyle = '#facc15';
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2.5;
          ctx.textAlign = 'center';
          
          const hoverY = -enemy.height / 2 - 18 + Math.sin(Date.now() / 150) * 4;
          ctx.strokeText("✨🔑✨", 0, hoverY);
          ctx.fillText("✨🔑✨", 0, hoverY);
          ctx.restore();

          // Apply gorgeous glowing highlight shadow on the main body
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 12;
        }

        // Render recovery sweat/fatigue marks above head when tired
        if (isStiffened) {
          ctx.save();
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = '#60a5fa'; // Cool blue sweat drop color
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2.5;
          ctx.textAlign = 'center';
          
          if (Math.floor(Date.now() / 150) % 2 === 0) {
            ctx.strokeText("💦", 0, -enemy.height / 2 - 14);
            ctx.fillText("💦", 0, -enemy.height / 2 - 14);
          } else {
            ctx.strokeText("💧", 0, -enemy.height / 2 - 14);
            ctx.fillText("💧", 0, -enemy.height / 2 - 14);
          }
          ctx.restore();
        }

        // Render charging energy dynamic ring under the enemy feet
        if (isPreparingAttack) {
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 2]);
          ctx.beginPath();
          ctx.arc(0, enemy.height / 2 - 2, enemy.width * 0.75 * (0.85 + Math.sin(Date.now() / 30) * 0.15), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]); // Restore line dash

          // Draw flashing exclamation point above head
          ctx.save();
          ctx.font = 'bold 15px monospace';
          ctx.fillStyle = '#f87171';
          ctx.strokeStyle = '#1e1b4b';
          ctx.lineWidth = 2;
          ctx.textAlign = 'center';
          
          if (Math.floor(Date.now() / 60) % 2 === 0) {
            ctx.strokeText("❗", 0, -enemy.height / 2 - 14);
            ctx.fillText("❗", 0, -enemy.height / 2 - 14);
          }
          ctx.restore();

          // Apply gorgeous heavy outer glow shadow on normal canvas calls
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 8;
        }

        // Render main physical body
        ctx.fillStyle = enemy.color;
        const areaNum = gameRef.current.area;
        
        if (isBoss) {
          if (areaNum === 1) {
            // === エリア1: マザー・スライム ===
            // ぷにぷにスライム（ドーム状）
            ctx.beginPath();
            ctx.moveTo(-enemy.width / 2, enemy.height / 2);
            ctx.bezierCurveTo(-enemy.width / 2, -enemy.height / 3, -enemy.width / 3, -enemy.height / 2, 0, -enemy.height / 2);
            ctx.bezierCurveTo(enemy.width / 3, -enemy.height / 2, enemy.width / 2, -enemy.height / 3, enemy.width / 2, enemy.height / 2);
            ctx.closePath();
            ctx.fill();

            // ぷにぷにハイライト（艶感）
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.beginPath();
            ctx.ellipse(-12, -14, 8, 4, -Math.PI / 6, 0, Math.PI * 2);
            ctx.fill();

            // 王冠 (Crown)
            ctx.fillStyle = '#facc15'; // ゴールド
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-20, -enemy.height / 2 - 2);
            ctx.lineTo(-14, -enemy.height / 2 - 16);
            ctx.lineTo(-5, -enemy.height / 2 - 8);
            ctx.lineTo(0, -enemy.height / 2 - 20);
            ctx.lineTo(5, -enemy.height / 2 - 8);
            ctx.lineTo(14, -enemy.height / 2 - 16);
            ctx.lineTo(20, -enemy.height / 2 - 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 王冠の上の紅いジェム
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(0, -enemy.height / 2 - 22, 3, 0, Math.PI * 2);
            ctx.fill();

            // 怒った目
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-15, -6, 9, 5);
            ctx.fillRect(6, -6, 9, 5);
            ctx.fillStyle = '#16a34a'; // スライムの深い眼光
            ctx.fillRect(-11, -5, 3, 3);
            ctx.fillRect(8, -5, 3, 3);

          } else if (areaNum === 2) {
            // === エリア2: 双頭魔獣キマイラ (Chimera) ===
            // 1. メインのライオンのボディ（ブラウン系オレンジ）
            ctx.fillStyle = '#d97706';
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(-24, -20, 48, 44, 10);
            ctx.fill();
            ctx.stroke();

            // 2. 誇り高きたてがみ（燃え盛るようなギザギザ）
            ctx.fillStyle = '#9a3412';
            ctx.beginPath();
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
              const spikeOffset = 3 + Math.sin(Date.now() / 120 + angle * 4) * 3;
              const tx = Math.cos(angle) * (26 + spikeOffset);
              const ty = Math.sin(angle) * (24 + spikeOffset);
              ctx.lineTo(tx, ty);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 上からメインフェイスを再描画してたてがみを奥に配置
            ctx.fillStyle = '#d97706';
            ctx.beginPath();
            ctx.roundRect(-20, -18, 40, 36, 8);
            ctx.fill();
            ctx.stroke();

            // 3. 背中からそびえ立つ大蛇（にょきにょきダイナミックに動く）
            const snakeWave = Math.sin(Date.now() / 150) * 8;
            ctx.fillStyle = '#16a34a'; // 蛇グリーン
            ctx.strokeStyle = '#14532d';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            // 太い蛇首
            ctx.moveTo(-10, 0);
            ctx.quadraticCurveTo(-32 + snakeWave, -35, -24 + snakeWave, -45);
            ctx.lineTo(-10 + snakeWave, -45);
            ctx.quadraticCurveTo(-2, -22, 10, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 蛇の目と鋭いキバ
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(-22 + snakeWave, -47, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(-18 + snakeWave, -41);
            ctx.lineTo(-21 + snakeWave, -37);
            ctx.lineTo(-15 + snakeWave, -42);
            ctx.fill();

            // 4. ライオン(キマイラ第1頭)の怒れる赤目とキバ
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-14, -6, 9, 6);
            ctx.fillRect(5, -6, 9, 6);
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(-10, -4, 4, 3);
            ctx.fillRect(7, -4, 4, 3);

            // 巨大な鋭いキバ
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-10, 10);
            ctx.lineTo(-12, 18);
            ctx.lineTo(-6, 11);
            ctx.moveTo(10, 10);
            ctx.lineTo(12, 18);
            ctx.lineTo(6, 11);
            ctx.stroke();

          } else if (areaNum === 3) {
            // === エリア3: 三頭蛇竜ヒュドラ (Hydra) ===
            // ３つの巨大なウロコ頭が、それぞれ生命感あふれる軌跡で左右にゆらゆら動く
            const time = Date.now();
            ctx.strokeStyle = '#450a0a';
            ctx.lineWidth = 3;

            const heads = [
              { dx: -26 + Math.sin(time / 220) * 12, dy: -34 + Math.cos(time / 240) * 8, color: '#f87171' }, // 左頭
              { dx: 0 + Math.sin(time / 180) * 6,     dy: -46 + Math.sin(time / 140) * 10, color: '#ef4444' }, // 中央頭
              { dx: 26 + Math.cos(time / 220) * 12,  dy: -34 + Math.sin(time / 240) * 8, color: '#b91c1c' }  // 右頭
            ];

            // 首を全て胴体と繋げて湾曲しながら描画
            heads.forEach(h => {
              ctx.fillStyle = h.color;
              ctx.beginPath();
              ctx.moveTo(-10, 20);
              ctx.quadraticCurveTo(h.dx / 2, h.dy / 2, h.dx, h.dy + 8);
              ctx.lineTo(h.dx - 4, h.dy + 8);
              ctx.quadraticCurveTo(h.dx / 2 - 4, h.dy / 2 + 4, 10, 20);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            });

            // 胴体 (Hydra Solid Base Body)
            ctx.fillStyle = '#991b1b';
            ctx.beginPath();
            ctx.roundRect(-26, 0, 52, 32, 10);
            ctx.fill();
            ctx.stroke();

            // ３つの頭部
            heads.forEach(h => {
              ctx.fillStyle = h.color;
              ctx.beginPath();
              ctx.roundRect(h.dx - 13, h.dy - 10, 26, 20, 6);
              ctx.fill();
              ctx.stroke();

              // 頭部に燃え滾るようなオレンジトゲ
              ctx.fillStyle = '#ea580c';
              ctx.beginPath();
              ctx.moveTo(h.dx - 5, h.dy - 10);
              ctx.lineTo(h.dx, h.dy - 19);
              ctx.lineTo(h.dx + 5, h.dy - 10);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              // 金色に爛々と輝く凶悪な蛇目
              ctx.fillStyle = '#facc15';
              ctx.beginPath();
              ctx.arc(h.dx - 5, h.dy - 2, 2.5, 0, Math.PI * 2);
              ctx.arc(h.dx + 5, h.dy - 2, 2.5, 0, Math.PI * 2);
              ctx.fill();
            });

          } else if (areaNum === 4) {
            // === エリア4: 氷牙蒼龍グラキオス (Frost Dragon) ===
            ctx.fillStyle = '#60a5fa'; // 蒼い氷龍皮
            ctx.strokeStyle = '#1e3b8a';
            ctx.lineWidth = 3;

            // 巨大な結晶翼がダイナミックにバタバタとはためく
            const wingSwing = Math.sin(Date.now() / 150) * 0.45;
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            // 左氷翼
            ctx.moveTo(-15, 0);
            ctx.lineTo(-48, -38 + wingSwing * 18);
            ctx.lineTo(-24, -4 + wingSwing * 12);
            ctx.lineTo(-42, 18 - wingSwing * 6);
            ctx.closePath();
            // 右氷翼
            ctx.moveTo(15, 0);
            ctx.lineTo(48, -38 + wingSwing * 18);
            ctx.lineTo(24, -4 + wingSwing * 12);
            ctx.lineTo(42, 18 - wingSwing * 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // メイン龍頭
            ctx.fillStyle = '#2563eb';
            ctx.beginPath();
            ctx.roundRect(-22, -18, 44, 38, 8);
            ctx.fill();
            ctx.stroke();

            // 2つの鋭利な氷柱ホーン (角)
            ctx.fillStyle = '#e0f2fe';
            ctx.beginPath();
            ctx.moveTo(-14, -18);
            ctx.lineTo(-8, -38);
            ctx.lineTo(-4, -18);
            ctx.moveTo(14, -18);
            ctx.lineTo(8, -38);
            ctx.lineTo(4, -18);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 冷酷無比な氷結シャープアイ(シアンに輝く目)
            ctx.fillStyle = '#22d3ee';
            ctx.beginPath();
            ctx.moveTo(-15, -6);
            ctx.lineTo(-5, -4);
            ctx.lineTo(-13, -2);
            ctx.closePath();
            ctx.moveTo(15, -6);
            ctx.lineTo(5, -4);
            ctx.lineTo(13, -2);
            ctx.closePath();
            ctx.fill();

            // アイスファング(牙)
            ctx.strokeStyle = '#cffafe';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-10, 10);
            ctx.lineTo(-12, 17);
            ctx.lineTo(-7, 11);
            ctx.moveTo(10, 10);
            ctx.lineTo(12, 17);
            ctx.lineTo(7, 11);
            ctx.stroke();

          } else {
            // === エリア5: 終焉魔神龍ヘルアビス (Demon Chaos Dragon) ===
            ctx.fillStyle = '#6b21a8'; // 破滅パープル
            ctx.strokeStyle = '#1e1b4b';
            ctx.lineWidth = 3.5;

            // 凶悪な4枚の深淵デビルウイング
            const abyssWave = Math.sin(Date.now() / 120) * 0.35;
            ctx.fillStyle = '#311042';
            ctx.beginPath();
            // 上左
            ctx.moveTo(-12, -6);
            ctx.lineTo(-58, -48 + abyssWave * 22);
            ctx.lineTo(-32, 2);
            // 上右
            ctx.moveTo(12, -6);
            ctx.lineTo(58, -48 + abyssWave * 22);
            ctx.lineTo(32, 2);
            // 下左
            ctx.moveTo(-12, 6);
            ctx.lineTo(-52, 28 - abyssWave * 14);
            ctx.lineTo(-26, 16);
            // 下右
            ctx.moveTo(12, 6);
            ctx.lineTo(52, 28 - abyssWave * 14);
            ctx.lineTo(26, 16);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // メインヘルフェイス
            ctx.fillStyle = '#4c1d95';
            ctx.beginPath();
            ctx.roundRect(-25, -22, 50, 44, 12);
            ctx.fill();
            ctx.stroke();

            // 巨大にねじれた終焉のツノ
            ctx.fillStyle = '#a855f7';
            ctx.beginPath();
            ctx.moveTo(-18, -22);
            ctx.bezierCurveTo(-40, -36, -30, -58, -14, -48);
            ctx.lineTo(-10, -22);
            ctx.moveTo(18, -22);
            ctx.bezierCurveTo(40, -36, 30, -58, 12, -48);
            ctx.lineTo(10, -22);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 六つの混沌魔眼
            ctx.fillStyle = '#f43f5e';
            const eyeX = [-14, -8, -12, 14, 8, 12];
            const eyeY = [-8, -6, -2, -8, -6, -2];
            for (let e = 0; e < 6; e++) {
              ctx.beginPath();
              ctx.arc(eyeX[e], eyeY[e], 2, 0, Math.PI * 2);
              ctx.fill();
            }

            // 狂牙
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-16, 12);
            ctx.lineTo(-12, 17);
            ctx.lineTo(-8, 12);
            ctx.lineTo(-4, 17);
            ctx.lineTo(0, 12);
            ctx.lineTo(4, 17);
            ctx.lineTo(8, 12);
            ctx.lineTo(12, 17);
            ctx.lineTo(16, 12);
            ctx.stroke();

            // 破壊のコアが鼓動するように明滅
            const coreScale = 0.8 + Math.sin(Date.now() / 90) * 0.25;
            ctx.save();
            ctx.shadowColor = '#d946ef';
            ctx.shadowBlur = 18;
            ctx.fillStyle = '#1e1b4b';
            ctx.strokeStyle = '#d946ef';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 5, 8 * coreScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

        } else {
          // ==========================================
          // Normal mob (エリアごとに見た目を完全変更)
          // ==========================================
          // ==========================================
          // Normal mob (敵の名前に基づいて個別描画)
          // ==========================================
          const name = enemy.name;
          const time = Date.now();
          
          if (name.includes('グリーンスライム')) {
            // === 「グリーンスライム」 (Bounce Animation) ===
            const bounce = Math.abs(Math.sin(time / 150)) * 4;
            ctx.beginPath();
            ctx.ellipse(0, 4 - bounce, enemy.width * 0.5, enemy.height * 0.45 + bounce * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#ecfdf5';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // かわいい黒目
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(-4, 2 - bounce, 2, 0, Math.PI * 2);
            ctx.arc(4, 2 - bounce, 2, 0, Math.PI * 2);
            ctx.fill();

          } else if (name.includes('草原の牙蜘蛛')) {
            // === 「草原の牙蜘蛛」 ===
            const spdLimb = Math.sin(time / 90);
            
            // 胴体
            ctx.fillStyle = '#78350f'; // 茶色
            ctx.beginPath();
            ctx.arc(0, 0, enemy.width * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // 動く蜘蛛肢×8
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let j = 0; j < 4; j++) {
              const angleLeft = Math.PI - 0.5 - (j * 0.4) + spdLimb * 0.25;
              const angleRight = 0.5 + (j * 0.4) - spdLimb * 0.25;
              // Left
              ctx.moveTo(-4, 0);
              ctx.lineTo(Math.cos(angleLeft) * 16, Math.sin(angleLeft) * 16);
              // Right
              ctx.moveTo(4, 0);
              ctx.lineTo(Math.cos(angleRight) * 16, Math.sin(angleRight) * 16);
            }
            ctx.stroke();

            // 牙
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(-4, 6); ctx.lineTo(-6, 12); ctx.lineTo(-2, 8);
            ctx.moveTo(4, 6); ctx.lineTo(6, 12); ctx.lineTo(2, 8);
            ctx.fill();

          } else if (name.includes('針コパースコーピオン')) {
            // === 「針コパースコーピオン」 (サソリ：ごつく) ===
            const tailWiggle = Math.sin(time / 120) * 8;
            ctx.fillStyle = '#b45309';

            // 胴体甲羅の筋彫り、ごつめのプレート調
            ctx.beginPath();
            ctx.roundRect(-12, -6, 24, 20, 6);
            ctx.fill();
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 甲羅の縞模様ディテール
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-10, -1); ctx.lineTo(10, -1);
            ctx.moveTo(-11, 4); ctx.lineTo(11, 4);
            ctx.stroke();

            // 太いサソリの尻尾 (反り返る棘)
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.moveTo(0, -4);
            ctx.quadraticCurveTo(-15 + tailWiggle, -22, tailWiggle, -28);
            ctx.stroke();

            // 猛毒トゲ (赤く輝く)
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(tailWiggle, -28, 4.5, 0, Math.PI * 2);
            ctx.fill();

            // 左右の大きめの強靭なハサミ
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            // 左
            ctx.moveTo(-8, 6);
            ctx.quadraticCurveTo(-22, -2, -18, -12);
            // 右
            ctx.moveTo(8, 6);
            ctx.quadraticCurveTo(22, -2, 18, -12);
            ctx.stroke();

            // ハサミの先端の爪
            ctx.fillStyle = '#78350f';
            ctx.beginPath();
            ctx.arc(-18, -12, 3.5, 0, Math.PI * 2);
            ctx.arc(18, -12, 3.5, 0, Math.PI * 2);
            ctx.fill();

          } else if (name.includes('砂漠の魔石兵')) {
            // === 「砂漠の魔石兵」 (ゴーレム：よりごつく) ===
            ctx.fillStyle = '#854d0e'; // 岩色
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 2.5;

            // 超ヘヴィなスクエアボディ
            ctx.beginPath();
            ctx.roundRect(-14, -16, 28, 32, 4);
            ctx.fill();
            ctx.stroke();

            // 古代のルーン的なひび割れ光線
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-8, -6); ctx.lineTo(-2, 2); ctx.lineTo(6, -2);
            ctx.stroke();

            // 重々しく浮遊する巨大な肩（左右対称）
            const shoulderHover = Math.sin(time / 100) * 3;
            ctx.fillStyle = '#a16207';
            ctx.beginPath();
            ctx.roundRect(-22, -12 + shoulderHover, 6, 18, 2);
            ctx.roundRect(16, -12 + shoulderHover, 6, 18, 2);
            ctx.fill();
            ctx.stroke();

            // 額に埋め込まれた古代魔術石
            ctx.fillStyle = '#fde047';
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 6;
            ctx.fillRect(-3, -11, 6, 6);
            ctx.shadowBlur = 0; // restore

          } else if (name.includes('獄炎') && name.includes('トカゲ')) {
            // === 「獄炎トカゲ」 (リザードマン：トカゲ人間っぽく劇的パワーアップ) ===
            // 呼吸に合わせて縦にスライド
            const valOsc = Math.sin(time / 110) * 2;
            
            // 1. 強靭な鱗のトカゲ人間胴体（逆三角形）
            ctx.fillStyle = '#b91c1c'; // 深い朱
            ctx.strokeStyle = '#450a0a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-12, 14);
            ctx.lineTo(-16, -6 + valOsc);
            ctx.lineTo(16, -6 + valOsc);
            ctx.lineTo(12, 14);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 2. 爬虫類的な尖った頭
            ctx.fillStyle = '#dc2626'; // 明るい赤
            ctx.beginPath();
            ctx.ellipse(0, -14 + valOsc, 9, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 頭頂部の炎タテガミ（棘トサカ）
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(-4, -26 + valOsc);
            ctx.lineTo(0, -36 + valOsc);
            ctx.lineTo(4, -26 + valOsc);
            ctx.lineTo(8, -32 + valOsc);
            ctx.lineTo(2, -22 + valOsc);
            ctx.lineTo(-8, -32 + valOsc);
            ctx.closePath();
            ctx.fill();

            // 両側の鋭い黄色の爬虫類スリット目
            ctx.fillStyle = '#facc15';
            ctx.fillRect(-5, -16 + valOsc, 2, 4);
            ctx.fillRect(3, -16 + valOsc, 2, 4);

            // 3. 炎が燃え盛るダイナミックなロングテール
            const tailSwing = Math.sin(time / 80) * 11;
            ctx.strokeStyle = '#ea580c';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(0, 10);
            ctx.quadraticCurveTo(tailSwing, 18, tailSwing * 1.6, 28);
            ctx.stroke();

            // 尻尾 of fire
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(tailSwing * 1.6, 28, 5, 0, Math.PI * 2);
            ctx.fill();

            // 4. 手にした「マグマ・ランス(溶岩の槍)」
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-18, 10);
            ctx.lineTo(-12, -26); // 槍の柄
            ctx.stroke();

            // 槍の先端（赤く燃えた鉱石刃）
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(-12, -26);
            ctx.lineTo(-15, -34);
            ctx.lineTo(-9, -34);
            ctx.closePath();
            ctx.fill();

          } else if (name.includes('マグマバット')) {
            // === 「マグマバット」 (コウモリ：もっとゴツい蝙蝠にパワーアップ) ===
            const wingSwing = Math.sin(time / 70) * 15;
            
            // 1. 岩石のような強固なゴツいコアボディ
            ctx.fillStyle = '#450a0a'; // マグマ色ダーク
            ctx.strokeStyle = '#1e0202';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 2, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 2. 爬虫類・コウモリを融合したゴツい耳
            ctx.fillStyle = '#7c2d12';
            ctx.beginPath();
            ctx.moveTo(-9, -6);
            ctx.lineTo(-16, -18);
            ctx.lineTo(-3, -10);
            ctx.moveTo(9, -6);
            ctx.lineTo(16, -18);
            ctx.lineTo(3, -10);
            ctx.closePath();
            ctx.fill();

            // 3. 複雑な骨組みの大きくて肉厚な魔翼 (Lava Wings)
            ctx.fillStyle = '#991b1b'; // 濃い溶岩赤
            ctx.strokeStyle = '#f97316'; // 縁がマグマで輝く
            ctx.lineWidth = 1.5;
            
            // 左翼
            ctx.beginPath();
            ctx.moveTo(-8, 2);
            ctx.lineTo(-28, -14 + wingSwing); // 翼端
            ctx.lineTo(-16, 8 + wingSwing * 0.5); // たわみ
            ctx.lineTo(-24, 18 + wingSwing * 0.3);
            ctx.lineTo(-6, 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 右翼
            ctx.beginPath();
            ctx.moveTo(8, 2);
            ctx.lineTo(28, -14 + wingSwing); // 翼端
            ctx.lineTo(16, 8 + wingSwing * 0.5); // たわみ
            ctx.lineTo(24, 18 + wingSwing * 0.3);
            ctx.lineTo(6, 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 4. 赤く燃える２つの恐ろしい巨眼
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(-4, -1, 3.5, 0, Math.PI * 2);
            ctx.arc(4, -1, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fde047'; // 黄金の瞳孔
            ctx.fillRect(-4.5, -2, 1, 2);
            ctx.fillRect(3.5, -2, 1, 2);

            // 突き出た大きな牙
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(-3, 5); ctx.lineTo(-4.5, 10); ctx.lineTo(-2, 7);
            ctx.moveTo(3, 5); ctx.lineTo(4.5, 10); ctx.lineTo(2, 7);
            ctx.fill();

            // 飛び散るマグマ粒子エフェクト
            ctx.fillStyle = 'rgba(249, 115, 22, 0.7)';
            ctx.fillRect(-12 + Math.random() * 24, 10 + Math.random() * 8, 2, 2);

          } else if (name.includes('フリーズスプライト')) {
            // === 「フリーズスプライト」 (氷妖精：さらにきらきらに) ===
            const fairyOsc = Math.sin(time / 150) * 4;
            ctx.fillStyle = '#22d3ee';

            // かわいい氷核
            ctx.beginPath();
            ctx.arc(0, fairyOsc, 8, 0, Math.PI * 2);
            ctx.fill();

            // きらめきオーラサークル
            ctx.strokeStyle = 'rgba(103, 232, 249, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, fairyOsc, 15, 0, Math.PI * 2);
            ctx.stroke();

            // 四枚の妖精結晶羽
            ctx.fillStyle = 'rgba(224, 242, 254, 0.75)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            // 上左
            ctx.ellipse(-14, -4 + fairyOsc, 11, 5, -Math.PI/3.5, 0, Math.PI*2);
            // 上右
            ctx.ellipse(14, -4 + fairyOsc, 11, 5, Math.PI/3.5, 0, Math.PI*2);
            // 下左
            ctx.ellipse(-10, 4 + fairyOsc, 8, 4, -Math.PI/6, 0, Math.PI*2);
            // 下右
            ctx.ellipse(10, 4 + fairyOsc, 8, 4, Math.PI/6, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();

            // 光る結晶の瞳
            ctx.fillStyle = '#ecfeff';
            ctx.fillRect(-3, fairyOsc - 2, 2, 2);
            ctx.fillRect(1, fairyOsc - 2, 2, 2);

          } else if (name.includes('極光結晶ゴーレム')) {
            // === 「極光結晶ゴーレム」 (氷晶トゲゴーレム：超かっこいい彫刻的結晶巨人にパワーアップ) ===
            const bodyOsc = Math.sin(time / 120) * 3;
            
            // ギザギザした結晶オーラが背後に回る
            ctx.save();
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#0e7490';
            ctx.strokeStyle = '#e0f2fe';
            ctx.lineWidth = 1.5;

            // 1. がっしりした結晶の肩アーマー（左右）
            ctx.beginPath();
            ctx.moveTo(-22, -10 + bodyOsc);
            ctx.lineTo(-14, -22 + bodyOsc);
            ctx.lineTo(-6, -10 + bodyOsc);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(22, -10 + bodyOsc);
            ctx.lineTo(14, -22 + bodyOsc);
            ctx.lineTo(6, -10 + bodyOsc);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 2. 六角形の重厚な結晶コア胸部
            ctx.fillStyle = '#0891b2'; // シアンコア
            ctx.beginPath();
            ctx.moveTo(0, -18 + bodyOsc);
            ctx.lineTo(13, -6 + bodyOsc);
            ctx.lineTo(13, 10 + bodyOsc);
            ctx.lineTo(0, 22 + bodyOsc);
            ctx.lineTo(-13, 10 + bodyOsc);
            ctx.lineTo(-13, -6 + bodyOsc);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // オーロラ光の屈折ディテール (光面)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.beginPath();
            ctx.moveTo(0, -18 + bodyOsc);
            ctx.lineTo(13, -6 + bodyOsc);
            ctx.lineTo(0, bodyOsc);
            ctx.closePath();
            ctx.fill();

            // 3. 浮遊する別パーツの結晶拳（アーム：ボディの横でゆらゆら動く）
            const fistSlide = Math.sin(time / 80) * 4;
            ctx.fillStyle = '#06b6d4';
            ctx.beginPath();
            ctx.roundRect(-26 - fistSlide, 2 + bodyOsc, 7, 7, 1);
            ctx.roundRect(19 + fistSlide, 2 + bodyOsc, 7, 7, 1);
            ctx.fill();
            ctx.stroke();

            // 4. 魔力が宿る、冷酷にシアンに光るツイン目
            ctx.fillStyle = '#cffafe';
            ctx.fillRect(-5, -6 + bodyOsc, 3, 2);
            ctx.fillRect(2, -6 + bodyOsc, 3, 2);

            // Shield Barrier effect override internally
            if ((enemy as any).hasShield) {
              const r = 26;
              ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
              ctx.fillStyle = 'rgba(34, 211, 238, 0.1)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              for (let h = 0; h < 6; h++) {
                const angle = (Math.PI * 2 / 6) * h + (time / 1000);
                const hx = Math.cos(angle) * r;
                const hy = Math.sin(angle) * r;
                if (h === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
              }
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }

            ctx.restore();

          } else if (name.includes('エンドレスビクター')) {
            // === 「エンドレスビクター」 (死神) ===
            const floatOsc = Math.sin(time / 140) * 4;
            
            // 深淵フードと死装束マント
            ctx.fillStyle = '#1e1b4b'; // ネイビーブラック
            ctx.strokeStyle = '#c084fc'; // 紫の縁取り
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-12, 14 + floatOsc);
            ctx.lineTo(0, -18 + floatOsc);
            ctx.lineTo(12, 14 + floatOsc);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 暗いフードの中
            ctx.fillStyle = '#090514';
            ctx.beginPath();
            ctx.arc(0, -2 + floatOsc, 6, 0, Math.PI * 2);
            ctx.fill();

            // 妖しく光るビクターアイ
            ctx.fillStyle = '#d8b4fe';
            ctx.fillRect(-3, -3 + floatOsc, 2, 2);
            ctx.fillRect(1, -3 + floatOsc, 2, 2);

            // 破壊的な死神の大鎌 (Death Scythe)
            ctx.strokeStyle = '#4b5563'; // 鎌の柄
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 14 + floatOsc);
            ctx.lineTo(-14, -28 + floatOsc);
            ctx.stroke();

            // 湾曲した巨大な紫光アーク刃
            ctx.strokeStyle = '#c084fc';
            ctx.fillStyle = 'rgba(192, 132, 252, 0.3)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-14, -28 + floatOsc);
            ctx.quadraticCurveTo(-34, -34 + floatOsc, -16, -42 + floatOsc);
            ctx.quadraticCurveTo(-10, -32 + floatOsc, -14, -28 + floatOsc);
            ctx.closePath();
            ctx.stroke();
            ctx.fill();

          } else if (name.includes('深淵虚黒這い')) {
            // === 「深淵虚黒這い」 (触手タコ型：さらに恐ろしく) ===
            const tentOsc = Math.sin(time / 100);
            
            // 混沌を帯びたコアオーラ
            ctx.fillStyle = '#0f051d';
            ctx.strokeStyle = '#581c87';
            ctx.lineWidth = 2;

            // 各種触手群 (合計4本に強化)
            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 3;
            ctx.beginPath();
            
            // 左下
            ctx.moveTo(-6, 2);
            ctx.quadraticCurveTo(-18 + tentOsc * 8, 14, -12 + tentOsc * 5, 24);
            // 右下
            ctx.moveTo(6, 2);
            ctx.quadraticCurveTo(18 - tentOsc * 8, 14, 12 - tentOsc * 5, 24);
            // 左上側
            ctx.moveTo(-8, -4);
            ctx.quadraticCurveTo(-24 - tentOsc * 6, -2, -20 - tentOsc * 4, 6);
            // 右上側
            ctx.moveTo(8, -4);
            ctx.quadraticCurveTo(24 + tentOsc * 6, -2, 20 + tentOsc * 4, 6);
            
            ctx.stroke();

            // 漆黒球体メインコア
            ctx.fillStyle = '#1e1b4b';
            ctx.beginPath();
            ctx.arc(0, -3, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 中心に光る深淵の大きな赤色魔眼
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, -3, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.arc(0, -3, 3, 0, Math.PI * 2);
            ctx.fill();

          } else {
            // === デフォルト / 鍵守（黄金の極光など） の一般的な装飾 ===
            ctx.fillStyle = enemy.color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height, 4);
            ctx.fill();
            ctx.stroke();

            // コア輝き
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(0, 0, enemy.width * 0.25, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();

        // Monster Health Bar above head
        const barW = enemy.width + 12;
        const barH = 5;
        const bx = enemy.x + (enemy.width - barW) / 2;
        const by = enemy.y - 12;

        ctx.fillStyle = '#374151';
        ctx.fillRect(bx, by, barW, barH);

        const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = isBoss ? '#dc2626' : '#22c55e';
        ctx.fillRect(bx, by, barW * hpRatio, barH);
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, by, barW, barH);

        // Mob name text
        ctx.fillStyle = isBoss ? activeArea.accentColor : '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(enemy.name, bx, by - 6);
      });

      // Render Player Character (Adventurer)
      ctx.save();
      ctx.translate(player.x + player.width / 2, player.y + player.height / 2);

      // Play soft body bounce
      const playerPulseY = Math.sin(Date.now() / 180) * 0.04;
      ctx.scale(1, 1 + playerPulseY);

      // Shadow under feet
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, player.height / 2 - 2, player.width * 0.65, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Damage Red-flash if hurt recently (600ms)
      const hurtSince = Date.now() - player.lastHurtTime;
      if (hurtSince < 600) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
      }

      // Draw Trousers (ズボン)
      ctx.fillStyle = equippedPants.color;
      ctx.fillRect(-player.width / 2 + 2, player.height / 2 - 10, player.width - 4, 8);

      // Draw Armor / Torso / Body (鎧)
      ctx.fillStyle = equippedArmor.color;
      ctx.fillRect(-player.width / 2, -player.height / 2 + 10, player.width, player.height - 18);

      // Draw Head / Face skin
      ctx.fillStyle = '#fbcfe8'; // Chibi pink skin
      ctx.fillRect(-player.width / 2 + 3, -player.height / 2 - 2, player.width - 6, 12);

      // Eyes based on facing direction
      ctx.fillStyle = '#111827';
      if (player.dir === 'right') {
        ctx.fillRect(5, -1, 3, 4);
        ctx.fillRect(11, -1, 3, 4);
      } else if (player.dir === 'left') {
        ctx.fillRect(-13, -1, 3, 4);
        ctx.fillRect(-7, -1, 3, 4);
      } else {
        ctx.fillRect(-4, -1, 3, 4);
        ctx.fillRect(4, -1, 3, 4);
      }

      // Draw Hat (帽子)
      ctx.fillStyle = equippedHat.color;
      ctx.beginPath();
      ctx.moveTo(-player.width / 2 - 4, -player.height / 2 - 1);
      ctx.lineTo(player.width / 2 + 4, -player.height / 2 - 1);
      ctx.lineTo(0, -player.height / 2 - 18);
      ctx.closePath();
      ctx.fill();
      
      // Feather plume on hat based on rarity
      if (equippedHat.rarity === 'legendary') {
        ctx.fillStyle = '#fbbf24';// Golden feather
        ctx.fillRect(0, -player.height / 2 - 22, 4, 6);
      }

      // Draw Held Weapon (剣 / Sword graphics)
      ctx.save();
      // Position weapon corresponding to facing direction
      let wx = 0, wy = 0, wAngle = 0;
      if (player.dir === 'right') { wx = 15; wy = 4; wAngle = Math.PI / 4; }
      else if (player.dir === 'left') { wx = -15; wy = 4; wAngle = -Math.PI / 4; }
      else if (player.dir === 'up') { wx = -10; wy = -14; wAngle = -Math.PI / 6; }
      else { wx = 10; wy = 12; wAngle = Math.PI * 1.2; }

      ctx.translate(wx, wy);
      ctx.rotate(wAngle);

      // Blade color
      ctx.fillStyle = equippedSword.color;
      ctx.fillRect(-2, -22, 4, 18); // Sword blade

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(-2, -22, 4, 18);

      // Guard
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-5, -4, 10, 3);
      // Handle
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-1.5, -1, 3, 5);

      ctx.restore();

      // Active attack crescent visual arc sweep
      if (player.isAttacking) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 10;

        ctx.beginPath();
        // Draw dramatic slash curves
        if (player.dir === 'right') {
          ctx.arc(0, 0, 48, -Math.PI / 3, Math.PI / 3);
        } else if (player.dir === 'left') {
          ctx.arc(0, 0, 48, Math.PI * 0.7, Math.PI * 1.3);
        } else if (player.dir === 'up') {
          ctx.arc(0, 0, 48, -Math.PI * 0.8, -Math.PI * 0.2);
        } else {
          ctx.arc(0, 0, 48, Math.PI * 0.2, Math.PI * 0.8);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Render Web Debuff overlays if slowed down by Web (player.speed === 1.2)
      if (player.speed === 1.2) {
        ctx.save();
        ctx.strokeStyle = 'rgba(241, 245, 249, 0.85)';
        ctx.lineWidth = 1.5;

        // プレイヤーの体に絡み合うクモの巣の糸を幾何学的に描画
        ctx.beginPath();
        // 斜め糸
        ctx.moveTo(-player.width / 2 - 2, -player.height / 2 + 5);
        ctx.lineTo(player.width / 2 + 2, player.height / 2 - 5);
        ctx.moveTo(player.width / 2 + 2, -player.height / 2 + 5);
        ctx.lineTo(-player.width / 2 - 2, player.height / 2 - 5);
        // 横糸
        ctx.moveTo(-player.width / 2 - 1, 0);
        ctx.lineTo(player.width / 2 + 1, 0);
        ctx.moveTo(-player.width / 2 + 2, -10);
        ctx.lineTo(player.width / 2 - 2, -10);
        ctx.stroke();

        // 頭上にデバフ表示として絵文字
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🕷🕸', 0, -player.height / 2 - 24);

        ctx.restore();
      }

      // Render Poison Debuff overlays if poisoned
      if ((player as any).poisonDuration > 0) {
        ctx.save();
        // プレイヤーの足元や周りに怪しい紫色の毒オーラを描く
        const scaleVal = 1 + Math.sin(Date.now() / 100) * 0.08;
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, player.height / 2 - 2, player.width * 0.8 * scaleVal, 6 * scaleVal, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 泡（ドット）が上に上昇するように描画
        ctx.fillStyle = '#c084fc';
        for (let i = 0; i < 3; i++) {
          const bubbleY = (Date.now() / 4 + i * 20) % (player.height + 10) - (player.height / 2);
          const bubbleX = Math.sin(Date.now() / 150 + i) * (player.width / 2.2);
          ctx.beginPath();
          ctx.arc(bubbleX, -bubbleY, 2 + (i % 2), 0, Math.PI * 2);
          ctx.fill();
        }

        // 頭上にデバフ表示として絵文字 (他デバフと重ならないようにオフセット)
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        const offsetY = player.speed === 1.2 ? -42 : -24;
        ctx.fillText('🧪💀', 0, -player.height / 2 + offsetY);

        ctx.restore();
      }

      // Render Burn Debuff overlays if burning
      if ((player as any).burnDuration > 0) {
        ctx.save();
        // プレイヤーの体を包むようなメラメラした炎
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 1.5;
        const timeFactor = Date.now() / 80;

        ctx.beginPath();
        for (let i = -2; i <= 2; i++) {
          const fx = (player.width / 4) * i;
          const h = 15 + Math.sin(timeFactor + i) * 8;
          ctx.moveTo(fx, player.height / 2);
          ctx.quadraticCurveTo(fx + Math.cos(timeFactor + i) * 5, player.height / 2 - h / 2, fx, player.height / 2 - h);
        }
        ctx.stroke();

        // 頭上にデバフ表示 (重ならないようにオフセット)
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        let offsetY = -24;
        if (player.speed === 1.2) offsetY -= 18;
        if ((player as any).poisonDuration > 0) offsetY -= 18;
        ctx.fillText('🔥', 0, -player.height / 2 + offsetY);

        ctx.restore();
      }

      // Render Freeze Debuff overlay (solid translucent block of ice surrounding player)
      if ((player as any).freezeDuration > 0) {
        ctx.save();
        
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 10;
        
        // Solid translucent ice block
        ctx.fillStyle = 'rgba(165, 243, 252, 0.45)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        
        const iceW = player.width + 10;
        const iceH = player.height + 10;
        ctx.fillRect(-iceW / 2, -iceH / 2, iceW, iceH);
        ctx.strokeRect(-iceW / 2, -iceH / 2, iceW, iceH);
        
        // Frozen crystalline internal lines (visual cracks)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(-iceW / 2 + 4, -iceH / 2 + 6);
        ctx.lineTo(iceW / 2 - 6, iceH / 2 - 8);
        ctx.moveTo(iceW / 2 - 4, -iceH / 2 + 10);
        ctx.lineTo(-iceW / 2 + 8, iceH / 2 - 4);
        ctx.stroke();

        // 🧊❄️ emoji overhead
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        let offsetY = -24;
        if (player.speed === 1.2) offsetY -= 18;
        if ((player as any).poisonDuration > 0) offsetY -= 18;
        if ((player as any).burnDuration > 0) offsetY -= 18;
        ctx.fillText('❄️🧊', 0, -player.height / 2 + offsetY);

        ctx.restore();
      }

      // Render Fire Boost Aura overlay (swirling orange/gold circles around feet and glowing body)
      if ((gameRef.current as any).boostDuration > 0) {
        ctx.save();
        
        // Heat circles on ground
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.8)';
        ctx.lineWidth = 2.0;
        
        const scale = 1.0 + Math.sin(Date.now() / 80) * 0.15;
        ctx.beginPath();
        ctx.ellipse(0, player.height / 2 - 2, player.width * 0.9 * scale, 6 * scale, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Flame sparks inside aura
        ctx.fillStyle = '#f97316';
        const particleSeed = Math.sin(Date.now() / 150);
        ctx.beginPath();
        ctx.arc(-player.width / 2, -10 + particleSeed * 5, 2, 0, Math.PI * 2);
        ctx.arc(player.width / 2, 5 - particleSeed * 5, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      ctx.restore(); // player
      ctx.shadowBlur = 0;

      // Draw global Boss Banner HUD at top center if boss spawns here
      const checkBoss = gameRef.current.enemies.find(e => e.type === 'boss');
      if (checkBoss) {
        const topBarW = 400;
        const topBarH = 14;
        const tx = (CANVAS_WIDTH - topBarW) / 2;
        const ty = 45;

        // Black outline
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(tx - 4, ty - 22, topBarW + 8, topBarH + 28);
        
        ctx.strokeStyle = activeArea.accentColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(tx - 4, ty - 22, topBarW + 8, topBarH + 28);

        // Name
        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`⚠ エリアボス： ${checkBoss.name} ⚠`, CANVAS_WIDTH / 2, ty - 6);

        // Boss hp
        ctx.fillStyle = '#475569';
        ctx.fillRect(tx, ty, topBarW, topBarH);

        const bRatio = Math.max(0, checkBoss.hp / checkBoss.maxHp);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(tx, ty, topBarW * bRatio, topBarH);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, topBarW, topBarH);

        // Ratio text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${checkBoss.hp} / ${checkBoss.maxHp}`, CANVAS_WIDTH / 2, ty + 11);
        ctx.textAlign = 'left';
      }

      // Render Particles
      gameRef.current.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });
      ctx.globalAlpha = 1.0;

      // Render floating damage texts
      gameRef.current.floatingTexts.forEach(txt => {
        ctx.fillStyle = txt.color;
        ctx.globalAlpha = txt.alpha;
        ctx.font = txt.fontSize || 'bold 14px monospace';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(txt.text, txt.x, txt.y);
        ctx.shadowBlur = 0;
      });
      ctx.globalAlpha = 1.0;

      // Render boss room gating warning centered card
      if (gameRef.current.gateAlertTimer > 0) {
        ctx.save();
        
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'; // Slate dark solid card
        ctx.strokeStyle = '#ef4444'; // Rose red border
        ctx.lineWidth = 3;
        
        const rectW = 450;
        const rectH = 105;
        const rectX = (CANVAS_WIDTH - rectW) / 2;
        const rectY = (CANVAS_HEIGHT - rectH) / 2 - 30;
        
        ctx.beginPath();
        ctx.roundRect(rectX, rectY, rectW, rectH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 5;
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 15px sans-serif';
        const activeArea = gameRef.current.area;
        if (activeArea === 1) {
          ctx.fillText('🛡️ ボスエリアに入るには試練の突破が必要です！', CANVAS_WIDTH / 2, rectY + 38);
        } else if (activeArea === 2) {
          ctx.fillText('🛡️ ボスエリアに入るには鍵が必要です！', CANVAS_WIDTH / 2, rectY + 38);
        } else {
          ctx.fillText('🛡️ 門は閉ざされています！', CANVAS_WIDTH / 2, rectY + 38);
        }

        const blink = Math.floor(Date.now() / 200) % 2 === 0;
        ctx.fillStyle = blink ? '#fbbf24' : '#facc15';
        ctx.font = 'bold 18px sans-serif';
        if (activeArea === 1) {
          ctx.fillText(`【 敵を 10 体倒そう！ (${gameRef.current.areaKills} / 10) 】`, CANVAS_WIDTH / 2, rectY + 74);
        } else if (activeArea === 2) {
          ctx.fillText('【 鍵が必要 輝きし敵を倒せ 】', CANVAS_WIDTH / 2, rectY + 74);
        } else {
          ctx.fillText('【 すぐに開門されます 】', CANVAS_WIDTH / 2, rectY + 74);
        }

        ctx.restore();
      }

      ctx.restore(); // screenShake
    };

    // Begin looping
    animationId = requestAnimationFrame(gameLoop);

    return () => {
      active = false;
      cancelAnimationFrame(animationId);
    };
  }, [equippedHat, equippedArmor, equippedPants, equippedSword, isGameOver, hasWonFinal, isBagOpen]);

  // Handle D-Pad Click Events for Mobile/Mouse players
  const handleVirtualDirPress = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (isBagOpen || gameRef.current.isBagOpen) return;
    const keys = gameRef.current.keys;
    // Clear other directions
    keys['w'] = false; keys['arrowup'] = false;
    keys['s'] = false; keys['arrowdown'] = false;
    keys['a'] = false; keys['arrowleft'] = false;
    keys['d'] = false; keys['arrowright'] = false;

    if (dir === 'up') keys['w'] = true;
    if (dir === 'down') keys['s'] = true;
    if (dir === 'left') keys['a'] = true;
    if (dir === 'right') keys['d'] = true;

    // Release after brief time
    setTimeout(() => {
      if (dir === 'up') keys['w'] = false;
      if (dir === 'down') keys['s'] = false;
      if (dir === 'left') keys['a'] = false;
      if (dir === 'right') keys['d'] = false;
    }, 180);
  };

  // Reset entire quest from scratch
  const handleFullReset = () => {
    const defaultHat = getDefaultEquipment().hat;
    const defaultArmor = getDefaultEquipment().armor;
    const defaultPants = getDefaultEquipment().pants;
    const defaultSword = getDefaultEquipment().sword;

    // React resets
    setCurrentArea(1);
    setPlayerLevel(1);
    setPlayerHP(100);
    setPlayerMaxHP(100);
    setPlayerExp(0);
    setPlayerKills(0);
    setCurrentGold(0);
    setEquippedHat(defaultHat);
    setEquippedArmor(defaultArmor);
    setEquippedPants(defaultPants);
    setEquippedSword(defaultSword);
    setInventory([defaultHat, defaultArmor, defaultPants, defaultSword]);
    setSelectedItem(null);
    setScreenCoordinates({ x: 0, y: 0 });
    setIsGameOver(false);
    setHasWonFinal(false);

    // Ref state resets
    gameRef.current.area = 1;
    gameRef.current.player.level = 1;
    gameRef.current.player.hp = 100;
    gameRef.current.player.maxHp = 100;
    gameRef.current.player.baseAtk = 10;
    gameRef.current.player.baseDef = 2;
    gameRef.current.player.exp = 0;
    gameRef.current.player.kills = 0;
    gameRef.current.player.gold = 0;
    gameRef.current.player.screenX = 0;
    gameRef.current.player.screenY = 0;
    gameRef.current.player.x = 150;
    gameRef.current.player.y = 240;
    gameRef.current.player.speed = 3;
    (gameRef.current.player as any).poisonDuration = 0;
    (gameRef.current.player as any).poisonTick = 0;
    (gameRef.current.player as any).burnDuration = 0;
    (gameRef.current.player as any).burnTick = 0;
    if ((gameRef.current.player as any).speedTimer) {
      clearTimeout((gameRef.current.player as any).speedTimer);
      (gameRef.current.player as any).speedTimer = null;
    }
    gameRef.current.portal.active = false;
    gameRef.current.bossSpawned = false;
    gameRef.current.enemies = [];
    gameRef.current.projectiles = [];
    gameRef.current.dropItems = [];
    gameRef.current.particles = [];
    gameRef.current.floatingTexts = [];

    initAreaGimmick(1);
    spawnMobsForCurrentScreen(1, 0, 0);
    setGameLog(['ゲームが初期化されました！ 新生なる草原(0, 0)から再冒険スタート！']);
    gameAudio.playCollect();
  };

  // Toggle Test Play Mode
  const toggleTestPlayMode = () => {
    const nextVal = !testPlayMode;
    setTestPlayMode(nextVal);
    gameRef.current.testPlayMode = nextVal;
    if (nextVal) {
      addLog("🛡️ 【テストプレイモード有効】: 攻撃が「一撃必殺（極大ダメージ）」になり、敵のあらゆる攻撃に対して「完全無敵」になります！");
      gameAudio.playPortal();
    } else {
      addLog("⚠️ 【テストプレイモード無効】: 通常の難易度に戻りました。");
      gameAudio.playCollect();
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col font-sans p-3 md:p-6 selection:bg-[#7e22ce] selection:text-white">
      {/* Upper Navigation & Headers */}
      <header className="max-w-7xl w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-800 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-[#4a044e] p-2.5 rounded-lg border border-[#a21caf] shadow-md shadow-[#d946ef]/10">
            <Trophy className="w-7 h-7 text-[#f0abfc] animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>冒険者と5つの世界</span>
              <span className="text-xs py-0.5 px-2 rounded-full bg-[#701a75] text-[#f0abfc] border border-[#a21caf] font-mono">
                v2.0 Client-Auth RPG
              </span>
            </h1>
            <p className="text-xs text-gray-400">各地を旅して強力な装備をハントしよう！3x3画面を探索してポータルを目指せ！</p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2.5 bg-[#161b2c] p-2 rounded-lg border border-gray-800">
          <button
            onClick={toggleTestPlayMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border transition duration-200 ${
              testPlayMode 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse' 
                : 'bg-gray-800/60 hover:bg-gray-700/80 border-gray-700 text-gray-300'
            }`}
            title="テストプレイ用モード：一撃必殺 ＆ 被ダメージ完全無効(無敵) を切り替えます"
          >
            <Sparkles className={`w-3.5 h-3.5 ${testPlayMode ? 'text-amber-400 rotate-12' : 'text-gray-400'}`} />
            <span>テストプレイ {testPlayMode ? 'ON (無敵&一撃)' : 'OFF'}</span>
          </button>

          <button 
            onClick={handleSoundToggle}
            className="p-1.5 rounded bg-[#1e293b] hover:bg-gray-700 hover:text-white border border-gray-700 transition"
            title={soundOn ? "ミュートする" : "音声を有効化"}
          >
            {soundOn ? <Volume2 className="w-5 h-5 text-green-400" /> : <VolumeX className="w-5 h-5 text-gray-500" />}
          </button>

          <button 
            onClick={handleFullReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800 text-red-300 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>完全リセット</span>
          </button>
        </div>
      </header>

      {/* Main Container Dashboard */}
      <main className="max-w-4xl w-full mx-auto flex flex-col gap-5 flex-1 items-stretch">

        {/* MIDDLE COLUMN: ACTIVE RETRO ARCADE SCREEN CANVAS */}
        <section className="flex flex-col gap-4">
          
          {/* Game cabinet container bezel framing */}
          <div className="bg-[#1f2937] p-2.5 rounded-2xl border-4 border-gray-700 shadow-xl shadow-black/80 relative overflow-hidden">
            
            {/* Stage title bezel highlight */}
            <div className="bg-gray-900 border border-gray-800 rounded px-4 py-2.5 mb-2 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-500 animate-pulse" />
                <div>
                  <span className="text-gray-400 text-[10px] block font-mono">CURRENT AREA INDEX {currentArea}/5</span>
                  <span className="text-white font-bold text-sm tracking-wide">{AREAS[currentArea].name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                {currentArea === 1 && (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded border transition-all ${
                    areaKills >= 10 
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-sans shadow shadow-emerald-500/20' 
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse font-sans'
                  }`}>
                    <Skull className="w-3.5 h-3.5 text-red-400" />
                    <span>{areaKills >= 10 ? '討伐試練 達成完了！' : `試練: 敵を倒せ (${areaKills}/10)`}</span>
                  </div>
                )}
                {currentArea === 2 && (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded border transition-all ${
                    hasAreaKey 
                      ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400 font-sans shadow shadow-yellow-500/20' 
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse font-sans'
                  }`}>
                    <Key className="w-3.5 h-3.5 text-yellow-400" />
                    <span>{hasAreaKey ? 'ボス門 of 鍵 所持' : '輝きし鍵 捜索中'}</span>
                  </div>
                )}
                {currentArea !== 2 && (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded border transition-all ${
                    carrierDefeated 
                      ? 'bg-purple-950/80 border-purple-800 text-purple-300' 
                      : 'bg-indigo-950/80 border-indigo-800 text-indigo-300'
                  }`}>
                    <Sparkles className={`w-3.5 h-3.5 ${carrierDefeated ? 'text-purple-400' : 'text-indigo-400 animate-pulse'}`} />
                    <span>{carrierDefeated ? '輝きし敵 撃破' : '✨輝きし強敵(レア装備) 生息'}</span>
                  </div>
                )}
                <div className="text-xs bg-red-950/80 text-rose-300 font-mono border border-red-800 px-2 py-0.5 rounded">
                  Boss at (2, 2)
                </div>
              </div>
            </div>

            {/* Main Canvas Viewport Area */}
            <div className="relative aspect-[800/480] bg-gray-950 rounded-lg overflow-hidden border-2 border-gray-950">
              <canvas 
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="w-full h-full block bg-black"
                title="Adventurer Active Action Screen"
              />

              {/* HUD OVERLAY: Top-Left (Mini-map) and Top-Right (HP, GOLD, ATK, DEF) */}
              {!isGameOver && !hasWonFinal && !isBagOpen && (
                <>
                  {/* Left HUD: Compact 3x3 World Minimap */}
                  <div id="hud-minimap-left" className="absolute top-3 left-3 z-10 flex flex-col bg-slate-950/85 backdrop-blur-sm p-1.5 rounded-lg border border-slate-850 shadow-lg shadow-black/30 select-none animate-fade-in pointer-events-none">
                    <div className="text-[8px] text-gray-400 font-bold mb-1 tracking-wider uppercase flex items-center justify-between gap-1 w-[56px]">
                      <span className="flex items-center gap-0.5"><Compass className="w-2 h-2 text-amber-500" />MAP</span>
                      <span className="font-mono text-amber-500">[{screenCoordinates.x},{screenCoordinates.y}]</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 w-[56px] h-[56px]">
                      {[0, 1, 2].map(y => (
                        [0, 1, 2].map(x => {
                          const isActive = screenCoordinates.x === x && screenCoordinates.y === y;
                          const isBossRoom = x === 2 && y === 2;
                          
                          return (
                            <div 
                              key={`${x}-${y}`}
                              className={`w-4 h-4 rounded-[2px] border flex items-center justify-center relative ${
                                isActive 
                                  ? 'bg-purple-600/90 border-purple-400 shadow-sm shadow-purple-500/25 ring-1 ring-purple-400/40' 
                                  : isBossRoom
                                    ? 'bg-rose-950/60 border-rose-800'
                                    : 'bg-slate-900/60 border-slate-800'
                              }`}
                            >
                              {isActive && (
                                <span className="text-[7.5px] leading-none">🧙</span>
                              )}
                              {isBossRoom && !isActive && (
                                <Skull className="w-1.5 h-1.5 text-rose-500/90" />
                              )}
                            </div>
                          );
                        })
                      ))}
                    </div>
                  </div>

                  {/* Right HUD: HP, Gold, Attack, and Defense (Stacked) */}
                  <div id="hud-stats-right" className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 bg-slate-950/85 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-850 text-[11px] font-mono font-bold text-white shadow-lg shadow-black/30 select-none animate-fade-in pointer-events-none">
                    {/* Top part: HP & Gold */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1 min-w-[75px]">
                        <div className="flex justify-between items-center text-[9px]">
                          <span className="text-emerald-400 font-bold flex items-center gap-0.5">❤️ HP</span>
                          <span>{playerHP}/{playerMaxHP}</span>
                        </div>
                        <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                          <div 
                            className="h-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${Math.max(0, Math.min(100, (playerHP / playerMaxHP) * 100))}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-px h-4 bg-slate-800" />
                      <div className="flex items-center gap-1 text-yellow-400">
                        <span>💰</span>
                        <span className="font-extrabold text-yellow-300 font-sans">{currentGold}</span>
                        <span className="text-[9px] text-yellow-500/80">G</span>
                      </div>
                    </div>

                    {/* Separator */}
                    <div className="w-full h-px bg-slate-800/60" />

                    {/* Bottom part: ATK & DEF */}
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-1">
                        <Sword className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-gray-400 text-[9px]">ATK:</span>
                        <span className="text-orange-400 font-extrabold">{coreStats.atk}</span>
                      </div>
                      <div className="w-px h-3 bg-slate-800" />
                      <div className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-[#38bdf8]" />
                        <span className="text-gray-400 text-[9px]">DEF:</span>
                        <span className="text-[#38bdf8] font-extrabold">{coreStats.def}</span>
                      </div>
                    </div>

                    {/* Boost Duration gauge */}
                    {boostTimeLeft > 0 && (
                      <>
                        <div className="w-full h-px bg-slate-800/60" />
                        <div className="flex flex-col gap-0.5 w-full text-[9.5px]">
                          <div className="flex justify-between items-center text-orange-400 font-extrabold animate-pulse">
                            <span className="flex items-center gap-0.5">🔥 BOOST MODE</span>
                            <span>{boostTimeLeft}s</span>
                          </div>
                          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-orange-500/20">
                            <div 
                              className="h-full bg-gradient-to-r from-orange-600 to-amber-400 transition-all duration-100 ease-linear"
                              style={{ width: `${(boostTimeLeft / 60) * 100}%` }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Center HUD: Adventurer Level & Required Exp */}
                  <div id="hud-stats-center" className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center bg-slate-950/85 backdrop-blur-sm px-3.5 py-1.5 rounded-lg border border-slate-850 text-[11px] font-mono font-bold text-white shadow-lg shadow-black/30 select-none animate-fade-in pointer-events-none min-w-[140px]">
                    <div className="flex items-center gap-1.5 justify-center mb-0.5">
                      <span className="text-purple-400 font-extrabold flex items-center gap-0.5">⭐ Lv.{playerLevel}</span>
                      <span className="text-slate-600 font-normal">|</span>
                      <span className="text-blue-400">EXP</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800/50 flex relative">
                      <div 
                        className="bg-blue-500 h-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (playerExp / (playerLevel * 80 + 50)) * 100)}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-gray-400 mt-1 font-mono text-center">
                      {playerExp} / {playerLevel * 80 + 50}
                    </div>
                  </div>
                </>
              )}

              {/* OVERLAY: Game Over */}
              {isGameOver && (
                <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm z-30 animate-fade-in">
                  <div className="text-rose-500 text-6xl mb-3 drop-shadow-[0_4px_12px_rgba(244,63,94,0.4)] animate-bounce font-mono">GAME OVER</div>
                  <p className="text-gray-300 font-medium mb-1">冒険者は途中で力尽きてしまった！</p>
                  <p className="text-xs text-gray-400 max-w-sm mb-6">しかし、これまでの旅で得た装備や成長レベルは維持されます。さらに強化をしてボスの討伐に臨みましょう！</p>
                  <button 
                    onClick={handleRespawn}
                    className="flex items-center gap-2 px-6 py-3 font-bold text-white bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 rounded-lg shadow-lg border border-red-500 hover:scale-105 active:scale-95 transition flex-row"
                  >
                    <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
                    <span>草原(0,0)より復活する</span>
                  </button>
                </div>
              )}

              {/* OVERLAY: Final Victory Game Completed */}
              {hasWonFinal && (
                <div className="absolute inset-0 bg-gradient-to-b from-[#12072b]/95 to-[#090314]/98 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm z-30">
                  <div className="w-20 h-20 bg-[#f59e0b]/10 rounded-full border border-yellow-500 flex items-center justify-center mb-4 shadow-lg shadow-yellow-500/20">
                    <Trophy className="w-12 h-12 text-[#fbbf24] animate-pulse" />
                  </div>
                  <h2 className="text-[#fbbf24] text-4xl font-extrabold mb-1 drop-shadow-md">CONGRATULATIONS!!</h2>
                  <h3 className="text-white text-xl font-bold mb-3">🌌 5つの世界を完全制覇 🌌</h3>
                  <p className="text-xs text-gray-300 max-w-md mb-6 leading-relaxed flex flex-col items-center">
                    <span>見事、深淵の終焉王「アビスヘクス」を打ち破り、すべてのエリアポータルを突破しました！</span>
                    <span>世界の秩序は守られ、あなたの名は英雄として永久に語り継がれるでしょう！</span>
                  </p>
                  
                  {/* Hero Stats summary box */}
                  <div className="bg-[#1e1b4b] border border-[#4338ca] p-4 rounded-lg w-full max-w-xs text-left mb-6 text-xs font-mono">
                    <div className="text-[#a5b4fc] text-center font-bold border-b border-[#312e81] pb-1.5 mb-2">🏆 英雄の戦績記録</div>
                    <div className="flex justify-between py-1 border-b border-gray-800"><span className="text-gray-400">到達最高レベル :</span> <span className="text-white font-bold">Lvl {playerLevel}</span></div>
                    <div className="flex justify-between py-1 border-b border-gray-800"><span className="text-gray-400">魔物討伐数 :</span> <span className="text-white font-bold">{playerKills} 匹</span></div>
                    <div className="flex justify-between py-1 border-b border-gray-800"><span className="text-gray-400">所持金額 :</span> <span className="text-yellow-400 font-bold">{currentGold} G</span></div>
                    <div className="flex justify-between py-1"><span className="text-gray-400">最強武器 :</span> <span className="text-orange-400 font-bold truncate max-w-[130px]">{equippedSword.name}</span></div>
                  </div>

                  <button 
                    onClick={handleFullReset}
                    className="px-6 py-2.5 font-bold text-gray-950 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-lg hover:from-yellow-300 hover:to-amber-400 shadow-lg hover:shadow-yellow-500/10 active:scale-95 transition"
                  >
                    ニューゲーム (NG+ でやり直す)
                  </button>
                </div>
              )}

              {/* OVERLAY: Bag / Backpack */}
              {isBagOpen && (
                <div className="absolute inset-0 bg-slate-950/94 backdrop-blur-md flex flex-col p-4 z-20 select-none animate-fade-in text-white/95">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-purple-900/60 pb-2 mb-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-purple-950/80 flex items-center justify-center border border-purple-500/50">
                        <Backpack className="w-4 h-4 text-purple-400 animate-pulse" />
                      </div>
                      <div>
                        <h2 className="text-xs font-bold tracking-wide flex items-center gap-1">
                          <span>🎒 冒険者のバッグ</span>
                          <span className="text-[9px] px-1 bg-purple-950 text-purple-400 border border-purple-800 rounded font-mono font-normal">GAME PAUSED</span>
                        </h2>
                        <div className="text-[9px] text-gray-500 font-mono">計 {inventory.length} 個の装備品</div>
                      </div>
                    </div>
                    
                    {/* Gold indicator */}
                    <div className="flex items-center gap-2.5">
                      <div className="bg-gray-900/80 px-2.5 py-0.5 rounded border border-yellow-600/30 text-[10px] font-mono flex items-center gap-1">
                        <span className="text-yellow-400 font-bold">💰 所持金:</span>
                        <span className="text-yellow-300 font-bold font-mono">{currentGold} G</span>
                      </div>
                      <button
                        onClick={() => {
                          setIsBagOpen(false);
                          gameRef.current.isBagOpen = false;
                          gameRef.current.keys = {};
                          gameAudio.playCollect();
                        }}
                        className="text-gray-400 hover:text-white transition bg-gray-900 hover:bg-gray-800 border border-gray-800 px-2 py-0.5 text-[10px] font-bold rounded"
                      >
                        閉じる [×]
                      </button>
                    </div>
                  </div>

                  {/* Two Column Layout: inventory List vs item Detail */}
                  <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden min-h-0 text-xs">
                    
                    {/* Left Column: Scrollable Items List (Divided into Equipment List and Item List) */}
                    <div className="col-span-7 flex flex-col gap-3 overflow-hidden min-h-0">
                      
                      {/* Equipment List Section */}
                      <div className="flex-1 bg-gray-950/80 rounded-lg border border-gray-900 p-2 flex flex-col overflow-hidden min-h-0">
                        <div className="text-[9px] text-purple-400 font-bold mb-1.5 uppercase tracking-wider border-b border-purple-950/60 pb-1 flex items-center justify-between shrink-0">
                          <span>🛡️ 装備品一覧</span>
                          <span className="text-[8px] font-mono font-normal text-gray-500">計 {inventory.filter(item => item.type !== 'potion').length} 個</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 min-h-0">
                          {inventory.filter(item => item.type !== 'potion').slice().reverse().map(item => {
                            const isEquipped = (
                              item.id === equippedHat.id || 
                              item.id === equippedArmor.id || 
                              item.id === equippedPants.id || 
                              item.id === equippedSword.id
                            );

                            const borderStyle = 
                              item.rarity === 'legendary' ? 'border-yellow-500/30 bg-yellow-950/10' :
                              item.rarity === 'epic' ? 'border-purple-500/30 bg-purple-950/10' :
                              item.rarity === 'rare' ? 'border-blue-500/30 bg-blue-950/10' :
                              'border-gray-800 bg-gray-900/30';

                            const rarityText =
                              item.rarity === 'legendary' ? 'text-yellow-400 font-bold' :
                              item.rarity === 'epic' ? 'text-purple-400 font-bold' :
                              item.rarity === 'rare' ? 'text-blue-400 font-bold' :
                              'text-gray-300';

                            return (
                              <div 
                                key={item.id}
                                onClick={() => setSelectedItem(item)}
                                className={`p-1.5 rounded text-[10px] transition cursor-pointer flex items-center justify-between border ${borderStyle} ${
                                  selectedItem?.id === item.id 
                                    ? 'ring-1 px-2 border-purple-500 bg-purple-950/20' 
                                    : 'hover:border-purple-500/45'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span 
                                    className="w-1.5 h-6 rounded shrink-0 shadow" 
                                    style={{ backgroundColor: item.color }}
                                  ></span>

                                  <div className="truncate flex-1">
                                    <span className={`block truncate ${rarityText}`}>
                                      {item.name}
                                    </span>
                                    <span className="text-[9px] text-gray-500 font-mono">
                                      {item.type === 'hat' ? '👒頭' : item.type === 'armor' ? '🥋胴' : item.type === 'pants' ? '👖脚' : '⚔️武'}: +{item.statValue}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {isEquipped ? (
                                    <span className="text-[8px] font-bold py-0.5 px-1.5 bg-purple-900/70 text-purple-200 border border-purple-650 rounded-full scale-90 text-center">
                                      装着中
                                    </span>
                                  ) : (
                                    <span className="text-[8px] font-mono py-0.5 px-1.5 bg-gray-900 text-gray-500 rounded-full scale-90">
                                      ストック
                                    </span>
                                  )}
                                  <ChevronRight className="w-3 h-3 text-gray-600" />
                                </div>
                              </div>
                            );
                          })}

                          {inventory.filter(item => item.type !== 'potion').length === 0 && (
                            <div className="text-center text-[10px] text-gray-500 py-6">
                              装備品はありません。
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Item/Potion List Section */}
                      <div className="h-[140px] bg-gray-950/80 rounded-lg border border-gray-900 p-2 flex flex-col overflow-hidden min-h-0 shrink-0">
                        <div className="text-[9px] text-orange-400 font-bold mb-1.5 uppercase tracking-wider border-b border-orange-950/40 pb-1 flex items-center justify-between shrink-0">
                          <span>🧪 アイテム一覧</span>
                          <span className="text-[8px] font-mono font-normal text-gray-500">計 {inventory.filter(item => item.type === 'potion').length} 個</span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 min-h-0">
                          {inventory.filter(item => item.type === 'potion').slice().reverse().map(item => {
                            const borderStyle = 
                              item.rarity === 'legendary' ? 'border-yellow-500/30 bg-yellow-950/10' :
                              item.rarity === 'epic' ? 'border-orange-500/30 bg-orange-950/10' :
                              item.rarity === 'rare' ? 'border-blue-500/30 bg-blue-950/10' :
                              'border-gray-800 bg-gray-900/30';

                            const rarityText =
                              item.rarity === 'legendary' ? 'text-yellow-400 font-bold' :
                              item.rarity === 'epic' ? 'text-orange-400 font-bold' :
                              item.rarity === 'rare' ? 'text-blue-400 font-bold' :
                              'text-orange-300';

                            return (
                              <div 
                                key={item.id}
                                onClick={() => setSelectedItem(item)}
                                className={`p-1.5 rounded text-[10px] transition cursor-pointer flex items-center justify-between border ${borderStyle} ${
                                  selectedItem?.id === item.id 
                                    ? 'ring-1 px-2 border-orange-500 bg-orange-950/20' 
                                    : 'hover:border-orange-500/45'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span 
                                    className="w-1.5 h-6 rounded shrink-0 shadow animate-pulse" 
                                    style={{ backgroundColor: item.color }}
                                  ></span>

                                  <div className="truncate flex-1">
                                    <span className={`block truncate ${rarityText}`}>
                                      {item.name}
                                    </span>
                                    <span className="text-[8.5px] text-gray-400 font-sans">
                                      {item.description.slice(0, 30)}...
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[8px] font-mono py-0.5 px-1.5 bg-orange-950/40 text-orange-400 border border-orange-900/40 rounded-full scale-90">
                                    使用可能
                                  </span>
                                  <ChevronRight className="w-3 h-3 text-gray-500" />
                                </div>
                              </div>
                            );
                          })}

                          {inventory.filter(item => item.type === 'potion').length === 0 && (
                            <div className="text-center text-[10px] text-gray-500 py-6">
                              アイテムはありません。
                            </div>
                          )}
                        </div>
                      </div>
                      
                    </div>

                    {/* Right Column: Active Item Details Panel */}
                    <div className="col-span-5 bg-purple-950/10 rounded-lg border border-purple-900/30 p-2.5 flex flex-col justify-between overflow-hidden">
                      {selectedItem ? (
                        <>
                          <div className="space-y-2">
                            <div className="border-b border-purple-950/60 pb-1.5">
                              <span className="text-[8px] font-mono uppercase tracking-widest text-purple-400">
                                装備・詳細
                              </span>
                              <h3 
                                className="text-xs font-extrabold truncate mt-0.5" 
                                style={{ color: selectedItem.color }}
                              >
                                {selectedItem.name}
                              </h3>
                              <div className="flex gap-1 items-center mt-0.5">
                                <span className={`text-[8px] px-1 py-0.2 rounded font-mono font-bold uppercase bg-black/40 border ${
                                  selectedItem.rarity === 'legendary' ? 'text-yellow-400 border-yellow-500/30' :
                                  selectedItem.rarity === 'epic' ? 'text-purple-400 border-purple-500/30' :
                                  selectedItem.rarity === 'rare' ? 'text-blue-400 border-blue-500/30' :
                                  'text-gray-400 border-gray-800'
                                }`}>
                                  {selectedItem.rarity}
                                </span>
                                <span className="text-[8px] text-gray-500">
                                  エリア {selectedItem.area} 出現
                                </span>
                              </div>
                            </div>

                            <div className="space-y-1 text-xs">
                              <div className="bg-gray-950/80 px-2 py-1 rounded border border-gray-900 flex items-center justify-between font-mono text-[10px]">
                                <span className="text-gray-400 flex items-center gap-1">
                                  {selectedItem.type === 'potion' ? (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                                      ブースト項目
                                    </>
                                  ) : selectedItem.type === 'sword' ? (
                                    <>
                                      <Sword className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                                      補正：攻撃力
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="w-3.5 h-3.5 text-blue-405 animate-pulse" />
                                      補正：防御力
                                    </>
                                  )}
                                </span>
                                <span className={`font-bold text-[11px] ${selectedItem.type === 'potion' ? 'text-orange-400' : selectedItem.type === 'sword' ? 'text-orange-400' : 'text-[#38bdf8]'}`}>
                                  {selectedItem.type === 'potion' ? 'ATK +10' : `+${selectedItem.statValue}`}
                                </span>
                              </div>

                              <p className="text-gray-400 text-[10px] leading-relaxed italic max-h-[50px] overflow-y-auto pr-0.5">
                                "{selectedItem.description}"
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-2 border-t border-purple-950/60 mt-auto shrink-0">
                            {/* Drink or Equip Action */}
                            {selectedItem.type === 'potion' ? (
                              <button
                                onClick={() => {
                                  handleUsePotion(selectedItem);
                                }}
                                className="w-full py-1.5 px-2 text-center text-[10px] font-bold rounded transition-all active:scale-95 bg-orange-600 hover:bg-orange-500 text-white shadow shadow-orange-950"
                              >
                                🧪 このポーションを飲む
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  handleEquipItem(selectedItem);
                                }}
                                className={`w-full py-1.5 px-2 text-center text-[10px] font-bold rounded transition-all active:scale-95 ${
                                  (selectedItem.id === equippedHat.id || 
                                   selectedItem.id === equippedArmor.id || 
                                   selectedItem.id === equippedPants.id || 
                                   selectedItem.id === equippedSword.id)
                                     ? 'bg-purple-950/40 text-purple-400/60 border border-purple-900/40 cursor-not-allowed'
                                     : 'bg-purple-700 hover:bg-purple-600 text-white shadow shadow-purple-950'
                                }`}
                                disabled={
                                  selectedItem.id === equippedHat.id || 
                                  selectedItem.id === equippedArmor.id || 
                                  selectedItem.id === equippedPants.id || 
                                  selectedItem.id === equippedSword.id
                                }
                              >
                                {(selectedItem.id === equippedHat.id || 
                                  selectedItem.id === equippedArmor.id || 
                                  selectedItem.id === equippedPants.id || 
                                  selectedItem.id === equippedSword.id)
                                  ? '既に装着されています'
                                  : 'この装備を装着する'}
                              </button>
                            )}

                            {/* Sell Action */}
                            <button
                              onClick={() => {
                                handleSellItem(selectedItem);
                              }}
                              className={`w-full py-1.5 px-2 text-center text-[10px] font-bold rounded transition-all active:scale-95 ${
                                selectedItem.type !== 'potion' && (
                                  selectedItem.id === equippedHat.id || 
                                  selectedItem.id === equippedArmor.id || 
                                  selectedItem.id === equippedPants.id || 
                                  selectedItem.id === equippedSword.id
                                )
                                  ? 'bg-gray-950/50 text-gray-600 border border-gray-950 cursor-not-allowed'
                                  : 'bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300'
                              }`}
                              disabled={
                                selectedItem.type !== 'potion' && (
                                  selectedItem.id === equippedHat.id || 
                                  selectedItem.id === equippedArmor.id || 
                                  selectedItem.id === equippedPants.id || 
                                  selectedItem.id === equippedSword.id
                                )
                              }
                            >
                              {selectedItem.type !== 'potion' && (
                                selectedItem.id === equippedHat.id || 
                                selectedItem.id === equippedArmor.id || 
                                selectedItem.id === equippedPants.id || 
                                selectedItem.id === equippedSword.id
                              )
                                ? '装着中は売却できません'
                                : `アイテムを売却する (+${selectedItem.area * 15 + (selectedItem.rarity === 'legendary' ? 100 : selectedItem.rarity === 'epic' ? 50 : 20)} G)`}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-3 text-gray-500">
                          <Backpack className="w-8 h-8 text-purple-900/30 mb-1" />
                          <p className="text-[10px]">
                            アイテムを選択すると、能力値の確認・装着・売却ボタンが表示されます。
                          </p>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* BAG BUTTON IN BOTTOM-RIGHT OF PLAY SCREEN */}
              {!isGameOver && !hasWonFinal && (
                <button
                  id="bag-button"
                  onClick={() => {
                    const nextVal = !isBagOpen;
                    setIsBagOpen(nextVal);
                    gameRef.current.isBagOpen = nextVal;
                    // reset held movement keys so adventurer doesn't dart instantly upon bag closure
                    gameRef.current.keys = {};
                    gameAudio.playCollect();
                  }}
                  className={`absolute bottom-3 right-3 z-25 p-2.5 rounded-full border shadow-xl flex items-center justify-center transition-all duration-200 active:scale-95 ${
                    isBagOpen 
                      ? 'bg-purple-600 hover:bg-purple-500 border-purple-300 text-white ring-2 ring-purple-600 ring-offset-2 ring-offset-gray-950 scale-105' 
                      : 'bg-[#151336]/80 hover:bg-[#25225c]/95 border-purple-500/50 text-[#c084fc] hover:scale-105 hover:border-purple-400'
                  }`}
                  style={{ touchAction: 'none' }}
                  title={isBagOpen ? "バッグを閉じる" : "バッグを開く"}
                >
                  <Backpack className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {/* Simple screen status feedback under canvas */}
            <div className="bg-gray-950 p-2 text-[11px] font-mono flex items-center justify-between text-gray-400 rounded-b border-t border-gray-800">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                <span>SYSTEM RENDER OK</span>
              </span>
              <span className="text-gray-500">[W][A][S][D] / 矢印キー移動 | [SPACE] 攻撃 | [E] 移行</span>
            </div>
          </div>

          {/* Controller & Virtual Gamepad for touch/mice */}
          <div className="bg-[#111827] rounded-xl border border-gray-800 p-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Gamepad2 className="w-4 h-4 text-purple-400" />
              <span>バーチャルコントローラー (タッチ・マウス対応)</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* D-PAD directional cross */}
              <div className="md:col-span-5 flex justify-center py-2">
                <div className="relative w-36 h-36 bg-[#1f2937] rounded-full border border-gray-700 shadow-inner flex items-center justify-center">
                  {/* Center circle */}
                  <div className="absolute w-12 h-12 bg-[#111827] rounded-full border border-gray-800 z-10 font-mono text-center flex items-center justify-center text-[9px] text-gray-500">🕹️</div>
                  
                  {/* UP */}
                  <button 
                    onClick={() => handleVirtualDirPress('up')}
                    className="absolute top-1 inset-x-12 h-10 bg-gray-800 hover:bg-gray-700 active:bg-purple-900 border-x border-t border-gray-700 rounded-t-md text-xs font-bold text-white flex items-center justify-center transition"
                  >
                    ▲
                  </button>
                  {/* DOWN */}
                  <button 
                    onClick={() => handleVirtualDirPress('down')}
                    className="absolute bottom-1 inset-x-12 h-10 bg-gray-800 hover:bg-gray-700 active:bg-purple-900 border-x border-b border-gray-700 rounded-b-md text-xs font-bold text-white flex items-center justify-center transition"
                  >
                    ▼
                  </button>
                  {/* LEFT */}
                  <button 
                    onClick={() => handleVirtualDirPress('left')}
                    className="absolute left-1 inset-y-12 w-10 bg-gray-800 hover:bg-gray-700 active:bg-purple-900 border-y border-l border-gray-700 rounded-l-md text-xs font-bold text-white flex items-center justify-center transition"
                  >
                    ◀
                  </button>
                  {/* RIGHT */}
                  <button 
                    onClick={() => handleVirtualDirPress('right')}
                    className="absolute right-1 inset-y-12 w-10 bg-gray-800 hover:bg-gray-700 active:bg-purple-900 border-y border-r border-gray-700 rounded-r-md text-xs font-bold text-white flex items-center justify-center transition"
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="md:col-span-7 flex flex-col gap-2.5">
                <button 
                  onClick={triggerPlayerAttack}
                  className="w-full py-4 text-center font-bold text-base rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-95 text-white shadow-md hover:shadow-orange-500/20 transition flex items-center justify-center gap-2"
                >
                  <Sword className="w-5 h-5 animate-bounce" />
                  <span>基本攻撃をする [SPACE]</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={triggerPortalTransition}
                    className="py-2.5 font-bold text-xs rounded bg-purple-900 hover:bg-purple-800 text-purple-100 border border-purple-700 active:scale-95 transition flex items-center justify-center gap-1.5"
                    title="ポータルの中心付近でタップします"
                  >
                    <Compass className="w-4 h-4 text-[#d946ef]" />
                    <span>ポータルに入る [E]</span>
                  </button>

                  <button 
                    onClick={() => {
                      // Simple healing potion or minor action helper to sustain beginner play
                      const goldPrice = 15;
                      if (gameRef.current.player.gold >= goldPrice) {
                        gameRef.current.player.gold -= goldPrice;
                        setCurrentGold(gameRef.current.player.gold);
                        
                        const healAmount = Math.round(gameRef.current.player.maxHp * 0.45);
                        gameRef.current.player.hp = Math.min(gameRef.current.player.maxHp, gameRef.current.player.hp + healAmount);
                        setPlayerHP(gameRef.current.player.hp);
                        
                        gameAudio.playCollect();
                        gameRef.current.floatingTexts.push({
                          id: `heal-${Math.random()}`,
                          text: `+${healAmount}`,
                          x: gameRef.current.player.x,
                          y: gameRef.current.player.y - 12,
                          color: '#10b981',
                          alpha: 1,
                          life: 40
                        });
                        addLog(`🧪 聖なる回復薬を 15G で購入・使用しました！ (HP +${healAmount})`);
                      } else {
                        addLog(`❌ 金貨が足りません！ (回復薬の購入には 15G 必要です)`);
                      }
                    }}
                    className="py-2.5 font-bold text-xs rounded bg-green-950 hover:bg-green-900 text-green-200 border border-green-800 active:scale-95 transition flex items-center justify-center gap-1.5"
                  >
                    <span>🧪 秘薬（15G）</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

        </section>

      </main>

      {/* FOOTER GAME LOG EVENTS CONSOLE VIEW */}
      <footer className="max-w-4xl w-full mx-auto mt-4 bg-[#111827] rounded-xl border border-gray-800 p-4">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono flex items-center justify-between">
          <span>📜 アドベンチャーシステムログ</span>
          <span className="text-[9px] text-[#4ade80] animate-pulse">● LIVE CONSOLE</span>
        </h4>
        
        {/* Dynamic Log Entries container */}
        <div className="bg-gray-950 rounded-lg p-3 max-h-[105px] overflow-y-auto space-y-1.5 font-mono text-xs text-gray-300 border border-gray-900">
          {gameLog.map((log, i) => (
            <div key={i} className="flex gap-1.5 border-b border-gray-900/40 pb-1 leading-normal">
              <span className="text-gray-500 font-mono select-none shrink-0">[LOG]</span>
              <span className="text-gray-200">{log}</span>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
