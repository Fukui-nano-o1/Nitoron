// Generated from the pinned source. Do not renumber IDs.
export const SOURCE_COMMIT = 'daf7afab12020d303738c089dbfcf5208132487b';
export const MACHINE_ID = 'skp-101w';
export const MODEL_VERSION = 'skp-101w@daf7afab';
export const ROOT_PART_ID = 'machine';
export const MACHINE_NAME = 'SKP-101W';
export const NODES = Object.freeze([
  {
    "id": "machine",
    "name": "SKP-101W",
    "kind": "machine",
    "parent": null,
    "children": [
      "system-0",
      "system-1",
      "system-2",
      "system-3"
    ]
  },
  {
    "id": "system-0",
    "name": "エンジン・前部",
    "kind": "system",
    "parent": "machine",
    "children": [
      "bonnet",
      "headlamp",
      "engine",
      "tank",
      "aircleaner",
      "muffler",
      "recoil"
    ]
  },
  {
    "id": "system-1",
    "name": "苗送り・植付部",
    "kind": "system",
    "parent": "machine",
    "children": [
      "trayrail",
      "seedtray",
      "trayfeed",
      "pickercover",
      "picker",
      "pickerdrive",
      "cupcase",
      "cup",
      "soilrubberF",
      "soilrubberR",
      "roller",
      "pressL",
      "pressR"
    ]
  },
  {
    "id": "system-2",
    "name": "走行・駆動部",
    "kind": "system",
    "parent": "machine",
    "children": [
      "chassis",
      "frontaxle",
      "frontL",
      "frontR",
      "rearL",
      "rearR",
      "transmission",
      "drivecase"
    ]
  },
  {
    "id": "system-3",
    "name": "操作・苗台・スタンド",
    "kind": "system",
    "parent": "machine",
    "children": [
      "handle",
      "console",
      "spares",
      "frontstand",
      "rearstand"
    ]
  },
  {
    "id": "bonnet",
    "name": "ボンネット",
    "kind": "assembly",
    "parent": "system-0",
    "children": [
      "bonnet__shell",
      "bonnet__trim-a",
      "bonnet__trim-b"
    ]
  },
  {
    "id": "headlamp",
    "name": "前照灯",
    "kind": "assembly",
    "parent": "system-0",
    "children": [
      "headlamp__housing",
      "headlamp__lens",
      "headlamp__led"
    ]
  },
  {
    "id": "engine",
    "name": "ガソリンエンジン",
    "kind": "assembly",
    "parent": "system-0",
    "children": [
      "engine__crankcase",
      "engine__cylinder",
      "engine__plug",
      "engine__lead"
    ]
  },
  {
    "id": "tank",
    "name": "燃料タンク",
    "kind": "assembly",
    "parent": "system-0",
    "children": [
      "tank__body",
      "tank__cap",
      "tank__hose"
    ]
  },
  {
    "id": "aircleaner",
    "name": "エアクリーナ",
    "kind": "assembly",
    "parent": "system-0",
    "children": [
      "aircleaner__cover",
      "aircleaner__element",
      "aircleaner__intake"
    ]
  },
  {
    "id": "muffler",
    "name": "マフラ",
    "kind": "assembly",
    "parent": "system-0",
    "children": []
  },
  {
    "id": "recoil",
    "name": "リコイルスタータ",
    "kind": "assembly",
    "parent": "system-0",
    "children": [
      "recoil__cover",
      "recoil__rope",
      "recoil__grip"
    ]
  },
  {
    "id": "trayrail",
    "name": "苗のせ台",
    "kind": "assembly",
    "parent": "system-1",
    "children": []
  },
  {
    "id": "seedtray",
    "name": "セルトレイ・苗",
    "kind": "assembly",
    "parent": "system-1",
    "children": []
  },
  {
    "id": "trayfeed",
    "name": "トレイ搬送部",
    "kind": "assembly",
    "parent": "system-1",
    "children": []
  },
  {
    "id": "pickercover",
    "name": "苗取りカバー",
    "kind": "assembly",
    "parent": "system-1",
    "children": []
  },
  {
    "id": "picker",
    "name": "苗取出し爪",
    "kind": "assembly",
    "parent": "system-1",
    "children": [
      "picker__holder",
      "picker__claw-a",
      "picker__claw-b",
      "picker__shaft"
    ]
  },
  {
    "id": "pickerdrive",
    "name": "苗取出し駆動部",
    "kind": "assembly",
    "parent": "system-1",
    "children": [
      "pickerdrive__left",
      "pickerdrive__right",
      "pickerdrive__cross"
    ]
  },
  {
    "id": "cupcase",
    "name": "植付ケースカバー",
    "kind": "assembly",
    "parent": "system-1",
    "children": [
      "cupcase__cover",
      "cupcase__fix-a",
      "cupcase__fix-b"
    ]
  },
  {
    "id": "cup",
    "name": "植付カップ",
    "kind": "assembly",
    "parent": "system-1",
    "children": [
      "cup__half-a",
      "cup__link-a",
      "cup__half-b",
      "cup__link-b",
      "cup__ring",
      "cup__shaft"
    ]
  },
  {
    "id": "soilrubberF",
    "name": "土落としゴム・前",
    "kind": "assembly",
    "parent": "system-1",
    "children": [
      "soilrubberF__rubber",
      "soilrubberF__support"
    ]
  },
  {
    "id": "soilrubberR",
    "name": "土落としゴム・後",
    "kind": "assembly",
    "parent": "system-1",
    "children": [
      "soilrubberR__rubber",
      "soilrubberR__fasteners"
    ]
  },
  {
    "id": "roller",
    "name": "整地ローラ",
    "kind": "assembly",
    "parent": "system-1",
    "children": [
      "roller__drum",
      "roller__arm-a",
      "roller__arm-b"
    ]
  },
  {
    "id": "pressL",
    "name": "左覆土ローラ",
    "kind": "assembly",
    "parent": "system-1",
    "children": [
      "pressL__roller",
      "pressL__hub",
      "pressL__arm"
    ]
  },
  {
    "id": "pressR",
    "name": "右覆土ローラ",
    "kind": "assembly",
    "parent": "system-1",
    "children": [
      "pressR__roller",
      "pressR__hub",
      "pressR__arm"
    ]
  },
  {
    "id": "chassis",
    "name": "車体フレーム",
    "kind": "assembly",
    "parent": "system-2",
    "children": []
  },
  {
    "id": "frontaxle",
    "name": "前車軸",
    "kind": "assembly",
    "parent": "system-2",
    "children": []
  },
  {
    "id": "frontL",
    "name": "左前輪",
    "kind": "assembly",
    "parent": "system-2",
    "children": [
      "frontL__tire",
      "frontL__rim",
      "frontL__hub",
      "frontL__fasteners"
    ]
  },
  {
    "id": "frontR",
    "name": "右前輪",
    "kind": "assembly",
    "parent": "system-2",
    "children": [
      "frontR__tire",
      "frontR__rim",
      "frontR__hub",
      "frontR__fasteners"
    ]
  },
  {
    "id": "rearL",
    "name": "左後輪",
    "kind": "assembly",
    "parent": "system-2",
    "children": [
      "rearL__tire",
      "rearL__rim",
      "rearL__hub",
      "rearL__fasteners"
    ]
  },
  {
    "id": "rearR",
    "name": "右後輪",
    "kind": "assembly",
    "parent": "system-2",
    "children": [
      "rearR__tire",
      "rearR__rim",
      "rearR__hub",
      "rearR__fasteners"
    ]
  },
  {
    "id": "transmission",
    "name": "ミッション・駆動ベルト",
    "kind": "assembly",
    "parent": "system-2",
    "children": [
      "transmission__case",
      "transmission__axle",
      "transmission__pulley-a",
      "transmission__pulley-b",
      "transmission__belt"
    ]
  },
  {
    "id": "drivecase",
    "name": "植付カップ駆動チェーンケース",
    "kind": "assembly",
    "parent": "system-2",
    "children": [
      "drivecase__cover",
      "drivecase__back",
      "drivecase__mount-a",
      "drivecase__mount-b"
    ]
  },
  {
    "id": "handle",
    "name": "運転ハンドル",
    "kind": "assembly",
    "parent": "system-3",
    "children": []
  },
  {
    "id": "console",
    "name": "操作レバー・パネル",
    "kind": "assembly",
    "parent": "system-3",
    "children": [
      "console__lever-0",
      "console__lever-1",
      "console__lever-2"
    ]
  },
  {
    "id": "spares",
    "name": "予備苗のせ台",
    "kind": "assembly",
    "parent": "system-3",
    "children": []
  },
  {
    "id": "frontstand",
    "name": "前スタンド・バンパ",
    "kind": "assembly",
    "parent": "system-3",
    "children": []
  },
  {
    "id": "rearstand",
    "name": "後スタンド・空トレイ台",
    "kind": "assembly",
    "parent": "system-3",
    "children": []
  },
  {
    "id": "bonnet__shell",
    "name": "ボンネット外板",
    "kind": "part",
    "parent": "bonnet",
    "children": []
  },
  {
    "id": "bonnet__trim-a",
    "name": "側面形状（表示用の分割） A",
    "kind": "part",
    "parent": "bonnet",
    "children": []
  },
  {
    "id": "bonnet__trim-b",
    "name": "側面形状（表示用の分割） B",
    "kind": "part",
    "parent": "bonnet",
    "children": []
  },
  {
    "id": "headlamp__housing",
    "name": "ランプ取付枠",
    "kind": "part",
    "parent": "headlamp",
    "children": []
  },
  {
    "id": "headlamp__lens",
    "name": "ランプレンズ",
    "kind": "part",
    "parent": "headlamp",
    "children": []
  },
  {
    "id": "headlamp__led",
    "name": "LEDユニット（模式）",
    "kind": "part",
    "parent": "headlamp",
    "children": []
  },
  {
    "id": "tank__body",
    "name": "燃料タンク本体",
    "kind": "part",
    "parent": "tank",
    "children": []
  },
  {
    "id": "tank__cap",
    "name": "燃料タンクキャップ",
    "kind": "part",
    "parent": "tank",
    "children": []
  },
  {
    "id": "tank__hose",
    "name": "燃料ホース",
    "kind": "part",
    "parent": "tank",
    "children": []
  },
  {
    "id": "engine__crankcase",
    "name": "クランクケース外形",
    "kind": "part",
    "parent": "engine",
    "children": []
  },
  {
    "id": "engine__cylinder",
    "name": "シリンダ・ヘッド外形",
    "kind": "part",
    "parent": "engine",
    "children": []
  },
  {
    "id": "engine__plug",
    "name": "点火プラグ外形",
    "kind": "part",
    "parent": "engine",
    "children": []
  },
  {
    "id": "engine__lead",
    "name": "点火ケーブル",
    "kind": "part",
    "parent": "engine",
    "children": []
  },
  {
    "id": "recoil__cover",
    "name": "スタータカバー",
    "kind": "part",
    "parent": "recoil",
    "children": []
  },
  {
    "id": "recoil__rope",
    "name": "始動ロープ",
    "kind": "part",
    "parent": "recoil",
    "children": []
  },
  {
    "id": "recoil__grip",
    "name": "スタータグリップ",
    "kind": "part",
    "parent": "recoil",
    "children": []
  },
  {
    "id": "aircleaner__cover",
    "name": "エアクリーナカバー",
    "kind": "part",
    "parent": "aircleaner",
    "children": []
  },
  {
    "id": "aircleaner__element",
    "name": "エアクリーナエレメント",
    "kind": "part",
    "parent": "aircleaner",
    "children": []
  },
  {
    "id": "aircleaner__intake",
    "name": "ケース・吸気接続部",
    "kind": "part",
    "parent": "aircleaner",
    "children": [
      "aircleaner__intake__case",
      "aircleaner__intake__duct"
    ]
  },
  {
    "id": "aircleaner__intake__case",
    "name": "エアクリーナケース",
    "kind": "part",
    "parent": "aircleaner__intake",
    "children": []
  },
  {
    "id": "aircleaner__intake__duct",
    "name": "吸気接続管",
    "kind": "part",
    "parent": "aircleaner__intake",
    "children": []
  },
  {
    "id": "frontL__tire",
    "name": "タイヤ",
    "kind": "part",
    "parent": "frontL",
    "children": []
  },
  {
    "id": "frontL__rim",
    "name": "ホイール",
    "kind": "part",
    "parent": "frontL",
    "children": []
  },
  {
    "id": "frontL__hub",
    "name": "ハブ",
    "kind": "part",
    "parent": "frontL",
    "children": []
  },
  {
    "id": "frontL__fasteners",
    "name": "取付部（締結部品の模式表示）",
    "kind": "part",
    "parent": "frontL",
    "children": [
      "frontL__fasteners__a0",
      "frontL__fasteners__a1",
      "frontL__fasteners__a2",
      "frontL__fasteners__a3",
      "frontL__fasteners__a4",
      "frontL__fasteners__b0",
      "frontL__fasteners__b1",
      "frontL__fasteners__b2",
      "frontL__fasteners__b3",
      "frontL__fasteners__b4"
    ]
  },
  {
    "id": "frontL__fasteners__a0",
    "name": "締結セット A1（例示）",
    "kind": "part",
    "parent": "frontL__fasteners",
    "children": [
      "frontL__fasteners__a0__bolt",
      "frontL__fasteners__a0__washer"
    ]
  },
  {
    "id": "frontL__fasteners__a0__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontL__fasteners__a0",
    "children": []
  },
  {
    "id": "frontL__fasteners__a0__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontL__fasteners__a0",
    "children": []
  },
  {
    "id": "frontL__fasteners__a1",
    "name": "締結セット A2（例示）",
    "kind": "part",
    "parent": "frontL__fasteners",
    "children": [
      "frontL__fasteners__a1__bolt",
      "frontL__fasteners__a1__washer"
    ]
  },
  {
    "id": "frontL__fasteners__a1__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontL__fasteners__a1",
    "children": []
  },
  {
    "id": "frontL__fasteners__a1__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontL__fasteners__a1",
    "children": []
  },
  {
    "id": "frontL__fasteners__a2",
    "name": "締結セット A3（例示）",
    "kind": "part",
    "parent": "frontL__fasteners",
    "children": [
      "frontL__fasteners__a2__bolt",
      "frontL__fasteners__a2__washer"
    ]
  },
  {
    "id": "frontL__fasteners__a2__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontL__fasteners__a2",
    "children": []
  },
  {
    "id": "frontL__fasteners__a2__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontL__fasteners__a2",
    "children": []
  },
  {
    "id": "frontL__fasteners__a3",
    "name": "締結セット A4（例示）",
    "kind": "part",
    "parent": "frontL__fasteners",
    "children": [
      "frontL__fasteners__a3__bolt",
      "frontL__fasteners__a3__washer"
    ]
  },
  {
    "id": "frontL__fasteners__a3__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontL__fasteners__a3",
    "children": []
  },
  {
    "id": "frontL__fasteners__a3__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontL__fasteners__a3",
    "children": []
  },
  {
    "id": "frontL__fasteners__a4",
    "name": "締結セット A5（例示）",
    "kind": "part",
    "parent": "frontL__fasteners",
    "children": [
      "frontL__fasteners__a4__bolt",
      "frontL__fasteners__a4__washer"
    ]
  },
  {
    "id": "frontL__fasteners__a4__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontL__fasteners__a4",
    "children": []
  },
  {
    "id": "frontL__fasteners__a4__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontL__fasteners__a4",
    "children": []
  },
  {
    "id": "frontL__fasteners__b0",
    "name": "締結セット B1（例示）",
    "kind": "part",
    "parent": "frontL__fasteners",
    "children": [
      "frontL__fasteners__b0__bolt",
      "frontL__fasteners__b0__washer"
    ]
  },
  {
    "id": "frontL__fasteners__b0__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontL__fasteners__b0",
    "children": []
  },
  {
    "id": "frontL__fasteners__b0__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontL__fasteners__b0",
    "children": []
  },
  {
    "id": "frontL__fasteners__b1",
    "name": "締結セット B2（例示）",
    "kind": "part",
    "parent": "frontL__fasteners",
    "children": [
      "frontL__fasteners__b1__bolt",
      "frontL__fasteners__b1__washer"
    ]
  },
  {
    "id": "frontL__fasteners__b1__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontL__fasteners__b1",
    "children": []
  },
  {
    "id": "frontL__fasteners__b1__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontL__fasteners__b1",
    "children": []
  },
  {
    "id": "frontL__fasteners__b2",
    "name": "締結セット B3（例示）",
    "kind": "part",
    "parent": "frontL__fasteners",
    "children": [
      "frontL__fasteners__b2__bolt",
      "frontL__fasteners__b2__washer"
    ]
  },
  {
    "id": "frontL__fasteners__b2__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontL__fasteners__b2",
    "children": []
  },
  {
    "id": "frontL__fasteners__b2__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontL__fasteners__b2",
    "children": []
  },
  {
    "id": "frontL__fasteners__b3",
    "name": "締結セット B4（例示）",
    "kind": "part",
    "parent": "frontL__fasteners",
    "children": [
      "frontL__fasteners__b3__bolt",
      "frontL__fasteners__b3__washer"
    ]
  },
  {
    "id": "frontL__fasteners__b3__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontL__fasteners__b3",
    "children": []
  },
  {
    "id": "frontL__fasteners__b3__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontL__fasteners__b3",
    "children": []
  },
  {
    "id": "frontL__fasteners__b4",
    "name": "締結セット B5（例示）",
    "kind": "part",
    "parent": "frontL__fasteners",
    "children": [
      "frontL__fasteners__b4__bolt",
      "frontL__fasteners__b4__washer"
    ]
  },
  {
    "id": "frontL__fasteners__b4__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontL__fasteners__b4",
    "children": []
  },
  {
    "id": "frontL__fasteners__b4__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontL__fasteners__b4",
    "children": []
  },
  {
    "id": "frontR__tire",
    "name": "タイヤ",
    "kind": "part",
    "parent": "frontR",
    "children": []
  },
  {
    "id": "frontR__rim",
    "name": "ホイール",
    "kind": "part",
    "parent": "frontR",
    "children": []
  },
  {
    "id": "frontR__hub",
    "name": "ハブ",
    "kind": "part",
    "parent": "frontR",
    "children": []
  },
  {
    "id": "frontR__fasteners",
    "name": "取付部（締結部品の模式表示）",
    "kind": "part",
    "parent": "frontR",
    "children": [
      "frontR__fasteners__a0",
      "frontR__fasteners__a1",
      "frontR__fasteners__a2",
      "frontR__fasteners__a3",
      "frontR__fasteners__a4",
      "frontR__fasteners__b0",
      "frontR__fasteners__b1",
      "frontR__fasteners__b2",
      "frontR__fasteners__b3",
      "frontR__fasteners__b4"
    ]
  },
  {
    "id": "frontR__fasteners__a0",
    "name": "締結セット A1（例示）",
    "kind": "part",
    "parent": "frontR__fasteners",
    "children": [
      "frontR__fasteners__a0__bolt",
      "frontR__fasteners__a0__washer"
    ]
  },
  {
    "id": "frontR__fasteners__a0__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontR__fasteners__a0",
    "children": []
  },
  {
    "id": "frontR__fasteners__a0__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontR__fasteners__a0",
    "children": []
  },
  {
    "id": "frontR__fasteners__a1",
    "name": "締結セット A2（例示）",
    "kind": "part",
    "parent": "frontR__fasteners",
    "children": [
      "frontR__fasteners__a1__bolt",
      "frontR__fasteners__a1__washer"
    ]
  },
  {
    "id": "frontR__fasteners__a1__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontR__fasteners__a1",
    "children": []
  },
  {
    "id": "frontR__fasteners__a1__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontR__fasteners__a1",
    "children": []
  },
  {
    "id": "frontR__fasteners__a2",
    "name": "締結セット A3（例示）",
    "kind": "part",
    "parent": "frontR__fasteners",
    "children": [
      "frontR__fasteners__a2__bolt",
      "frontR__fasteners__a2__washer"
    ]
  },
  {
    "id": "frontR__fasteners__a2__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontR__fasteners__a2",
    "children": []
  },
  {
    "id": "frontR__fasteners__a2__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontR__fasteners__a2",
    "children": []
  },
  {
    "id": "frontR__fasteners__a3",
    "name": "締結セット A4（例示）",
    "kind": "part",
    "parent": "frontR__fasteners",
    "children": [
      "frontR__fasteners__a3__bolt",
      "frontR__fasteners__a3__washer"
    ]
  },
  {
    "id": "frontR__fasteners__a3__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontR__fasteners__a3",
    "children": []
  },
  {
    "id": "frontR__fasteners__a3__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontR__fasteners__a3",
    "children": []
  },
  {
    "id": "frontR__fasteners__a4",
    "name": "締結セット A5（例示）",
    "kind": "part",
    "parent": "frontR__fasteners",
    "children": [
      "frontR__fasteners__a4__bolt",
      "frontR__fasteners__a4__washer"
    ]
  },
  {
    "id": "frontR__fasteners__a4__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontR__fasteners__a4",
    "children": []
  },
  {
    "id": "frontR__fasteners__a4__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontR__fasteners__a4",
    "children": []
  },
  {
    "id": "frontR__fasteners__b0",
    "name": "締結セット B1（例示）",
    "kind": "part",
    "parent": "frontR__fasteners",
    "children": [
      "frontR__fasteners__b0__bolt",
      "frontR__fasteners__b0__washer"
    ]
  },
  {
    "id": "frontR__fasteners__b0__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontR__fasteners__b0",
    "children": []
  },
  {
    "id": "frontR__fasteners__b0__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontR__fasteners__b0",
    "children": []
  },
  {
    "id": "frontR__fasteners__b1",
    "name": "締結セット B2（例示）",
    "kind": "part",
    "parent": "frontR__fasteners",
    "children": [
      "frontR__fasteners__b1__bolt",
      "frontR__fasteners__b1__washer"
    ]
  },
  {
    "id": "frontR__fasteners__b1__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontR__fasteners__b1",
    "children": []
  },
  {
    "id": "frontR__fasteners__b1__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontR__fasteners__b1",
    "children": []
  },
  {
    "id": "frontR__fasteners__b2",
    "name": "締結セット B3（例示）",
    "kind": "part",
    "parent": "frontR__fasteners",
    "children": [
      "frontR__fasteners__b2__bolt",
      "frontR__fasteners__b2__washer"
    ]
  },
  {
    "id": "frontR__fasteners__b2__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontR__fasteners__b2",
    "children": []
  },
  {
    "id": "frontR__fasteners__b2__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontR__fasteners__b2",
    "children": []
  },
  {
    "id": "frontR__fasteners__b3",
    "name": "締結セット B4（例示）",
    "kind": "part",
    "parent": "frontR__fasteners",
    "children": [
      "frontR__fasteners__b3__bolt",
      "frontR__fasteners__b3__washer"
    ]
  },
  {
    "id": "frontR__fasteners__b3__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontR__fasteners__b3",
    "children": []
  },
  {
    "id": "frontR__fasteners__b3__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontR__fasteners__b3",
    "children": []
  },
  {
    "id": "frontR__fasteners__b4",
    "name": "締結セット B5（例示）",
    "kind": "part",
    "parent": "frontR__fasteners",
    "children": [
      "frontR__fasteners__b4__bolt",
      "frontR__fasteners__b4__washer"
    ]
  },
  {
    "id": "frontR__fasteners__b4__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "frontR__fasteners__b4",
    "children": []
  },
  {
    "id": "frontR__fasteners__b4__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "frontR__fasteners__b4",
    "children": []
  },
  {
    "id": "rearL__tire",
    "name": "タイヤ",
    "kind": "part",
    "parent": "rearL",
    "children": []
  },
  {
    "id": "rearL__rim",
    "name": "ホイール",
    "kind": "part",
    "parent": "rearL",
    "children": []
  },
  {
    "id": "rearL__hub",
    "name": "ハブ",
    "kind": "part",
    "parent": "rearL",
    "children": []
  },
  {
    "id": "rearL__fasteners",
    "name": "取付部（締結部品の模式表示）",
    "kind": "part",
    "parent": "rearL",
    "children": [
      "rearL__fasteners__a0",
      "rearL__fasteners__a1",
      "rearL__fasteners__a2",
      "rearL__fasteners__a3",
      "rearL__fasteners__a4",
      "rearL__fasteners__b0",
      "rearL__fasteners__b1",
      "rearL__fasteners__b2",
      "rearL__fasteners__b3",
      "rearL__fasteners__b4"
    ]
  },
  {
    "id": "rearL__fasteners__a0",
    "name": "締結セット A1（例示）",
    "kind": "part",
    "parent": "rearL__fasteners",
    "children": [
      "rearL__fasteners__a0__bolt",
      "rearL__fasteners__a0__washer"
    ]
  },
  {
    "id": "rearL__fasteners__a0__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearL__fasteners__a0",
    "children": []
  },
  {
    "id": "rearL__fasteners__a0__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearL__fasteners__a0",
    "children": []
  },
  {
    "id": "rearL__fasteners__a1",
    "name": "締結セット A2（例示）",
    "kind": "part",
    "parent": "rearL__fasteners",
    "children": [
      "rearL__fasteners__a1__bolt",
      "rearL__fasteners__a1__washer"
    ]
  },
  {
    "id": "rearL__fasteners__a1__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearL__fasteners__a1",
    "children": []
  },
  {
    "id": "rearL__fasteners__a1__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearL__fasteners__a1",
    "children": []
  },
  {
    "id": "rearL__fasteners__a2",
    "name": "締結セット A3（例示）",
    "kind": "part",
    "parent": "rearL__fasteners",
    "children": [
      "rearL__fasteners__a2__bolt",
      "rearL__fasteners__a2__washer"
    ]
  },
  {
    "id": "rearL__fasteners__a2__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearL__fasteners__a2",
    "children": []
  },
  {
    "id": "rearL__fasteners__a2__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearL__fasteners__a2",
    "children": []
  },
  {
    "id": "rearL__fasteners__a3",
    "name": "締結セット A4（例示）",
    "kind": "part",
    "parent": "rearL__fasteners",
    "children": [
      "rearL__fasteners__a3__bolt",
      "rearL__fasteners__a3__washer"
    ]
  },
  {
    "id": "rearL__fasteners__a3__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearL__fasteners__a3",
    "children": []
  },
  {
    "id": "rearL__fasteners__a3__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearL__fasteners__a3",
    "children": []
  },
  {
    "id": "rearL__fasteners__a4",
    "name": "締結セット A5（例示）",
    "kind": "part",
    "parent": "rearL__fasteners",
    "children": [
      "rearL__fasteners__a4__bolt",
      "rearL__fasteners__a4__washer"
    ]
  },
  {
    "id": "rearL__fasteners__a4__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearL__fasteners__a4",
    "children": []
  },
  {
    "id": "rearL__fasteners__a4__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearL__fasteners__a4",
    "children": []
  },
  {
    "id": "rearL__fasteners__b0",
    "name": "締結セット B1（例示）",
    "kind": "part",
    "parent": "rearL__fasteners",
    "children": [
      "rearL__fasteners__b0__bolt",
      "rearL__fasteners__b0__washer"
    ]
  },
  {
    "id": "rearL__fasteners__b0__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearL__fasteners__b0",
    "children": []
  },
  {
    "id": "rearL__fasteners__b0__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearL__fasteners__b0",
    "children": []
  },
  {
    "id": "rearL__fasteners__b1",
    "name": "締結セット B2（例示）",
    "kind": "part",
    "parent": "rearL__fasteners",
    "children": [
      "rearL__fasteners__b1__bolt",
      "rearL__fasteners__b1__washer"
    ]
  },
  {
    "id": "rearL__fasteners__b1__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearL__fasteners__b1",
    "children": []
  },
  {
    "id": "rearL__fasteners__b1__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearL__fasteners__b1",
    "children": []
  },
  {
    "id": "rearL__fasteners__b2",
    "name": "締結セット B3（例示）",
    "kind": "part",
    "parent": "rearL__fasteners",
    "children": [
      "rearL__fasteners__b2__bolt",
      "rearL__fasteners__b2__washer"
    ]
  },
  {
    "id": "rearL__fasteners__b2__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearL__fasteners__b2",
    "children": []
  },
  {
    "id": "rearL__fasteners__b2__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearL__fasteners__b2",
    "children": []
  },
  {
    "id": "rearL__fasteners__b3",
    "name": "締結セット B4（例示）",
    "kind": "part",
    "parent": "rearL__fasteners",
    "children": [
      "rearL__fasteners__b3__bolt",
      "rearL__fasteners__b3__washer"
    ]
  },
  {
    "id": "rearL__fasteners__b3__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearL__fasteners__b3",
    "children": []
  },
  {
    "id": "rearL__fasteners__b3__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearL__fasteners__b3",
    "children": []
  },
  {
    "id": "rearL__fasteners__b4",
    "name": "締結セット B5（例示）",
    "kind": "part",
    "parent": "rearL__fasteners",
    "children": [
      "rearL__fasteners__b4__bolt",
      "rearL__fasteners__b4__washer"
    ]
  },
  {
    "id": "rearL__fasteners__b4__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearL__fasteners__b4",
    "children": []
  },
  {
    "id": "rearL__fasteners__b4__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearL__fasteners__b4",
    "children": []
  },
  {
    "id": "rearR__tire",
    "name": "タイヤ",
    "kind": "part",
    "parent": "rearR",
    "children": []
  },
  {
    "id": "rearR__rim",
    "name": "ホイール",
    "kind": "part",
    "parent": "rearR",
    "children": []
  },
  {
    "id": "rearR__hub",
    "name": "ハブ",
    "kind": "part",
    "parent": "rearR",
    "children": []
  },
  {
    "id": "rearR__fasteners",
    "name": "取付部（締結部品の模式表示）",
    "kind": "part",
    "parent": "rearR",
    "children": [
      "rearR__fasteners__a0",
      "rearR__fasteners__a1",
      "rearR__fasteners__a2",
      "rearR__fasteners__a3",
      "rearR__fasteners__a4",
      "rearR__fasteners__b0",
      "rearR__fasteners__b1",
      "rearR__fasteners__b2",
      "rearR__fasteners__b3",
      "rearR__fasteners__b4"
    ]
  },
  {
    "id": "rearR__fasteners__a0",
    "name": "締結セット A1（例示）",
    "kind": "part",
    "parent": "rearR__fasteners",
    "children": [
      "rearR__fasteners__a0__bolt",
      "rearR__fasteners__a0__washer"
    ]
  },
  {
    "id": "rearR__fasteners__a0__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearR__fasteners__a0",
    "children": []
  },
  {
    "id": "rearR__fasteners__a0__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearR__fasteners__a0",
    "children": []
  },
  {
    "id": "rearR__fasteners__a1",
    "name": "締結セット A2（例示）",
    "kind": "part",
    "parent": "rearR__fasteners",
    "children": [
      "rearR__fasteners__a1__bolt",
      "rearR__fasteners__a1__washer"
    ]
  },
  {
    "id": "rearR__fasteners__a1__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearR__fasteners__a1",
    "children": []
  },
  {
    "id": "rearR__fasteners__a1__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearR__fasteners__a1",
    "children": []
  },
  {
    "id": "rearR__fasteners__a2",
    "name": "締結セット A3（例示）",
    "kind": "part",
    "parent": "rearR__fasteners",
    "children": [
      "rearR__fasteners__a2__bolt",
      "rearR__fasteners__a2__washer"
    ]
  },
  {
    "id": "rearR__fasteners__a2__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearR__fasteners__a2",
    "children": []
  },
  {
    "id": "rearR__fasteners__a2__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearR__fasteners__a2",
    "children": []
  },
  {
    "id": "rearR__fasteners__a3",
    "name": "締結セット A4（例示）",
    "kind": "part",
    "parent": "rearR__fasteners",
    "children": [
      "rearR__fasteners__a3__bolt",
      "rearR__fasteners__a3__washer"
    ]
  },
  {
    "id": "rearR__fasteners__a3__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearR__fasteners__a3",
    "children": []
  },
  {
    "id": "rearR__fasteners__a3__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearR__fasteners__a3",
    "children": []
  },
  {
    "id": "rearR__fasteners__a4",
    "name": "締結セット A5（例示）",
    "kind": "part",
    "parent": "rearR__fasteners",
    "children": [
      "rearR__fasteners__a4__bolt",
      "rearR__fasteners__a4__washer"
    ]
  },
  {
    "id": "rearR__fasteners__a4__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearR__fasteners__a4",
    "children": []
  },
  {
    "id": "rearR__fasteners__a4__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearR__fasteners__a4",
    "children": []
  },
  {
    "id": "rearR__fasteners__b0",
    "name": "締結セット B1（例示）",
    "kind": "part",
    "parent": "rearR__fasteners",
    "children": [
      "rearR__fasteners__b0__bolt",
      "rearR__fasteners__b0__washer"
    ]
  },
  {
    "id": "rearR__fasteners__b0__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearR__fasteners__b0",
    "children": []
  },
  {
    "id": "rearR__fasteners__b0__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearR__fasteners__b0",
    "children": []
  },
  {
    "id": "rearR__fasteners__b1",
    "name": "締結セット B2（例示）",
    "kind": "part",
    "parent": "rearR__fasteners",
    "children": [
      "rearR__fasteners__b1__bolt",
      "rearR__fasteners__b1__washer"
    ]
  },
  {
    "id": "rearR__fasteners__b1__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearR__fasteners__b1",
    "children": []
  },
  {
    "id": "rearR__fasteners__b1__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearR__fasteners__b1",
    "children": []
  },
  {
    "id": "rearR__fasteners__b2",
    "name": "締結セット B3（例示）",
    "kind": "part",
    "parent": "rearR__fasteners",
    "children": [
      "rearR__fasteners__b2__bolt",
      "rearR__fasteners__b2__washer"
    ]
  },
  {
    "id": "rearR__fasteners__b2__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearR__fasteners__b2",
    "children": []
  },
  {
    "id": "rearR__fasteners__b2__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearR__fasteners__b2",
    "children": []
  },
  {
    "id": "rearR__fasteners__b3",
    "name": "締結セット B4（例示）",
    "kind": "part",
    "parent": "rearR__fasteners",
    "children": [
      "rearR__fasteners__b3__bolt",
      "rearR__fasteners__b3__washer"
    ]
  },
  {
    "id": "rearR__fasteners__b3__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearR__fasteners__b3",
    "children": []
  },
  {
    "id": "rearR__fasteners__b3__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearR__fasteners__b3",
    "children": []
  },
  {
    "id": "rearR__fasteners__b4",
    "name": "締結セット B5（例示）",
    "kind": "part",
    "parent": "rearR__fasteners",
    "children": [
      "rearR__fasteners__b4__bolt",
      "rearR__fasteners__b4__washer"
    ]
  },
  {
    "id": "rearR__fasteners__b4__bolt",
    "name": "ボルト（形状・本数未確認）",
    "kind": "part",
    "parent": "rearR__fasteners__b4",
    "children": []
  },
  {
    "id": "rearR__fasteners__b4__washer",
    "name": "座金（例示）",
    "kind": "part",
    "parent": "rearR__fasteners__b4",
    "children": []
  },
  {
    "id": "transmission__case",
    "name": "ミッションケース",
    "kind": "part",
    "parent": "transmission",
    "children": []
  },
  {
    "id": "transmission__axle",
    "name": "車軸",
    "kind": "part",
    "parent": "transmission",
    "children": []
  },
  {
    "id": "transmission__pulley-a",
    "name": "プーリ A",
    "kind": "part",
    "parent": "transmission",
    "children": []
  },
  {
    "id": "transmission__pulley-b",
    "name": "プーリ B",
    "kind": "part",
    "parent": "transmission",
    "children": []
  },
  {
    "id": "transmission__belt",
    "name": "駆動ベルト（経路は模式）",
    "kind": "part",
    "parent": "transmission",
    "children": []
  },
  {
    "id": "pickerdrive__left",
    "name": "苗取出しリンク A",
    "kind": "part",
    "parent": "pickerdrive",
    "children": [
      "pickerdrive__left__crank",
      "pickerdrive__left__upper",
      "pickerdrive__left__lower"
    ]
  },
  {
    "id": "pickerdrive__left__crank",
    "name": "駆動アーム（模式）",
    "kind": "part",
    "parent": "pickerdrive__left",
    "children": []
  },
  {
    "id": "pickerdrive__left__upper",
    "name": "連結ロッド A",
    "kind": "part",
    "parent": "pickerdrive__left",
    "children": []
  },
  {
    "id": "pickerdrive__left__lower",
    "name": "連結ロッド B",
    "kind": "part",
    "parent": "pickerdrive__left",
    "children": []
  },
  {
    "id": "pickerdrive__right",
    "name": "苗取出しリンク B",
    "kind": "part",
    "parent": "pickerdrive",
    "children": [
      "pickerdrive__right__crank",
      "pickerdrive__right__upper",
      "pickerdrive__right__lower"
    ]
  },
  {
    "id": "pickerdrive__right__crank",
    "name": "駆動アーム（模式）",
    "kind": "part",
    "parent": "pickerdrive__right",
    "children": []
  },
  {
    "id": "pickerdrive__right__upper",
    "name": "連結ロッド A",
    "kind": "part",
    "parent": "pickerdrive__right",
    "children": []
  },
  {
    "id": "pickerdrive__right__lower",
    "name": "連結ロッド B",
    "kind": "part",
    "parent": "pickerdrive__right",
    "children": []
  },
  {
    "id": "pickerdrive__cross",
    "name": "連結軸",
    "kind": "part",
    "parent": "pickerdrive",
    "children": []
  },
  {
    "id": "picker__holder",
    "name": "爪の支持部",
    "kind": "part",
    "parent": "picker",
    "children": []
  },
  {
    "id": "picker__claw-a",
    "name": "苗取出し爪 A",
    "kind": "part",
    "parent": "picker",
    "children": []
  },
  {
    "id": "picker__claw-b",
    "name": "苗取出し爪 B",
    "kind": "part",
    "parent": "picker",
    "children": []
  },
  {
    "id": "picker__shaft",
    "name": "支点軸",
    "kind": "part",
    "parent": "picker",
    "children": []
  },
  {
    "id": "cupcase__cover",
    "name": "植付ケースカバー",
    "kind": "part",
    "parent": "cupcase",
    "children": []
  },
  {
    "id": "cupcase__fix-a",
    "name": "カバー取付部（例示）",
    "kind": "part",
    "parent": "cupcase",
    "children": []
  },
  {
    "id": "cupcase__fix-b",
    "name": "カバー取付部（例示）",
    "kind": "part",
    "parent": "cupcase",
    "children": []
  },
  {
    "id": "cup__half-a",
    "name": "植付カップ片 A",
    "kind": "part",
    "parent": "cup",
    "children": []
  },
  {
    "id": "cup__link-a",
    "name": "支持リンク A",
    "kind": "part",
    "parent": "cup",
    "children": []
  },
  {
    "id": "cup__half-b",
    "name": "植付カップ片 B",
    "kind": "part",
    "parent": "cup",
    "children": []
  },
  {
    "id": "cup__link-b",
    "name": "支持リンク B",
    "kind": "part",
    "parent": "cup",
    "children": []
  },
  {
    "id": "cup__ring",
    "name": "支持環",
    "kind": "part",
    "parent": "cup",
    "children": []
  },
  {
    "id": "cup__shaft",
    "name": "支点軸",
    "kind": "part",
    "parent": "cup",
    "children": []
  },
  {
    "id": "soilrubberF__rubber",
    "name": "前側の土落としゴム",
    "kind": "part",
    "parent": "soilrubberF",
    "children": []
  },
  {
    "id": "soilrubberF__support",
    "name": "支持棒",
    "kind": "part",
    "parent": "soilrubberF",
    "children": []
  },
  {
    "id": "soilrubberR__rubber",
    "name": "後側の土落としゴム",
    "kind": "part",
    "parent": "soilrubberR",
    "children": []
  },
  {
    "id": "soilrubberR__fasteners",
    "name": "取付部（締結部品の模式表示）",
    "kind": "part",
    "parent": "soilrubberR",
    "children": []
  },
  {
    "id": "roller__drum",
    "name": "ローラ本体",
    "kind": "part",
    "parent": "roller",
    "children": []
  },
  {
    "id": "roller__arm-a",
    "name": "支持部 A",
    "kind": "part",
    "parent": "roller",
    "children": []
  },
  {
    "id": "roller__arm-b",
    "name": "支持部 B",
    "kind": "part",
    "parent": "roller",
    "children": []
  },
  {
    "id": "pressL__roller",
    "name": "覆土ローラ本体",
    "kind": "part",
    "parent": "pressL",
    "children": []
  },
  {
    "id": "pressL__hub",
    "name": "中心支持部",
    "kind": "part",
    "parent": "pressL",
    "children": []
  },
  {
    "id": "pressL__arm",
    "name": "支持アーム",
    "kind": "part",
    "parent": "pressL",
    "children": []
  },
  {
    "id": "pressR__roller",
    "name": "覆土ローラ本体",
    "kind": "part",
    "parent": "pressR",
    "children": []
  },
  {
    "id": "pressR__hub",
    "name": "中心支持部",
    "kind": "part",
    "parent": "pressR",
    "children": []
  },
  {
    "id": "pressR__arm",
    "name": "支持アーム",
    "kind": "part",
    "parent": "pressR",
    "children": []
  },
  {
    "id": "drivecase__cover",
    "name": "チェーンケース外側カバー",
    "kind": "part",
    "parent": "drivecase",
    "children": []
  },
  {
    "id": "drivecase__back",
    "name": "ケース内側プレート",
    "kind": "part",
    "parent": "drivecase",
    "children": []
  },
  {
    "id": "drivecase__mount-a",
    "name": "ケース取付部 A",
    "kind": "part",
    "parent": "drivecase",
    "children": [
      "drivecase__mount-a__seat",
      "drivecase__mount-a__bolt"
    ]
  },
  {
    "id": "drivecase__mount-a__seat",
    "name": "取付座（模式）",
    "kind": "part",
    "parent": "drivecase__mount-a",
    "children": []
  },
  {
    "id": "drivecase__mount-a__bolt",
    "name": "取付ボルト（模式）",
    "kind": "part",
    "parent": "drivecase__mount-a",
    "children": []
  },
  {
    "id": "drivecase__mount-b",
    "name": "ケース取付部 B",
    "kind": "part",
    "parent": "drivecase",
    "children": [
      "drivecase__mount-b__seat",
      "drivecase__mount-b__bolt"
    ]
  },
  {
    "id": "drivecase__mount-b__seat",
    "name": "取付座（模式）",
    "kind": "part",
    "parent": "drivecase__mount-b",
    "children": []
  },
  {
    "id": "drivecase__mount-b__bolt",
    "name": "取付ボルト（模式）",
    "kind": "part",
    "parent": "drivecase__mount-b",
    "children": []
  },
  {
    "id": "console__lever-0",
    "name": "操作レバー A",
    "kind": "part",
    "parent": "console",
    "children": [
      "console__lever-0__shaft",
      "console__lever-0__knob"
    ]
  },
  {
    "id": "console__lever-0__shaft",
    "name": "レバー軸",
    "kind": "part",
    "parent": "console__lever-0",
    "children": []
  },
  {
    "id": "console__lever-0__knob",
    "name": "操作ノブ",
    "kind": "part",
    "parent": "console__lever-0",
    "children": []
  },
  {
    "id": "console__lever-1",
    "name": "操作レバー B",
    "kind": "part",
    "parent": "console",
    "children": [
      "console__lever-1__shaft",
      "console__lever-1__knob"
    ]
  },
  {
    "id": "console__lever-1__shaft",
    "name": "レバー軸",
    "kind": "part",
    "parent": "console__lever-1",
    "children": []
  },
  {
    "id": "console__lever-1__knob",
    "name": "操作ノブ",
    "kind": "part",
    "parent": "console__lever-1",
    "children": []
  },
  {
    "id": "console__lever-2",
    "name": "操作レバー C",
    "kind": "part",
    "parent": "console",
    "children": [
      "console__lever-2__shaft",
      "console__lever-2__knob"
    ]
  },
  {
    "id": "console__lever-2__shaft",
    "name": "レバー軸",
    "kind": "part",
    "parent": "console__lever-2",
    "children": []
  },
  {
    "id": "console__lever-2__knob",
    "name": "操作ノブ",
    "kind": "part",
    "parent": "console__lever-2",
    "children": []
  }
].map(n => Object.freeze({...n, children:Object.freeze(n.children)})));
const index = new Map(NODES.map(n => [n.id,n]));
export function resolveMachineRef(ref) {
  if (ref == null) return {status:'unselected', node:null};
  if (typeof ref !== 'object' || Array.isArray(ref)) return {status:'invalid', node:null};
  if (ref.machineId !== MACHINE_ID) return {status:'unknown-machine', node:null};
  if (ref.modelVersion !== MODEL_VERSION) return {status:'unknown-version', node:null};
  if (ref.partId === '') return {status:'unselected', node:null};
  if (typeof ref.partId !== 'string') return {status:'invalid', node:null};
  const node = index.get(ref.partId);
  return node ? {status:node.id === ROOT_PART_ID ? 'whole' : 'resolved', node} : {status:'unknown-part', node:null};
}
