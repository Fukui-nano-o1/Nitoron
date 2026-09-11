# Nitoron v4：同じ部品仮定でカメラ予測を比較する

2026-09-11 / Codex作成・Claude Code検証用

## 結論と今回の目的

v3は「接続は条件付き採用、配置仮定は未支持」で終了する。利用者共有のClaude報告では、前面9点のカメラLOO/平均位置LOOは0.836、背面5点は1.281だった。次は**部品仮定を変えず、カメラの自由度を増やすと除外点の2D予測が改善するか**だけを検証する。

確認基点：`6d1008ec913bae1563a3059c7238562d8dbabbe7`。2026-09-11にGitHubのコミットと対象ソースのGit blobを確認。後続変更があれば保持する。mainを過去へ戻さない。

Codexが修正コードを用意し、Claudeが同じPC752N実ジョブで検証する分担を継続。利用者にPC作業、資料の再入力、座標入力を依頼しない。新しいPDFとZIPを受け取ったClaudeは、以下の一巡まで実行して報告する。

## 提案に含まれた説明を修正する

- `u = A X + t`（Aは2×3、tは2要素）の一般アフィンは8係数。せん断や軸別倍率を許し、物理的な弱透視カメラそのものではない。メトリックな弱透視モデルの2行は等しい長さで直交する。v4はそれを強制しない。
- 「カメラ表現不足が消え、残差がそのまま形状の質になる」とは言えない。形状、カメラ、引出線終点と部品中心のずれ、誤対応などは依然混在する。
- 任意の可逆行列Hに対し、`X'=HX`、`A'=AH^-1`なら投影は同じ。形状を変えても除外点の予測が一致する合成例をテストした。低い誤差も実形状の証明にはならない。
- 背面5点のLOOは学習4点。各画像座標の4係数がrank=4なら決まるが、残差自由度は0。学習誤差0は支持条件にしない。共平面・重複中心・悪条件なら明示停止する。

今回のカメラは実機用3Dの生成器として採用しない。資料照合済み3D=0、工程A未達、奥行き・左右・前後の実機一致は未確認を維持する。

## 変更範囲

すべて新規ファイル。v1/v2/v3、本来のatlas生成処理、22種の形状・中心座標・名称対応、領域分割、DB、公開サイトは変更しない。

| 新規ファイル | 役割 |
| --- | --- |
| `affine-camera.mjs` | 訓練点だけで正規化し、列ピボット付きHouseholder QRで8係数を求める |
| `camera-comparison.mjs` | v3と同じ部品・領域・除外IDで、一般アフィン／既存格子／平均位置を比較 |
| `camera-viewer.mjs` | 3種類の除外予測を資料上に表示する2D診断画面 |
| `run-cameras.mjs` | 原ジョブを読取専用で一巡。旧v3結果もgrid/へ無変更で出力 |
| `check-camera-browser.cjs` | 390/1280pxでJSONとSVG座標・欠測表示・部品選択を確認 |
| `tests/atlas-affine.test.js` | 数値解・rank・悪条件・除外点非混入・入力不変・形状の非一意性など12件 |

上記mjs/cjsはすべて`scripts/atlas/experimental/`配下。標準Nodeライブラリのみ追加使用。QRは独自の小規模実装であり、LAPACKの呼び出しや同等性を主張しない。比較画面はThree不要・CDNなし。旧3D画面だけが従来の同梱vendorを使用する。

## 固定した数値条件

- 領域の最低点数5、各LOOの最低学習点数4を維持。
- 訓練点だけの3D中心と等方RMS広がりで正規化する。軸ごとに別の標準化をして薄い配置を隠さない。
- rank相対閾値`1e-10`。4未満は`rank-deficient`、代替カメラや擬似逆行列で続行しない。
- 正規化したQR因子Rの無限大ノルム条件数 `||R||∞ ||R^-1||∞` が`1e8`を超えれば`ill-conditioned`。これはRに対する数値診断で、SVDの条件数や物理精度ではない。
- 各foldに学習ID、rank、条件数、残差自由度、予測座標、誤差、predictionGainを記録。predictionGainは学習画素ノイズの線形増幅係数で、実測誤差の信頼区間ではない。
- 失敗foldを平均から落とさない。1件でも予測不能ならその集合のRMSEはnull。0や資料点で埋めない。
- 全点／旧点／追加点を別集計。学習残差は診断のみ。上記閾値は実データを見て緩めない。

## Claudeへの実行指示（この一巡で区切る）

1. 現在のHEAD・origin/main・作業ツリー・6d1008eの祖先関係を確認。最新変更を保持し、ZIPのパッチを`git apply --check`後に1回だけ適用。files/の上書きとパッチの二重適用は禁止。
2. 関連4ファイルのテストを実行。v3の同じPC752N実ジョブを使う。machine.jsonとfigure-p18.pngの完全なSHAを実行前後に記録。旧報告の省略SHAから値を推測しない。取得・OCRのやり直しや機種変更はしない。
3. 下記の新コマンドを別々の新規出力先で3回実行。既存出力先は拒否される。camera-comparison.json、regions.json、grid/experiment.jsonのSHAが3回一致することを確認。run.jsonの実行時間は一致対象外。
4. 主要2領域が同じ前面9・背面5、全25点の所属が同じであることをv3出力と照合。grid/experiment.jsonとregions.jsonは同じ原ジョブのrun-priors.mjs結果とバイト比較する。符号17/18は入力JSONを基準にし、報告の表記に合わせて修正しない。
5. 下記ブラウザ検査と既存check-browser.cjsをgrid/に対して実行。比較画面の初期表示はアフィンLOO。3方式のSVG座標とJSON一致、計算不能点の十字なし、領域切替、部品診断表示、画面外予測の表示、外部リクエスト0を確認。390/1280pxの画像を添付。iPhone実機は未確認として別記。
6. 全テストとビルドを実行し、以下の固定判定で一括報告。依存解決やChromiumパスだけの環境修正はdiffを添付。点・部品・閾値・合格条件の改変はしない。この一巡が未支持なら追加探索せず停止する。

```sh
git apply --check <ZIPを展開した場所>/codex-atlas-cameras-v4.patch
git apply <ZIPを展開した場所>/codex-atlas-cameras-v4.patch
node --test tests/atlas-hypothesis.test.js tests/atlas-regions.test.js tests/atlas-priors.test.js tests/atlas-affine.test.js
node scripts/atlas/experimental/run-cameras.mjs <original-job> --out <new-directory>
node scripts/atlas/experimental/check-camera-browser.cjs <new-directory>
node scripts/atlas/experimental/check-browser.cjs <new-directory>/grid
npm test
npm run build
```

`<...>`は実在するパスに置き換える。出力先の親ディレクトリは事前に用意する。ブラウザには既存Playwrightまたはplaywright-core、必要なら`ATLAS_CHROMIUM_PATH`を使う。新規課金はしない。

exit 0は「少なくとも1領域で全アフィンLOOが計算できた」の意味で、採用ではない。全領域で未計算なら`no-complete-affine-loo`をJSONへ残しexit 1。引数・ファイル不備は実行エラーとして区別する。

## 固定する達成判定

| 判定 | 条件 |
| --- | --- |
| 接続成立 | 同じ原本・22仮定・全25所属・前面9/背面5。旧v3結果不変、混合0、3回SHA一致、必要な表示検査・回帰合格 |
| 予測改善を条件付き支持 | **両主要領域それぞれ**全foldがrank4・条件数上限内。全点と旧点の両集計で、アフィンLOOが旧格子LOOと平均位置LOOの**両方より小さい**。各比率<1。明確な誤対応がない |
| 未支持 | 比率が1以上。学習残差だけ改善。あるいは片方の領域だけ改善 |
| 評価不能 | 不足点、rank不足、悪条件、非有限値、比較値の欠測。分母0の比はnullとし、改善の証拠に数えない |

支持できても結論は「この資料の固定仮定に対し、柔軟な写像が2D予測を改善した」。カメラだけが原因だった／形状が正しい／資料照合済み3Dになった、とは言わない。同じ資料を繰り返し開発に使っており、他機種への独立検証でもない。

## 報告形式

結論→数値→原因候補→次の仮説1つ。必要な数値は前面/背面ごとの点数、全foldのrankと条件数、残差自由度、全点・旧点・追加点の3方式RMSE、2つの比率、領域対角比、最大predictionGain、停止理由と部品名。名称/符号/ID/元画像XY/除外予測XY/学習IDの一覧を添付。

提出物：camera-comparison.json、regions.json・SVG、grid/experiment.json、run.json、viewer.htmlとgrid/viewer.html、画像、修正diff、mainのSHA。通常mainプッシュの既存許可は維持。主処理への接続、強制プッシュ、DB・実データ変更、デプロイ、新規課金は含めない。

## Codexの検証範囲

Node v24.19.0で関連50件（既存38＋新規12）を検証対象とする。既知アフィン解・共平面停止・悪条件停止・除外点非混入・原本不変・再現性・旧v3との一致を合成データで確認。実PC752Nのジョブはこの作業環境にないため、v4の実点数・誤差・支持判定を確認していない。全リポジトリ回帰/ビルド、実ブラウザ、iPhoneもClaude側で確認する。最終実行結果は同梱MANIFEST.jsonを参照。

## 根拠・確認日

- 現行コード：Fukui-nano-o1/Nitoron [6d1008e](https://github.com/Fukui-nano-o1/Nitoron/commit/6d1008ec913bae1563a3059c7238562d8dbabbe7)、2026-09-11確認。v3の実数値は同日の利用者共有Claude報告による。
- Shimshoni, Basri, Rivlin, “A Geometric Interpretation of Weak-Perspective Motion”, IEEE PAMI 21(3), 1999年3月。[原論文](https://www.weizmann.ac.il/math/ronen/sites/math.ronen/files/uploads/shimshomi_basri_rivlin_-_geometric_interpretation_of_weak-perspective_motion.pdf)、2026-09-11確認。弱透視の等方スケールと回転の関係の参照。
- [LAPACK DGELSY公式説明](https://netlib.org/lapack/explore-html/dc/d8b/group__gelsy_ga6d1d46ead18df76e993cd4eda6dc1bbb.html)、2026-09-11確認。列ピボットQRと数値rank判定の参考。v4のコードは独自実装。
- 可逆Hによる形状と写像の非一意性、および今回の支持条件はCodexの数式検討・実験設計。メーカー資料からの形状寸法ではない。
