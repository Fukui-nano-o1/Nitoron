import { useEffect, useState } from 'react'
// Airbnb と同じ、スクロールに応じたヘッダー・下部ナビの出し入れ。
// scrolled: 先頭から離れた（PC は大きい検索ピルを小さいピルに畳む）。hidden: 下へ動かしている（スマホはヘッダーと下部ナビを画面外へ滑らせ、上へ戻すと出す）。
export const CHROME_DEFAULTS = { collapseAt: 24, hideAfter: 96, delta: 8 }
// 純粋な判定。last は前回の判定に使った位置（delta を超えて動いたときだけ更新し、指の震えで出入りしないようにする）。
export function chromeState(prev, y, opts = CHROME_DEFAULTS) {
  const { collapseAt, hideAfter, delta } = { ...CHROME_DEFAULTS, ...opts }
  y = Math.max(0, y)
  const moved = Math.abs(y - prev.last) > delta
  const hidden = y <= hideAfter ? false : !moved ? prev.hidden : y > prev.last
  return { scrolled: y > collapseAt, hidden, last: moved || y <= hideAfter ? y : prev.last }
}
export default function useScrollChrome(opts) {
  const [state, setState] = useState({ scrolled: false, hidden: false, last: 0 })
  useEffect(() => {
    let ticking = false
    const update = () => { ticking = false; setState(prev => { const next = chromeState(prev, window.scrollY, opts); return next.scrolled === prev.scrolled && next.hidden === prev.hidden && next.last === prev.last ? prev : next }) }
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update) } }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return state
}
