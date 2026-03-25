
// sycone_footer.js - Improved version
function createSyconEFooter() {
    // Remove existing footer first
    $('.sycone-custom-footer').remove();

    const footerHTML = `
        <div class="sycone-custom-footer">
            <div class="sycone-footer-content">
                <div class="sycone-copyright">
                    <span>© 2026 SYConE CPMC Pvt Ltd. All Rights Reserved | Design: ITChamps</span>
                </div>
                <img src="/assets/business_theme_v14/images/SYConE Final Logo1.png"
                     alt="SYConE Logo"
                     class="sycone-footer-logo"
                     onerror="this.style.display='none'">
            </div>
        </div>
    `;

    // Append to body
    $('body').append(footerHTML);
}

// Initialize footer when DOM is ready
$(document).ready(function() {
    createSyconEFooter();
});

// Re-create on Frappe page changes (SPA navigation)
$(document).on("page-change", function() {
    setTimeout(createSyconEFooter, 100);
});


// ─────────────────────────────────────────────────────────────
// ITChamps Custom Org Chart
// Merged here because sycone_footer.js is the confirmed-loading file.
// ─────────────────────────────────────────────────────────────
(function () {

var PALETTE = [
    { bg: '#ede9fc', bd: '#7c3aed', tx: '#5b21b6' },
    { bg: '#d1fae5', bd: '#059669', tx: '#065f46' },
    { bg: '#fee2e2', bd: '#dc2626', tx: '#991b1b' },
    { bg: '#dbeafe', bd: '#2563eb', tx: '#1e40af' },
    { bg: '#fef3c7', bd: '#d97706', tx: '#92400e' },
    { bg: '#fce7f3', bd: '#db2777', tx: '#9d174d' },
];

function paletteFor(depth, sibIdx) {
    if (depth === 0) return PALETTE[0];
    if (depth === 1) return PALETTE[1 + (sibIdx % (PALETTE.length - 1))];
    return PALETTE[3];
}

function esc(s) { return frappe.utils.escape_html(s || ""); }

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
    // Clean up our chart so fresh render on next visit
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
            if (r && r.message) doRender(r.message.employees || []);
        },
        error: function () {
            var el = document.getElementById("itc-list");
            if (el) el.innerHTML = '<div class="itc-empty">Error loading data</div>';
        }
    });
}

function doRender(emps) {
    var el = document.getElementById("itc-list");
    if (!el) return;
    if (!emps || !emps.length) { el.innerHTML = '<div class="itc-empty">No employees found</div>'; return; }

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
    el.innerHTML = html;

    el.addEventListener("click", function (ev) {
        var card = ev.target.closest && ev.target.closest(".itc-card");
        if (card && card.dataset.id) frappe.set_route("app", "employee", card.dataset.id);
    });
}

function nodeH(node, depth, sibIdx) {
    var d = node.d, kids = node.ch, c = paletteFor(depth, sibIdx);
    var parts = [d.designation, d.department, d.branch].filter(function (v) { return !!v; });
    var h = '<div class="org-node">';
    h += '<div class="itc-card" data-id="' + esc(d.id) + '"'
        + ' style="background:' + c.bg + ';border-color:' + c.bd + ';color:' + c.tx + '">';
    h += '<div class="org-card-name">' + esc(d.name) + '</div>';
    if (parts.length) h += '<div class="org-card-info">' + esc(parts.join(" \u00b7 ")) + '</div>';
    h += '</div>';
    if (kids.length > 0) {
        h += '<div class="org-vline"></div><div class="org-children">';
        for (var j = 0; j < kids.length; j++)
            h += '<div class="org-child-wrap">' + nodeH(kids[j], depth + 1, j) + '</div>';
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
