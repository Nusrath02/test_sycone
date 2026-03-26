// ITChamps Custom Org Chart v5

(function () {
  console.log("[ITC-ORG] v5 loaded - index-based colors active");
  var PALETTE = [
    { bg: "#ede9fc", bd: "#7c3aed", tx: "#5b21b6" },
    { bg: "#d1fae5", bd: "#059669", tx: "#065f46" },
    { bg: "#fee2e2", bd: "#dc2626", tx: "#991b1b" },
    { bg: "#dbeafe", bd: "#2563eb", tx: "#1e40af" },
    { bg: "#fef3c7", bd: "#d97706", tx: "#92400e" },
    { bg: "#fce7f3", bd: "#db2777", tx: "#9d174d" },
  ];

  var _colorMap = {};

  function colorFor(id) {
    return _colorMap[id] || PALETTE[0];
  }

  function esc(s) {
    return frappe.utils.escape_html(s || "");
  }

  function injectStyles() {
    if (document.getElementById("itc-styles")) return;
    var s = document.createElement("style");
    s.id = "itc-styles";
    s.textContent = [
      "#itc-org-root { padding: 20px 16px 40px; overflow-x: auto; }",
      ".itc-empty { text-align:center; padding:60px 20px; color:#718096; }",
      ".org-wrap { display:flex; justify-content:center; padding:10px 0 30px; }",
      ".org-node { display:inline-flex; flex-direction:column; align-items:center; }",
      ".itc-card { border-radius:8px; padding:12px 18px; min-width:130px; max-width:190px;",
      "  text-align:center; cursor:pointer; border:1.5px solid; box-sizing:border-box; transition:filter .15s; }",
      ".itc-card:hover { filter:brightness(.93); }",
      ".org-card-name { font-size:14px; font-weight:600; margin-bottom:3px; }",
      ".org-card-info { font-size:11px; line-height:1.4; }",
      ".org-vline { width:1px; height:20px; background:#ccc; flex-shrink:0; }",
      ".org-children { display:flex; }",
      ".org-child-wrap { display:flex; flex-direction:column; align-items:center; padding:20px 12px 0; position:relative; }",
      ".org-child-wrap::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:#ccc; }",
      ".org-child-wrap:first-child::before { left:50%; }",
      ".org-child-wrap:last-child::before  { right:50%; }",
      ".org-child-wrap:only-child::before  { display:none; }",
      ".org-child-wrap::after { content:''; position:absolute; top:0; left:50%; width:1px; height:20px; background:#ccc; }",
      // Filter selects injected into .page-form.row
      ".itc-filter-wrap { display:inline-flex; flex-direction:column; margin-left:8px; vertical-align:bottom; }",
      ".itc-filter-wrap label { font-size:11px; font-weight:600; color:#718096; margin-bottom:2px; display:block; }",
      ".itc-select { height:32px; padding:0 28px 0 10px; border:1px solid #d1d5db; border-radius:6px;",
      "  font-size:12px; color:#374151; background:#fff; appearance:none; -webkit-appearance:none;",
      "  background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7280'/%3E%3C/svg%3E\");",
      "  background-repeat:no-repeat; background-position:right 10px center; cursor:pointer; min-width:160px; }",
      ".itc-select:focus { outline:none; border-color:#4C6EF5; box-shadow:0 0 0 2px rgba(76,110,245,.15); }",
    ].join(" ");
    document.head.appendChild(s);
  }

  var _obs = null;
  var _allEmps = [];

  function onOrgChart() {
    return window.location.href.indexOf("organizational-chart") !== -1;
  }

  function startWatching() {
    if (_obs) {
      _obs.disconnect();
      _obs = null;
    }
    if (tryInject()) return;
    _obs = new MutationObserver(function () {
      if (tryInject()) {
        _obs.disconnect();
        _obs = null;
      }
    });
    _obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () {
      if (_obs) {
        _obs.disconnect();
        _obs = null;
      }
    }, 15000);
  }

  function stopWatching() {
    if (_obs) {
      _obs.disconnect();
      _obs = null;
    }
    _allEmps = [];
    ["itc-dept-wrap", "itc-branch-wrap"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
    var root = document.getElementById("itc-org-root");
    if (root) root.remove();
    var hrms = document.getElementById("hierarchy-chart-wrapper");
    if (hrms) hrms.style.display = "";
  }

  function tryInject() {
    var hrms = document.getElementById("hierarchy-chart-wrapper");
    if (!hrms) return false;
    if (document.getElementById("itc-org-root")) return true;

    hrms.style.display = "none";
    injectStyles();

    var root = document.createElement("div");
    root.id = "itc-org-root";
    root.innerHTML =
      '<div id="itc-list"><div class="itc-empty">Loading\u2026</div></div>';
    hrms.parentNode.insertBefore(root, hrms);

    loadAndRender();
    return true;
  }

  // Inject Dept + Branch selects into .page-form.row (same row as company selector)
  function injectFilters(depts, branches) {
    if (document.getElementById("itc-dept-wrap")) return;

    var inp = document.querySelector('input[data-fieldname="company"]');
    var container = inp && inp.closest(".page-form");
    if (!container) return;

    function makeWrap(wrapId, selId, labelText, items) {
      var wrap = document.createElement("div");
      wrap.id = wrapId;
      wrap.className = "itc-filter-wrap";
      var lbl = document.createElement("label");
      lbl.textContent = labelText;
      var sel = document.createElement("select");
      sel.id = selId;
      sel.className = "itc-select";
      sel.innerHTML = '<option value="">All ' + labelText + "s</option>";
      items.forEach(function (v) {
        sel.innerHTML +=
          '<option value="' + esc(v) + '">' + esc(v) + "</option>";
      });
      sel.addEventListener("change", function () {
        renderTree();
      });
      wrap.appendChild(lbl);
      wrap.appendChild(sel);
      return wrap;
    }

    container.appendChild(
      makeWrap("itc-dept-wrap", "itc-dept-sel", "Department", depts),
    );
    container.appendChild(
      makeWrap("itc-branch-wrap", "itc-branch-sel", "Branch", branches),
    );
  }

  function loadAndRender() {
    var company = frappe.defaults.get_default("company");
    if (!company) {
      var el = document.getElementById("itc-list");
      if (el)
        el.innerHTML = '<div class="itc-empty">No default company set</div>';
      return;
    }
    frappe.call({
      method: "business_theme_v14.api.org_chart.get_org_chart_data",
      args: { company: company },
      callback: function (r) {
        if (r && r.message) {
          var msg = r.message;
          _allEmps = msg.employees || [];
          _colorMap = {};
          _allEmps.forEach(function (e, idx) {
            _colorMap[e.id] = PALETTE[idx % PALETTE.length];
          });

          var depts =
            msg.departments && msg.departments.length
              ? msg.departments
              : _allEmps
                  .map(function (e) {
                    return e.department;
                  })
                  .filter(function (v, i, a) {
                    return v && a.indexOf(v) === i;
                  })
                  .sort();
          var branches =
            msg.branches && msg.branches.length
              ? msg.branches
              : _allEmps
                  .map(function (e) {
                    return e.branch;
                  })
                  .filter(function (v, i, a) {
                    return v && a.indexOf(v) === i;
                  })
                  .sort();

          injectFilters(depts, branches);
          renderTree();
        }
      },
      error: function () {
        var el = document.getElementById("itc-list");
        if (el)
          el.innerHTML = '<div class="itc-empty">Error loading data</div>';
      },
    });
  }

  function getFilteredEmps() {
    var dept = (document.getElementById("itc-dept-sel") || {}).value || "";
    var branch = (document.getElementById("itc-branch-sel") || {}).value || "";
    if (!dept && !branch) return _allEmps;

    var empMap = {};
    _allEmps.forEach(function (e) {
      empMap[e.id] = e;
    });

    var included = {};
    function addWithAncestors(id) {
      if (included[id]) return;
      included[id] = true;
      var e = empMap[id];
      if (e && e.reports_to && empMap[e.reports_to])
        addWithAncestors(e.reports_to);
    }
    _allEmps.forEach(function (e) {
      if (
        (!dept || e.department === dept) &&
        (!branch || e.branch === branch)
      ) {
        addWithAncestors(e.id);
      }
    });
    return _allEmps.filter(function (e) {
      return included[e.id];
    });
  }

  function renderTree() {
    var el = document.getElementById("itc-list");
    if (!el) return;

    var emps = getFilteredEmps();
    if (!emps || !emps.length) {
      el.innerHTML = '<div class="itc-empty">No employees found</div>';
      return;
    }

    var map = {},
      i,
      e;
    for (i = 0; i < emps.length; i++) {
      e = emps[i];
      map[e.id] = { d: e, ch: [] };
    }
    var roots = [];
    for (i = 0; i < emps.length; i++) {
      e = emps[i];
      if (e.reports_to && map[e.reports_to]) {
        map[e.reports_to].ch.push(map[e.id]);
      } else {
        roots.push(map[e.id]);
      }
    }
    function srt(n) {
      n.ch.sort(function (a, b) {
        return a.d.name.localeCompare(b.d.name);
      });
      for (var j = 0; j < n.ch.length; j++) srt(n.ch[j]);
    }
    for (i = 0; i < roots.length; i++) srt(roots[i]);
    roots.sort(function (a, b) {
      return a.d.name.localeCompare(b.d.name);
    });

    var html = '<div class="org-wrap">';
    for (i = 0; i < roots.length; i++) html += nodeH(roots[i]);
    html += "</div>";
    el.innerHTML = html;

    el.addEventListener("click", function (ev) {
      var card = ev.target.closest && ev.target.closest(".itc-card");
      if (card && card.dataset.id)
        frappe.set_route("app", "employee", card.dataset.id);
    });
  }

  function nodeH(node) {
    var d = node.d,
      kids = node.ch,
      c = colorFor(d.id);
    var parts = [d.designation, d.department, d.branch].filter(function (v) {
      return !!v;
    });
    var h = '<div class="org-node">';
    h +=
      '<div class="itc-card" data-id="' +
      esc(d.id) +
      '"' +
      ' style="background:' +
      c.bg +
      ";border-color:" +
      c.bd +
      ";color:" +
      c.tx +
      '">';
    h += '<div class="org-card-name">' + esc(d.name) + "</div>";
    if (parts.length)
      h +=
        '<div class="org-card-info">' + esc(parts.join(" \u00b7 ")) + "</div>";
    h += "</div>";
    if (kids.length > 0) {
      h += '<div class="org-vline"></div><div class="org-children">';
      for (var j = 0; j < kids.length; j++)
        h += '<div class="org-child-wrap">' + nodeH(kids[j]) + "</div>";
      h += "</div>";
    }
    h += "</div>";
    return h;
  }

  $(document).on("page-change", function () {
    if (onOrgChart()) {
      startWatching();
    } else {
      stopWatching();
    }
  });

  $(document).ready(function () {
    if (onOrgChart()) startWatching();
  });
})();
