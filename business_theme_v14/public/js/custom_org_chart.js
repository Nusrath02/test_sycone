/**
 * ITChamps Custom Org Chart
 * Plain tree based on reports_to — no dept/branch filters.
 */

(function () {

// ── Inject styles ──
if (!document.getElementById("itc-styles")) {
	var s = document.createElement("style");
	s.id = "itc-styles";
	s.textContent = `
.itc-page { padding: 10px 16px 40px; max-width: 1000px; margin: 0 auto; }
.itc-empty { text-align: center; padding: 60px 20px; color: #718096; }
.itc-card {
	display: flex; align-items: center; gap: 8px;
	padding: 4px 6px; margin-bottom: 2px; cursor: pointer;
	border-radius: 4px; background: transparent; border: none;
}
.itc-card:hover { background: #f3f4f6; }
.itc-card:hover .itc-label { color: #4C6EF5; }
.itc-label { font-size: 13px; color: #374151; white-space: nowrap; }
.itc-tog {
	display: flex; align-items: center; justify-content: center;
	background: none; border: none; padding: 0; cursor: pointer;
	color: #6b7280; flex-shrink: 0;
}
.itc-tog:hover { color: #374151; }
.itc-icon { display: flex; align-items: center; color: #9ca3af; flex-shrink: 0; }
.itc-children { margin-left: 20px; padding-left: 12px; border-left: 1px solid #d1d5db; }
.itc-children.itc-hidden { display: none; }
[data-theme=dark] .itc-card:hover { background: rgba(255,255,255,.06); }
[data-theme=dark] .itc-label { color: #e2e8f0; }
[data-theme=dark] .itc-children { border-left-color: #2d2d44; }
`;
	document.head.appendChild(s);
}

// ── Icons ──
var ICON_FOLDER = '<svg width="16" height="14" viewBox="0 0 24 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
var ICON_FOLDER_CLOSED = '<svg width="16" height="14" viewBox="0 0 24 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"><path d="M22 17a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
var ICON_CIRCLE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>';

function esc(s) { return frappe.utils.escape_html(s || ""); }

// ────────────────────────────
// OVERRIDE: Replace HRMS page
// ────────────────────────────
var _orig_on_page_load = frappe.pages["organizational-chart"].on_page_load;
frappe.pages["organizational-chart"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Organizational Chart"),
		single_column: true,
	});
	wrapper.itc_page = page;

	$(wrapper).off("show").on("show", function () {
		itc_setup(wrapper);
	});
};

var cur_page = window.cur_page;
if (cur_page && cur_page.page && cur_page.page.label === "organizational-chart") {
	setTimeout(function () {
		var wrapper = document.querySelector('[data-page-container="organizational-chart"]')
			|| document.querySelector('.page-container[data-page="organizational-chart"]');
		if (wrapper) itc_setup(wrapper);
	}, 100);
}

// ────────────────────────────
// SETUP
// ────────────────────────────
function itc_setup(wrapper) {
	var page = wrapper.itc_page;
	if (!page) {
		page = wrapper.page || null;
		if (!page) {
			$(wrapper).find(".page-body").html('');
			page = frappe.ui.make_app_page({
				parent: wrapper,
				title: __("Organizational Chart"),
				single_column: true,
			});
			wrapper.itc_page = page;
		}
	}

	if (!wrapper._itc_done) {
		wrapper._itc_done = true;

		page._co = page.add_field({
			fieldname: "company", label: __("Company"), fieldtype: "Link",
			options: "Company", default: frappe.defaults.get_default("company"), reqd: 1,
			change: function () { doLoad(page); }
		});

		$(page.body || page.main).html(
			'<div class="itc-page" id="itc-page">' +
			'<div id="itc-list"><div class="itc-empty">' + __("Loading...") + '</div></div>' +
			'</div>'
		);
	} else {
		if (!document.getElementById("itc-page")) {
			$(page.body || page.main).html(
				'<div class="itc-page" id="itc-page">' +
				'<div id="itc-list"><div class="itc-empty">' + __("Loading...") + '</div></div>' +
				'</div>'
			);
		}
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
			emps.sort(function (a, b) { return a.name.localeCompare(b.name); });
			doRender(emps);
		},
		error: function () {
			$("#itc-list").html('<div class="itc-empty">' + __("Error loading data") + '</div>');
		}
	});
}

// ────────────────────────────
// RENDER (tree)
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

	var html = '';
	for (i = 0; i < roots.length; i++) html += nodeH(roots[i]);
	$("#itc-list").html(html);

	$("#itc-list").off("click", ".itc-card").on("click", ".itc-card", function () {
		var id = $(this).data("id");
		if (id) frappe.set_route("app", "employee", id);
	});
	$("#itc-list").off("click", ".itc-tog").on("click", ".itc-tog", function (ev) {
		ev.stopPropagation();
		var $ch = $(this).closest(".itc-card").next(".itc-children");
		$ch.toggleClass("itc-hidden");
		$(this).html($ch.hasClass("itc-hidden") ? ICON_FOLDER_CLOSED : ICON_FOLDER);
	});
}

// ────────────────────────────
// NODE HTML (tree row)
// ────────────────────────────
function nodeH(node) {
	var d = node.d, kids = node.ch.length;
	var icon = kids > 0
		? '<button class="itc-tog">' + ICON_FOLDER + '</button>'
		: '<span class="itc-icon">' + ICON_CIRCLE + '</span>';

	var h = '<div class="itc-card" data-id="' + esc(d.id) + '">';
	h += icon;
	h += '<span class="itc-label">' + esc(d.name) + ' (' + esc(d.id) + ')</span>';
	h += '</div>';

	if (kids > 0) {
		h += '<div class="itc-children">';
		for (var j = 0; j < kids; j++) h += nodeH(node.ch[j]);
		h += '</div>';
	}
	return h;
}

})();
