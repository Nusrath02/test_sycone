frappe.after_ajax(() => {
  // Run ONLY on Org Chart page
  if (frappe.get_route_str() !== "organizational-chart") return;

  setTimeout(() => {
    const container = document.querySelector(".get-org-chart");

    // Safety checks
    if (!container || container.dataset.customized) return;
    if (typeof getOrgChart === "undefined") {
      console.error("getOrgChart library not loaded");
      return;
    }

    container.dataset.customized = "1";

    // Fetch employee hierarchy
    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Employee",
        fields: [
          "name",
          "employee_name",
          "reports_to",
          "designation",
          "image"
        ],
        limit_page_length: 1000
      },
      callback(r) {
        if (!r.message) return;

        // Map ERPNext data → getOrgChart format
        const data = r.message.map(e => ({
          id: e.name,
          parentId: e.reports_to,
          name: e.employee_name || e.name,
          title: e.designation || "",
          img: e.image || ""
        }));

        // IMPORTANT: clear default chart
        container.innerHTML = "";

        // Initialize getOrgChart (VERTICAL)
        new getOrgChart(container, {
          dataSource: data,

          primaryFields: ["name", "title"],
          photoFields: ["img"],

          orientation: getOrgChart.RO_TOP,   // ✅ VERTICAL (Top → Bottom)

          enableZoom: true,
          enablePan: true,
          expandToLevel: 3,

          levelSeparation: 80,
          siblingSeparation: 40,
          subtreeSeparation: 60,

          boxSize: {
            width: 240,
            height: 110
          }
        });
      }
    });

  }, 600); // wait for ERPNext page + library
});
