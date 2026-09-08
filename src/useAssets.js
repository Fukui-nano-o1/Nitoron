import { useEffect, useState } from 'react'
import { attachmentUrls } from './assets.js'
export default function useAssets(attachments = []) {
  const key = JSON.stringify(attachments.map(a => a.path))
  const [state, setState] = useState({ key: '', urls: {}, error: '' }), [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    const paths = JSON.parse(key)
    const load = async () => {
      try {
        const urls = await attachmentUrls(paths)
        if (active) setState({ key, urls, error: paths.length && paths.some(p => !urls[p]) ? '一部の添付資料を取得できません。' : '' })
      } catch (e) { if (active) setState({ key, urls: {}, error: e.message }) }
    }
    load()
    const timer = paths.length ? setInterval(load, 45000) : null
    return () => { active = false; clearInterval(timer) }
  }, [key, retry])
  return { urls: state.key === key ? state.urls : {}, error: state.key === key ? state.error : '', retry: () => setRetry(n => n + 1) }
}
