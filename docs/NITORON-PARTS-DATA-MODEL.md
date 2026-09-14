# 部品データの保存方式（設計メモ）

作成日：2026-09-14 ／ 基点：main `b87cf25`
前提：サイトは3D特化のまま。路線は「カタログ＋症状で修理案内」。部品は一つずつ保存し、新商品は「同じ型で寸法・形が違うだけ」として扱う。

## 1. 結論

**4層に分けて、全部 Git 管理の JSON にする。利用者の記録だけ DB。**

| 層 | 何を保存するか | 機種に依存するか | 変更できるか |
|---|---|---|---|
| A 部品レシピ | 形の作り方＝族（family）＋寸法パラメータ | しない | 不変。直すときは新しい版（revision）を足す |
| B 配置（組立） | どのレシピを、どの親の下に、どの位置・向きで置くか。分解方向 | する（型式＋モデル版ごと） | 版ごとに不変 |
| C 根拠 | 各数値・各配置の出所（URL・SHA・PDF頁・図ID）と、公称／実測／推定の区別、確認日 | する | 追記のみ |
| D 修理知識 | 症状 → 点検箇所（部品ID）→ 原典頁 → 対処候補 → 記録の型 | する | 版ごとに不変 |

3Dは A×B を描画した結果であり、保存対象ではない。GLB は生成物で、ソースは JSON。

## 2. なぜ Git の JSON か

- 部品データは「レビューして版を固定する」性質で、コードと同じ扱いが合う。既に `src/machine/catalog.js` は「固定コミットから生成、IDを振り直さない」で運用している。
- 版の不変・同版上書き拒否・SHA照合は、部品庫（`experiments/reusable-parts-catalog`）で実装済み。DBよりGitのほうが自然に守れる。
- localStorage は開発用の一時保存であって保存先ではない。Supabase は利用者の修理記録用。カタログを DB に入れるのは、機種が数百を超えて配信量が問題になってから（そのときも Git を正本にし、ビルドで配信する）。

## 3. 置き場所（提案）

```
data/
  parts/<family>/<key>.json            … A 部品レシピ（1部品1ファイル、版は配列）
  categories/<category>/template.json  … B の雛形：その型の機械が持つ部品枠（slot）と既定の族
  machines/<maker>/<model>/<version>/
    assembly.json                      … B 配置：slot → レシピ版＋位置・向き・親・分解方向
    evidence.json                      … C 根拠：数値・配置ごとの出所と区別
    faults.json                        … D 症状→部品ID→原典頁→対処候補
    sources.json                       … 資料台帳（URL・SHA・取得日・使用範囲）
scripts/build-machines.mjs             … data/ → src/machine/generated/ を生成（今の catalog.js と同じ流儀）
```

利用者の記録（`machineRef{machineId, modelVersion, partId}` を持つ修理記録）は今までどおり端末保存＋Supabase。記録はカタログを**参照する**だけで、カタログを変更しない。

## 4. 形式の例

**A 部品レシピ** `data/parts/wheel/lug-tyre.json`
```json
{ "key": "wheel/lug-tyre", "family": "lugTyre", "units": "mm", "generator": "lug-tyre-v1",
  "revisions": [
    { "revision": "1", "params": { "bodyRadius": 210.67, "width": 140, "lugs": 14, "lugHeight": 32 },
      "basis": { "bodyRadius": "derived-from-nominal:457", "width": "estimated", "lugs": "photo", "lugHeight": "estimated" },
      "sources": ["skp-101w:manual:p108"], "created": "2026-09-12" } ] }
```

**B 配置** `data/machines/kubota/skp-101w/daf7afab/assembly.json`（抜粋）
```json
{ "machineId": "skp-101w", "modelVersion": "skp-101w@daf7afab", "units": "mm", "datum": "authored-fixed-origin",
  "nominal": { "length": 2200, "width": 1350, "height": 1350, "basis": "manual:p108", "fit": false },
  "slots": [
    { "partId": "rearL", "name": "左後輪", "group": "system-2", "recipe": "wheel/lug-tyre@1",
      "position": [-370, 266, -600], "quaternion": [0, 0, 0, 1], "explode": [-300, 25, -620],
      "basis": { "position": "estimated", "recipe": "nominal-diameter" } } ] }
```

**C 根拠**：数値1つに出所1つ。`declared`（資料の公称値）／`measured`（実測）／`estimated`（写真・推定）／`derived`（別の値から計算）を必ず付ける。出所のない数値は保存しない。

**D 修理知識** `faults.json`：既存 `skp-faults.js`＋`GUIDES` をそのまま JSON 化する（症状・部品ID・原典頁・確認手順・実施前条件）。

## 5. 「型は同じ、大きさが違う」をどう表すか

1. **族**（family）は形の作り方。ボルト・ラグタイヤ・断面曲面カバー・箱・棒・管など。今あるのは bolt / nut / washer / cable / ribbedPanel / archedLoft / lugTyre（車輪）と、生成関数 box / rod / tube / disc / plate / shell。
2. **雛形**（category template）は機械の型。「歩行型移植機は エンジン・タンク・エアクリーナ・前輪×2・後輪×2・苗台…の枠を持つ」を1回書く。
3. **新機種**＝雛形の枠に、族ごとの寸法を入れ、位置を入れる。形の作り方は増やさない。増えるのは数値と根拠だけ。
4. 雛形に無い部品が出たら、そのときだけ族か枠を足す。これが「手作りが減っていく」唯一の経路。

## 6. 守る規則（過去2週間で確定したもの）

- 同じ版は上書きしない。直すなら新しい版。
- 全体外寸に合わせて拡縮しない（軸ごとの倍率で形が歪んだ実績あり）。原点固定・倍率1。公称値は参照。
- 部品IDは振り直さない。記録がIDを参照している。
- 根拠のない数値を入れない。推定は推定と書く。
- 資料照合済み3D部品（documented3dParts）は、C に `measured` または独立資料での照合がある部品だけ数える。

## 7. 最初の一歩（大改造はしない）

1. SKP-101W の `skp-model.js` から、33群の位置・向き・分解方向を `assembly.json` に書き出す（生成コードは当面そのまま呼ぶ。「legacy」族として登録）。
2. 既に数値化できている部品（車輪4・カウリング1・ボルト類）だけ A のレシピにする。
3. `skp-faults.js` と `GUIDES` を `faults.json` へ。
4. ビルドで `catalog.js` 相当を生成し、本体の表示・記録参照が変わらないことを既存テストで確認。
5. 2機種目（同じ型の別サイズ）で、雛形からどれだけ数値入力だけで作れるかを計る。ここで初めて「削減」を数字で言える。
