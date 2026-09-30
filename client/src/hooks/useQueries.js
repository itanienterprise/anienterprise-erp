import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../utils/api';
import { API_BASE_URL } from '../utils/helpers';

export const QUERY_KEYS = {
    employees: ['employees'],
    customRoles: ['customRoles'],
    products: ['products'],
    stock: ['stock'],
    stockBaseline: ['stockBaseline'],
    warehouses: ['warehouses'],
    sales: ['sales'],
    damages: ['damages'],
    returns: ['returns'],
    importers: ['importers'],
    exporters: ['exporters'],
    suppliers: ['suppliers'],
    ports: ['ports'],
    cnfs: ['cnfs'],
    notifications: ['notifications'],
    profile: ['profile'],
};

// ================= EMPLOYEES =================
export const useEmployees = () => {
    return useQuery({
        queryKey: QUERY_KEYS.employees,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/employees`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
};

// ================= CUSTOM ROLES =================
export const useCustomRoles = () => {
    return useQuery({
        queryKey: QUERY_KEYS.customRoles,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/metadata?category=roles`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
};

// ================= PRODUCTS =================
export const useProducts = () => {
    return useQuery({
        queryKey: QUERY_KEYS.products,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/products`);
            const raw = Array.isArray(res.data) ? res.data : [];
            raw.forEach(p => {
                if (p.brands && Array.isArray(p.brands)) {
                    p.brands.sort((a, b) => (a.brand || '').localeCompare(b.brand || '', undefined, { sensitivity: 'base' }));
                }
            });
            raw.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
            return raw;
        },
    });
};

// ================= STOCK =================
export const useStockRecords = () => {
    return useQuery({
        queryKey: QUERY_KEYS.stock,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/stock`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
};

export const useStockBaseline = () => {
    return useQuery({
        queryKey: QUERY_KEYS.stockBaseline,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/stock-baseline/active`);
            return res.data || null;
        },
    });
};

// ================= WAREHOUSES =================
export const useWarehouses = () => {
    return useQuery({
        queryKey: QUERY_KEYS.warehouses,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/warehouses`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
};

// ================= SALES =================
export const useSales = () => {
    return useQuery({
        queryKey: QUERY_KEYS.sales,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/sales`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
};

// ================= DAMAGES =================
export const useDamages = () => {
    return useQuery({
        queryKey: QUERY_KEYS.damages,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/damages`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
};

// ================= RETURNS =================
export const useReturns = () => {
    return useQuery({
        queryKey: QUERY_KEYS.returns,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/returns`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
};

// ================= IMPORTERS =================
export const useImporters = () => {
    return useQuery({
        queryKey: QUERY_KEYS.importers,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/importers`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
};

// ================= EXPORTERS =================
export const useExporters = () => {
    return useQuery({
        queryKey: QUERY_KEYS.exporters,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/exporters`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
};

// ================= SUPPLIERS =================
export const useSuppliers = () => {
    return useQuery({
        queryKey: QUERY_KEYS.suppliers,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/suppliers`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
};

// ================= PORTS =================
export const usePorts = () => {
    return useQuery({
        queryKey: QUERY_KEYS.ports,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/ports`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
};

// ================= CNFS =================
export const useCnFs = () => {
    return useQuery({
        queryKey: QUERY_KEYS.cnfs,
        queryFn: async () => {
            const res = await axios.get(`${API_BASE_URL}/api/cnfs`);
            return Array.isArray(res.data) ? res.data : [];
        },
    });
};
