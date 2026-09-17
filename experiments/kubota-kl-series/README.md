# クボタ初期KLシリーズ

確認日：2026-09-17

## 対象

公式販売年度検索で1999年または2000年に販売開始となる、初期KL世代の基本15型式を対象とする。既存8型式を補完し、未登録のH付き7型式を追加する。Hを落とした架空の基本型式は作らない。

KLで始まる全世代を完了したという意味ではない。KL210等の後継世代、KL-R（キングウェルアール）、KL-Z/ZH（ゼロキングウェル）は今回の対象外。全prefix検索の行は保持し、採用しない行には理由を記録する。

| 型式 | 公式取説索引の出力 | 公式販売期間 | 処理 |
|---|---:|---|---|
| KL21 | 21馬力 | 1999〜2003年 | 既存を補完 |
| KL23 | 23馬力 | 1999〜2003年 | 既存を補完 |
| KL25 | 25馬力 | 1999〜2003年 | 既存を補完 |
| KL27 | 27馬力 | 1999〜2003年 | 既存を補完 |
| KL28H | 28馬力 | 2000〜2003年 | 追加 |
| KL30 | 30馬力 | 1999〜2003年 | 既存を補完 |
| KL31H | 31馬力 | 2000〜2003年 | 追加 |
| KL33 | 33馬力 | 1999〜2003年 | 既存を補完 |
| KL34H | 34馬力 | 2000〜2003年 | 追加 |
| KL36 | 36馬力 | 2000〜2004年 | 既存を補完 |
| KL38H | 38馬力 | 2000〜2004年 | 追加 |
| KL41H | 41馬力 | 2000〜2004年 | 追加 |
| KL43 | 43馬力 | 2000〜2004年 | 既存を補完 |
| KL46H | 46馬力 | 2000〜2004年 | 追加 |
| KL50H | 50馬力 | 2000〜2004年 | 追加 |

## 取扱説明書と同世代の別型式

今回参照する公式資料は19件。基本型式15件、同型式のPC仕様2件、同世代の別型式2件で構成する。

- KL25-PC・KL33-PCは各KL25・KL33カードの仕様別資料に対応付ける。
- KL41-PC・KL50-PCは各KL41H・KL50Hカードの「同世代の別型式」に分けて掲載する。これは閲覧しやすくするための編集上の関連付けであり、H機への適用取説とは扱わない。
- KL41Hは41馬力、KL41-PCは42馬力。型式名・馬力・販売期間を混同しない。KL50HとKL50-PCも名称を分けて記載する。
- KL25-PCとKL33-PCの販売期間は2000〜2003年。KL41-PCとKL50-PCは2001〜2004年。後者2件は基本15型式の集計へ追加しない。

PC4型式の公式PDFは、共通の4ページ補足資料であることを表紙で確認した。タイヤ仕様との差異を説明し、その他は本編取説を参照する構成。表紙にはKL41H・KL50Hへの適用指定がないため、H機の取説との同一視はしない。PDF本体・画像はリポジトリやサービスに転載せず、公式noticeへのリンクと独自の短い説明のみを掲載する。

## 調査範囲と証拠

- 取扱説明書のKL前方一致検索：9ページ・204行。トラクタ160行、他カテゴリ44行。
- 販売年度のKL前方一致検索：5ページ・124行。
- 今回採用：取説19行・販売年19行（基本15、PC4）。
- 対象外：取説185行（後継世代141、他カテゴリ44）、販売年105行。
- 基本15型式について、完全一致の取説検索15件と型式別販売年検索15件、参照するnotice19件をHTTP 200とSHA-256で確認した。
- 販売年索引の型式前に付く「＊」「●」は注記記号として正規化する。証拠にはrawModelを残す。
- 公式検索自体が過去の全製品の掲載を保証していないため、網羅性は取得した公式索引の対象世代について述べる。

証拠ファイル：

- `source-checks.json`：基本15型式の型式・馬力・販売年・直接出典。
- `index-pages.json`：全14ページの検索行と取得ハッシュ（研究元は`pages.json`）。
- `related-documents.json`：19資料、19販売年行、関連付け、対象外行と除外理由。
- `sibling-mapping-check.json`：PC共通補足資料の表紙確認。PDF本体は含めない。

## 公式出典

- [取扱説明書 KL前方一致](https://agriculture.kubota.co.jp/after-support/manual/list.html?q=KL&searchType=2)
- [販売年度 KL前方一致](https://agriculture.kubota.co.jp/after-support/psyss/list.html?searchType=2&category=1&q=KL)
- [2010年 キングウェルアール発売](https://www.kubota.co.jp/news/2010/tractor100624.html)
- [2011年 ゼロキングウェル発売](https://www.kubota.co.jp/news/2011/zerokingwel.html)

写真・生成カード・画面・掲載データの検証結果は、対応するチェックJSONに記録する。公式PDFと中古実機写真を混同せず、写真の型式・出典を各カードに保持する。

## 再生成・検証

```bash
for model in kl21 kl23 kl25 kl27 kl28h kl30 kl31h kl33 kl34h kl36 kl38h kl41h kl43 kl46h kl50h; do
  node scripts/catalog-to-record.mjs "data/catalog/kubota/${model}.json"
done
node experiments/kubota-historical-tractors/check-records.mjs experiments/kubota-kl-series/source-checks.json
node experiments/kubota-kl-series/check-series.mjs
node --test tests/catalog-data.test.js tests/catalog-domain.test.js
npm run build
```

`photo-checks.json` は掲載元と画像のHTTPS応答・寸法・型式照合・目視結果を記録する。販売元が別ホストのCDNを使う場合は、取得した掲載ページに画像URLが埋め込まれていることも確認し、掲載ページのハッシュと対応付ける。

`coverage-check.json` は基本15型式・資料19件・販売年度19件の対応と写真重複を検査する。`browser-check.json` はローカルの実画面に保存予定データと取得済みの画像バイトを与えた表示確認。`database-check.json` は掲載データとの一致・重複・対象外データの維持を確認する。各工程の完了は、そのレポートを参照する。
