import frappe
from frappe import _

@frappe.whitelist()
def get_org_chart_data(company):
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

    result = []
    for e in employees:
        result.append({
            "id": e.name,
            "name": e.employee_name,
            "designation": e.designation or "",
            "department": e.department or "",
            "branch": e.branch or "",
            "reports_to": e.reports_to or "",
            "image": e.image or "",
        })

    return {"employees": result}
