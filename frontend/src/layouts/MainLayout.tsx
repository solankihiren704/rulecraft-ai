import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Bell,
  BookOpenCheck,
  Building2,
  ChevronDown,
  FileBarChart,
  FlaskConical,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { notifications as initialNotifications } from '@/services/mockData'
import CommandPalette from '@/components/CommandPalette'
import AiAssistantBubble from '@/components/AiAssistantBubble'
import Modal from '@/components/ui/Modal'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  registrar: 'Registrar',
  hod: 'HOD',
  faculty: 'Faculty',
  student: 'Student',
}

const navigation = [
  { label: 'Command center', path: '/', icon: LayoutDashboard },
  { label: 'Students', path: '/students', icon: GraduationCap },
  { label: 'Academic structure', path: '/academic-structure', icon: Building2 },
  { label: 'Regulations', path: '/regulations', icon: BookOpenCheck },
  { label: 'Rule engine', path: '/rule-engine', icon: GitBranch },
  { label: 'Simulator', path: '/simulator', icon: FlaskConical },
  { label: 'Users & roles', path: '/users', icon: Users },
  { label: 'Reports', path: '/reports', icon: FileBarChart },
]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [organizationOpen, setOrganizationOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [organization, setOrganization] = useState('Northbridge University')
  const [notifications, setNotifications] = useState(initialNotifications)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const canAdminister = user?.role === 'super_admin' || user?.role === 'registrar'
  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function selectNavigation(path: string) {
    navigate(path)
    setMobileNavigationOpen(false)
  }

  function switchOrganization(org: string) {
    setOrganization(org)
    setOrganizationOpen(false)
    showToast(`Switched to ${org}`)
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function handleLogout() {
    setUserMenuOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      {/* Mobile Navigation */}
      {mobileNavigationOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#0f172a]/40 lg:hidden"
          onClick={() => setMobileNavigationOpen(false)}
        >
          <aside
            className="h-full w-[280px] overflow-y-auto bg-[#0f172a] p-5 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-8 flex items-center justify-between">
              <p className="font-display text-lg font-bold">RuleCraft</p>
              <button
                onClick={() => setMobileNavigationOpen(false)}
                className="text-2xl text-[#94a3b8]"
                aria-label="Close navigation"
              >
                ×
              </button>
            </div>
            <nav className="space-y-1">
              {navigation.map(({ label, path, icon: Icon }) => (
                <button
                  key={path}
                  onClick={() => selectNavigation(path)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-[13px] font-medium ${
                    location.pathname === path
                      ? 'bg-[#1e293b] text-white'
                      : 'text-[#94a3b8]'
                  }`}
                >
                  <Icon size={17} />
                  {label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden w-[252px] shrink-0 flex-col bg-[#0f172a] text-white lg:flex">
          <div className="flex items-center gap-3 px-7 pb-10 pt-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#818cf8] text-[#0f172a]">
              <GitBranch size={20} strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-display text-[17px] font-bold tracking-[-0.02em]">
                RuleCraft
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#94a3b8]">
                Academic OS
              </p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3">
            <p className="px-4 pb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748b]">
              Workspace
            </p>
            {navigation.map(({ label, path, icon: Icon }) => (
              <button
                key={path}
                onClick={() => selectNavigation(path)}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-[13px] font-medium transition ${
                  location.pathname === path
                    ? 'bg-[#1e293b] text-white shadow-sm'
                    : 'text-[#94a3b8] hover:bg-[#1e293b] hover:text-white'
                }`}
              >
                <Icon size={17} strokeWidth={location.pathname === path ? 2.3 : 1.8} />
                {label}
              </button>
            ))}
          </nav>
          {canAdminister && (
            <div className="px-6 pb-7">
              <div className="border-t border-[#1e293b] pt-5">
                <button
                  onClick={() => selectNavigation('/users')}
                  className="flex items-center gap-3 py-2 text-[13px] text-[#94a3b8] hover:text-white"
                >
                  <Settings2 size={17} /> Administration
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="flex h-[76px] items-center justify-between border-b border-[#e2e8f0] bg-[#ffffff] px-5 sm:px-9">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileNavigationOpen(true)}
                className="text-[#475569] lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={21} />
              </button>
              <Link to="/" className="font-display text-sm font-bold text-[#0f172a] lg:hidden">
                RuleCraft
              </Link>
              <span className="hidden text-sm text-[#64748b] sm:inline">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center gap-5">
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden h-9 items-center gap-2 border-b border-[#cbd5e1] text-[#64748b] hover:border-[#64748b] hover:text-[#475569] md:flex"
              >
                <Search size={16} />
                <span className="text-xs">Search anything</span>
                <kbd className="ml-10 rounded border border-[#e2e8f0] px-1.5 py-0.5 text-[10px]">
                  ⌘ K
                </kbd>
              </button>
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="flex h-9 w-9 items-center justify-center text-[#475569] md:hidden"
                aria-label="Search"
              >
                <Search size={19} />
              </button>
              <div className="relative flex h-9 items-center">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative flex h-9 w-9 items-center justify-center text-[#475569]"
                  aria-label="Notifications"
                  aria-haspopup="menu"
                  aria-expanded={notificationsOpen}
                >
                  <Bell size={19} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[#ffffff] bg-[#818cf8] text-[8px] font-bold text-[#0f172a]">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 top-9 z-20 w-80 border border-[#e2e8f0] bg-[#ffffff] text-xs shadow-lg">
                    <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
                      <p className="font-bold text-[#0f172a]">Notifications</p>
                      <button onClick={markAllRead} className="font-semibold text-[#4f46e5]">
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`border-b border-[#e2e8f0] px-4 py-3 last:border-b-0 ${!n.read ? 'bg-[#fffbeb]' : ''}`}
                        >
                          <p className="font-semibold text-[#0f172a]">{n.title}</p>
                          <p className="mt-0.5 text-[#64748b]">{n.detail}</p>
                          <p className="mt-1 text-[10px] text-[#94a3b8]">{n.time}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="hidden h-7 w-px bg-[#e2e8f0] sm:block" />
              <div className="relative flex h-9 items-center">
                <button
                  onClick={() => setOrganizationOpen(!organizationOpen)}
                  className="flex h-9 items-center gap-2 text-sm font-semibold"
                  aria-haspopup="menu"
                  aria-expanded={organizationOpen}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f59e0b] text-xs font-bold sm:hidden">
                    {user?.avatarInitials ?? '—'}
                  </span>
                  <span className="hidden sm:inline">{organization}</span>
                  <ChevronDown size={15} className="text-[#64748b]" />
                </button>
                {organizationOpen && (
                  <div className="absolute right-0 top-10 z-20 w-56 border border-[#e2e8f0] bg-[#ffffff] p-2 text-xs shadow-lg">
                    <button
                      onClick={() => switchOrganization('Northbridge University')}
                      className="w-full px-3 py-2 text-left font-semibold text-[#0f172a] hover:bg-[#f1f5f9]"
                    >
                      Northbridge University
                    </button>
                    <button
                      onClick={() => switchOrganization('Southbank Institute')}
                      className="w-full px-3 py-2 text-left text-[#64748b] hover:bg-[#f1f5f9]"
                    >
                      Southbank Institute
                    </button>
                  </div>
                )}
              </div>
              <div className="hidden h-7 w-px bg-[#e2e8f0] sm:block" />
              <div className="relative flex h-9 items-center">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex h-9 items-center gap-2.5"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f59e0b] text-xs font-bold text-[#1e293b]">
                    {user?.avatarInitials ?? '—'}
                  </div>
                  <div className="hidden text-left sm:block">
                    <p className="truncate text-[13px] font-semibold leading-tight text-[#0f172a]">{user?.name ?? 'Guest'}</p>
                    <p className="truncate text-[10px] capitalize leading-tight text-[#94a3b8]">
                      {user?.role.replace('_', ' ') ?? ''}
                    </p>
                  </div>
                  <ChevronDown size={14} className="hidden text-[#64748b] sm:block" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-11 z-20 w-48 border border-[#e2e8f0] bg-[#ffffff] p-2 text-xs shadow-lg">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        setProfileOpen(true)
                      }}
                      className="w-full px-3 py-2 text-left text-[#475569] hover:bg-[#f1f5f9]"
                    >
                      View profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full px-3 py-2 text-left text-[#dc2626] hover:bg-[#fee2e2]"
                    >
                      <LogOut size={13} className="mr-2 inline" /> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page Content */}
          <Outlet />
        </section>
      </div>

      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <AiAssistantBubble />

      <Modal open={profileOpen} title="My profile" onClose={() => setProfileOpen(false)} widthClassName="max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#f59e0b] text-lg font-bold text-[#1e293b]">
            {user?.avatarInitials ?? '—'}
          </div>
          <p className="font-display text-lg font-bold text-[#0f172a]">{user?.name ?? 'Guest'}</p>
          <p className="text-xs text-[#64748b]">{user?.email}</p>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between border-b border-[#e2e8f0] pb-2">
            <dt className="text-[#64748b]">Role</dt>
            <dd className="font-semibold text-[#0f172a]">{user ? ROLE_LABELS[user.role] ?? user.role : '—'}</dd>
          </div>
          {user?.department && (
            <div className="flex justify-between border-b border-[#e2e8f0] pb-2">
              <dt className="text-[#64748b]">Department</dt>
              <dd className="font-semibold text-[#0f172a]">{user.department}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-[#64748b]">Organization</dt>
            <dd className="font-semibold text-[#0f172a]">{organization}</dd>
          </div>
        </dl>
        <button
          onClick={() => {
            setProfileOpen(false)
            handleLogout()
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] px-4 py-2.5 text-xs font-semibold text-[#dc2626] hover:bg-[#fee2e2]"
        >
          <LogOut size={14} /> Log out
        </button>
      </Modal>
    </main>
  )
}
