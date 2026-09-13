# Nitoron 修理 UI 候補 — 2026-09-13

修理を発表から分け、説明をボタンに収納し、詳細で保存部品と全体→部品の3D表示を復元する候補です。**ブラウザ検査は未実行**。取り込み前に `CLAUDE-HANDOFF.md` と `BROWSER-CHECK.md` を確認してください。

- 基点：`cef74ab6c36d0b19f381b7973d0dcf6fb4a8f3e7`。このコミットは文書追加で、実行コードは親 `e18e5c632d1fe930c42a7306c44336c56016f825` と同じです。
- `candidate.patch` が本体への差分。`candidate/` は同じ変更ファイルの閲覧用です。モデル生成・寸法値・DBスキーマは変更していません。
- `Nitoron-Repair-UX-Preview.html` は端末保存だけの操作プレビュー。ログイン・公開管理・クラウド同期の本体検査を代替しません。実機iPhoneは未確認です。
- 証拠：関連Node検査64/64、サーバー描画の契約6/6、本体ビルド成功。`evidence/` に出力を保存しています。実修理の成功を示す結果ではありません。

## 検証・適用

変更のない検証用チェックアウトを用意し、以下を実行します。検証器はファイルを書き換えません。既存の作業をresetしないでください。

```sh
node /path/to/package/verify-package.mjs --repo /path/to/repository
git -C /path/to/repository apply --check /path/to/package/candidate.patch
git -C /path/to/repository apply /path/to/package/candidate.patch
```

適用したリポジトリで既存の依存関係を使用します。

```sh
node --test tests/domain.test.js tests/machine-domain.test.js tests/machine-host.test.mjs tests/machine-scene.test.mjs tests/repair-animation.test.mjs tests/repair-result-draft.test.mjs tests/repair-transfer-session.test.js tests/repair-workspace.test.js
npm run build
```

自動公開・本番記録作成・DB変更は含みません。HTML単体の再生成は `preview-source/README.md` を参照してください。
