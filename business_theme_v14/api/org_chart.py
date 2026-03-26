import frappe
from frappe import _

PALETTE = [
    {"bg": "#ede9fc", "bd": "#7c3aed", "tx": "#5b21b6"},
    {"bg": "#d1fae5", "bd": "#059669", "tx": "#065f46"},
    {"bg": "#fee2e2", "bd": "#dc2626", "tx": "#991b1b"},
    {"bg": "#dbeafe", "bd": "#2563eb", "tx": "#1e40af"},
    {"bg": "#fef3c7", "bd": "#d97706", "tx": "#92400e"},
    {"bg": "#fce7f3", "bd": "#db2777", "tx": "#9d174d"},
]

@frappe.whitelist()
def get_org_chart_data(company, department="", branch=""):
    if not company:
        frappe.throw(_("Company is required"))

    employees = frappe.get_all(
        "Employee",
        filters={"company": company, "status": "Active"},
        fields=[
            "name", "employee_name", "designation", "department",
            "branch", "reports_to", "image",
        ],
        order_by="employee_name asc",
        limit_page_length=0,
    )
    emp_map = {e.name: e for e in employees}

    result = []
    for idx, e in enumerate(employees):
        result.append({
            "id": e.name,
            "name": e.employee_name,
            "designation": e.designation or "",
            "department": e.department or "",
            "branch": e.branch or "",
            "reports_to": e.reports_to or "",
            "image": e.image or "",
            "color": PALETTE[idx % len(PALETTE)],
        })

    all_depts = sorted(set(e["department"] for e in result if e["department"]))
    all_branches = sorted(set(e["branch"] for e in result if e["branch"]))

    visible = result
    if department:
        visible = [e for e in visible if e["department"] == department]
    if branch:
        visible = [e for e in visible if e["branch"] == branch]

    if department or branch:
        visible_ids = set(e["id"] for e in visible)
        extras = set()
        for e in list(visible):
            mgr_id = e["reports_to"]
            while mgr_id and mgr_id in emp_map and mgr_id not in visible_ids and mgr_id not in extras:
                extras.add(mgr_id)
                mgr_id = emp_map[mgr_id].reports_to or ""
        if extras:
            for eid in extras:
                em = emp_map[eid]
                visible.append({
                    "id": em.name,
                    "name": em.employee_name,
                    "designation": em.designation or "",
                    "department": em.department or "",
                    "branch": em.branch or "",
                    "reports_to": em.reports_to or "",
                    "image": em.image or "",
                })

    return {
        "employees": visible,
        "departments": all_depts,
        "branches": all_branches,
    }
