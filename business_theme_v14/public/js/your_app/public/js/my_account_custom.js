frappe.pages['my-account'].on_page_load = function(wrapper) {
    // wait for page to fully render
    setTimeout(() => {
        const container = $(wrapper).find('.page-content');

        if (!container.find('.custom-shortcut-wrapper').length) {
            const shortcuts_html = `
                <div class="custom-shortcut-wrapper">
                    <div class="shortcut-grid">

                        <div class="shortcut-card">
                            <h4 class="shortcut-title red">Leaves</h4>
                            <a href="/app/leave-application">Leave Application ↗</a>
                            <a href="/app/leave-balance">Leave Balance ↗</a>
                        </div>

                        <div class="shortcut-card">
                            <h4 class="shortcut-title red">Expenses</h4>
                            <a href="/app/expense-claim">Claim Expenses ↗</a>
                        </div>

                        <div class="shortcut-card">
                            <h4 class="shortcut-title red">Worksheets</h4>
                            <a href="/app/timesheet">Worksheet ↗</a>
                        </div>

                        <div class="shortcut-card">
                            <h4 class="shortcut-title red">Company Information</h4>
                            <a href="/app/holiday-list">Company Holiday List ↗</a>
                        </div>

                    </div>
                </div>
            `;

            // Insert ABOVE the existing account card
            container.prepend(shortcuts_html);
        }
    }, 500);
};

