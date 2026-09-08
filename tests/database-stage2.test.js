import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { newRecord, snapshot } from '../src/domain.js'
const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222', TEMP = '33333333-3333-4333-8333-333333333333'
const DOC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', DOC2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PATH = `${OWNER}/${DOC}/cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf`
test('写真・資料、保存リスト、返信、対応状況のSQL権限', async t => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, is_anonymous boolean, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${OWNER}',false,now()),('${OTHER}',false,now()),('${TEMP}',true,null);
      create table public.notes(id uuid primary key, user_id uuid not null references auth.users(id), title text, blocks jsonb);
      insert into notes values ('${DOC}','${OWNER}','DRAFT','[]'),('${DOC2}','${OTHER}','OTHER DRAFT','[]');
      alter table notes enable row level security;grant select,insert,update,delete on notes to authenticated;
      create policy notes_owner on notes to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, unique(bucket_id,name));
      create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
      grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;
      alter table storage.objects enable row level security;`)
    await db.exec(await readFile(new URL('../supabase/migrations/20260907034224_nitoron_publications_and_feedback.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20260908110127_nitoron_files_saved_and_dialogue.sql', import.meta.url), 'utf8'))
    const as = async (who, sql, params = []) => {
      await db.exec(`set role ${who ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub','${who || ''}',false);`)
      try { return await db.query(sql, params) } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);") }
    }
    const r = newRecord();r.id=DOC;r.title='ＢＲＯＣＣＯＬＩ';Object.assign(r.meta,{author:'発表者',crop:'ブロッコリー',region:'トクシマＡ',summary:'要約',hours:'0',attachments:[{path:PATH,type:'application/pdf',name:'発表.pdf',size:1024,caption:''}]})
    const insertPub = 'insert into nitoron_publications(id,owner_id,snapshot,is_public) values($1,$2,$3,true)'
    await t.test('本人の資料だけアップロードでき、下書きの資料は他人から見えない', async () => {
      await as(OWNER,"insert into storage.objects(bucket_id,name) values('nitoron-files',$1)",[PATH])
      assert.equal((await as(OWNER,'select * from storage.objects')).rows.length,1)
      assert.equal((await as(OTHER,'select * from storage.objects')).rows.length,0)
      assert.equal((await as(null,'select * from storage.objects')).rows.length,0)
      await assert.rejects(as(OTHER,"insert into storage.objects(bucket_id,name) values('nitoron-files',$1)",[PATH.replace('cccccccc','dddddddd')]))
      await assert.rejects(as(OWNER,"insert into storage.objects(bucket_id,name) values('nitoron-files',$1)",[`${OWNER}/${DOC}/bad.svg`]))
    })
    await t.test('公開版に含めた本人の資料だけを公開できる', async () => {
      const other = snapshot(r);other.id=DOC2
      await assert.rejects(as(OTHER,insertPub,[DOC2,OTHER,other]))
      const missing=snapshot(r);missing.meta.attachments[0].path=PATH.replaceAll('cccccccc','dddddddd')
      await assert.rejects(as(OWNER,insertPub,[DOC,OWNER,missing]))
      await as(OWNER,insertPub,[DOC,OWNER,snapshot(r)])
      assert.equal((await as(null,'select * from storage.objects')).rows.length,1)
      assert.equal((await as(OWNER,'delete from storage.objects returning name')).rows.length,0)
      await assert.rejects(as(OWNER,"update storage.objects set name='replacement'"))
    })
    await t.test('地域・作物・タイトルを正規化し、実測0は数字ありとする', async () => {
      const p=(await as(null,'select region_search,crop_search,title_search,has_metrics from nitoron_publications')).rows[0]
      assert.deepEqual(p,{region_search:'とくしまa',crop_search:'ぶろっこりー',title_search:'broccoli',has_metrics:true})
      const empty=snapshot(r);empty.meta.hours='';await as(OWNER,'update nitoron_publications set snapshot=$1 where id=$2',[empty,DOC])
      assert.equal((await as(null,'select has_metrics from nitoron_publications')).rows[0].has_metrics,false)
    })
    await t.test('保存リストは本人だけが読める。なりすましは拒否', async () => {
      await as(OTHER,'insert into nitoron_bookmarks(user_id,publication_id) values($1,$2)',[OTHER,DOC])
      assert.equal((await as(OTHER,'select * from nitoron_bookmarks')).rows.length,1)
      assert.equal((await as(OWNER,'select * from nitoron_bookmarks')).rows.length,0)
      await assert.rejects(as(null,'select * from nitoron_bookmarks'))
      await assert.rejects(as(OWNER,'insert into nitoron_bookmarks(user_id,publication_id) values($1,$2)',[OTHER,DOC]))
    })
    let feedback
    await t.test('返信は同じ発表の指摘に限定し、未確認・なりすまし・連投を拒否', async () => {
      feedback=(await as(OTHER,"insert into nitoron_feedback(publication_id,user_id,author,kind,section,body) values($1,$2,'質問者','質問','全体','条件は？') returning id",[DOC,OTHER])).rows[0].id
      const sql="insert into nitoron_feedback_replies(publication_id,feedback_id,user_id,author,body) values($1,$2,$3,'返信者','同じ条件で測りました')"
      await assert.rejects(as(TEMP,sql,[DOC,feedback,TEMP]))
      await assert.rejects(as(OWNER,sql,[DOC,feedback,OTHER]))
      await assert.rejects(as(OWNER,sql,[DOC2,feedback,OWNER]))
      await as(OWNER,sql,[DOC,feedback,OWNER])
      assert.equal((await as(null,'select * from nitoron_feedback_replies')).rows.length,1)
      await assert.rejects(as(OWNER,sql,[DOC,feedback,OWNER]))
      await assert.rejects(as(OTHER,sql,[DOC,feedback,OTHER]))
    })
    await t.test('対応状況を変更できるのは発表の所有者だけ', async () => {
      const sql="insert into nitoron_feedback_resolutions(feedback_id,publication_id,user_id,status) values($1,$2,$3,'検討中')"
      await assert.rejects(as(OTHER,sql,[feedback,DOC,OTHER]))
      await as(OWNER,sql,[feedback,DOC,OWNER])
      assert.equal((await as(OTHER,"update nitoron_feedback_resolutions set status='対応済み' returning feedback_id")).rows.length,0)
      await as(OWNER,"update nitoron_feedback_resolutions set status='対応済み'")
      assert.equal((await as(null,'select status from nitoron_feedback_resolutions')).rows[0].status,'対応済み')
    })
    await t.test('公開停止で資料・返信・対応状況が隠れ、保存リストからも公開版が消える', async () => {
      await as(OWNER,'update nitoron_publications set is_public=false where id=$1',[DOC])
      for(const table of ['storage.objects','nitoron_feedback_replies','nitoron_feedback_resolutions']) {
        for(const who of [null,OTHER]) assert.equal((await as(who,`select * from ${table}`)).rows.length,0)
        assert.equal((await as(OWNER,`select * from ${table}`)).rows.length,1)
      }
      assert.equal((await as(OTHER,'select p.* from nitoron_bookmarks b join nitoron_publications p on p.id=b.publication_id')).rows.length,0)
      assert.equal((await as(OTHER,'select * from nitoron_bookmarks')).rows.length,1)
      assert.equal((await as(OWNER,'delete from storage.objects returning name')).rows.length,1)
    })
  } finally { await db.close() }
})
