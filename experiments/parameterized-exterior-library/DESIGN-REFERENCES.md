# 先行製品から採用した設計

公式資料確認日：2026-09-11。

|出典|公式資料で確認した機能|今回への適用（Codexの設計判断）|
|---|---|---|
|[Onshape Configurations](https://cad.onshape.com/help/Content/PartStudio/configurations.htm)|部品やアセンブリ等のバリエーションをパラメータで構成。|曲面生成は1つ、断面・寸法はデータ保存。|
|[Onshape Derived](https://cad.onshape.com/help/Content/PartStudio/derived.htm)|別の部品等を参照し、位置と参照版を指定できる。|形状と配置を分離し、版を固定して明示更新。|
|[Cadasio Features](https://www.cadasio.com/features)|CAD形状変更を既存プロジェクトの表示ステップへ反映。|部品ID・姿勢・分解・透過・視点を形状から分け、交換時に維持。|

公開機能の確認であり、内部ソース/アルゴリズムの確認ではない。同製品と同等のCAD精度・機能・処理性能を主張しない。製品独自のコード・モデル素材は使用していない。基盤は既存Three.js r180 / MIT。

採用した教訓：毎機種で全てを作り直さず、生成規則・形状データ・配置・表示状態の変更箇所を分ける。部品実寸・適合・製造情報には別の根拠が必要。
