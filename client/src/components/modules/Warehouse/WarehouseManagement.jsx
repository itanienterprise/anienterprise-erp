import React from 'react';
import './WarehouseManagement.css';
import {
    PlusIcon,
    FunnelIcon,
    BoxIcon,
    TrendingUpIcon,
    BellIcon,
    ShoppingCartIcon,
    HomeIcon,
} from '../../Icons';

const WarehouseManagement = () => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Ware House Management</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage and track warehouse specific stock and locations</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all shadow-sm font-medium"
                    >
                        <FunnelIcon className="w-4 h-4 mr-2" />
                        Filter
                    </button>
                    <button
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg font-medium"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Add Stock to WH
                    </button>
                </div>
            </div>

            {/* Placeholder Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Items', value: '0', icon: BoxIcon, color: 'blue' },
                    { label: 'Available Capacity', value: '85%', icon: TrendingUpIcon, color: 'emerald' },
                    { label: 'Pending Transfers', value: '0', icon: BellIcon, color: 'amber' },
                    { label: 'Low Stock Alerts', value: '0', icon: ShoppingCartIcon, color: 'red' },
                ].map((card, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 bg-${card.color}-50 rounded-xl`}>
                                <card.icon className={`w-6 h-6 text-${card.color}-600`} />
                            </div>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">+0%</span>
                        </div>
                        <p className="text-sm font-medium text-gray-500">{card.label}</p>
                        <p className="text-2xl font-black text-gray-900 mt-1">{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex flex-col items-center justify-center p-20">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                        <HomeIcon className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Ware House is Empty</h3>
                    <p className="text-gray-500 mt-2 text-center max-w-sm">
                        You haven't added any stock to the warehouse section yet. Start by transferring stock or adding new entries.
                    </p>
                    <button className="mt-8 px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200">
                        Setup Ware House
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WarehouseManagement;
