import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

const hostStorage = window.storage;
window.storage = {
  async get(key) {
    try {
      if (hostStorage && typeof hostStorage.get === "function") {
        const hostValue = await hostStorage.get(key);
        if (hostValue === null || hostValue === undefined) return null;
        if (typeof hostValue === "object" && "value" in hostValue) return hostValue;
        if (typeof hostValue === "string") return { value: hostValue };
        return { value: JSON.stringify(hostValue) };
      }
    } catch {}

    try {
      const value = window.localStorage.getItem(key);
      if (value === null) {
        return null;
      }
      return { value };
    } catch {
      return null;
    }
  },

  async set(key, value) {
    try {
      if (hostStorage && typeof hostStorage.set === "function") {
        await hostStorage.set(key, value);
        return { value };
      }
    } catch {}

    try {
      window.localStorage.setItem(key, value);
    } catch {}

    return { value };
  },
};

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("MailForge runtime error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ padding: 24, fontFamily: "monospace", lineHeight: 1.5 }}>
        <h1 style={{ marginBottom: 8 }}>MailForge crashed</h1>
        <p style={{ marginBottom: 12 }}>
          Reload the page. If the issue continues, clear this site's local storage and try again.
        </p>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {String(this.state.error?.stack || this.state.error)}
        </pre>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);