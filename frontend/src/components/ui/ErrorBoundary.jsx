import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('QueueLess screen error', error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  hardReset = () => {
    ['ql-auth', 'ql-business', 'ql-queue', 'ql-ui'].forEach((k) => localStorage.removeItem(k));
    window.location.assign('/');
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto my-16 max-w-md rounded-2xl border border-admin-border bg-white p-6 text-center shadow-card">
        <h1 className="text-lg font-medium">Something went wrong on this screen</h1>
        <p className="mt-2 text-sm text-admin-muted">Your data is safe. Try again, or reset the demo data if the problem continues.</p>
        <pre className="mt-3 max-h-24 overflow-auto rounded-lg bg-[#F1F1F1] p-2 text-left text-xs">{String(this.state.error?.message ?? this.state.error)}</pre>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={this.reset} className="h-9 rounded-lg border border-admin-border px-3 text-sm font-medium">
            Try again
          </button>
          <button type="button" onClick={this.hardReset} className="h-9 rounded-lg bg-admin-primary px-3 text-sm font-medium text-white">
            Reset demo data
          </button>
        </div>
      </div>
    );
  }
}
