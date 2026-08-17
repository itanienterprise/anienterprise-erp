/**
 * Helper to check permissions for various modules and actions.
 * Supports fallback to role-based access if custom permissions are not defined.
 */

// List of all primary modules in the ERP system
export const MODULES_LIST = [
    { key: 'employees', label: 'HRMS / Employee', specialLabel: 'Reset Password' },
    { key: 'port', label: 'Port Management' },
    { key: 'importerExporter', label: 'Importer / Exporter / Supplier' },
    { key: 'cnf', label: 'C&F Management' },
    {
        key: 'cnfPayment',
        label: 'C&F Payment',
        specialLabels: [
            { key: 'firstApprove', label: '1st Approve' },
            { key: 'secondApprove', label: '2nd Approve' },
            { key: 'special', label: 'Approve Payment' },
            { key: 'paymentRequest', label: 'Payment Request' },
            { key: 'editRequest', label: 'Edit Request' },
            { key: 'approveEditRequest', label: 'Approve Edit Request' },
            { key: 'showEntryBy', label: 'Entry By' }
        ]
    },
    {
        key: 'ipManagement',
        label: 'IP Management',
        specialLabels: [
            { key: 'showEntryBy', label: 'Entry By' }
        ]
    },
    {
        key: 'pi',
        label: 'PI Management',
        specialLabels: [
            { key: 'showEntryBy', label: 'Entry By' }
        ]
    },
    {
        key: 'packingList',
        label: 'Packing List',
        specialLabels: [
            { key: 'showEntryBy', label: 'Entry By' }
        ]
    },
    { key: 'trSetup', label: 'TR Setup' },
    {
        key: 'order',
        label: 'Order',
        specialLabels: [
            { key: 'firstApprove', label: '1st Approve' },
            { key: 'secondApprove', label: '2nd Approve' },
            { key: 'special', label: 'Approve Order' },
            { key: 'orderRequest', label: 'Order Request' },
            { key: 'editRequest', label: 'Edit Request' },
            { key: 'approveEditRequest', label: 'Approve Edit Request' }
        ]
    },
    {
        key: 'purchase',
        label: 'Purchase Management',
        specialLabels: [
            { key: 'firstApprove', label: '1st Approve' },
            { key: 'secondApprove', label: '2nd Approve' },
            { key: 'special', label: 'Approve Purchase' },
            { key: 'purchaseRequest', label: 'Purchase Request' },
            { key: 'editRequest', label: 'Edit Request' },
            { key: 'approveEditRequest', label: 'Approve Edit Request' }
        ]
    },
    {
        key: 'purchaseReceive',
        label: 'Purchase Receive Management',
        specialLabels: [
            { key: 'firstApprove', label: '1st Approve' },
            { key: 'secondApprove', label: '2nd Approve' },
            { key: 'special', label: 'Approve Purchase Receive' },
            { key: 'purchaseReceiveRequest', label: 'Purchase Receive Request' },
            { key: 'editRequest', label: 'Edit Request' },
            { key: 'approveEditRequest', label: 'Approve Edit Request' }
        ]
    },
    { key: 'product', label: 'Product Management' },
    { key: 'customer', label: 'Customer Management' },
    { key: 'lcReceive', label: 'LC Receive', specialLabel: 'Approve LC' },
    { key: 'warehouse', label: 'Warehouse & Damage' },
    {
        key: 'transfer',
        label: 'Stock Transfer',
        specialLabels: [
            { key: 'approve', label: 'Approve Transfer' }
        ]
    },
    {
        key: 'stock',
        label: 'Stock & Inventory',
        specialLabels: [
            { key: 'special', label: 'Transfer from Stock' },
            { key: 'showRate', label: 'Show Rate' }
        ]
    },
    {
        key: 'sales',
        label: 'General Sale',
        specialLabels: [
            { key: 'firstApprove', label: '1st Approve' },
            { key: 'secondApprove', label: '2nd Approve' },
            { key: 'special', label: 'Approve Sale' },
            { key: 'saleRequest', label: 'Sale Request' },
            { key: 'editRequest', label: 'Edit Request' },
            { key: 'approveEditRequest', label: 'Approve Edit Request' }
        ]
    },
    {
        key: 'borderSale',
        label: 'Border Sale',
        specialLabels: [
            { key: 'firstApprove', label: '1st Approve' },
            { key: 'secondApprove', label: '2nd Approve' },
            { key: 'special', label: 'Approve Sale' },
            { key: 'saleRequest', label: 'Sale Request' },
            { key: 'editRequest', label: 'Edit Request' },
            { key: 'approveEditRequest', label: 'Approve Edit Request' }
        ]
    },
    { key: 'profitLoss', label: 'Profit & Loss' },
    { key: 'costOfGoods', label: 'Cost of Goods' },
    {
        key: 'paymentCollection',
        label: 'Payment Collection',
        specialLabels: [
            { key: 'firstApprove', label: '1st Approve' },
            { key: 'secondApprove', label: '2nd Approve' },
            { key: 'special', label: 'Approve Payment' },
            { key: 'paymentRequest', label: 'Payment Request' },
            { key: 'editRequest', label: 'Edit Request' },
            { key: 'approveEditRequest', label: 'Approve Edit Request' },
            { key: 'showEntryBy', label: 'Entry By' }
        ]
    },
    {
        key: 'payToCustomer',
        label: 'Pay To Customer',
        specialLabels: [
            { key: 'firstApprove', label: '1st Approve' },
            { key: 'secondApprove', label: '2nd Approve' },
            { key: 'special', label: 'Approve Payment' },
            { key: 'paymentRequest', label: 'Payment Request' },
            { key: 'editRequest', label: 'Edit Request' },
            { key: 'approveEditRequest', label: 'Approve Edit Request' },
            { key: 'showEntryBy', label: 'Entry By' }
        ]
    },
    { key: 'bank', label: 'Bank Management' },
    { key: 'insurance', label: 'Insurance Management' },
    {
        key: 'insurancePayment',
        label: 'Insurance Payment',
        specialLabels: [
            { key: 'firstApprove', label: '1st Approve' },
            { key: 'secondApprove', label: '2nd Approve' },
            { key: 'special', label: 'Approve Payment' },
            { key: 'paymentRequest', label: 'Payment Request' },
            { key: 'editRequest', label: 'Edit Request' },
            { key: 'approveEditRequest', label: 'Approve Edit Request' },
            { key: 'showEntryBy', label: 'Entry By' }
        ]
    },
    {
        key: 'lcManagement',
        label: 'LC Management',
        specialLabels: [
            { key: 'special', label: 'Add Bill' },
            { key: 'specialEdit', label: 'Edit Bill' },
            { key: 'editLcReceive', label: 'Edit LC Receive' },
            { key: 'editDollarRate', label: 'Edit Dollar Rate' }
        ]
    },
    { key: 'lcGp', label: 'LC GatePass' },
    { key: 'lcExpense', label: 'LC Expense' },
    { key: 'marginReturn', label: 'Margin Return' },
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
        const permsObj = { view: false, add: false, edit: false, delete: false, special: false };
        if (mod.specialLabels) {
            mod.specialLabels.forEach(sItem => {
                permsObj[sItem.key] = false;
            });
        }
        defaults[mod.key] = permsObj;
    });

    if (roleLower === 'admin') {
        MODULES_LIST.forEach(mod => {
            const permsObj = { view: true, add: true, edit: true, delete: true, special: true };
            if (mod.specialLabels) {
                mod.specialLabels.forEach(sItem => {
                    permsObj[sItem.key] = true;
                });
            }
            defaults[mod.key] = permsObj;
        });
    } else if (roleLower === 'incharge') {
        // Incharge can do almost everything except delete employees or backup/restore
        MODULES_LIST.forEach(mod => {
            if (mod.key !== 'backupRestore') {
                const permsObj = {
                    view: true,
                    add: true,
                    edit: true,
                    delete: mod.key !== 'employees',
                    special: true
                };
                if (mod.specialLabels) {
                    mod.specialLabels.forEach(sItem => {
                        permsObj[sItem.key] = !(sItem.key === 'editLcReceive' || sItem.key === 'editDollarRate');
                    });
                }
                defaults[mod.key] = permsObj;
            }
        });
    } else if (roleLower === 'lc manager') {
        // LC Manager can access port, cnf, ip, pi, packing list, tr, lc, warehouse, lcManagement, purchase, transfer
        const lcModules = ['port', 'importerExporter', 'cnf', 'cnfPayment', 'ipManagement', 'pi', 'packingList', 'trSetup', 'lcReceive', 'warehouse', 'transfer', 'lcManagement', 'lcGp', 'lcExpense', 'costOfGoods', 'purchase', 'purchaseReceive'];
        lcModules.forEach(key => {
            const mod = MODULES_LIST.find(m => m.key === key);
            const permsObj = { view: true, add: true, edit: true, delete: true, special: true };
            if (mod && mod.specialLabels) {
                mod.specialLabels.forEach(sItem => {
                    permsObj[sItem.key] = !(sItem.key === 'editLcReceive' || sItem.key === 'editDollarRate');
                });
            }
            defaults[key] = permsObj;
        });
    } else if (roleLower === 'sales manager') {
        // Sales Manager can access products, customers, sales, borderSale, order, purchase, payment, bank, insurance, insurancePayment, returnProduct, transfer
        const salesModules = ['product', 'customer', 'sales', 'borderSale', 'order', 'purchase', 'purchaseReceive', 'transfer', 'profitLoss', 'costOfGoods', 'paymentCollection', 'payToCustomer', 'bank', 'insurance', 'insurancePayment', 'returnProduct'];
        salesModules.forEach(key => {
            const mod = MODULES_LIST.find(m => m.key === key);
            const permsObj = { view: true, add: true, edit: true, delete: true, special: true };
            if (mod && mod.specialLabels) {
                mod.specialLabels.forEach(sItem => {
                    if (sItem.key === 'firstApprove') permsObj[sItem.key] = true;
                    else if (sItem.key === 'secondApprove') permsObj[sItem.key] = false;
                    else permsObj[sItem.key] = !(sItem.key === 'editLcReceive' || sItem.key === 'editDollarRate');
                });
            }
            defaults[key] = permsObj;
        });
    } else if (roleLower === 'head of sales') {
        // Head of Sales has approval rights for sales and payment operations
        MODULES_LIST.forEach(mod => {
            if (mod.key !== 'backupRestore') {
                const permsObj = { view: true, add: true, edit: true, delete: false, special: true };
                if (mod.specialLabels) {
                    mod.specialLabels.forEach(sItem => {
                        permsObj[sItem.key] = !(sItem.key === 'editLcReceive' || sItem.key === 'editDollarRate');
                    });
                }
                defaults[mod.key] = permsObj;
            }
        });
    } else if (roleLower === 'accounts manager') {
        // Accounts Manager can access paymentCollection, payToCustomer, bank, insurance, insurancePayment, cnfPayment, returnProduct, purchase
        const accModules = ['paymentCollection', 'payToCustomer', 'bank', 'insurance', 'insurancePayment', 'cnfPayment', 'returnProduct', 'costOfGoods', 'purchase', 'purchaseReceive'];
        accModules.forEach(key => {
            const mod = MODULES_LIST.find(m => m.key === key);
            const permsObj = { view: true, add: true, edit: true, delete: true, special: true };
            if (mod && mod.specialLabels) {
                mod.specialLabels.forEach(sItem => {
                    if (sItem.key === 'firstApprove') permsObj[sItem.key] = false;
                    else if (sItem.key === 'secondApprove') permsObj[sItem.key] = true;
                    else permsObj[sItem.key] = !(sItem.key === 'editLcReceive' || sItem.key === 'editDollarRate');
                });
            }
            defaults[key] = permsObj;
        });
        defaults['employees'] = { view: true, add: false, edit: true, delete: false, special: false };
    } else if (roleLower === 'border manager') {
        // Border Manager can access port, cnf, ip, lcReceive, warehouse, lcManagement, purchase, transfer, borderSale
        const borderModules = ['port', 'importerExporter', 'cnf', 'cnfPayment', 'ipManagement', 'lcReceive', 'warehouse', 'transfer', 'lcManagement', 'lcGp', 'lcExpense', 'purchase', 'purchaseReceive', 'borderSale'];
        borderModules.forEach(key => {
            const mod = MODULES_LIST.find(m => m.key === key);
            const permsObj = { view: true, add: true, edit: true, delete: true, special: true };
            if (mod && mod.specialLabels) {
                mod.specialLabels.forEach(sItem => {
                    permsObj[sItem.key] = !(sItem.key === 'editLcReceive' || sItem.key === 'editDollarRate');
                });
            }
            defaults[key] = permsObj;
        });
    } else if (roleLower === 'data entry') {
        // Data entry can do everything except delete and backup/restore
        MODULES_LIST.forEach(mod => {
            if (mod.key !== 'backupRestore') {
                const permsObj = { view: true, add: true, edit: true, delete: false, special: false };
                if (mod.specialLabels) {
                    mod.specialLabels.forEach(sItem => {
                        permsObj[sItem.key] = false;
                    });
                }
                defaults[mod.key] = permsObj;
            }
        });
    } else {
        // General staff gets read-only access to standard work modules
        const staffModules = ['product', 'customer', 'stock', 'sales', 'order', 'purchase', 'purchaseReceive', 'transfer'];
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

    let checkAction = action;
    if (action === 'create') checkAction = 'add';

    const username = currentUser.username;
    const roleLower = (currentUser.role || '').toLowerCase();

    // 1. Admin bypass
    if (username === 'admin' || roleLower === 'admin') {
        return true;
    }

    // 2. Custom permission check
    if (currentUser.permissions && currentUser.permissions[moduleName]) {
        return !!currentUser.permissions[moduleName][checkAction];
    }

    // 3. Fallback to legacy role-based rules
    const defaults = getDefaultPermissionsForRole(currentUser.role);
    if (defaults[moduleName]) {
        return !!defaults[moduleName][checkAction];
    }

    return false;
};
