/**
 * ITChamps Custom Org Chart
 * Loaded globally via app_include_js, activated on page-change.
 */

(function () {

// ── Inject styles once ──
function injectStyles() {
	if (document.getElementById("itc-styles")) return;
	var s = document.createElement("style");
	s.id = "itc-styles";
	s.textContent = `
.itc-page { padding: 20px 16px 40px; overflow-x: auto; }
.itc-empty { text-align: center; padding: 60px 20px; color: #718096; }

.org-wrap { display: flex; justify-content: center; padding: 10px 0 30px; }
.org-node { display: inline-flex; flex-direction: column; align-items: center; }

.itc-card {
	border-radius: 8px; padding: 12px 18px;
	min-width: 130px; max-width: 190px;
	text-align: center; cursor: pointer;
	border: 1.5px solid; box-sizing: border-box;
	transition: filter .15s;
}
.itc-card:hover { filter: brightness(.93); }
.org-card-name { font-size: 14px; font-weight: 600; margin-bottom: 3px; }
.org-card-info { font-size: 11px; line-height: 1.4; }

.org-vline { width: 1px; height: 20px; background: #ccc; flex-shrink: 0; }

.org-children { display: flex; }
.org-child-wrap {
	display: flex; flex-direction: column; align-items: center;
	padding: 20px 12px 0; position: relative;
}
.org-child-wrap::before {
	content: ''; position: absolute; top: 0;
	left: 0; right: 0; height: 1px; background: #ccc;
}
.org-child-wrap:first-child::before { left: 50%; }
.org-child-wrap:last-child::before  { right: 50%; }
.org-child-wrap:only-child::before  { display: none; }
.org-child-wrap::after {
	content: ''; position: absolute; top: 0; left: 50%;
	width: 1px; height: 20px; background: #ccc;
}
[data-theme=dark] .org-vline,
[data-theme=dark] .org-child-wrap::before,
[data-theme=dark] .org-child-wrap::after { background: #4a5568; }
`;
	document.head.appendChild(s);
}

// ── Color palette ──
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

// ── Check if we are on the org chart page ──
function onOrgChartPage() {
	return frappe.get_route_str && frappe.get_route_str() === 'organizational-chart';
}

// ── Main: hook into Frappe page-change (same as sycone_footer.js) ──
$(document).on("page-change", function () {
	if (!onOrgChartPage()) return;
	setTimeout(tryClaimPage, 50); // small delay lets HRMS render first
});

// Also handle direct navigation (user loads /app/organizational-chart directly)
$(document).ready(function () {
	setTimeout(function () {
		if (onOrgChartPage()) tryClaimPage();
	}, 800);
});

function tryClaimPage() {
	var pg = frappe.pages && frappe.pages["organizational-chart"];
	if (!pg || !pg.wrapper) return;
	injectStyles();
	claimPage(pg.wrapper);
}

// ────────────────────────────────────────
// CLAIM: wipe HRMS content, install ours
// ────────────────────────────────────────
function claimPage(wrapper) {
	var page = wrapper.page;

	if (!page) {
		page = frappe.ui.make_app_page({
			parent: wrapper,
			title: __("Organizational Chart"),
			single_column: true,
		});
		wrapper.page = page;
	}

	// Remove HRMS show handler so it cannot re-render over us
	$(wrapper).off('show').on('show.itc', function () {
		refreshPage(wrapper);
	});

	// Clear HRMS filter bar (Dept / Branch dropdowns)
	$(wrapper).find('.page-form').html('');

	// Add company selector once
	if (!wrapper._itc_co) {
		wrapper._itc_co = page.add_field({
			fieldname: "company", label: __("Company"), fieldtype: "Link",
			options: "Company", default: frappe.defaults.get_default("company"), reqd: 1,
			change: function () { fetchAndRender(wrapper); }
		});
	}

	$(page.body || page.main).html(
		'<div id="itc-list"><div class="itc-empty">' + __("Loading...") + '</div></div>'
	);

	fetchAndRender(wrapper);
}

function refreshPage(wrapper) {
	var page = wrapper.page;
	if (!page) return;
	if (!document.getElementById('itc-list')) {
		$(page.body || page.main).html(
			'<div id="itc-list"><div class="itc-empty">' + __("Loading...") + '</div></div>'
		);
	}
	fetchAndRender(wrapper);
}

// ────────────────────────────
// FETCH
// ────────────────────────────
function fetchAndRender(wrapper) {
	var co = wrapper._itc_co
		? wrapper._itc_co.get_value()
		: frappe.defaults.get_default("company");

	if (!co) {
		$("#itc-list").html('<div class="itc-empty">' + __("Select a company") + '</div>');
		return;
	}

	$("#itc-list").html('<div class="itc-empty">' + __("Loading...") + '</div>');

	frappe.call({
		method: "business_theme_v14.api.org_chart.get_org_chart_data",
		args: { company: co },
		callback: function (r) {
			if (!r.message) return;
			doRender(r.message.employees || []);
		},
		error: function () {
			$("#itc-list").html('<div class="itc-empty">' + __("Error loading data") + '</div>');
		}
	});
}

// ────────────────────────────
// RENDER
// ────────────────────────────
function doRender(emps) {
	if (!emps || !emps.length) {
		$("#itc-list").html('<div class="itc-empty">' + __("No employees found") + '</div>');
		return;
	}

	var map = {}, i, e;
	for (i = 0; i < emps.length; i++) { e = emps[i]; map[e.id] = { d: e, ch: [] }; }
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
		n.ch.sort(function (a, b) { return a.d.name.localeCompare(b.d.name); });
		for (var j = 0; j < n.ch.length; j++) srt(n.ch[j]);
	}
	for (i = 0; i < roots.length; i++) srt(roots[i]);
	roots.sort(function (a, b) { return a.d.name.localeCompare(b.d.name); });

	var html = '<div class="org-wrap">';
	for (i = 0; i < roots.length; i++) html += nodeH(roots[i], 0, i);
	html += '</div>';

	$("#itc-list").html(html);

	$("#itc-list").off("click", ".itc-card").on("click", ".itc-card", function () {
		var id = $(this).data("id");
		if (id) frappe.set_route("app", "employee", id);
	});
}

// ────────────────────────────
// NODE HTML
// ────────────────────────────
function nodeH(node, depth, sibIdx) {
	var d = node.d, kids = node.ch;
	var c = paletteFor(depth, sibIdx);
	var parts = [d.designation, d.department, d.branch].filter(function (v) { return !!v; });

	var h = '<div class="org-node">';
	h += '<div class="itc-card" data-id="' + esc(d.id) + '"'
		+ ' style="background:' + c.bg + ';border-color:' + c.bd + ';color:' + c.tx + '">';
	h += '<div class="org-card-name">' + esc(d.name) + '</div>';
	if (parts.length) h += '<div class="org-card-info">' + esc(parts.join(' · ')) + '</div>';
	h += '</div>';

	if (kids.length > 0) {
		h += '<div class="org-vline"></div><div class="org-children">';
		for (var j = 0; j < kids.length; j++) {
			h += '<div class="org-child-wrap">' + nodeH(kids[j], depth + 1, j) + '</div>';
		}
		h += '</div>';
	}

	h += '</div>';
	return h;
}

})();
