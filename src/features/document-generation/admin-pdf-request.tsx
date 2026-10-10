"use client";

import { useRef, useState } from "react";

import { InlineAlert } from "@/components/ui";

import { pdfDownloadName, pdfRequestFailureMessage } from "./pdf-request-state";

type RequestState = "idle" | "generating" | "succeeded" | "failed";

/** Admin pages supply only a server route and a known output selector; candidate facts reload server-side. */
export function AdminPdfRequest({ action, label, fields = {} }: {
  action: string;
  label: string;
  fields?: Record<string, string>;
}) {
  const [state, setState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");
  const requestInFlight = useRef(false);

  async function generate() {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setState("generating");
    setMessage("");
    try {
      const body = new FormData();
      for (const [key, value] of Object.entries(fields)) body.set(key, value);
      const response = await fetch(action, { method: "POST", body, credentials: "same-origin", cache: "no-store" });
      if (!response.ok || response.redirected || !response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) {
        throw new Error(pdfRequestFailureMessage(response.status, response.redirected));
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("The PDF could not be generated. Please try again.");
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = pdfDownloadName(response.headers.get("content-disposition"));
        document.body.append(link);
        link.click();
        link.remove();
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setState("succeeded");
      setMessage("A fresh PDF was generated from the current saved profile and downloaded. It was not stored as a client document.");
    } catch (error) {
      setState("failed");
      setMessage(error instanceof Error && /^(The PDF|Your session|You do not|This document|The profile)/.test(error.message)
        ? error.message : "The PDF could not be generated. Please try again or contact Zevantaa support.");
    } finally {
      requestInFlight.current = false;
    }
  }

  return <div className="layout-stack" aria-busy={state === "generating"}>
    <button className="auth-submit type-button" disabled={state === "generating"} onClick={generate} type="button">
      {state === "generating" ? "Generating PDF…" : state === "succeeded" ? "Generate fresh PDF" : label}
    </button>
    {state === "generating" && <p className="type-supporting" role="status">Preparing a private, on-demand PDF…</p>}
    {message && <InlineAlert variant={state === "succeeded" ? "success" : "error"}>{message}</InlineAlert>}
  </div>;
}
