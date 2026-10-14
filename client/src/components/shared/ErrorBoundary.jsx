import React from 'react';
import { AlertCircleIcon, RefreshCwIcon } from '../Icons';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[300px] flex items-center justify-center p-6 bg-slate-50/80 rounded-2xl border border-slate-200 shadow-sm m-4">
                    <div className="max-w-md w-full text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 text-rose-600 mb-1">
                            <AlertCircleIcon className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">
                            {this.props.title || 'Something went wrong in this section'}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            An unexpected error occurred while rendering this module. You can try reloading the section or returning to the dashboard.
                        </p>
                        {this.state.error?.message && (
                            <div className="text-[11px] font-mono text-rose-700 bg-rose-50 border border-rose-200/60 p-2.5 rounded-lg text-left overflow-auto max-h-24">
                                {this.state.error.message}
                            </div>
                        )}
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                onClick={this.handleReset}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                            >
                                <RefreshCwIcon className="w-3.5 h-3.5" />
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
