// ITChamps Custom Org Chart

(function () {

var PAL = ["#4C6EF5","#E8590C","#0CA678","#E64980","#7950F2","#1098AD","#D6336C","#5C940D","#1C7ED6","#AE3EC9","#2B8A3E","#F59F00","#C92A2A","#087F5B","#845EF7"];

var _allEmps = [];
var _allDepts = [];
var _allBranches = [];
var _deptFilter = "";
var _branchFilter = "";

function palColor(idx) { return PAL[idx % PAL.length]; }

function initials(name) {
    return (name || "?").split(" ").map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
}

function esc(s) { return frappe.utils.escape_html(s || ""); }

function injectStyles() {
    if (document.getElementById("itc-styles")) return;
    var s = document.createElement("style");
    s.id = "itc-styles";
    s.textContent = [
        "#itc-org-root { padding: 10px 16px 40px; overflow-x: auto; }",
        ".itc-empty { text-align:center; padding:60px 20px; color:#718096; }",
        ".itc-filter-wrap { display:inline-flex; flex-direction:column; margin-left:8px; vertical-align:bottom; }",
        ".itc-filter-wrap label { font-size:11px; font-weight:600; color:#718096; margin-bottom:2px; display:block; }",
        ".itc-select { height:32px; padding:0 28px 0 10px; border:1px solid #d1d5db; border-radius:6px; font-size:12px; color:#374151; background:#fff; appearance:none; -webkit-appearance:none;",
        "  background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7280'/%3E%3C/svg%3E\");",
        "  background-repeat:no-repeat; background-position:right 10px center; cursor:pointer; min-width:160px; }",
        ".itc-select:focus { outline:none; border-color:#4C6EF5; box-shadow:0 0 0 2px rgba(76,110,245,.15); }",
        ".org-wrap { display:flex; justify-content:center; padding:10px 0 30px; }",
        ".org-node { display:inline-flex; flex-direction:column; align-items:center; }",
        ".org-vline { width:1px; height:20px; background:#ccc; flex-shrink:0; }",
        ".org-children { display:flex; }",
        ".org-child-wrap { display:flex; flex-direction:column; align-items:center; padding:20px 12px 0; position:relative; }",
        ".org-child-wrap::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:#ccc; }",
        ".org-child-wrap:first-child::before { left:50%; }",
        ".org-child-wrap:last-child::before  { right:50%; }",
        ".org-child-wrap:only-child::before  { display:none; }",
        ".org-child-wrap::after { content:''; position:absolute; top:0; left:50%; width:1px; height:20px; background:#ccc; }",
        ".itc-card { display:flex; align-items:center; gap:10px; background:#fff; border:1px solid #e2e8f0; border-radius:8px;",
        "  padding:10px 14px; cursor:pointer; position:relative; overflow:hidden;",
        "  transition:box-shadow .12s,border-color .12s; min-width:190px; max-width:240px; }",
        ".itc-card:hover { box-shadow:0 3px 10px rgba(0,0,0,.08); }",
        ".itc-bar { position:absolute; left:0; top:0; bottom:0; width:4px; }",
        ".itc-av { width:38px; height:38px; border-radius:50%; flex-shrink:0;",
        "  display:flex; align-items:center; justify-content:center;",
        "  color:#fff; font-size:13px; font-weight:700; overflow:hidden; }",
        ".itc-av img { width:100%; height:100%; object-fit:cover; }",
        ".itc-info { flex:1; min-width:0; }",
        ".itc-name { font-size:13px; font-weight:600; color:#1a202c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
        ".itc-desg { font-size:11px; color:#718096; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
        ".itc-tags { display:flex; gap:4px; margin-top:3px; flex-wrap:wrap; }",
        ".itc-tag { font-size:10px; font-weight:600; padding:2px 8px; border-radius:4px; white-space:nowrap; }",
        ".itc-td { color:#fff; }",
        ".itc-tb { background:#f1f3f5; color:#718096; border:1px solid #e2e8f0; }",
    ].join(" ");
    document.head.appendChild(s);
}

var _obs = null;

function onOrgChart() {
    return window.location.href.indexOf("organizational-chart") !== -1;
}

function startWatching() {
    if (_obs) { _obs.disconnect(); _obs = null; }
    if (tryInject()) return;
    _obs = new MutationObserver(function () {
        if (tryInject()) { _obs.disconnect(); _obs = null; }
    });
    _obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { if (_obs) { _obs.disconnect(); _obs = null; } }, 15000);
}

function stopWatching() {
    if (_obs) { _obs.disconnect(); _obs = null; }
    _allEmps = []; _allDepts = []; _allBranches = [];
    _deptFilter = ""; _branchFilter = "";
    // Remove injected filter wraps from HRMS bar
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
    root.innerHTML = '<div id="itc-list"><div class="itc-empty">Loading\u2026</div></div>';
    hrms.parentNode.insertBefore(root, hrms);

    loadAndRender();
    return true;
}

// Find the HRMS filter bar that contains the company selector
function getHRMSFilterContainer() {
    var inp = document.querySelector('input[data-fieldname="company"]');
    if (!inp) return null;
    // Try known Frappe page filter containers first
    var container = inp.closest('.standard-filter-section') ||
                    inp.closest('.page-form') ||
                    inp.closest('.filter-row');
    if (container) return container;
    // Fallback: walk up 4 levels from the input
    var el = inp;
    for (var i = 0; i < 4; i++) { el = el && el.parentNode; }
    return el || null;
}

function injectFiltersNearCompany() {
    if (document.getElementById("itc-dept-wrap")) return; // already injected

    var container = getHRMSFilterContainer();
    if (!container) return;

    function makeWrap(id, labelText, items, currentVal, onChange) {
        var wrap = document.createElement("div");
        wrap.id = id + "-wrap";
        wrap.className = "itc-filter-wrap";
        var lbl = document.createElement("label");
        lbl.textContent = labelText;
        var sel = document.createElement("select");
        sel.id = id;
        sel.className = "itc-select";
        var opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = "All " + labelText + "s";
        sel.appendChild(opt0);
        items.forEach(function (item) {
            var opt = document.createElement("option");
            opt.value = item;
            opt.textContent = item;
            if (item === currentVal) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener("change", function () { onChange(this.value); });
        wrap.appendChild(lbl);
        wrap.appendChild(sel);
        return wrap;
    }

    var deptWrap = makeWrap("itc-dept-filter", "Department", _allDepts, _deptFilter, function (val) {
        _deptFilter = val;
        renderTree();
    });
    var branchWrap = makeWrap("itc-branch-filter", "Branch", _allBranches, _branchFilter, function (val) {
        _branchFilter = val;
        renderTree();
    });

    container.appendChild(deptWrap);
    container.appendChild(branchWrap);
}

function loadAndRender() {
    var company = frappe.defaults.get_default("company");
    if (!company) {
        var el = document.getElementById("itc-list");
        if (el) el.innerHTML = '<div class="itc-empty">No default company set</div>';
        return;
    }
    frappe.call({
        method: "business_theme_v14.api.org_chart.get_org_chart_data",
        args: { company: company },
        callback: function (r) {
            if (r && r.message) {
                var msg = r.message;
                _allEmps = msg.employees || [];
                // Fallback: compute from employees if API doesn't return lists
                _allDepts = msg.departments && msg.departments.length ? msg.departments :
                    _allEmps.map(function (e) { return e.department; })
                             .filter(function (v, i, a) { return v && a.indexOf(v) === i; })
                             .sort();
                _allBranches = msg.branches && msg.branches.length ? msg.branches :
                    _allEmps.map(function (e) { return e.branch; })
                             .filter(function (v, i, a) { return v && a.indexOf(v) === i; })
                             .sort();
                injectFiltersNearCompany();
                renderTree();
            }
        },
        error: function () {
            var el = document.getElementById("itc-list");
            if (el) el.innerHTML = '<div class="itc-empty">Error loading data</div>';
        }
    });
}

function getFilteredEmps() {
    if (!_deptFilter && !_branchFilter) return _allEmps;

    var empMap = {};
    _allEmps.forEach(function (e) { empMap[e.id] = e; });

    var included = {};
    function includeWithAncestors(id) {
        if (included[id]) return;
        included[id] = true;
        var e = empMap[id];
        if (e && e.reports_to && empMap[e.reports_to]) includeWithAncestors(e.reports_to);
    }
    _allEmps.forEach(function (e) {
        var deptOk = !_deptFilter || e.department === _deptFilter;
        var branchOk = !_branchFilter || e.branch === _branchFilter;
        if (deptOk && branchOk) includeWithAncestors(e.id);
    });

    return _allEmps.filter(function (e) { return included[e.id]; });
}

function renderTree() {
    var el = document.getElementById("itc-list");
    if (!el) return;
    el.innerHTML = buildTreeHtml(getFilteredEmps());
    el.addEventListener("click", function (ev) {
        var card = ev.target.closest && ev.target.closest(".itc-card");
        if (card && card.dataset.id) frappe.set_route("app", "employee", card.dataset.id);
    });
}

function buildTreeHtml(emps) {
    if (!emps || !emps.length) return '<div class="itc-empty">No employees found</div>';

    var map = {}, i, e;
    for (i = 0; i < emps.length; i++) { e = emps[i]; map[e.id] = { d: e, ch: [] }; }
    var roots = [];
    for (i = 0; i < emps.length; i++) {
        e = emps[i];
        if (e.reports_to && map[e.reports_to]) { map[e.reports_to].ch.push(map[e.id]); }
        else { roots.push(map[e.id]); }
    }
    function srt(n) {
        n.ch.sort(function (a, b) { return a.d.name.localeCompare(b.d.name); });
        for (var j = 0; j < n.ch.length; j++) srt(n.ch[j]);
    }
    for (i = 0; i < roots.length; i++) srt(roots[i]);
    roots.sort(function (a, b) { return a.d.name.localeCompare(b.d.name); });

    var html = '<div class="org-wrap">';
    for (i = 0; i < roots.length; i++) html += nodeH(roots[i], 0, i);
    html += '</div>';
    return html;
}

function nodeH(node, depth, colorIdx) {
    var d = node.d, kids = node.ch;
    var color = palColor(colorIdx);

    var h = '<div class="org-node">';
    h += '<div class="itc-card" data-id="' + esc(d.id) + '">';
    h += '<div class="itc-bar" style="background:' + color + '"></div>';
    h += '<div class="itc-av" style="background:' + color + '">';
    if (d.image) {
        h += '<img src="' + esc(d.image) + '" alt="">';
    } else {
        h += initials(d.name);
    }
    h += '</div>';
    h += '<div class="itc-info">';
    h += '<div class="itc-name">' + esc(d.name) + '</div>';
    if (d.designation) h += '<div class="itc-desg">' + esc(d.designation) + '</div>';
    h += '<div class="itc-tags">';
    if (d.department) h += '<span class="itc-tag itc-td" style="background:' + color + '">' + esc(d.department) + '</span>';
    if (d.branch) h += '<span class="itc-tag itc-tb">' + esc(d.branch) + '</span>';
    h += '</div>';
    h += '</div>';
    h += '</div>';

    if (kids.length > 0) {
        h += '<div class="org-vline"></div><div class="org-children">';
        for (var j = 0; j < kids.length; j++) {
            var childColor = depth === 0 ? j + 1 : colorIdx;
            h += '<div class="org-child-wrap">' + nodeH(kids[j], depth + 1, childColor) + '</div>';
        }
        h += '</div>';
    }
    h += '</div>';
    return h;
}

$(document).on("page-change", function () {
    if (onOrgChart()) { startWatching(); } else { stopWatching(); }
});

$(document).ready(function () {
    if (onOrgChart()) startWatching();
});

})();
