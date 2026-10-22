const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' } as const

export const IconHome = () => (
  <svg {...base}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>
)
export const IconUsers = () => (
  <svg {...base}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 010 7" /><path d="M18 14.7c2 .7 3.2 2.5 3.6 5.3" /></svg>
)
export const IconPlan = () => (
  <svg {...base}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
)
export const IconDumbbell = () => (
  <svg {...base}><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></svg>
)
export const IconFood = () => (
  <svg {...base}><path d="M12 3c-4 0-7 3.5-7 8 0 5 3 10 7 10s7-5 7-10c0-4.5-3-8-7-8z" /><path d="M12 3c1-1 2.5-1.5 4-1" /></svg>
)
export const IconBook = () => (
  <svg {...base}><path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5z" /><path d="M4 21.5V4.5" /></svg>
)
export const IconChart = () => (
  <svg {...base}><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 6-7" /></svg>
)
export const IconShield = () => (
  <svg {...base}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /></svg>
)
export const IconLock = () => (
  <svg {...base} width="15" height="15"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
)
