# 操作プレビューの再生成

本体へ候補を適用したリポジトリと、その依存関係を使用します。`esbuild` をこのスクリプトからimportできるNode環境を別に用意してください。本体のpackage.json変更は不要です。

```sh
node build-preview.mjs --repo /path/to/applied-repository --out /path/to/temporary-output
```

`preview.jsx` は本体コンポーネントを使い、専用のlocalStorageキーにだけ保存します。生成時にSupabase接続モジュールを無接続のスタブへ差し替えるのは、このプレビューだけです。本体コードは差し替えません。

`ssr-check.jsx` は実施した6件の検査のソースです。生成済みHTMLのバイト一致は受入条件にしません。バンドラー環境の違いを含む再ビルド後は実操作を確認してください。
