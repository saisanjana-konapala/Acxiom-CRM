import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  CalendarClock, Check, ChevronDown, ChevronRight, CircleDollarSign,
  ContactRound, Download, FileClock, Filter, LayoutDashboard, LogOut,
  Menu, MoreHorizontal, Plus, Search, ShieldCheck, Target, Users, X,
} from 'lucide-react';
import {
  getGetActivitiesQueryKey, getGetAuditQueryKey, getGetCustomersQueryKey,
  getGetDashboardQueryKey, getGetFollowUpsQueryKey, getGetLeadsQueryKey,
  getGetMeQueryKey, getGetOpportunitiesQueryKey, getGetReportsQueryKey,
  getHealthCheckQueryKey,
  getGetUsersQueryKey, useCreateCustomer, useCreateFollowUp, useCreateLead,
  useCreateOpportunity, useCreateUserProfile, useConvertLead, useDeleteCustomer,
  useDeleteFollowUp, useDeleteLead, useDeleteOpportunity, useGetActivities,
  useGetAudit, useGetCustomers, useGetDashboard, useGetFollowUps, useGetLeads,
  useGetMe, useGetOpportunities, useGetReports, useGetUsers, useHealthCheck,
  useUpdateCustomer, useUpdateFollowUp, useUpdateLead, useUpdateOpportunity,
  useUpdateUserProfile,
} from '@workspace/api-client-react';
import type {
  Customer, CustomerInput, FollowUp, FollowUpInput, Lead, LeadInput,
  Opportunity, OpportunityInput, User, UserInput,
} from '@workspace/api-client-react';
import { Route, Router as WouterRouter, Link, Redirect, Switch, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import NotFound from '@/pages/not-found';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const money = (amount: number | null | undefined) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount || 0);
const dateLabel = (value?: string) => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
const initials = (name = 'A') => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const slug = (value = '') => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
function refreshCRM(client: QueryClient, keys: readonly (readonly unknown[])[] = []) {
  void Promise.all([
    ...keys.map((queryKey) => client.invalidateQueries({ queryKey })),
    client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
    client.invalidateQueries({ queryKey: getGetActivitiesQueryKey() }),
    client.invalidateQueries({ queryKey: getGetAuditQueryKey() }),
    client.invalidateQueries({ queryKey: getGetReportsQueryKey() }),
  ]);
}

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#356e60',
    colorForeground: '#25313b',
    colorMutedForeground: '#727b80',
    colorDanger: '#b8463f',
    colorBackground: '#ffffff',
    colorInput: '#fbfaf7',
    colorInputForeground: '#25313b',
    colorNeutral: '#dedbd3',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#25313b] font-bold tracking-tight',
    headerSubtitle: 'text-[#727b80]',
    socialButtonsBlockButtonText: 'text-[#25313b] font-semibold',
    formFieldLabel: 'text-[#34424a] font-semibold',
    footerActionLink: 'text-[#356e60] font-semibold',
    footerActionText: 'text-[#727b80]',
    dividerText: 'text-[#727b80]',
    identityPreviewEditButton: 'text-[#356e60]',
    formFieldSuccessText: 'text-[#356e60]',
    alertText: 'text-[#9a3934]',
    logoBox: 'mb-2',
    logoImage: 'max-h-9',
    socialButtonsBlockButton: 'border-[#dedbd3] bg-[#fbfaf7] hover:bg-[#f3f1eb]',
    formButtonPrimary: 'bg-[#356e60] hover:bg-[#285b4e] text-white',
    formFieldInput: 'bg-[#fbfaf7] border-[#dedbd3] text-[#25313b]',
    footerAction: 'border-0',
    dividerLine: 'bg-[#e8e5de]',
    alert: 'bg-[#fff2ef] border-[#f2cbc3]',
    otpCodeFieldInput: 'border-[#dedbd3]',
    formFieldRow: 'mb-4',
    main: 'gap-5',
  },
};

function ClerkCacheClearer() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previous.current !== undefined && previous.current !== userId) queryClient.clear();
    previous.current = userId;
  }), [addListener, queryClient]);
  return null;
}

function AuthPages() {
  return (
    <Switch>
      <Route path="/sign-in/*?">
        <div className="auth-backdrop"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>
      </Route>
      <Route path="/sign-up/*?">
        <div className="auth-backdrop"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>
      </Route>
      <Route path="/" component={HomeRedirect} />
      <Route path="/dashboard" component={DashboardRoute} />
      <Route path="/customers" component={CustomersRoute} />
      <Route path="/leads" component={LeadsRoute} />
      <Route path="/opportunities" component={OpportunitiesRoute} />
      <Route path="/follow-ups" component={FollowUpsRoute} />
      <Route path="/reports" component={ReportsRoute} />
      <Route path="/audit" component={AuditRoute} />
      <Route path="/users" component={UsersRoute} />
      <Route component={NotFound} />
    </Switch>
  );
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Landing /></Show></>;
}

function Authenticated({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function Landing() {
  useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  return (
    <main className="landing">
      <header className="landing-nav">
        <Link href="/" className="brand-lockup"><BrandMark /><span>acxiom<span className="brand-light">CRM</span></span></Link>
        <div className="flex items-center gap-2"><Link href="/sign-in" className="landing-login">Sign in</Link><Link href="/sign-up" className="landing-cta">Start using Acxiom <ArrowRight size={15} /></Link></div>
      </header>
      <section className="landing-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> A clearer view of every relationship</div>
          <h1>Good sales<br />starts with <em>good follow-through.</em></h1>
          <p>One focused space for the people, conversations and opportunities that move your business forward.</p>
          <div className="flex flex-wrap items-center gap-3 mt-8"><Link href="/sign-up" className="landing-cta landing-cta-large">Create your workspace <ArrowRight size={16} /></Link><span className="hero-assurance">Simple by design. Ready for your team.</span></div>
          <div className="hero-proof"><div className="proof-avatars"><b>ML</b><b>RS</b><b>JT</b><b>AK</b></div><span>Built for the everyday rhythm of sales</span></div>
        </div>
        <div className="hero-art" aria-label="CRM pipeline preview">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <div className="preview-window">
            <div className="preview-top"><span className="preview-dot" /><span className="preview-dot" /><span className="preview-dot" /><span className="preview-title">Monday pipeline</span><span className="preview-period">THIS MONTH</span></div>
            <div className="preview-stat"><div><small>OPEN PIPELINE</small><strong>$428,600</strong></div><div className="preview-trend"><ArrowUpRight size={14} /> 12.8%</div></div>
            <div className="mini-chart"><div className="chart-grid" /><svg viewBox="0 0 480 120" preserveAspectRatio="none"><path d="M0 96 C30 92 39 72 76 79 S124 65 156 73 S210 36 247 52 S305 54 337 34 S383 49 410 25 S456 35 480 11" fill="none" stroke="#d99a54" strokeWidth="3" strokeLinecap="round" /><path d="M0 96 C30 92 39 72 76 79 S124 65 156 73 S210 36 247 52 S305 54 337 34 S383 49 410 25 S456 35 480 11 L480 120 L0 120Z" fill="url(#area)" opacity=".23" /><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#d99a54" /><stop offset="1" stopColor="#d99a54" stopOpacity="0" /></linearGradient></defs></svg></div>
            <div className="preview-pipeline"><div className="pipeline-head"><b>Next up</b><span>3 deals to move</span></div>{[['Helio Systems', 'Proposal', '$48,000'], ['Northline Co.', 'Negotiation', '$32,500'], ['Morrow Studio', 'Qualification', '$19,800']].map(([name, stage, val]) => <div className="pipeline-row" key={name}><span className="mini-avatar">{name[0]}</span><span className="pipeline-name">{name}<small>{stage}</small></span><b>{val}</b><ChevronRight size={14} /></div>)}</div>
          </div>
          <div className="floating-note"><span className="floating-check"><Check size={16} /></span><span><b>Follow-up complete</b><small>Helio Systems · 9:42 AM</small></span></div>
          <div className="art-index"><span>01</span> RELATIONSHIPS, IN MOTION</div>
        </div>
      </section>
      <section className="landing-strip"><span>THE WORK, ORGANIZED</span><div><i><Users size={16} /> Customer relationships</i><i><Target size={16} /> Active opportunities</i><i><CalendarClock size={16} /> Timely follow-through</i></div></section>
      <section className="landing-bottom"><span>LESS ADMIN. MORE MOMENTUM.</span><h2>Your pipeline deserves<br />a little more <em>clarity.</em></h2><Link href="/sign-up" className="landing-cta">Make a better start <ArrowRight size={15} /></Link><small>AcxiomCRM · A practical home for your sales day</small></section>
    </main>
  );
}

function BrandMark() {
  return <span className="brand-mark"><span /><span /><span /><span /></span>;
}

const navGroups = [
  { label: 'WORKSPACE', links: [{ path: '/dashboard', label: 'Overview', icon: LayoutDashboard }, { path: '/customers', label: 'Customers', icon: ContactRound }, { path: '/leads', label: 'Leads', icon: Target }, { path: '/opportunities', label: 'Opportunities', icon: BriefcaseBusiness }, { path: '/follow-ups', label: 'Follow-ups', icon: CalendarClock }] },
  { label: 'INSIGHTS', links: [{ path: '/reports', label: 'Reports', icon: Activity }, { path: '/audit', label: 'Audit history', icon: FileClock }] },
  { label: 'ADMINISTRATION', links: [{ path: '/users', label: 'Team access', icon: ShieldCheck }] },
];

function Shell({ title, subtitle, children, action }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const profile = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const displayName = profile.data?.name || user?.fullName || user?.firstName || 'Team member';
  const visibleNavGroups = navGroups.map((group) => ({
    ...group,
    links: group.links.filter(({ path }) =>
      (path !== '/audit' || ['Admin', 'Manager'].includes(profile.data?.role || '')) &&
      (path !== '/users' || profile.data?.role === 'Admin'),
    ),
  })).filter((group) => group.links.length > 0);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <Link href="/dashboard" className="sidebar-brand"><BrandMark /><span>acxiom<span>CRM</span></span></Link>
        <div className="workspace-switch"><div className="workspace-monogram">A</div><span><b>Acxiom Studio</b><small>Sales workspace</small></span><ChevronDown size={15} /></div>
         <nav className="side-nav">{visibleNavGroups.map((group) => <section className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.links.map(({ path, label, icon: Icon }) => <Link data-testid={`link-nav-${slug(label)}`} key={path} href={path} onClick={() => setMobileOpen(false)} className={`nav-link ${location === path ? 'nav-link-active' : ''}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>)}</section>)}</nav>
        <div className="sidebar-bottom"><div className="sidebar-help"><div className="help-mark"><Activity size={15} /></div><b>Keep the thread.</b><p>Good relationships grow from small, thoughtful moments.</p><Link href="/follow-ups">View follow-ups <ArrowRight size={13} /></Link></div><button className="profile-row" type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })}><span className="profile-avatar">{initials(displayName)}</span><span className="profile-name"><b>{displayName}</b><small>{profile.data?.role || 'Sales team'}</small></span><LogOut size={16} /></button></div>
      </aside>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <div className="main-area">
        <header className="topbar"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="crumb"><span>Acxiom Studio</span><ChevronRight size={13} /><b>{title}</b></div><div className="topbar-right"><div className="today-pill"><span /> Workspace live</div><button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button><span className="top-avatar">{initials(displayName)}</span></div></header>
        <main className="page-content crm-enter"><div className="page-heading"><div><div className="heading-overline">SALES WORKSPACE <span /> {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>{children}</main>
      </div>
    </div>
  );
}

function DashboardRoute() { return <Authenticated><DashboardPage /></Authenticated>; }
function CustomersRoute() { return <Authenticated><CustomersPage /></Authenticated>; }
function LeadsRoute() { return <Authenticated><LeadsPage /></Authenticated>; }
function OpportunitiesRoute() { return <Authenticated><OpportunitiesPage /></Authenticated>; }
function FollowUpsRoute() { return <Authenticated><FollowUpsPage /></Authenticated>; }
function ReportsRoute() { return <Authenticated><ReportsPage /></Authenticated>; }
function AuditRoute() { return <Authenticated><AuditPage /></Authenticated>; }
function UsersRoute() { return <Authenticated><UsersPage /></Authenticated>; }

function DashboardPage() {
  const query = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const activityQuery = useGetActivities({ query: { queryKey: getGetActivitiesQueryKey() } });
  const dashboard = query.data;
  return <Shell title="Overview" subtitle="A calm view of what's moving, and what needs your attention.">
    {query.isLoading ? <SkeletonCards /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : dashboard ? <>
      <div className="metric-grid">
        <Metric icon={<Users size={17} />} label="Customers" value={dashboard.customerCount.toLocaleString()} detail="relationships in your book" tone="mint" />
        <Metric icon={<Target size={17} />} label="Open leads" value={dashboard.leadCount.toLocaleString()} detail="conversations to progress" tone="amber" />
        <Metric icon={<BriefcaseBusiness size={17} />} label="Open opportunities" value={dashboard.openOpportunityCount.toLocaleString()} detail="active in your pipeline" tone="blue" />
        <Metric icon={<CircleDollarSign size={17} />} label="Pipeline value" value={money(dashboard.pipelineValue)} detail={`${money(dashboard.wonValue)} closed won`} tone="rose" />
      </div>
      <div className="dashboard-columns">
        <section className="panel pipeline-panel"><div className="panel-head"><div><h2>Pipeline at a glance</h2><p>Active deal value across each stage</p></div><Link href="/opportunities" className="subtle-link">Open pipeline <ArrowRight size={14} /></Link></div>
          {dashboard.stages.length ? <div className="stage-bars">{dashboard.stages.map((stage, index) => { const max = Math.max(...dashboard.stages.map((s) => s.value), 1); return <div className="stage-bar-row" key={stage.stage}><div className="stage-row-top"><span className="stage-name"><i className={`stage-dot stage-${slug(stage.stage)}`} />{titleCase(stage.stage)}</span><span className="stage-amount">{money(stage.value)} <small>· {stage.count}</small></span></div><div className="stage-track"><span className={`stage-fill stage-fill-${index % 5}`} style={{ width: `${Math.max(stage.value / max * 100, 3)}%` }} /></div></div>; })}<div className="stage-total"><span>Total active value</span><b>{money(dashboard.pipelineValue)}</b></div></div> : <EmptyState title="No deals in the pipeline yet" detail="Add an opportunity to start tracking your next win." link="/opportunities" linkLabel="Create opportunity" />}
        </section>
        <section className="panel attention-panel"><div className="panel-head"><div><h2>Worth a look</h2><p>Your next thoughtful touchpoint</p></div><span className="attention-icon"><CalendarClock size={17} /></span></div><div className="attention-number">{dashboard.followUpsDue}<span> follow-ups due</span></div><p className="attention-copy">A steady rhythm keeps good opportunities from going quiet.</p><Link href="/follow-ups" className="attention-link">Plan your next step <ArrowRight size={14} /></Link><div className="attention-rule" /><div className="attention-foot"><span className="pulse" /> Based on your planned follow-ups</div></section>
      </div>
      <section className="panel activity-panel"><div className="panel-head"><div><h2>Recent activity</h2><p>The latest movement across your workspace</p></div><Link href="/audit" className="subtle-link">View audit history <ArrowRight size={14} /></Link></div>
        {activityQuery.isLoading && !dashboard.recentActivity.length ? <TableSkeleton /> : activityQuery.isError ? <ErrorState retry={() => activityQuery.refetch()} /> : (activityQuery.data?.length ? activityQuery.data.slice(0, 6) : dashboard.recentActivity).length ? <div className="activity-list">{(activityQuery.data?.length ? activityQuery.data.slice(0, 6) : dashboard.recentActivity).map((item) => <ActivityRow key={item.id} item={item} />)}</div> : <EmptyState title="The story starts here" detail="Activity will show up as your team works with customers and deals." />}
      </section>
    </> : null}
  </Shell>;
}

function Metric({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <article className="metric-card"><div className={`metric-icon metric-${tone}`}>{icon}</div><div className="metric-label">{label}</div><strong className="metric-value">{value}</strong><div className="metric-detail">{detail}</div><span className="metric-corner" /></article>;
}

function CustomersPage() {
  const query = useGetCustomers(undefined, { query: { queryKey: getGetCustomersQueryKey() } });
  const client = useQueryClient();
  const create = useCreateCustomer(); const update = useUpdateCustomer(); const remove = useDeleteCustomer();
  const [search, setSearch] = useState(''); const [record, setRecord] = useState<Customer | null | false>(false);
  const rows = (query.data || []).filter((row) => `${row.name} ${row.company} ${row.email}`.toLowerCase().includes(search.toLowerCase()));
  const fields: Field[] = [{ key: 'name', label: 'Full name', required: true }, { key: 'company', label: 'Company', required: true }, { key: 'email', label: 'Email', type: 'email', required: true }, { key: 'phone', label: 'Phone', required: true }, { key: 'source', label: 'Source' }, { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] }, { key: 'notes', label: 'Notes', type: 'textarea' }];
  const save = (data: Record<string, string>) => {
    const payload = data as unknown as CustomerInput;
    const done = () => { refreshCRM(client, [getGetCustomersQueryKey()]); setRecord(false); };
    if (record) update.mutate({ id: record.id, data: payload }, { onSuccess: done });
    else create.mutate({ data: payload }, { onSuccess: done });
  };
  const del = (row: Customer) => { if (window.confirm(`Remove ${row.name} from customers?`)) remove.mutate({ id: row.id }, { onSuccess: () => refreshCRM(client, [getGetCustomersQueryKey()]) }); };
  return <Shell title="Customers" subtitle="The people and organizations behind your best work." action={<Button onClick={() => setRecord(null)} data-testid="button-add-customer" className="primary-action"><Plus size={16} /> Add customer</Button>}>
    <div className="panel records-panel"><div className="list-toolbar"><div className="record-count"><b>{query.data?.length || 0}</b> customers <span>·</span> Keep relationships current</div><div className="toolbar-tools"><label className="search-wrap"><Search size={15} /><Input data-testid="input-search-customers" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers" /></label><button className="filter-btn" type="button" onClick={() => setSearch('')}><Filter size={15} /> Clear</button></div></div>
      {query.isLoading ? <TableSkeleton /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !rows.length ? <EmptyState title={search ? 'No matches found' : 'Your customer list is ready'} detail={search ? 'Try a different name or company.' : 'Add a customer to start building a thoughtful relationship history.'} action={!search ? <Button className="primary-action" onClick={() => setRecord(null)}><Plus size={15} /> Add customer</Button> : undefined} /> : <div className="table-scroll"><table className="crm-table"><thead><tr><th>Customer</th><th>Company</th><th>Contact</th><th>Status</th><th>Source</th><th>Owner</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} data-testid={`row-customer-${row.id}`}><td><div className="person-cell"><span className="table-avatar avatar-${row.id % 5}">{initials(row.name)}</span><span><b>{row.name}</b><small>Added {dateLabel(row.createdAt)}</small></span></div></td><td>{row.company || '—'}</td><td><span className="contact-text">{row.email}<small>{row.phone}</small></span></td><td><StatusPill value={row.status} /></td><td>{row.source || '—'}</td><td><Owner name={row.ownerName} /></td><td><RowActions onEdit={() => setRecord(row)} onDelete={() => del(row)} /></td></tr>)}</tbody></table></div>}
    </div>
    {record !== false && <RecordDialog title={record ? 'Edit customer' : 'Add a customer'} description="Keep the details that help your team make every interaction feel personal." fields={fields} initial={record || undefined} busy={create.isPending || update.isPending} onClose={() => setRecord(false)} onSave={save} />}
  </Shell>;
}

function LeadsPage() {
  const query = useGetLeads(undefined, { query: { queryKey: getGetLeadsQueryKey() } });
  const client = useQueryClient(); const create = useCreateLead(); const update = useUpdateLead(); const remove = useDeleteLead(); const convert = useConvertLead();
  const [search, setSearch] = useState(''); const [record, setRecord] = useState<Lead | null | false>(false);
  const rows = (query.data || []).filter((row) => `${row.name} ${row.company} ${row.email}`.toLowerCase().includes(search.toLowerCase()));
  const fields: Field[] = [{ key: 'name', label: 'Full name', required: true }, { key: 'company', label: 'Company', required: true }, { key: 'email', label: 'Email', type: 'email', required: true }, { key: 'phone', label: 'Phone', required: true }, { key: 'source', label: 'Source' }, { key: 'status', label: 'Status', type: 'select', options: ['new', 'contacted', 'qualified', 'lost', 'converted'] }, { key: 'value', label: 'Potential value', type: 'number' }, { key: 'notes', label: 'Notes', type: 'textarea' }];
  const save = (data: Record<string, string>) => {
    const payload = { ...data, value: data.value ? Number(data.value) : null } as unknown as LeadInput;
    const done = () => { refreshCRM(client, [getGetLeadsQueryKey()]); setRecord(false); };
    if (record) update.mutate({ id: record.id, data: payload }, { onSuccess: done }); else create.mutate({ data: payload }, { onSuccess: done });
  };
  const del = (row: Lead) => { if (window.confirm(`Remove ${row.name} from leads?`)) remove.mutate({ id: row.id }, { onSuccess: () => refreshCRM(client, [getGetLeadsQueryKey()]) }); };
  const convertOne = (row: Lead) => { if (window.confirm(`Convert ${row.name} into a customer and opportunity?`)) convert.mutate({ id: row.id }, { onSuccess: () => { void client.invalidateQueries({ queryKey: getGetLeadsQueryKey() }); void client.invalidateQueries({ queryKey: getGetCustomersQueryKey() }); void client.invalidateQueries({ queryKey: getGetOpportunitiesQueryKey() }); void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } }); };
  return <Shell title="Leads" subtitle="Find the promising conversations and give them a next step." action={<Button onClick={() => setRecord(null)} data-testid="button-add-lead" className="primary-action"><Plus size={16} /> Add lead</Button>}>
    <div className="panel records-panel"><div className="list-toolbar"><div className="record-count"><b>{query.data?.length || 0}</b> leads <span>·</span> From first hello to qualified opportunity</div><div className="toolbar-tools"><label className="search-wrap"><Search size={15} /><Input value={search} data-testid="input-search-leads" onChange={(e) => setSearch(e.target.value)} placeholder="Search leads" /></label><button className="filter-btn" onClick={() => setSearch('')}><Filter size={15} /> Clear</button></div></div>
      {query.isLoading ? <TableSkeleton /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !rows.length ? <EmptyState title={search ? 'No leads found' : 'A good conversation starts somewhere'} detail={search ? 'Try a different name, company or email.' : 'Add your first lead and keep every next step in view.'} action={!search ? <Button className="primary-action" onClick={() => setRecord(null)}><Plus size={15} /> Add lead</Button> : undefined} /> : <div className="table-scroll"><table className="crm-table"><thead><tr><th>Lead</th><th>Company</th><th>Potential</th><th>Status</th><th>Source</th><th>Owner</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} data-testid={`row-lead-${row.id}`}><td><div className="person-cell"><span className="table-avatar avatar-${row.id % 5}">{initials(row.name)}</span><span><b>{row.name}</b><small>{row.email}</small></span></div></td><td>{row.company || '—'}</td><td className="amount-cell">{row.value ? money(row.value) : '—'}</td><td><StatusPill value={row.status} /></td><td>{row.source || '—'}</td><td><Owner name={row.ownerName} /></td><td><RowActions onEdit={() => setRecord(row)} onDelete={() => del(row)} extra={row.status !== 'converted' && row.status !== 'lost' ? <button className="row-action convert-action" type="button" onClick={() => convertOne(row)} title="Convert lead" aria-label={`Convert ${row.name}`}><ArrowRight size={15} /></button> : undefined} /></td></tr>)}</tbody></table></div>}
    </div>{record !== false && <RecordDialog title={record ? 'Edit lead' : 'Add a lead'} description="Capture enough context for the next conversation to start naturally." fields={fields} initial={record || undefined} busy={create.isPending || update.isPending} onClose={() => setRecord(false)} onSave={save} />}
  </Shell>;
}

function OpportunitiesPage() {
  const query = useGetOpportunities(undefined, { query: { queryKey: getGetOpportunitiesQueryKey() } }); const customers = useGetCustomers(undefined, { query: { queryKey: getGetCustomersQueryKey() } }); const leads = useGetLeads(undefined, { query: { queryKey: getGetLeadsQueryKey() } });
  const client = useQueryClient(); const create = useCreateOpportunity(); const update = useUpdateOpportunity(); const remove = useDeleteOpportunity();
  const [search, setSearch] = useState(''); const [record, setRecord] = useState<Opportunity | null | false>(false); const [view, setView] = useState<'table' | 'stages'>('stages');
  const rows = (query.data || []).filter((row) => `${row.title} ${row.customerName}`.toLowerCase().includes(search.toLowerCase()));
  const fields: Field[] = [{ key: 'title', label: 'Opportunity name', required: true }, { key: 'customerId', label: 'Customer', type: 'select', options: (customers.data || []).map((c) => ({ label: c.name, value: String(c.id) })) }, { key: 'leadId', label: 'Lead', type: 'select', options: (leads.data || []).filter((l) => l.status !== 'converted').map((l) => ({ label: l.name, value: String(l.id) })) }, { key: 'amount', label: 'Deal amount', type: 'number', required: true }, { key: 'probability', label: 'Probability (%)', type: 'number' }, { key: 'stage', label: 'Stage', type: 'select', options: ['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost'] }, { key: 'closeDate', label: 'Expected close date', type: 'date' }];
  const save = (data: Record<string, string>) => {
    const payload = { ...data, customerId: data.customerId ? Number(data.customerId) : null, leadId: data.leadId ? Number(data.leadId) : null, amount: Number(data.amount), probability: Number(data.probability || 0) } as unknown as OpportunityInput;
    const done = () => { refreshCRM(client, [getGetOpportunitiesQueryKey()]); setRecord(false); };
    if (record) update.mutate({ id: record.id, data: payload }, { onSuccess: done }); else create.mutate({ data: payload }, { onSuccess: done });
  };
  const del = (row: Opportunity) => { if (window.confirm(`Remove “${row.title}” from the pipeline?`)) remove.mutate({ id: row.id }, { onSuccess: () => refreshCRM(client, [getGetOpportunitiesQueryKey()]) }); };
  const stages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost'];
  return <Shell title="Opportunities" subtitle="Keep deal momentum visible from first interest to close." action={<Button onClick={() => setRecord(null)} data-testid="button-add-opportunity" className="primary-action"><Plus size={16} /> New opportunity</Button>}>
    <div className="pipeline-summary"><div><span>ACTIVE PIPELINE</span><b>{money(rows.filter((r) => !['won', 'lost'].includes(r.stage)).reduce((sum, r) => sum + r.amount, 0))}</b></div><div><span>OPEN DEALS</span><b>{rows.filter((r) => !['won', 'lost'].includes(r.stage)).length}</b></div><div><span>WON VALUE</span><b>{money(rows.filter((r) => r.stage === 'won').reduce((sum, r) => sum + r.amount, 0))}</b></div><div className="summary-caption"><span className="summary-ornament" /> A pipeline is a promise to follow through.</div></div>
    <div className="panel records-panel"><div className="list-toolbar"><div className="view-switch"><button className={view === 'stages' ? 'view-on' : ''} onClick={() => setView('stages')}>By stage</button><button className={view === 'table' ? 'view-on' : ''} onClick={() => setView('table')}>All deals</button></div><div className="toolbar-tools"><label className="search-wrap"><Search size={15} /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search opportunities" /></label><button className="filter-btn" onClick={() => setSearch('')}><Filter size={15} /> Clear</button></div></div>
      {query.isLoading ? <TableSkeleton /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !rows.length ? <EmptyState title="The next win is yours to shape" detail="Add a deal to map its value, stage and expected close date." action={<Button className="primary-action" onClick={() => setRecord(null)}><Plus size={15} /> New opportunity</Button>} /> : view === 'stages' ? <div className="kanban-board">{stages.map((stage) => { const stageRows = rows.filter((row) => row.stage === stage); return <section className="kanban-column" key={stage}><div className="kanban-heading"><span><i className={`stage-dot stage-${stage}`} />{titleCase(stage)}</span><b>{stageRows.length}</b></div><div className="kanban-value">{money(stageRows.reduce((sum, row) => sum + row.amount, 0))}</div><div className="kanban-stack">{stageRows.length ? stageRows.map((row) => <article className="deal-card" key={row.id}><div className="deal-top"><span className={`deal-marker marker-${stage}`}><BriefcaseBusiness size={14} /></span><button className="deal-edit" onClick={() => setRecord(row)} aria-label={`Edit ${row.title}`}><MoreHorizontal size={18} /></button></div><h3>{row.title}</h3><p>{row.customerName || 'Unlinked record'}</p><div className="deal-card-bottom"><b>{money(row.amount)}</b><span>{row.probability}%</span></div><div className="deal-progress"><i style={{ width: `${row.probability}%` }} /></div><div className="deal-footer"><Owner name={row.ownerName} /><span>{dateLabel(row.closeDate)}</span></div><div className="deal-actions"><button onClick={() => del(row)}>Remove</button><button onClick={() => setRecord(row)}>Edit deal</button></div></article>) : <div className="kanban-empty">Nothing here yet</div>}</div></section>; })}</div> : <div className="table-scroll"><table className="crm-table"><thead><tr><th>Opportunity</th><th>Customer / lead</th><th>Amount</th><th>Probability</th><th>Stage</th><th>Close date</th><th>Owner</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{row.title}</b></td><td>{row.customerName || 'Lead'}</td><td className="amount-cell">{money(row.amount)}</td><td>{row.probability}%</td><td><StatusPill value={row.stage} /></td><td>{dateLabel(row.closeDate)}</td><td><Owner name={row.ownerName} /></td><td><RowActions onEdit={() => setRecord(row)} onDelete={() => del(row)} /></td></tr>)}</tbody></table></div>}
    </div>{record !== false && <RecordDialog title={record ? 'Edit opportunity' : 'Create opportunity'} description="Define the potential and the next milestone for this deal." fields={fields} initial={record || undefined} busy={create.isPending || update.isPending} onClose={() => setRecord(false)} onSave={save} />}
  </Shell>;
}

function FollowUpsPage() {
  const query = useGetFollowUps(undefined, { query: { queryKey: getGetFollowUpsQueryKey() } }); const customers = useGetCustomers(undefined, { query: { queryKey: getGetCustomersQueryKey() } }); const leads = useGetLeads(undefined, { query: { queryKey: getGetLeadsQueryKey() } }); const opportunities = useGetOpportunities(undefined, { query: { queryKey: getGetOpportunitiesQueryKey() } });
  const client = useQueryClient(); const create = useCreateFollowUp(); const update = useUpdateFollowUp(); const remove = useDeleteFollowUp(); const [record, setRecord] = useState<FollowUp | null | false>(false); const [filter, setFilter] = useState('all');
  const rows = (query.data || []).filter((row) => filter === 'all' || row.status === filter).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const options = [...(customers.data || []).map((v) => ({ label: `${v.name} · customer`, value: `customer:${v.id}` })), ...(leads.data || []).map((v) => ({ label: `${v.name} · lead`, value: `lead:${v.id}` })), ...(opportunities.data || []).map((v) => ({ label: `${v.title} · deal`, value: `opportunity:${v.id}` }))];
  const fields: Field[] = [{ key: 'title', label: 'Follow-up', required: true }, { key: 'dueDate', label: 'Due date', type: 'date', required: true }, { key: 'type', label: 'Type', type: 'select', options: ['call', 'email', 'meeting', 'task'] }, { key: 'status', label: 'Status', type: 'select', options: ['planned', 'completed'] }, { key: 'related', label: 'Related record', type: 'select', options: [{ label: 'Not linked', value: '' }, ...options] }];
  const save = (data: Record<string, string>) => {
    const [relatedType, related] = (data.related || ':').split(':');
    const payload = { title: data.title, dueDate: data.dueDate, type: data.type, status: data.status, relatedType: relatedType || 'customer', relatedId: related ? Number(related) : null, relatedName: options.find((o) => o.value === data.related)?.label.split(' · ')[0] || '' } as unknown as FollowUpInput;
    const done = () => { refreshCRM(client, [getGetFollowUpsQueryKey()]); setRecord(false); };
    if (record) update.mutate({ id: record.id, data: payload }, { onSuccess: done }); else create.mutate({ data: payload }, { onSuccess: done });
  };
  const toggle = (row: FollowUp) => update.mutate({ id: row.id, data: { title: row.title, dueDate: row.dueDate, status: row.status === 'completed' ? 'planned' : 'completed', type: row.type, relatedType: row.relatedType, relatedId: row.relatedId, relatedName: row.relatedName } }, { onSuccess: () => refreshCRM(client, [getGetFollowUpsQueryKey()]) });
  const del = (row: FollowUp) => { if (window.confirm(`Delete “${row.title}”?`)) remove.mutate({ id: row.id }, { onSuccess: () => refreshCRM(client, [getGetFollowUpsQueryKey()]) }); };
  const planned = query.data?.filter((r) => r.status === 'planned').length || 0;
  return <Shell title="Follow-ups" subtitle="A small next step can change the whole conversation." action={<Button onClick={() => setRecord(null)} className="primary-action" data-testid="button-add-follow-up"><Plus size={16} /> Plan a follow-up</Button>}>
    <div className="followup-banner"><div className="followup-emblem"><CalendarClock size={20} /></div><div><span>THE NEXT GOOD MOMENT</span><b>{planned} planned follow-ups</b></div><p>Stay close to the conversations that matter.</p><div className="followup-decoration">↗</div></div>
    <div className="panel records-panel"><div className="list-toolbar"><div className="record-count"><b>{rows.length}</b> {filter === 'all' ? 'follow-ups' : filter} <span>·</span> Your working list</div><div className="toolbar-tools"><div className="view-switch"><button className={filter === 'all' ? 'view-on' : ''} onClick={() => setFilter('all')}>All</button><button className={filter === 'planned' ? 'view-on' : ''} onClick={() => setFilter('planned')}>Planned</button><button className={filter === 'completed' ? 'view-on' : ''} onClick={() => setFilter('completed')}>Completed</button></div></div></div>
      {query.isLoading ? <TableSkeleton /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !rows.length ? <EmptyState title="Room for your next promise" detail="Plan a call, message or meeting so the important things stay important." action={<Button className="primary-action" onClick={() => setRecord(null)}><Plus size={15} /> Plan a follow-up</Button>} /> : <div className="followup-list">{rows.map((row) => <article className={`followup-row ${row.status === 'completed' ? 'is-completed' : ''}`} key={row.id} data-testid={`row-follow-up-${row.id}`}><button className="complete-check" onClick={() => toggle(row)} aria-label={row.status === 'completed' ? 'Mark planned' : 'Mark completed'}>{row.status === 'completed' && <Check size={14} />}</button><div className="followup-date"><b>{new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(new Date(row.dueDate))}</b><span>{new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(row.dueDate)).toUpperCase()}</span></div><div className="followup-main"><b>{row.title}</b><span><i className={`type-dot type-${row.type}`} />{titleCase(row.type)} <span className="soft-separator">·</span> {row.relatedName || 'No related record'}</span></div><Owner name={row.ownerName} /><StatusPill value={row.status} /><button className="row-action" onClick={() => setRecord(row)} aria-label="Edit follow-up"><MoreHorizontal size={17} /></button><button className="row-action" onClick={() => del(row)} aria-label="Delete follow-up"><X size={15} /></button></article>)}</div>}
    </div>{record !== false && <RecordDialog title={record ? 'Edit follow-up' : 'Plan a follow-up'} description="Give yourself a clear and useful next step." fields={fields} initial={record ? { ...record, related: `${record.relatedType}:${record.relatedId || ''}` } : undefined} busy={create.isPending || update.isPending} onClose={() => setRecord(false)} onSave={save} />}
  </Shell>;
}

function ReportsPage() {
  const query = useGetReports({ query: { queryKey: getGetReportsQueryKey() } }); const reports = query.data;
  return <Shell title="Reports" subtitle="Useful signals for a healthier, more predictable pipeline." action={<button className="secondary-action" onClick={() => window.print()}><Download size={15} /> Export view</button>}>
    {query.isLoading ? <SkeletonCards /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : reports ? <>
      <div className="report-topline"><div className="report-highlight"><span>LEAD CONVERSION</span><b>{reports.conversionRate.toFixed(1)}<small>%</small></b><p>Leads converted into customers</p><div className="conversion-track"><i style={{ width: `${Math.min(reports.conversionRate, 100)}%` }} /></div></div><div className="report-caption"><span className="report-icon"><Activity size={18} /></span><div><b>Build a rhythm, not a rush.</b><p>These snapshots help spot where conversations gather momentum and where they might need a little care.</p></div></div></div>
      <div className="report-grid"><section className="panel report-panel"><div className="panel-head"><div><h2>Pipeline by stage</h2><p>Deal value and volume currently in each stage</p></div><span className="report-badge">VALUE</span></div>{reports.pipelineByStage.length ? <div className="report-stage-list">{reports.pipelineByStage.map((item, i) => { const max = Math.max(...reports.pipelineByStage.map((r) => r.value), 1); return <div className="report-stage" key={item.stage}><div className="report-stage-heading"><span><i className={`stage-dot stage-${slug(item.stage)}`} />{titleCase(item.stage)}<small>{item.count} {item.count === 1 ? 'deal' : 'deals'}</small></span><b>{money(item.value)}</b></div><div className="report-track"><i className={`stage-fill-${i % 5}`} style={{ width: `${item.value / max * 100}%` }} /></div></div>; })}</div> : <EmptyState title="No pipeline data yet" detail="Deal stage summaries will show once opportunities are tracked." />}</section>
        <section className="panel report-panel"><div className="panel-head"><div><h2>Lead health</h2><p>Where new conversations stand today</p></div><span className="report-badge">LEADS</span></div>{reports.leadsByStatus.length ? <div className="lead-health">{reports.leadsByStatus.map((row, i) => { const total = Math.max(reports.leadsByStatus.reduce((n, r) => n + r.count, 0), 1); return <div className="health-row" key={row.label}><span className={`health-mark health-${i % 5}`} /><span>{titleCase(row.label)}</span><div className="health-track"><i className={`health-fill-${i % 5}`} style={{ width: `${row.count / total * 100}%` }} /></div><b>{row.count}</b></div>; })}<div className="lead-health-total"><span>All leads</span><b>{reports.leadsByStatus.reduce((n, r) => n + r.count, 0)}</b></div></div> : <EmptyState title="Lead health takes shape here" detail="Status distribution appears as leads move through your process." />}</section>
        <section className="panel report-panel owners-panel"><div className="panel-head"><div><h2>Top owners</h2><p>Team members progressing the most leads</p></div><span className="report-badge">TEAM</span></div>{reports.topOwners.length ? reports.topOwners.map((owner, i) => <div className="owner-rank" key={owner.label}><span className={`rank-num rank-${i}`}>{String(i + 1).padStart(2, '0')}</span><span className={`table-avatar avatar-${i % 5}`}>{initials(owner.label)}</span><span className="rank-name">{owner.label}<small>Lead owner</small></span><span className="rank-count">{owner.count}<small>records</small></span></div>) : <EmptyState title="The team will show here" detail="Owner performance appears when there's activity to measure." />}</section>
        <section className="report-note"><div className="note-sun"><ArrowUpRight size={18} /></div><span>ONE GOOD FOLLOW-UP AT A TIME</span><h3>Progress is usually<br />a conversation away.</h3><p>Use the follow-up list to give promising relationships the attention they deserve.</p><Link href="/follow-ups">Plan your next touchpoint <ArrowRight size={14} /></Link></section>
      </div>
    </> : null}
  </Shell>;
}

function AuditPage() {
  const query = useGetAudit({ query: { queryKey: getGetAuditQueryKey() } }); const [search, setSearch] = useState('');
  const rows = (query.data || []).filter((row) => `${row.action} ${row.entity} ${row.description} ${row.userName}`.toLowerCase().includes(search.toLowerCase()));
  return <Shell title="Audit history" subtitle="A clear record of changes made across your workspace." action={<label className="search-wrap audit-search"><Search size={15} /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search history" /></label>}>
    <div className="audit-intro"><span className="audit-shield"><ShieldCheck size={18} /></span><div><b>Every change, in context.</b><p>Use this timeline to trace important updates and understand what changed, when, and by whom.</p></div><span className="audit-secure">Workspace record</span></div>
    <section className="panel audit-panel"><div className="audit-heading"><div><h2>Change history</h2><p>{rows.length} {rows.length === 1 ? 'event' : 'events'} {search ? 'matching your search' : 'recorded'}</p></div><span className="audit-period">LATEST FIRST <ChevronDown size={13} /></span></div>
      {query.isLoading ? <TableSkeleton /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !rows.length ? <EmptyState title={search ? 'Nothing matched that search' : 'No changes recorded yet'} detail={search ? 'Try another name or action.' : 'Updates made by your team will appear here as a helpful timeline.'} /> : <div className="audit-timeline">{rows.map((row) => <article className="audit-entry" key={row.id} data-testid={`audit-entry-${row.id}`}><div className={`audit-glyph glyph-${slug(row.action)}`}><FileClock size={15} /></div><div className="audit-entry-main"><div className="audit-entry-line"><b>{row.action}</b><span className="audit-entity">{row.entity}</span></div><p>{row.description}</p><div className="audit-entry-meta"><span className="audit-user-avatar">{initials(row.userName)}</span><span>{row.userName}</span><span className="soft-separator">·</span><span>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(row.createdAt))}</span></div></div><span className="audit-event-id">#{row.id.toString().padStart(4, '0')}</span></article>)}</div>}
    </section>
  </Shell>;
}

function UsersPage() {
  const currentUser = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const query = useGetUsers({ query: { queryKey: getGetUsersQueryKey(), enabled: currentUser.data?.role === 'Admin' } }); const client = useQueryClient(); const create = useCreateUserProfile(); const update = useUpdateUserProfile(); const [record, setRecord] = useState<User | null | false>(false); const [search, setSearch] = useState('');
  const rows = (query.data || []).filter((row) => `${row.name} ${row.email} ${row.role}`.toLowerCase().includes(search.toLowerCase()));
  const fields: Field[] = [{ key: 'name', label: 'Full name', required: true }, { key: 'email', label: 'Email address', type: 'email', required: true }, { key: 'role', label: 'Role', type: 'select', options: ['Admin', 'Manager', 'SalesExecutive'] }, { key: 'isActive', label: 'Access', type: 'select', options: [{ label: 'Active', value: 'true' }, { label: 'Inactive', value: 'false' }] }];
  const save = (data: Record<string, string>) => {
    const payload = { ...data, isActive: data.isActive !== 'false' } as unknown as UserInput;
    const done = () => { refreshCRM(client, [getGetUsersQueryKey()]); setRecord(false); };
    if (record) update.mutate({ id: record.id, data: payload }, { onSuccess: done }); else create.mutate({ data: payload }, { onSuccess: done });
  };
  return <Shell title="Team access" subtitle="Make sure the right people have the right kind of access." action={currentUser.data?.role === 'Admin' ? <Button className="primary-action" data-testid="button-invite-user" onClick={() => setRecord(null)}><Plus size={16} /> Add team member</Button> : undefined}>
    {currentUser.isLoading ? <SkeletonCards /> : currentUser.isError ? <ErrorState retry={() => currentUser.refetch()} /> : currentUser.data?.role !== 'Admin' ? <div className="panel"><EmptyState title="Administrator access required" detail="Team roles and access can only be managed by a CRM administrator." /></div> : <>
    <div className="team-banner"><span><Users size={19} /></span><div><b>Good work is shared work.</b><p>Assign a role that fits the responsibility, then keep access up to date as your team changes.</p></div><div className="team-total"><b>{rows.length}</b><small>TEAM MEMBERS</small></div></div>
    <div className="panel records-panel"><div className="list-toolbar"><div className="record-count"><b>{rows.length}</b> team members <span>·</span> Roles &amp; workspace access</div><div className="toolbar-tools"><label className="search-wrap"><Search size={15} /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search team" /></label></div></div>
      {query.isLoading ? <TableSkeleton /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !rows.length ? <EmptyState title={search ? 'No team members found' : 'Invite your first teammate'} detail={search ? 'Try searching by another name or role.' : 'Set up your team access to share customer relationships.'} action={!search ? <Button className="primary-action" onClick={() => setRecord(null)}><Plus size={15} /> Add team member</Button> : undefined} /> : <div className="table-scroll"><table className="crm-table"><thead><tr><th>Team member</th><th>Email</th><th>Role</th><th>Access status</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} data-testid={`row-user-${row.id}`}><td><div className="person-cell"><span className="table-avatar avatar-${row.id % 5}">{initials(row.name)}</span><b>{row.name}</b></div></td><td>{row.email}</td><td><span className="role-pill">{row.role === 'SalesExecutive' ? 'Sales executive' : row.role}</span></td><td><StatusPill value={row.isActive ? 'active' : 'inactive'} /></td><td><button className="filter-btn" onClick={() => setRecord(row)}>Edit access</button></td></tr>)}</tbody></table></div>}
    </div>{record !== false && <RecordDialog title={record ? 'Edit team access' : 'Add team member'} description="The role defines what this teammate can manage in AcxiomCRM." fields={fields} initial={record ? { ...record, isActive: String(record.isActive) } : { isActive: 'true', role: 'SalesExecutive' }} busy={create.isPending || update.isPending} onClose={() => setRecord(false)} onSave={save} />}
    </>}
  </Shell>;
}

function ActivityRow({ item }: { item: { id: number; type: string; description: string; targetType: string; targetId: number | null; createdAt: string; userName: string } }) {
  return <article className="activity-row" data-testid={`activity-${item.id}`}><span className={`activity-symbol symbol-${slug(item.type)}`}><Activity size={15} /></span><div className="activity-description"><p>{item.description}</p><div><b>{item.userName}</b><span className="soft-separator">·</span><span>{item.targetType}</span></div></div><span className="activity-time">{relativeDate(item.createdAt)}</span></article>;
}

function Owner({ name }: { name: string }) {
  return <span className="owner-inline"><i>{initials(name || 'U')}</i>{name || 'Unassigned'}</span>;
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill status-${slug(value)}`}><i />{titleCase(value)}</span>;
}

function RowActions({ onEdit, onDelete, extra }: { onEdit: () => void; onDelete: () => void; extra?: ReactNode }) {
  return <div className="row-actions">{extra}<button className="row-action" type="button" onClick={onEdit} aria-label="Edit record"><MoreHorizontal size={17} /></button><button className="row-action row-action-delete" type="button" onClick={onDelete} aria-label="Delete record"><X size={15} /></button></div>;
}

type Field = { key: string; label: string; type?: string; required?: boolean; options?: (string | { label: string; value: string })[] };
function RecordDialog({ title, description, fields, initial, busy, onClose, onSave }: { title: string; description: string; fields: Field[]; initial?: object; busy: boolean; onClose: () => void; onSave: (data: Record<string, string>) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => {
    const value = (initial as Record<string, unknown> | undefined)?.[field.key];
    return [field.key, value === undefined || value === null ? (field.key === 'status' ? (field.options?.[0] as string || 'active') : '') : String(value)];
  })));
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(values); };
  return <div className="dialog-shade" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="record-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-head"><span className="dialog-mark"><Plus size={17} /></span><button className="dialog-close" type="button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button><h2 id="dialog-title">{title}</h2><p>{description}</p></div><form onSubmit={submit}><div className="dialog-fields">{fields.map((field) => <label className={`field-label ${field.type === 'textarea' ? 'field-wide' : ''}`} key={field.key}>{field.label}{field.type === 'textarea' ? <textarea data-testid={`input-${field.key}`} required={field.required} value={values[field.key] || ''} onChange={(e) => setValues({ ...values, [field.key]: e.target.value })} rows={3} /> : field.type === 'select' ? <select data-testid={`select-${field.key}`} required={field.required} value={values[field.key] ?? ''} onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}>{(field.options || []).map((option) => { const item = typeof option === 'string' ? { label: titleCase(option), value: option } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select> : <Input data-testid={`input-${field.key}`} type={field.type || 'text'} min={field.type === 'number' ? '0' : undefined} required={field.required} value={values[field.key] || ''} onChange={(e) => setValues({ ...values, [field.key]: e.target.value })} />}</label>)}</div><div className="dialog-actions"><button className="cancel-btn" type="button" onClick={onClose}>Cancel</button><Button type="submit" disabled={busy} className="primary-action">{busy ? 'Saving…' : 'Save changes'} <ArrowRight size={15} /></Button></div></form></section></div>;
}

function EmptyState({ title, detail, action, link, linkLabel }: { title: string; detail: string; action?: ReactNode; link?: string; linkLabel?: string }) {
  return <div className="empty-state"><div className="empty-symbol"><span /><span /><span /></div><h3>{title}</h3><p>{detail}</p>{action || (link && linkLabel ? <Link href={link} className="subtle-link">{linkLabel} <ArrowRight size={14} /></Link> : null)}</div>;
}

function ErrorState({ retry }: { retry: () => void }) {
  return <div className="error-state"><span><Activity size={17} /></span><b>We couldn't load this view.</b><p>Your records are safe. Try again in a moment.</p><button onClick={retry}>Try again <ArrowRight size={13} /></button></div>;
}

function SkeletonCards() {
  return <div className="skeleton-grid">{[1, 2, 3, 4].map((i) => <div className="skeleton-card" key={i}><i /><i /><i /></div>)}</div>;
}

function TableSkeleton() {
  return <div className="table-skeleton">{[1, 2, 3, 4, 5].map((i) => <div className="skeleton-row" key={i}><i /><i /><i /><i /></div>)}</div>;
}

function titleCase(value: string) { return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()); }
function relativeDate(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return dateLabel(value);
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Pick up where your team left off.' } }, signUp: { start: { title: 'Make room for better follow-through', subtitle: 'Create your AcxiomCRM workspace.' } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <ClerkCacheClearer /><AuthPages />
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><ClerkRoutes /></WouterRouter></QueryClientProvider>;
}

export default App;
