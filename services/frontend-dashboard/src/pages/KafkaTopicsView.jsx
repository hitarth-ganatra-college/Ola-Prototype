import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../services/api.js";

const MAX_VIEW_MESSAGES = 120;

function prettyPayload(payload) {
  if (payload == null) return "null";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export default function KafkaTopicsView() {
  const [topics, setTopics] = useState({});
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    let source = null;

    async function loadSnapshot() {
      const response = await fetch(`${API_BASE.trip}/kafka-monitor/messages`);
      if (!response.ok) {
        throw new Error(`Failed to load snapshot (HTTP ${response.status})`);
      }
      const data = await response.json();
      const next = {};
      for (const topic of data.topics || []) {
        next[topic.topic] = topic.messages || [];
      }
      setTopics(next);
    }

    function upsertMessage(message) {
      setTopics((prev) => {
        const current = prev[message.topic] || [];
        const next = [...current, message];
        if (next.length > MAX_VIEW_MESSAGES) {
          next.splice(0, next.length - MAX_VIEW_MESSAGES);
        }
        return { ...prev, [message.topic]: next };
      });
    }

    loadSnapshot().catch(() => setStatus("error"));

    source = new EventSource(`${API_BASE.trip}/kafka-monitor/events`);
    source.onopen = () => setStatus("live");
    source.onerror = () => setStatus("error");
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "snapshot") {
          const next = {};
          for (const topic of parsed.data?.topics || []) {
            next[topic.topic] = topic.messages || [];
          }
          setTopics(next);
          return;
        }
        if (parsed.topic) {
          upsertMessage(parsed);
        }
      } catch {
        // ignore malformed stream messages
      }
    };

    return () => source?.close();
  }, []);

  const orderedTopics = useMemo(
    () =>
      Object.entries(topics).sort(([, a], [, b]) => {
        const aLatest = a[a.length - 1]?.observed_at || "";
        const bLatest = b[b.length - 1]?.observed_at || "";
        return bLatest.localeCompare(aLatest);
      }),
    [topics]
  );

  const totalMessages = orderedTopics.reduce((sum, [, items]) => sum + items.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Kafka Topic Monitor</h2>
          <p className="text-sm text-gray-400 mt-1">
            Live stream of recent Kafka messages moving across services.
          </p>
        </div>
        <div className="card py-2 px-4 text-center">
          <p className="text-xl font-bold text-white">{totalMessages}</p>
          <p className="text-xs text-gray-500">Buffered messages</p>
        </div>
      </div>

      <div className="card flex items-center justify-between">
        <p className="text-sm text-gray-300">
          Status:{" "}
          <span className={status === "live" ? "text-emerald-400" : "text-red-400"}>
            {status === "live" ? "Live" : status === "connecting" ? "Connecting..." : "Disconnected"}
          </span>
        </p>
        <p className="text-xs text-gray-500">Auto-refresh via SSE</p>
      </div>

      <div className="space-y-4">
        {orderedTopics.map(([topicName, messages]) => (
          <div key={topicName} className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">{topicName}</h3>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                {messages.length}
              </span>
            </div>

            {messages.length === 0 ? (
              <p className="text-sm text-gray-500">No recent messages</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto pr-1">
                {[...messages].reverse().map((msg, idx) => (
                  <div key={`${msg.offset}-${idx}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span>Offset: {msg.offset}</span>
                      <span>{new Date(msg.observed_at || msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all">
                      {prettyPayload(msg.payload)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {orderedTopics.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-gray-400">Waiting for topic data…</p>
          </div>
        )}
      </div>
    </div>
  );
}
