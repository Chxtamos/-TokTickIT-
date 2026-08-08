import { useState } from "react";
import { checkSystem, Category } from "./api.js";

type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  void categories;

  async function handleCheck() {
    setState("loading");

    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState(result.online ? "success" : "error");
    } catch {
      setCategories([]);
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button
        className="btn btn-success"
        onClick={handleCheck}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Loading..." : "Check System"}
      </button>

      {state === "success" && (
        <div className="alert alert-success mt-4">
          <strong>System Status:</strong> Online
        </div>
      )}

      {state === "error" && (
        <div className="alert alert-danger mt-4">
          <p className="mb-1">
            <strong>System Status:</strong> Offline
          </p>
          <p className="mb-0">Unable to connect to TokTickIT API</p>
        </div>
      )}
    </div>
  );
}