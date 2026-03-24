/**
 * SYConE Custom Org Chart — nested tree view
 * Loaded via app_include_js (runs on every page at desk startup).
 *
 * Frappe page lifecycle on first visit:
 *   1. router fires $(document).trigger("page-change")   ← we hook here
 *   2. Frappe calls wrapper.on_page_load(wrapper)         ← we override in step 1
 *   3. Frappe fires $(wrapper).trigger("show")            ← we bind in step 2
 *
 * On return visits steps 2 is skipped; show fires directly.
 */

(function () {
"use strict";

// ── Inject styles (once) ──────────────────────────────────────────────────
if (!document.getElementById("soc-styles")) {
	var s = document.createElement("style");
	s.id = "soc-styles";
	s.textContent = [
		".soc-wrap{padding:10px 16px 60px;max-width:1000px;margin:0 auto}",
		".soc-empty{text-align:center;padding:60px 20px;color:#718096}",
		".soc-card{display:flex;align-items:center;gap:10px;background:#fff;",
		"  border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;",
		"  margin-bottom:6px;cursor:pointer;position:relative;overflow:hidden;",
		"  transition:box-shadow .12s,border-color .12s}",
		".soc-card:hover{box-shadow:0 3px 10px rgba(0,0,0,.08);border-color:#4C6EF5}",
		".soc-bar{position:absolute;left:0;top:0;bottom:0;width:4px}",
		".soc-av{width:38px;height:38px;border-radius:50%;flex-shrink:0;",
		"  display:flex;align-items:center;justify-content:center;",
		"  color:#fff;font-size:13px;font-weight:700;overflow:hidden}",
		".soc-av img{width:100%;height:100%;object-fit:cover}",
		".soc-info{flex:1;min-width:0}",
		".soc-name{font-size:13px;font-weight:600;color:#1a202c;",
		"  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
		".soc-desg{font-size:11px;color:#718096;",
		"  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
		".soc-tags{display:flex;gap:4px;margin-top:3px;flex-wrap:wrap}",
		".soc-tag{font-size:9px;font-weight:600;padding:1px 6px;border-radius:3px;white-space:nowrap}",
		".soc-td{border:1px solid}",
		".soc-tb{background:#f1f3f5;color:#718096}",
		".soc-badge{font-size:10px;color:#718096;white-space:nowrap;flex-shrink:0;margin-right:4px}",
		".soc-tog{width:22px;height:22px;border-radius:50%;border:1px solid #cbd5e0;",
		"  background:#fff;color:#718096;font-size:13px;line-height:20px;",
		"  text-align:center;cursor:pointer;padding:0;flex-shrink:0}",
		".soc-tog:hover{background:#EEF2FF;border-color:#4C6EF5;color:#4C6EF5}",
		".soc-children{margin-left:24px;padding-left:16px;border-left:2px solid #e2e8f0;margin-top:0}",
		".soc-children.soc-hidden{display:none}",
		"[data-theme=dark] .soc-card{background:#1a1a2e;border-color:#2d2d44}",
		"[data-theme=dark] .soc-name{color:#e2e8f0}",
		"[data-theme=dark] .soc-tog{background:#1a1a2e;border-color:#2d2d44}",
		"[data-theme=dark] .soc-children{border-left-color:#2d2d44}",
		"[data-theme=dark] .soc-tb{background:rgba(255,255,255,.08)}"
	].join("");
	document.head.appendChild(s);
}

// ── Color palette ─────────────────────────────────────────────────────────
var PAL = ["#4C6EF5","#E8590C","#0CA678","#E64980","#7950F2","#1098AD",
           "#D6336C","#5C940D","#1C7ED6","#AE3EC9","#2B8A3E","#F59F00"];
var cm = {}, ci = 0;
function dcol(d) {
	if (!d) return "#868E96";
	if (!cm[d]) { cm[d] = PAL[ci % PAL.length]; ci++; }
	return cm[d];
}
function esc(v) { return frappe.utils.escape_html(v || ""); }
function abr(n) {
	if (!n) return "?";
	var p = n.trim().split(/\s+/);
	return p.length >= 2
		? (p[0][0] + p[p.length - 1][0]).toUpperCase()
		: n.substring(0, 2).toUpperCase();
}

// ── Page-change: fires BEFORE on_page_load ────────────────────────────────
// We override wrapper.on_page_load here so Frappe calls OUR init
// instead of HRMS's when it sets up the page for the first time.
// For return visits (on_page_load already ran) we re-bind show directly.
$(document).on("page-change", function () {
	try {
		var route = frappe.get_route ? frappe.get_route() : [];
		if (!route || route[0] !== "organizational-chart") return;

		var wrapper = frappe.pages && frappe.pages["organizational-chart"];
		if (!wrapper) return;

		// Override on_page_load so first-visit init is ours, not HRMS's
		wrapper.on_page_load = function (w) {
			socInit(w);
		};

		// Return visits: on_page_load won't fire again, re-bind show
		$(wrapper).off("show.soc").on("show.soc", function () {
			socShow(wrapper);
		});

		// If the page is already visible right now, run immediately
		if ($(wrapper).is(":visible") || wrapper._soc_done) {
			socShow(wrapper);
		}
	} catch (e) {
		console.error("soc page-change error:", e);
	}
});

// ── socInit: called from on_page_load (first visit only) ──────────────────
function socInit(wrapper) {
	cm = {}; ci = 0;
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Organizational Chart"),
		single_column: true,
	});
	wrapper._soc_page = page;

	// Company in toolbar
	page._co = page.add_field({
		fieldname: "company", label: __("Company"), fieldtype: "Link",
		options: "Company", default: frappe.defaults.get_default("company"), reqd: 1,
		change: function () {
			if (page._dp) page._dp.set_value(__("All Departments"));
			if (page._br) page._br.set_value(__("All Branches"));
			socLoad(page);
		}
	});

	// Department selector
	page._dp = page.add_field({
		fieldname: "department", label: __("Department"), fieldtype: "Select",
		options: __("All Departments"), default: __("All Departments"),
		change: function () { socLoad(page); }
	});

	// Branch selector
	page._br = page.add_field({
		fieldname: "branch", label: __("Branch"), fieldtype: "Select",
		options: __("All Branches"), default: __("All Branches"),
		change: function () { socLoad(page); }
	});

	$(page.body || page.main).html(
		'<div class="soc-wrap" id="soc-wrap">' +
		'<div class="soc-empty">' + __("Loading...") + '</div>' +
		'</div>'
	);

	// Bind toggle handler once
	$(page.body || page.main).on("click", ".soc-tog", function (ev) {
		ev.stopPropagation();
		var $ch = $(this).closest(".soc-card").next(".soc-children");
		var cnt = $(this).data("cnt") || 0;
		$ch.toggleClass("soc-hidden");
		$(this).text($ch.hasClass("soc-hidden") ? "+" + cnt : "\u2212");
	});
	$(page.body || page.main).on("click", ".soc-card", function () {
		var id = $(this).data("id");
		if (id) frappe.set_route("app", "employee", id);
	});

	// Bind show for future navigations
	$(wrapper).off("show.soc").on("show.soc", function () {
		socShow(wrapper);
	});

	wrapper._soc_done = true;
	socLoad(page);
}

// ── socShow: called on every show event (return visits) ───────────────────
function socShow(wrapper) {
	var page = wrapper._soc_page;
	if (!page) return; // socInit hasn't run yet — on_page_load will handle it
	if (!document.getElementById("soc-wrap")) {
		$(page.body || page.main).html(
			'<div class="soc-wrap" id="soc-wrap">' +
			'<div class="soc-empty">' + __("Loading...") + '</div>' +
			'</div>'
		);
	}
	socLoad(page);
}

// ── socLoad: call API ──────────────────────────────────────────────────────
function socLoad(page) {
	var co = page._co ? page._co.get_value() : frappe.defaults.get_default("company");
	if (!co) {
		$("#soc-wrap").html('<div class="soc-empty">' + __("Select a company") + '</div>');
		return;
	}
	var dp = (page._dp ? page._dp.get_value() : "") || "";
	var br = (page._br ? page._br.get_value() : "") || "";
	if (dp === __("All Departments")) dp = "";
	if (br === __("All Branches")) br = "";

	cm = {}; ci = 0;
	$("#soc-wrap").html('<div class="soc-empty">' + __("Loading...") + '</div>');

	frappe.call({
		method: "business_theme_v14.api.org_chart.get_org_chart_data",
		args: { company: co, department: dp, branch: br },
		callback: function (r) {
			if (!r || !r.message) return;
			var d = r.message;
			// Populate dept dropdown
			if (d.departments && page._dp) {
				page._dp.df.options = [__("All Departments")].concat(d.departments).join("\n");
				page._dp.refresh();
			}
			// Populate branch dropdown
			if (d.branches && page._br) {
				page._br.df.options = [__("All Branches")].concat(d.branches).join("\n");
				page._br.refresh();
			}
			socRender(d.employees);
		},
		error: function () {
			$("#soc-wrap").html('<div class="soc-empty">' + __("Error loading data") + '</div>');
		}
	});
}

// ── socRender: build tree and write HTML ──────────────────────────────────
function socRender(emps) {
	if (!emps || !emps.length) {
		$("#soc-wrap").html('<div class="soc-empty">' + __("No employees found") + '</div>');
		return;
	}

	// Build node map: id → { d: employee, ch: [] }
	var map = {}, i, e;
	for (i = 0; i < emps.length; i++) {
		e = emps[i];
		map[e.id] = { d: e, ch: [] };
	}

	// Assign children and find roots
	var roots = [];
	for (i = 0; i < emps.length; i++) {
		e = emps[i];
		if (e.reports_to && map[e.reports_to]) {
			map[e.reports_to].ch.push(map[e.id]);
		} else {
			roots.push(map[e.id]);
		}
	}

	// Sort recursively by name
	function srt(node) {
		node.ch.sort(function (a, b) { return a.d.name.localeCompare(b.d.name); });
		for (var j = 0; j < node.ch.length; j++) srt(node.ch[j]);
	}
	for (i = 0; i < roots.length; i++) srt(roots[i]);
	roots.sort(function (a, b) { return a.d.name.localeCompare(b.d.name); });

	// Generate HTML
	var html = "";
	for (i = 0; i < roots.length; i++) html += nodeH(roots[i]);
	$("#soc-wrap").html(html);
}

// ── nodeH: recursive HTML for one node + its subtree ─────────────────────
function nodeH(node) {
	var d = node.d, col = dcol(d.department), kids = node.ch.length;

	var av = d.image
		? '<div class="soc-av"><img src="' + d.image + '"></div>'
		: '<div class="soc-av" style="background:' + col + '">' + abr(d.name) + '</div>';

	var tags = "";
	if (d.department)
		tags += '<span class="soc-tag soc-td" style="color:' + col + ';border-color:' + col + '">' + esc(d.department) + '</span>';
	if (d.branch)
		tags += '<span class="soc-tag soc-tb">' + esc(d.branch) + '</span>';

	var right = "";
	if (kids > 0) {
		right  = '<span class="soc-badge">' + kids + " report" + (kids > 1 ? "s" : "") + "</span>";
		right += '<button class="soc-tog" data-cnt="' + kids + '">\u2212</button>';
	}

	var h = '<div class="soc-card" data-id="' + esc(d.id) + '">'
		+ '<div class="soc-bar" style="background:' + col + '"></div>'
		+ av
		+ '<div class="soc-info">'
		+   '<div class="soc-name">' + esc(d.name) + '</div>'
		+   '<div class="soc-desg">' + esc(d.designation) + '</div>'
		+   '<div class="soc-tags">' + tags + '</div>'
		+ '</div>'
		+ right
		+ '</div>';

	if (kids > 0) {
		h += '<div class="soc-children">';
		for (var j = 0; j < node.ch.length; j++) h += nodeH(node.ch[j]);
		h += '</div>';
	}
	return h;
}

})();
