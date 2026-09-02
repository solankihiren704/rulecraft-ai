import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import {
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
  MoreHorizontal,
  Search,
  Settings2,
  Sparkles,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { notifications as initialNotifications } from '@/services/mockData'
import CommandPalette from '@/components/CommandPalette'

const navigation = [
  { label: 'Command center', path: '/', icon: LayoutDashboard },
  { label: 'Students', path: '/students', icon: GraduationCap },
  { label: 'Academic structure', path: '/academic-structure', icon: Building2 },
  { label: 'Regulations', path: '/regulations', icon: BookOpenCheck },
  { label: 'Rule engine', path: '/rule-engine', icon: GitBranch },
  { label: 'Simulator', path: '/simulator', icon: FlaskConical },
  { label: 'Users & roles', path: '/users', icon: Users },
  { label: 'AI assistant', path: '/ai-assistant', icon: Sparkles },
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
    <main className="min-h-screen bg-[#f6f4ef] text-[#152b35]">
      {/* Mobile Navigation */}
      {mobileNavigationOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#102b35]/40 lg:hidden"
          onClick={() => setMobileNavigationOpen(false)}
        >
          <aside
            className="h-full w-[280px] overflow-y-auto bg-[#102b35] p-5 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-8 flex items-center justify-between">
              <p className="font-display text-lg font-bold">RuleCraft</p>
              <button
                onClick={() => setMobileNavigationOpen(false)}
                className="text-2xl text-[#a5bab7]"
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
                      ? 'bg-[#204853] text-white'
                      : 'text-[#a5bab7]'
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
        <aside className="hidden w-[252px] shrink-0 flex-col bg-[#102b35] text-white lg:flex">
          <div className="flex items-center gap-3 px-7 pb-10 pt-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#f4a27f] text-[#102b35]">
              <GitBranch size={20} strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-display text-[17px] font-bold tracking-[-0.02em]">
                RuleCraft
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#91aaa9]">
                Academic OS
              </p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3">
            <p className="px-4 pb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#668482]">
              Workspace
            </p>
            {navigation.map(({ label, path, icon: Icon }) => (
              <button
                key={path}
                onClick={() => selectNavigation(path)}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-[13px] font-medium transition ${
                  location.pathname === path
                    ? 'bg-[#204853] text-white shadow-sm'
                    : 'text-[#a5bab7] hover:bg-[#173b45] hover:text-white'
                }`}
              >
                <Icon size={17} strokeWidth={location.pathname === path ? 2.3 : 1.8} />
                {label}
              </button>
            ))}
          </nav>
          <div className="px-6 pb-7">
            <div className="mb-6 border-t border-[#2b4b51] pt-5">
              <button
                onClick={() => showToast('Administration settings are available.')}
                className="flex items-center gap-3 py-2 text-[13px] text-[#a5bab7]"
              >
                <Settings2 size={17} /> Administration
              </button>
            </div>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex w-full items-center gap-3"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e2b36c] text-sm font-bold text-[#193740]">
                  {user?.avatarInitials ?? '—'}
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate text-[13px] font-semibold">{user?.name ?? 'Guest'}</p>
                  <p className="truncate text-[11px] capitalize text-[#8da6a3]">
                    {user?.role.replace('_', ' ') ?? ''}
                  </p>
                </div>
                <MoreHorizontal size={17} className="ml-auto text-[#8da6a3]" />
              </button>
              {userMenuOpen && (
                <div className="absolute bottom-14 left-0 z-20 w-48 border border-[#e4e1da] bg-[#fbfaf7] p-2 text-xs shadow-lg">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false)
                      showToast('Profile opened.')
                    }}
                    className="w-full px-3 py-2 text-left text-[#486362] hover:bg-[#f0eee8]"
                  >
                    View profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full px-3 py-2 text-left text-[#d46f51] hover:bg-[#f0eee8]"
                  >
                    <LogOut size={13} className="mr-2 inline" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="flex h-[76px] items-center justify-between border-b border-[#e4e1da] bg-[#fbfaf7] px-5 sm:px-9">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileNavigationOpen(true)}
                className="text-[#557071] lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={21} />
              </button>
              <Link to="/" className="font-display text-sm font-bold text-[#102b35] lg:hidden">
                RuleCraft
              </Link>
              <span className="hidden text-sm text-[#79908f] sm:inline">
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
                className="hidden items-center gap-2 border-b border-[#b8c7c3] pb-1 text-[#78908e] hover:border-[#78908e] hover:text-[#486362] md:flex"
              >
                <Search size={16} />
                <span className="text-xs">Search anything</span>
                <kbd className="ml-10 rounded border border-[#dce1db] px-1.5 py-0.5 text-[10px]">
                  ⌘ K
                </kbd>
              </button>
              <button onClick={() => setCommandPaletteOpen(true)} className="text-[#557071] md:hidden" aria-label="Search">
                <Search size={19} />
              </button>
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative text-[#557071]"
                  aria-label="Notifications"
                  aria-haspopup="menu"
                  aria-expanded={notificationsOpen}
                >
                  <Sparkles size={19} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[#fbfaf7] bg-[#f4a27f] text-[8px] font-bold text-[#102b35]">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 top-9 z-20 w-80 border border-[#e4e1da] bg-[#fbfaf7] text-xs shadow-lg">
                    <div className="flex items-center justify-between border-b border-[#e4e1da] px-4 py-3">
                      <p className="font-bold text-[#173640]">Notifications</p>
                      <button onClick={markAllRead} className="font-semibold text-[#d46f51]">
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`border-b border-[#eee] px-4 py-3 last:border-b-0 ${!n.read ? 'bg-[#fff8f0]' : ''}`}
                        >
                          <p className="font-semibold text-[#173640]">{n.title}</p>
                          <p className="mt-0.5 text-[#718684]">{n.detail}</p>
                          <p className="mt-1 text-[10px] text-[#9aa8a5]">{n.time}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="hidden h-7 w-px bg-[#e4e1da] sm:block" />
              <div className="relative">
                <button
                  onClick={() => setOrganizationOpen(!organizationOpen)}
                  className="flex items-center gap-2 text-sm font-semibold"
                  aria-haspopup="menu"
                  aria-expanded={organizationOpen}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e2b36c] text-xs font-bold sm:hidden">
                    {user?.avatarInitials ?? '—'}
                  </span>
                  <span className="hidden sm:inline">{organization}</span>
                  <ChevronDown size={15} className="text-[#78908e]" />
                </button>
                {organizationOpen && (
                  <div className="absolute right-0 top-10 z-20 w-56 border border-[#e4e1da] bg-[#fbfaf7] p-2 text-xs shadow-lg">
                    <button
                      onClick={() => switchOrganization('Northbridge University')}
                      className="w-full px-3 py-2 text-left font-semibold text-[#173640] hover:bg-[#f0eee8]"
                    >
                      Northbridge University
                    </button>
                    <button
                      onClick={() => switchOrganization('Southbank Institute')}
                      className="w-full px-3 py-2 text-left text-[#718684] hover:bg-[#f0eee8]"
                    >
                      Southbank Institute
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
    </main>
  )
}
