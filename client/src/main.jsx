import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./style.css";

const tokenKey = "token";
const themeKey = "theme";
const agentColors = {
  planner: "bg-sky-500/15 text-sky-200 ring-sky-400/40",
  execution: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40",
  validation: "bg-amber-500/15 text-amber-200 ring-amber-400/40",
  recovery: "bg-rose-500/15 text-rose-200 ring-rose-400/40",
  monitoring: "bg-violet-500/15 text-violet-200 ring-violet-400/40"
};

const viewMeta = {
  console: { label: "Console", description: "Monitor the RAG workflow, retrieval agents, and knowledge-base health." },
  chat: { label: "Chat", description: "Ask grounded college questions with source-backed answers." },
  admin: { label: "Admin", description: "Upload, process, and review college knowledge-base documents." },
  history: { label: "History", description: "Open and export previous student conversations." },
  profile: { label: "Profile", description: "Manage account context, role, and interface preferences." }
};

function getInitialTheme() {
  const saved = localStorage.getItem(themeKey);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const palette = [
  { type: "document", label: "Documents", role: "Uploaded PDFs, notices, FAQs" },
  { type: "extractor", label: "Extractor", role: "Text extraction and OCR status" },
  { type: "chunker", label: "Chunker", role: "Clean focused segments" },
  { type: "embedding", label: "Embedding", role: "Question and chunk vectors" },
  { type: "search", label: "Vector Search", role: "MongoDB semantic retrieval" },
  { type: "llm", label: "LLM", role: "Grounded answer generation" },
  { type: "source", label: "Sources", role: "Citations and confidence" }
];

const initialNodes = [
  makeNode("n1", "document", "College Documents", "PDFs, notices, FAQs", 0, 40),
  makeNode("n2", "extractor", "Text Extraction", "Parser + OCR status", 235, 40),
  makeNode("n3", "chunker", "Chunking", "Topic-focused chunks", 470, 40),
  makeNode("n4", "embedding", "Embeddings", "Vector generation", 705, 40),
  makeNode("n5", "search", "MongoDB Search", "Hybrid semantic ranking", 705, 245),
  makeNode("n6", "llm", "Answer Generator", "LLM or local grounded answer", 470, 245),
  makeNode("n7", "source", "Answer + Source", "References and scores", 235, 245)
];

const initialEdges = [
  makeEdge("n1", "n2"),
  makeEdge("n2", "n3"),
  makeEdge("n3", "n4"),
  makeEdge("n4", "n5"),
  makeEdge("n5", "n6"),
  makeEdge("n6", "n7")
];

function makeNode(id, type, label, description, x, y) {
  return { id, type: "ragNode", position: { x, y }, data: { type, label, description, status: "ready" } };
}

function makeEdge(source, target) {
  return { id: `${source}-${target}`, source, target, animated: true, className: "operator-edge", type: "smoothstep" };
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers["content-type"] = "application/json";
  const token = localStorage.getItem(tokenKey);
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(getInitialTheme);
  const [view, setView] = useState("console");
  const [documents, setDocuments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ collection: "All", department: "All", category: "All", language: "en" });

  const notify = useCallback((title, body, level = "info") => {
    setNotifications((items) => [{ id: crypto.randomUUID(), title, body, level, time: new Date().toLocaleTimeString() }, ...items].slice(0, 12));
  }, []);

  useEffect(() => {
    localStorage.setItem(themeKey, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem(tokenKey)) return;
    const [docResult, sessionResult, analyticsResult] = await Promise.allSettled([
      api("/api/documents"),
      api("/api/chat/sessions"),
      api("/api/admin/analytics")
    ]);
    if (docResult.status === "fulfilled") setDocuments(docResult.value.documents || []);
    if (sessionResult.status === "fulfilled") setSessions(sessionResult.value.sessions || []);
    if (analyticsResult.status === "fulfilled") setAnalytics(analyticsResult.value);
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        if (localStorage.getItem(tokenKey)) {
          const payload = await api("/api/auth/me");
          setUser(payload.user);
          await refresh();
        }
      } catch {
        localStorage.removeItem(tokenKey);
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, [refresh]);

  if (loading) return <FullScreenSkeleton theme={theme} />;
  if (!user) return <AuthScreen setUser={setUser} refresh={refresh} notify={notify} theme={theme} setTheme={setTheme} />;

  return (
    <div className={`theme-${theme} min-h-screen bg-slate-950 text-slate-100`}>
      <AppShell user={user} view={view} setView={setView} setUser={setUser} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} notifications={notifications} theme={theme} setTheme={setTheme}>
        {view === "console" && <ConsoleView documents={documents} analytics={analytics} notify={notify} />}
        {view === "chat" && (
          <ChatView
            documents={documents}
            messages={messages}
            setMessages={setMessages}
            activeSession={activeSession}
            setActiveSession={setActiveSession}
            filters={filters}
            setFilters={setFilters}
            refresh={refresh}
            notify={notify}
          />
        )}
        {view === "admin" && <AdminView documents={documents} analytics={analytics} refresh={refresh} notify={notify} />}
        {view === "history" && <HistoryView sessions={sessions} setView={setView} setMessages={setMessages} setActiveSession={setActiveSession} notify={notify} />}
        {view === "profile" && <ProfileView user={user} documents={documents} sessions={sessions} analytics={analytics} theme={theme} setTheme={setTheme} setUser={setUser} />}
      </AppShell>
    </div>
  );
}

function AuthScreen({ setUser, refresh, notify, theme, setTheme }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("jaatgolu285@gmail.com");
  const [password, setPassword] = useState("Admin@12345");
  const [busy, setBusy] = useState(false);

  function switchMode(nextMode) {
    setMode(nextMode);
    if (nextMode === "register") {
      setEmail("");
      setPassword("");
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget));
      const payload = await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", { method: "POST", body: JSON.stringify(body) });
      if (mode === "register") {
        setEmail(body.email || "");
        setPassword("");
        setMode("login");
        notify("Account created", "Now log in with your new email and password.", "success");
        return;
      }
      localStorage.setItem(tokenKey, payload.token);
      setUser(payload.user);
      await refresh();
      notify("Signed in", "Operator console is ready.", "success");
    } catch (error) {
      notify(mode === "register" ? "Registration failed" : "Authentication failed", error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`theme-${theme} grid min-h-screen place-items-center bg-slate-950 p-6`}>
      <div className="fixed right-5 top-5">
        <ThemeToggle theme={theme} setTheme={setTheme} />
      </div>
      <div className="grid w-full max-w-5xl overflow-hidden rounded border border-slate-800 bg-slate-900 shadow-2xl md:grid-cols-[1fr_390px]">
        <section className="auth-hero bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_35%),linear-gradient(135deg,#0f172a,#020617)] p-8">
          <div className="text-sm uppercase tracking-widest text-cyan-300">College RAG Operator Console</div>
          <h1 className="mt-5 max-w-2xl text-4xl font-bold text-white md:text-6xl">Monitor every retrieval step before the answer ships.</h1>
          <p className="mt-5 max-w-xl text-slate-300">Upload college documents, inspect the RAG graph, watch execution events, and answer students with citations from MongoDB-backed retrieval.</p>
        </section>
        <form onSubmit={submit} className="space-y-4 border-l border-slate-800 bg-slate-950/70 p-7">
          <div className="grid grid-cols-2 rounded border border-slate-800 p-1">
            <button type="button" className={`rounded px-3 py-2 ${mode === "login" ? "bg-cyan-500 text-slate-950" : "text-slate-300"}`} onClick={() => switchMode("login")}>Login</button>
            <button type="button" className={`rounded px-3 py-2 ${mode === "register" ? "bg-cyan-500 text-slate-950" : "text-slate-300"}`} onClick={() => switchMode("register")}>Register</button>
          </div>
          {mode === "register" && <Input name="name" label="Name" required />}
          <Input name="email" type="email" label="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input name="password" type="password" label="Password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {mode === "login" ? (
            <p className="text-xs text-slate-500">New account banane ke baad yahin se login karein.</p>
          ) : (
            <p className="text-xs text-slate-500">Register ke baad aapko login tab par bhej diya jayega.</p>
          )}
          <button disabled={busy} className="h-11 w-full rounded bg-cyan-400 font-semibold text-slate-950 disabled:animate-pulse disabled:opacity-60">
            {busy ? "Working..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AppShell({ user, view, setView, setUser, children, drawerOpen, setDrawerOpen, notifications, theme, setTheme }) {
  const nav = ["console", "chat", "admin", "history", "profile"];
  const meta = viewMeta[view] || viewMeta.console;
  return (
    <div className="grid min-h-screen lg:grid-cols-[288px_1fr]">
      <aside className="border-r border-slate-800 bg-slate-950/90 p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-auto">
        <div className="rounded border border-cyan-400/30 bg-cyan-400/10 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded bg-cyan-400 font-bold text-slate-950">R</div>
            <div>
              <div className="text-lg font-bold text-white">College RAG</div>
              <div className="text-xs text-cyan-200">Operator Console</div>
            </div>
          </div>
          <div className="mt-4 rounded border border-cyan-400/20 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">MongoDB retrieval pipeline active</div>
        </div>
        <nav className="mt-6 grid gap-2">
          {nav.map((item) => (
            <button key={item} onClick={() => setView(item)} className={`rounded border px-4 py-3 text-left transition ${view === item ? "border-cyan-400/50 bg-slate-800 text-cyan-200" : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900"}`}>
              <span className="block font-medium capitalize">{viewMeta[item].label}</span>
              <span className="mt-1 block text-xs normal-case text-slate-500">{viewMeta[item].description}</span>
            </button>
          ))}
        </nav>
        <div className="mt-8 rounded border border-slate-800 p-4">
          <div className="font-semibold text-white">{user.name}</div>
          <div className="break-all text-sm text-slate-400">{user.email}</div>
          <div className="mt-2 inline-flex rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">{user.role}</div>
        </div>
        <button onClick={() => { localStorage.removeItem(tokenKey); setUser(null); }} className="mt-4 h-11 w-full rounded border border-slate-700 text-slate-300">Sign out</button>
      </aside>
      <main className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-cyan-300">Live System</div>
            <h2 className="text-2xl font-semibold text-white">{meta.label}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">{meta.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <button onClick={() => setDrawerOpen(true)} className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-200">
              Notifications <span className="ml-2 rounded bg-cyan-400 px-2 text-slate-950">{notifications.length}</span>
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1680px] p-4">{children}</div>
      </main>
      <NotificationsDrawer open={drawerOpen} setOpen={setDrawerOpen} notifications={notifications} />
    </div>
  );
}

function ThemeToggle({ theme, setTheme }) {
  return (
    <div className="grid grid-cols-2 rounded border border-slate-700 bg-slate-950 p-1 text-sm">
      {["light", "dark"].map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setTheme(item)}
          className={`rounded px-3 py-1.5 capitalize transition ${theme === item ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:text-cyan-100"}`}
          aria-pressed={theme === item}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function NotificationsDrawer({ open, setOpen, notifications }) {
  return (
    <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-slate-800 bg-slate-950 p-5 shadow-2xl transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Notifications</h3>
        <button onClick={() => setOpen(false)} className="rounded border border-slate-700 px-3 py-1">Close</button>
      </div>
      <div className="mt-5 grid gap-3">
        {notifications.length ? notifications.map((item) => (
          <div key={item.id} className="rounded border border-slate-800 bg-slate-900 p-3">
            <div className="flex justify-between gap-3"><strong>{item.title}</strong><span className="text-xs text-slate-500">{item.time}</span></div>
            <p className="mt-1 text-sm text-slate-400">{item.body}</p>
          </div>
        )) : <p className="text-slate-500">No notifications yet.</p>}
      </div>
    </div>
  );
}

function ConsoleView({ documents, analytics, notify }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [events, setEvents] = useState(seedEvents);

  useEffect(() => {
    const agents = ["planner", "execution", "validation", "recovery", "monitoring"];
    const timer = setInterval(() => {
      const agent = agents[Math.floor(Math.random() * agents.length)];
      setEvents((items) => [{ id: crypto.randomUUID(), agent, text: eventText(agent), time: new Date().toLocaleTimeString() }, ...items].slice(0, 8));
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-4">
      <SystemStatusBar documents={documents} analytics={analytics} />
      <MetricGrid documents={documents} analytics={analytics} />
      <ReactFlowProvider>
        <div className="grid gap-4 xl:grid-cols-[210px_minmax(0,1fr)_280px]">
          <NodePalette />
          <WorkflowCanvas selectedNode={selectedNode} setSelectedNode={setSelectedNode} notify={notify} />
          <NodeConfigPanel selectedNode={selectedNode} />
        </div>
      </ReactFlowProvider>
      <ExecutionTimeline events={events} />
    </div>
  );
}

function SystemStatusBar({ documents, analytics }) {
  const chunks = analytics?.totals?.chunks || documents.reduce((sum, doc) => sum + (doc.chunkCount || 0), 0);
  return (
    <section className="grid gap-3 rounded border border-slate-800 bg-slate-900 p-4 md:grid-cols-3">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300">System Health</div>
        <div className="mt-1 text-lg font-semibold text-white">Ready for student questions</div>
      </div>
      <div className="rounded border border-slate-800 bg-slate-950 p-3">
        <div className="text-xs text-slate-500">Indexed content</div>
        <div className="mt-1 font-semibold text-white">{documents.length} documents / {chunks} chunks</div>
      </div>
      <div className="rounded border border-slate-800 bg-slate-950 p-3">
        <div className="text-xs text-slate-500">Retrieval mode</div>
        <div className="mt-1 font-semibold text-white">Hybrid semantic search</div>
      </div>
    </section>
  );
}

function MetricGrid({ documents, analytics }) {
  const metrics = [
    ["Documents", documents.length, "Uploaded knowledge files"],
    ["Chunks", analytics?.totals?.chunks || documents.reduce((sum, doc) => sum + (doc.chunkCount || 0), 0), "Searchable context units"],
    ["Questions", analytics?.totals?.chatMessages || 0, "Student prompts answered"],
    ["Unanswered", analytics?.totals?.unanswered || 0, "Needs more documents"]
  ];
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {metrics.map(([label, value, helper]) => (
        <div key={label} className="rounded border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-400">{label}</div>
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-white">{value}</div>
          <div className="mt-1 text-xs text-slate-500">{helper}</div>
        </div>
      ))}
    </div>
  );
}

function NodePalette() {
  return (
    <aside className="rounded border border-slate-800 bg-slate-900 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-white">Node Palette</h3>
        <span className="rounded bg-cyan-400/10 px-2 py-1 text-[11px] uppercase tracking-wide text-cyan-200">Drag</span>
      </div>
      <div className="mt-3 grid gap-2">
        {palette.map((item) => (
          <div key={item.type} draggable onDragStart={(event) => event.dataTransfer.setData("application/reactflow", JSON.stringify(item))} className="cursor-grab rounded border border-slate-700 bg-slate-950 p-2.5 active:cursor-grabbing hover:border-cyan-300">
            <div className="text-sm font-semibold text-cyan-200">{item.label}</div>
            <div className="text-xs text-slate-500">{item.role}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function WorkflowCanvas({ setSelectedNode, notify }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true, className: "operator-edge" }, eds)), [setEdges]);
  const onDrop = useCallback((event) => {
    event.preventDefault();
    const item = JSON.parse(event.dataTransfer.getData("application/reactflow") || "{}");
    if (!item.type) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setNodes((items) => [...items, makeNode(crypto.randomUUID(), item.type, item.label, item.role, position.x, position.y)]);
    notify("Node added", `${item.label} added to the RAG graph.`, "success");
  }, [screenToFlowPosition, setNodes, notify]);

  return (
    <section className="relative h-[560px] overflow-hidden rounded border border-slate-800 bg-slate-950 shadow-xl shadow-slate-950/20">
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded border border-slate-800 bg-slate-900/95 px-3 py-2 text-xs text-slate-400">
        Drag nodes from palette, connect steps, click any node to configure.
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
        onNodeClick={(_, item) => setSelectedNode(item)}
        nodeTypes={{ ragNode: RagNode }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.45}
        maxZoom={1.4}
        fitViewOptions={{ padding: 0.24 }}
        panOnScroll
        fitView
      >
        <Background color="#334155" gap={18} />
        <Controls position="bottom-left" />
        <MiniMap position="bottom-right" nodeColor="#0891b2" maskColor="rgba(2,6,23,.72)" pannable zoomable />
      </ReactFlow>
    </section>
  );
}

function RagNode({ data, selected }) {
  return (
    <div className={`min-w-48 rounded border px-4 py-3 shadow-lg ${selected ? "border-cyan-300 bg-slate-800" : "border-slate-700 bg-slate-900/95"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-cyan-300">{data.type}</span>
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">{data.status}</span>
      </div>
      <div className="mt-2 font-semibold text-slate-50">{data.label}</div>
      <div className="mt-1 text-xs text-slate-400">{data.description}</div>
    </div>
  );
}

function NodeConfigPanel({ selectedNode }) {
  return (
    <aside className="rounded border border-slate-800 bg-slate-900 p-4">
      <h3 className="font-semibold text-white">Configuration</h3>
      {selectedNode ? (
        <div className="mt-4 space-y-3">
          <Input label="Node label" value={selectedNode.data.label} readOnly />
          <Input label="Node type" value={selectedNode.data.type} readOnly />
          <label className="block text-sm text-slate-400">Execution mode<select className="mt-2 h-11 w-full rounded border border-slate-700 bg-slate-950 px-3 text-slate-100"><option>Automatic</option><option>Manual review</option></select></label>
          <label className="block text-sm text-slate-400">Confidence threshold<input type="range" min="0" max="100" defaultValue="70" className="mt-2 w-full" /></label>
        </div>
      ) : (
        <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-4">
          <p className="text-sm text-slate-400">Select a graph node to configure retrieval, ranking, validation, or source behavior.</p>
          <div className="mt-4 grid gap-2 text-xs text-slate-500">
            <div className="rounded border border-slate-800 p-2">Zoom with + / - controls</div>
            <div className="rounded border border-slate-800 p-2">Use fit view to center the graph</div>
            <div className="rounded border border-slate-800 p-2">Drag palette nodes into the canvas</div>
          </div>
        </div>
      )}
    </aside>
  );
}

function ExecutionTimeline({ events }) {
  return (
    <section className="rounded border border-slate-800 bg-slate-900 p-4">
      <h3 className="font-semibold text-white">Live Execution Timeline</h3>
      <div className="mt-4 grid gap-3">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-3 rounded border border-slate-800 bg-slate-950 p-3">
            <span className={`rounded px-2 py-1 text-xs font-semibold ring-1 ${agentColors[event.agent]}`}>{event.agent}</span>
            <div className="min-w-0 flex-1 text-sm text-slate-300">{event.text}</div>
            <time className="text-xs text-slate-500">{event.time}</time>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChatView({ documents, messages, setMessages, activeSession, setActiveSession, filters, setFilters, refresh, notify }) {
  const [busy, setBusy] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const options = useMemo(() => ({
    collections: ["All", ...unique(documents.map((doc) => doc.collection).filter(Boolean))],
    departments: ["All", ...unique(documents.map((doc) => doc.department).filter(Boolean))],
    categories: ["All", ...unique(documents.map((doc) => doc.category).filter(Boolean))]
  }), [documents]);

  useEffect(() => {
    const params = new URLSearchParams({ collection: filters.collection, department: filters.department, category: filters.category });
    api(`/api/chat/suggestions?${params}`).then((payload) => setSuggestions(payload.suggestions || [])).catch(() => {});
  }, [filters.collection, filters.department, filters.category]);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const question = draftQuestion.trim();
    if (!question) return;
    setBusy(true);
    setMessages((items) => [...items, { question, answer: "Searching MongoDB vectors...", sources: [] }]);
    try {
      const payload = await api("/api/chat/ask", { method: "POST", body: JSON.stringify({ question, sessionId: activeSession?.id, ...filters }) });
      setActiveSession(payload.session);
      setMessages((items) => [...items.slice(0, -1), payload.message]);
      form.reset();
      setDraftQuestion("");
      await refresh();
      notify("Answer generated", `${payload.message.sources.length} source reference(s) attached.`, "success");
    } catch (error) {
      notify("Chat failed", error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function startNewChat() {
    setMessages([]);
    setActiveSession(null);
    setDraftQuestion("");
    notify("New chat ready", "Conversation context cleared.", "success");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <section className="overflow-hidden rounded border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-3">
          <div>
            <h3 className="font-semibold text-white">{activeSession?.title || "New college query"}</h3>
            <p className="mt-1 text-sm text-slate-400">Answers stay grounded in uploaded documents and source chunks.</p>
          </div>
          <button type="button" onClick={startNewChat} className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-cyan-300 hover:text-cyan-100">New chat</button>
        </div>
        <div className="grid gap-3 border-b border-slate-800 p-3 md:grid-cols-4">
          <Select label="Collection" value={filters.collection} values={options.collections} onChange={(value) => setFilters((item) => ({ ...item, collection: value }))} />
          <Select label="Department" value={filters.department} values={options.departments} onChange={(value) => setFilters((item) => ({ ...item, department: value }))} />
          <Select label="Category" value={filters.category} values={options.categories} onChange={(value) => setFilters((item) => ({ ...item, category: value }))} />
          <Select label="Language" value={filters.language} values={["en", "hi", "auto"]} onChange={(value) => setFilters((item) => ({ ...item, language: value }))} />
        </div>
        <div className="max-h-[560px] min-h-[460px] space-y-4 overflow-auto bg-slate-950/40 p-4">
          {messages.length ? messages.map((message, index) => <Message key={message.id || index} message={message} notify={notify} setMessages={setMessages} />) : <EmptyChatState documents={documents} setDraftQuestion={setDraftQuestion} />}
        </div>
        <form onSubmit={submit} className="grid gap-3 border-t border-slate-800 p-3 sm:grid-cols-[1fr_96px]">
          <textarea
            name="question"
            value={draftQuestion}
            onChange={(event) => setDraftQuestion(event.target.value)}
            className="min-h-16 rounded border border-slate-700 bg-slate-950 p-3 text-slate-100 outline-none focus:border-cyan-300"
            placeholder="Ask a college-related question..."
          />
          <button disabled={busy} className="h-16 rounded bg-cyan-400 font-semibold text-slate-950 disabled:animate-pulse disabled:opacity-70">{busy ? "Search" : "Ask"}</button>
        </form>
      </section>
      <aside className="space-y-4">
        <section className="rounded border border-slate-800 bg-slate-900 p-4">
          <h3 className="font-semibold text-white">Suggested Questions</h3>
          <div className="mt-3 grid gap-2">{suggestions.map((item) => <button key={item} onClick={() => setDraftQuestion(item)} className="rounded border border-slate-700 p-3 text-left text-sm text-slate-300 hover:border-cyan-300 hover:text-cyan-100">{item}</button>)}</div>
        </section>
        <section className="rounded border border-slate-800 bg-slate-900 p-4">
          <h3 className="font-semibold text-white">Knowledge Base</h3>
          <div className="mt-3 grid gap-2">{documents.slice(0, 6).map((doc) => <DocumentCard key={doc.id} doc={doc} />)}</div>
        </section>
      </aside>
    </div>
  );
}

function EmptyChatState({ documents, setDraftQuestion }) {
  const starters = [
    "What information is available about admissions?",
    "What departments are available?",
    "What is the application fee?"
  ];

  return (
    <div className="grid min-h-[430px] place-items-center">
      <div className="w-full max-w-2xl rounded border border-slate-800 bg-slate-950 p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded bg-cyan-400 text-xl font-bold text-slate-950">AI</div>
        <h3 className="mt-4 text-lg font-semibold text-white">Chat is ready</h3>
        <p className="mt-2 text-sm text-slate-400">
          Ask a question from the uploaded college knowledge base. The answer will include source references from MongoDB retrieval.
        </p>
        <div className="mt-4 text-xs uppercase tracking-widest text-slate-500">{documents.length} documents indexed</div>
        <div className="mt-5 grid gap-2 text-left sm:grid-cols-3">
          {starters.map((item) => (
            <button key={item} onClick={() => setDraftQuestion(item)} className="rounded border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300 hover:border-cyan-300 hover:text-cyan-100">
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Message({ message, notify, setMessages }) {
  async function feedback(rating) {
    if (!message.id) return;
    const payload = await api(`/api/chat/messages/${message.id}/feedback`, { method: "POST", body: JSON.stringify({ rating }) });
    setMessages((items) => items.map((item) => item.id === message.id ? payload.message : item));
    notify("Feedback saved", rating === "up" ? "Marked helpful." : "Marked for review.", "success");
  }

  return (
    <div className="space-y-3">
      <div className="ml-auto max-w-3xl rounded bg-cyan-500 px-4 py-3 font-medium text-slate-950 shadow-lg shadow-cyan-950/10">{message.question}</div>
      <div className="max-w-4xl rounded border border-slate-800 bg-slate-950 p-4 shadow-sm">
        <p className="whitespace-pre-wrap text-slate-200">{message.answer}</p>
        {message.sources?.length ? (
          <div className="mt-4">
            <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">Sources</div>
            <div className="grid gap-2">
              {message.sources.map((source, i) => (
                <div key={i} className="rounded border border-slate-800 bg-slate-900 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-white">{source.documentTitle}</strong>
                    <span className="rounded bg-cyan-400/10 px-2 py-1 text-xs text-cyan-200">relevance {source.similarityScore}</span>
                  </div>
                  <div className="mt-1 text-cyan-200">Page {source.pageNumber || "N/A"}</div>
                  <p className="mt-1 text-slate-400">{source.snippet}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {message.id && <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => feedback("up")} className="h-10 rounded border border-slate-700 px-3">Helpful</button><button onClick={() => feedback("down")} className="h-10 rounded border border-slate-700 px-3">Review</button><button onClick={() => speak(message.answer)} className="h-10 rounded border border-slate-700 px-3">Speak</button></div>}
      </div>
    </div>
  );
}

function AdminView({ documents, analytics, refresh, notify }) {
  const [busy, setBusy] = useState(false);

  async function upload(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/documents/upload", { method: "POST", headers: {}, body: new FormData(event.currentTarget) });
      event.currentTarget.reset();
      await refresh();
      notify("Document processed", "Chunks, vectors, summary, and FAQs were generated.", "success");
    } catch (error) {
      notify("Upload failed", error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <form onSubmit={upload} className="space-y-3 rounded border border-slate-800 bg-slate-900 p-4">
        <h3 className="font-semibold text-white">Upload Document</h3>
        <p className="text-sm text-slate-400">Add official college notices, PDFs, FAQs, and policies to expand answer coverage.</p>
        <Input name="title" label="Title" required />
        <Input name="collection" label="Collection" />
        <Input name="category" label="Category" />
        <Input name="department" label="Department" />
        <input name="file" type="file" required className="w-full rounded border border-slate-700 bg-slate-950 p-3" />
        <button disabled={busy} className="h-11 w-full rounded bg-cyan-400 font-semibold text-slate-950 disabled:animate-pulse">{busy ? "Processing..." : "Upload and process"}</button>
      </form>
      <div className="space-y-4">
        <MetricGrid documents={documents} analytics={analytics} />
        <div className="grid gap-3">{documents.length ? documents.map((doc) => <DocumentCard key={doc.id} doc={doc} rich />) : <EmptyPanel title="No documents yet" body="Upload the first college document to create searchable chunks and source-backed answers." />}</div>
      </div>
    </div>
  );
}

function HistoryView({ sessions, setView, setMessages, setActiveSession, notify }) {
  async function openSession(id) {
    const payload = await api(`/api/chat/sessions/${id}`);
    setActiveSession(payload.session);
    setMessages(payload.messages);
    setView("chat");
  }
  async function exportSession(id) {
    const payload = await api(`/api/chat/sessions/${id}/export`);
    download(`${payload.session.title}.json`, JSON.stringify(payload, null, 2));
    notify("Conversation exported", payload.session.title, "success");
  }
  return (
    <div className="grid gap-3">
      {sessions.length ? sessions.map((session) => (
        <div key={session.id} className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-4">
          <div>
            <strong>{session.title}</strong>
            <div className="text-sm text-slate-500">{new Date(session.updatedAt).toLocaleString()}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openSession(session.id)} className="rounded border border-slate-700 px-3 py-2">Open</button>
            <button onClick={() => exportSession(session.id)} className="rounded border border-slate-700 px-3 py-2">Export</button>
          </div>
        </div>
      )) : <EmptyPanel title="No chat history yet" body="Ask a question in Chat to create a conversation that can be reopened or exported here." />}
    </div>
  );
}

function ProfileView({ user, documents, sessions, analytics, theme, setTheme, setUser }) {
  const initials = (user.name || user.email || "CA")
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join("");
  const profileStats = [
    ["Role", user.role],
    ["Documents", documents.length],
    ["Chat Sessions", sessions.length],
    ["Questions", analytics?.totals?.chatMessages || 0]
  ];
  const recentSessions = sessions.slice(0, 4);
  const collections = unique(documents.map((doc) => doc.collection || "General Knowledge Base"));

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <section className="rounded border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded bg-cyan-400 text-2xl font-bold text-slate-950">{initials}</div>
          <div className="min-w-0">
            <h3 className="truncate text-xl font-semibold text-white">{user.name}</h3>
            <p className="break-all text-sm text-slate-400">{user.email}</p>
            <span className="mt-3 inline-flex rounded bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-200">{user.role}</span>
          </div>
        </div>
        <div className="mt-6 grid gap-3">
          <ProfileField label="Account status" value="Active" />
          <ProfileField label="Interface theme" value={theme} />
          <ProfileField label="Knowledge base access" value={user.role === "admin" ? "Admin document management" : "Student chat access"} />
        </div>
        <div className="mt-6">
          <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">Theme Preference</div>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
        <button onClick={() => { localStorage.removeItem(tokenKey); setUser(null); }} className="mt-6 h-11 w-full rounded border border-slate-700 text-slate-300">Sign out</button>
      </section>

      <section className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          {profileStats.map(([label, value]) => (
            <div key={label} className="rounded border border-slate-800 bg-slate-900 p-4">
              <div className="text-sm text-slate-400">{label}</div>
              <div className="mt-2 truncate text-2xl font-bold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded border border-slate-800 bg-slate-900 p-4">
            <h3 className="font-semibold text-white">Recent Activity</h3>
            <div className="mt-3 grid gap-2">
              {recentSessions.length ? recentSessions.map((session) => (
                <div key={session.id} className="rounded border border-slate-800 bg-slate-950 p-3">
                  <div className="font-medium text-white">{session.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{new Date(session.updatedAt).toLocaleString()}</div>
                </div>
              )) : <p className="text-sm text-slate-500">No chat sessions yet.</p>}
            </div>
          </section>

          <section className="rounded border border-slate-800 bg-slate-900 p-4">
            <h3 className="font-semibold text-white">Knowledge Base Scope</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {collections.length ? collections.map((collection) => (
                <span key={collection} className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300">{collection}</span>
              )) : <p className="text-sm text-slate-500">No collections indexed yet.</p>}
            </div>
            <div className="mt-4 text-sm text-slate-400">
              MongoDB-backed retrieval is active for uploaded college documents, chunks, sources, and chat history.
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-3">
      <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 font-medium capitalize text-white">{value}</div>
    </div>
  );
}

function EmptyPanel({ title, body }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-6 text-center">
      <div className="mx-auto h-1 w-16 rounded bg-cyan-400" />
      <h3 className="mt-4 font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">{body}</p>
    </div>
  );
}

function DocumentCard({ doc, rich }) {
  return (
    <article className="rounded border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <strong className="text-white">{doc.title}</strong>
        <span className="rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">{doc.processingStatus}</span>
      </div>
      <div className="mt-2 text-sm text-slate-400">{doc.collection || "General Knowledge Base"} | v{doc.version || 1} | {doc.department || "All"} | {doc.chunkCount || 0} chunks</div>
      {rich && doc.summary && <p className="mt-2 text-sm text-slate-300">{doc.summary}</p>}
      {rich && doc.faqs?.length ? <div className="mt-2 text-xs text-cyan-200">{doc.faqs.map((faq) => faq.question).join(" | ")}</div> : null}
    </article>
  );
}

function Select({ label, value, values, onChange }) {
  return <label className="text-xs text-slate-400">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-slate-100">{values.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>;
}

function Input({ label, ...props }) {
  return <label className="block text-sm text-slate-400">{label}<input {...props} className="mt-2 h-11 w-full rounded border border-slate-700 bg-slate-900 px-3 text-slate-100 outline-none focus:border-cyan-300" /></label>;
}

function FullScreenSkeleton({ theme = "dark" }) {
  return <div className={`theme-${theme} grid min-h-screen place-items-center bg-slate-950`}><SkeletonText /></div>;
}

function SkeletonText() {
  return <div className="w-full max-w-xl space-y-3 p-4"><div className="h-5 w-2/3 animate-pulse rounded bg-slate-800" /><div className="h-5 w-1/2 animate-pulse rounded bg-slate-800" /><div className="h-32 animate-pulse rounded bg-slate-800" /></div>;
}

function seedEvents() {
  return ["planner", "execution", "validation", "recovery", "monitoring"].map((agent) => ({ id: crypto.randomUUID(), agent, text: eventText(agent), time: new Date().toLocaleTimeString() }));
}

function eventText(agent) {
  return {
    planner: "Selected retrieval strategy from active filters.",
    execution: "Embedded query and searched MongoDB vector chunks.",
    validation: "Checked source overlap and confidence threshold.",
    recovery: "Prepared unknown-answer fallback for unsupported claims.",
    monitoring: "Recorded latency, feedback, and unanswered status."
  }[agent];
}

function unique(values) {
  return [...new Set(values)].sort();
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function download(filename, text) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  link.download = filename.replace(/[^a-z0-9_.-]+/gi, "-");
  link.click();
  URL.revokeObjectURL(link.href);
}

createRoot(document.getElementById("root")).render(<App />);
