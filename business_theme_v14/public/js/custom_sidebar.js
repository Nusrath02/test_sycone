frappe.provide('frappe.desk');

$(document).ready(function () {
    // Wait for sidebar to be fully loaded
    const waitForSidebar = (callback) => {
        const sidebarObserver = new MutationObserver((mutations, observer) => {
            const $publicSection = $("div.standard-sidebar-section.nested-container[data-title='Public']");
            if ($publicSection.length > 0) {
                observer.disconnect();
                callback($publicSection);
            }
        });
        sidebarObserver.observe(document.body, { childList: true, subtree: true });
    };

    // Create the custom Employee menu item
    const createEmployeeMenuItem = () => `
        <div class="sidebar-item-container is-draggable" item-parent="" item-name="Employee" item-public="1" item-is-hidden="0">
            <div class="desk-sidebar-item standard-sidebar-item">
                <a href="/app/employee?status=Active" class="item-anchor" title="Employee">
                    <span class="sidebar-item-icon" item-icon="users">
                        <svg class="icon icon-md" aria-hidden="true">
                            <use href="#icon-users"></use>
                        </svg>
                    </span>
                    <span class="sidebar-item-label">Employee</span>
                </a>
                <div class="sidebar-item-control">
                    <button class="btn btn-secondary btn-xs drag-handle" title="${__('Drag')}">
                        <svg class="es-icon es-line icon-xs" aria-hidden="true">
                            <use href="#es-line-drag"></use>
                        </svg>
                    </button>
                    <div class="btn btn-xs setting-btn dropdown-btn" title="${__('Setting')}">
                        <svg class="es-icon es-line icon-xs" aria-hidden="true">
                            <use href="#es-line-dot-horizontal"></use>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add the Employee menu item to the sidebar
    const addEmployeeMenuItem = () => {
        waitForSidebar(($publicSection) => {
            // Check if Employee menu item already exists
            if ($publicSection.find('[item-name="Employee"]').length === 0) {
                // Add the Employee menu item to the public section
                $publicSection.append(createEmployeeMenuItem());
                
                console.log('Employee menu item added to sidebar');
            }
        });
    };

    // Initialize
    addEmployeeMenuItem();
});
