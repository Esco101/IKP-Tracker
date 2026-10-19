import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: raw };
  }

  render() {
    if (this.state.hasError) {
      let parsedOperation = '';
      let parsedPath = '';
      let displayError = this.state.errorMessage;

      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          displayError = String(parsed.error);
          parsedOperation = String(parsed.operationType || '');
          parsedPath = String(parsed.path || '');
        }
      } catch {
        // Not a JSON FirestoreErrorInfo string
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-bold text-slate-900">
                Application Encountered an Error
              </h1>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{displayError}</p>
            {(parsedOperation || parsedPath) && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700">
                Operation: {parsedOperation} · Path: {parsedPath}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="min-h-[44px] px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
