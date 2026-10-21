import { APP_NAME, LOGO_URL, TAGLINE } from '../brand'
import { HashRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ActiveProfileProvider, useActiveProfile } from './activeProfile'
import { LockScreen } from './components/LockScreen'
import { IconBook, IconChart, IconDumbbell, IconFood, IconHome, IconLock, IconPlan, IconUsers } from './components/icons'
import { Dashboard } from './pages/Dashboard'
import { EvidencePage } from './pages/EvidencePage'
import { MesocyclePage } from './pages/MesocyclePage'
import { NutritionPage } from './pages/NutritionPage'
import { People } from './pages/People'
import { PlanPage } from './pages/PlanPage'
import { ProgressPage } from './pages/ProgressPage'
import { ProfileForm } from './pages/ProfileForm'
import { WorkoutPage } from './pages/WorkoutPage'

const NAV = [
  { to: '/', label: 'Panel', icon: <IconHome />, mobile: true },
  { to: '/plan', label: 'Plan', icon: <IconPlan />, mobile: true },
  { to: '/entrenar', label: 'Entrenar', icon: <IconDumbbell />, mobile: true },
  { to: '/progreso', label: 'Progreso', icon: <IconChart />, mobile: true },
  { to: '/nutricion', label: 'Nutrición', icon: <IconFood />, mobile: true },
  { to: '/personas', label: 'Personas', icon: <IconUsers />, mobile: true },
  { to: '/evidencia', label: 'Evidencia', icon: <IconBook />, mobile: false },
]

function ProfileSwitcher() {
  const { profiles, active, setActiveId } = useActiveProfile()
  const navigate = useNavigate()
  if (!profiles || profiles.length === 0) return null
  return (
    <select
      aria-label="Persona activa"
      value={active?.id ?? ''}
      onChange={(e) => {
        if (e.target.value === '__new') navigate('/personas/nueva')
        else setActiveId(e.target.value)
      }}
      style={{ width: 'auto', maxWidth: 220 }}
    >
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
      <option value="__new">+ Nueva persona</option>
    </select>
  )
}

/** Rutas abiertas aunque la persona activa esté bloqueada. */
const OPEN_PATHS = ['/personas', '/personas/nueva', '/evidencia']

function GuardedRoutes() {
  const { pathname } = useLocation()
  const { profiles, active, isLocked } = useActiveProfile()
  const editing = pathname.match(/^\/personas\/([^/]+)$/)?.[1]
  const target = editing && editing !== 'nueva' ? profiles?.find((p) => p.id === editing) : active
  if (!OPEN_PATHS.includes(pathname) && target && isLocked(target)) {
    return <LockScreen key={target.id} profile={target} />
  }
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/personas" element={<People />} />
      <Route path="/personas/nueva" element={<ProfileForm />} />
      <Route path="/personas/:id" element={<ProfileForm />} />
      <Route path="/plan" element={<PlanPage />} />
      <Route path="/plan/cierre" element={<MesocyclePage />} />
      <Route path="/entrenar" element={<WorkoutPage />} />
      <Route path="/progreso" element={<ProgressPage />} />
      <Route path="/nutricion" element={<NutritionPage />} />
      <Route path="/evidencia" element={<EvidencePage />} />
    </Routes>
  )
}

function LockButton() {
  const { active, isLocked, lock } = useActiveProfile()
  if (!active?.pin || isLocked(active)) return null
  return (
    <button className="btn small" onClick={() => lock(active.id)} title={`Bloquear a ${active.name}`}>
      <IconLock /> Bloquear
    </button>
  )
}

function Shell() {
  return (
    <div className="app">
      <nav className="sidebar" aria-label="Principal">
        <div className="brand">
          <img src={LOGO_URL} alt={APP_NAME} />
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-link">
            {n.icon}
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="main">
        <header className="topbar">
          <div className="brand">
            <img src={LOGO_URL} alt={APP_NAME} />
          </div>
          <span className="tagline">{TAGLINE}</span>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <LockButton />
            <ProfileSwitcher />
          </div>
        </header>
        <main className="content">
          <GuardedRoutes />
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Principal">
        {NAV.filter((n) => n.mobile).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-link">
            {n.icon}
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function App() {
  return (
    <HashRouter>
      <ActiveProfileProvider>
        <Shell />
      </ActiveProfileProvider>
    </HashRouter>
  )
}
