-- Nitoron demo account seed. Run with the postgres/service role (bypasses RLS).
-- Operator-run accounts: one per machinery maker publishing repair guides
-- (clearly labeled unofficial), plus a drafts account holding unpublished
-- writing examples and a visitor account for the sample dialogue.
-- No maker impersonation, no reposted photos/videos/manuals: guide bodies are
-- original text and sources link to official pages only.
-- Idempotent: fixed UUIDs with upserts; re-running refreshes the demo content.
-- To remove everything: delete from auth.users
--   where raw_user_meta_data->>'nitoron_demo' = 'true';
do $seed$
declare
  demo_owner constant uuid := 'de300000-0000-4000-8000-000000000001';
  demo_visitor constant uuid := 'de300000-0000-4000-8000-000000000002';
  demo_feedback constant uuid := 'de300000-0000-4000-8000-000000000201';
  demo_reply constant uuid := 'de300000-0000-4000-8000-000000000301';
  usr jsonb;
  rec jsonb;
begin
  -- Reserved example.com addresses receive no mail; random password hashes mean
  -- nobody can sign in as these users. Content changes go through this script.
  for usr in select value from jsonb_array_elements($users$[
    {"id": "de300000-0000-4000-8000-000000000001", "email": "nitoron-demo-farmer@example.com"},
    {"id": "de300000-0000-4000-8000-000000000002", "email": "nitoron-demo-visitor@example.com"},
    {"id": "de300000-0000-4000-8000-000000000011", "email": "nitoron-demo-yanmar@example.com"},
    {"id": "de300000-0000-4000-8000-000000000012", "email": "nitoron-demo-kubota@example.com"},
    {"id": "de300000-0000-4000-8000-000000000013", "email": "nitoron-demo-iseki@example.com"},
    {"id": "de300000-0000-4000-8000-000000000014", "email": "nitoron-demo-mitsubishi@example.com"}
  ]$users$::jsonb)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      is_anonymous, confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current)
    values ('00000000-0000-0000-0000-000000000000', (usr->>'id')::uuid, 'authenticated', 'authenticated',
      usr->>'email', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{"nitoron_demo":true}', now(), now(),
      false, '', '', '', '', '')
    on conflict (id) do nothing;
    insert into auth.identities (id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), usr->>'id', (usr->>'id')::uuid,
      jsonb_build_object('sub', usr->>'id', 'email', usr->>'email', 'email_verified', true),
      'email', now(), now(), now()
    where not exists (select 1 from auth.identities i
      where i.user_id = (usr->>'id')::uuid and i.provider = 'email');
  end loop;

  -- Policy: the demo account publishes machine-repair guides only. The crop
  -- records stay as unpublished drafts ("public": false) as writing examples.
  for rec in select value from jsonb_array_elements($records$[
{
  "id": "de300000-0000-4000-8000-000000000101",
  "owner": "de300000-0000-4000-8000-000000000001",
  "public": false,
  "title": "【記入例】ミニトマトの灌水を、勘からpF値の基準に切り替えた1作",
  "category": "ミニトマト", "type": "メモ", "date": "2026-07-25",
  "blocks": [{"id": "de300000-0000-4000-8000-000000000101-b1", "type": "text", "text": ""}],
  "meta": {
    "schema": 1, "kind": "presentation", "inputMode": "sections",
    "author": "Nitoron運営（記入例）", "club": "", "crop": "ミニトマト", "variety": "千果",
    "region": "熊本県玉名市", "areaA": "10", "start": "2026-02-10", "end": "2026-07-20",
    "coverUrl": "",
    "summary": "※Nitoron運営が作成した記入例です。実在の農場のデータではありません。灌水の判断を担当者の勘からpF値の基準に切り替え、裂果による廃棄を週12kgから4kgに減らした1作の記録です。",
    "issue": "灌水の開始と量を担当者の感覚で決めており、人によって裂果の出方が大きくぶれていた。廃棄が週10kgを超える週もあり、可販果率は82%前後で頭打ちだった。",
    "hypothesis": "土壌水分をpF1.8〜2.3の範囲に保てば、急激な吸水による裂果が減り、可販果率を90%まで上げられると考えた。",
    "action": "土壌水分センサーを2畝に1本ずつ設置し、朝夕にpF値を記録。pF2.3を超えたら点滴灌水を15分行うルールに統一した。従来どおり感覚で灌水する畝を2畝残し、収穫のたびに裂果数を分けて数えた。",
    "result": "センサー区の可販果率は91%、従来区は83%。裂果による廃棄はセンサー区で週平均4kg、従来区で11kg。総収量はほぼ同じだった。",
    "interpretation": "効果は増収ではなく「捨てる量が減った」ことに出た。雨後に急いで灌水を再開していたことが裂果の主因だった可能性が高い。ただしセンサー2本では畝ごとの土の差を拾いきれておらず、数値は代表値でしかない。",
    "learning": "次作は全畝にセンサーを入れ、夏の高温期はpF基準を見直す。灌水ルールを紙1枚にまとめ、誰が作業しても同じ判断になるようにする。",
    "conditions": "2〜7月作、ハウス2棟・点滴灌水。比較した畝は同じ定植日・同じ苗。",
    "stage": "仮説", "target": "", "deadline": "", "criterion": "",
    "revenue": "1840000", "cost": "260000", "hours": "310", "yieldKg": "3900",
    "observations": [
      {"id": "de300000-0000-4000-8000-000000000101-o1", "date": "2026-05-14", "fact": "梅雨入り直後の週、従来区だけ裂果が週19kgに増えた", "conditions": "3日間の曇雨天のあと晴天", "evidence": "収穫時の選別記録"},
      {"id": "de300000-0000-4000-8000-000000000101-o2", "date": "2026-06-02", "fact": "センサー区のpFが2.3を超えた日は2週間で3日だけだった", "conditions": "", "evidence": "朝夕のpF記録表"}
    ],
    "sources": [], "attachments": [], "origin": null
  }
},
{
  "id": "de300000-0000-4000-8000-000000000102",
  "owner": "de300000-0000-4000-8000-000000000001",
  "public": false,
  "title": "【記入例】秋冬キャベツ、2回目の追肥を10日早めた区と慣行区の比較",
  "category": "キャベツ", "type": "メモ", "date": "2026-02-05",
  "blocks": [{"id": "de300000-0000-4000-8000-000000000102-b1", "type": "text", "text": ""}],
  "meta": {
    "schema": 1, "kind": "presentation", "inputMode": "sections",
    "author": "Nitoron運営（記入例）", "club": "", "crop": "キャベツ", "variety": "彩音",
    "region": "愛知県田原市", "areaA": "30", "start": "2025-09-01", "end": "2026-01-31",
    "coverUrl": "",
    "summary": "※Nitoron運営が作成した記入例です。実在の農場のデータではありません。2回目の追肥を10日早めた区と慣行区を同じ圃場で並べ、L玉率と規格外率を比較しました。",
    "issue": "年末出荷の玉の大きさが揃わず、規格外が2割近く出ていた。結球初期に肥効が切れている疑いがあった。",
    "hypothesis": "2回目の追肥を慣行の11月上旬から10月下旬へ10日早めれば、結球初期の肥効切れがなくなり、L玉率と出荷率が上がると考えた。",
    "action": "同じ圃場を2区に分け、片方だけ2回目の追肥（高度化成、10a当たり40kg）を10月22日に前倒し。他の管理は同一にして、収穫時にL玉率と規格外率を区別して記録した。",
    "result": "前倒し区はL玉率58%・規格外14%、慣行区はL玉率46%・規格外19%。収穫の最盛期は4日早まった。",
    "interpretation": "結球初期の肥効が効いた可能性が高い。ただし今年は10月の気温が平年より高く、その影響と切り分けできていない。1年の結果で断定はできない。",
    "learning": "来作も同じ比較を続けて2年分のデータにする。10月の地温も記録項目に加える。",
    "conditions": "露地・秋冬どり。両区とも同じ播種日・同じ元肥。",
    "stage": "仮説", "target": "", "deadline": "", "criterion": "",
    "revenue": "2150000", "cost": "480000", "hours": "260", "yieldKg": "12400",
    "observations": [
      {"id": "de300000-0000-4000-8000-000000000102-o1", "date": "2025-11-10", "fact": "前倒し区は外葉の色が濃く、結球の巻きが早かった", "conditions": "", "evidence": "週1回の生育写真"}
    ],
    "sources": [], "attachments": [], "origin": null
  }
},
{
  "id": "de300000-0000-4000-8000-000000000103",
  "owner": "de300000-0000-4000-8000-000000000001",
  "public": false,
  "title": "【記入例】市場出荷7割の販売を、1年で直販5割に切り替える挑戦",
  "category": "アスパラガス", "type": "メモ", "date": "2026-08-30",
  "blocks": [{"id": "de300000-0000-4000-8000-000000000103-b1", "type": "text", "text": ""}],
  "meta": {
    "schema": 1, "kind": "challenge", "inputMode": "sections",
    "author": "Nitoron運営（記入例）", "club": "", "crop": "アスパラガス", "variety": "",
    "region": "長野県", "areaA": "20", "start": "2026-04-01", "end": "",
    "coverUrl": "",
    "summary": "※Nitoron運営が作成した記入例です。実在の農場のデータではありません。市場出荷中心の販売を、1年かけて直販5割へ切り替える挑戦の途中経過です。",
    "issue": "販売の9割が市場出荷で、単価を自分で決められない。運賃と手数料を引くと手取りが伸びない。",
    "hypothesis": "朝採りの鮮度を武器に、直売所2カ所とSNS予約販売を組み合わせれば、単価を市場比1.4倍にしても売り切れると考えた。",
    "action": "4月から直売所2カ所に出荷枠を確保し、収穫日の朝にSNSで予約を受け付ける運用を開始。週ごとに直販比率と売れ残り率を記録している。",
    "result": "8月末時点で直販比率は31%。売れ残りは週平均3%で、廃棄はほぼ出ていない。",
    "interpretation": "平日の直売所は伸びが鈍く、比率を押し上げているのはSNS予約分。5割達成の鍵は予約客のリピート率になりそうだ。",
    "learning": "9月からリピート客向けの定期便を試す。単価を下げる値引きはしない。",
    "conditions": "",
    "stage": "実践中",
    "target": "2027年3月までに直販比率50%",
    "deadline": "2027-03-31",
    "criterion": "月間売上に占める直販の割合（出荷伝票と直販記録で算出）",
    "revenue": "", "cost": "", "hours": "", "yieldKg": "",
    "observations": [
      {"id": "de300000-0000-4000-8000-000000000103-o1", "date": "2026-07-05", "fact": "SNS予約は受付開始から3時間で完売する週が続いた", "conditions": "", "evidence": "予約フォームの記録"}
    ],
    "sources": [], "attachments": [], "origin": null
  }
},
{
  "id": "de300000-0000-4000-8000-000000000104",
  "owner": "de300000-0000-4000-8000-000000000011",
  "public": true,
  "title": "【整備ガイド】ヤンマートラクターのエンジンオイル・オイルフィルタ交換",
  "category": "トラクター", "type": "メモ", "date": "2026-09-08",
  "blocks": [
    {"id": "de300000-0000-4000-8000-000000000104-b01", "type": "text", "text": "作業は自己責任で行ってください。必ず平坦な場所でエンジンを停止し、キーを抜いてから始めます。型式ごとの規定（オイル量・粘度・交換間隔）はお手元の取扱説明書が最優先です。このガイドは公道走行に関わる保安部品や排出ガス関連装置には一切触れません。"},
    {"id": "de300000-0000-4000-8000-000000000104-b02", "type": "h2", "text": "交換の目安"},
    {"id": "de300000-0000-4000-8000-000000000104-b03", "type": "bullet", "text": "新車・オーバーホール後の初回は早め（目安50時間）に交換する"},
    {"id": "de300000-0000-4000-8000-000000000104-b04", "type": "bullet", "text": "以降は200〜250時間ごと、使用が少なくても酸化するため年1回は交換する"},
    {"id": "de300000-0000-4000-8000-000000000104-b05", "type": "bullet", "text": "オイルフィルタはオイル交換2回に1回以上。迷ったら同時交換が確実"},
    {"id": "de300000-0000-4000-8000-000000000104-b06", "type": "h2", "text": "用意するもの"},
    {"id": "de300000-0000-4000-8000-000000000104-b07", "type": "bullet", "text": "取扱説明書で指定された粘度・規格のディーゼル用エンジンオイル（規定量）"},
    {"id": "de300000-0000-4000-8000-000000000104-b08", "type": "bullet", "text": "適合するオイルフィルタと新品のドレンパッキン"},
    {"id": "de300000-0000-4000-8000-000000000104-b09", "type": "bullet", "text": "廃油処理箱、オイルジョッキ、メガネレンチ、フィルタレンチ、ウエス、手袋"},
    {"id": "de300000-0000-4000-8000-000000000104-b10", "type": "h2", "text": "手順"},
    {"id": "de300000-0000-4000-8000-000000000104-b11", "type": "bullet", "text": "1. 平坦地に駐車し、駐車ブレーキをかけ、エンジン停止・キー抜き。数分の暖機後ならオイルが温かく抜けやすい（火傷に注意）"},
    {"id": "de300000-0000-4000-8000-000000000104-b12", "type": "bullet", "text": "2. エンジン下部のドレンプラグの真下に廃油受けを置き、プラグを外して古いオイルを抜き切る"},
    {"id": "de300000-0000-4000-8000-000000000104-b13", "type": "bullet", "text": "3. オイルフィルタをフィルタレンチで反時計回りに外す。残ったオイルがこぼれるのでウエスを添える"},
    {"id": "de300000-0000-4000-8000-000000000104-b14", "type": "bullet", "text": "4. 新しいフィルタのOリングに新油を薄く塗り、取り付け面に当たってから手で確実に締める（工具で締めすぎない）"},
    {"id": "de300000-0000-4000-8000-000000000104-b15", "type": "bullet", "text": "5. ドレンプラグを新しいパッキンとともに締め付ける"},
    {"id": "de300000-0000-4000-8000-000000000104-b16", "type": "bullet", "text": "6. 給油口から規定量の7〜8割を入れ、検油ゲージを確認しながら上限線まで補給する"},
    {"id": "de300000-0000-4000-8000-000000000104-b17", "type": "bullet", "text": "7. エンジンを始動して油圧ランプの消灯を確認。停止して数分置き、油量の再点検とドレン・フィルタ周りの漏れ確認をする"},
    {"id": "de300000-0000-4000-8000-000000000104-b18", "type": "h2", "text": "よくある失敗"},
    {"id": "de300000-0000-4000-8000-000000000104-b19", "type": "bullet", "text": "ドレンパッキンの入れ忘れ・再利用によるオイル滲み"},
    {"id": "de300000-0000-4000-8000-000000000104-b20", "type": "bullet", "text": "古いフィルタのOリングが取り付け面に貼り付いたまま新品を締めて二重になり、漏れる"},
    {"id": "de300000-0000-4000-8000-000000000104-b21", "type": "bullet", "text": "上限線を超える入れすぎ。多すぎも白煙や不調の原因になる"},
    {"id": "de300000-0000-4000-8000-000000000104-b22", "type": "bullet", "text": "オイル管理時間（メンテナンスモニター）のリセット忘れ"},
    {"id": "de300000-0000-4000-8000-000000000104-b23", "type": "h2", "text": "廃油の処分"},
    {"id": "de300000-0000-4000-8000-000000000104-b24", "type": "text", "text": "廃油と使用済みフィルタは、購入店・ガソリンスタンド・産業廃棄物処理業者に引き取りを依頼してください。野焼きや埋め立ては廃棄物処理法違反です。"},
    {"id": "de300000-0000-4000-8000-000000000104-b25", "type": "text", "text": "写真・動画の転載は行っていません。実際の作業の様子は、出典・資料欄のヤンマー公式ページを参照してください。"}
  ],
  "meta": {
    "schema": 1, "kind": "learning", "inputMode": "free",
    "author": "ヤンマー整備ガイド（Nitoron運営・非公式）", "club": "", "crop": "トラクター", "variety": "",
    "region": "", "areaA": "", "start": "", "end": "", "coverUrl": "",
    "summary": "※ヤンマー株式会社とは無関係の、Nitoron運営による非公式アカウントです。公式サイトの公開情報をもとに自分の言葉でまとめた整備ガイドで、写真・動画・取扱説明書の転載はせず、出典欄に公式ページへのリンクのみ掲載しています。作業は自己責任で、型式ごとの取扱説明書を優先してください。",
    "issue": "", "hypothesis": "", "action": "", "result": "",
    "interpretation": "", "learning": "", "conditions": "",
    "stage": "仮説", "target": "", "deadline": "", "criterion": "",
    "revenue": "", "cost": "", "hours": "", "yieldKg": "",
    "observations": [],
    "sources": [
      {"id": "de300000-0000-4000-8000-000000000104-s1", "title": "ヤンマー公式：トラクターのセルフ点検・交換", "url": "https://www.yanmar.com/jp/agri/afterservice_support/selfcheck/tractor/", "date": "2026-09-08"},
      {"id": "de300000-0000-4000-8000-000000000104-s2", "title": "ヤンマー公式：純正オイルとフィルタ", "url": "https://www.yanmar.com/jp/agri/afterservice_support/oils_filter/", "date": "2026-09-08"}
    ],
    "attachments": [], "origin": null
  }
},
{
  "id": "de300000-0000-4000-8000-000000000105",
  "owner": "de300000-0000-4000-8000-000000000012",
  "public": true,
  "title": "【整備ガイド】クボタトラクターのエンジンオイル・オイルフィルタ交換",
  "category": "トラクター", "type": "メモ", "date": "2026-09-08",
  "blocks": [
    {"id": "de300000-0000-4000-8000-000000000105-b01", "type": "text", "text": "作業は自己責任で行ってください。必ず平坦な場所でエンジンを停止し、キーを抜いてから始めます。オイルの規格・粘度・規定量は型式ごとの取扱説明書が最優先です。このガイドは公道走行に関わる保安部品や排出ガス関連装置には一切触れません。"},
    {"id": "de300000-0000-4000-8000-000000000105-b02", "type": "h2", "text": "交換の目安"},
    {"id": "de300000-0000-4000-8000-000000000105-b03", "type": "bullet", "text": "新車・オーバーホール後の初回は早め（目安50時間）に交換する"},
    {"id": "de300000-0000-4000-8000-000000000105-b04", "type": "bullet", "text": "以降は取扱説明書の指定間隔で。使用が少なくても酸化するため年1回は交換する"},
    {"id": "de300000-0000-4000-8000-000000000105-b05", "type": "bullet", "text": "オイルフィルタはオイルと同時交換が理想。クボタは同時交換前提のメンテナンス部品パックも出している"},
    {"id": "de300000-0000-4000-8000-000000000105-b06", "type": "h2", "text": "オイル選びの注意（ここが最重要）"},
    {"id": "de300000-0000-4000-8000-000000000105-b07", "type": "bullet", "text": "DPF（排気フィルタ）搭載エンジンには必ずDH-2規格のオイルを使う。従来オイルを入れるとマフラー（DPF）の早期詰まりの原因になる"},
    {"id": "de300000-0000-4000-8000-000000000105-b08", "type": "bullet", "text": "自分の機体がDPF搭載かどうか・指定粘度と規定量は、取扱説明書と型式表示で確認する"},
    {"id": "de300000-0000-4000-8000-000000000105-b09", "type": "h2", "text": "用意するもの"},
    {"id": "de300000-0000-4000-8000-000000000105-b10", "type": "bullet", "text": "指定規格・粘度のエンジンオイル（規定量）、適合オイルフィルタ、新品ドレンパッキン"},
    {"id": "de300000-0000-4000-8000-000000000105-b11", "type": "bullet", "text": "廃油処理箱、オイルジョッキ、メガネレンチ、フィルタレンチ、ウエス、手袋"},
    {"id": "de300000-0000-4000-8000-000000000105-b12", "type": "h2", "text": "手順"},
    {"id": "de300000-0000-4000-8000-000000000105-b13", "type": "bullet", "text": "1. 平坦地に駐車し駐車ブレーキ、エンジン停止・キー抜き。オイルは温かいうちのほうが抜けやすい（火傷に注意）"},
    {"id": "de300000-0000-4000-8000-000000000105-b14", "type": "bullet", "text": "2. ドレンプラグの真下に廃油受けを置き、プラグを外して古いオイルを抜き切る"},
    {"id": "de300000-0000-4000-8000-000000000105-b15", "type": "bullet", "text": "3. オイルフィルタをフィルタレンチで外す。残油がこぼれるのでウエスを添える"},
    {"id": "de300000-0000-4000-8000-000000000105-b16", "type": "bullet", "text": "4. 新品フィルタのパッキン面に新油を薄く塗り、取り付け面に当たってから手で確実に締める"},
    {"id": "de300000-0000-4000-8000-000000000105-b17", "type": "bullet", "text": "5. ドレンプラグを新しいパッキンとともに締める"},
    {"id": "de300000-0000-4000-8000-000000000105-b18", "type": "bullet", "text": "6. 規定量の8割ほどを入れ、検油ゲージを確認しながら上限線まで補給する"},
    {"id": "de300000-0000-4000-8000-000000000105-b19", "type": "bullet", "text": "7. エンジンを始動して油圧警告灯の消灯と漏れの有無を確認。停止して数分置き、油量を再点検する"},
    {"id": "de300000-0000-4000-8000-000000000105-b20", "type": "h2", "text": "よくある失敗"},
    {"id": "de300000-0000-4000-8000-000000000105-b21", "type": "bullet", "text": "DPF搭載機に手持ちの古い規格のオイルを入れてしまう（DH-2以外は不可）"},
    {"id": "de300000-0000-4000-8000-000000000105-b22", "type": "bullet", "text": "ドレンパッキンの再利用によるオイル滲み"},
    {"id": "de300000-0000-4000-8000-000000000105-b23", "type": "bullet", "text": "上限線を超える入れすぎ。多すぎも不調の原因になる"},
    {"id": "de300000-0000-4000-8000-000000000105-b24", "type": "h2", "text": "廃油の処分"},
    {"id": "de300000-0000-4000-8000-000000000105-b25", "type": "text", "text": "廃油と使用済みフィルタは、購入店・ガソリンスタンド・産業廃棄物処理業者に引き取りを依頼してください。野焼きや埋め立ては廃棄物処理法違反です。"},
    {"id": "de300000-0000-4000-8000-000000000105-b26", "type": "text", "text": "写真・動画の転載は行っていません。実際の作業の様子は、出典・資料欄のクボタ公式ページを参照してください。"}
  ],
  "meta": {
    "schema": 1, "kind": "learning", "inputMode": "free",
    "author": "クボタ整備ガイド（Nitoron運営・非公式）", "club": "", "crop": "トラクター", "variety": "",
    "region": "", "areaA": "", "start": "", "end": "", "coverUrl": "",
    "summary": "※株式会社クボタとは無関係の、Nitoron運営による非公式アカウントです。公式サイトの公開情報をもとに自分の言葉でまとめた整備ガイドで、写真・動画・取扱説明書の転載はせず、出典欄に公式ページへのリンクのみ掲載しています。作業は自己責任で、型式ごとの取扱説明書を優先してください。",
    "issue": "", "hypothesis": "", "action": "", "result": "",
    "interpretation": "", "learning": "", "conditions": "",
    "stage": "仮説", "target": "", "deadline": "", "criterion": "",
    "revenue": "", "cost": "", "hours": "", "yieldKg": "",
    "observations": [],
    "sources": [
      {"id": "de300000-0000-4000-8000-000000000105-s1", "title": "クボタ公式：エンジンオイルの点検・交換方法（トラクタのセルフメンテナンス）", "url": "https://agriculture.kubota.co.jp/after-support/self-maintenance/tractor/01.html", "date": "2026-09-08"},
      {"id": "de300000-0000-4000-8000-000000000105-s2", "title": "クボタ公式：エンジンオイルフィルタの交換方法（トラクタのセルフメンテナンス）", "url": "https://agriculture.kubota.co.jp/after-support/self-maintenance/tractor/02.html", "date": "2026-09-08"}
    ],
    "attachments": [], "origin": null
  }
},
{
  "id": "de300000-0000-4000-8000-000000000106",
  "owner": "de300000-0000-4000-8000-000000000013",
  "public": true,
  "title": "【整備ガイド】イセキコンバインの収穫後の掃除と格納整備",
  "category": "コンバイン", "type": "メモ", "date": "2026-09-08",
  "blocks": [
    {"id": "de300000-0000-4000-8000-000000000106-b01", "type": "text", "text": "作業は自己責任で行ってください。必ずエンジンを停止してキーを抜き、すべての回転部が完全に止まってから触れます。刈刃・こぎ胴まわりは厚手の手袋を着用してください。項目や各部の位置は機種で異なるため、取扱説明書が最優先です。"},
    {"id": "de300000-0000-4000-8000-000000000106-b02", "type": "h2", "text": "なぜ収穫後すぐやるか"},
    {"id": "de300000-0000-4000-8000-000000000106-b03", "type": "text", "text": "機内に残った藁くず・籾は湿気を吸って錆の原因になり、ねずみを呼び込んで配線かじりの故障につながります。収穫後すぐの掃除と格納整備が、翌シーズンのトラブルを最も減らします。"},
    {"id": "de300000-0000-4000-8000-000000000106-b04", "type": "h2", "text": "掃除"},
    {"id": "de300000-0000-4000-8000-000000000106-b05", "type": "bullet", "text": "点検カバーを開け、こぎ胴・受網まわりの藁くずと籾をエアや刷毛で奥まで取り除く"},
    {"id": "de300000-0000-4000-8000-000000000106-b06", "type": "bullet", "text": "刈取部の泥・藁を落とし、刈刃の欠け・摩耗・ガタを点検する"},
    {"id": "de300000-0000-4000-8000-000000000106-b07", "type": "bullet", "text": "走行部（クローラー）の泥を落とし、張りと損傷を点検する"},
    {"id": "de300000-0000-4000-8000-000000000106-b08", "type": "bullet", "text": "エンジンルームの藁くずは火災と、ねずみの巣の原因。特に念入りに"},
    {"id": "de300000-0000-4000-8000-000000000106-b09", "type": "h2", "text": "注油・グリスアップ"},
    {"id": "de300000-0000-4000-8000-000000000106-b10", "type": "bullet", "text": "各チェーンに注油し、グリスニップルへグリスを充填する"},
    {"id": "de300000-0000-4000-8000-000000000106-b11", "type": "bullet", "text": "刈刃には防錆油を薄く塗っておく"},
    {"id": "de300000-0000-4000-8000-000000000106-b12", "type": "h2", "text": "格納"},
    {"id": "de300000-0000-4000-8000-000000000106-b13", "type": "bullet", "text": "燃料タンクは満タンにして内部の結露を防ぐ（機種の取扱説明書の指示があればそちらに従う）"},
    {"id": "de300000-0000-4000-8000-000000000106-b14", "type": "bullet", "text": "バッテリーのマイナス端子を外す。長期格納なら取り外して月1回の補充電が確実"},
    {"id": "de300000-0000-4000-8000-000000000106-b15", "type": "bullet", "text": "雨の当たらない風通しの良い場所に、クローラーは硬く平らな地面に置いて格納する"},
    {"id": "de300000-0000-4000-8000-000000000106-b16", "type": "h2", "text": "よくある失敗"},
    {"id": "de300000-0000-4000-8000-000000000106-b17", "type": "bullet", "text": "籾・藁を残したまま格納し、ねずみに配線をかじられて翌シーズン始動不能"},
    {"id": "de300000-0000-4000-8000-000000000106-b18", "type": "bullet", "text": "バッテリー端子を外さず放置して、翌シーズンにバッテリー上がり"},
    {"id": "de300000-0000-4000-8000-000000000106-b19", "type": "bullet", "text": "水洗い後に注油せず、刈刃とチェーンを錆びさせる"},
    {"id": "de300000-0000-4000-8000-000000000106-b20", "type": "text", "text": "写真・動画の転載は行っていません。作業箇所の図解は、出典・資料欄のイセキ公式ページとセルフチェック冊子（PDF）を参照してください。"}
  ],
  "meta": {
    "schema": 1, "kind": "learning", "inputMode": "free",
    "author": "イセキ整備ガイド（Nitoron運営・非公式）", "club": "", "crop": "コンバイン", "variety": "",
    "region": "", "areaA": "", "start": "", "end": "", "coverUrl": "",
    "summary": "※井関農機株式会社とは無関係の、Nitoron運営による非公式アカウントです。公式サイトの公開情報をもとに自分の言葉でまとめた整備ガイドで、写真・動画・取扱説明書の転載はせず、出典欄に公式ページへのリンクのみ掲載しています。作業は自己責任で、機種ごとの取扱説明書を優先してください。",
    "issue": "", "hypothesis": "", "action": "", "result": "",
    "interpretation": "", "learning": "", "conditions": "",
    "stage": "仮説", "target": "", "deadline": "", "criterion": "",
    "revenue": "", "cost": "", "hours": "", "yieldKg": "",
    "observations": [],
    "sources": [
      {"id": "de300000-0000-4000-8000-000000000106-s1", "title": "イセキ公式：コンバインの点検整備ポイント", "url": "https://products.iseki.co.jp/combine/check/", "date": "2026-09-08"},
      {"id": "de300000-0000-4000-8000-000000000106-s2", "title": "イセキ公式：イージーセルフチェックBOOK コンバイン編（PDF）", "url": "https://products.iseki.co.jp/cms/upload/products/self_check-2.pdf", "date": "2026-09-08"}
    ],
    "attachments": [], "origin": null
  }
},
{
  "id": "de300000-0000-4000-8000-000000000107",
  "owner": "de300000-0000-4000-8000-000000000014",
  "public": true,
  "title": "【整備ガイド】三菱ミニ耕うん機の耕うん爪交換と使用後のお手入れ",
  "category": "耕うん機", "type": "メモ", "date": "2026-09-08",
  "blocks": [
    {"id": "de300000-0000-4000-8000-000000000107-b01", "type": "text", "text": "作業は自己責任で行ってください。必ずエンジンを停止し、不意の始動を防ぐため点火プラグのキャップを外し、燃料コックを閉じてから作業します。適合する爪や締め付けの指定は機種ごとの取扱説明書が最優先です。"},
    {"id": "de300000-0000-4000-8000-000000000107-b02", "type": "h2", "text": "爪交換の目安"},
    {"id": "de300000-0000-4000-8000-000000000107-b03", "type": "bullet", "text": "爪は使うほど短く・細く摩耗する。新品の3分の2程度まで減ったら交換を検討。耕うんが浅くなり、時間と燃料が余計にかかるようになる"},
    {"id": "de300000-0000-4000-8000-000000000107-b04", "type": "bullet", "text": "石などで曲がり・欠けが出た爪は、残りの長さに関係なく交換する"},
    {"id": "de300000-0000-4000-8000-000000000107-b05", "type": "h2", "text": "用意するもの"},
    {"id": "de300000-0000-4000-8000-000000000107-b06", "type": "bullet", "text": "機種に適合する耕うん爪セット、メガネレンチ、固着時用の浸透潤滑剤、厚手の手袋"},
    {"id": "de300000-0000-4000-8000-000000000107-b07", "type": "h2", "text": "交換手順"},
    {"id": "de300000-0000-4000-8000-000000000107-b08", "type": "bullet", "text": "1. エンジン停止・プラグキャップ抜き・燃料コック閉。機体をぐらつかないよう安定させる"},
    {"id": "de300000-0000-4000-8000-000000000107-b09", "type": "bullet", "text": "2. 外す前に爪の並びをスマホで撮影する。爪には左右の向きがあり、間違えると耕えない"},
    {"id": "de300000-0000-4000-8000-000000000107-b10", "type": "bullet", "text": "3. 爪軸の取り付けボルトを外して古い爪を抜く。固着していたら浸透潤滑剤を吹いてから軽く叩く"},
    {"id": "de300000-0000-4000-8000-000000000107-b11", "type": "bullet", "text": "4. 新しい爪を撮影した並びと同じ向き・同じ位置で取り付け、ボルトを確実に締める"},
    {"id": "de300000-0000-4000-8000-000000000107-b12", "type": "bullet", "text": "5. 全部付け終えたら手で爪軸をゆっくり回し、機体との干渉や締め忘れがないか確認する"},
    {"id": "de300000-0000-4000-8000-000000000107-b13", "type": "h2", "text": "使用後のお手入れ（毎回）"},
    {"id": "de300000-0000-4000-8000-000000000107-b14", "type": "bullet", "text": "爪と爪軸まわりの泥・草を落とす。草の巻き付き放置は爪軸オイルシール損傷とオイル漏れの原因"},
    {"id": "de300000-0000-4000-8000-000000000107-b15", "type": "bullet", "text": "水洗い後は水気を拭き取り、可動部に注油する"},
    {"id": "de300000-0000-4000-8000-000000000107-b16", "type": "bullet", "text": "雨の当たらない場所で保管。長期保管時の燃料の扱い（抜く/満タン）は取扱説明書の指示に従う"},
    {"id": "de300000-0000-4000-8000-000000000107-b17", "type": "h2", "text": "よくある失敗"},
    {"id": "de300000-0000-4000-8000-000000000107-b18", "type": "bullet", "text": "爪の左右の向きを逆に取り付けて、まったく耕えない"},
    {"id": "de300000-0000-4000-8000-000000000107-b19", "type": "bullet", "text": "ボルトの締め不足で、作業中に爪が脱落する"},
    {"id": "de300000-0000-4000-8000-000000000107-b20", "type": "bullet", "text": "草の巻き付きを放置して、オイル漏れになってから気づく"},
    {"id": "de300000-0000-4000-8000-000000000107-b21", "type": "text", "text": "写真・動画の転載は行っていません。各部の名称と手入れ箇所は、出典・資料欄の三菱マヒンドラ農機公式ページを参照してください。"}
  ],
  "meta": {
    "schema": 1, "kind": "learning", "inputMode": "free",
    "author": "三菱マヒンドラ農機整備ガイド（Nitoron運営・非公式）", "club": "", "crop": "耕うん機", "variety": "",
    "region": "", "areaA": "", "start": "", "end": "", "coverUrl": "",
    "summary": "※三菱マヒンドラ農機株式会社とは無関係の、Nitoron運営による非公式アカウントです。公式サイトの公開情報をもとに自分の言葉でまとめた整備ガイドで、写真・動画・取扱説明書の転載はせず、出典欄に公式ページへのリンクのみ掲載しています。作業は自己責任で、機種ごとの取扱説明書を優先してください。",
    "issue": "", "hypothesis": "", "action": "", "result": "",
    "interpretation": "", "learning": "", "conditions": "",
    "stage": "仮説", "target": "", "deadline": "", "criterion": "",
    "revenue": "", "cost": "", "hours": "", "yieldKg": "",
    "observations": [],
    "sources": [
      {"id": "de300000-0000-4000-8000-000000000107-s1", "title": "三菱マヒンドラ農機公式：ミニ耕うん機のお手入れ（各部の掃除）", "url": "https://www.mam.co.jp/saien/start/9-1.php", "date": "2026-09-08"},
      {"id": "de300000-0000-4000-8000-000000000107-s2", "title": "三菱マヒンドラ農機公式：取扱説明書・閲覧", "url": "https://support.mam.co.jp/manual/", "date": "2026-09-08"}
    ],
    "attachments": [], "origin": null
  }
}
]$records$::jsonb)
  loop
    -- Publication identity is immutable; on an ownership move delete the note,
    -- which cascades to the publication, and let the upserts recreate both.
    delete from public.notes
    where id = (rec->>'id')::uuid and user_id is distinct from (rec->>'owner')::uuid;
    insert into public.notes (id, user_id, title, category, type, date, blocks, created_at, updated_at)
    values ((rec->>'id')::uuid, (rec->>'owner')::uuid, rec->>'title', rec->>'category', rec->>'type', (rec->>'date')::date,
      (rec->'blocks') || jsonb_build_array(jsonb_build_object(
        'id', (rec->>'id') || '-meta', 'type', 'nitoron-presentation-v1', 'data', rec->'meta')),
      now(), now())
    on conflict (id) do update set title = excluded.title, category = excluded.category,
      type = excluded.type, date = excluded.date, blocks = excluded.blocks, updated_at = now();
    insert into public.nitoron_publications (id, owner_id, snapshot, is_public)
    values ((rec->>'id')::uuid, (rec->>'owner')::uuid, rec - 'public' - 'owner',
      coalesce((rec->>'public')::boolean, false))
    on conflict (id) do update set snapshot = excluded.snapshot, is_public = excluded.is_public;
  end loop;

  -- The feedback rate-limit trigger requires verified auth claims; impersonate
  -- the demo users for these inserts only (transaction-local settings).
  perform set_config('request.jwt.claims',
    json_build_object('sub', demo_visitor, 'role', 'authenticated')::text, true);
  insert into public.nitoron_feedback (id, publication_id, user_id, author, kind, section, body)
  values (demo_feedback, 'de300000-0000-4000-8000-000000000101', demo_visitor,
    '見学者（記入例）', '質問', '実践したこと',
    'センサーの設置位置は畝のどのあたりですか？株元からの距離で数値がかなり変わると聞いたので、条件を教えてほしいです。')
  on conflict (id) do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', demo_owner, 'role', 'authenticated')::text, true);
  insert into public.nitoron_feedback_replies (id, feedback_id, publication_id, user_id, author, body)
  values (demo_reply, demo_feedback, 'de300000-0000-4000-8000-000000000101', demo_owner,
    'Nitoron運営（記入例）',
    '株元から約15cm・深さ15cmに挿し、2本とも位置を揃えました。ご指摘のとおり位置で値が変わるので、全畝に広げる次作では設置手順そのものも記録に残す予定です。')
  on conflict (id) do nothing;
  perform set_config('request.jwt.claims', '', true);
  insert into public.nitoron_feedback_resolutions (feedback_id, publication_id, user_id, status)
  values (demo_feedback, 'de300000-0000-4000-8000-000000000101', demo_owner, '対応済み')
  on conflict (feedback_id) do update set status = '対応済み';
end
$seed$;
