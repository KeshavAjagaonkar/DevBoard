import React from "react";
import type { AnalyticsData } from "../services/api";
import { TrendingUp, Layers, BarChart2 } from "lucide-react";

interface AnalyticsPanelProps {
  data: AnalyticsData;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ data }) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (data.interviewRate / 100) * circumference;

  const statusLabelMap: Record<string, string> = {
    APPLIED: "Applied",
    PHONE_SCREEN: "Phone Screen",
    TECHNICAL: "Technical Interview",
    OA: "Online Assess.",
    ONSITE: "Onsite Interview",
    OFFER: "Offers Received",
    REJECTED: "Rejected",
    GHOSTED: "Ghosted",
  };

  const statusColors: Record<string, string> = {
    APPLIED: "var(--text-secondary)",
    PHONE_SCREEN: "#0b6fa2",
    TECHNICAL: "#b35900",
    OA: "#ad1a1a",
    ONSITE: "#6931a5",
    OFFER: "var(--success)",
    REJECTED: "var(--error)",
    GHOSTED: "var(--text-muted)",
  };

  return (
    <div className="analytics-grid">
      {/* Metric 1: Total applications */}
      <div className="analytics-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span className="analytics-title">Total applications</span>
          <Layers size={16} style={{ color: "var(--text-secondary)" }} />
        </div>
        <div className="analytics-value">{data.total}</div>
        <div className="analytics-detail">
          Active job tracking records
        </div>
      </div>

      {/* Metric 2: Interview rate ring */}
      <div className="analytics-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span className="analytics-title">Interview rate</span>
          <TrendingUp size={16} style={{ color: "var(--text-secondary)" }} />
        </div>
        <div className="progress-container" style={{ marginTop: "12px" }}>
          <svg width="68" height="68" className="svg-ring">
            <circle
              cx="34"
              cy="34"
              r={radius}
              stroke="rgba(55, 53, 47, 0.05)"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="34"
              cy="34"
              r={radius}
              stroke="var(--primary)"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }}
            />
          </svg>
          <div>
            <div style={{ fontSize: "22px", fontWeight: "700" }}>{data.interviewRate}%</div>
            <div className="analytics-detail">Progressed past Applied</div>
          </div>
        </div>
      </div>

      {/* Metric 3: Distribution list */}
      <div className="analytics-card" style={{ gridColumn: "span 2" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span className="analytics-title">Stage breakdown</span>
          <BarChart2 size={16} style={{ color: "var(--text-secondary)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
          {Object.entries(data.byStatus).map(([status, count]) => {
            if (count === 0) return null;
            const percentage = data.total > 0 ? (count / data.total) * 100 : 0;
            return (
              <div key={status} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "11px", width: "110px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", color: "var(--text-secondary)", fontWeight: "500" }}>
                  {statusLabelMap[status] || status}
                </span>
                <div style={{ flex: 1, height: "6px", backgroundColor: "rgba(55, 53, 47, 0.05)", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${percentage}%`,
                      backgroundColor: statusColors[status] || "var(--primary)",
                      borderRadius: "3px",
                      transition: "width 0.4s ease-out",
                    }}
                  />
                </div>
                <span style={{ fontSize: "11px", fontWeight: "600", width: "20px", textAlign: "right" }}>
                  {count}
                </span>
              </div>
            );
          })}
          {data.total === 0 && (
            <div className="analytics-detail" style={{ fontStyle: "italic", textAlign: "center", margin: "6px 0" }}>
              No application history to generate a breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
