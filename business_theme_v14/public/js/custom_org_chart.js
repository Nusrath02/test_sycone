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

// ── Color palette (depth + sibling index) ──
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

// ────────────────────────────
// INSTALL HOOKS (safe, re-runnable)
// ────────────────────────────
function itc_install_hooks() {
	var pg = frappe.pages && frappe.pages["organizational-chart"];
	if (!pg) return;

	pg.on_page_load = function (wrapper) {
		wrapper.itc_page = frappe.ui.make_app_page({
			parent: wrapper,
			title: __("Organizational Chart"),
			single_column: true,
		});
		$(wrapper).off("show.itc").on("show.itc", function () {
			itc_setup(wrapper);
		});
	};

	// on_page_show fires every visit — guarantees our UI even if HRMS
	// ran on_page_load first.
	pg.on_page_show = function () {
		var wrapper = this.wrapper || pg.wrapper;
		if (wrapper) itc_setup(wrapper);
	};
}

itc_install_hooks();
setTimeout(itc_install_hooks, 0);
setTimeout(itc_install_hooks, 300);

// ────────────────────────────
// SETUP
// ────────────────────────────
function itc_setup(wrapper) {
	var page = wrapper.itc_page || wrapper.page || null;

	if (!page) {
		$(wrapper).find(".page-body").html('');
		page = frappe.ui.make_app_page({
			parent: wrapper,
			title: __("Organizational Chart"),
			single_column: true,
		});
		wrapper.itc_page = page;
	}

	if (!wrapper._itc_done) {
		wrapper._itc_done = true;
		page._co = page.add_field({
			fieldname: "company", label: __("Company"), fieldtype: "Link",
			options: "Company", default: frappe.defaults.get_default("company"), reqd: 1,
			change: function () { doLoad(page); }
		});
	}

	if (!document.getElementById("itc-page")) {
		$(page.body || page.main).html(
			'<div class="itc-page" id="itc-page">' +
			'<div id="itc-list"><div class="itc-empty">' + __("Loading...") + '</div></div>' +
			'</div>'
		);
	}

	doLoad(page);
}

// ────────────────────────────
// LOAD (API call)
// ────────────────────────────
function doLoad(page) {
	var co = page._co ? page._co.get_value() : frappe.defaults.get_default("company");
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
			var emps = r.message.employees || [];
			doRender(emps);
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

})();
