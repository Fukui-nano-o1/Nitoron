# 共有3DホストAPI（Nitoron側の引き継ぎ）

対象：`src/machine/engine/host.js`（`getSharedMachineHost()`）と `host-core.js`。
契約の原本は3D引き渡しパッケージ（版2、機種版 `skp-101w@daf7afab`）のHOST-API.md。
このファイルはNitoron統合で確定した追記事項を残す。API仕様の重複記載は最小限にする。

## 呼び出しの基本形

```js
const { getSharedMachineHost } = await import('./machine/engine/host.js')
const host = getSharedMachineHost()
const request = host.acquire(container, { mode: 'card', onRelease, onError })
const lease = await request.ready
if (lease) lease.focus(machineRef)
// 指を離す・unmount・別操作の開始。ready解決前でも取消できる。
request.cancel()
```

- rendererは全カード・選択ビューで共有1個。`host.state.rendererCount` は保持オブジェクト数で、GPU測定値ではない。
- `mode:'inspect'` はOrbitControls・`onPick`（現在階層の直下だけを返す）・`setScope`・`select`・`setDragMode` を使う。

## Nitoron統合で確定した注意点（2026-09-10）

1. **acquireする時点で、コンテナがDOMに接続済みかつ可視サイズ（幅・高さ > 0）を持っていること。**
   バックエンドはmount直後にサイズを測り、0サイズや未接続は即 `release('hidden' / 'detached')` になる。
   Reactの `hidden` 属性やstate切替でコンテナを隠すと、hostモジュールがキャッシュ済みのとき
   再描画より先にacquireが走って0サイズを踏む。Nitoronでは、canvasの載せ先を
   **常時サイズを持つ透明オーバーレイ**（`.machine-canvas-slot`：absolute inset:0・pointer-events:none）
   にして解決した（`MachineCardMedia.jsx`）。canvasの有無自体が表示状態になる。
2. **個別カードのunmount・プレビュー終了では `request.cancel()`（またはlease.release()）だけを呼ぶ。**
   `host.dispose()` は共有rendererごと破棄して他のカードも止めるため、画面全体を離れるときに限る。
3. **動的importの待ち時間はホストでは判定できない。** 長押しごとに世代番号を持ち、
   `await import` の直後に「まだ同じ操作中か」を確認してからacquireする。指が離れていたら
   acquireしない（`MachineCardMedia.jsx` の generation カウンタ）。
4. **contextmenuの抑止は機械メディア（`.machine-press`）に限定している。**
   Chromiumは長押し約500msでcontextmenu→pointercancelを発火し、プレビューが打ち切られるため。
   通常カード・本文・保存ハートには適用しない。iPhone Safariで同じ挙動かは**実機未確認**で、
   `-webkit-touch-callout:none` を併用しているが、実機確認事項として残す。

## 検証の入口

- 実ブラウザの手動確認：リポジトリ直下を静的配信して `tests/machine-browser.html` を開く。
- Node検証：`node --test tests/machine-scene.test.mjs tests/machine-host.test.mjs`（19項目）。
- 元ソース検証：`node vendor/parts-lab/scripts/check-assemblies.mjs` / `check-camera.mjs`。
