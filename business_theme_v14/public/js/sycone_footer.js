
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

// Re-create on Frappe page changes (SPA navigation)
$(document).on("page-change", function() {
    setTimeout(createSyconEFooter, 100);
});
