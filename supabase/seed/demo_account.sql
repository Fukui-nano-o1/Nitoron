-- Nitoron demo account seed. Run with the postgres/service role (bypasses RLS).
-- Creates two demo users, three sample publications labeled 記入例, and one
-- feedback dialogue so the catalog demonstrates the product before real users post.
-- Idempotent: fixed UUIDs with upserts; re-running refreshes the demo content.
-- To remove everything: delete from auth.users where id in
--   ('de300000-0000-4000-8000-000000000001','de300000-0000-4000-8000-000000000002');
do $seed$
declare
  demo_owner constant uuid := 'de300000-0000-4000-8000-000000000001';
  demo_visitor constant uuid := 'de300000-0000-4000-8000-000000000002';
  demo_feedback constant uuid := 'de300000-0000-4000-8000-000000000201';
  demo_reply constant uuid := 'de300000-0000-4000-8000-000000000301';
  rec jsonb;
begin
  -- Reserved example.com addresses receive no mail; random password hashes mean
  -- nobody can sign in as these users. Content changes go through this script.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    is_anonymous, confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current)
  values
    ('00000000-0000-0000-0000-000000000000', demo_owner, 'authenticated', 'authenticated',
     'nitoron-demo-farmer@example.com', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}', '{"nitoron_demo":true}', now(), now(),
     false, '', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', demo_visitor, 'authenticated', 'authenticated',
     'nitoron-demo-visitor@example.com', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}', '{"nitoron_demo":true}', now(), now(),
     false, '', '', '', '', '')
  on conflict (id) do nothing;
  insert into auth.identities (id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id::text, u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
    'email', now(), now(), now()
  from auth.users u
  where u.id in (demo_owner, demo_visitor)
    and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

  for rec in select value from jsonb_array_elements($records$[
{
  "id": "de300000-0000-4000-8000-000000000101",
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
}
]$records$::jsonb)
  loop
    insert into public.notes (id, user_id, title, category, type, date, blocks, created_at, updated_at)
    values ((rec->>'id')::uuid, demo_owner, rec->>'title', rec->>'category', rec->>'type', (rec->>'date')::date,
      (rec->'blocks') || jsonb_build_array(jsonb_build_object(
        'id', (rec->>'id') || '-meta', 'type', 'nitoron-presentation-v1', 'data', rec->'meta')),
      now(), now())
    on conflict (id) do update set title = excluded.title, category = excluded.category,
      type = excluded.type, date = excluded.date, blocks = excluded.blocks, updated_at = now();
    insert into public.nitoron_publications (id, owner_id, snapshot, is_public)
    values ((rec->>'id')::uuid, demo_owner, rec, true)
    on conflict (id) do update set snapshot = excluded.snapshot, is_public = true;
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
