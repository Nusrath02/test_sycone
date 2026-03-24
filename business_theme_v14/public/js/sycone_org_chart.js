/**
 * ITChamps Custom Org Chart
 * Vertical indented tree with department/branch filter dropdowns.
 * Loaded via app_include_js — active on every page, sets up only
 * when user navigates to organizational-chart.
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
	display: flex; align-items: center; gap: 10px;
	background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
	padding: 10px 14px; margin-bottom: 6px; cursor: pointer;
	position: relative; overflow: hidden;
	transition: box-shadow .12s, border-color .12s;
}
.itc-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,.08); border-color: #4C6EF5; }
.itc-bar { position:absolute; left:0; top:0; bottom:0; width:4px; }
.itc-av {
	width:38px; height:38px; border-radius:50%; flex-shrink:0;
	display:flex; align-items:center; justify-content:center;
	color:#fff; font-size:13px; font-weight:700; overflow:hidden;
}
.itc-av img { width:100%; height:100%; object-fit:cover; }
.itc-info { flex:1; min-width:0; }
.itc-name { font-size:13px; font-weight:600; color:#1a202c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.itc-desg { font-size:11px; color:#718096; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.itc-tags { display:flex; gap:4px; margin-top:3px; flex-wrap:wrap; }
.itc-tag { font-size:9px; font-weight:600; padding:1px 6px; border-radius:3px; white-space:nowrap; }
.itc-td { border:1px solid; }
.itc-tb { background:#f1f3f5; color:#718096; }
.itc-badge { font-size:10px; color:#718096; white-space:nowrap; flex-shrink:0; }
.itc-tog {
	width:22px; height:22px; border-radius:50%; border:1px solid #cbd5e0;
	background:#fff; color:#718096; font-size:12px; line-height:20px;
	text-align:center; cursor:pointer; padding:0; flex-shrink:0;
}
.itc-tog:hover { background:#f7fafc; }
.itc-children { margin-left:24px; padding-left:16px; border-left:2px solid #e2e8f0; }
.itc-children.itc-hidden { display:none; }
[data-theme=dark] .itc-card { background:#1a1a2e; border-color:#2d2d44; }
[data-theme=dark] .itc-card:hover { box-shadow:0 3px 10px rgba(0,0,0,.3); }
[data-theme=dark] .itc-name { color:#e2e8f0; }
[data-theme=dark] .itc-tog { background:#1a1a2e; border-color:#2d2d44; }
[data-theme=dark] .itc-children { border-left-color:#2d2d44; }
[data-theme=dark] .itc-tb { background:rgba(255,255,255,.08); }
`;
	document.head.appendChild(s);
}

// ── Colors ──
var PAL = ["#4C6EF5","#E8590C","#0CA678","#E64980","#7950F2","#1098AD","#D6336C","#5C940D","#1C7ED6","#AE3EC9","#2B8A3E","#F59F00","#C92A2A","#087F5B","#845EF7"];
var cm = {}, ci = 0;
function dcol(d) {
	if (!d) return "#868E96";
	if (!cm[d]) cm[d] = PAL[ci++ % PAL.length];
	return cm[d];
}
function esc(s) { return frappe.utils.escape_html(s || ""); }
function abr(n) {
	if (!n) return "?";
	var p = n.split(" ");
	return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : n.substring(0,2).toUpperCase();
}

// ────────────────────────────
// PATH A — page_js timing:
// frappe.pages already has the page when this script runs
// ────────────────────────────
try {
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
} catch(e) {}

// ────────────────────────────
// PATH B — app_include_js timing:
// Script loads at desk startup before page exists;
// listen for route change and set up when user navigates here.
// ────────────────────────────
$(document).on("page-change", function () {
	try {
		var route = frappe.get_route ? frappe.get_route() : [];
		if (route[0] !== "organizational-chart") return;
		var wrapper = frappe.pages && frappe.pages["organizational-chart"];
		if (!wrapper) return;
		itc_setup(wrapper);
	} catch(e) {}
});

// ────────────────────────────
// SETUP
// ────────────────────────────
function itc_setup(wrapper) {
	var page = wrapper.itc_page;
	if (!page) {
		$(wrapper).find(".page-body").html('');
		page = frappe.ui.make_app_page({
			parent: wrapper,
			title: __("Organizational Chart"),
			single_column: true,
		});
		wrapper.itc_page = page;
	}

	if (!wrapper._itc_filters_done) {
		wrapper._itc_filters_done = true;

		$(page.body || page.main).html(
			'<div class="itc-page" id="itc-page">' +
			'<div class="itc-empty">' + __("Loading...") + '</div>' +
			'</div>'
		);

		page._co = page.add_field({
			fieldname: "company", label: __("Company"), fieldtype: "Link",
			options: "Company", default: frappe.defaults.get_default("company"), reqd: 1,
			change: function () {
				if (page._dp) page._dp.set_value(__("All Departments"));
				if (page._br) page._br.set_value(__("All Branches"));
				doLoad(page);
			}
		});

		page._dp = page.add_field({
			fieldname: "department", label: __("Department"), fieldtype: "Select",
			options: __("All Departments"), default: __("All Departments"),
			change: function () { doLoad(page); }
		});

		page._br = page.add_field({
			fieldname: "branch", label: __("Branch"), fieldtype: "Select",
			options: __("All Branches"), default: __("All Branches"),
			change: function () { doLoad(page); }
		});
	} else {
		if (!document.getElementById("itc-page")) {
			$(page.body || page.main).html(
				'<div class="itc-page" id="itc-page">' +
				'<div class="itc-empty">' + __("Loading...") + '</div>' +
				'</div>'
			);
		}
	}

	doLoad(page);
}

// ────────────────────────────
// LOAD
// ────────────────────────────
function doLoad(page) {
	var co = page._co ? page._co.get_value() : frappe.defaults.get_default("company");
	if (!co) {
		$("#itc-page").html('<div class="itc-empty">' + __("Select a company") + '</div>');
		return;
	}

	var dp = (page._dp ? page._dp.get_value() : "") || "";
	var br = (page._br ? page._br.get_value() : "") || "";
	if (dp === __("All Departments")) dp = "";
	if (br === __("All Branches")) br = "";

	cm = {}; ci = 0;
	$("#itc-page").html('<div class="itc-empty">' + __("Loading...") + '</div>');

	frappe.call({
		method: "business_theme_v14.api.org_chart.get_org_chart_data",
		args: { company: co, department: dp, branch: br },
		callback: function (r) {
			if (!r.message) return;
			var d = r.message;
			if (d.departments && page._dp) {
				page._dp.df.options = [__("All Departments")].concat(d.departments).join("\n");
				page._dp.refresh();
			}
			if (d.branches && page._br) {
				page._br.df.options = [__("All Branches")].concat(d.branches).join("\n");
				page._br.refresh();
			}
			doRender(d.employees);
		},
		error: function () {
			$("#itc-page").html('<div class="itc-empty">' + __("Error loading data") + '</div>');
		}
	});
}

// ────────────────────────────
// RENDER
// ────────────────────────────
function doRender(emps) {
	if (!emps || !emps.length) {
		$("#itc-page").html('<div class="itc-empty">' + __("No employees found") + '</div>');
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
	$("#itc-page").html(html);

	$("#itc-page").off("click", ".itc-card").on("click", ".itc-card", function () {
		var id = $(this).data("id");
		if (id) frappe.set_route("app", "employee", id);
	});
	$("#itc-page").off("click", ".itc-tog").on("click", ".itc-tog", function (ev) {
		ev.stopPropagation();
		var $ch = $(this).closest(".itc-card").next(".itc-children");
		var cnt = $(this).data("cnt") || 0;
		$ch.toggleClass("itc-hidden");
		$(this).text($ch.hasClass("itc-hidden") ? "+" + cnt : "\u2212");
	});
}

function nodeH(node) {
	var d = node.d, col = dcol(d.department), kids = node.ch.length;
	var av;
	if (d.image) {
		av = '<div class="itc-av"><img src="' + d.image + '"></div>';
	} else {
		av = '<div class="itc-av" style="background:' + col + '">' + abr(d.name) + '</div>';
	}
	var tags = '<div class="itc-tags">';
	if (d.department) tags += '<span class="itc-tag itc-td" style="color:' + col + ';border-color:' + col + '">' + esc(d.department) + '</span>';
	if (d.branch) tags += '<span class="itc-tag itc-tb">' + esc(d.branch) + '</span>';
	tags += '</div>';
	var right = '';
	if (kids > 0) {
		right = '<span class="itc-badge">' + kids + ' report' + (kids > 1 ? 's' : '') + '</span>';
		right += '<button class="itc-tog" data-cnt="' + kids + '">\u2212</button>';
	}

	var h = '<div class="itc-card" data-id="' + d.id + '">';
	h += '<div class="itc-bar" style="background:' + col + '"></div>';
	h += av;
	h += '<div class="itc-info"><div class="itc-name">' + esc(d.name) + '</div>';
	h += '<div class="itc-desg">' + esc(d.designation) + '</div>' + tags + '</div>';
	h += right + '</div>';

	if (kids > 0) {
		h += '<div class="itc-children">';
		for (var j = 0; j < node.ch.length; j++) h += nodeH(node.ch[j]);
		h += '</div>';
	}
	return h;
}

})();
