// カードの長押しプレビュー判定。DOM・React・タイマーに依存しない純状態機械。
// 呼び出し側が約300msのタイマーを持ち、経過時に fire() を呼ぶ。指の移動が
// slop(8 CSS px)を超えたらスクロール優先で取り消す。fire後の直近のclickは
// consumeClick() で1回だけ抑止し、次の独立した短押しには影響させない。
export function createPress({ slop = 8 } = {}) {
  let pointer = null, fired = false, suppress = false
  return {
    // 押し始め。前回のプレビューで消費されなかったclick抑止は持ち越さない。
    down(id, x, y) { pointer = { id, x, y }; fired = false; suppress = false },
    // 'hold'=長押し継続 / 'cancel'=発動前の取消（スクロール優先）/
    // 'cancel-preview'=発動後の移動でプレビュー終了 / 'ignore'=別ポインタ
    move(id, x, y) {
      if (!pointer || pointer.id !== id) return 'ignore'
      if (Math.hypot(x - pointer.x, y - pointer.y) <= slop) return 'hold'
      const wasFired = fired
      pointer = null; fired = false; suppress = false
      return wasFired ? 'cancel-preview' : 'cancel'
    },
    // タイマー経過。まだ同じ指が押していればプレビュー発動、以後のclickを1回抑止。
    fire(id) {
      if (!pointer || pointer.id !== id) return false
      fired = true; suppress = true; return true
    },
    // 'tap'=発動前に離した（従来どおり詳細へ）/ 'end-preview'=プレビュー終了 / 'ignore'
    up(id) {
      if (!pointer || pointer.id !== id) return 'ignore'
      const wasFired = fired
      pointer = null; fired = false
      return wasFired ? 'end-preview' : 'tap'
    },
    // pointercancel・画面遷移など。'end-preview' か 'none'。
    cancel() {
      const wasFired = fired
      pointer = null; fired = false
      return wasFired ? 'end-preview' : 'none'
    },
    consumeClick() { const value = suppress; suppress = false; return value },
    get holding() { return pointer !== null },
    get firedNow() { return fired },
  }
}
