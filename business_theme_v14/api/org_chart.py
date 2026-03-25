import frappe

@frappe.whitelist()
def get_org_chart_data(company):
	employees = frappe.get_all(
		"Employee",
		filters={"company": company, "status": "Active"},
		fields=["name as id", "employee_name as name", "designation",
		        "department", "branch", "reports_to", "image"]
	)
	return {"employees": employees}
