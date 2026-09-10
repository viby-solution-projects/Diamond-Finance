import React, { createContext, useContext, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileBarChart,
  Gem,
  Grid2X2,
  Menu,
  Plus,
  Search,
  Settings,
  Store,
  Users,
  Wallet,
  X,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Download,
  Check,
  CalendarDays,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  UserPlus,
  Lock,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import "./styles.css";
import {
  supabase,
  authSignIn,
  authSignOut,
  authGetSession,
  authResetPasswordForEmail,
  authUpdatePassword,
  fetchProfiles,
  updateProfile,
  toggleUserStatus,
  createAuthorizedUser,
} from "./data/supabaseClient";
import {
  dealerTypeLabel,
  localRepository,
  supabaseRepository,
  loadSettings,
  money,
  formatChartAmount,
  calculateAnalytics,
  nextId,
  saveSettings,
  transactionRows,
} from "./data/repository";

const navItems = [
  { label: "Dashboard", icon: Grid2X2, path: "/" },
  { label: "Transactions", icon: CircleDollarSign, path: "/transactions" },
  { label: "Dealers", icon: Users, path: "/dealers" },
  { label: "Payments", icon: CreditCard, path: "/payments" },
  { label: "Earnings", icon: BarChart3, path: "/earnings" },
  { label: "Analytics", icon: FileBarChart, path: "/analytics" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

const DataContext = createContext(null);
function useData() {
  return useContext(DataContext);
}

function routeName() {
  const path = window.location.pathname;
  if (path === "/admin") return "Super Admin";
  if (path === "/login") return "Login";
  return path === "/"
    ? "Dashboard"
    : path
        .slice(1)
        .split("-")
        .map((x) => x[0].toUpperCase() + x.slice(1))
        .join(" ");
}
function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function App() {
  const [current, setCurrent] = useState(routeName());
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(null);
  const [data, setData] = useState({ transactions: [], dealers: [], payments: [] });
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  const supabaseRepo = supabaseRepository();

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrent(routeName());
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  useEffect(() => {
    let authSubscription = null;

    authGetSession().then((session) => {
      if (session?.user) {
        setUser(session.user);
        setProfile(session.profile);
      } else {
        setUser(null);
        setProfile(null);
      }
      setAuthLoading(false);
    });

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_OUT" || !session?.user) {
          setUser(null);
          setProfile(null);
          setData({ transactions: [], dealers: [], payments: [] });
          if (window.location.pathname !== "/login") {
            navigate("/login");
          }
        } else if (session?.user) {
          setUser(session.user);
          const restored = await authGetSession();
          if (restored?.profile) {
            setProfile(restored.profile);
          }
        }
      });
      authSubscription = subscription;
    }

    return () => {
      if (authSubscription) authSubscription.unsubscribe();
    };
  }, []);

  const loadData = async () => {
    if (!user) return;
    setDataLoading(true);
    setDataError("");
    try {
      const remoteData = await supabaseRepo.loadAll();
      if (remoteData) {
        setData(remoteData);
      }
    } catch (err) {
      console.error("Data load failed:", err);
      setDataError(err?.message || "Unable to load finance data. Please try again.");
    } finally {
      setDataLoading(false);
    }
  };

  // Only load finance data when an authenticated user session is active
  useEffect(() => {
    if (user?.id) {
      loadData();
    } else {
      setData({ transactions: [], dealers: [], payments: [] });
    }
  }, [user?.id]);

  const handleLogout = async () => {
    await authSignOut();
    setUser(null);
    setProfile(null);
    setData({ transactions: [], dealers: [], payments: [] });
    setMenu(null);
    navigate("/login");
  };

  const handleLoginSuccess = ({ user: authenticatedUser, profile: userProfile }) => {
    setUser(authenticatedUser);
    setProfile(userProfile);
    navigate("/");
  };

  const addTransaction = async (transaction) => {
    try {
      await supabaseRepo.insertTransaction(transaction);
      setData((prev) => ({
        ...prev,
        transactions: [transaction, ...prev.transactions],
      }));
    } catch (err) {
      console.error("addTransaction error:", err);
      alert(err.message || "Failed to create transaction.");
      throw err;
    }
  };

  const updateTransaction = async (id, updated) => {
    try {
      await supabaseRepo.updateTransaction(id, updated);
      setData((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === id ? { ...t, ...updated } : t
        ),
      }));
    } catch (err) {
      console.error("updateTransaction error:", err);
      alert(err.message || "Failed to update transaction.");
      throw err;
    }
  };

  const deleteTransaction = async (id) => {
    try {
      await supabaseRepo.deleteTransaction(id);
      setData((prev) => ({
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== id),
      }));
      return { success: true };
    } catch (err) {
      console.error("deleteTransaction error:", err);
      return { success: false, reason: err.message || "Failed to delete transaction." };
    }
  };

  const addPayment = async (payment) => {
    try {
      await supabaseRepo.insertPayment(payment);
      setData((prev) => ({
        ...prev,
        payments: [payment, ...prev.payments],
      }));
    } catch (err) {
      console.error("addPayment error:", err);
      alert(err.message || "Failed to record payment.");
      throw err;
    }
  };

  const addDealer = async (dealer) => {
    const id = nextId("dealer", data.dealers);
    const item = {
      id,
      name: dealer.name.trim(),
      location: dealer.location.trim(),
      type: (dealer.type || "both").toLowerCase(),
      phone: (dealer.phone || "").trim(),
      email: (dealer.email || "").trim(),
      contact: (dealer.contact || dealer.name).trim(),
      status: dealer.status || "Active",
    };
    try {
      await supabaseRepo.insertDealer(item);
      setData((prev) => ({
        ...prev,
        dealers: [...prev.dealers, item],
      }));
      return item;
    } catch (err) {
      console.error("addDealer error:", err);
      alert(err.message || "Failed to add dealer.");
      throw err;
    }
  };

  const updateDealer = async (id, updated) => {
    const cleanUpdated = {
      ...updated,
      name: updated.name !== undefined ? updated.name.trim() : undefined,
      location: updated.location !== undefined ? updated.location.trim() : undefined,
      type: updated.type !== undefined ? (updated.type || "both").toLowerCase() : undefined,
      phone: updated.phone !== undefined ? updated.phone.trim() : undefined,
      email: updated.email !== undefined ? updated.email.trim() : undefined,
      contact: updated.contact !== undefined ? updated.contact.trim() : (updated.name ? updated.name.trim() : undefined),
      status: updated.status,
    };
    try {
      await supabaseRepo.updateDealer(id, cleanUpdated);
      setData((prev) => ({
        ...prev,
        dealers: prev.dealers.map((d) =>
          d.id === id ? { ...d, ...cleanUpdated } : d
        ),
      }));
    } catch (err) {
      console.error("updateDealer error:", err);
      alert(err.message || "Failed to update dealer.");
      throw err;
    }
  };

  const deleteDealer = async (id) => {
    const isUsed =
      data.transactions.some(
        (t) => t.dealerId === id || t.sellerId === id || t.buyerId === id
      ) || data.payments.some((p) => p.dealerId === id);

    if (isUsed) {
      return {
        success: false,
        reason: "This dealer is used in an existing transaction.",
      };
    }
    try {
      await supabaseRepo.deleteDealer(id);
      setData((prev) => ({
        ...prev,
        dealers: prev.dealers.filter((d) => d.id !== id),
      }));
      return { success: true };
    } catch (err) {
      console.error("deleteDealer error:", err);
      return { success: false, reason: err.message || "Failed to delete dealer." };
    }
  };
  React.useEffect(() => {
    const escape = (event) => {
      if (event.key === "Escape") {
        setDrawer(false);
        setMenu(null);
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
    };
  }, []);
  React.useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);
  const go = (path) => {
    navigate(path);
    setDrawer(false);
    setMenu(null);
  };

  if (authLoading) {
    return (
      <div className="login-shell">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "var(--muted)", fontSize: "13px" }}>
          <div className="brand-mark" style={{ width: "40px", height: "40px", borderRadius: "10px" }}>
            <Gem size={22} />
          </div>
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!user || current === "Login") {
    if (window.location.pathname !== "/login") {
      window.history.replaceState({}, "", "/login");
    }
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (window.location.pathname === "/login") {
    window.history.replaceState({}, "", "/");
  }

  // Super Admin route guard: Only super_admin role can access /admin
  if (current === "Super Admin" && profile?.role !== "super_admin") {
    navigate("/");
    return null;
  }

  const isSuperAdmin = profile?.role === "super_admin";
  const userName = profile?.full_name || (isSuperAdmin ? "Super Admin" : (user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "User")));
  const userEmail = profile?.email || user?.email || "";
  const userInitials = isSuperAdmin
    ? "SA"
    : userName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

  return (
    <DataContext.Provider
      value={{
        data,
        user,
        profile,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addPayment,
        addDealer,
        updateDealer,
        deleteDealer,
        dataLoading,
        dataError,
        refreshData: loadData,
      }}
    >
      <div className="app-shell">
        <Sidebar
          current={current}
          onNavigate={go}
          open={drawer}
          onClose={() => setDrawer(false)}
          userName={userName}
          userEmail={userEmail}
          userInitials={userInitials}
          role={profile?.role || "staff"}
        />
        <main className="main-area">
          <header className="topbar">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setDrawer(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div
              className="mobile-brand"
              onClick={() => go("/")}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && go("/")}
            >
              <div className="brand-mark">
                <Gem size={16} />
              </div>
              <span>Diamond Finance</span>
            </div>
            <div className="crumb">
              <button
                type="button"
                className="crumb-btn"
                onClick={() => go("/")}
              >
                Workspace
              </button>
              <ChevronRight size={14} />
              {current === "Transaction Details" || current === "New Transaction" ? (
                <>
                  <button
                    type="button"
                    className="crumb-btn"
                    onClick={() => go("/transactions")}
                  >
                    Transactions
                  </button>
                  <ChevronRight size={14} />
                </>
              ) : current === "Dealer Profile" ? (
                <>
                  <button
                    type="button"
                    className="crumb-btn"
                    onClick={() => go("/dealers")}
                  >
                    Dealers
                  </button>
                  <ChevronRight size={14} />
                </>
              ) : null}
              <strong>{current}</strong>
            </div>
            <div className="top-actions">
              <button
                className="avatar"
                aria-label="Open profile"
                onClick={() => setMenu(menu === "profile" ? null : "profile")}
                style={profile?.role === "super_admin" ? { background: "#6d28d9" } : {}}
              >
                {userInitials}
              </button>
              <button
                className="profile-name"
                onClick={() => setMenu(menu === "profile" ? null : "profile")}
              >
                {userName} <ChevronDown size={14} />
              </button>
              {menu === "profile" && (
                <div className="top-menu">
                  <b>{userName}</b>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{user?.email}</span>
                  {profile?.role === "super_admin" && (
                    <button
                      className="super-admin-link"
                      onClick={() => go("/admin")}
                    >
                      <Shield size={13} />
                      <span>Super Admin</span>
                    </button>
                  )}
                  <button onClick={() => go("/settings")}>
                    Account settings
                  </button>
                  <button onClick={handleLogout}>Sign out</button>
                </div>
              )}
            </div>
          </header>
          <div
            className={
              "content page-" + current.toLowerCase().replaceAll(" ", "-")
            }
          >
            {dataError && (
              <div className="login-error-banner" style={{ marginBottom: "18px", justifyContent: "space-between" }} role="alert">
                <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                  <AlertCircle size={16} />
                  <span>{dataError}</span>
                </div>
                <button
                  type="button"
                  className="button"
                  style={{ height: "30px", fontSize: "11.5px", padding: "0 10px" }}
                  onClick={loadData}
                >
                  Retry
                </button>
              </div>
            )}
            <Page current={current} onNavigate={go} />
          </div>
        </main>
      </div>
    </DataContext.Provider>
  );
}

function Sidebar({ current, onNavigate, open, onClose, userName = "Jordan Davis", userEmail = "jordan@diamond.com", userInitials = "JD", role = "staff" }) {
  return (
    <>
      {open && <div className="scrim" onClick={onClose} />}
      <aside className={"sidebar " + (open ? "open" : "")}>
        <div
          className="brand"
          onClick={() => onNavigate("/")}
          style={{ cursor: "pointer" }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && onNavigate("/")
          }
        >
          <div className="brand-mark">
            <Gem size={20} />
          </div>
          <span>Diamond Finance</span>
          <button
            className="icon-btn close-menu"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-icon">DB</div>
          <div>
            <b>Diamond Broker</b>
            <small>Business account</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav>
          <small className="nav-label">MAIN MENU</small>
          {navItems.map((item) => {
            const Icon = item.icon;
            const related =
              (item.label === "Transactions" &&
                ["Transaction Details", "New Transaction"].includes(current)) ||
              (item.label === "Dealers" && current === "Dealer Profile") ||
              (item.label === "Analytics" && current === "Reports");
            return (
              <button
                key={item.path}
                className={
                  "nav-item " +
                  (current === item.label || related ? "active" : "")
                }
                onClick={() => onNavigate(item.path)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
          {role === "super_admin" && (
            <>
              <small className="nav-label" style={{ marginTop: "14px" }}>ADMINISTRATION</small>
              <button
                className={"nav-item " + (current === "Super Admin" ? "active" : "")}
                onClick={() => onNavigate("/admin")}
              >
                <ShieldCheck size={18} />
                <span>Super Admin</span>
              </button>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-row">
            <div className="avatar" style={role === "super_admin" ? { background: "#6d28d9" } : {}}>
              {userInitials}
            </div>
            <div>
              <b>{userName}</b>
              <small>{userEmail}</small>
            </div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>
    </>
  );
}

function Page({ current, onNavigate }) {
  const { profile } = useData();
  if (current === "Super Admin") {
    if (profile?.role !== "super_admin") {
      onNavigate("/");
      return null;
    }
    return <SuperAdminPage onNavigate={onNavigate} />;
  }
  if (current === "Dashboard") return <Dashboard onNavigate={onNavigate} />;
  if (current === "Transactions")
    return <Transactions onNavigate={onNavigate} />;
  if (current === "Transaction Details")
    return <TransactionDetails onNavigate={onNavigate} />;
  if (current === "New Transaction")
    return <NewTransaction onNavigate={onNavigate} />;
  if (current === "Dealer Profile")
    return <DealerProfile onNavigate={onNavigate} />;
  if (current === "Dealers") return <Dealers onNavigate={onNavigate} />;
  if (current === "Payments") return <Payments onNavigate={onNavigate} />;
  if (current === "Earnings") return <Earnings onNavigate={onNavigate} />;
  if (current === "Reports" || current === "Analytics")
    return <Analytics onNavigate={onNavigate} />;
  if (current === "Settings") return <SettingsPage onNavigate={onNavigate} />;
  return <Transactions onNavigate={onNavigate} />;
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
  backTo,
  backLabel,
  onNavigate,
}) {
  return (
    <div className="page-header">
      <div>
        {backTo && onNavigate && (
          <button
            type="button"
            className="back-link"
            onClick={() => onNavigate(backTo)}
            aria-label={backLabel || "Back"}
          >
            <ChevronLeft size={14} />
            <span>{backLabel || "Back to Dashboard"}</span>
          </button>
        )}
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
function Button({
  children,
  secondary,
  onClick,
  icon: Icon = Plus,
  type = "button",
  disabled = false,
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={"button " + (secondary ? "secondary" : "")}
      onClick={onClick}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
function Panel({ title, action, children, className = "" }) {
  return (
    <section className={"panel " + className}>
      <div className="panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Status({ children }) {
  return (
    <span className={"status " + children.toLowerCase()}>
      <i />
      {children}
    </span>
  );
}
function Stat({ label, value, change, positive = true, icon: Icon }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <div className="stat-icon">
          <Icon size={17} />
        </div>
      </div>
      <strong>{value}</strong>
      <small className={positive ? "up" : "down"}>
        {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
        {change} <em>vs last month</em>
      </small>
    </div>
  );
}
function DynamicBarChart({ chartData, yTicks = [] }) {
  if (!chartData || !chartData.length) return null;

  return (
    <div className="chart">
      <div className="chart-y">
        {yTicks.map((value, idx) => (
          <span key={idx}>{formatChartAmount(value)}</span>
        ))}
      </div>
      <div className="chart-area bar-chart">
        <div className="grid-lines">
          {yTicks.slice(0, 5).map((_, i) => (
            <i key={i} />
          ))}
        </div>
        <div className="bars" aria-label="Revenue bar chart">
          {chartData.map((item, index) => (
            <span
              className={index === chartData.length - 1 ? "current" : ""}
              style={{ height: `${item.heightPercent}%` }}
              title={`${item.label}\nRevenue: ${money(item.value)}\nTransactions: ${item.transactions || 0}`}
              aria-label={`${item.label} Revenue ${money(item.value)}`}
              key={item.label}
            />
          ))}
        </div>
        <div className="chart-x">
          {chartData.map((item) => (
            <span key={item.label}>{item.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniChart({ transactions, payments, period = "Monthly" }) {
  const { data } = useData();
  const trx = transactions && transactions.length ? transactions : (data?.transactions || []);
  const pay = payments && payments.length ? payments : (data?.payments || []);
  const analytics = calculateAnalytics(trx, pay, period);

  return <DynamicBarChart chartData={analytics.chartData} yTicks={analytics.yTicks} />;
}

function Dashboard({ onNavigate }) {
  const { data, user, profile } = useData();
  const isSuperAdmin = profile?.role === "super_admin";
  const userName = profile?.full_name || (isSuperAdmin ? "Super Admin" : (user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "User")));
  const greetingName = isSuperAdmin ? "Super Admin" : userName.split(" ")[0];
  const revenue = data.transactions.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0);
  const pending = data.transactions
    .filter((item) => item.status === "Pending")
    .reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0);
  const active = data.dealers.filter((item) => item.status === "Active").length;
  return (
    <>
      <PageHeader
        eyebrow={isSuperAdmin ? "SUPER ADMIN" : "Overview"}
        title={`Good day, ${greetingName}`}
        description="Here's what's happening with your business today."
        action={
          <Button onClick={() => onNavigate("/new-transaction")}>
            New transaction
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Total revenue"
          value={money(revenue)}
          change="12.5%"
          icon={CircleDollarSign}
        />
        <Stat
          label="Total transactions"
          value={data.transactions.length.toLocaleString()}
          change="8.2%"
          icon={CreditCard}
        />
        <Stat
          label="Active dealers"
          value={active}
          change="4.6%"
          icon={Users}
        />
        <Stat
          label="Pending payments"
          value={money(pending)}
          change="2.4%"
          positive={false}
          icon={Wallet}
        />
      </div>
      <div className="dashboard-grid revenue-grid">
        <Panel
          title="Revenue overview"
          action={
            <select
              className="select"
              aria-label="Revenue range"
              defaultValue="6"
            >
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
            </select>
          }
          className="revenue-panel"
        >
          <div className="revenue-total">
            <strong>{money(revenue)}</strong>
            <span className="up">
              <ArrowUpRight size={13} /> 12.5%
            </span>
          </div>
          <MiniChart />
        </Panel>
      </div>
      <div className="dashboard-grid bottom-grid">
        <Panel
          title="Recent transactions"
          action={
            <button
              className="link-btn"
              onClick={() => onNavigate("/transactions")}
            >
              View all <ArrowUpRight size={14} />
            </button>
          }
          className="table-panel"
        >
          <TransactionTable
            rows={transactionRows(data).slice(0, 4)}
            onRowClick={(id) => onNavigate("/transaction-details?id=" + id)}
          />
        </Panel>
        <Panel
          title="Top dealers"
          action={
            <button className="link-btn" onClick={() => onNavigate("/dealers")}>
              View all <ArrowUpRight size={14} />
            </button>
          }
        >
          <div className="dealer-list">
            {data.dealers.slice(0, 4).map((dealer) => (
              <div
                className="dealer-row"
                key={dealer.id}
                onClick={() => onNavigate("/dealer-profile?id=" + dealer.id)}
              >
                <div className="dealer-avatar">{dealer.name.slice(0, 2)}</div>
                <div>
                  <b>{dealer.name}</b>
                  <small>{dealer.location}</small>
                </div>
                <strong>
                  {money(
                    data.transactions
                      .filter((item) => item.dealerId === dealer.id)
                      .reduce((sum, item) => sum + item.amount, 0),
                  )}
                </strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function TransactionTable({ rows, onRowClick }) {
  if (!rows.length)
    return (
      <div className="empty-state">
        <Search size={20} />
        <b>No transactions found</b>
        <span>Try clearing your search or filters.</span>
      </div>
    );
  return (
    <>
      <div className="table-scroll desktop-data-table">
        <table>
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Dealer</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row[0]}
                onClick={() => onRowClick?.(row[0])}
                onKeyDown={(event) =>
                  (event.key === "Enter" || event.key === " ") &&
                  onRowClick?.(row[0])
                }
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={onRowClick ? "clickable-row" : ""}
              >
                <td>
                  <b>{row[5] || row[0]}</b>
                  <small className="table-id">{row[5] ? row[0] : ""}</small>
                </td>
                <td>{row[1]}</td>
                <td>{row[2]}</td>
                <td>
                  <b>{row[3]}</b>
                </td>
                <td>
                  <Status>{row[4]}</Status>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-data-list">
        {rows.map((row) => (
          <button
            key={row[0]}
            type="button"
            className="mobile-card-item"
            onClick={() => onRowClick?.(row[0])}
          >
            <div className="mobile-card-main">
              <div className="mobile-card-copy">
                <b>{row[5] || row[0]}</b>
                <span>{row[1]}</span>
              </div>
              <div className="mobile-card-amount">{row[3]}</div>
            </div>
            <div className="mobile-card-meta">
              <span>{row[2]}</span>
              <Status>{row[4]}</Status>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="search">
      <Search size={16} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
function Transactions({ onNavigate }) {
  const { data } = useData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const rows = transactionRows(data);
  const filtered = rows.filter(
    (row) =>
      row.join(" ").toLowerCase().includes(query.toLowerCase()) &&
      (status === "All" || row[4] === status),
  );
  const openDetails = (id) => onNavigate("/transaction-details?id=" + id);
  const exportRows = filtered.map((row) => row.slice(0, 5));
  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Manage"
        title="Transactions"
        description="Track and manage all your diamond transactions."
        action={
          <Button onClick={() => onNavigate("/new-transaction")}>
            New transaction
          </Button>
        }
      />
      <Panel
        title="All transactions"
        action={
          <div className="panel-actions">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search transactions..."
            />
            <select
              className="filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter transaction status"
            >
              <option>All</option>
              <option>Completed</option>
              <option>Pending</option>
              <option>Processing</option>
            </select>
            <button
              className="icon-btn bordered"
              aria-label="Export transactions"
              onClick={() =>
                downloadCsv(
                  "transactions.csv",
                  ["Transaction", "Dealer", "Date", "Amount", "Status"],
                  exportRows,
                )
              }
            >
              <Download size={16} />
            </button>
          </div>
        }
      >
        <TransactionTable rows={filtered} onRowClick={openDetails} />
        <div className="pagination">
          <span>
            Showing {filtered.length ? 1 : 0} to {filtered.length} of{" "}
            {data.transactions.length} results
          </span>
          <div>
            <button
              className="icon-btn bordered"
              aria-label="Previous page"
              disabled
            >
              <ChevronLeft size={16} />
            </button>
            <button className="page-current">1</button>
            <button
              className="icon-btn bordered"
              aria-label="Next page"
              disabled
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </Panel>
    </>
  );
}
function TransactionDetails({ onNavigate }) {
  const { data, updateTransaction } = useData();
  const [editModal, setEditModal] = useState(false);
  const id =
    new URLSearchParams(window.location.search).get("id") ||
    data.transactions[0]?.id;
  const transaction =
    data.transactions.find((item) => item.id === id) || data.transactions[0];
  const dealer = data.dealers.find((item) => item.id === (transaction?.sellerId || transaction?.dealerId));
  const buyer = data.dealers.find((item) => item.id === transaction?.buyerId);

  if (!transaction)
    return (
      <Panel title="Transaction not found">
        <Button onClick={() => onNavigate("/transactions")}>
          Back to transactions
        </Button>
      </Panel>
    );

  const handleSaveTransaction = async (updatedData) => {
    await updateTransaction(transaction.id, updatedData);
  };

  return (
    <>
      <PageHeader
        backTo="/transactions"
        backLabel="Back"
        onNavigate={onNavigate}
        eyebrow="Transactions"
        title={transaction.name}
        description="Transaction details and payment timeline."
        action={
          <div className="header-actions">
            <Button
              secondary
              onClick={() => setEditModal(true)}
              icon={Pencil}
            >
              Edit transaction
            </Button>
            <Button
              secondary
              onClick={() =>
                downloadCsv(
                  `${transaction.id}.csv`,
                  ["ID", "Name", "Date", "Amount", "Status"],
                  [
                    [
                      transaction.id,
                      transaction.name,
                      transaction.date,
                      money(transaction.amount),
                      transaction.status,
                    ],
                  ],
                )
              }
              icon={Download}
            >
              Export
            </Button>
          </div>
        }
      />
      <div className="detail-layout">
        <Panel title="Financial summary" className="detail-summary">
          <div className="detail-amount">
            <span>Total amount</span>
            <strong>{money(transaction.totalRate || transaction.amount)}</strong>
            <Status>{transaction.status}</Status>
          </div>
          <div className="detail-grid">
            <Detail label="Transaction ID" value={transaction.id} />
            <Detail label="Transaction date" value={transaction.date} />
            {transaction.diamondCarat ? (
              <Detail label="Diamond Carat" value={`${transaction.diamondCarat} ct`} />
            ) : null}
            {transaction.perCaratRate ? (
              <Detail label="Per Carat Rate" value={money(transaction.perCaratRate)} />
            ) : null}
            {transaction.totalRate ? (
              <Detail label="Total Rate" value={money(transaction.totalRate)} />
            ) : null}
            {transaction.terms != null && transaction.terms !== "" ? (
              <Detail
                label={`Terms (${transaction.terms}%)`}
                value={transaction.termsAmount ? `-${money(transaction.termsAmount)}` : `${transaction.terms}%`}
              />
            ) : null}
            {transaction.amountAfterTerms ? (
              <Detail label="Amount After Terms" value={money(transaction.amountAfterTerms)} />
            ) : null}
            {transaction.cvd ? (
              <Detail label="CVD" value={`+${money(transaction.cvd)}`} />
            ) : null}
            {transaction.finalNet ? (
              <Detail label="Final Net" value={money(transaction.finalNet)} />
            ) : null}
            {transaction.dueDays != null && transaction.dueDays !== "" ? (
              <Detail label="Due Days" value={`${transaction.dueDays} days`} />
            ) : null}
            {transaction.sellType ? (
              <Detail
                label="Sell Type"
                value={
                  transaction.sellType === "Other" && transaction.otherSellType
                    ? `Other (${transaction.otherSellType})`
                    : transaction.sellType
                }
              />
            ) : null}
            <Detail label="Payment method" value={transaction.paymentMethod || "Bank transfer"} />
            <Detail label="Seller" value={dealer?.name || "Not selected"} />
            <Detail label="Buyer" value={buyer?.name || "Not selected"} />
            <Detail
              label="Brokerage rate"
              value={`${transaction.brokerageRate ?? 5}%`}
            />
            <Detail
              label="Brokerage earned"
              value={money(
                transaction.brokerageEarned ??
                  (((transaction.totalRate || transaction.amount || 0) * (transaction.brokerageRate || 0)) / 100)
              )}
            />
          </div>
        </Panel>
        <Panel title="Transaction flow">
          <div className="profile-card">
            <div className="dealer-avatar large">
              {dealer?.name.slice(0, 2)}
            </div>
            <div>
              <b>{dealer?.name}</b>
              <small>{dealer?.location}</small>
              <button
                className="link-btn"
                onClick={() => onNavigate("/dealer-profile?id=" + dealer?.id)}
              >
                View dealer profile <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
          <div className="detail-grid single">
            <Detail
              label="Description"
              value={transaction.notes || "No description added"}
            />
          </div>
        </Panel>
        <Panel title="Payment timeline" className="items-panel">
          <div className="item-row">
            <div className="gem-icon">
              <Check size={18} />
            </div>
            <div>
              <b>{transaction.status}</b>
              <small>
                {transaction.date} - {transaction.paymentMethod}
              </small>
            </div>
            <strong>{money(transaction.totalRate || transaction.amount)}</strong>
          </div>
        </Panel>
      </div>

      <EditTransactionModal
        open={editModal}
        onClose={() => setEditModal(false)}
        transaction={transaction}
        onSave={handleSaveTransaction}
      />
    </>
  );
}

function EditTransactionModal({ open, onClose, transaction, onSave }) {
  const { data } = useData();
  const sellerDealers = data.dealers.filter(
    (d) => !d.type || d.type === "seller" || d.type === "both"
  );
  const buyerDealers = data.dealers.filter(
    (d) => !d.type || d.type === "buyer" || d.type === "both"
  );
  const [form, setForm] = useState({
    name: "",
    date: "",
    diamondCarat: "",
    perCaratRate: "",
    terms: "2",
    cvd: "0",
    dueDays: "30",
    sellType: "Self",
    otherSellType: "",
    sellerId: "",
    buyerId: "",
    brokerageRate: "5",
    paymentMethod: "Bank transfer",
    status: "Pending",
    notes: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (transaction && open) {
      setForm({
        name: transaction.name || "",
        date: transaction.date || new Date().toISOString().split("T")[0],
        diamondCarat: String(transaction.diamondCarat ?? ""),
        perCaratRate: transaction.perCaratRate ? formatIndianNumber(transaction.perCaratRate) : "",
        terms: String(transaction.terms ?? 2),
        cvd: transaction.cvd != null && transaction.cvd !== "" ? formatIndianNumber(transaction.cvd) : "0",
        dueDays: String(transaction.dueDays ?? 30),
        sellType: transaction.sellType || "Self",
        otherSellType: transaction.otherSellType || "",
        sellerId: transaction.sellerId || transaction.dealerId || "",
        buyerId: transaction.buyerId || "",
        brokerageRate: String(transaction.brokerageRate ?? 5),
        paymentMethod: transaction.paymentMethod || "Bank transfer",
        status: transaction.status || "Pending",
        notes: transaction.notes || "",
      });
      setError("");
    }
  }, [transaction, open]);

  if (!open || !transaction) return null;

  const caratValue = parseFloat(form.diamondCarat) || 0;
  const perCaratRateValue = parseFloat(String(form.perCaratRate).replace(/,/g, "")) || 0;
  const totalRateValue =
    caratValue > 0 && perCaratRateValue > 0
      ? Math.round(caratValue * perCaratRateValue * 100) / 100
      : 0;

  const termsPercentValue = parseFloat(form.terms) || 0;
  const termsAmountValue =
    totalRateValue > 0 && termsPercentValue > 0
      ? Math.round(((totalRateValue * termsPercentValue) / 100) * 100) / 100
      : 0;

  const amountAfterTermsValue = Math.round((totalRateValue - termsAmountValue) * 100) / 100;
  const cvdValue = parseFloat(String(form.cvd || "0").replace(/,/g, "")) || 0;
  const finalNetValue = Math.round((amountAfterTermsValue + cvdValue) * 100) / 100;

  const brokerageRateValue = Number(form.brokerageRate) || 0;
  const brokerageEarned = (totalRateValue * (Number.isFinite(brokerageRateValue) ? brokerageRateValue : 5)) / 100;

  const set = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));

  const submit = async (event) => {
    event.preventDefault();
    const carat = Number(form.diamondCarat);
    const rate = Number(String(form.perCaratRate).replace(/,/g, ""));
    const terms = Number(form.terms);
    const cvd = form.cvd ? Number(String(form.cvd).replace(/,/g, "")) : 0;
    const dueDays = Number(form.dueDays);
    const brokerageRate = Number(form.brokerageRate);

    if (!form.name.trim()) return setError("Please enter a transaction name.");
    if (!form.date) return setError("Please select a transaction date.");
    if (!form.diamondCarat || !Number.isFinite(carat) || carat <= 0) {
      return setError("Diamond carat must be a valid number greater than 0.");
    }
    if (!form.perCaratRate || !Number.isFinite(rate) || rate <= 0) {
      return setError("Per carat rate must be a valid amount greater than 0.");
    }
    if (form.terms === "" || !Number.isFinite(terms) || terms < 0) {
      return setError("Terms (%) must be 0 or greater.");
    }
    if (!Number.isFinite(cvd) || cvd < 0) {
      return setError("CVD must be 0 or greater.");
    }
    if (form.dueDays === "" || !Number.isFinite(dueDays) || dueDays < 0) {
      return setError("Due days must be 0 or greater.");
    }
    if (form.sellType === "Other" && !form.otherSellType.trim()) {
      return setError("Please specify the other sell type.");
    }
    if (!form.sellerId) return setError("Please select a seller dealer.");
    if (!form.buyerId) return setError("Please select a buyer dealer.");
    if (form.sellerId === form.buyerId) {
      return setError("Seller and buyer must be different dealers.");
    }

    const totalRate = Math.round(carat * rate * 100) / 100;
    const termsAmount = Math.round(((totalRate * terms) / 100) * 100) / 100;
    const amountAfterTerms = Math.round((totalRate - termsAmount) * 100) / 100;
    const finalNet = Math.round((amountAfterTerms + cvd) * 100) / 100;
    const earned = Math.round(((totalRate * (Number.isFinite(brokerageRate) ? brokerageRate : 5)) / 100) * 100) / 100;

    try {
      await onSave({
        name: form.name.trim(),
        date: form.date,
        diamondCarat: carat,
        perCaratRate: rate,
        totalRate,
        amount: totalRate,
        terms,
        termsAmount,
        amountAfterTerms,
        cvd,
        finalNet,
        dueDays,
        sellType: form.sellType,
        otherSellType: form.sellType === "Other" ? form.otherSellType.trim() : "",
        sellerId: form.sellerId,
        dealerId: form.sellerId,
        buyerId: form.buyerId,
        brokerageRate: Number.isFinite(brokerageRate) ? brokerageRate : 5,
        brokerageEarned: earned,
        paymentMethod: form.paymentMethod || "Bank transfer",
        notes: form.notes.trim(),
        status: form.status || "Pending",
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to update transaction.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: "660px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Edit transaction — {transaction.id}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="form-grid" style={{ padding: 0 }}>
              <label className="field-group">
                <span className="field-title">Transaction Name</span>
                <input
                  name="name"
                  value={form.name}
                  onChange={set}
                  placeholder="e.g. Mumbai Lot #102"
                  required
                />
              </label>
              <label className="field-group">
                <span className="field-title">Transaction Date</span>
                <input
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={set}
                  required
                />
              </label>
              <label className="field-group">
                <span className="field-title">Diamond Carat</span>
                <input
                  name="diamondCarat"
                  type="text"
                  inputMode="decimal"
                  value={form.diamondCarat}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/[^0-9.]/g, "");
                    const parts = raw.split(".");
                    let clean = parts[0];
                    if (parts.length > 1) {
                      clean = parts[0] + "." + parts.slice(1).join("").slice(0, 2);
                    }
                    setForm((p) => ({ ...p, diamondCarat: clean }));
                  }}
                  placeholder="e.g. 10.50"
                  required
                />
              </label>
              <label className="field-group">
                <span className="field-title">Per Carat Rate</span>
                <div className="input-with-symbol">
                  <span className="input-symbol">₹</span>
                  <input
                    name="perCaratRate"
                    type="text"
                    inputMode="numeric"
                    value={form.perCaratRate}
                    onChange={(event) => {
                      const raw = event.target.value
                        .replace(/[^0-9.]/g, "")
                        .replace(/(\..*)\./g, "$1");
                      setForm((p) => ({
                        ...p,
                        perCaratRate: raw ? formatIndianNumber(raw) : "",
                      }));
                    }}
                    placeholder="e.g. 50,000"
                    required
                  />
                </div>
              </label>
              <div className="field-group calculated-cell">
                <div className="calculated-field-card">
                  <div className="calc-header">
                    <span className="field-title">Total Rate</span>
                    <span className="calc-badge">Auto Calculated</span>
                  </div>
                  <div className="calc-value">{money(totalRateValue)}</div>
                  <span className="calc-formula">Carat × Per Carat Rate</span>
                </div>
              </div>
              <label className="field-group">
                <span className="field-title">Terms (%)</span>
                <input
                  name="terms"
                  type="text"
                  inputMode="decimal"
                  value={form.terms}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      terms: e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"),
                    }))
                  }
                  placeholder="e.g. 2"
                  required
                />
              </label>
              <label className="field-group">
                <span className="field-title">Due Days</span>
                <input
                  name="dueDays"
                  type="text"
                  inputMode="numeric"
                  value={form.dueDays}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, dueDays: e.target.value.replace(/[^0-9]/g, "") }))
                  }
                  placeholder="e.g. 30"
                  required
                />
              </label>
              <div className="field-group">
                <span className="field-title">Sell Type</span>
                <div className="segmented-control" role="radiogroup" aria-label="Sell Type">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.sellType === "Self"}
                    className={`segmented-btn ${form.sellType === "Self" ? "active" : ""}`}
                    onClick={() => setForm((prev) => ({ ...prev, sellType: "Self" }))}
                  >
                    Self
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.sellType === "Other"}
                    className={`segmented-btn ${form.sellType === "Other" ? "active" : ""}`}
                    onClick={() => setForm((prev) => ({ ...prev, sellType: "Other" }))}
                  >
                    Other
                  </button>
                </div>
                {form.sellType === "Other" && (
                  <div className="other-sell-field">
                    <label className="field-group subfield-margin">
                      <span className="field-title">Other Sell Type</span>
                      <input
                        name="otherSellType"
                        type="text"
                        value={form.otherSellType}
                        onChange={set}
                        placeholder="Enter sell type (e.g. Wholesale)"
                        required
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Dedicated Amount Summary Section in Modal */}
            <div className="amount-summary-card" style={{ border: "1px solid var(--line)", borderRadius: "8px", marginTop: "4px" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink)", paddingBottom: "4px", borderBottom: "1px solid var(--line)" }}>
                Amount Summary
              </div>
              <div className="summary-row">
                <div className="summary-label">
                  <span>Total Rate</span>
                  <small className="summary-hint">Carat × Per Carat Rate</small>
                </div>
                <div className="summary-value">{money(totalRateValue)}</div>
              </div>
              <div className="summary-row">
                <div className="summary-label">
                  <span>Terms ({termsPercentValue}%)</span>
                  <small className="summary-hint">Deduction</small>
                </div>
                <div className="summary-value deduction">
                  {termsAmountValue > 0 ? `-${money(termsAmountValue)}` : money(0)}
                </div>
              </div>
              <div className="summary-row">
                <div className="summary-label">
                  <span>Amount After Terms</span>
                  <small className="summary-hint">Total Rate − Terms</small>
                </div>
                <div className="summary-value">{money(amountAfterTermsValue)}</div>
              </div>
              <div className="summary-row cvd-row">
                <div className="summary-label">
                  <span className="cvd-label-text">CVD</span>
                  <small className="summary-hint">Additional value</small>
                </div>
                <div className="cvd-input-wrap">
                  <div className="input-with-symbol">
                    <span className="input-symbol">₹</span>
                    <input
                      name="cvd"
                      type="text"
                      inputMode="decimal"
                      value={form.cvd}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                        setForm((p) => ({
                          ...p,
                          cvd: raw ? formatIndianNumber(raw) : "",
                        }));
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <div className="summary-divider" />
              <div className="summary-row final-net-row">
                <div className="summary-label">
                  <span className="final-net-title">Final Net</span>
                  <small className="summary-hint">Amount After Terms + CVD</small>
                </div>
                <div className="final-net-value">{money(finalNetValue)}</div>
              </div>
            </div>

            <div className="form-grid" style={{ padding: 0, marginTop: "8px" }}>
              <label className="field-group">
                <span className="field-title">Seller</span>
                <select name="sellerId" value={form.sellerId} onChange={set} required>
                  <option value="">Select dealer</option>
                  {sellerDealers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span className="field-title">Buyer</span>
                <select name="buyerId" value={form.buyerId} onChange={set} required>
                  <option value="">Select dealer</option>
                  {buyerDealers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span className="field-title">Brokerage (%)</span>
                <input
                  name="brokerageRate"
                  type="text"
                  inputMode="decimal"
                  value={form.brokerageRate}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      brokerageRate: e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"),
                    }))
                  }
                  placeholder="1.00"
                  required
                />
              </label>
              <div className="earned-field">
                <span>Brokerage earned</span>
                <strong>{money(brokerageEarned)}</strong>
              </div>
              <label className="field-group">
                <span className="field-title">Status</span>
                <select name="status" value={form.status} onChange={set} required>
                  <option>Pending</option>
                  <option>Processing</option>
                  <option>Completed</option>
                </select>
              </label>
              <label className="field-group">
                <span className="field-title">Payment method</span>
                <select name="paymentMethod" value={form.paymentMethod} onChange={set}>
                  <option>Bank transfer</option>
                  <option>Credit card</option>
                  <option>Cash</option>
                </select>
              </label>
              <label className="field-group full">
                <span className="field-title">Description</span>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={set}
                  placeholder="Enter a description..."
                />
              </label>
            </div>
          </div>
          <div className="modal-actions">
            <Button secondary type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function formatIndianNumber(value) {
  if (value === "" || value == null) return "";
  const clean = String(value).replace(/[^0-9.]/g, "");
  const parts = clean.split(".");
  const intPart = parts[0];
  const decPart = parts.length > 1 ? "." + parts.slice(1).join("") : "";
  if (!intPart) return decPart ? "0" + decPart : "";
  const formattedInt = Number(intPart).toLocaleString("en-IN");
  return formattedInt + decPart;
}

function NewTransaction({ onNavigate }) {
  const { data, addTransaction } = useData();
  const sellerDealers = data.dealers.filter(
    (d) => !d.type || d.type === "seller" || d.type === "both"
  );
  const buyerDealers = data.dealers.filter(
    (d) => !d.type || d.type === "buyer" || d.type === "both"
  );
  const [form, setForm] = useState({
    name: "",
    date: new Date().toISOString().split("T")[0],
    diamondCarat: "",
    perCaratRate: "",
    terms: "2",
    cvd: "0",
    dueDays: "30",
    sellType: "Self",
    otherSellType: "",
    sellerId: "",
    buyerId: "",
    brokerageRate: "5",
    paymentMethod: "Bank transfer",
    status: "Pending",
    notes: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const caratValue = parseFloat(form.diamondCarat) || 0;
  const perCaratRateValue = parseFloat(String(form.perCaratRate).replace(/,/g, "")) || 0;
  const totalRateValue =
    caratValue > 0 && perCaratRateValue > 0
      ? Math.round(caratValue * perCaratRateValue * 100) / 100
      : 0;

  const termsPercentValue = parseFloat(form.terms) || 0;
  const termsAmountValue =
    totalRateValue > 0 && termsPercentValue > 0
      ? Math.round(((totalRateValue * termsPercentValue) / 100) * 100) / 100
      : 0;

  const amountAfterTermsValue = Math.round((totalRateValue - termsAmountValue) * 100) / 100;
  const cvdValue = parseFloat(String(form.cvd || "0").replace(/,/g, "")) || 0;
  const finalNetValue = Math.round((amountAfterTermsValue + cvdValue) * 100) / 100;

  const brokerageRateValue = Number(form.brokerageRate) || 0;
  const brokerageEarned = (totalRateValue * (Number.isFinite(brokerageRateValue) ? brokerageRateValue : 5)) / 100;

  const set = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError("");

    const carat = Number(form.diamondCarat);
    const rate = Number(String(form.perCaratRate).replace(/,/g, ""));
    const terms = Number(form.terms);
    const cvd = form.cvd ? Number(String(form.cvd).replace(/,/g, "")) : 0;
    const dueDays = Number(form.dueDays);
    const brokerageRate = Number(form.brokerageRate);

    if (!form.name.trim()) return setError("Please enter a transaction name.");
    if (!form.date) return setError("Please select a transaction date.");
    if (!form.diamondCarat || !Number.isFinite(carat) || carat <= 0) {
      return setError("Diamond carat must be a valid number greater than 0.");
    }
    if (!form.perCaratRate || !Number.isFinite(rate) || rate <= 0) {
      return setError("Per carat rate must be a valid amount greater than 0.");
    }
    if (form.terms === "" || !Number.isFinite(terms) || terms < 0) {
      return setError("Terms (%) must be 0 or greater.");
    }
    if (!Number.isFinite(cvd) || cvd < 0) {
      return setError("CVD must be 0 or greater.");
    }
    if (form.dueDays === "" || !Number.isFinite(dueDays) || dueDays < 0) {
      return setError("Due days must be 0 or greater.");
    }
    if (form.sellType === "Other" && !form.otherSellType.trim()) {
      return setError("Please specify the other sell type.");
    }
    if (!form.sellerId) return setError("Please select a seller dealer.");
    if (!form.buyerId) return setError("Please select a buyer dealer.");
    if (form.sellerId === form.buyerId) {
      return setError("Seller and buyer must be different dealers.");
    }

    const totalRate = Math.round(carat * rate * 100) / 100;
    const termsAmount = Math.round(((totalRate * terms) / 100) * 100) / 100;
    const amountAfterTerms = Math.round((totalRate - termsAmount) * 100) / 100;
    const finalNet = Math.round((amountAfterTerms + cvd) * 100) / 100;
    const earned = Math.round(((totalRate * (Number.isFinite(brokerageRate) ? brokerageRate : 5)) / 100) * 100) / 100;

    const transaction = {
      id: nextId("TRX", data.transactions),
      name: form.name.trim(),
      date: form.date,
      diamondCarat: carat,
      perCaratRate: rate,
      totalRate,
      amount: totalRate,
      terms,
      termsAmount,
      amountAfterTerms,
      cvd,
      finalNet,
      dueDays,
      sellType: form.sellType,
      otherSellType: form.sellType === "Other" ? form.otherSellType.trim() : "",
      sellerId: form.sellerId,
      dealerId: form.sellerId,
      buyerId: form.buyerId,
      brokerageRate: Number.isFinite(brokerageRate) ? brokerageRate : 5,
      brokerageEarned: earned,
      paymentMethod: form.paymentMethod || "Bank transfer",
      notes: form.notes.trim(),
      status: form.status || "Pending",
    };

    setSubmitting(true);
    try {
      await addTransaction(transaction);
      onNavigate("/transaction-details?id=" + transaction.id);
    } catch (err) {
      setError(err?.message || "Failed to create transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        backTo="/transactions"
        backLabel="Back"
        onNavigate={onNavigate}
        eyebrow="Transactions"
        title="New transaction"
        description="Add a new diamond transaction to your records."
      />
      <form className="grouped-form" onSubmit={submit}>
        <Panel title="Deal details" className="form-panel">
          <div className="form-grid">
            <label className="field-group">
              <span className="field-title">Transaction Name</span>
              <input
                name="name"
                value={form.name}
                onChange={set}
                placeholder="e.g. Mumbai Lot #102"
                required
              />
            </label>

            <label className="field-group">
              <span className="field-title">Transaction Date</span>
              <input
                name="date"
                type="date"
                value={form.date}
                onChange={set}
                required
              />
            </label>

            <label className="field-group">
              <span className="field-title">Diamond Carat</span>
              <input
                name="diamondCarat"
                type="text"
                inputMode="decimal"
                value={form.diamondCarat}
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^0-9.]/g, "");
                  const parts = raw.split(".");
                  let clean = parts[0];
                  if (parts.length > 1) {
                    clean = parts[0] + "." + parts.slice(1).join("").slice(0, 2);
                  }
                  setForm((previous) => ({
                    ...previous,
                    diamondCarat: clean,
                  }));
                }}
                placeholder="e.g. 10.50"
                required
              />
            </label>

            <label className="field-group">
              <span className="field-title">Per Carat Rate</span>
              <div className="input-with-symbol">
                <span className="input-symbol">₹</span>
                <input
                  name="perCaratRate"
                  type="text"
                  inputMode="numeric"
                  value={form.perCaratRate}
                  onChange={(event) => {
                    const raw = event.target.value
                      .replace(/[^0-9.]/g, "")
                      .replace(/(\..*)\./g, "$1");
                    setForm((previous) => ({
                      ...previous,
                      perCaratRate: raw ? formatIndianNumber(raw) : "",
                    }));
                  }}
                  placeholder="e.g. 50,000"
                  required
                />
              </div>
            </label>

            <div className="field-group calculated-cell">
              <div className="calculated-field-card">
                <div className="calc-header">
                  <span className="field-title">Total Rate</span>
                  <span className="calc-badge">Auto Calculated</span>
                </div>
                <div className="calc-value">{money(totalRateValue)}</div>
                <span className="calc-formula">Carat × Per Carat Rate</span>
              </div>
            </div>

            <label className="field-group">
              <span className="field-title">Terms (%)</span>
              <input
                name="terms"
                type="text"
                inputMode="decimal"
                value={form.terms}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    terms: event.target.value
                      .replace(/[^0-9.]/g, "")
                      .replace(/(\..*)\./g, "$1"),
                  }))
                }
                placeholder="e.g. 2"
                required
              />
            </label>

            <label className="field-group">
              <span className="field-title">Due Days</span>
              <input
                name="dueDays"
                type="text"
                inputMode="numeric"
                value={form.dueDays}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    dueDays: event.target.value.replace(/[^0-9]/g, ""),
                  }))
                }
                placeholder="e.g. 30"
                required
              />
            </label>

            <div className="field-group">
              <span className="field-title">Sell Type</span>
              <div className="segmented-control" role="radiogroup" aria-label="Sell Type">
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.sellType === "Self"}
                  className={`segmented-btn ${form.sellType === "Self" ? "active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, sellType: "Self" }))}
                >
                  Self
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.sellType === "Other"}
                  className={`segmented-btn ${form.sellType === "Other" ? "active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, sellType: "Other" }))}
                >
                  Other
                </button>
              </div>
              {form.sellType === "Other" && (
                <div className="other-sell-field">
                  <label className="field-group subfield-margin">
                    <span className="field-title">Other Sell Type</span>
                    <input
                      name="otherSellType"
                      type="text"
                      value={form.otherSellType}
                      onChange={set}
                      placeholder="Enter sell type (e.g. Wholesale)"
                      required
                    />
                  </label>
                </div>
              )}
            </div>

            <label className="field-group full">
              <span className="field-title">Description</span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={set}
                placeholder="Enter a description..."
              />
            </label>
          </div>
        </Panel>

        {/* Dedicated Amount Summary Section */}
        <Panel title="Amount Summary" className="form-panel amount-summary-panel">
          <div className="amount-summary-card">
            <div className="summary-row">
              <div className="summary-label">
                <span>Total Rate</span>
                <small className="summary-hint">Carat × Per Carat Rate</small>
              </div>
              <div className="summary-value">{money(totalRateValue)}</div>
            </div>

            <div className="summary-row">
              <div className="summary-label">
                <span>Terms ({termsPercentValue}%)</span>
                <small className="summary-hint">Deduction</small>
              </div>
              <div className="summary-value deduction">
                {termsAmountValue > 0 ? `-${money(termsAmountValue)}` : money(0)}
              </div>
            </div>

            <div className="summary-row">
              <div className="summary-label">
                <span>Amount After Terms</span>
                <small className="summary-hint">Total Rate − Terms</small>
              </div>
              <div className="summary-value">{money(amountAfterTermsValue)}</div>
            </div>

            <div className="summary-row cvd-row">
              <div className="summary-label">
                <label htmlFor="new-cvd-input" className="cvd-label-text">CVD</label>
                <small className="summary-hint">Additional value</small>
              </div>
              <div className="cvd-input-wrap">
                <div className="input-with-symbol">
                  <span className="input-symbol">₹</span>
                  <input
                    id="new-cvd-input"
                    name="cvd"
                    type="text"
                    inputMode="decimal"
                    value={form.cvd}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                      setForm((p) => ({
                        ...p,
                        cvd: raw ? formatIndianNumber(raw) : "",
                      }));
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="summary-divider" />

            <div className="summary-row final-net-row">
              <div className="summary-label">
                <span className="final-net-title">Final Net</span>
                <small className="summary-hint">Amount After Terms + CVD</small>
              </div>
              <div className="final-net-value">{money(finalNetValue)}</div>
            </div>
          </div>
        </Panel>

        <Panel title="Parties involved" className="form-panel">
          <div className="party-flow">
            <label className="field-group">
              <span className="field-title">Seller</span>
              <select name="sellerId" value={form.sellerId} onChange={set} required>
                <option value="">Select existing dealer</option>
                {sellerDealers.map((dealer) => (
                  <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
                ))}
              </select>
            </label>
            <div className="party-connector" aria-hidden="true"><span>→</span><b>BROKERAGE</b><span>→</span></div>
            <label className="field-group">
              <span className="field-title">Buyer</span>
              <select name="buyerId" value={form.buyerId} onChange={set} required>
                <option value="">Select existing dealer</option>
                {buyerDealers.map((dealer) => (
                  <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
                ))}
              </select>
            </label>
          </div>
        </Panel>

        <Panel title="Brokerage" className="form-panel">
          <div className="form-grid">
            <label className="field-group">
              <span className="field-title">Brokerage (%)</span>
              <input
                name="brokerageRate"
                type="text"
                inputMode="decimal"
                value={form.brokerageRate}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    brokerageRate: event.target.value
                      .replace(/[^0-9.]/g, "")
                      .replace(/(\..*)\./g, "$1"),
                  }))
                }
                placeholder="1.00"
                required
              />
            </label>
            <div className="earned-field">
              <span>Brokerage earned</span>
              <strong>{money(brokerageEarned)}</strong>
            </div>
            <label className="field-group full">
              <span className="field-title">Payment method</span>
              <select name="paymentMethod" value={form.paymentMethod} onChange={set}>
                <option>Bank transfer</option>
                <option>Credit card</option>
                <option>Cash</option>
              </select>
            </label>
          </div>
        </Panel>

        <Panel title="Transaction status" className="form-panel">
          <div className="form-grid">
            <label className="field-group">
              <span className="field-title">Status</span>
              <select name="status" value={form.status} onChange={set} required>
                <option>Pending</option>
                <option>Processing</option>
                <option>Completed</option>
              </select>
            </label>
          </div>
        </Panel>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <div className="form-actions">
          <Button secondary type="button" onClick={() => onNavigate("/transactions")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create transaction"}
          </Button>
        </div>
      </form>
    </>
  );
}
function DealerProfile({ onNavigate }) {
  const { data, updateDealer } = useData();
  const [editModal, setEditModal] = useState(false);
  const id =
    new URLSearchParams(window.location.search).get("id") || data.dealers[0]?.id || "dealer-abc";
  const dealer = data.dealers.find((item) => item.id === id) || data.dealers[0];
  const dealerTransactions = dealer
    ? data.transactions.filter(
        (item) => item.dealerId === dealer.id || item.sellerId === dealer.id,
      )
    : [];

  if (!dealer) {
    return (
      <Panel title="Dealer not found">
        <div style={{ padding: "20px" }}>
          <Button onClick={() => onNavigate("/dealers")}>Back to dealers</Button>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        backTo="/dealers"
        backLabel="Back"
        onNavigate={onNavigate}
        eyebrow="Dealers"
        title={dealer.name}
        description="Dealer profile and transaction history."
        action={
          <div className="header-actions">
            <Button secondary onClick={() => setEditModal(true)} icon={Pencil}>
              Edit dealer
            </Button>
            <Button
              secondary
              onClick={() =>
                downloadCsv(
                  `${dealer.id}-transactions.csv`,
                  ["ID", "Dealer", "Date", "Amount", "Status"],
                  transactionRows({
                    ...data,
                    transactions: dealerTransactions,
                  }).map((row) => row.slice(0, 5)),
                )
              }
              icon={Download}
            >
              Export history
            </Button>
          </div>
        }
      />
      <Panel className="dealer-profile-head">
        <div className="profile-card">
          <div className="dealer-avatar profile">{dealer.name.slice(0, 2)}</div>
          <div>
            <h2>{dealer.name}</h2>
            <small>
              {dealer.location}
              {dealer.phone ? ` • ${dealer.phone}` : ""}
              {dealer.email ? ` • ${dealer.email}` : ""}
            </small>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px" }}>
              <span className="dealer-role-tag">{dealerTypeLabel(dealer.type)}</span>
              <Status>{dealer.status}</Status>
            </div>
          </div>
        </div>
        <button
          className="link-btn"
          onClick={() => onNavigate("/transactions")}
        >
          View all transactions <ArrowUpRight size={14} />
        </button>
      </Panel>
      <div className="stats-grid three">
        <Stat
          label="Total transactions"
          value={dealerTransactions.length}
          change="12.5%"
          icon={CreditCard}
        />
        <Stat
          label="Total volume"
          value={money(
            dealerTransactions.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0),
          )}
          change="8.2%"
          icon={CircleDollarSign}
        />
        <Stat
          label="Avg. transaction"
          value={money(
            dealerTransactions.length
              ? dealerTransactions.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0) /
                  dealerTransactions.length
              : 0,
          )}
          change="3.1%"
          icon={BarChart3}
        />
      </div>
      <Panel title="Transaction history">
        <TransactionTable
          rows={transactionRows({ ...data, transactions: dealerTransactions })}
          onRowClick={(rowId) => onNavigate("/transaction-details?id=" + rowId)}
        />
      </Panel>

      <DealerModal
        open={editModal}
        onClose={() => setEditModal(false)}
        dealer={dealer}
        onSave={(updated) => updateDealer(dealer.id, updated)}
      />
    </>
  );
}

function DealerModal({ open, onClose, dealer, onSave }) {
  const [form, setForm] = useState({
    name: "",
    location: "",
    type: "both",
    phone: "",
    email: "",
    status: "Active",
  });
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (dealer && dealer.id) {
      setForm({
        name: dealer.name || "",
        location: dealer.location || "",
        type: dealer.type || "both",
        phone: dealer.phone || "",
        email: dealer.email || "",
        status: dealer.status || "Active",
      });
    } else {
      setForm({
        name: "",
        location: "",
        type: "both",
        phone: "",
        email: "",
        status: "Active",
      });
    }
    setError("");
  }, [dealer, open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Please enter a dealer name.");
    if (!form.location.trim()) return setError("Please enter a location.");

    onSave({
      name: form.name.trim(),
      location: form.location.trim(),
      type: form.type || "both",
      phone: form.phone.trim(),
      email: form.email.trim(),
      status: form.status,
    });
    onClose();
  };

  const isEdit = Boolean(dealer && dealer.id);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isEdit ? "Edit dealer" : "Add dealer"}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <label className="field-group">
              <span className="field-title">Dealer Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. ABC Diamonds"
                required
              />
            </label>
            <label className="field-group">
              <span className="field-title">Location</span>
              <input
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="e.g. Mumbai, India"
                required
              />
            </label>
            <div className="field-group">
              <span className="field-title">Dealer Type</span>
              <div className="segmented-control" role="radiogroup" aria-label="Dealer Type">
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.type === "buyer"}
                  className={`segmented-btn ${form.type === "buyer" ? "active" : ""}`}
                  onClick={() => setForm((p) => ({ ...p, type: "buyer" }))}
                >
                  Buyer
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.type === "seller"}
                  className={`segmented-btn ${form.type === "seller" ? "active" : ""}`}
                  onClick={() => setForm((p) => ({ ...p, type: "seller" }))}
                >
                  Seller
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.type === "both"}
                  className={`segmented-btn ${form.type === "both" ? "active" : ""}`}
                  onClick={() => setForm((p) => ({ ...p, type: "both" }))}
                >
                  Both
                </button>
              </div>
            </div>
            <label className="field-group">
              <span className="field-title">Phone (Optional)</span>
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+91 22 5550 0198"
              />
            </label>
            <label className="field-group">
              <span className="field-title">Email (Optional)</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="alex@abcdiamonds.com"
              />
            </label>
            {isEdit && (
              <label className="field-group">
                <span className="field-title">Status</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            )}
          </div>
          <div className="modal-actions">
            <Button secondary type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {isEdit ? "Save changes" : "Add Dealer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteDealerModal({ dealer, onClose, onConfirm, isUsed }) {
  if (!dealer) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Remove {dealer.name}?</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          {isUsed ? (
            <div className="delete-warning-box">
              This dealer is used in an existing transaction.
            </div>
          ) : (
            <p className="delete-confirm-text">
              Are you sure you want to remove <b>{dealer.name}</b>?
            </p>
          )}
        </div>
        <div className="modal-actions">
          <Button secondary type="button" onClick={onClose}>
            Cancel
          </Button>
          {!isUsed && (
            <button
              type="button"
              className="button danger"
              onClick={() => onConfirm(dealer.id)}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DesktopDealers({ onNavigate, onAdd, onEdit, onDelete }) {
  const { data } = useData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const list = data.dealers.filter((dealer) =>
    `${dealer.name} ${dealer.location}`
      .toLowerCase()
      .includes(query.toLowerCase()) &&
    (status === "All" || dealer.status === status),
  );
  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Manage"
        title="Dealers"
        description="Manage your network of diamond dealers."
        action={
          <Button onClick={onAdd} icon={Plus}>
            Add dealer
          </Button>
        }
      />
      <div className="stats-grid three">
        <Stat
          label="Total dealers"
          value={data.dealers.length}
          change="6.4%"
          icon={Users}
        />
        <Stat
          label="Active dealers"
          value={data.dealers.filter((item) => item.status === "Active").length}
          change="4.6%"
          icon={Store}
        />
        <Stat
          label="Total volume"
          value={money(
            data.transactions.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0),
          )}
          change="14.8%"
          icon={CircleDollarSign}
        />
      </div>
      <Panel
        title="All dealers"
        action={
          <div className="panel-actions">
            <div className="search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search dealers..."
              />
            </div>
            <select
              className="filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter dealers by status"
            >
              <option value="All">All dealers</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        }
      >
        {list.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Dealer</th>
                  <th>Location</th>
                  <th>Transactions</th>
                  <th>Total volume</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right", paddingRight: "20px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((dealer) => {
                  const volume = data.transactions
                    .filter((item) => item.dealerId === dealer.id || item.sellerId === dealer.id)
                    .reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0);
                  const count = data.transactions.filter(
                    (item) => item.dealerId === dealer.id || item.sellerId === dealer.id,
                  ).length;
                  return (
                    <tr
                      key={dealer.id}
                      onClick={() =>
                        onNavigate("/dealer-profile?id=" + dealer.id)
                      }
                      onKeyDown={(event) =>
                        (event.key === "Enter" || event.key === " ") &&
                        onNavigate("/dealer-profile?id=" + dealer.id)
                      }
                      tabIndex={0}
                      role="button"
                      className="clickable-row"
                    >
                      <td>
                        <div className="table-person">
                          <div className="dealer-avatar">
                            {dealer.name.slice(0, 2)}
                          </div>
                          <div>
                            <b>{dealer.name}</b>
                            <small style={{ display: "block", color: "var(--muted)", fontSize: "10px", marginTop: "2px" }}>
                              {dealerTypeLabel(dealer.type)}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{dealer.location}</td>
                      <td>{count}</td>
                      <td>
                        <b>{money(volume)}</b>
                      </td>
                      <td>
                        <Status>{dealer.status}</Status>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn-action"
                            aria-label={`Edit ${dealer.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onEdit(dealer);
                            }}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn-action danger"
                            aria-label={`Remove ${dealer.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(dealer);
                            }}
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Search size={20} />
            <b>No dealers found</b>
            <span>Try adding a new dealer or a different search term.</span>
          </div>
        )}
      </Panel>
    </>
  );
}
function MobilePaymentCards({ items }) {
  return <div className="mobile-data-list payment-card-list">{items.map(item => <div className="mobile-card-item" key={item.id}><div className="mobile-card-main"><div className="mobile-card-copy"><b>{item.title}</b><span>{item.subtitle}</span></div><div className="mobile-card-amount">{item.amount}</div></div><div className="mobile-card-meta"><span>{item.meta}</span><Status>{item.status}</Status></div></div>)}</div>;
}

function DesktopPayments({ onNavigate }) {
  const { data, addPayment } = useData();
  const [open, setOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("All");
  const [form, setForm] = useState({
    transactionId: data.transactions[0]?.id || "",
    amount: "",
    method: "Bank transfer",
  });
  const [error, setError] = useState("");
  const set = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  const submit = (event) => {
    event.preventDefault();
    const amount = Number(form.amount.replace(/[^0-9.]/g, ""));
    if (!form.transactionId || !amount)
      return setError("Select a transaction and enter a valid amount.");
    const transaction = data.transactions.find(
      (item) => item.id === form.transactionId,
    );
    addPayment({
      id: nextId("PAY", data.payments),
      transactionId: transaction.id,
      dealerId: transaction.dealerId,
      date: new Date().toISOString().slice(0, 10),
      amount,
      method: form.method,
      status: "Completed",
    });
    setOpen(false);
    setForm((previous) => ({ ...previous, amount: "" }));
    setError("");
  };
  const paymentItems = data.payments
    .filter((payment) => paymentStatus === "All" || payment.status === paymentStatus)
    .map((payment) => {
    const dealer = data.dealers.find((item) => item.id === payment.dealerId);
    const transaction = data.transactions.find(
      (item) => item.id === payment.transactionId,
    );
    return {
      id: payment.id,
      title: transaction?.name || payment.transactionId,
      subtitle: dealer?.name || "Unknown dealer",
      meta: payment.date,
      amount: money(payment.amount),
      status: payment.status,
      details: [
        ["Payment ID", payment.id],
        ["Transaction", payment.transactionId],
        ["Dealer", dealer?.name],
        ["Method", payment.method],
        ["Date", payment.date],
        ["Amount", money(payment.amount)],
        ["Status", payment.status],
      ],
    };
    });
  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Finance"
        title="Payments"
        description="Review incoming and outgoing payments."
        action={
          <button
            type="button"
            className="button"
            onClick={() => setOpen(true)}
          >
            <Plus size={16} />
            Add payment
          </button>
        }
      />
      {open && (
        <form className="payment-form panel" onSubmit={submit}>
          <div className="panel-head">
            <h2>Add payment</h2>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Transaction
              <select
                name="transactionId"
                value={form.transactionId}
                onChange={set}
              >
                {data.transactions.map((item) => (
                  <option key={item.id}>{item.id}</option>
                ))}
              </select>
            </label>
            <label>
              Amount
              <input
                name="amount"
                value={form.amount}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    amount: event.target.value
                      .replace(/[^0-9.]/g, "")
                      .replace(/(\..*)\./g, "$1"),
                  }))
                }
                inputMode="decimal"
                pattern="[0-9.]*"
                placeholder={"\u20b9 0.00"}
              />
            </label>
            <label>
              Payment method
              <select name="method" value={form.method} onChange={set}>
                <option>Bank transfer</option>
                <option>Cash</option>
                <option>Credit card</option>
              </select>
            </label>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <Button
              secondary
              type="button"
              onClick={() => setOpen(false)}
              icon={null}
            >
              Cancel
            </Button>
            <Button type="submit">Add payment</Button>
          </div>
        </form>
      )}
      <Panel
        title="Payment history"
        action={
          <select
            className="select"
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value)}
            aria-label="Filter payments by status"
          >
            <option value="All">All payments</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
          </select>
        }
      >
        <MobilePaymentCards items={paymentItems} />
      </Panel>
    </>
  );
}
function DesktopEarnings({ onNavigate }) {
  const { data } = useData();
  const [period, setPeriod] = useState("This month");
  const total = data.transactions.reduce(
    (sum, item) => sum + (item.amount * item.brokerageRate) / 100,
    0,
  );
  const pending = data.transactions
    .filter((item) => item.status !== "Completed")
    .reduce((sum, item) => sum + (item.amount * item.brokerageRate) / 100, 0);
  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Finance"
        title="Earnings overview"
        description="Track your brokerage income and performance."
        action={
          <select
            className="select"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            aria-label="Earnings period"
          >
            <option>This month</option>
            <option>This quarter</option>
            <option>This year</option>
          </select>
        }
      />
      <div className="earnings-support">
        <div className="panel support-card">
          <div>
            <span>Total earnings</span>
            <strong>{money(total)}</strong>
            <small>Shared transaction data</small>
          </div>
          <div className="stat-icon">
            <CircleDollarSign size={17} />
          </div>
        </div>
        <div className="panel support-card">
          <div>
            <span>Pending earnings</span>
            <strong>{money(pending)}</strong>
            <small>
              {
                data.transactions.filter((item) => item.status !== "Completed")
                  .length
              }{" "}
              pending transactions
            </small>
          </div>
          <div className="stat-icon">
            <Wallet size={17} />
          </div>
        </div>
      </div>
      <Panel
        title="Earnings trend"
        action={
          <select
            className="select"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            aria-label="Earnings chart period"
          >
            <option>This month</option>
            <option>This quarter</option>
            <option>This year</option>
          </select>
        }
        className="revenue-panel large-chart"
      >
        <MiniChart />
      </Panel>
      <Panel title="Earnings breakdown" className="breakdown-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Dealer</th>
                <th>Date</th>
                <th>Gross amount</th>
                <th>Rate</th>
                <th>Earnings</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.slice(0, 10).map((item) => {
                const dealer = data.dealers.find(
                  (entry) => entry.id === item.dealerId,
                );
                return (
                  <tr key={item.id}>
                    <td>
                      <b>{item.id}</b>
                    </td>
                    <td>{dealer?.name}</td>
                    <td>{item.date}</td>
                    <td>{money(item.amount)}</td>
                    <td>{item.brokerageRate}%</td>
                    <td>
                      <b>{money((item.amount * item.brokerageRate) / 100)}</b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
function Analytics({ onNavigate }) {
  const { data } = useData();
  const [period, setPeriod] = useState("Monthly");

  const analytics = calculateAnalytics(data.transactions, data.payments, period);

  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Performance"
        title="Analytics"
        description="Understand your business performance across sales, activity and dealer results."
        action={
          <div className="analytics-header-actions">
            <div className="segmented-control period-control" role="radiogroup" aria-label="Analytics Period">
              <button
                type="button"
                role="radio"
                aria-checked={period === "Weekly"}
                className={`segmented-btn ${period === "Weekly" ? "active" : ""}`}
                onClick={() => setPeriod("Weekly")}
              >
                Weekly
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={period === "Monthly"}
                className={`segmented-btn ${period === "Monthly" ? "active" : ""}`}
                onClick={() => setPeriod("Monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={period === "Quarterly"}
                className={`segmented-btn ${period === "Quarterly" ? "active" : ""}`}
                onClick={() => setPeriod("Quarterly")}
              >
                Quarterly
              </button>
            </div>
            <Button
              onClick={() =>
                downloadCsv(
                  `diamond-finance-analytics-${period.toLowerCase()}.csv`,
                  ["Metric", "Value"],
                  [
                    ["Period", period],
                    ["Revenue", money(analytics.revenue)],
                    ["Transactions", String(analytics.transactionsCount)],
                    ["Brokerage / Earnings", money(analytics.earnings)],
                    ["Payments", money(analytics.paymentsTotal)],
                  ],
                )
              }
              icon={Download}
            >
              Export report
            </Button>
          </div>
        }
      />
      <div className="report-summary">
        <div className="stat">
          <span className="stat-top">Total revenue ({period})</span>
          <strong>{money(analytics.revenue)}</strong>
        </div>
        <div className="stat">
          <span className="stat-top">Transactions ({period})</span>
          <strong>{analytics.transactionsCount}</strong>
        </div>
        <div className="stat">
          <span className="stat-top">Brokerage / Earnings</span>
          <strong>{money(analytics.earnings)}</strong>
        </div>
        <div className="stat">
          <span className="stat-top">Payments ({period})</span>
          <strong>{money(analytics.paymentsTotal)}</strong>
        </div>
      </div>
      <div className="report-layout">
        <Panel title={`${period} revenue trend`} className="report-panel">
          <div className="report-card-body">
            {analytics.hasData ? (
              <DynamicBarChart chartData={analytics.chartData} yTicks={analytics.yTicks} />
            ) : (
              <div className="empty-state" style={{ minHeight: "220px" }}>
                <Search size={20} />
                <b>No transactions for this period</b>
                <span>Try selecting another timeframe or create a new transaction.</span>
              </div>
            )}
          </div>
        </Panel>
        <Panel title="Transaction activity" className="report-panel">
          <div className="report-activity-list">
            <div>
              <span>Completed</span>
              <strong>
                {data.transactions.filter((item) => item.status === "Completed").length}
              </strong>
              <small>
                {data.transactions.length
                  ? Math.round((data.transactions.filter((item) => item.status === "Completed").length / data.transactions.length) * 100)
                  : 0}
                % of all transactions
              </small>
            </div>
            <div>
              <span>Pending</span>
              <strong>
                {
                  data.transactions.filter((item) => item.status === "Pending")
                    .length
                }
              </strong>
              <small>
                {money(
                  data.transactions
                    .filter((item) => item.status === "Pending")
                    .reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0)
                )}
              </small>
            </div>
            <div>
              <span>Processing</span>
              <strong>
                {
                  data.transactions.filter(
                    (item) => item.status === "Processing",
                  ).length
                }
              </strong>
              <small>Awaiting review</small>
            </div>
          </div>
        </Panel>
        <Panel
          title="Dealer performance"
          className="report-panel full-width-panel"
        >
          <div className="dealer-rankings">
            {data.dealers.map((dealer, index) => {
              const records = data.transactions.filter(
                (item) => item.dealerId === dealer.id || item.sellerId === dealer.id
              );
              const volume = records.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0);
              return (
                <div className="dealer-rank-row" key={dealer.id}>
                  <div className="dealer-rank-badge">#{index + 1}</div>
                  <div className="dealer-rank-copy">
                    <strong>{dealer.name}</strong>
                    <small>{dealer.location}</small>
                  </div>
                  <div className="dealer-rank-value">
                    <b>{money(volume)}</b>
                    <span>
                      {records.length}{" "}
                      transactions
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}

function MobileDealers({ onNavigate, onAdd, onEdit, onDelete }) {
  const { data } = useData();
  const [query, setQuery] = useState("");
  const list = data.dealers.filter((dealer) =>
    `${dealer.name} ${dealer.location}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const items = list.map((dealer) => {
    const records = data.transactions.filter(
      (item) => item.dealerId === dealer.id || item.sellerId === dealer.id,
    );
    const volume = records.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0);
    return {
      raw: dealer,
      id: dealer.id,
      title: dealer.name,
      subtitle: `${dealer.location} • ${dealerTypeLabel(dealer.type)}`,
      meta: `${records.length} transactions`,
      amount: money(volume),
      status: dealer.status,
    };
  });
  return (
    <div className="mobile-dealers">
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Manage"
        title="Dealers"
        description="Manage your network of diamond dealers."
        action={
          <Button onClick={onAdd} icon={Plus}>
            Add dealer
          </Button>
        }
      />
      <Panel
        title="All dealers"
        action={
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search dealers..."
          />
        }
      >
        <div className="mobile-card-list">
          {items.map((item) => (
            <div
              key={item.id}
              className="mobile-card-item"
              onClick={() => onNavigate("/dealer-profile?id=" + item.id)}
              role="button"
              tabIndex={0}
            >
              <div className="mobile-card-main">
                <div className="mobile-card-copy">
                  <b>{item.title}</b>
                  <span>{item.subtitle}</span>
                </div>
                <div className="mobile-card-amount">{item.amount}</div>
              </div>
              <div className="mobile-card-meta">
                <span>{item.meta}</span>
                <Status>{item.status}</Status>
              </div>
              <div className="mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="link-btn-subtle"
                  onClick={() => onEdit(item.raw)}
                >
                  Edit
                </button>
                <span className="dot-sep">•</span>
                <button
                  type="button"
                  className="link-btn-subtle danger"
                  onClick={() => onDelete(item.raw)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {!items.length && (
            <div className="empty-state">
              <Search size={20} />
              <b>No dealers found</b>
              <span>Try adding a new dealer.</span>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Dealers({ onNavigate }) {
  const { data, addDealer, updateDealer, deleteDealer } = useData();
  const [modalDealer, setModalDealer] = useState(null);
  const [deletingDealer, setDeletingDealer] = useState(null);

  const handleSave = (dealerData) => {
    if (modalDealer && modalDealer.id) {
      updateDealer(modalDealer.id, dealerData);
    } else {
      addDealer(dealerData);
    }
  };

  const isDeletingUsed = Boolean(
    deletingDealer &&
      (data.transactions.some(
        (t) =>
          t.dealerId === deletingDealer.id ||
          t.sellerId === deletingDealer.id ||
          t.buyerId === deletingDealer.id,
      ) ||
        data.payments.some((p) => p.dealerId === deletingDealer.id)),
  );

  const handleConfirmDelete = (id) => {
    const res = deleteDealer(id);
    if (res.success) {
      setDeletingDealer(null);
    }
  };

  return (
    <>
      <div className="desktop-dealers">
        <DesktopDealers
          onNavigate={onNavigate}
          onAdd={() => setModalDealer({})}
          onEdit={(d) => setModalDealer(d)}
          onDelete={(d) => setDeletingDealer(d)}
        />
      </div>
      <div className="mobile-dealers">
        <MobileDealers
          onNavigate={onNavigate}
          onAdd={() => setModalDealer({})}
          onEdit={(d) => setModalDealer(d)}
          onDelete={(d) => setDeletingDealer(d)}
        />
      </div>

      <DealerModal
        open={Boolean(modalDealer)}
        onClose={() => setModalDealer(null)}
        dealer={modalDealer}
        onSave={handleSave}
      />

      <DeleteDealerModal
        dealer={deletingDealer}
        onClose={() => setDeletingDealer(null)}
        onConfirm={handleConfirmDelete}
        isUsed={isDeletingUsed}
      />
    </>
  );
}
function Payments({ onNavigate }) {
  return (
    <>
      <div className="desktop-payments">
        <DesktopPayments onNavigate={onNavigate} />
      </div>
      <div className="mobile-payments">
        <MobilePayments onNavigate={onNavigate} />
      </div>
    </>
  );
}
function MobilePayments({ onNavigate }) {
  const { data, addPayment } = useData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    transactionId: data.transactions[0]?.id || "",
    amount: "",
    method: "Bank transfer",
  });
  const [error, setError] = useState("");

  const set = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));

  const submit = (event) => {
    event.preventDefault();
    const amount = Number(form.amount.replace(/[^0-9.]/g, ""));
    if (!form.transactionId || !amount)
      return setError("Select a transaction and enter a valid amount.");
    const transaction = data.transactions.find(
      (item) => item.id === form.transactionId,
    );
    addPayment({
      id: nextId("PAY", data.payments),
      transactionId: transaction.id,
      dealerId: transaction.dealerId,
      date: new Date().toISOString().slice(0, 10),
      amount,
      method: form.method,
      status: "Completed",
    });
    setOpen(false);
    setForm((previous) => ({ ...previous, amount: "" }));
    setError("");
  };

  const items = data.payments.map((payment) => {
    const dealer = data.dealers.find((item) => item.id === payment.dealerId);
    const transaction = data.transactions.find(
      (item) => item.id === payment.transactionId,
    );
    return {
      id: payment.id,
      title: transaction?.name || payment.transactionId,
      subtitle: dealer?.name || "Unknown dealer",
      amount: money(payment.amount),
      meta: payment.date,
      status: payment.status,
      transactionId: transaction?.id || payment.transactionId,
    };
  });
  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Finance"
        title="Payments"
        description="Review incoming and outgoing payments."
        action={
          <button
            type="button"
            className="button"
            onClick={() => setOpen(true)}
          >
            <Plus size={16} />
            Add payment
          </button>
        }
      />
      {open && (
        <form className="payment-form panel" onSubmit={submit} style={{ marginBottom: "16px" }}>
          <div className="panel-head">
            <h2>Add payment</h2>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Transaction
              <select
                name="transactionId"
                value={form.transactionId}
                onChange={set}
              >
                {data.transactions.map((item) => (
                  <option key={item.id}>{item.id}</option>
                ))}
              </select>
            </label>
            <label>
              Amount
              <input
                name="amount"
                value={form.amount}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    amount: event.target.value
                      .replace(/[^0-9.]/g, "")
                      .replace(/(\..*)\./g, "$1"),
                  }))
                }
                inputMode="decimal"
                pattern="[0-9.]*"
                placeholder={"\u20b9 0.00"}
              />
            </label>
            <label>
              Payment method
              <select name="method" value={form.method} onChange={set}>
                <option>Bank transfer</option>
                <option>Cash</option>
                <option>Credit card</option>
              </select>
            </label>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <Button
              secondary
              type="button"
              onClick={() => setOpen(false)}
              icon={null}
            >
              Cancel
            </Button>
            <Button type="submit">Add payment</Button>
          </div>
        </form>
      )}
      <Panel title="Payment history">
        <div className="mobile-card-list">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="mobile-card-item"
              onClick={() =>
                onNavigate("/transaction-details?id=" + item.transactionId)
              }
            >
              <div className="mobile-card-main">
                <div className="mobile-card-copy">
                  <b>{item.title}</b>
                  <span>{item.subtitle}</span>
                </div>
                <div className="mobile-card-amount">{item.amount}</div>
              </div>
              <div className="mobile-card-meta">
                <span>{item.meta}</span>
                <Status>{item.status}</Status>
              </div>
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}
function Earnings({ onNavigate }) {
  return (
    <>
      <div className="desktop-earnings">
        <DesktopEarnings onNavigate={onNavigate} />
      </div>
      <div className="mobile-earnings">
        <MobileEarnings onNavigate={onNavigate} />
      </div>
    </>
  );
}
function MobileEarnings({ onNavigate }) {
  const { data } = useData();
  const total = data.transactions.reduce(
    (sum, item) => sum + (item.amount * item.brokerageRate) / 100,
    0,
  );
  const pending = data.transactions
    .filter((item) => item.status !== "Completed")
    .reduce((sum, item) => sum + (item.amount * item.brokerageRate) / 100, 0);
  const items = data.transactions.map((item) => {
    const dealer = data.dealers.find((entry) => entry.id === item.dealerId);
    return {
      id: item.id,
      title: dealer?.name || "Unknown dealer",
      amount: money((item.amount * item.brokerageRate) / 100),
    };
  });
  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Finance"
        title="Earnings overview"
        description="Track your brokerage income and performance."
      />
      <div className="earnings-support">
        <div className="panel support-card">
          <div>
            <span>Total earnings</span>
            <strong>{money(total)}</strong>
          </div>
          <div className="stat-icon">
            <CircleDollarSign size={17} />
          </div>
        </div>
        <div className="panel support-card">
          <div>
            <span>Pending earnings</span>
            <strong>{money(pending)}</strong>
            <small>
              {
                data.transactions.filter((item) => item.status !== "Completed")
                  .length
              }{" "}
              pending transactions
            </small>
          </div>
          <div className="stat-icon">
            <Wallet size={17} />
          </div>
        </div>
      </div>
      <Panel title="Earnings trend" className="revenue-panel">
        <MiniChart />
      </Panel>
      <Panel title="Earnings breakdown">
        <div className="mobile-card-list simple-list">
          {items.map((item) => (
            <div key={item.id} className="mobile-card-item simple-item">
              <div className="mobile-card-copy">
                <b>{item.title}</b>
              </div>
              <div className="mobile-card-amount">{item.amount}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
function SettingsPage({ onNavigate }) {
  const [settings, setSettings] = useState(loadSettings);
  const [savedNotice, setSavedNotice] = useState(false);

  const setField = (event) => {
    const { name, value, checked, type } = event.target;
    setSettings((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = () => {
    saveSettings(settings);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3500);
  };

  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Workspace"
        title="Settings"
        description="Manage your account, business details and operating preferences."
        action={<Button onClick={handleSave}>Save changes</Button>}
      />

      {savedNotice && (
        <div className="notice" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <CheckCircle2 size={16} color="var(--green)" />
          <span>Settings saved successfully.</span>
        </div>
      )}

      <div className="settings-page">
        <section className="settings-section">
          <div className="settings-section-head">
            <h2>Account</h2>
          </div>
          <div className="settings-field-grid">
            <label className="settings-field">
              <span>Full name</span>
              <input name="fullName" value={settings.fullName} onChange={setField} />
              <small>Used across your finance workspace.</small>
            </label>
            <label className="settings-field">
              <span>Business email</span>
              <input name="email" type="email" value={settings.email} onChange={setField} />
              <small>Primary contact for alerts and exports.</small>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h2>Business</h2>
          </div>
          <div className="settings-field-grid">
            <label className="settings-field">
              <span>Business name</span>
              <input name="businessName" value={settings.businessName} onChange={setField} />
              <small>Displayed on reports and exports.</small>
            </label>
            <label className="settings-field">
              <span>Default currency</span>
              <select name="currency" value={settings.currency} onChange={setField}>
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
              </select>
              <small>Used for all new transactions.</small>
            </label>
            <label className="settings-field full-width-field">
              <span>Business address</span>
              <input name="address" value={settings.address} onChange={setField} />
              <small>Optional detail for dealer records.</small>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h2>Notifications</h2>
          </div>
          <div className="settings-field-grid">
            <label className="settings-toggle">
              <div>
                <span>Payment reminders</span>
                <small>Notify me when a payment or payout is pending.</small>
              </div>
              <input name="paymentReminders" type="checkbox" checked={settings.paymentReminders} onChange={setField} />
            </label>
            <label className="settings-toggle">
              <div>
                <span>Transaction alerts</span>
                <small>
                  Alert me when new activity is added to the workspace.
                </small>
              </div>
              <input name="transactionAlerts" type="checkbox" checked={settings.transactionAlerts} onChange={setField} />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h2>Preferences</h2>
          </div>
          <div className="settings-field-grid">
            <label className="settings-field">
              <span>Time zone</span>
              <select name="timeZone" value={settings.timeZone} onChange={setField}>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="America/New_York">America/New_York</option>
              </select>
              <small>Controls date display in the dashboard.</small>
            </label>
            <label className="settings-field">
              <span>Default view</span>
              <select name="defaultView" value={settings.defaultView} onChange={setField}>
                <option>Dashboard</option>
                <option>Transactions</option>
                <option>Reports</option>
              </select>
              <small>Opened after login for the workspace.</small>
            </label>
          </div>
        </section>
      </div>
    </>
  );
}

function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState(() => {
    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      const hash = window.location.hash || "";
      if (
        search.get("type") === "recovery" ||
        hash.includes("type=recovery") ||
        search.get("reset") === "true"
      ) {
        return "reset";
      }
    }
    return "login";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setMode("reset");
          setError("");
          setSuccessNotice("");
        }
      });
      return () => subscription?.unsubscribe();
    }
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccessNotice("");

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await authSignIn(cleanEmail, cleanPassword);
      onLoginSuccess({ user: res.user, profile: res.profile });
    } catch (err) {
      setError(err?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccessNotice("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await authResetPasswordForEmail(cleanEmail);
      setSuccessNotice(
        `Password reset instructions have been sent to ${cleanEmail}. Please check your inbox and click the reset link.`
      );
    } catch (err) {
      setError(err?.message || "Failed to send password reset instructions.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccessNotice("");

    const cleanNewPassword = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanNewPassword || !cleanConfirm) {
      setError("Please fill in both password fields.");
      return;
    }

    if (cleanNewPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (cleanNewPassword !== cleanConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authUpdatePassword(cleanNewPassword);
      setSuccessNotice("Your password has been updated successfully. You can now sign in.");
      setTimeout(() => {
        setMode("login");
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/login");
        }
      }, 2000);
    } catch (err) {
      setError(err?.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-head">
          <div className="login-brand">
            <div className="brand-mark">
              <Gem size={20} />
            </div>
            <span>Diamond Finance</span>
          </div>
          <h1>
            {mode === "login"
              ? "Sign in to Diamond Finance"
              : mode === "forgot"
              ? "Reset your password"
              : "Set new password"}
          </h1>
          <p>
            {mode === "login"
              ? "Enter your authorized credentials to access your finance workspace."
              : mode === "forgot"
              ? "Enter your account email to receive a secure password reset link."
              : "Create a secure new password for your account."}
          </p>
        </div>

        {error && (
          <div className="login-error-banner" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successNotice && (
          <div className="notice" style={{ display: "flex", alignItems: "flex-start", gap: "8px", margin: 0 }}>
            <CheckCircle2 size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: "1px" }} />
            <span style={{ fontSize: "12px", lineHeight: "1.4" }}>{successNotice}</span>
          </div>
        )}

        {mode === "login" && (
          <form className="login-form" onSubmit={handleLoginSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. heyhkchag@gmail.com"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>

            <div className="login-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="login-password">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                    setSuccessNotice("");
                  }}
                  style={{
                    fontSize: "11px",
                    color: "var(--blue)",
                    fontWeight: 600,
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="login-password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? <span>Signing in...</span> : <span>Sign In</span>}
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form className="login-form" onSubmit={handleForgotPasswordSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="forgot-email">Account email address</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. heyhkchag@gmail.com"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? <span>Sending Reset Link...</span> : <span>Send Reset Link</span>}
            </button>

            <button
              type="button"
              className="button secondary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                setMode("login");
                setError("");
                setSuccessNotice("");
              }}
              disabled={loading}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form className="login-form" onSubmit={handleResetPasswordSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="reset-new-password">New Password</label>
              <div className="login-password-wrap">
                <input
                  id="reset-new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="reset-confirm-password">Confirm New Password</label>
              <input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? <span>Updating Password...</span> : <span>Save New Password</span>}
            </button>

            <button
              type="button"
              className="button secondary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                setMode("login");
                setError("");
                setSuccessNotice("");
                if (typeof window !== "undefined") {
                  window.history.replaceState({}, "", "/login");
                }
              }}
              disabled={loading}
            >
              Back to Sign In
            </button>
          </form>
        )}

        <div className="login-security-note">
          <Lock size={12} />
          <span>Authorized access only • Protected by Supabase Row Level Security</span>
        </div>
      </div>
    </div>
  );
}

function SuperAdminPage({ onNavigate }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'confirm_disable'
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({ fullName: "", email: "", temporaryPassword: "", status: "active" });
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [bannerNotice, setBannerNotice] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchProfiles();
      setUsers(data || []);
    } catch (e) {
      console.warn("Failed to load users:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenAdd = () => {
    setFormData({ fullName: "", email: "", temporaryPassword: "", status: "active" });
    setFormError("");
    setModal("add");
  };

  const handleOpenEdit = (user) => {
    setSelectedUser(user);
    setFormData({ fullName: user.full_name || "", email: user.email || "", temporaryPassword: "", status: user.status || "active" });
    setFormError("");
    setModal("edit");
  };

  const handleOpenDisable = (user) => {
    setSelectedUser(user);
    setModal("confirm_disable");
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (actionLoading) return;
    setFormError("");

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.temporaryPassword.trim()) {
      setFormError("All fields are required.");
      return;
    }

    if (formData.temporaryPassword.length < 6) {
      setFormError("Temporary password must be at least 6 characters.");
      return;
    }

    setActionLoading(true);
    try {
      await createAuthorizedUser({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        temporaryPassword: formData.temporaryPassword,
        role: "staff",
      });
      setModal(null);
      setBannerNotice(`User "${formData.fullName.trim()}" created successfully as Staff.`);
      setTimeout(() => setBannerNotice(""), 4000);
      await loadUsers();
    } catch (err) {
      setFormError(err?.message || "Failed to create user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (actionLoading || !selectedUser) return;
    setFormError("");

    if (!formData.fullName.trim()) {
      setFormError("Name cannot be empty.");
      return;
    }

    setActionLoading(true);
    try {
      await updateProfile(selectedUser.id, {
        full_name: formData.fullName.trim(),
        status: formData.status,
      });
      setModal(null);
      setBannerNotice("User updated successfully.");
      setTimeout(() => setBannerNotice(""), 4000);
      await loadUsers();
    } catch (err) {
      setFormError(err?.message || "Failed to update user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    if (user.role === "super_admin") return;
    setActionLoading(true);
    try {
      await toggleUserStatus(user.id, user.status);
      setModal(null);
      setBannerNotice(`Account status updated for ${user.email}.`);
      setTimeout(() => setBannerNotice(""), 4000);
      await loadUsers();
    } catch (err) {
      console.warn("Failed to toggle status:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
  });

  const totalUsers = users.length;
  const activeStaff = users.filter((u) => u.role === "staff" && u.status === "active").length;
  const disabledCount = users.filter((u) => u.status === "disabled").length;
  const superAdminCount = users.filter((u) => u.role === "super_admin").length;

  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Super Admin"
        description="Manage authorized Diamond Finance users and access permissions."
        action={
          <button className="button" onClick={handleOpenAdd}>
            <UserPlus size={16} />
            <span>Add User</span>
          </button>
        }
      />

      {bannerNotice && (
        <div className="notice" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <CheckCircle2 size={16} color="var(--green)" />
          <span>{bannerNotice}</span>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat">
          <div className="stat-top">
            <span>Total Accounts</span>
            <div className="stat-icon"><Users size={16} /></div>
          </div>
          <strong>{totalUsers}</strong>
          <small>Authorized users</small>
        </div>
        <div className="stat">
          <div className="stat-top">
            <span>Active Staff</span>
            <div className="stat-icon" style={{ background: "var(--green-soft)", color: "var(--green)" }}><UserCheck size={16} /></div>
          </div>
          <strong>{activeStaff}</strong>
          <small className="up">Operational access</small>
        </div>
        <div className="stat">
          <div className="stat-top">
            <span>Disabled</span>
            <div className="stat-icon" style={{ background: "#fee2e2", color: "#dc2626" }}><UserX size={16} /></div>
          </div>
          <strong>{disabledCount}</strong>
          <small className="down">Blocked access</small>
        </div>
        <div className="stat">
          <div className="stat-top">
            <span>Super Admin</span>
            <div className="stat-icon" style={{ background: "#f5f3ff", color: "#7c3aed" }}><ShieldCheck size={16} /></div>
          </div>
          <strong>{superAdminCount}</strong>
          <small>Designated account</small>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Authorized Users ({filteredUsers.length})</h2>
          <div className="panel-actions">
            <div className="search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Added Date</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <b>No users found</b>
                      <span>Try adjusting your search criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSuper = u.role === "super_admin";
                  const isDisabled = u.status === "disabled";
                  const formattedDate = u.created_at
                    ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "—";

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="table-person">
                          <div className="avatar" style={isSuper ? { background: "#6d28d9" } : {}}>
                            {(u.full_name || u.email || "U").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <b>{u.full_name || "Staff Member"}</b>
                            <span className="table-id">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-badge ${isSuper ? "super-admin" : "staff"}`}>
                          {isSuper ? "Super Admin" : "Staff"}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${isDisabled ? "disabled" : "active"}`}>
                          <i />
                          {isDisabled ? "Disabled" : "Active"}
                        </span>
                      </td>
                      <td>
                        <span>{formattedDate}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {isSuper ? (
                          <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, fontStyle: "italic" }}>
                            Primary Admin (Protected)
                          </span>
                        ) : (
                          <div className="admin-actions-cell" style={{ justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="admin-action-btn"
                              onClick={() => handleOpenEdit(u)}
                            >
                              <Pencil size={12} />
                              <span>Edit</span>
                            </button>
                            {isDisabled ? (
                              <button
                                type="button"
                                className="admin-action-btn success"
                                onClick={() => handleToggleStatus(u)}
                                disabled={actionLoading}
                              >
                                <UserCheck size={12} />
                                <span>Enable</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="admin-action-btn danger"
                                onClick={() => handleOpenDisable(u)}
                                disabled={actionLoading}
                              >
                                <UserX size={12} />
                                <span>Disable</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {modal === "add" && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h3>Add Authorized User</h3>
              <button className="icon-btn" onClick={() => setModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="admin-modal-body">
                {formError && (
                  <div className="login-error-banner">
                    <AlertCircle size={15} />
                    <span>{formError}</span>
                  </div>
                )}
                <label>
                  <span>Full Name</span>
                  <input
                    type="text"
                    placeholder="e.g. Alex Morgan"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>Email Address</span>
                  <input
                    type="email"
                    placeholder="e.g. alex@diamondfinance.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>Temporary Password</span>
                  <input
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={formData.temporaryPassword}
                    onChange={(e) => setFormData({ ...formData, temporaryPassword: e.target.value })}
                    required
                  />
                  <small>The user can sign in with this temporary password.</small>
                </label>
                <label>
                  <span>Role</span>
                  <select disabled value="staff">
                    <option value="staff">Staff (Standard Workspace Access)</option>
                  </select>
                  <small>Only one Super Admin account exists for the workspace.</small>
                </label>
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setModal(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button type="submit" className="button" disabled={actionLoading}>
                  {actionLoading ? "Creating User..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {modal === "edit" && selectedUser && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h3>Edit User — {selectedUser.email}</h3>
              <button className="icon-btn" onClick={() => setModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="admin-modal-body">
                {formError && (
                  <div className="login-error-banner">
                    <AlertCircle size={15} />
                    <span>{formError}</span>
                  </div>
                )}
                <label>
                  <span>Full Name</span>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>Email (Account ID)</span>
                  <input type="email" value={selectedUser.email} disabled />
                  <small>Email address is managed in Supabase Auth.</small>
                </label>
                <label>
                  <span>Account Status</span>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active (Can log in)</option>
                    <option value="disabled">Disabled (Login blocked)</option>
                  </select>
                </label>
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setModal(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button type="submit" className="button" disabled={actionLoading}>
                  {actionLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disable Confirmation Modal */}
      {modal === "confirm_disable" && selectedUser && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h3>Disable Staff Account</h3>
              <button className="icon-btn" onClick={() => setModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="delete-warning-box">
                Are you sure you want to disable <strong>{selectedUser.full_name || selectedUser.email}</strong>?
                <br />
                <span style={{ fontSize: "11.5px", marginTop: "6px", display: "inline-block" }}>
                  This user will be immediately blocked from signing in and accessing Diamond Finance.
                  Their historical transactions, payments, and dealer records will remain intact.
                </span>
              </div>
            </div>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setModal(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button"
                style={{ background: "#dc2626" }}
                onClick={() => handleToggleStatus(selectedUser)}
                disabled={actionLoading}
              >
                {actionLoading ? "Disabling..." : "Confirm Disable"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
