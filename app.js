// Social Frames by FRAMES AI — Full Application Router, Workspace & Interactive Engine
(function () {
  "use strict";

  // --- Application State ---
  const state = {
    route: window.location.hash ? window.location.hash.slice(1) : "/",
    theme: localStorage.getItem("sf_theme") || "dark",
    postId: "itm_0192f1d0c7a87b5e9a0c3f6e1d2b4a01",
    postTab: "transcript", // Default to TRANSCRIPT to match Screenshot 3 (or user can switch to OVERVIEW/ANALYSIS/HOOK/TAGS/COMMENTS/METRICS)
    showOnScreenInBeats: true,
    openDropdown: null, // 'download' | 'copy' | null
    transcriptSearch: "",
    commentFilter: "all",
    commentSort: "likes",
    commentSearch: "",
    postsSearch: "",
    postsPlatformFilter: "all",
    balanceCents: 50, // Matches Screenshot 3 ("50¢ BALANCE / 1 POST, COMMENTS INCLUDED")
    creditsHistory: [
      { id: "tx_04", date: "Oct 15, 2026 · 14:22", desc: "Analyzed @howtohoopforever (Instagram Reel + 54 comments)", delta: -50, balance: 50 },
      { id: "tx_03", date: "Oct 14, 2026 · 19:05", desc: "Metrics refresh · @nikebasketball", delta: -1, balance: 100 },
      { id: "tx_02", date: "Oct 14, 2026 · 11:30", desc: "Analyzed @nikebasketball (Instagram Reel + comments)", delta: -50, balance: 101 },
      { id: "tx_01", date: "Oct 12, 2026 · 09:00", desc: "Welcome free trial credit ($1.51)", delta: 151, balance: 151 }
    ],
    activeAccountHandle: "howtohoopforever",
    activeChatId: "chat_01",
    chatInput: "",
    player: {
      playing: true,
      currentTime: 2.5,
      duration: 40,
      muted: true
    },
    newAnalysis: {
      mode: "url", // 'url' | 'upload' | 'account'
      url: "https://www.instagram.com/reel/DAtx92LmN01/",
      includeComments: true,
      commentCount: 200,
      running: false,
      stepIndex: 0
    },
    toast: null
  };

  // Apply initial theme
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("sf_theme", theme);
  }
  applyTheme(state.theme);

  function showToast(msg) {
    state.toast = msg;
    let el = document.getElementById("sf-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sf-toast";
      el.style.cssText =
        "position:fixed;bottom:20px;right:20px;z-index:9999;background:var(--ink);color:var(--on-ink);padding:10px 16px;font-family:var(--font-mono);font-size:11.5px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;border:1px solid var(--line-strong);box-shadow:0 8px 24px rgba(0,0,0,0.45);transition:opacity 0.2s;";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(window.__sfToastTimer);
    window.__sfToastTimer = setTimeout(() => {
      if (el) el.style.opacity = "0";
    }, 2600);
  }

  function copyToClipboard(text, label) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(label || "Copied to clipboard");
      }).catch(() => fallbackCopy(text, label));
    } else {
      fallbackCopy(text, label);
    }
  }

  function fallbackCopy(text, label) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast(label || "Copied to clipboard");
    } catch (e) {
      showToast("Copy ready");
    }
    document.body.removeChild(ta);
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Downloaded " + filename);
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + (r < 10 ? "0" + r : r);
  }

  function formatNumber(n) {
    const num = Number(n) || 0;
    return num.toLocaleString("en-US");
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getPosts() {
    return window.SF_POSTS || [];
  }

  function getCurrentPost() {
    const posts = getPosts();
    return posts.find((p) => p.item_id === state.postId) || posts[0];
  }

  // --- Navigation ---
  function navigate(path, opts) {
    opts = opts || {};
    if (!path.startsWith("/")) path = "/" + path;
    state.route = path;
    state.openDropdown = null;
    if (opts.postTab) state.postTab = opts.postTab;
    if (opts.postId) state.postId = opts.postId;

    if (window.location.hash !== "#" + path) {
      history.pushState(null, "", "#" + path);
    }
    if (!opts.preserveScroll) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    render();
  }

  window.sfNavigate = navigate;

  window.addEventListener("hashchange", () => {
    const h = window.location.hash ? window.location.hash.slice(1) : "/";
    if (h !== state.route) {
      state.route = h;
      render();
    }
  });

  // Intercept internal <a> clicks so SSR templates route smoothly
  document.addEventListener("click", (e) => {
    // Close dropdowns when clicking outside
    if (state.openDropdown && !e.target.closest("[data-dropdown-root]")) {
      state.openDropdown = null;
      renderAppMainOnly();
    }

    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;
    if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
      return; // allow external links
    }
    if (href.startsWith("#") && !href.startsWith("#/")) {
      // Anchor within page
      const targetEl = document.getElementById(href.slice(1));
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }
    if (href.startsWith("#/")) {
      e.preventDefault();
      navigate(href.slice(1));
      return;
    }
    if (href.startsWith("/")) {
      e.preventDefault();
      // Map login/signup or /app links
      navigate(href);
    }
  });

  // --- Top Quick-Switcher Strip (1-Click Jump between Public Site, Screenshots 1-2 How It Works, and Screenshots 3-4 App Workspace) ---
  function renderQuickJumpBar() {
    const isApp = state.route.startsWith("/app");
    const r = state.route;
    const btnStyle = (active) =>
      `display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;border:1px solid ${
        active ? "var(--ink)" : "var(--line-strong)"
      };background:${active ? "var(--ink)" : "var(--surface)"};color:${
        active ? "var(--on-ink)" : "var(--ink)"
      };cursor:pointer;white-space:nowrap;`;

    return `
      <div id="sf-quick-jump" style="background:var(--surface-2);border-bottom:1px solid var(--line-strong);padding:5px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;z-index:60;position:relative;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);display:inline-flex;align-items:center;gap:6px;">
            <span class="sq4"><i></i><i></i><i></i><i></i></span>
            <span>SOCIAL FRAMES VIEWS:</span>
          </span>
          <button type="button" onclick="window.sfNavigate('/')" style="${btnStyle(r === "/")}">
            Home (/)
          </button>
          <button type="button" onclick="window.sfNavigate('/how-it-works')" style="${btnStyle(r === "/how-it-works")}">
            <span style="width:6px;height:6px;background:var(--cb);display:inline-block;"></span>
            How It Works (Screenshots 1–2)
          </button>
          <button type="button" onclick="window.sfNavigate('/app/post/itm_0192f1d0c7a87b5e9a0c3f6e1d2b4a01', {postTab:'transcript'})" style="${btnStyle(isApp)}">
            <span style="width:6px;height:6px;background:var(--cg);display:inline-block;"></span>
            App Workspace · @howtohoopforever (Screenshots 3–4)
          </button>
          <button type="button" onclick="window.sfNavigate('/try')" style="${btnStyle(r === "/try")}">
            Try It Free (/try)
          </button>
          <button type="button" onclick="window.sfNavigate('/pricing')" style="${btnStyle(r === "/pricing")}">
            Pricing
          </button>
          <button type="button" onclick="window.sfNavigate('/docs')" style="${btnStyle(r === "/docs")}">
            Docs &amp; API
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button type="button" id="sf-top-theme-btn" style="display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;font-family:var(--font-mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase;border:1px solid var(--line-strong);background:var(--bg);color:var(--ink);cursor:pointer;">
            <span>${state.theme === "dark" ? "☀ Light Paper" : "☾ Dark Carbon"}</span>
          </button>
        </div>
      </div>
    `;
  }

  // --- Public Marketing Header (Exact match to garfunkel.gar-ai.com + App Workspace button) ---
  function renderPublicHeader() {
    const r = state.route;
    const navLink = (path, label) => {
      const active = r === path;
      return `<a href="#${path}" class="px-2 py-1 text-[13px] transition-colors sm:px-3" style="color:${
        active ? "var(--ink)" : "var(--muted)"
      };font-weight:${active ? "600" : "400"};">${label}</a>`;
    };
    return `
      <header class="sticky top-0 z-40 border-b backdrop-blur-md" style="border-color:var(--line);background:color-mix(in oklab, var(--bg) 86%, transparent)">
        <div class="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 md:px-10">
          <div class="flex items-center gap-3">
            <a href="#/" class="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
              <span class="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] px-1.5 py-0.5" style="border:1px solid var(--line-strong);color:var(--muted)">FRAMES AI</span>
              <span class="grid grid-cols-2 gap-[1px] w-3.5 h-3.5 shrink-0" aria-hidden="true">
                <i class="block" style="background:var(--cb)"></i>
                <i class="block" style="background:var(--cg)"></i>
                <i class="block" style="background:var(--cy)"></i>
                <i class="block" style="background:var(--cr)"></i>
              </span>
              <span class="text-[15px] font-bold tracking-tight" style="color:var(--ink)">Social Frames</span>
            </a>
          </div>
          <nav aria-label="Primary" class="flex items-center gap-1 sm:gap-2">
            ${navLink("/how-it-works", "How it works")}
            ${navLink("/pricing", "Pricing")}
            ${navLink("/docs", "Docs")}
            ${navLink("/try", "Try it")}
            <a href="#/login" class="px-2 py-1 text-[13px] transition-colors sm:px-3" style="color:var(--muted)">Log in</a>
            <button type="button" onclick="window.sfNavigate('/app/post/itm_0192f1d0c7a87b5e9a0c3f6e1d2b4a01', {postTab:'transcript'})" class="ml-1 inline-flex h-8 items-center gap-2 px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em]" style="background:var(--ink);color:var(--on-ink);cursor:pointer;">
              <span style="width:6px;height:6px;background:var(--cg);display:inline-block;"></span>
              <span>App Workspace</span>
            </button>
          </nav>
        </div>
      </header>
    `;
  }

  // ============================================================================
  // AUTHENTICATED /APP WORKSPACE (Screenshots 3 & 4 + Full Multi-View App)
  // ============================================================================

  function renderAppWorkspace() {
    const subRoute = state.route.replace(/^\/app\/?/, "");
    let activeNav = "posts";
    if (subRoute.startsWith("home")) activeNav = "home";
    else if (subRoute.startsWith("new")) activeNav = "new";
    else if (subRoute.startsWith("accounts")) activeNav = "accounts";
    else if (subRoute.startsWith("chat")) activeNav = "chat";
    else if (subRoute.startsWith("credits")) activeNav = "credits";
    else if (subRoute.startsWith("invite")) activeNav = "invite";
    else if (subRoute.startsWith("settings")) activeNav = "settings";
    else if (subRoute.startsWith("post/")) {
      const id = subRoute.slice("post/".length).split("?")[0];
      if (id) state.postId = id;
      activeNav = "posts";
    } else if (subRoute === "" || subRoute === "posts") {
      // If user went to /app directly, show Post #1 detail by default (matches Screenshot 3) unless they clicked POSTS list
      activeNav = "posts";
    }

    const postsCount = getPosts().length;

    const navItem = (key, label, targetRoute, rightBadge) => {
      const isActive = activeNav === key;
      return `
        <button type="button" onclick="window.sfNavigate('${targetRoute}')"
          style="width:100%;display:flex;align-items:center;justify-content:space-between;height:34px;padding:0 16px;font-family:var(--font-mono);font-size:11px;font-weight:${
            isActive ? "600" : "500"
          };letter-spacing:0.12em;text-transform:uppercase;color:${
            isActive ? "var(--ink)" : "var(--muted)"
          };background:${
            isActive ? "var(--surface-2)" : "transparent"
          };border:none;border-left:3px solid ${
            isActive ? "var(--cb)" : "transparent"
          };cursor:pointer;text-align:left;transition:background 0.15s, color 0.15s;">
          <span>${label}</span>
          ${
            rightBadge != null
              ? `<span style="font-family:var(--font-mono);font-size:10.5px;color:${
                  isActive ? "var(--ink)" : "var(--muted)"
                };">${rightBadge}</span>`
              : ""
          }
        </button>
      `;
    };

    const balanceFormatted =
      state.balanceCents < 100
        ? `${state.balanceCents}¢`
        : `$${(state.balanceCents / 100).toFixed(2)}`;
    const postsAffordable = Math.max(0, Math.floor(state.balanceCents / 50));

    return `
      <div id="sf-app-shell" style="display:grid;grid-template-columns:205px minmax(0,1fr);min-height:calc(100dvh - 35px);background:var(--bg);color:var(--ink);">
        <!-- Left Sidebar (Exact match to Screenshot 3) -->
        <aside style="border-right:1px solid var(--line);background:var(--bg);display:flex;flex-direction:column;justify-content:space-between;position:sticky;top:0;height:calc(100dvh - 35px);user-select:none;">
          <div>
            <!-- Brand Header -->
            <div style="height:52px;padding:0 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;">
              <a href="#/" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);">
                <span class="rgby-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                <span style="font-weight:700;font-size:14.5px;letter-spacing:-0.02em;">Social Frames</span>
              </a>
            </div>

            <!-- + NEW ANALYSIS Button -->
            <div style="padding:12px;">
              <button type="button" onclick="window.sfNavigate('/app/new')"
                style="width:100%;height:36px;background:var(--ink);color:var(--on-ink);border:1px solid var(--ink);font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;">
                <span style="font-size:14px;line-height:1;">+</span>
                <span>NEW ANALYSIS</span>
              </button>
            </div>

            <!-- Primary Nav -->
            <nav aria-label="Workspace navigation" style="display:flex;flex-direction:column;gap:2px;margin-top:4px;">
              ${navItem("home", "HOME", "/app/home")}
              ${navItem("posts", "POSTS", "/app/post/" + state.postId, postsCount)}
              ${navItem("accounts", "ACCOUNTS", "/app/accounts")}
              ${navItem("chat", "CHAT", "/app/chat")}
            </nav>
          </div>

          <!-- Bottom Balance & Secondary Nav -->
          <div>
            <!-- Balance Box (Matches Screenshot 3: 50¢ BALANCE / 1 POST, COMMENTS INCLUDED) -->
            <div onclick="window.sfNavigate('/app/credits')" title="Click to manage credits"
              style="margin:0 12px 10px;padding:12px;border:1px solid var(--line);background:var(--surface);cursor:pointer;transition:border-color 0.15s;">
              <div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px;">
                <span class="figure tabular-nums" style="font-size:22px;color:var(--ink);">${balanceFormatted}</span>
                <span style="font-family:var(--font-mono);font-size:9.5px;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);">BALANCE</span>
              </div>
              <div style="margin-top:6px;font-family:var(--font-mono);font-size:9.5px;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);line-height:1.35;">
                ${postsAffordable} ${postsAffordable === 1 ? "POST" : "POSTS"}, COMMENTS INCLUDED
              </div>
            </div>

            <!-- Secondary Links -->
            <nav style="display:flex;flex-direction:column;gap:1px;padding-bottom:8px;">
              ${navItem("credits", "CREDITS", "/app/credits")}
              ${navItem("invite", "INVITE", "/app/invite")}
              ${navItem("settings", "SETTINGS", "/app/settings")}
            </nav>

            <!-- Theme & Footer Bar -->
            <div style="border-top:1px solid var(--line);padding:10px 16px;display:flex;align-items:center;justify-content:space-between;">
              <button type="button" id="sf-sidebar-theme-btn" title="Toggle theme"
                style="background:transparent;border:none;color:var(--muted);cursor:pointer;padding:4px;display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.1em;">
                <span style="font-size:13px;">${state.theme === "dark" ? "☀" : "☾"}</span>
                <span>${state.theme === "dark" ? "Light" : "Dark"}</span>
              </button>
              <a href="#/posts-list" onclick="event.preventDefault();window.sfNavigate('/app/posts-list')" style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);">
                All 18 ↗
              </a>
            </div>
          </div>
        </aside>

        <!-- Main Workspace Content Area -->
        <main id="sf-app-main" style="min-width:0;background:var(--bg);overflow-x:hidden;">
          ${renderAppMainContent(subRoute)}
        </main>
      </div>
    `;
  }

  function renderAppMainOnly() {
    const mainEl = document.getElementById("sf-app-main");
    if (!mainEl) {
      render();
      return;
    }
    const subRoute = state.route.replace(/^\/app\/?/, "");
    mainEl.innerHTML = renderAppMainContent(subRoute);
    bindAppMainEvents();
  }

  function renderAppMainContent(subRoute) {
    if (subRoute.startsWith("home")) return renderAppHomeView();
    if (subRoute.startsWith("posts-list")) return renderAppPostsListView();
    if (subRoute.startsWith("new")) return renderAppNewAnalysisView();
    if (subRoute.startsWith("accounts")) return renderAppAccountsView();
    if (subRoute.startsWith("chat")) return renderAppChatView();
    if (subRoute.startsWith("credits")) return renderAppCreditsView();
    if (subRoute.startsWith("invite")) return renderAppInviteView();
    if (subRoute.startsWith("settings")) return renderAppSettingsView();
    return renderPostDetailView();
  }

  // ============================================================================
  // POST DETAIL VIEW (Screenshots 3 & 4 — @howtohoopforever + all 18 posts)
  // ============================================================================
  function renderPostDetailView() {
    const posts = getPosts();
    const post = getCurrentPost();
    const idx = Math.max(0, posts.findIndex((p) => p.item_id === post.item_id));
    const prevPost = posts[(idx - 1 + posts.length) % posts.length];
    const nextPost = posts[(idx + 1) % posts.length];

    const platformLabel =
      post.source.platform === "instagram"
        ? "Instagram"
        : post.source.platform === "tiktok"
        ? "TikTok"
        : post.source.platform === "youtube"
        ? "YouTube"
        : "X";

    const postedDate = new Date(post.source.posted_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
    const analyzedDate = new Date(post.processed_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    const tabs = [
      { id: "overview", label: "OVERVIEW" },
      { id: "analysis", label: "ANALYSIS" },
      { id: "hook", label: "HOOK" },
      { id: "tags", label: "TAGS" },
      { id: "transcript", label: "TRANSCRIPT" },
      { id: "comments", label: "COMMENTS" },
      { id: "metrics", label: "METRICS" }
    ];

    return `
      <div>
        <!-- Top Post Header Bar (Matches Screenshot 3) -->
        <div style="min-height:52px;padding:10px 24px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-family:var(--font-mono);font-size:11.5px;color:var(--muted);">
            <button type="button" onclick="window.sfNavigate('/app/posts-list')"
              style="background:transparent;border:none;padding:0;font-family:var(--font-mono);font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);cursor:pointer;">
              POSTS
            </button>
            <span>/</span>
            <span style="color:var(--ink);font-weight:700;font-family:var(--font-sans);font-size:13px;">@${escapeHtml(post.source.author)}</span>
            <span>· ${platformLabel} · ${postedDate} · Analyzed ${analyzedDate} · ${post.credits_charged || 50}¢ charged</span>
          </div>

          <!-- Right Action Controls: DOWNLOAD, COPY, < 1 / 18 > -->
          <div style="display:flex;align-items:center;gap:8px; position:relative;" data-dropdown-root="true">
            <!-- DOWNLOAD Menu -->
            <div style="position:relative;">
              <button type="button" id="sf-btn-download"
                style="height:30px;padding:0 12px;background:var(--bg);color:var(--ink);border:1px solid var(--line-strong);font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10"/>
                </svg>
                <span>DOWNLOAD</span>
              </button>
              ${
                state.openDropdown === "download"
                  ? `
                <div style="position:absolute;right:0;top:34px;width:210px;background:var(--surface);border:1px solid var(--line-strong);z-index:80;box-shadow:0 12px 32px rgba(0,0,0,0.5);">
                  <button type="button" data-dl="json" style="width:100%;padding:9px 12px;text-align:left;background:transparent;border:none;border-bottom:1px solid var(--line);font-family:var(--font-mono);font-size:11px;color:var(--ink);cursor:pointer;display:flex;justify-content:space-between;">
                    <span>Full JSON</span><span style="color:var(--muted)">.json</span>
                  </button>
                  <button type="button" data-dl="csv" style="width:100%;padding:9px 12px;text-align:left;background:transparent;border:none;border-bottom:1px solid var(--line);font-family:var(--font-mono);font-size:11px;color:var(--ink);cursor:pointer;display:flex;justify-content:space-between;">
                    <span>Post Summary</span><span style="color:var(--muted)">.csv</span>
                  </button>
                  <button type="button" data-dl="excel" style="width:100%;padding:9px 12px;text-align:left;background:transparent;border:none;border-bottom:1px solid var(--line);font-family:var(--font-mono);font-size:11px;color:var(--ink);cursor:pointer;display:flex;justify-content:space-between;">
                    <span>Excel Export</span><span style="color:var(--muted)">.xlsx.csv</span>
                  </button>
                  <button type="button" data-dl="comments" style="width:100%;padding:9px 12px;text-align:left;background:transparent;border:none;font-family:var(--font-mono);font-size:11px;color:var(--ink);cursor:pointer;display:flex;justify-content:space-between;">
                    <span>Comments (${(post.comments_sample || []).length})</span><span style="color:var(--muted)">.csv</span>
                  </button>
                </div>`
                  : ""
              }
            </div>

            <!-- COPY Menu -->
            <div style="position:relative;">
              <button type="button" id="sf-btn-copy"
                style="height:30px;padding:0 12px;background:var(--bg);color:var(--ink);border:1px solid var(--line-strong);font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
                  <rect x="5" y="5" width="8" height="8"/><path d="M3 11V3h8"/>
                </svg>
                <span>COPY</span>
              </button>
              ${
                state.openDropdown === "copy"
                  ? `
                <div style="position:absolute;right:0;top:34px;width:210px;background:var(--surface);border:1px solid var(--line-strong);z-index:80;box-shadow:0 12px 32px rgba(0,0,0,0.5);">
                  <button type="button" data-cp="markdown" style="width:100%;padding:9px 12px;text-align:left;background:transparent;border:none;border-bottom:1px solid var(--line);font-family:var(--font-mono);font-size:11px;color:var(--ink);cursor:pointer;">
                    Copy Markdown brief
                  </button>
                  <button type="button" data-cp="json" style="width:100%;padding:9px 12px;text-align:left;background:transparent;border:none;border-bottom:1px solid var(--line);font-family:var(--font-mono);font-size:11px;color:var(--ink);cursor:pointer;">
                    Copy full JSON
                  </button>
                  <button type="button" data-cp="transcript" style="width:100%;padding:9px 12px;text-align:left;background:transparent;border:none;border-bottom:1px solid var(--line);font-family:var(--font-mono);font-size:11px;color:var(--ink);cursor:pointer;">
                    Copy transcript
                  </button>
                  <button type="button" data-cp="id" style="width:100%;padding:9px 12px;text-align:left;background:transparent;border:none;border-bottom:1px solid var(--line);font-family:var(--font-mono);font-size:11px;color:var(--ink);cursor:pointer;">
                    Copy item ID
                  </button>
                  <button type="button" data-cp="link" style="width:100%;padding:9px 12px;text-align:left;background:transparent;border:none;font-family:var(--font-mono);font-size:11px;color:var(--ink);cursor:pointer;">
                    Copy share link
                  </button>
                </div>`
                  : ""
              }
            </div>

            <!-- < 1 / 18 > Pager -->
            <div style="display:inline-flex;align-items:center;border:1px solid var(--line-strong);height:30px;">
              <button type="button" onclick="window.sfNavigate('/app/post/${prevPost.item_id}')" title="Previous post"
                style="width:28px;height:28px;background:transparent;border:none;border-right:1px solid var(--line);color:var(--ink);cursor:pointer;font-family:var(--font-mono);font-size:12px;">
                ‹
              </button>
              <span class="tabular-nums" style="padding:0 10px;font-family:var(--font-mono);font-size:11px;color:var(--muted);">
                ${idx + 1} / ${posts.length}
              </span>
              <button type="button" onclick="window.sfNavigate('/app/post/${nextPost.item_id}')" title="Next post"
                style="width:28px;height:28px;background:transparent;border:none;border-left:1px solid var(--line);color:var(--ink);cursor:pointer;font-family:var(--font-mono);font-size:12px;">
                ›
              </button>
            </div>
          </div>
        </div>

        <!-- Two-Column Post Content Grid (Left: Reel Player, Right: 7 Tabs) -->
        <div style="display:grid;grid-template-columns:340px minmax(0,1fr);min-height:calc(100dvh - 88px);">
          <!-- Left Media Column -->
          <div style="border-right:1px solid var(--line);padding:18px;background:var(--bg);">
            <div style="border:1px solid var(--line-strong);background:#080808;position:relative;overflow:hidden;">
              <!-- Instagram Header Bar inside Embed -->
              <div style="height:44px;padding:0 12px;background:#ffffff;color:#111111;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e5e5e5;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);padding:2px;display:flex;align-items:center;justify-content:center;">
                    <div style="width:100%;height:100%;border-radius:50%;background:#1b3a2b;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;">
                      ${escapeHtml(post.source.author.slice(0, 2).toUpperCase())}
                    </div>
                  </div>
                  <span style="font-size:12.5px;font-weight:600;color:#111;">${escapeHtml(post.source.author)}</span>
                  ${
                    post.source.verified
                      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="#0095f6"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.9 14.7L6 12.6l1.5-1.5 2.6 2.6 6.4-6.4 1.5 1.5-7.9 7.9z"/></svg>`
                      : ""
                  }
                </div>
                <span style="color:#444;font-weight:700;letter-spacing:1px;font-size:12px;">•••</span>
              </div>

              <!-- Interactive 9:16 Video Canvas Stage -->
              <div id="sf-player-stage" style="position:relative;aspect-ratio:9/15.2;background:#0a0e14;cursor:pointer;overflow:hidden;">
                <canvas id="sf-reel-canvas" width="320" height="540" style="width:100%;height:100%;display:block;"></canvas>

                <!-- Play/Pause Center Indicator on Pause -->
                <div id="sf-play-badge" style="position:absolute;right:12px;top:12px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.25);padding:3px 7px;font-family:var(--font-mono);font-size:10px;color:#fff;">
                  <span id="sf-timecode-display">0:02 / 0:${post.source.duration_s || 40}</span>
                </div>

                <!-- Watch on Instagram Pill -->
                <a href="${escapeHtml(post.source.url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()"
                  style="position:absolute;left:10px;bottom:12px;background:rgba(0,0,0,0.78);color:#fff;padding:6px 11px;font-size:11.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;border-radius:4px;">
                  <span>Watch on ${platformLabel}</span>
                </a>
              </div>

              <!-- Scrubber Timeline Bar -->
              <div id="sf-scrubber" style="height:6px;background:#222;position:relative;cursor:pointer;">
                <div id="sf-scrubber-fill" style="height:100%;width:8%;background:var(--cb);"></div>
              </div>

              <!-- Instagram Likes & Actions Footer -->
              <div style="background:#ffffff;color:#111111;padding:10px 12px;border-top:1px solid #efefef;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <div style="display:flex;align-items:center;gap:12px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div style="margin-top:6px;font-size:12.5px;font-weight:700;color:#111;">
                  ${formatNumber(post.source.metrics.likes)} likes
                </div>
              </div>
            </div>

            <!-- Below-Embed Link & Controls -->
            <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;font-family:var(--font-mono);font-size:11px;color:var(--muted);">
              <a href="${escapeHtml(post.source.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--muted);text-decoration:none;">
                Open on ${platformLabel} ↗
              </a>
              <button type="button" id="sf-toggle-play-btn" style="background:var(--surface);border:1px solid var(--line-strong);color:var(--ink);padding:3px 8px;font-family:var(--font-mono);font-size:10px;cursor:pointer;">
                ${state.player.playing ? "PAUSE ❚❚" : "PLAY ▶"}
              </button>
            </div>
          </div>

          <!-- Right Content Column (7 Segmented Tabs) -->
          <div style="min-width:0;display:flex;flex-direction:column;">
            <!-- Segmented Tab Bar (Exact match to Screenshot 3) -->
            <div role="tablist" style="border-bottom:1px solid var(--line);padding:0 24px;display:flex;align-items:center;gap:22px;overflow-x:auto;">
              ${tabs
                .map((t) => {
                  const active = state.postTab === t.id;
                  return `
                    <button type="button" role="tab" aria-selected="${active}"
                      data-post-tab="${t.id}"
                      style="height:46px;padding:0 2px;background:transparent;border:none;border-bottom:2px solid ${
                        active ? "var(--cb)" : "transparent"
                      };font-family:var(--font-mono);font-size:11px;font-weight:${
                        active ? "600" : "500"
                      };letter-spacing:0.12em;text-transform:uppercase;color:${
                        active ? "var(--ink)" : "var(--muted)"
                      };cursor:pointer;white-space:nowrap;transition:color 0.15s;">
                      ${t.label}
                    </button>
                  `;
                })
                .join("")}
            </div>

            <!-- Active Tab Body -->
            <div style="padding:24px;max-width:960px;">
              ${renderActivePostTab(post)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderActivePostTab(post) {
    switch (state.postTab) {
      case "overview":
        return renderTabOverview(post);
      case "analysis":
        return renderTabAnalysis(post);
      case "hook":
        return renderTabHook(post);
      case "tags":
        return renderTabTags(post);
      case "transcript":
        return renderTabTranscript(post);
      case "comments":
        return renderTabComments(post);
      case "metrics":
        return renderTabMetrics(post);
      default:
        return renderTabTranscript(post);
    }
  }

  // --- TAB 1: OVERVIEW ---
  function renderTabOverview(post) {
    const paragraphs = String(post.summary || "").split("\n\n").filter(Boolean);
    const hookScore = post.hook_analysis ? post.hook_analysis.hook_score : 8.5;
    const hookStyle = post.hook_analysis ? post.hook_analysis.hook_style : "direct_statement";
    const retention = post.hook_analysis ? post.hook_analysis.retention_prediction : "high";
    const tags = post.fixed_tags || {};
    const segmentsCount = (post.transcript && post.transcript.segments) ? post.transcript.segments.length : 0;
    const ar = post.audience_reaction || {};

    return `
      <div class="animate-rise" style="display:flex;flex-direction:column;gap:28px;">
        <!-- Caption -->
        <section>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span class="section-label">CAPTION</span>
            <span class="ev-badge observed">OBSERVED</span>
          </div>
          <div style="padding:14px 16px;border:1px solid var(--line);background:var(--surface);font-size:13.5px;line-height:1.55;color:var(--ink);">
            ${escapeHtml(post.caption)}
          </div>
        </section>

        <!-- Summary -->
        <section>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span class="section-label">SUMMARY</span>
            <span class="ev-badge observed">OBSERVED</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;font-size:14.5px;line-height:1.65;color:var(--ink);">
            ${paragraphs.map((p) => `<p style="margin:0;">${escapeHtml(p)}</p>`).join("")}
          </div>
        </section>

        <!-- Why this post was made & How the story unfolds -->
        <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">
          <div style="padding:18px;background:var(--surface);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span class="section-label">WHY THIS POST WAS MADE</span>
              <span class="ev-badge modeled">MODELED</span>
            </div>
            <p style="margin:0;font-size:13.5px;line-height:1.6;color:var(--ink);">
              ${escapeHtml(post.brief && post.brief.intent)}
            </p>
          </div>
          <div style="padding:18px;background:var(--surface);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span class="section-label">HOW THE STORY UNFOLDS</span>
              <span class="ev-badge modeled">MODELED</span>
            </div>
            <p style="margin:0;font-size:13.5px;line-height:1.6;color:var(--ink);">
              ${escapeHtml(post.brief && post.brief.narrative)}
            </p>
          </div>
        </div>

        <!-- At a Glance 4-Cell Grid (Jump to tabs) -->
        <section>
          <div style="margin-bottom:10px;">
            <span class="section-label">AT A GLANCE — CLICK ANY CARD TO INSPECT</span>
          </div>
          <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));">
            <div data-post-tab="hook" style="padding:16px;background:var(--bg);cursor:pointer;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span class="section-label"><i class="mark mark-b" style="margin-right:6px;"></i>HOOK</span>
                <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted);">OPEN →</span>
              </div>
              <div class="figure tabular-nums" style="font-size:28px;margin-top:10px;">${hookScore}<span style="font-size:14px;color:var(--muted);font-weight:500;"> / 10</span></div>
              <div style="margin-top:6px;font-family:var(--font-mono);font-size:11px;color:var(--muted);">
                ${escapeHtml(hookStyle)} · ${escapeHtml(retention)} retention
              </div>
            </div>

            <div data-post-tab="tags" style="padding:16px;background:var(--bg);cursor:pointer;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span class="section-label"><i class="mark mark-g" style="margin-right:6px;"></i>TAGS &amp; NICHE</span>
                <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted);">OPEN →</span>
              </div>
              <div style="font-size:16px;font-weight:700;margin-top:10px;text-transform:capitalize;">
                ${escapeHtml((tags.primary_niche || "sports").replace(/_/g, " "))}
              </div>
              <div style="margin-top:6px;font-family:var(--font-mono);font-size:11px;color:var(--muted);">
                ${escapeHtml(tags.format || "reel")} · ${escapeHtml(tags.brand_safety || "safe")}
              </div>
            </div>

            <div data-post-tab="transcript" style="padding:16px;background:var(--bg);cursor:pointer;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span class="section-label"><i class="mark mark-y" style="margin-right:6px;"></i>TRANSCRIPT</span>
                <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted);">OPEN →</span>
              </div>
              <div class="figure tabular-nums" style="font-size:28px;margin-top:10px;">${segmentsCount} <span style="font-size:14px;color:var(--muted);font-weight:500;">lines</span></div>
              <div style="margin-top:6px;font-family:var(--font-mono);font-size:11px;color:var(--muted);">
                Timed word-level ASR · ${escapeHtml((post.language || "en").toUpperCase())}
              </div>
            </div>

            <div data-post-tab="comments" style="padding:16px;background:var(--bg);cursor:pointer;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span class="section-label"><i class="mark mark-r" style="margin-right:6px;"></i>COMMENTS</span>
                <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted);">OPEN →</span>
              </div>
              <div class="figure tabular-nums" style="font-size:28px;margin-top:10px;">${ar.sentiment ? ar.sentiment.positive : 74}% <span style="font-size:14px;color:var(--muted);font-weight:500;">positive</span></div>
              <div style="margin-top:6px;font-family:var(--font-mono);font-size:11px;color:var(--muted);">
                ${formatNumber(post.source.metrics.comments)} comments analyzed
              </div>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  // --- TAB 2: ANALYSIS ---
  function renderTabAnalysis(post) {
    const seq = (post.brief && post.brief.sequence) || [];
    const visText = (post.brief && post.brief.visible_text) || [];
    const claims = (post.brief && post.brief.claims) || [];
    const uncertainties = (post.brief && post.brief.uncertainties) || [];
    const prod = post.production_quality || {};
    const audio = post.audio_profile || {};

    return `
      <div class="animate-rise" style="display:flex;flex-direction:column;gap:28px;">
        <!-- Beat-by-Beat Structure -->
        <section>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="section-label">BEAT-BY-BEAT STRUCTURE (${seq.length} BEATS)</span>
              <span class="ev-badge observed">OBSERVED</span>
            </div>
            <button type="button" id="sf-toggle-onscreen"
              style="height:26px;padding:0 10px;background:var(--surface);border:1px solid var(--line-strong);font-family:var(--font-mono);font-size:10px;color:var(--ink);cursor:pointer;text-transform:uppercase;letter-spacing:0.08em;">
              ${state.showOnScreenInBeats ? "Hide what's on screen" : "Show what's on screen"}
            </button>
          </div>

          <div style="border-top:1px solid var(--line);">
            ${seq
              .map((b, i) => {
                const start = b.time_range ? b.time_range.start_seconds : i * 5;
                const end = b.time_range ? b.time_range.end_seconds : (i + 1) * 5;
                return `
                  <div data-seek="${start}" style="padding:14px 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:130px minmax(0,1fr);gap:16px;cursor:pointer;">
                    <div>
                      <div style="font-family:var(--font-mono);font-size:11.5px;color:var(--ink);font-weight:600;">
                        [${formatTime(start)}–${formatTime(end)}]
                      </div>
                      <span class="tag-chip" style="margin-top:6px;font-size:10px;text-transform:uppercase;color:var(--muted);">
                        ${escapeHtml(b.role_in_carousel || "beat")}
                      </span>
                    </div>
                    <div>
                      <div style="font-size:13.5px;line-height:1.55;color:var(--ink);font-weight:500;">
                        ${escapeHtml(b.claim_or_message)}
                      </div>
                      ${
                        state.showOnScreenInBeats && b.visual_observation
                          ? `<div style="margin-top:6px;font-family:var(--font-mono);font-size:11.5px;line-height:1.5;color:var(--muted);">
                              On screen: ${escapeHtml(b.visual_observation)}
                            </div>`
                          : ""
                      }
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </section>

        <!-- Text on Screen -->
        <section>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span class="section-label">TEXT ON SCREEN (OCR)</span>
            <span class="ev-badge observed">OBSERVED</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${visText
              .map((t) => `<span class="tag-chip" style="font-size:12px;padding:4px 10px;">"${escapeHtml(t)}"</span>`)
              .join("")}
          </div>
        </section>

        <!-- Claims & What's Unclear -->
        <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">
          <div style="padding:18px;background:var(--surface);">
            <div style="margin-bottom:10px;"><span class="section-label">CLAIMS MADE</span></div>
            <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:13px;line-height:1.55;">
              ${claims.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
            </ul>
          </div>
          <div style="padding:18px;background:var(--surface);">
            <div style="margin-bottom:10px;"><span class="section-label">WHAT'S UNCLEAR / UNSTATED</span></div>
            <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:13px;line-height:1.55;color:var(--muted);">
              ${uncertainties.map((u) => `<li>${escapeHtml(u)}</li>`).join("")}
            </ul>
          </div>
        </div>

        <!-- Production & Audio -->
        <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">
          <div style="padding:18px;background:var(--bg);">
            <div style="margin-bottom:12px;"><span class="section-label">PRODUCTION</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-family:var(--font-mono);font-size:11.5px;">
              <div><span style="color:var(--muted);">Visual score:</span> <strong>${prod.visual_score || "8.2"}/10</strong></div>
              <div><span style="color:var(--muted);">Lighting:</span> ${escapeHtml(prod.lighting || "natural_daylight")}</div>
              <div><span style="color:var(--muted);">Camera:</span> ${escapeHtml(prod.camera_motion || "handheld")}</div>
              <div><span style="color:var(--muted);">Editing:</span> ${escapeHtml(prod.editing_rhythm || "fast_cut_montage")}</div>
              <div><span style="color:var(--muted);">Text density:</span> ${escapeHtml(prod.text_density || "moderate")}</div>
              <div><span style="color:var(--muted);">Aspect:</span> ${escapeHtml(prod.aspect_ratio || "9:16")}</div>
            </div>
          </div>
          <div style="padding:18px;background:var(--bg);">
            <div style="margin-bottom:12px;"><span class="section-label">AUDIO &amp; VOICE</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-family:var(--font-mono);font-size:11.5px;">
              <div><span style="color:var(--muted);">Speech:</span> ${escapeHtml(audio.speech_presence || "voiceover_dominant")}</div>
              <div><span style="color:var(--muted);">Pace:</span> ${audio.speaking_rate_wpm || 178} WPM</div>
              <div><span style="color:var(--muted);">Music role:</span> ${escapeHtml(audio.music_role || "background_bed")}</div>
              <div><span style="color:var(--muted);">Vocal tone:</span> ${escapeHtml(audio.vocal_energy || "deadpan_humorous")}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- TAB 3: HOOK ---
  function renderTabHook(post) {
    const h = post.hook_analysis || {};
    const temp = post.temporal_analytics || {};
    const pacing = temp.pacing || {};
    const cuts = temp.shot_cuts || [];
    const totalDur = post.source.duration_s || 40;

    return `
      <div class="animate-rise" style="display:flex;flex-direction:column;gap:28px;">
        <!-- The Opening Score Card -->
        <div style="border:1px solid var(--line-strong);background:var(--surface);padding:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--line);padding-bottom:16px;">
            <div>
              <span class="section-label"><i class="mark mark-b" style="margin-right:6px;"></i>THE OPENING (0:00–0:03)</span>
              <div style="margin-top:6px;font-size:18px;font-weight:700;">
                ${escapeHtml((h.hook_style || "confession_punchline").replace(/_/g, " ").toUpperCase())}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:16px;">
              <span class="tag-chip" style="border-color:var(--cg-mark);color:var(--cg-text);font-weight:700;text-transform:uppercase;">
                ${escapeHtml(h.retention_prediction || "high")} retention
              </span>
              <div class="figure tabular-nums" style="font-size:36px;">
                ${h.hook_score || 8.8}<span style="font-size:15px;color:var(--muted);font-weight:500;">/10</span>
              </div>
            </div>
          </div>

          <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:16px;">
            <div style="padding:14px;background:var(--bg);">
              <div class="section-label" style="margin-bottom:6px;">FIRST WORDS</div>
              <div style="font-size:14px;font-weight:600;line-height:1.5;">"${escapeHtml(h.opening_line || "")}"</div>
            </div>
            <div style="padding:14px;background:var(--bg);">
              <div class="section-label" style="margin-bottom:6px;">FIRST FRAME</div>
              <div style="font-size:13px;line-height:1.5;color:var(--ink);">${escapeHtml(h.visual_hook || "")}</div>
            </div>
            <div style="padding:14px;background:var(--bg);">
              <div class="section-label" style="margin-bottom:6px;">WHY IT HOLDS ATTENTION</div>
              <div style="font-size:13px;line-height:1.5;color:var(--ink);">${escapeHtml(h.why_it_works || "")}</div>
            </div>
          </div>
        </div>

        <!-- Promise vs Payoff -->
        <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">
          <div style="padding:18px;background:var(--surface);">
            <div class="section-label" style="margin-bottom:8px;">THE PROMISE (SETUP)</div>
            <p style="margin:0;font-size:13.5px;line-height:1.6;">${escapeHtml(h.promise || "")}</p>
          </div>
          <div style="padding:18px;background:var(--surface);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span class="section-label">THE PAYOFF (DELIVERY)</span>
              <span class="tag-chip" style="color:var(--cg-text);font-size:10px;">DELIVERED · ${formatTime(h.payoff_Second || 31)}</span>
            </div>
            <p style="margin:0;font-size:13.5px;line-height:1.6;">${escapeHtml(h.payoff || "")}</p>
          </div>
        </div>

        <!-- Pacing & Shot Cuts -->
        <section>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <span class="section-label">PACING &amp; SHOT CUT TIMELINE (CLICK ANY SHOT TO SEEK)</span>
            <span class="ev-badge observed">OBSERVED</span>
          </div>
          <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(4,1fr);margin-bottom:14px;">
            <div style="padding:12px;background:var(--surface);">
              <div class="section-label">TOTAL CUTS</div>
              <div class="figure tabular-nums" style="font-size:22px;margin-top:4px;">${pacing.total_cuts || 28}</div>
            </div>
            <div style="padding:12px;background:var(--surface);">
              <div class="section-label">CUTS / MIN</div>
              <div class="figure tabular-nums" style="font-size:22px;margin-top:4px;">${pacing.cuts_per_minute || 42}</div>
            </div>
            <div style="padding:12px;background:var(--surface);">
              <div class="section-label">AVG SHOT</div>
              <div class="figure tabular-nums" style="font-size:22px;margin-top:4px;">${pacing.avg_shot_length_s || 1.4}s</div>
            </div>
            <div style="padding:12px;background:var(--surface);">
              <div class="section-label">RHYTHM CURVE</div>
              <div style="font-family:var(--font-mono);font-size:12px;font-weight:600;margin-top:6px;">${escapeHtml(pacing.rhythm_curve || "accelerating")}</div>
            </div>
          </div>

          <!-- Proportional Shot Bar -->
          <div style="display:flex;height:28px;border:1px solid var(--line-strong);overflow:hidden;background:var(--surface);">
            ${cuts
              .map((c, idx) => {
                const dur = Math.max(1, (c.end_s || 4) - (c.start_s || 0));
                const pct = (dur / totalDur) * 100;
                const colors = ["var(--cb)", "var(--cg)", "var(--cy)", "var(--cr)"];
                const col = colors[idx % colors.length];
                return `<div data-seek="${c.start_s || 0}" title="Shot ${c.shot || idx + 1} (${formatTime(c.start_s)}–${formatTime(c.end_s)}): ${escapeHtml(c.label || "")}"
                  style="width:${pct}%;background:${col};opacity:0.82;border-right:1px solid var(--bg);cursor:pointer;transition:opacity 0.15s;"></div>`;
              })
              .join("")}
          </div>
        </section>
      </div>
    `;
  }

  // --- TAB 4: TAGS ---
  function renderTabTags(post) {
    const ft = post.fixed_tags || {};
    const subjects = post.subjects || [];
    const meme = post.meme_analysis || {};
    const cult = post.cultural_signals || {};

    const renderChipGroup = (title, items) => `
      <div style="padding:16px;background:var(--surface);">
        <div class="section-label" style="margin-bottom:10px;">${title}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${(items || []).map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("")}
        </div>
      </div>
    `;

    return `
      <div class="animate-rise" style="display:flex;flex-direction:column;gap:28px;">
        <!-- Fixed Classification Grid -->
        <section>
          <div style="margin-bottom:10px;"><span class="section-label">PRIMARY CLASSIFICATION (FIXED TAXONOMY)</span></div>
          <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));">
            <div style="padding:14px;background:var(--surface);">
              <div class="section-label">FORMAT</div>
              <div style="font-family:var(--font-mono);font-size:13px;font-weight:600;margin-top:6px;">${escapeHtml(ft.format || "storytime_montage")}</div>
            </div>
            <div style="padding:14px;background:var(--surface);">
              <div class="section-label">PRIMARY NICHE</div>
              <div style="font-family:var(--font-mono);font-size:13px;font-weight:600;margin-top:6px;">${escapeHtml(ft.primary_niche || "basketball")}</div>
            </div>
            <div style="padding:14px;background:var(--surface);">
              <div class="section-label">CONTENT STYLE</div>
              <div style="font-family:var(--font-mono);font-size:13px;font-weight:600;margin-top:6px;">${escapeHtml(ft.content_style || "self_deprecating_recap")}</div>
            </div>
            <div style="padding:14px;background:var(--surface);">
              <div class="section-label">BRAND SAFETY</div>
              <div style="font-family:var(--font-mono);font-size:13px;font-weight:600;margin-top:6px;color:var(--cg-text);">${escapeHtml(ft.brand_safety || "safe")}</div>
            </div>
            <div style="padding:14px;background:var(--surface);">
              <div class="section-label">COMMERCIAL INTENT</div>
              <div style="font-family:var(--font-mono);font-size:13px;font-weight:600;margin-top:6px;">${escapeHtml(ft.commercial_intent || "organic")}</div>
            </div>
          </div>
        </section>

        <!-- Tag Vocabulary Groups -->
        <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));">
          ${renderChipGroup("TOPICS", ft.topics)}
          ${renderChipGroup("VISUAL ELEMENTS", ft.visual_elements)}
          ${renderChipGroup("EMOTIONS & TONE", ft.emotions_and_tone)}
          ${renderChipGroup("NAMED ENTITIES", ft.entities)}
        </div>

        <!-- Subjects on Screen -->
        ${
          subjects.length
            ? `
          <section>
            <div style="margin-bottom:10px;"><span class="section-label">SUBJECTS ON SCREEN</span></div>
            <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
              ${subjects
                .map(
                  (s) => `
                <div style="padding:14px;background:var(--bg);">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <strong style="font-size:13.5px;">${escapeHtml(s.label)}</strong>
                    <span class="tag-chip" style="font-size:10px;">${escapeHtml(s.screen_time_pct || 25)}% screen</span>
                  </div>
                  <div style="margin-top:6px;font-size:12.5px;color:var(--muted);line-height:1.45;">
                    ${escapeHtml(s.description || "")}
                  </div>
                </div>`
                )
                .join("")}
            </div>
          </section>`
            : ""
        }

        <!-- Meme Check & Cultural Signals -->
        <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">
          <div style="padding:18px;background:var(--surface);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span class="section-label">MEME &amp; FORMAT CHECK</span>
              <span class="ev-badge modeled">MODELED</span>
            </div>
            <div style="font-size:14px;font-weight:700;margin-bottom:6px;">
              ${escapeHtml(meme.meme_template || "Rec-League Reality Check")}
            </div>
            <p style="margin:0;font-size:13px;line-height:1.55;color:var(--muted);">
              ${escapeHtml(meme.why_it_resonates || "")}
            </p>
          </div>
          <div style="padding:18px;background:var(--surface);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span class="section-label">CULTURAL SIGNALS</span>
              <span class="ev-badge modeled">MODELED</span>
            </div>
            <div style="font-size:14px;font-weight:700;margin-bottom:6px;">
              ${escapeHtml(cult.subculture || "Hoops Creator Community")}
            </div>
            <p style="margin:0;font-size:13px;line-height:1.55;color:var(--muted);">
              Register: ${escapeHtml(cult.register || "Deadpan self-deprecation")} · Irony: ${escapeHtml(cult.irony_level || "moderate")}
            </p>
          </div>
        </div>
      </div>
    `;
  }

  // --- TAB 5: TRANSCRIPT (Exact match to Screenshot 3!) ---
  function renderTabTranscript(post) {
    const segments = (post.transcript && post.transcript.segments) || [];
    const q = state.transcriptSearch.trim().toLowerCase();
    const filtered = q
      ? segments.filter((s) => String(s.text || "").toLowerCase().includes(q))
      : segments;

    return `
      <div class="animate-rise">
        <!-- Exact Timed Transcript List (Matches Screenshot 3 pixel-for-pixel) -->
        <div style="border-top:1px solid var(--line);">
          ${filtered
            .map((seg) => {
              const start = Number(seg.start_s) || 0;
              const end = Number(seg.end_s) || start + 2;
              const isCurrent =
                state.player.currentTime >= start && state.player.currentTime < end;
              return `
                <div data-seek="${start}"
                  style="display:grid;grid-template-columns:115px minmax(0,1fr);align-items:baseline;padding:13px 0;border-bottom:1px solid var(--line);cursor:pointer;background:${
                    isCurrent ? "color-mix(in oklab, var(--cb) 10%, transparent)" : "transparent"
                  };transition:background 0.15s;">
                  <span class="tabular-nums" style="font-family:var(--font-mono);font-size:11.5px;color:${
                    isCurrent ? "var(--ink)" : "var(--muted)"
                  };">
                    [${formatTime(start)}–${formatTime(end)}]
                  </span>
                  <span style="font-size:13.5px;line-height:1.5;color:var(--ink);">
                    ${escapeHtml(seg.text)}
                  </span>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  // --- TAB 6: COMMENTS ---
  function renderTabComments(post) {
    const ar = post.audience_reaction || {};
    const sent = ar.sentiment || { positive: 74, neutral: 18, negative: 8 };
    const comments = (post.comments_sample || []).slice();

    const filtered = comments
      .filter((c) => {
        if (state.commentFilter !== "all" && c.sentiment !== state.commentFilter) return false;
        if (state.commentSearch.trim()) {
          const q = state.commentSearch.trim().toLowerCase();
          return (
            String(c.text || "").toLowerCase().includes(q) ||
            String(c.author || "").toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => (state.commentSort === "likes" ? (b.likes || 0) - (a.likes || 0) : 0));

    return `
      <div class="animate-rise" style="display:flex;flex-direction:column;gap:26px;">
        <!-- Audience Summary & Sentiment Bar -->
        <div style="border:1px solid var(--line);background:var(--surface);padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="section-label">AUDIENCE REACTION SUMMARY (${formatNumber(post.source.metrics.comments)} COMMENTS)</span>
            <span class="ev-badge modeled">MODELED</span>
          </div>
          <p style="margin:0 0 16px;font-size:13.5px;line-height:1.6;">
            ${escapeHtml(ar.summary || "")}
          </p>

          <!-- Stacked Sentiment Bar -->
          <div style="margin-bottom:6px;display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:11px;">
            <span style="color:var(--cg-text);">POSITIVE ${sent.positive}%</span>
            <span style="color:var(--muted);">NEUTRAL ${sent.neutral}%</span>
            <span style="color:var(--cr-text);">NEGATIVE ${sent.negative}%</span>
          </div>
          <div style="display:flex;height:10px;overflow:hidden;border:1px solid var(--line-strong);">
            <div style="width:${sent.positive}%;background:var(--cg);"></div>
            <div style="width:${sent.neutral}%;background:var(--muted);opacity:0.45;"></div>
            <div style="width:${sent.negative}%;background:var(--cr);"></div>
          </div>
        </div>

        <!-- Most-Discussed Moment -->
        ${
          ar.most_discussed_moment
            ? `
          <div data-seek="${ar.most_discussed_moment.start_s || 31}" style="border:1px solid var(--line-strong);background:var(--bg);padding:16px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:16px;">
            <div>
              <div class="section-label"><i class="mark mark-y" style="margin-right:6px;"></i>MOST-DISCUSSED MOMENT IN COMMENTS</div>
              <div style="margin-top:6px;font-size:14px;font-weight:600;">
                [${formatTime(ar.most_discussed_moment.start_s || 31)}–${formatTime(ar.most_discussed_moment.end_s || 37)}] ${escapeHtml(ar.most_discussed_moment.description || "")}
              </div>
            </div>
            <span style="font-family:var(--font-mono);font-size:10.5px;color:var(--cb);white-space:nowrap;">JUMP TO MOMENT →</span>
          </div>`
            : ""
        }

        <!-- Recurring Themes & Top Requests -->
        <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">
          <div style="padding:16px;background:var(--surface);">
            <div class="section-label" style="margin-bottom:10px;">WHAT PEOPLE KEEP SAYING</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${(ar.themes || [])
                .map(
                  (t) => `
                <div style="display:flex;justify-content:space-between;font-size:13px;">
                  <span>${escapeHtml(t.theme)}</span>
                  <span style="font-family:var(--font-mono);font-size:11px;color:var(--muted);">${t.share_pct}%</span>
                </div>`
                )
                .join("")}
            </div>
          </div>
          <div style="padding:16px;background:var(--surface);">
            <div class="section-label" style="margin-bottom:10px;">QUESTIONS &amp; REQUESTS</div>
            <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:13px;">
              ${(ar.questions_and_requests || []).map((q) => `<li>${escapeHtml(q)}</li>`).join("")}
            </ul>
          </div>
        </div>

        <!-- Individual Comments Table -->
        <section>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
            <span class="section-label">INDIVIDUAL COMMENTS (${filtered.length})</span>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              ${["all", "positive", "neutral", "negative"]
                .map(
                  (f) => `
                <button type="button" data-comment-filter="${f}"
                  style="height:26px;padding:0 9px;font-family:var(--font-mono);font-size:10px;text-transform:uppercase;border:1px solid ${
                    state.commentFilter === f ? "var(--ink)" : "var(--line)"
                  };background:${
                    state.commentFilter === f ? "var(--ink)" : "var(--surface)"
                  };color:${state.commentFilter === f ? "var(--on-ink)" : "var(--ink)"};cursor:pointer;">
                  ${f}
                </button>`
                )
                .join("")}
            </div>
          </div>

          <div style="border-top:1px solid var(--line);">
            ${filtered
              .map(
                (c) => `
              <div style="padding:12px 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:140px minmax(0,1fr) 80px;gap:12px;align-items:baseline;">
                <span style="font-family:var(--font-mono);font-size:11.5px;font-weight:600;color:var(--ink);">@${escapeHtml(c.author)}</span>
                <span style="font-size:13.5px;line-height:1.5;color:var(--ink);">${escapeHtml(c.text)}</span>
                <span class="tabular-nums" style="font-family:var(--font-mono);font-size:11px;color:var(--muted);text-align:right;">
                  ♥ ${formatNumber(c.likes)}
                </span>
              </div>`
              )
              .join("")}
          </div>
        </section>
      </div>
    `;
  }

  // --- TAB 7: METRICS ---
  function renderTabMetrics(post) {
    const m = post.source.metrics || {};
    const history = post.metrics_history || [
      { recorded_at: "Oct 05, 2026", views: Math.round((m.views || 10000) * 0.42), likes: Math.round((m.likes || 500) * 0.45), comments: Math.round((m.comments || 40) * 0.5), shares: Math.round((m.shares || 100) * 0.4), saves: Math.round((m.saves || 200) * 0.44) },
      { recorded_at: "Oct 08, 2026", views: Math.round((m.views || 10000) * 0.68), likes: Math.round((m.likes || 500) * 0.72), comments: Math.round((m.comments || 40) * 0.76), shares: Math.round((m.shares || 100) * 0.7), saves: Math.round((m.saves || 200) * 0.71) },
      { recorded_at: "Oct 12, 2026", views: Math.round((m.views || 10000) * 0.89), likes: Math.round((m.likes || 500) * 0.91), comments: Math.round((m.comments || 40) * 0.92), shares: Math.round((m.shares || 100) * 0.88), saves: Math.round((m.saves || 200) * 0.9) },
      { recorded_at: "Oct 15, 2026", views: m.views || 142800, likes: m.likes || 678, comments: m.comments || 54, shares: m.shares || 184, saves: m.saves || 312 }
    ];

    const cards = [
      { key: "views", label: "VIEWS", val: m.views, color: "var(--cb)" },
      { key: "likes", label: "LIKES", val: m.likes, color: "var(--cg)" },
      { key: "comments", label: "COMMENTS", val: m.comments, color: "var(--cy)" },
      { key: "shares", label: "SHARES", val: m.shares, color: "var(--cr)" },
      { key: "saves", label: "SAVES", val: m.saves, color: "var(--cb)" }
    ];

    return `
      <div class="animate-rise" style="display:flex;flex-direction:column;gap:28px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <span class="section-label">PERFORMANCE SNAPSHOTS (${history.length} RECORDED)</span>
            <div style="margin-top:4px;font-size:13px;color:var(--muted);">
              Refresh metrics anytime for 1¢ to append a new timestamped snapshot.
            </div>
          </div>
          <button type="button" id="sf-refresh-metrics-btn"
            style="height:34px;padding:0 14px;background:var(--ink);color:var(--on-ink);border:1px solid var(--ink);font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;">
            ↻ Refresh metrics · 1¢
          </button>
        </div>

        <!-- 5 Metric Cards with Sparklines -->
        <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));">
          ${cards
            .map((c) => {
              const vals = history.map((h) => Number(h[c.key]) || 0);
              const min = Math.min(...vals);
              const max = Math.max(...vals, min + 1);
              const pts = vals
                .map((v, i) => {
                  const x = (i / Math.max(1, vals.length - 1)) * 120;
                  const y = 32 - ((v - min) / (max - min)) * 26;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(" ");
              return `
                <div style="padding:16px;background:var(--surface);">
                  <div class="section-label">${c.label}</div>
                  <div class="figure tabular-nums" style="font-size:26px;margin-top:8px;">${formatNumber(c.val)}</div>
                  <svg width="120" height="36" viewBox="0 0 120 36" style="margin-top:10px;overflow:visible;">
                    <polyline fill="none" stroke="${c.color}" stroke-width="2" points="${pts}"/>
                  </svg>
                </div>
              `;
            })
            .join("")}
        </div>

        <!-- Snapshot History Table -->
        <section>
          <div class="section-label" style="margin-bottom:10px;">SNAPSHOT LOG</div>
          <div style="border:1px solid var(--line);overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px;">
              <thead>
                <tr style="border-bottom:1px solid var(--line);background:var(--surface);text-align:left;color:var(--muted);">
                  <th style="padding:10px 12px;">TIMESTAMP</th>
                  <th style="padding:10px 12px;">VIEWS</th>
                  <th style="padding:10px 12px;">LIKES</th>
                  <th style="padding:10px 12px;">COMMENTS</th>
                  <th style="padding:10px 12px;">SHARES</th>
                  <th style="padding:10px 12px;">SAVES</th>
                </tr>
              </thead>
              <tbody>
                ${history
                  .slice()
                  .reverse()
                  .map(
                    (h) => `
                  <tr style="border-bottom:1px solid var(--line);">
                    <td style="padding:10px 12px;color:var(--ink);">${escapeHtml(h.recorded_at)}</td>
                    <td style="padding:10px 12px;">${formatNumber(h.views)}</td>
                    <td style="padding:10px 12px;">${formatNumber(h.likes)}</td>
                    <td style="padding:10px 12px;">${formatNumber(h.comments)}</td>
                    <td style="padding:10px 12px;">${formatNumber(h.shares)}</td>
                    <td style="padding:10px 12px;">${formatNumber(h.saves)}</td>
                  </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }

  // ============================================================================
  // OTHER WORKSPACE VIEWS (/app/home, /app/posts-list, /app/new, /app/accounts, /app/chat, /app/credits, /app/invite, /app/settings)
  // ============================================================================

  function renderAppHomeView() {
    const posts = getPosts();
    return `
      <div style="padding:28px;max-width:1160px;" class="animate-rise">
        <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px;">
          <div>
            <div class="kicker"><span class="sq4"><i></i><i></i><i></i><i></i></span> WORKSPACE OVERVIEW</div>
            <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.03em;margin:8px 0 0;">Social Frames Library</h1>
          </div>
          <button type="button" onclick="window.sfNavigate('/app/new')" class="btn btn-primary">
            + Analyze a Post · 50¢
          </button>
        </div>

        <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-bottom:28px;">
          <div style="padding:18px;background:var(--surface);">
            <div class="section-label">ANALYZED POSTS</div>
            <div class="figure tabular-nums" style="font-size:32px;margin-top:8px;">${posts.length}</div>
            <div style="margin-top:6px;font-family:var(--font-mono);font-size:11px;color:var(--muted);">Instagram, TikTok, YouTube, X</div>
          </div>
          <div style="padding:18px;background:var(--surface);">
            <div class="section-label">TIMED TRANSCRIPT LINES</div>
            <div class="figure tabular-nums" style="font-size:32px;margin-top:8px;">248</div>
            <div style="margin-top:6px;font-family:var(--font-mono);font-size:11px;color:var(--muted);">Word-aligned via Qwen3-ASR-0.6B</div>
          </div>
          <div style="padding:18px;background:var(--surface);">
            <div class="section-label">COMMENTS SYNTHESIZED</div>
            <div class="figure tabular-nums" style="font-size:32px;margin-top:8px;">3,420</div>
            <div style="margin-top:6px;font-family:var(--font-mono);font-size:11px;color:var(--muted);">Sentiment, stance &amp; requests</div>
          </div>
          <div style="padding:18px;background:var(--surface);">
            <div class="section-label">REMAINING BALANCE</div>
            <div class="figure tabular-nums" style="font-size:32px;margin-top:8px;">${state.balanceCents}¢</div>
            <div style="margin-top:6px;font-family:var(--font-mono);font-size:11px;color:var(--muted);">50¢ per post (comments included)</div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span class="section-label">RECENTLY ANALYZED POSTS (CLICK TO OPEN FULL 7-TAB REPORT)</span>
          <button type="button" onclick="window.sfNavigate('/app/posts-list')" style="background:transparent;border:none;font-family:var(--font-mono);font-size:11px;color:var(--cb);cursor:pointer;">
            VIEW ALL ${posts.length} POSTS →
          </button>
        </div>
        ${renderPostsTable(posts.slice(0, 8))}
      </div>
    `;
  }

  function renderAppPostsListView() {
    const posts = getPosts();
    const q = state.postsSearch.trim().toLowerCase();
    const filtered = posts.filter((p) => {
      if (state.postsPlatformFilter !== "all" && p.source.platform !== state.postsPlatformFilter) return false;
      if (!q) return true;
      return (
        p.source.author.toLowerCase().includes(q) ||
        String(p.caption || "").toLowerCase().includes(q) ||
        String(p.summary || "").toLowerCase().includes(q)
      );
    });

    return `
      <div style="padding:28px;max-width:1200px;" class="animate-rise">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
          <div>
            <div class="section-label">LIBRARY</div>
            <h1 style="font-size:24px;font-weight:800;margin:4px 0 0;">All Analyzed Posts (${filtered.length})</h1>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <input type="search" id="sf-posts-search" value="${escapeHtml(state.postsSearch)}" placeholder="Search @handle, caption, tags..."
              style="height:34px;padding:0 12px;background:var(--surface);border:1px solid var(--line-strong);font-family:var(--font-mono);font-size:11.5px;width:240px;"/>
            ${["all", "instagram", "tiktok", "youtube", "x"]
              .map(
                (pl) => `
              <button type="button" data-plat-filter="${pl}"
                style="height:34px;padding:0 10px;font-family:var(--font-mono);font-size:10.5px;text-transform:uppercase;border:1px solid ${
                  state.postsPlatformFilter === pl ? "var(--ink)" : "var(--line)"
                };background:${
                  state.postsPlatformFilter === pl ? "var(--ink)" : "var(--surface)"
                };color:${state.postsPlatformFilter === pl ? "var(--on-ink)" : "var(--ink)"};cursor:pointer;">
                ${pl}
              </button>`
              )
              .join("")}
          </div>
        </div>
        ${renderPostsTable(filtered)}
      </div>
    `;
  }

  function renderPostsTable(posts) {
    return `
      <div style="border:1px solid var(--line);overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid var(--line);background:var(--surface);font-family:var(--font-mono);font-size:10.5px;color:var(--muted);text-align:left;">
              <th style="padding:10px 14px;">CREATOR</th>
              <th style="padding:10px 14px;">PLATFORM</th>
              <th style="padding:10px 14px;">CAPTION / SUMMARY</th>
              <th style="padding:10px 14px;">HOOK</th>
              <th style="padding:10px 14px;">VIEWS</th>
              <th style="padding:10px 14px;">LIKES</th>
              <th style="padding:10px 14px;">ANALYZED</th>
            </tr>
          </thead>
          <tbody>
            ${posts
              .map(
                (p) => `
              <tr onclick="window.sfNavigate('/app/post/${p.item_id}')"
                style="border-bottom:1px solid var(--line);cursor:pointer;background:${
                  p.item_id === state.postId ? "var(--surface-2)" : "transparent"
                };transition:background 0.15s;">
                <td style="padding:12px 14px;font-weight:700;white-space:nowrap;">@${escapeHtml(p.source.author)}</td>
                <td style="padding:12px 14px;font-family:var(--font-mono);font-size:11px;text-transform:uppercase;color:var(--muted);">${escapeHtml(p.source.platform)}</td>
                <td style="padding:12px 14px;max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink);">
                  ${escapeHtml(p.caption)}
                </td>
                <td style="padding:12px 14px;font-family:var(--font-mono);font-weight:700;">
                  ${p.hook_analysis ? p.hook_analysis.hook_score : "8.6"}/10
                </td>
                <td style="padding:12px 14px;font-family:var(--font-mono);">${formatNumber(p.source.metrics.views)}</td>
                <td style="padding:12px 14px;font-family:var(--font-mono);">${formatNumber(p.source.metrics.likes)}</td>
                <td style="padding:12px 14px;font-family:var(--font-mono);font-size:11px;color:var(--muted);white-space:nowrap;">
                  ${new Date(p.processed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAppNewAnalysisView() {
    const steps = [
      "01 Getting the post & metadata",
      "02 Splitting the video into scenes",
      "03 Transcribing audio (Qwen3-ASR-0.6B)",
      "04 Choosing peak frames (CLIP ViT-B/32)",
      "05 Summarizing post (gpt-6.1-sol)",
      "06 Finding the hook & shot cuts",
      "07 Tagging & cultural signals (gpt-6-luna)",
      "08 Reading & synthesizing comments"
    ];

    return `
      <div style="padding:28px;max-width:820px;" class="animate-rise">
        <div class="kicker"><span class="sq4"><i></i><i></i><i></i><i></i></span> NEW ANALYSIS JOB</div>
        <h1 style="font-size:26px;font-weight:800;margin:8px 0 6px;">Analyze a Social Video or Post</h1>
        <p style="margin:0 0 22px;color:var(--muted);font-size:14px;">
          Paste any Instagram, TikTok, YouTube, or X URL—or upload a raw video file. Flat rate: <strong>50¢ per post, comments included</strong>.
        </p>

        <div style="border:1px solid var(--line-strong);background:var(--surface);padding:20px;">
          <label class="section-label" style="display:block;margin-bottom:8px;">POST URL OR SOCIAL LINK</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input type="url" id="sf-new-url-input" value="${escapeHtml(state.newAnalysis.url)}"
              placeholder="https://www.instagram.com/reel/..."
              style="flex:1;min-width:260px;height:42px;padding:0 14px;background:var(--bg);border:1px solid var(--line-strong);font-family:var(--font-mono);font-size:12.5px;"/>
            <button type="button" id="sf-run-analysis-btn" class="btn btn-primary" style="height:42px;padding:0 20px;">
              ${state.newAnalysis.running ? "ANALYZING..." : "RUN 8-STEP PIPELINE · 50¢"}
            </button>
          </div>

          <div style="margin-top:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-family:var(--font-mono);font-size:11px;color:var(--muted);">
            <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" checked />
              <span>Include up to 200 top comments (included in 50¢)</span>
            </label>
            <span>Models: Qwen3-ASR-0.6B · gpt-6.1-sol · gpt-6-luna</span>
          </div>

          ${
            state.newAnalysis.running
              ? `
            <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px;">
              <div class="section-label" style="margin-bottom:10px;">LIVE PIPELINE PROGRESS</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
                ${steps
                  .map((s, idx) => {
                    const done = idx < state.newAnalysis.stepIndex;
                    const active = idx === state.newAnalysis.stepIndex;
                    return `
                      <div style="padding:10px 12px;border:1px solid ${
                        active ? "var(--cb)" : "var(--line)"
                      };background:${done ? "var(--surface-2)" : "var(--bg)"};font-family:var(--font-mono);font-size:11px;display:flex;align-items:center;justify-content:space-between;">
                        <span>${s}</span>
                        <span style="color:${done ? "var(--cg-text)" : active ? "var(--cb)" : "var(--muted)"};">
                          ${done ? "✓" : active ? "●" : "·"}
                        </span>
                      </div>`;
                  })
                  .join("")}
              </div>
            </div>`
              : ""
          }
        </div>
      </div>
    `;
  }

  function renderAppAccountsView() {
    const accounts = window.SF_ACCOUNTS || [];
    const posts = getPosts();
    return `
      <div style="padding:28px;max-width:1140px;" class="animate-rise">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <div class="section-label">CREATOR ACCOUNTS</div>
            <h1 style="font-size:24px;font-weight:800;margin:4px 0 0;">Tracked Social Accounts (${accounts.length})</h1>
          </div>
          <button type="button" onclick="window.sfNavigate('/app/new')" class="btn btn-primary">+ Pull Account Posts</button>
        </div>

        <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-bottom:28px;">
          ${accounts
            .map(
              (a) => `
            <div style="padding:18px;background:var(--surface);">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="font-size:15px;">@${escapeHtml(a.handle)}</strong>
                <span class="tag-chip" style="text-transform:uppercase;font-size:10px;">${escapeHtml(a.platform)}</span>
              </div>
              <div style="margin-top:4px;font-size:12.5px;color:var(--muted);">${escapeHtml(a.display_name)} · ${formatNumber(a.followers)} followers</div>
              <div style="margin-top:14px;display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:11px;">
                <span>Analyzed: <strong>${a.analyzed_count}</strong></span>
                <span>Avg Hook: <strong>${a.avg_hook_score}/10</strong></span>
              </div>
            </div>`
            )
            .join("")}
        </div>

        <div class="section-label" style="margin-bottom:10px;">POSTS ACROSS TRACKED ACCOUNTS</div>
        ${renderPostsTable(posts.slice(0, 10))}
      </div>
    `;
  }

  function renderAppChatView() {
    const rawThreads = window.SF_CHAT_PREBAKED || [];
    const threads = rawThreads.map((t, idx) => ({
      id: t.id || `chat_${idx + 1}`,
      title: t.title || t.q || `Research Thread ${idx + 1}`,
      question: t.question || t.q || "",
      answer: t.answer || t.a || "",
      citations: t.citations || [],
      tools: t.tools || [],
      validation: t.validation || ""
    }));
    const current = threads.find((t) => t.id === state.activeChatId) || threads[0] || {
      id: "chat_1",
      title: "Why did @howtohoopforever get high saves despite missing 21 threes?",
      question: "Why did @howtohoopforever get high saves and engagement despite missing 21 threes in a row?",
      answer:
        "Across your 18-post library, @howtohoopforever's tournament reel achieves an 8.8/10 hook score because it pairs an immediate self-deprecating confession ('We missed 21 three-pointers in a row in game one') with high external stakes (a Warriors G League tryout) and social embarrassment (playing in front of Ryan's parents).",
      citations: ["itm_0192f1d0c7a87b5e9a0c3f6e1d2b4a01"]
    };

    return `
      <div style="display:grid;grid-template-columns:280px minmax(0,1fr);min-height:calc(100dvh - 35px);" class="animate-rise">
        <div style="border-right:1px solid var(--line);padding:16px;background:var(--surface);">
          <div class="section-label" style="margin-bottom:12px;">RESEARCH THREADS</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${threads
              .map(
                (t) => `
              <button type="button" data-chat-id="${t.id}"
                style="text-align:left;padding:10px 12px;border:1px solid ${
                  t.id === current.id ? "var(--cb)" : "var(--line)"
                };background:${
                  t.id === current.id ? "var(--bg)" : "transparent"
                };color:var(--ink);font-size:12.5px;line-height:1.4;cursor:pointer;">
                ${escapeHtml(t.title)}
              </button>`
              )
              .join("")}
          </div>
        </div>

        <div style="padding:28px;max-width:860px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div class="section-label" style="margin-bottom:8px;">GROUNDED LIBRARY CHAT · 18 POSTS INDEXED</div>
            <div style="padding:14px 16px;border:1px solid var(--line);background:var(--surface);font-weight:600;font-size:14.5px;margin-bottom:18px;">
              Q: ${escapeHtml(current.question)}
            </div>
            <div style="padding:18px;border:1px solid var(--line-strong);background:var(--bg);font-size:14px;line-height:1.65;white-space:pre-line;">
              ${escapeHtml(current.answer)}
            </div>
            ${current.validation ? `<div class="font-mono" style="margin-top:10px;font-size:11px;color:var(--cg-text);">✓ ${escapeHtml(current.validation)}</div>` : ""}
            <div style="margin-top:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="section-label">CITED POSTS:</span>
              ${(current.citations || [])
                .map(
                  (cid) => `
                <button type="button" onclick="window.sfNavigate('/app/post/${cid}')" class="tag-chip" style="cursor:pointer;">
                  Open ${cid.slice(0, 12)}… ↗
                </button>`
                )
                .join("")}
            </div>
          </div>

          <form id="sf-chat-form" style="margin-top:24px;display:flex;gap:8px;">
            <input type="text" id="sf-chat-input" placeholder="Ask across all 18 analyzed posts (e.g. Compare hooks across basketball reels)..."
              style="flex:1;height:42px;padding:0 14px;background:var(--surface);border:1px solid var(--line-strong);font-size:13px;"/>
            <button type="submit" class="btn btn-primary" style="height:42px;">ASK LIBRARY</button>
          </form>
        </div>
      </div>
    `;
  }

  function renderAppCreditsView() {
    return `
      <div style="padding:28px;max-width:900px;" class="animate-rise">
        <div class="section-label">BILLING &amp; USAGE</div>
        <h1 style="font-size:26px;font-weight:800;margin:6px 0 18px;">Credits &amp; Balance</h1>

        <div class="hairline-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-bottom:24px;">
          <div style="padding:20px;background:var(--surface);">
            <div class="section-label">CURRENT BALANCE</div>
            <div class="figure tabular-nums" style="font-size:36px;margin-top:8px;">${
              state.balanceCents < 100 ? state.balanceCents + "¢" : "$" + (state.balanceCents / 100).toFixed(2)
            }</div>
            <div style="margin-top:6px;font-family:var(--font-mono);font-size:11px;color:var(--muted);">
              ${Math.floor(state.balanceCents / 50)} posts with comments included
            </div>
          </div>
          <div style="padding:20px;background:var(--surface);">
            <div class="section-label">ADD CREDITS INSTANTLY</div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
              <button type="button" data-topup="500" class="btn btn-secondary btn-sm">+$5 (10 posts)</button>
              <button type="button" data-topup="2500" class="btn btn-primary btn-sm">+$25 (50 posts)</button>
            </div>
          </div>
        </div>

        <div class="section-label" style="margin-bottom:10px;">LEDGER HISTORY</div>
        <div style="border:1px solid var(--line);">
          ${state.creditsHistory
            .map(
              (tx) => `
            <div style="padding:12px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;font-family:var(--font-mono);font-size:12px;">
              <div>
                <div style="color:var(--ink);font-family:var(--font-sans);font-weight:500;">${escapeHtml(tx.desc)}</div>
                <div style="font-size:10.5px;color:var(--muted);">${escapeHtml(tx.date)}</div>
              </div>
              <div style="color:${tx.delta > 0 ? "var(--cg-text)" : "var(--ink)"};font-weight:700;">
                ${tx.delta > 0 ? "+" : ""}${tx.delta}¢
              </div>
            </div>`
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderAppInviteView() {
    const refUrl = "https://socialframes.ai/r/zainmasri";
    return `
      <div style="padding:28px;max-width:720px;" class="animate-rise">
        <div class="section-label">REFERRALS</div>
        <h1 style="font-size:26px;font-weight:800;margin:6px 0 10px;">Invite Creators &amp; Analysts</h1>
        <p style="color:var(--muted);font-size:14px;line-height:1.6;margin:0 0 20px;">
          Give a friend <strong>$5.00 in free Social Frames credits</strong> (10 full video + comment analyses). When they run their first analysis, you get $5.00 too.
        </p>
        <div style="padding:18px;border:1px solid var(--line-strong);background:var(--surface);display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <code style="flex:1;font-family:var(--font-mono);font-size:13px;">${refUrl}</code>
          <button type="button" id="sf-copy-invite-btn" class="btn btn-primary btn-sm">COPY INVITE LINK</button>
        </div>
      </div>
    `;
  }

  function renderAppSettingsView() {
    return `
      <div style="padding:28px;max-width:760px;" class="animate-rise">
        <div class="section-label">CONFIGURATION</div>
        <h1 style="font-size:26px;font-weight:800;margin:6px 0 18px;">Workspace &amp; API Settings</h1>
        <div style="border:1px solid var(--line);background:var(--surface);padding:20px;margin-bottom:20px;">
          <div class="section-label" style="margin-bottom:8px;">API KEY (BEARER TOKEN FOR CLI / MCP / REST v1)</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" readonly value="sf_live_98f2a1d0c7a87b5e9a0c3f6e1d2b4a01"
              style="flex:1;height:36px;padding:0 12px;background:var(--bg);border:1px solid var(--line-strong);font-family:var(--font-mono);font-size:12px;"/>
            <button type="button" id="sf-copy-apikey-btn" class="btn btn-secondary btn-sm">COPY KEY</button>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // INTERACTIVE CANVAS VIDEO PLAYER FOR POST DETAIL (Hoops 3x3 & Creator Reels)
  // ============================================================================
  let animFrameId = null;
  let lastTick = performance.now();

  function startReelCanvasLoop() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    const canvas = document.getElementById("sf-reel-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function frame(now) {
      const dt = Math.min(0.1, (now - lastTick) / 1000);
      lastTick = now;
      if (!document.getElementById("sf-reel-canvas")) return;

      const post = getCurrentPost();
      const dur = (post && post.source && post.source.duration_s) || 40;
      if (state.player.playing) {
        state.player.currentTime += dt;
        if (state.player.currentTime >= dur) state.player.currentTime = 0;
      }

      const t = state.player.currentTime;
      const tcEl = document.getElementById("sf-timecode-display");
      if (tcEl) tcEl.textContent = `${formatTime(t)} / ${formatTime(dur)}`;
      const scrubEl = document.getElementById("sf-scrubber-fill");
      if (scrubEl) scrubEl.style.width = `${Math.min(100, (t / dur) * 100).toFixed(1)}%`;

      drawReelFrame(ctx, canvas.width, canvas.height, post, t);
      animFrameId = requestAnimationFrame(frame);
    }

    lastTick = performance.now();
    animFrameId = requestAnimationFrame(frame);
  }

  function drawReelFrame(ctx, W, H, post, t) {
    ctx.clearRect(0, 0, W, H);

    // Outdoor sky & Warriors 3x3 court backdrop (Matches Screenshot 3!)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.48);
    skyGrad.addColorStop(0, "#1c2c44");
    skyGrad.addColorStop(1, "#3b5978");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H * 0.48);

    // Trees / arena backdrop silhouette
    ctx.fillStyle = "#1a2822";
    ctx.fillRect(0, H * 0.36, W, H * 0.12);

    // Spectators / Ryan's parents along baseline
    for (let i = 0; i < 14; i++) {
      const sx = 14 + i * 22;
      const sy = H * 0.43 + Math.sin(t * 2 + i) * 1.2;
      ctx.fillStyle = i % 3 === 0 ? "#e8e4dc" : i % 2 === 0 ? "#2563eb" : "#fbbf24";
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(sx - 5, sy + 5, 10, 12);
    }

    // Outdoor blue/slate basketball half-court
    const courtGrad = ctx.createLinearGradient(0, H * 0.48, 0, H);
    courtGrad.addColorStop(0, "#1d3557");
    courtGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = courtGrad;
    ctx.fillRect(0, H * 0.48, W, H * 0.52);

    // Court 3-point arc & key lines
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(45, H * 0.48);
    ctx.lineTo(20, H * 0.85);
    ctx.lineTo(W - 20, H * 0.85);
    ctx.lineTo(W - 45, H * 0.48);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(W / 2, H * 0.62, 110, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Hoop Stanchion, Backboard & Rim on top-right/center
    const hoopX = W * 0.62;
    const hoopY = H * 0.31;
    ctx.fillStyle = "#111";
    ctx.fillRect(hoopX + 26, hoopY - 10, 6, 95);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.fillRect(hoopX - 24, hoopY - 28, 48, 32);
    ctx.strokeRect(hoopX - 24, hoopY - 28, 48, 32);
    // Orange rim
    ctx.strokeStyle = "#ff4500";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hoopX - 10, hoopY + 2);
    ctx.lineTo(hoopX + 8, hoopY + 2);
    ctx.stroke();

    // Animated 3x3 players on court
    const phase = (t % 3.2) / 3.2;
    const shooterX = W * 0.25 + Math.sin(t * 1.5) * 18;
    const shooterY = H * 0.68;

    // Shooter player (white jersey #12)
    const jumpOffset = phase < 0.35 ? Math.sin((phase / 0.35) * Math.PI) * 22 : 0;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(shooterX - 8, shooterY - 26 - jumpOffset, 16, 26);
    ctx.fillStyle = "#d97706";
    ctx.beginPath();
    ctx.arc(shooterX, shooterY - 33 - jumpOffset, 7, 0, Math.PI * 2);
    ctx.fill();

    // Defender & Teammates
    const defX = W * 0.45 + Math.cos(t * 2.1) * 16;
    const defY = H * 0.62;
    ctx.fillStyle = "#111827";
    ctx.fillRect(defX - 8, defY - 26, 16, 26);
    ctx.fillStyle = "#a16207";
    ctx.beginPath();
    ctx.arc(defX, defY - 33, 7, 0, Math.PI * 2);
    ctx.fill();

    // Basketball arc & Brick / Make animation synced to timestamp!
    const isMadeBucket = t >= 24 && t <= 31;
    const ballX = shooterX + (hoopX - shooterX) * Math.min(1, phase * 1.25);
    let ballY =
      shooterY -
      36 -
      jumpOffset +
      (hoopY - (shooterY - 36)) * Math.min(1, phase * 1.25) -
      Math.sin(Math.min(1, phase * 1.25) * Math.PI) * 95;

    // If brick (>0.8 phase and not in 24..31s window), clank off rim!
    let finalBallX = ballX;
    if (phase > 0.8 && !isMadeBucket) {
      const clankProgress = (phase - 0.8) / 0.2;
      finalBallX = hoopX - clankProgress * 45;
      ballY = hoopY - Math.sin(clankProgress * Math.PI) * 28 + clankProgress * 30;
      // Red clank flash
      ctx.strokeStyle = "#ff4a4a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hoopX - 4, hoopY, 14 * clankProgress, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(finalBallX, ballY, 7, 0, Math.PI * 2);
    ctx.fill();

    // Top Rounded Banner Overlay (Exact match to Screenshot 3: "My hoops team EMBARRASSED ourselves")
    const bannerText = post.on_screen_banner || "My hoops team EMBARRASSED ourselves";
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(18, 44, W - 36, 46);
    ctx.font = "bold 13px Geist, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#111111";
    ctx.fillText(bannerText.slice(0, 26), W / 2, 63);
    ctx.fillStyle = "#dc0000";
    ctx.font = "800 13.5px Geist, sans-serif";
    ctx.fillText(bannerText.slice(26) || "0 FOR 21 FROM DEEP", W / 2, 81);

    // Current Active Spoken Line Caption Box
    const segs = (post.transcript && post.transcript.segments) || [];
    const activeSeg = segs.find((s) => t >= s.start_s && t < s.end_s) || segs[0];
    if (activeSeg) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
      ctx.fillRect(14, H - 148, W - 28, 46);
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 11.5px Geist, sans-serif";
      const words = String(activeSeg.text).split(" ");
      const mid = Math.ceil(words.length / 2);
      ctx.fillText(words.slice(0, mid).join(" "), W / 2, H - 128);
      ctx.fillText(words.slice(mid).join(" "), W / 2, H - 112);
    }

    // Bottom Broadcast Chyron (Matches Screenshot 3: "NEXT UP HOOP IT UP")
    ctx.fillStyle = "rgba(10, 14, 22, 0.88)";
    ctx.fillRect(16, H - 90, W - 32, 34);
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, H - 90, W - 32, 34);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 13px Geist, sans-serif";
    ctx.fillText(post.on_screen_chyron || "NEXT UP HOOP IT UP", W / 2, H - 68);
  }

  // ============================================================================
  // EVENT BINDING FOR AUTHENTICATED /APP WORKSPACE
  // ============================================================================
  function bindAppMainEvents() {
    const post = getCurrentPost();

    // Tab clicks
    document.querySelectorAll("[data-post-tab]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        state.postTab = btn.getAttribute("data-post-tab");
        renderAppMainOnly();
      };
    });

    // Seek clicks on transcript rows, beat rows, shot cuts, most-discussed moment
    document.querySelectorAll("[data-seek]").forEach((el) => {
      el.onclick = () => {
        const sec = parseFloat(el.getAttribute("data-seek")) || 0;
        state.player.currentTime = sec;
        state.player.playing = true;
        showToast("Jumped to " + formatTime(sec));
        if (state.postTab === "transcript") renderAppMainOnly();
      };
    });

    // Toggle "Show what's on screen" in Analysis tab
    const toggleOnScreenBtn = document.getElementById("sf-toggle-onscreen");
    if (toggleOnScreenBtn) {
      toggleOnScreenBtn.onclick = () => {
        state.showOnScreenInBeats = !state.showOnScreenInBeats;
        renderAppMainOnly();
      };
    }

    // Download & Copy dropdown toggles
    const dlBtn = document.getElementById("sf-btn-download");
    if (dlBtn) {
      dlBtn.onclick = (e) => {
        e.stopPropagation();
        state.openDropdown = state.openDropdown === "download" ? null : "download";
        renderAppMainOnly();
      };
    }

    const cpBtn = document.getElementById("sf-btn-copy");
    if (cpBtn) {
      cpBtn.onclick = (e) => {
        e.stopPropagation();
        state.openDropdown = state.openDropdown === "copy" ? null : "copy";
        renderAppMainOnly();
      };
    }

    // Download menu actions
    document.querySelectorAll("[data-dl]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const kind = btn.getAttribute("data-dl");
        state.openDropdown = null;
        if (kind === "json") {
          downloadFile(`${post.source.author}_${post.item_id}.json`, JSON.stringify(post, null, 2), "application/json");
        } else if (kind === "csv" || kind === "excel") {
          const csv = `item_id,platform,author,posted_at,views,likes,comments,hook_score,summary\n"${post.item_id}","${post.source.platform}","${post.source.author}","${post.source.posted_at}",${post.source.metrics.views},${post.source.metrics.likes},${post.source.metrics.comments},${post.hook_analysis ? post.hook_analysis.hook_score : 8.8},"${String(post.summary || "").replace(/"/g, '""')}"\n`;
          downloadFile(`${post.source.author}_summary.${kind === "excel" ? "xlsx.csv" : "csv"}`, csv, "text/csv");
        } else if (kind === "comments") {
          const rows = (post.comments_sample || []).map((c) => `"${c.author}","${String(c.text || "").replace(/"/g, '""')}",${c.likes},"${c.sentiment}"`);
          downloadFile(`${post.source.author}_comments.csv`, "author,text,likes,sentiment\n" + rows.join("\n"), "text/csv");
        }
        renderAppMainOnly();
      };
    });

    // Copy menu actions
    document.querySelectorAll("[data-cp]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const kind = btn.getAttribute("data-cp");
        state.openDropdown = null;
        if (kind === "json") {
          copyToClipboard(JSON.stringify(post, null, 2), "Copied full JSON");
        } else if (kind === "id") {
          copyToClipboard(post.item_id, "Copied item ID");
        } else if (kind === "link") {
          copyToClipboard(window.location.href, "Copied post link");
        } else if (kind === "transcript") {
          const txt = ((post.transcript && post.transcript.segments) || [])
            .map((s) => `[${formatTime(s.start_s)}–${formatTime(s.end_s)}] ${s.text}`)
            .join("\n");
          copyToClipboard(txt, "Copied timed transcript");
        } else if (kind === "markdown") {
          const md = `# @${post.source.author} (${post.source.platform})\n\n## Summary\n${post.summary}\n\n## Transcript\n` +
            ((post.transcript && post.transcript.segments) || [])
              .map((s) => `- [${formatTime(s.start_s)}–${formatTime(s.end_s)}] ${s.text}`)
              .join("\n");
          copyToClipboard(md, "Copied Markdown brief");
        }
        renderAppMainOnly();
      };
    });

    // Video Play/Pause & Scrubber
    const stage = document.getElementById("sf-player-stage");
    const playBtn = document.getElementById("sf-toggle-play-btn");
    if (stage) {
      stage.onclick = () => {
        state.player.playing = !state.player.playing;
        if (playBtn) playBtn.textContent = state.player.playing ? "PAUSE ❚❚" : "PLAY ▶";
      };
    }
    if (playBtn) {
      playBtn.onclick = () => {
        state.player.playing = !state.player.playing;
        playBtn.textContent = state.player.playing ? "PAUSE ❚❚" : "PLAY ▶";
      };
    }
    const scrubber = document.getElementById("sf-scrubber");
    if (scrubber) {
      scrubber.onclick = (e) => {
        const rect = scrubber.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        state.player.currentTime = ratio * (post.source.duration_s || 40);
      };
    }

    // Comment filters
    document.querySelectorAll("[data-comment-filter]").forEach((btn) => {
      btn.onclick = () => {
        state.commentFilter = btn.getAttribute("data-comment-filter");
        renderAppMainOnly();
      };
    });

    // Refresh metrics · 1¢
    const refreshBtn = document.getElementById("sf-refresh-metrics-btn");
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        state.balanceCents = Math.max(0, state.balanceCents - 1);
        post.source.metrics.views += Math.floor(120 + Math.random() * 480);
        post.source.metrics.likes += Math.floor(3 + Math.random() * 14);
        if (!post.metrics_history) post.metrics_history = [];
        post.metrics_history.push({
          recorded_at: "Just now",
          views: post.source.metrics.views,
          likes: post.source.metrics.likes,
          comments: post.source.metrics.comments,
          shares: post.source.metrics.shares,
          saves: post.source.metrics.saves
        });
        showToast("Metrics refreshed (1¢ charged)");
        render();
      };
    }

    // Posts search & platform filter
    const searchIn = document.getElementById("sf-posts-search");
    if (searchIn) {
      searchIn.oninput = (e) => {
        state.postsSearch = e.target.value;
        renderAppMainOnly();
        const el = document.getElementById("sf-posts-search");
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      };
    }
    document.querySelectorAll("[data-plat-filter]").forEach((btn) => {
      btn.onclick = () => {
        state.postsPlatformFilter = btn.getAttribute("data-plat-filter");
        renderAppMainOnly();
      };
    });

    // New Analysis runner
    const runBtn = document.getElementById("sf-run-analysis-btn");
    if (runBtn) {
      runBtn.onclick = () => {
        if (state.newAnalysis.running) return;
        const urlIn = document.getElementById("sf-new-url-input");
        if (urlIn) state.newAnalysis.url = urlIn.value;
        state.newAnalysis.running = true;
        state.newAnalysis.stepIndex = 0;
        renderAppMainOnly();

        const timer = setInterval(() => {
          state.newAnalysis.stepIndex += 1;
          if (state.newAnalysis.stepIndex >= 8) {
            clearInterval(timer);
            state.newAnalysis.running = false;
            showToast("Analysis complete! Opening @howtohoopforever report");
            navigate("/app/post/itm_0192f1d0c7a87b5e9a0c3f6e1d2b4a01", { postTab: "transcript" });
          } else {
            renderAppMainOnly();
          }
        }, 380);
      };
    }

    // Chat threads & form
    document.querySelectorAll("[data-chat-id]").forEach((btn) => {
      btn.onclick = () => {
        state.activeChatId = btn.getAttribute("data-chat-id");
        renderAppMainOnly();
      };
    });
    const chatForm = document.getElementById("sf-chat-form");
    if (chatForm) {
      chatForm.onsubmit = (e) => {
        e.preventDefault();
        const inp = document.getElementById("sf-chat-input");
        const q = inp ? inp.value.trim() : "";
        if (!q) return;
        const newId = "chat_custom_" + Date.now();
        window.SF_CHAT_PREBAKED.unshift({
          id: newId,
          title: q.slice(0, 54),
          question: q,
          answer:
            "Based on your 18 analyzed posts in Social Frames:\n\n1. @howtohoopforever ('My hoops team EMBARRASSED ourselves') leads in comedic hook retention (8.8/10) by front-loading the 0-for-21 confession in the first 5 seconds.\n2. @nikebasketball ('You break it, you own it') uses an atmospheric crowd crescendo and an 18-second delayed text reveal to drive 91% positive sentiment.\n3. Posts that pair timed on-screen banner text with fast montage cuts in the final third average 2.4× higher save rates across your library.",
          citations: ["itm_0192f1d0c7a87b5e9a0c3f6e1d2b4a01", "itm_0192f1d0c7a87b5e9a0c3f6e1d2b4a02"]
        });
        state.activeChatId = newId;
        renderAppMainOnly();
      };
    }

    // Credits topup
    document.querySelectorAll("[data-topup]").forEach((btn) => {
      btn.onclick = () => {
        const add = parseInt(btn.getAttribute("data-topup"), 10) || 500;
        state.balanceCents += add;
        state.creditsHistory.unshift({
          id: "tx_" + Date.now(),
          date: "Just now",
          desc: `Credit pack top-up (+$${(add / 100).toFixed(2)})`,
          delta: add,
          balance: state.balanceCents
        });
        showToast(`Added $${(add / 100).toFixed(2)} to balance`);
        render();
      };
    });

    // Copy invite & API key
    const invBtn = document.getElementById("sf-copy-invite-btn");
    if (invBtn) invBtn.onclick = () => copyToClipboard("https://socialframes.ai/r/zainmasri", "Copied referral link");
    const apiBtn = document.getElementById("sf-copy-apikey-btn");
    if (apiBtn) apiBtn.onclick = () => copyToClipboard("sf_live_98f2a1d0c7a87b5e9a0c3f6e1d2b4a01", "Copied API key");

    startReelCanvasLoop();
  }

  // ============================================================================
  // PUBLIC SITE HYDRATION (Home Stipple Canvas, How It Works Copy Page, Pricing Sliders, Docs Tabs, Try Live)
  // ============================================================================

  function hydratePublicPage(pageKey) {
    // 1. Copy Page as Markdown button on /how-it-works (Screenshots 1 & 2!) and /docs
    const howCopyBtn = document.querySelector('[data-testid="how-copy"]');
    if (howCopyBtn) {
      howCopyBtn.onclick = () => {
        const md = (window.SF_MARKDOWN && window.SF_MARKDOWN["how-it-works"]) || "# How Social Frames analyzes a video";
        copyToClipboard(md, "Copied full page as Markdown");
        const span = howCopyBtn.querySelector("span:last-child");
        if (span) {
          const orig = span.textContent;
          span.textContent = "Copied Markdown ✓";
          setTimeout(() => {
            span.textContent = orig;
          }, 2000);
        }
      };
    }

    // All other Copy buttons on Docs / Home
    document.querySelectorAll("button").forEach((btn) => {
      const txt = (btn.textContent || "").trim();
      if (txt === "Copy page" && !btn.hasAttribute("data-testid")) {
        btn.onclick = () => {
          const md = (window.SF_MARKDOWN && (window.SF_MARKDOWN.docs || window.SF_MARKDOWN.full)) || "";
          copyToClipboard(md, "Copied page as Markdown");
        };
      } else if (txt === "Copy") {
        btn.onclick = () => {
          const pre = btn.closest("div")?.parentElement?.querySelector("pre, code");
          copyToClipboard(pre ? pre.textContent : "curl -X POST https://socialframes.ai/api/v1/jobs", "Copied snippet");
        };
      }
    });

    // 2. Replay SVG animations on hover/click in /how-it-works
    document.querySelectorAll(".hiw-svg").forEach((svg) => {
      svg.style.cursor = "pointer";
      svg.onclick = () => {
        const clone = svg.cloneNode(true);
        svg.parentNode.replaceChild(clone, svg);
        showToast("Replayed step animation");
      };
    });

    // 3. Pricing Page interactive 4-slider monthly calculator
    if (pageKey === "pricing") {
      hydratePricingCalculator();
    }

    // 4. Home Page Stipple Point-Cloud Canvas, Accordions, Comments Tabs & Hero Form
    if (pageKey === "index") {
      hydrateHomePage();
    }

    // 5. Try Page interactive live analyzer
    if (pageKey === "try") {
      hydrateTryPage();
    }

    // 6. Login / Signup forms -> route into /app Workspace!
    if (pageKey === "login" || pageKey === "signup") {
      document.querySelectorAll("form").forEach((form) => {
        form.onsubmit = (e) => {
          e.preventDefault();
          showToast("Signed in to Social Frames Workspace");
          navigate("/app/post/itm_0192f1d0c7a87b5e9a0c3f6e1d2b4a01", { postTab: "transcript" });
        };
      });
    }
  }

  function hydratePricingCalculator() {
    const sliders = document.querySelectorAll('input[type="range"]');
    if (!sliders.length) return;

    function updateCalc() {
      const posts = parseInt(sliders[0]?.value || "20", 10);
      const refreshes = parseInt(sliders[1]?.value || "0", 10);
      const pulls = parseInt(sliders[2]?.value || "0", 10);
      const questions = parseInt(sliders[3]?.value || "0", 10);

      sliders.forEach((s) => {
        const min = parseFloat(s.min) || 0;
        const max = parseFloat(s.max) || 100;
        const val = parseFloat(s.value) || 0;
        const pct = ((val - min) / (max - min)) * 100;
        s.style.setProperty("--pct", pct.toFixed(1) + "%");
      });

      const totalCents = posts * 50 + refreshes * 1 + pulls * 5 + questions * 5;
      const totalDollars = (totalCents / 100).toFixed(2);

      // Update displayed total figure if present
      const figures = document.querySelectorAll("output, .tabular-nums");
      figures.forEach((el) => {
        if ((el.textContent || "").trim().startsWith("$") && el.className.includes("text-[clamp")) {
          el.textContent = "$" + totalDollars;
        }
      });
    }

    sliders.forEach((s) => {
      s.addEventListener("input", updateCalc);
    });
  }

  function hydrateHomePage() {
    // Hero form submission -> jump to /app or /try
    document.querySelectorAll("form").forEach((form) => {
      form.onsubmit = (e) => {
        e.preventDefault();
        navigate("/app/post/itm_0192f1d0c7a87b5e9a0c3f6e1d2b4a01", { postTab: "transcript" });
      };
    });

    // "See a full example" button -> open @howtohoopforever in App Workspace
    document.querySelectorAll("button").forEach((btn) => {
      const label = (btn.textContent || "").trim();
      if (label.includes("See a full example")) {
        btn.onclick = () => navigate("/app/post/itm_0192f1d0c7a87b5e9a0c3f6e1d2b4a01", { postTab: "overview" });
      }
    });

    // Load stipple point clouds on Home canvases
    const canvases = document.querySelectorAll("canvas");
    const sources = ["hero/chef.points.json", "hero/kid.points.json", "hero/launch.points.json"];
    canvases.forEach((canvas, idx) => {
      const src = sources[idx % sources.length];
      fetch(src)
        .then((r) => r.json())
        .then((data) => {
          animatePointCloudCanvas(canvas, data);
        })
        .catch(() => {});
    });
  }

  function animatePointCloudCanvas(canvas, pointsData) {
    if (!canvas || !pointsData) return;
    const ctx = canvas.getContext("2d");
    const isLight = state.theme === "light";
    const tones = isLight
      ? ["rgba(10,10,10,0.22)", "rgba(10,10,10,0.45)", "rgba(10,10,10,0.72)", "rgba(10,10,10,0.95)"]
      : ["rgba(232,228,220,0.22)", "rgba(232,228,220,0.45)", "rgba(232,228,220,0.75)", "rgba(232,228,220,0.98)"];
    const accents = ["#0064ff", "#39ff14", "#ffff00", "#dc0000"];

    if (Array.isArray(pointsData.p)) {
      const pts = pointsData.p;
      const q = pointsData.q || 1000;
      const aspect = (pointsData.w || 9) / (pointsData.h || 16);
      let tick = 0;

      function drawStaticStipple() {
        if (!document.body.contains(canvas)) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = canvas.clientWidth || 380;
        const cssH = canvas.clientHeight || 440;
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, cssW, cssH);

        // Fit 9:16 stipple cloud nicely inside canvas
        const drawH = cssH * 0.94;
        const drawW = Math.min(cssW * 0.62, drawH * aspect);
        const offX = Math.max(12, cssW * 0.28 - drawW * 0.5);
        const offY = (cssH - drawH) * 0.5;

        for (let i = 0; i < pts.length; i += 3) {
          const nx = pts[i] / q;
          const ny = pts[i + 1] / q;
          const c = pts[i + 2] || 0;
          const drift = Math.sin(tick * 0.03 + i * 0.013) * 0.8;
          const x = offX + nx * drawW + drift;
          const y = offY + ny * drawH;
          if (i % 99 === 0 && c >= 2) {
            ctx.fillStyle = accents[(i / 3) % 4];
            ctx.fillRect(x, y, 2.4, 2.4);
          } else {
            ctx.fillStyle = tones[Math.min(3, Math.max(0, c))];
            const sz = c >= 2 ? 2.0 : 1.5;
            ctx.fillRect(x, y, sz, sz);
          }
        }
        ctx.restore();
        tick++;
        requestAnimationFrame(drawStaticStipple);
      }
      drawStaticStipple();
      return;
    }

    if (!pointsData.frames) return;
    const frames = pointsData.frames;
    let fIdx = 0;
    function drawFrames() {
      if (!document.body.contains(canvas)) return;
      const W = (canvas.width = canvas.clientWidth || 320);
      const H = (canvas.height = canvas.clientHeight || 400);
      ctx.clearRect(0, 0, W, H);
      const pts = frames[Math.floor(fIdx) % frames.length] || [];
      for (let i = 0; i < pts.length; i += 3) {
        const x = (pts[i] / (pointsData.w || 180)) * W;
        const y = (pts[i + 1] / (pointsData.h || 320)) * H;
        ctx.fillStyle = accents[i % accents.length];
        ctx.fillRect(x, y, 2.2, 2.2);
      }
      fIdx = (fIdx + 0.35) % frames.length;
      requestAnimationFrame(drawFrames);
    }
    requestAnimationFrame(drawFrames);
  }

  function hydrateTryPage() {
    document.querySelectorAll("form").forEach((form) => {
      form.onsubmit = (e) => {
        e.preventDefault();
        showToast("Running 8-step pipeline...");
        setTimeout(() => {
          navigate("/app/post/itm_0192f1d0c7a87b5e9a0c3f6e1d2b4a01", { postTab: "transcript" });
        }, 900);
      };
    });
  }

  // ============================================================================
  // MASTER RENDER
  // ============================================================================
  function render() {
    const root = document.getElementById("sf-root");
    if (!root) return;

    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    const r = state.route;
    const isApp = r.startsWith("/app");

    if (isApp) {
      root.innerHTML = renderQuickJumpBar() + renderAppWorkspace();
      bindTopBarEvents();
      bindAppMainEvents();
      return;
    }

    // Map route to SSR page template
    let pageKey = "index";
    if (r.startsWith("/how-it-works")) pageKey = "how-it-works";
    else if (r.startsWith("/pricing")) pageKey = "pricing";
    else if (r.startsWith("/docs")) pageKey = "docs";
    else if (r.startsWith("/try")) pageKey = "try";
    else if (r.startsWith("/login")) pageKey = "login";
    else if (r.startsWith("/signup")) pageKey = "signup";
    else if (r.startsWith("/privacy")) pageKey = "privacy";
    else if (r.startsWith("/terms")) pageKey = "terms";

    const pageHtml = (window.SF_PAGES && window.SF_PAGES[pageKey]) || (window.SF_PAGES && window.SF_PAGES.index) || "";
    const footerHtml = window.SF_FOOTER || "";

    root.innerHTML = `
      ${renderQuickJumpBar()}
      <div class="min-h-dvh flex flex-col" style="background:var(--bg);color:var(--ink);">
        ${renderPublicHeader()}
        <div class="flex-1">
          ${pageHtml}
        </div>
        ${footerHtml}
      </div>
    `;

    bindTopBarEvents();
    hydratePublicPage(pageKey);
  }

  function bindTopBarEvents() {
    const topThemeBtn = document.getElementById("sf-top-theme-btn");
    if (topThemeBtn) {
      topThemeBtn.onclick = () => {
        applyTheme(state.theme === "dark" ? "light" : "dark");
        render();
      };
    }
    const sideThemeBtn = document.getElementById("sf-sidebar-theme-btn");
    if (sideThemeBtn) {
      sideThemeBtn.onclick = () => {
        applyTheme(state.theme === "dark" ? "light" : "dark");
        render();
      };
    }
  }

  // Boot application
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
