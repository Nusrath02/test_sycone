/**
 * ITChamps Custom Org Chart
 * Visual org chart with colored boxes and connecting lines.
 */

(function () {

// ── Inject styles ──
if (!document.getElementById("itc-styles")) {
	var s = document.createElement("style");
	s.id = "itc-styles";
	s.textContent = `
.itc-page { padding: 20px 16px 40px; overflow-x: auto; }
.itc-empty { text-align: center; padding: 60px 20px; color: #718096; }

/* Org chart layout */
.org-wrap { display: flex; justify-content: center; padding: 10px 0 30px; }
.org-node { display: inline-flex; flex-direction: column; align-items: center; }

/* Card box */
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

/* Vertical line from card down to children bar */
.org-vline { width: 1px; height: 20px; background: #ccc; flex-shrink: 0; }

/* Children row */
.org-children { display: flex; }
.org-child-wrap {
	display: flex; flex-direction: column; align-items: center;
	padding: 20px 12px 0; position: relative;
}
/* Horizontal connector spanning siblings */
.org-child-wrap::before {
	content: ''; position: absolute; top: 0;
	left: 0; right: 0; height: 1px; background: #ccc;
}
.org-child-wrap:first-child::before { left: 50%; }
.org-child-wrap:last-child::before  { right: 50%; }
.org-child-wrap:only-child::before  { display: none; }
/* Vertical drop from horizontal bar to card */
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
	{ bg: '#ede9fc', bd: '#7c3aed', tx: '#5b21b6' }, // purple  – root
	{ bg: '#d1fae5', bd: '#059669', tx: '#065f46' }, // green   – level 1, idx 0
	{ bg: '#fee2e2', bd: '#dc2626', tx: '#991b1b' }, // red     – level 1, idx 1
	{ bg: '#dbeafe', bd: '#2563eb', tx: '#1e40af' }, // blue    – level 2+
	{ bg: '#fef3c7', bd: '#d97706', tx: '#92400e' }, // amber
	{ bg: '#fce7f3', bd: '#db2777', tx: '#9d174d' }, // pink
];

function paletteFor(depth, sibIdx) {
	if (depth === 0) return PALETTE[0];
	if (depth === 1) return PALETTE[1 + (sibIdx % (PALETTE.length - 1))];
	return PALETTE[3];
}

function esc(s) { return frappe.utils.escape_html(s || ""); }

// ────────────────────────────────────────
// MAIN ENTRY — runs after bundle finishes
// ────────────────────────────────────────
function start() {
	var pg = frappe.pages && frappe.pages["organizational-chart"];
	if (!pg) {
		// Page not registered yet — retry
		setTimeout(start, 200);
		return;
	}

	// Override on_page_load so future clean navigations use our version
	pg.on_page_load = function (wrapper) {
		pg.wrapper = wrapper;
		claimPage(wrapper);
	};

	// If the page is already loaded (user refreshed on org chart URL),
	// take over the existing wrapper immediately
	if (pg.wrapper) {
		claimPage(pg.wrapper);
	}
}

// ────────────────────────────────────────
// CLAIM: wipe HRMS content, install ours
// ────────────────────────────────────────
function claimPage(wrapper) {
	// frappe.ui.make_app_page sets opts.parent.page — so wrapper.page exists
	// after HRMS (or Frappe) called make_app_page.  We reuse that page object.
	var page = wrapper.page;

	if (!page) {
		// Fallback: HRMS hasn't run yet (first-load path via on_page_load)
		page = frappe.ui.make_app_page({
			parent: wrapper,
			title: __("Organizational Chart"),
			single_column: true,
		});
		wrapper.page = page;
	}

	// ── Remove HRMS's show handler so it cannot re-render over us ──
	// jQuery's .off('show') removes all non-namespaced show listeners.
	// Frappe core fires the show event but does NOT listen to it, so this is safe.
	$(wrapper).off('show');
	$(wrapper).on('show.itc', function () {
		refreshPage(wrapper);
	});

	// ── Clear HRMS filter bar (Dept / Branch dropdowns) ──
	$(wrapper).find('.page-form').html('');

	// ── Add company selector once ──
	if (!wrapper._itc_co) {
		wrapper._itc_co = page.add_field({
			fieldname: "company", label: __("Company"), fieldtype: "Link",
			options: "Company", default: frappe.defaults.get_default("company"), reqd: 1,
			change: function () { fetchAndRender(wrapper); }
		});
	}

	// ── Replace main content ──
	$(page.body || page.main).html(
		'<div id="itc-list"><div class="itc-empty">' + __("Loading...") + '</div></div>'
	);

	fetchAndRender(wrapper);
}

// Called every time the page becomes visible again (navigate away → back)
function refreshPage(wrapper) {
	var page = wrapper.page;
	if (!page) return;

	// Re-inject our container if something else cleared it
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
	var info = parts.join(' · ');

	var h = '<div class="org-node">';
	h += '<div class="itc-card" data-id="' + esc(d.id) + '"'
		+ ' style="background:' + c.bg + ';border-color:' + c.bd + ';color:' + c.tx + '">';
	h += '<div class="org-card-name">' + esc(d.name) + '</div>';
	if (info) h += '<div class="org-card-info">' + esc(info) + '</div>';
	h += '</div>';

	if (kids.length > 0) {
		h += '<div class="org-vline"></div>';
		h += '<div class="org-children">';
		for (var j = 0; j < kids.length; j++) {
			h += '<div class="org-child-wrap">' + nodeH(kids[j], depth + 1, j) + '</div>';
		}
		h += '</div>';
	}

	h += '</div>';
	return h;
}

// ── Kick off after current call stack clears ──
// setTimeout(0) ensures all synchronous bundle code (including HRMS's
// on_page_load registration) has finished before we install our override.
setTimeout(start, 0);

})();
