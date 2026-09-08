import React from 'react'
const paths = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  heart: <path d="M20.5 5.5a5 5 0 0 0-7.1 0L12 6.9l-1.4-1.4a5 5 0 0 0-7.1 7.1L12 21l8.5-8.4a5 5 0 0 0 0-7.1Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  book: <><path d="M3 4h6a4 4 0 0 1 3 1.5A4 4 0 0 1 15 4h6v16h-6a4 4 0 0 0-3 1.5A4 4 0 0 0 9 20H3Z" /><path d="M12 5.5v16" /></>,
  compare: <><path d="M3 4h7v16H3ZM14 4h7v16h-7" /><path d="M6 8h1M17 8h1M6 12h1M17 12h1" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  filter: <><path d="M4 7h7m4 0h5M4 17h3m4 0h9" /><circle cx="13" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  share: <><path d="M12 16V3m-4 4 4-4 4 4M5 12v9h14v-9" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  left: <path d="m15 4-8 8 8 8" />,
  right: <path d="m9 4 8 8-8 8" />,
  upload: <><path d="M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5" /></>,
  file: <><path d="M5 3h9l5 5v13H5ZM14 3v6h5M8 13h8M8 17h6" /></>,
  check: <path d="m4 12 5 5L20 6" />,
  plus: <path d="M12 4v16M4 12h16" />,
  pin: <><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  flag: <path d="M5 21V4h11l-2 4 2 4H5" />,
}
export default function Icon({ name, size = 22, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.file}</svg>
}
