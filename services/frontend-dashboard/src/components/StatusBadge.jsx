import React from "react";

const STATUS_STYLES = {
  Searching:  "bg-blue-900 text-blue-300 border-blue-700",
  Assigned:   "bg-emerald-900 text-emerald-300 border-emerald-700",
  "Syncing...": "bg-yellow-900 text-yellow-300 border-yellow-700 animate-pulse",
  Completed:  "bg-gray-800 text-gray-400 border-gray-600",
  Cancelled:  "bg-red-900 text-red-300 border-red-700",
  ACCEPTED:   "bg-emerald-900 text-emerald-300 border-emerald-700",
  REQUESTED:  "bg-blue-900 text-blue-300 border-blue-700",
  COMPLETED:  "bg-gray-800 text-gray-400 border-gray-600",
};

export default function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || "bg-gray-800 text-gray-400 border-gray-600";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {status === "Syncing..." && (
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
      )}
      {status}
    </span>
  );
}
