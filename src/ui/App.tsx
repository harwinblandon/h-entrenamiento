import { HashRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { ActiveProfileProvider, useActiveProfile } from './activeProfile'
import { IconBook, IconDumbbell, IconFood, IconHome, IconPlan, IconUsers } from './components/icons'
import { Dashboard } from './pages/Dashboard'
import { EvidencePage } from './pages/EvidencePage'
import { NutritionPage } from './pages/NutritionPage'
import { People } from './pages/People'
import { PlanPage } from './pages/PlanPage'
import { ProfileForm } from './pages/ProfileForm'
import { WorkoutPage } from './pages/WorkoutPage'

const NAV = [
  { to: '/', label: 'Panel', icon: <IconHome />, mobile: true },
  { to: '/plan', label: 'Plan', icon: <IconPlan />, mobile: true },
  { to: '/entrenar', label: 'Entrenar', icon: <IconDumbbell />, mobile: true },
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

function Shell() {
  return (
    <div className="app">
      <nav className="sidebar" aria-label="Principal">
        <div className="brand">
          At<span>las</span>
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
            At<span>las</span>
          </div>
          <span className="muted tagline" style={{ fontSize: '0.85rem' }}>
            Hipertrofia guiada por evidencia
          </span>
          <ProfileSwitcher />
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/personas" element={<People />} />
            <Route path="/personas/nueva" element={<ProfileForm />} />
            <Route path="/personas/:id" element={<ProfileForm />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/entrenar" element={<WorkoutPage />} />
            <Route path="/nutricion" element={<NutritionPage />} />
            <Route path="/evidencia" element={<EvidencePage />} />
          </Routes>
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
