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

















// sycone_footer.js - Improved version
function createSyconEFooter() {
    // Remove existing footer first
    $('.sycone-custom-footer').remove();
    
    const footerHTML = `
        <div class="sycone-custom-footer">
            <div class="sycone-footer-content">
                <div class="sycone-copyright">
                    <span>© 2026 SYConE CPMC Pvt Ltd. All Rights Reserved | Design: ITChamps</span>
                </div>
                <img src="/assets/business_theme_v14/images/SYConE Final Logo1.png" 
                     alt="SYConE Logo" 
                     class="sycone-footer-logo"
                     onerror="this.style.display='none'">
            </div>
        </div>
    `;
    
    // Append to body
    $('body').append(footerHTML);
    console.log("✅ SYConE footer created");
}

// Initialize footer when DOM is ready
$(document).ready(function() {
    createSyconEFooter();
});

// Re-create on Frappe page changes
if (typeof frappe !== 'undefined') {
    frappe.ready(function() {
        createSyconEFooter();
    });
    
    // Handle SPA navigation
    frappe.router.on('change', function() {
        setTimeout(createSyconEFooter, 100);
    });
}
