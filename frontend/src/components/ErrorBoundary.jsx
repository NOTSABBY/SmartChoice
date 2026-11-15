import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SmartChoice Application Error Caught by Boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f4f6fb] flex flex-col items-center justify-center p-6 selection:bg-[#0c831f] selection:text-white">
          <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-lg text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-xs">
              <AlertTriangle className="w-8 h-8 stroke-[2.2]" />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
              Something went wrong
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
              SmartChoice encountered an unexpected interface error. You can reload the page or return to the Master Catalog.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0c831f] hover:bg-[#086616] text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-700/20 active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Master Catalog</span>
              </button>
            </div>

            {this.state.error && (
              <details className="mt-6 text-left border-t border-slate-100 pt-3">
                <summary className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
                  Technical Details
                </summary>
                <pre className="mt-2 p-3 bg-slate-50 rounded-xl text-[10px] text-rose-700 font-mono overflow-x-auto max-h-36">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
