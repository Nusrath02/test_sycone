// ITChamps Custom Org Chart

(function () {

var PAL = ["#4C6EF5","#E8590C","#0CA678","#E64980","#7950F2","#1098AD","#D6336C","#5C940D","#1C7ED6","#AE3EC9","#2B8A3E","#F59F00","#C92A2A","#087F5B","#845EF7"];

var _allEmps = [];
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
        "#itc-org-root { padding: 20px 16px 40px; overflow-x: auto; }",
        ".itc-empty { text-align:center; padding:60px 20px; color:#718096; }",
        ".itc-filter-bar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; align-items:center; }",
        ".itc-filter-bar label { font-size:11px; font-weight:600; color:#718096; margin-bottom:2px; display:block; }",
        ".itc-filter-wrap { display:flex; flex-direction:column; }",
        ".itc-select { height:32px; padding:0 28px 0 10px; border:1px solid #d1d5db; border-radius:6px; font-size:12px; color:#374151; background:#fff; appearance:none; -webkit-appearance:none;",
        "  background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7280'/%3E%3C/svg%3E\");",
        "  background-repeat:no-repeat; background-position:right 10px center; cursor:pointer; min-width:180px; }",
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
        "[data-theme=dark] .itc-card { background:#1a1a2e; border-color:#2d2d44; }",
        "[data-theme=dark] .itc-name { color:#e2e8f0; }",
        "[data-theme=dark] .itc-select { background-color:#1a1a2e; color:#e2e8f0; border-color:#2d2d44; }",
        "[data-theme=dark] .itc-tb { background:rgba(255,255,255,.08); }",
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
    _allEmps = [];
    _deptFilter = "";
    _branchFilter = "";
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

function loadAndRender() {
    var company = frappe.defaults.get_default("company");
    if (!company) {
        document.getElementById("itc-list").innerHTML = '<div class="itc-empty">No default company set</div>';
        return;
    }
    frappe.call({
        method: "business_theme_v14.api.org_chart.get_org_chart_data",
        args: { company: company },
        callback: function (r) {
            if (r && r.message) {
                _allEmps = r.message.employees || [];
                renderAll();
            }
        },
        error: function () {
            var el = document.getElementById("itc-list");
            if (el) el.innerHTML = '<div class="itc-empty">Error loading data</div>';
        }
    });
}

function renderAll() {
    var el = document.getElementById("itc-list");
    if (!el) return;

    var depts = {}, branches = {};
    _allEmps.forEach(function (e) {
        if (e.department) depts[e.department] = 1;
        if (e.branch) branches[e.branch] = 1;
    });
    var deptList = Object.keys(depts).sort();
    var branchList = Object.keys(branches).sort();

    var fh = '<div class="itc-filter-bar">';
    fh += '<div class="itc-filter-wrap"><label>Department</label>';
    fh += '<select class="itc-select" id="itc-dept-filter">';
    fh += '<option value="">All Departments</option>';
    deptList.forEach(function (d) {
        fh += '<option value="' + esc(d) + '"' + (_deptFilter === d ? ' selected' : '') + '>' + esc(d) + '</option>';
    });
    fh += '</select></div>';

    fh += '<div class="itc-filter-wrap"><label>Branch</label>';
    fh += '<select class="itc-select" id="itc-branch-filter">';
    fh += '<option value="">All Branches</option>';
    branchList.forEach(function (b) {
        fh += '<option value="' + esc(b) + '"' + (_branchFilter === b ? ' selected' : '') + '>' + esc(b) + '</option>';
    });
    fh += '</select></div>';
    fh += '</div>';

    el.innerHTML = fh + '<div id="itc-tree-container"></div>';

    document.getElementById("itc-dept-filter").addEventListener("change", function () {
        _deptFilter = this.value;
        renderTree();
    });
    document.getElementById("itc-branch-filter").addEventListener("change", function () {
        _branchFilter = this.value;
        renderTree();
    });

    el.addEventListener("click", function (ev) {
        var card = ev.target.closest && ev.target.closest(".itc-card");
        if (card && card.dataset.id) frappe.set_route("app", "employee", card.dataset.id);
    });

    renderTree();
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
    var container = document.getElementById("itc-tree-container");
    if (!container) return;

    var emps = getFilteredEmps();
    if (!emps || !emps.length) {
        container.innerHTML = '<div class="itc-empty">No employees found</div>';
        return;
    }

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
    container.innerHTML = html;
}

// colorIdx is inherited from top-level ancestor; root children each get their own PAL slot
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
            // Root's children each get their own color; deeper nodes inherit parent's color
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
