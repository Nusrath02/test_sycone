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
});
