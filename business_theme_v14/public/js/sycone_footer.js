frappe.ready(function() {
    // Remove existing footer if any
    if (document.querySelector('.sycone-custom-footer')) {
        document.querySelector('.sycone-custom-footer').remove();
    }
    
    // Create footer HTML
    const footer = document.createElement('div');
    footer.className = 'sycone-custom-footer';
    footer.innerHTML = `
        <div class="sycone-footer-content">
            <div class="sycone-copyright">
                <span>© ${new Date().getFullYear()} SYConE CPMC Pvt Ltd. All Rights Reserved | Design: <a href="https://itchamps.com" target="_blank">ITChamps</a></span>
            </div>
            <img src="/assets/business_theme_v14/images/SYConE Final Logo1.png" alt="SYConE Logo" class="sycone-footer-logo">
        </div>
    `;
    
    // Append footer to body
    document.body.appendChild(footer);
    
    // Scroll detection to show/hide footer
    let lastScroll = 0;
    
    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
        
        if (currentScroll > lastScroll) {
            // Scrolling DOWN - show footer
            footer.style.transform = 'translateY(0)';
            footer.style.opacity = '1';
        } else {
            // Scrolling UP - hide footer
            footer.style.transform = 'translateY(100%)';
            footer.style.opacity = '0';
        }
        
        lastScroll = currentScroll <= 0 ? 0 : currentScroll;
    });
});
