// sycone_footer.js - With scroll detection
let lastScrollTop = 0;
let scrollTimeout;
const scrollThreshold = 5; // Minimum scroll distance to trigger hide/show

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
    
    // Initialize scroll handler
    initFooterScrollBehavior();
}

function initFooterScrollBehavior() {
    // Remove any existing scroll handlers to avoid duplicates
    $(window).off('scroll.syconeFooter');
    
    // Add scroll event listener
    $(window).on('scroll.syconeFooter', function() {
        clearTimeout(scrollTimeout);
        
        scrollTimeout = setTimeout(function() {
            const footer = $('.sycone-custom-footer');
            if (footer.length === 0) return;
            
            const currentScroll = $(window).scrollTop();
            const windowHeight = $(window).height();
            const documentHeight = $(document).height();
            
            // Check if at bottom of page
            const isAtBottom = (currentScroll + windowHeight) >= (documentHeight - 10);
            
            // Check if at top of page
            const isAtTop = currentScroll <= 50;
            
            if (isAtBottom || isAtTop) {
                // Show footer at bottom or top
                footer.removeClass('hidden');
            } else if (Math.abs(currentScroll - lastScrollTop) > scrollThreshold) {
                // Hide footer when scrolling (not at top or bottom)
                if (currentScroll > lastScrollTop) {
                    // Scrolling down
                    footer.addClass('hidden');
                } else {
                    // Scrolling up
                    footer.addClass('hidden');
                }
            }
            
            lastScrollTop = currentScroll;
        }, 10); // Small delay for smooth performance
    });
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
