/**
 * Helper to check permissions for various modules and actions.
 * Supports fallback to role-based access if custom permissions are not defined.
 */

// List of all primary modules in the ERP system
export const MODULES_LIST = [
    { key: 'employees', label: 'HRMS / Employee' },
    { key: 'port', label: 'Port Management' },
    { key: 'importerExporter', label: 'Importer / Exporter' },
    { key: 'cnf', label: 'C&F Management' },
    { key: 'ipManagement', label: 'IP Management' },
    { key: 'pi', label: 'PI Management' },
    { key: 'packingList', label: 'Packing List' },
    { key: 'trSetup', label: 'TR Setup' },
    { key: 'product', label: 'Product Management' },
    { key: 'customer', label: 'Customer Management' },
    { key: 'lcReceive', label: 'LC Receive' },
    { key: 'warehouse', label: 'Warehouse & Damage' },
    { key: 'stock', label: 'Stock & Inventory' },
    { key: 'sales', label: 'Sales & Reports' },
    { key: 'paymentCollection', label: 'Payment Collection' },
    { key: 'bank', label: 'Bank Management' },
    { key: 'insurance', label: 'Insurance Management' },
    { key: 'insurancePayment', label: 'Insurance Payment' },
    { key: 'lcManagement', label: 'LC & GatePass' },
    { key: 'returnProduct', label: 'Return Product' },
    { key: 'backupRestore', label: 'Backup & Restore' }
];

/**
 * Gets default permissions based on a role.
 * Used to auto-initialize the matrix in System Access.
 */
export const getDefaultPermissionsForRole = (role) => {
    const roleLower = (role || '').toLowerCase();
    const defaults = {};

    // Initialize all modules to false
    MODULES_LIST.forEach(mod => {
        defaults[mod.key] = { view: false, add: false, edit: false, delete: false, special: false };
    });

    if (roleLower === 'admin') {
        MODULES_LIST.forEach(mod => {
            defaults[mod.key] = { view: true, add: true, edit: true, delete: true, special: true };
        });
    } else if (roleLower === 'incharge') {
        // Incharge can do almost everything except delete employees or backup/restore
        MODULES_LIST.forEach(mod => {
            if (mod.key !== 'backupRestore') {
                defaults[mod.key] = { 
                    view: true, 
                    add: true, 
                    edit: true, 
                    delete: mod.key !== 'employees', 
                    special: true 
                };
            }
        });
    } else if (roleLower === 'lc manager') {
        // LC Manager can access port, cnf, ip, pi, packing list, tr, lc, warehouse, lcManagement
        const lcModules = ['port', 'importerExporter', 'cnf', 'ipManagement', 'pi', 'packingList', 'trSetup', 'lcReceive', 'warehouse', 'lcManagement'];
        lcModules.forEach(key => {
            defaults[key] = { view: true, add: true, edit: true, delete: true, special: true };
        });
    } else if (roleLower === 'sales manager') {
        // Sales Manager can access products, customers, sales, payment, bank, insurance, insurancePayment, returnProduct
        const salesModules = ['product', 'customer', 'sales', 'paymentCollection', 'bank', 'insurance', 'insurancePayment', 'returnProduct'];
        salesModules.forEach(key => {
            defaults[key] = { view: true, add: true, edit: true, delete: true, special: true };
        });
    } else if (roleLower === 'accounts manager') {
        // Accounts Manager can access paymentCollection, bank, insurance, insurancePayment, returnProduct
        const accModules = ['paymentCollection', 'bank', 'insurance', 'insurancePayment', 'returnProduct'];
        accModules.forEach(key => {
            defaults[key] = { view: true, add: true, edit: true, delete: true, special: true };
        });
        defaults['employees'] = { view: true, add: false, edit: true, delete: false, special: false };
    } else if (roleLower === 'border manager') {
        // Border Manager can access port, cnf, ip, lcReceive, warehouse, lcManagement
        const borderModules = ['port', 'importerExporter', 'cnf', 'ipManagement', 'lcReceive', 'warehouse', 'lcManagement'];
        borderModules.forEach(key => {
            defaults[key] = { view: true, add: true, edit: true, delete: true, special: true };
        });
    } else if (roleLower === 'data entry') {
        // Data entry can do everything except delete and backup/restore
        MODULES_LIST.forEach(mod => {
            if (mod.key !== 'backupRestore') {
                defaults[mod.key] = { view: true, add: true, edit: true, delete: false, special: false };
            }
        });
    } else {
        // General staff gets read-only access to standard work modules
        const staffModules = ['product', 'customer', 'stock', 'sales'];
        staffModules.forEach(key => {
            defaults[key] = { view: true, add: false, edit: false, delete: false, special: false };
        });
    }

    return defaults;
};

/**
 * Primary helper to check if current user has permission for an action in a module
 */
export const hasPermission = (currentUser, moduleName, action = 'view') => {
    if (!currentUser) return false;
    
    const username = currentUser.username;
    const roleLower = (currentUser.role || '').toLowerCase();

    // 1. Admin bypass
    if (username === 'admin' || roleLower === 'admin') {
        return true;
    }

    // 2. Custom permission check
    if (currentUser.permissions && currentUser.permissions[moduleName]) {
        return !!currentUser.permissions[moduleName][action];
    }

    // 3. Fallback to legacy role-based rules
    const defaults = getDefaultPermissionsForRole(currentUser.role);
    if (defaults[moduleName]) {
        return !!defaults[moduleName][action];
    }

    return false;
};
