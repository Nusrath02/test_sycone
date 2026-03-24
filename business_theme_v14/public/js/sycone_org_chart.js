/**
 * SYConE Custom Org Chart — nested tree view
 * Loaded via app_include_js (runs on every desk page at startup).
 *
 * Strategy: use setTimeout(fn,0) in page-change so our code runs
 * AFTER Frappe's synchronous page lifecycle (on_page_load + show +
 * HRMS render).  We always go last, so we always win.
 */
(function () {
"use strict";

// ── Styles (injected once, unique id soc2-styles) ─────────────────────────
if (!document.getElementById("soc2-styles")) {
	var s = document.createElement("style");
	s.id = "soc2-styles";
	s.textContent =
		".soc2-body{padding:12px 16px 60px;max-width:1000px;margin:0 auto}" +
		".soc2-msg{text-align:center;padding:60px 20px;color:#718096}" +
		".soc2-card{display:flex;align-items:center;gap:10px;background:#fff;" +
		"  border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;" +
		"  margin-bottom:6px;cursor:pointer;position:relative;overflow:hidden;" +
		"  transition:box-shadow .12s,border-color .12s}" +
		".soc2-card:hover{box-shadow:0 3px 10px rgba(0,0,0,.08);border-color:#4C6EF5}" +
		".soc2-bar{position:absolute;left:0;top:0;bottom:0;width:4px}" +
		".soc2-av{width:38px;height:38px;border-radius:50%;flex-shrink:0;" +
		"  display:flex;align-items:center;justify-content:center;" +
		"  color:#fff;font-size:13px;font-weight:700;overflow:hidden}" +
		".soc2-av img{width:100%;height:100%;object-fit:cover}" +
		".soc2-info{flex:1;min-width:0}" +
		".soc2-name{font-size:13px;font-weight:600;color:#1a202c;" +
		"  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
		".soc2-desg{font-size:11px;color:#718096;" +
		"  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
		".soc2-tags{display:flex;gap:4px;margin-top:3px;flex-wrap:wrap}" +
		".soc2-tag{font-size:9px;font-weight:600;padding:1px 6px;border-radius:3px;white-space:nowrap}" +
		".soc2-td{border:1px solid}" +
		".soc2-tb{background:#f1f3f5;color:#718096}" +
		".soc2-badge{font-size:10px;color:#718096;white-space:nowrap;flex-shrink:0;margin-right:4px}" +
		".soc2-tog{width:22px;height:22px;border-radius:50%;border:1px solid #cbd5e0;" +
		"  background:#fff;color:#718096;font-size:13px;line-height:20px;" +
		"  text-align:center;cursor:pointer;padding:0;flex-shrink:0}" +
		".soc2-tog:hover{background:#EEF2FF;border-color:#4C6EF5;color:#4C6EF5}" +
		".soc2-kids{margin-left:24px;padding-left:16px;border-left:2px solid #e2e8f0}" +
		".soc2-kids.soc2-hidden{display:none}" +
		"[data-theme=dark] .soc2-card{background:#1a1a2e;border-color:#2d2d44}" +
		"[data-theme=dark] .soc2-name{color:#e2e8f0}" +
		"[data-theme=dark] .soc2-tog{background:#1a1a2e;border-color:#2d2d44}" +
		"[data-theme=dark] .soc2-kids{border-left-color:#2d2d44}" +
		"[data-theme=dark] .soc2-tb{background:rgba(255,255,255,.08)}";
	document.head.appendChild(s);
}

// ── Color palette ─────────────────────────────────────────────────────────
var PAL = ["#4C6EF5","#E8590C","#0CA678","#E64980","#7950F2",
           "#1098AD","#D6336C","#5C940D","#1C7ED6","#AE3EC9"];
var _cm = {}, _ci = 0;
function dcol(d) {
	if (!d) return "#868E96";
	if (!_cm[d]) { _cm[d] = PAL[_ci % PAL.length]; _ci++; }
	return _cm[d];
}
function esc(v)  { return frappe.utils.escape_html(v || ""); }
function abr(n) {
	if (!n) return "?";
	var p = n.trim().split(/\s+/);
	return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : n.substring(0, 2)).toUpperCase();
}

// ── Hook page-change; defer with setTimeout so we always run last ─────────
$(document).on("page-change", function () {
	setTimeout(socTakeOver, 0);
});

function socTakeOver() {
	try {
		var route = frappe.get_route ? frappe.get_route() : [];
		if (!route || route[0] !== "organizational-chart") return;

		var wrapper = frappe.pages && frappe.pages["organizational-chart"];
		if (!wrapper) return;

		// Grab page object: use existing (HRMS created it) or make our own
		var page = wrapper._soc2_page;
		if (!page) {
			// HRMS may have created wrapper.page; reuse its container
			page = wrapper.page || null;
			if (!page) {
				$(wrapper).find(".page-body").first().empty();
				page = frappe.ui.make_app_page({
					parent: wrapper,
					title: __("Organizational Chart"),
					single_column: true,
				});
			}
			wrapper._soc2_page = page;

			// Add filter fields to the toolbar (only once)
			page._co = page.add_field({
				fieldname: "company", label: __("Company"), fieldtype: "Link",
				options: "Company",
				default: frappe.defaults.get_default("company"), reqd: 1,
				change: function () {
					if (page._dp) page._dp.set_value(__("All Departments"));
					if (page._br) page._br.set_value(__("All Branches"));
					socLoad(page);
				}
			});
			page._dp = page.add_field({
				fieldname: "department", label: __("Department"), fieldtype: "Select",
				options: __("All Departments"), default: __("All Departments"),
				change: function () { socLoad(page); }
			});
			page._br = page.add_field({
				fieldname: "branch", label: __("Branch"), fieldtype: "Select",
				options: __("All Branches"), default: __("All Branches"),
				change: function () { socLoad(page); }
			});

			// Toggle + card-click (delegated, bound once on the container)
			$(page.body || page.main)
				.on("click", ".soc2-tog", function (ev) {
					ev.stopPropagation();
					var $kids = $(this).closest(".soc2-card").next(".soc2-kids");
					var cnt   = $(this).data("cnt") || 0;
					$kids.toggleClass("soc2-hidden");
					$(this).text($kids.hasClass("soc2-hidden") ? "+" + cnt : "\u2212");
				})
				.on("click", ".soc2-card", function () {
					var id = $(this).data("id");
					if (id) frappe.set_route("app", "employee", id);
				});
		}

		// Re-bind show so return visits also render our tree
		$(wrapper).off("show.soc2").on("show.soc2", function () {
			setTimeout(socTakeOver, 0);
		});

		// Inject our body container (replaces whatever HRMS rendered)
		var $body = $(page.body || page.main);
		$body.html('<div class="soc2-body" id="soc2-body"><div class="soc2-msg">' + __("Loading...") + '</div></div>');

		socLoad(page);
	} catch (e) {
		console.error("[soc2] takeOver error:", e);
	}
}

// ── socLoad: call API ──────────────────────────────────────────────────────
function socLoad(page) {
	var co = page._co ? page._co.get_value() : frappe.defaults.get_default("company");
	if (!co) {
		$("#soc2-body").html('<div class="soc2-msg">' + __("Select a company") + '</div>');
		return;
	}
	var dp = (page._dp ? page._dp.get_value() : "") || "";
	var br = (page._br ? page._br.get_value() : "") || "";
	if (dp === __("All Departments")) dp = "";
	if (br === __("All Branches"))    br = "";

	_cm = {}; _ci = 0;
	$("#soc2-body").html('<div class="soc2-msg">' + __("Loading...") + '</div>');

	frappe.call({
		method: "business_theme_v14.api.org_chart.get_org_chart_data",
		args: { company: co, department: dp, branch: br },
		callback: function (r) {
			if (!r || !r.message) return;
			var d = r.message;

			if (d.departments && page._dp) {
				page._dp.df.options = [__("All Departments")].concat(d.departments).join("\n");
				page._dp.refresh();
			}
			if (d.branches && page._br) {
				page._br.df.options = [__("All Branches")].concat(d.branches).join("\n");
				page._br.refresh();
			}
			socRender(d.employees);
		},
		error: function () {
			$("#soc2-body").html('<div class="soc2-msg">' + __("Error loading data") + '</div>');
		}
	});
}

// ── socRender: build tree, inject HTML ────────────────────────────────────
function socRender(emps) {
	if (!emps || !emps.length) {
		$("#soc2-body").html('<div class="soc2-msg">' + __("No employees found") + '</div>');
		return;
	}

	// Build node map
	var map = {}, i, e;
	for (i = 0; i < emps.length; i++) {
		e = emps[i];
		map[e.id] = { d: e, ch: [] };
	}

	// Assign children; collect roots
	var roots = [];
	for (i = 0; i < emps.length; i++) {
		e = emps[i];
		if (e.reports_to && map[e.reports_to]) {
			map[e.reports_to].ch.push(map[e.id]);
		} else {
			roots.push(map[e.id]);
		}
	}

	// Sort recursively
	function srt(n) {
		n.ch.sort(function (a, b) { return a.d.name.localeCompare(b.d.name); });
		n.ch.forEach(srt);
	}
	roots.forEach(srt);
	roots.sort(function (a, b) { return a.d.name.localeCompare(b.d.name); });

	var html = "";
	roots.forEach(function (r) { html += nodeH(r); });
	$("#soc2-body").html(html);
}

// ── nodeH: HTML for one node + nested children ────────────────────────────
function nodeH(node) {
	var d    = node.d;
	var col  = dcol(d.department);
	var kids = node.ch.length;

	var av = d.image
		? '<div class="soc2-av"><img src="' + d.image + '"></div>'
		: '<div class="soc2-av" style="background:' + col + '">' + abr(d.name) + '</div>';

	var tags = "";
	if (d.department)
		tags += '<span class="soc2-tag soc2-td" style="color:' + col + ';border-color:' + col + '">' + esc(d.department) + '</span>';
	if (d.branch)
		tags += '<span class="soc2-tag soc2-tb">' + esc(d.branch) + '</span>';

	var right = "";
	if (kids > 0) {
		right  = '<span class="soc2-badge">' + kids + " report" + (kids > 1 ? "s" : "") + "</span>";
		right += '<button class="soc2-tog" data-cnt="' + kids + '">\u2212</button>';
	}

	var h = '<div class="soc2-card" data-id="' + esc(d.id) + '">'
		+ '<div class="soc2-bar" style="background:' + col + '"></div>'
		+ av
		+ '<div class="soc2-info">'
		+   '<div class="soc2-name">' + esc(d.name) + '</div>'
		+   '<div class="soc2-desg">' + esc(d.designation) + '</div>'
		+   '<div class="soc2-tags">' + tags + '</div>'
		+ '</div>'
		+ right
		+ '</div>';

	if (kids > 0) {
		h += '<div class="soc2-kids">';
		node.ch.forEach(function (c) { h += nodeH(c); });
		h += '</div>';
	}
	return h;
}

})();
