import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { UserRole, Email } from '../types';
import { apiFetch } from '../lib/api';
import { Bell, SignOut, CaretRight, MagnifyingGlass, SquaresFour, List, PlusCircle, ListChecks, ClipboardText, CalendarBlank, EnvelopeSimple, ShieldCheck, Gear, BookOpen, UserSwitch, Database, Wallet, ClockCounterClockwise, Archive, UsersThree, Buildings, Lifebuoy, ChartBar, UserCircle } from '@phosphor-icons/react';
import { formatPHP, IS_DEMO_MODE } from '../utils';
import { formatDistanceToNowStrict } from 'date-fns';

export const navItems = [
    { label: 'Dashboard', path: '/', icon: SquaresFour, group: 'PRIMARY', roles: [UserRole.REQUESTOR, UserRole.APPROVER, UserRole.CUSTODIAN, UserRole.ADMIN] },
  { label: 'New Reimbursement', path: '/claims/new', icon: PlusCircle, group: 'PRIMARY', roles: [UserRole.REQUESTOR] },
  { label: 'Processing Queue', path: '/processing', icon: ListChecks, group: 'PRIMARY', roles: [UserRole.CUSTODIAN] },
  { label: 'Ready to Claim', path: '/ready-to-claim', icon: Wallet, group: 'PRIMARY', roles: [UserRole.REQUESTOR] },
  { label: 'Transaction History', path: '/history', icon: ClockCounterClockwise, group: 'PRIMARY', roles: [UserRole.REQUESTOR, UserRole.CUSTODIAN] },
  // The Approver's queue of things to decide on now lives inside the
  // Dashboard itself (no separate "Approver Inbox" page/nav item — see
  // ApproverDashboard.tsx) — only their own submitted requests get a
  // distinct sidebar group, so those never blur together with the queue.
  // MyRequests.tsx now absorbs what used to be a separate "Transaction
  // History" nav item for this role too — same self-scoped data, so it
  // carries TransactionHistory's date-range filter and CSV export instead of
  // making the Approver pick between two near-identical pages.
  { label: 'My Requests', path: '/my-requests', icon: UserCircle, group: 'MY REQUESTS', roles: [UserRole.APPROVER] },
  // Approvers submit and report their own claims the same as any Requestor,
  // so they need the same "collect my processed claim" destination too —
  // scoped to /ready-to-claim's own requestor_id filter, not a duplicate route.
  { label: 'Ready to Claim', path: '/ready-to-claim', icon: Wallet, group: 'MY REQUESTS', roles: [UserRole.APPROVER] },
  { label: 'Help & Support', path: '/support', icon: Lifebuoy, group: 'PRIMARY', roles: [UserRole.REQUESTOR, UserRole.APPROVER, UserRole.CUSTODIAN, UserRole.ADMIN] },
  { label: 'System Emails', path: '/emails', icon: EnvelopeSimple, group: 'COMMUNICATION', roles: [UserRole.REQUESTOR, UserRole.APPROVER, UserRole.CUSTODIAN, UserRole.ADMIN] },
  { label: 'Calendar', path: '/calendar', icon: CalendarBlank, group: 'PLANNING', roles: [UserRole.REQUESTOR, UserRole.APPROVER] },
  { label: 'Meeting Minutes', path: '/moms', icon: ClipboardText, group: 'COMPLIANCE', roles: [UserRole.REQUESTOR, UserRole.APPROVER] },
  { label: 'Receipt Archive', path: '/receipts', icon: Archive, group: 'SYSTEM', roles: [UserRole.ADMIN] },
  { label: 'User Accounts', path: '/users', icon: UsersThree, group: 'SYSTEM', roles: [UserRole.ADMIN] },
  { label: 'Company Directory', path: '/companies', icon: Buildings, group: 'SYSTEM', roles: [UserRole.ADMIN] },
  { label: 'Audit Log', path: '/audit', icon: ShieldCheck, group: 'SYSTEM', roles: [UserRole.ADMIN] },
  { label: 'System Reporting', path: '/reporting', icon: ChartBar, group: 'SYSTEM', roles: [UserRole.ADMIN] },
  { label: 'Settings', path: '/settings', icon: Gear, group: 'SYSTEM', roles: [UserRole.APPROVER, UserRole.ADMIN] },
  IS_DEMO_MODE ? { label: 'Scenario Guide', path: '/scenarios', icon: BookOpen, group: 'RESOURCES', roles: [UserRole.REQUESTOR, UserRole.APPROVER, UserRole.CUSTODIAN, UserRole.ADMIN] } : null,
  ].filter(Boolean) as any[];

const sectionMap: Record<string, string> = {
  'Calendar': 'calendar',
  'System Emails': 'emails',
  'Processing Queue': 'processing',
  'Dashboard': 'dashboard',
  'Ready to Claim': 'readyToClaim'
};

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPreview, setNotifPreview] = useState<Email[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activityStatus, setActivityStatus] = useState<Record<string, number>>({});

  // Small, deterministic per-route vertical offset for the .app-canvas
  // bokeh background — main never remounts on navigation (that would reset
  // scroll position), so instead we nudge the glow layer up/down by a few
  // px whenever the route changes and let CSS transition the shift.
  // Vertical only (no x component) so it reads as a clean up/down drift.
  const bgOffset = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < location.pathname.length; i++) {
      hash = (hash * 31 + location.pathname.charCodeAt(i)) % 56;
    }
    return hash - 28; // -28..27px, vertical
  }, [location.pathname]);

  // main never remounts on navigation (see comment above), so its scroll
  // position otherwise carries over from whatever page you were just on —
  // a new page can silently open mid-scroll instead of at its own top.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  // Global search states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [allClaims, setAllClaims] = useState<any[]>([]);
  const [allCadvs, setAllCadvs] = useState<any[]>([]);
  const [allLiqs, setAllLiqs] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    claims: any[];
    cadvs: any[];
    liqs: any[];
  }>({ claims: [], cadvs: [], liqs: [] });

  // Mobile sidebar auto-closing behavior on mount/resize and navigation
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  const handleSearchFocus = async () => {
    setIsSearchLoading(true);
    try {
      const [claimsData, cadvsData, liqsData, usersData] = await Promise.all([
        apiFetch('/api/claims'),
        apiFetch('/api/cash-advances'),
        apiFetch('/api/liquidations'),
        apiFetch('/api/users')
      ]);
      setAllClaims(claimsData);
      setAllCadvs(cadvsData);
      setAllLiqs(liqsData);
      setAllUsers(usersData);
    } catch (err) {
      console.error('Error prefetching search data:', err);
    } finally {
      setIsSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSearchResults({ claims: [], cadvs: [], liqs: [] });
      return;
    }

    const q = debouncedSearchQuery.toLowerCase();

    // Helper to get requestor name
    const getRequestorName = (record: any) => {
      const reqId = record.requestorId || record.requestor_id;
      if (record.requestor?.name) return record.requestor.name;
      const found = allUsers.find(u => u.id === reqId);
      return found ? found.name : '';
    };

    // Filter Claims
    const filteredClaims = allClaims.filter(c => {
      const claimNo = `REIM-${c.id.substring(0, 6)}`.toLowerCase();
      const reqName = getRequestorName(c).toLowerCase();
      const amount = String(c.total_amount);
      const purpose = (c.expense_category || '').toLowerCase();
      const description = (c.notes || '').toLowerCase();
      return (
        claimNo.includes(q) ||
        reqName.includes(q) ||
        amount.includes(q) ||
        purpose.includes(q) ||
        description.includes(q)
      );
    });

    // Filter CADVs
    const filteredCadvs = allCadvs.filter(ca => {
      const cadvNo = `CADV-${ca.id.substring(0, 6)}`.toLowerCase();
      const reqName = getRequestorName(ca).toLowerCase();
      const amount = String(ca.amount);
      const purpose = (ca.purpose || '').toLowerCase();
      return (
        cadvNo.includes(q) ||
        reqName.includes(q) ||
        amount.includes(q) ||
        purpose.includes(q)
      );
    });

    // Filter LIQs
    const filteredLiqs = allLiqs.filter(l => {
      const liqNo = `LIQ-${l.id.substring(0, 6)}`.toLowerCase();
      const reqName = getRequestorName(l).toLowerCase();
      const totalSpent = String(l.totalSpent);
      const variance = String(Math.abs(l.varianceAmount || 0));
      return (
        liqNo.includes(q) ||
        reqName.includes(q) ||
        totalSpent.includes(q) ||
        variance.includes(q)
      );
    });

    setSearchResults({
      claims: filteredClaims.slice(0, 5),
      cadvs: filteredCadvs.slice(0, 5),
      liqs: filteredLiqs.slice(0, 5)
    });
  }, [debouncedSearchQuery, allClaims, allCadvs, allLiqs, allUsers]);

  const refreshActivity = () => {
    if (user) {
      apiFetch('/api/outbox').then(data => {
        setUnreadCount(data.filter((n: any) => !n.read).length);
        setNotifPreview(data.slice(0, 5));
      }).catch(console.error);

      apiFetch('/api/activity/status').then(data => {
        setActivityStatus(data || {});
      }).catch(console.error);
    }
  };

  const markNotificationRead = (id: string) => {
    setNotifPreview(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    apiFetch('/api/outbox/read', {
      method: 'PUT',
      body: JSON.stringify({ ids: [id] })
    }).catch(console.error);
  };

  useEffect(() => {
    refreshActivity();
  }, [user, location.pathname]);

  useEffect(() => {
    window.addEventListener('refresh-activity', refreshActivity);
    return () => {
      window.removeEventListener('refresh-activity', refreshActivity);
    };
  }, [user]);

  const visibleNavItems = navItems
    .filter(item => user && item.roles.includes(user.role))
    .map(item => {
      if (item.path === '/settings' && user) {
        if (user.role === UserRole.APPROVER) {
          return { ...item, label: 'Approval Delegation', icon: UserSwitch };
        }
        if (user.role === UserRole.ADMIN) {
          return { ...item, label: 'Data Management', icon: Database };
        }
      }
      return item;
    });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/calendar')) return 'Calendar';
    if (path.startsWith('/processing')) return 'Processing Queue';
    if (path.startsWith('/ready-to-claim')) return 'Ready to Claim';
    if (path.startsWith('/my-requests')) return 'My Requests';
    if (path.startsWith('/audit')) return 'Audit Log';
    if (path.startsWith('/reporting')) return 'System Reporting';
    if (path.startsWith('/receipts')) return 'Receipt Archive';
    if (path.startsWith('/moms')) return 'Meeting Minutes';
    if (path.startsWith('/claims/new')) return 'New Reimbursement';
    if (path.startsWith('/scenarios')) return 'Scenario Guide';
    if (path.startsWith('/settings')) {
      if (user?.role === UserRole.APPROVER) return 'Approval Delegation';
      if (user?.role === UserRole.ADMIN) return 'Data Management';
      return 'Settings';
    }
    return 'Home';
  }

  return (
    <div className="h-screen flex flex-col md:flex-row text-sm font-sans overflow-hidden">
      {/* Decorative background glow - fixed to the viewport, not tied to any
          scroll container's content height, so it can never crop no matter
          how long a page gets. Always the first child so everything else
          (sidebar, header, main) paints on top of it in normal stacking order. */}
      <div className="app-bg-fixed" style={{ '--bokeh-x': '0px', '--bokeh-y': `${bgOffset}px` } as React.CSSProperties} />

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-[45] md:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          id="mobile_sidebar_backdrop"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 glass-panel border-r border-slate-200/60 flex flex-col shadow-xl transition-transform duration-300 ease-in-out shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:relative md:shadow-sm md:z-20
        ${sidebarOpen ? 'md:w-64' : 'md:w-16'}
        z-[50]
      `}>
        <div className="h-16 flex items-center px-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-brand/[0.06] to-transparent">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-50"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <List className="w-5 h-5" />
          </button>
          <img 
            src="/logo.png" 
            alt="Microgenesis Logo" 
            className={`ml-3 h-9 object-contain transition-all duration-200 ${
              sidebarOpen ? 'opacity-100 max-w-[140px]' : 'opacity-0 max-w-0 overflow-hidden pointer-events-none ml-0'
            }`} 
          />
        </div>
        
        <nav className="flex-1 py-4 space-y-4 overflow-y-auto px-3 custom-scrollbar">
          {(() => {
            const groupedItems = visibleNavItems.reduce((acc, item) => {
              const group = (item as any).group || 'OTHER';
              if (!acc[group]) acc[group] = [];
              acc[group].push(item);
              return acc;
            }, {} as Record<string, typeof navItems[0][]>);

            const groupOrder = ['PRIMARY', 'APPROVAL CENTER', 'MY REQUESTS', 'COMMUNICATION', 'PLANNING', 'COMPLIANCE', 'SYSTEM', 'RESOURCES', 'OTHER'];
            const activeGroups = groupOrder.filter(g => groupedItems[g] && groupedItems[g].length > 0);
            const showLabels = activeGroups.length > 1;

            return activeGroups.map(groupName => (
              <div key={groupName} className="space-y-1">
                {showLabels && (
                  <div className={`px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider transition-all duration-200 ${
                    sidebarOpen ? 'opacity-100 max-h-8 mt-1' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none mt-0'
                  }`}>
                    {groupName}
                  </div>
                )}
                {groupedItems[groupName].map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  // The Approver's "pending items" badge used to live on the
                  // separate Approver Inbox nav item; now that queue is part
                  // of the Dashboard itself, its badge count follows it there.
                  const section = (item.label === 'Dashboard' && user?.role === UserRole.APPROVER) ? 'inbox' : sectionMap[item.label];
                  const count = section ? activityStatus[section] || 0 : 0;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={!sidebarOpen ? item.label : undefined}
                      aria-label={item.label}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative group overflow-hidden ${
                        isActive 
                          ? 'bg-brand/10 text-brand shadow-sm font-semibold' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                      }`}
                    >
                      {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand" />}
                      <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-brand' : 'text-slate-400 group-hover:text-slate-600'}`} weight={isActive ? "fill" : "regular"} />
                      <div className={`flex-grow flex items-center justify-between min-w-0 transition-all duration-200 ${
                        sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 h-0 overflow-hidden pointer-events-none'
                      }`}>
                        <span className="truncate text-sm">{item.label}</span>
                        {count > 0 && (
                          <span 
                            className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center text-center shrink-0 ml-1.5" 
                            id={`nav_activity_dot_${section}`} 
                          >
                            {count > 9 ? '9+' : count}
                          </span>
                        )}
                      </div>
                      {!sidebarOpen && count > 0 && (
                        <span 
                          className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold rounded-full px-1 min-w-[15px] h-[15px] flex items-center justify-center text-center border border-white" 
                          id={`nav_activity_dot_collapsed_${section}`} 
                        >
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ));
          })()}
        </nav>
      </aside>

      {/* Mobile Search Modal/Overlay */}
      {isMobileSearchOpen && (
        <div className="fixed inset-0 bg-white z-[70] flex flex-col p-4 md:hidden">
          {/* Header of mobile search */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search requests..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-slate-100 text-slate-900 placeholder-slate-400 text-sm px-4 py-2 pl-10 rounded-lg border border-slate-200 focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none"
                id="mobile_search_input"
              />
              <MagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            </div>
            <button 
              onClick={() => { setIsMobileSearchOpen(false); setSearchQuery(''); }}
              className="text-slate-500 hover:text-slate-700 font-medium text-sm px-2 py-1 shrink-0"
              id="mobile_search_close"
            >
              Cancel
            </button>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto text-slate-800" id="mobile_search_results_container">
            {!searchQuery.trim() ? (
              <div className="p-4 text-center text-xs text-slate-400 font-semibold">Type a query to search requests.</div>
            ) : isSearchLoading ? (
              <div className="p-4 text-center text-xs text-slate-500 italic">Searching...</div>
            ) : searchResults.claims.length === 0 && searchResults.cadvs.length === 0 && searchResults.liqs.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 italic">
                No matching requests found.<br/>
                <span className="text-[10px] mt-1 block opacity-75">You can only search requests you have access to.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {searchResults.claims.length > 0 && (
                  <div className="p-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">Reimbursements</span>
                    {searchResults.claims.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { navigate(`/claims/${c.id}`); setSearchQuery(''); setIsMobileSearchOpen(false); }}
                        className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded flex justify-between items-center"
                        id={`mobile_search_result_reim_${c.id}`}
                      >
                        <div>
                          <span className="font-bold text-brand block">REIM-{c.id.substring(0, 6).toUpperCase()}</span>
                          <span className="text-slate-500 font-semibold">{c.notes || c.expense_category}</span>
                        </div>
                        <span className="font-extrabold text-slate-950">{formatPHP(c.total_amount)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.cadvs.length > 0 && (
                  <div className="p-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">Cash Advances</span>
                    {searchResults.cadvs.map(ca => (
                      <button
                        key={ca.id}
                        onClick={() => { navigate(`/cash-advances/${ca.id}`); setSearchQuery(''); setIsMobileSearchOpen(false); }}
                        className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded flex justify-between items-center"
                        id={`mobile_search_result_cadv_${ca.id}`}
                      >
                        <div>
                          <span className="font-bold text-slate-700 block">CADV-{ca.id.substring(0, 6).toUpperCase()}</span>
                          <span className="text-slate-500 font-semibold truncate max-w-[200px] block">{ca.purpose}</span>
                        </div>
                        <span className="font-extrabold text-slate-950">{formatPHP(ca.amount)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.liqs.length > 0 && (
                  <div className="p-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">Liquidations</span>
                    {searchResults.liqs.map(l => (
                      <button
                        key={l.id}
                        onClick={() => { navigate(`/liquidations/${l.id}`); setSearchQuery(''); setIsMobileSearchOpen(false); }}
                        className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded flex justify-between items-center"
                        id={`mobile_search_result_liq_${l.id}`}
                      >
                        <div>
                          <span className="font-bold text-emerald-700 block">LIQ-{l.id.substring(0, 6).toUpperCase()}</span>
                          <span className="text-slate-500 font-semibold block">
                            {l.varianceAmount === 0 ? 'Settled' : l.varianceAmount < 0 ? 'Refund Due' : 'Reimbursement Due'}
                          </span>
                        </div>
                        <span className="font-extrabold text-slate-950">{formatPHP(l.totalSpent)} spent</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 glass-panel border-b border-slate-200/60 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 shadow-sm">
          <div className="flex items-center text-[13px] text-slate-500 font-medium min-w-0">
             <button
               onClick={() => setSidebarOpen(true)}
               className="md:hidden text-slate-500 hover:text-slate-700 p-1.5 mr-1.5 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
               id="mobile_sidebar_hamburger"
               aria-label="Open sidebar menu"
             >
               <List className="w-5 h-5" />
             </button>
             <span className="hidden sm:inline shrink-0">Microgenesis</span>
             <CaretRight className="w-4 h-4 mx-1.5 opacity-40 hidden sm:inline shrink-0" />
             <span className="text-slate-900 font-semibold truncate">{getBreadcrumb()}</span>
          </div>

          {/* Global Search Component */}
          {isSearching && searchQuery.trim() && (
            <div className="fixed inset-0 z-40" onClick={() => setIsSearching(false)} id="search_overlay_dismiss" />
          )}
          <div className="flex-1 max-w-lg mx-8 relative hidden md:block z-50">
            <div className="relative group z-50">
              <input
                type="text"
                placeholder="Search requests (ID, claimant, purpose, amount)..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setIsSearching(true);
                }}
                onFocus={() => { handleSearchFocus(); setIsSearching(true); }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 placeholder-slate-400 text-sm px-4 py-2 pl-10 rounded-lg border border-transparent focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none transition-all duration-200 relative z-50"
                id="global_search_input"
              />
              <MagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 transition-colors group-focus-within:text-brand z-50" />
            </div>

            {/* Results dropdown */}
            {isSearching && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[350px] overflow-y-auto z-50 text-slate-800 animate-dropdown-in" id="global_search_results_container">
                {isSearchLoading ? (
                  <div className="p-4 text-center text-xs text-slate-500 italic">Searching...</div>
                ) : searchResults.claims.length === 0 && searchResults.cadvs.length === 0 && searchResults.liqs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 italic">
                    No matching requests found.<br/>
                    <span className="text-[10px] mt-1 block opacity-75">You can only search requests you have access to.</span>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {searchResults.claims.length > 0 && (
                      <div className="p-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">Reimbursements</span>
                        {searchResults.claims.map(c => (
                          <button
                            key={c.id}
                            onClick={() => { navigate(`/claims/${c.id}`); setSearchQuery(''); setIsSearching(false); }}
                            className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded flex justify-between items-center"
                            id={`search_result_reim_${c.id}`}
                          >
                            <div>
                              <span className="font-bold text-brand block">REIM-{c.id.substring(0, 6).toUpperCase()}</span>
                              <span className="text-slate-500 font-semibold">{c.notes || c.expense_category}</span>
                            </div>
                            <span className="font-extrabold text-slate-950">{formatPHP(c.total_amount)}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults.cadvs.length > 0 && (
                      <div className="p-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">Cash Advances</span>
                        {searchResults.cadvs.map(ca => (
                          <button
                            key={ca.id}
                            onClick={() => { navigate(`/cash-advances/${ca.id}`); setSearchQuery(''); setIsSearching(false); }}
                            className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded flex justify-between items-center"
                            id={`search_result_cadv_${ca.id}`}
                          >
                            <div>
                              <span className="font-bold text-slate-700 block">CADV-{ca.id.substring(0, 6).toUpperCase()}</span>
                              <span className="text-slate-500 font-semibold truncate max-w-[200px] block">{ca.purpose}</span>
                            </div>
                            <span className="font-extrabold text-slate-950">{formatPHP(ca.amount)}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults.liqs.length > 0 && (
                      <div className="p-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">Liquidations</span>
                        {searchResults.liqs.map(l => (
                          <button
                            key={l.id}
                            onClick={() => { navigate(`/liquidations/${l.id}`); setSearchQuery(''); setIsSearching(false); }}
                            className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded flex justify-between items-center"
                            id={`search_result_liq_${l.id}`}
                          >
                            <div>
                              <span className="font-bold text-emerald-700 block">LIQ-{l.id.substring(0, 6).toUpperCase()}</span>
                              <span className="text-slate-500 font-semibold block">
                                {l.varianceAmount === 0 ? 'Settled' : l.varianceAmount < 0 ? 'Refund Due' : 'Reimbursement Due'}
                              </span>
                            </div>
                            <span className="font-extrabold text-slate-950">{formatPHP(l.totalSpent)} spent</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-5">
            {/* Mobile Search Trigger Button */}
            <button
              onClick={() => { handleSearchFocus(); setIsMobileSearchOpen(true); }}
              className="md:hidden text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-50 transition-colors shrink-0"
              id="mobile_search_trigger"
              aria-label="Open search"
            >
              <MagnifyingGlass className="w-5 h-5" />
            </button>

            {isNotifOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} id="notif_overlay_dismiss" />
            )}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsNotifOpen(o => !o)}
                className="text-slate-400 hover:text-slate-700 relative p-1.5 rounded-full hover:bg-slate-50 transition-colors"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute top-full right-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[420px] overflow-y-auto z-50 text-slate-800 animate-dropdown-in" id="notif_dropdown">
                  <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                    <span className="text-xs font-bold text-slate-700">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold text-red-600">{unreadCount} unread</span>
                    )}
                  </div>
                  {notifPreview.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 italic">No notifications yet.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {notifPreview.map(n => (
                        <button
                          key={n.id}
                          onClick={() => {
                            if (!n.read) markNotificationRead(n.id);
                            setIsNotifOpen(false);
                            navigate('/emails');
                          }}
                          className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 flex gap-2 items-start ${!n.read ? 'bg-brand/5' : ''}`}
                        >
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />}
                          <div className={`min-w-0 ${n.read ? 'pl-3.5' : ''}`}>
                            <div className={`text-xs truncate ${!n.read ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>{n.subject}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{formatDistanceToNowStrict(new Date(n.timestamp), { addSuffix: true })}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <Link
                    to="/emails"
                    onClick={() => setIsNotifOpen(false)}
                    className="block px-3 py-2 text-center text-[11px] font-bold text-brand hover:bg-slate-50 border-t border-slate-100 sticky bottom-0 bg-white"
                  >
                    View all
                  </Link>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 border-l border-slate-200 pl-3 sm:pl-5 shrink-0">
              <div className="text-right leading-tight">
                <div className="text-xs sm:text-sm font-semibold text-slate-900 max-w-[85px] sm:max-w-none truncate">{user?.name}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5 hidden sm:block">
                  {user?.job_title ? `${user.job_title} · ${user.role}` : user?.role}
                </div>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1" aria-label="Log out">
                <SignOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Main scrollable content */}
        <main
          ref={mainRef}
          className={`relative flex-1 p-4 sm:p-6 md:p-8 ${
            location.pathname === '/emails'
              ? 'flex flex-col overflow-hidden'
              : 'overflow-auto'
          }`}
        >
          <div
            key={location.pathname}
            className={`relative z-[1] max-w-7xl mx-auto animate-page-fade-in w-full ${
              location.pathname === '/emails'
                ? 'flex flex-col flex-1 min-h-0 h-full'
                : ''
            }`}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
