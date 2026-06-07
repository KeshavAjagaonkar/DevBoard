import React from "react";
import type { Application } from "../services/api";
import {
  ExternalLink,
  Edit2,
  Trash2,
  Calendar,
  Building,
  Briefcase,
} from "lucide-react";

interface KanbanBoardProps {
  applications: Application[];
  onUpdateStatus: (id: string, newStatus: string) => Promise<void>;
  onEditJob: (job: Application) => void;
  onDeleteJob: (id: string) => Promise<void>;
  onViewDetails: (job: Application) => void;
}

const COLUMNS = [
  { id: "APPLIED", title: "Applied", badgeClass: "badge-applied" },
  { id: "PHONE_SCREEN", title: "Phone Screen", badgeClass: "badge-phone_screen" },
  { id: "TECHNICAL", title: "Technical Interview", badgeClass: "badge-technical" },
  { id: "OA", title: "Online Assessment", badgeClass: "badge-oa" },
  { id: "ONSITE", title: "Onsite Interview", badgeClass: "badge-onsite" },
  { id: "OFFER", title: "Offers", badgeClass: "badge-offer" },
  { id: "REJECTED", title: "Rejected", badgeClass: "badge-rejected" },
  { id: "GHOSTED", title: "Ghosted", badgeClass: "badge-ghosted" },
] as const;

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  applications,
  onUpdateStatus,
  onEditJob,
  onDeleteJob,
  onViewDetails,
}) => {
  const getColumnJobs = (statusId: string) => {
    return applications.filter((app) => app.status === statusId);
  };

  const handleStatusChange = async (id: string, value: string) => {
    try {
      await onUpdateStatus(id, value);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent, id: string, company: string, role: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete your application for ${role} at ${company}?`)) {
      try {
        await onDeleteJob(id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to delete application");
      }
    }
  };

  const handleEditClick = (e: React.MouseEvent, job: Application) => {
    e.stopPropagation();
    onEditJob(job);
  };

  return (
    <div className="kanban-container">
      {COLUMNS.map((col) => {
        const columnJobs = getColumnJobs(col.id);
        return (
          <div key={col.id} className="kanban-column">
            <div className="column-header">
              <div className="column-title">
                <span className={`column-badge ${col.badgeClass}`}>{col.title}</span>
              </div>
              <span className="column-badge">{columnJobs.length}</span>
            </div>

            <div className="column-cards">
              {columnJobs.map((job) => {
                const selectClass = `status-select badge-${job.status.toLowerCase()}`;

                return (
                  <div
                    key={job.id}
                    className="job-card"
                    onClick={() => onViewDetails(job)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="job-card-header">
                      <div className="job-company">
                        <Building size={14} style={{ color: "var(--text-secondary)" }} />
                        {job.company}
                      </div>
                      <div className="job-role">
                        <Briefcase size={12} style={{ marginRight: "4px", display: "inline", verticalAlign: "middle" }} />
                        {job.role}
                      </div>
                    </div>

                    <div className="job-date">
                      <Calendar size={11} />
                      {new Date(job.appliedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>

                    <div className="job-card-footer">
                      {/* Notion Status Tag Select */}
                      <select
                        className={selectClass}
                        value={job.status}
                        onChange={(e) => handleStatusChange(job.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {COLUMNS.map((c) => (
                          <option
                            key={c.id}
                            value={c.id}
                            style={{
                              backgroundColor: "#ffffff",
                              color: "rgba(55, 53, 47, 0.9)",
                            }}
                          >
                            {c.title}
                          </option>
                        ))}
                      </select>

                      <div className="job-actions">
                        {job.jdUrl && (
                          <a
                            href={job.jdUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="job-link"
                            onClick={(e) => e.stopPropagation()}
                            title="Open Job Description"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}

                        <button
                          className="action-icon-btn edit"
                          onClick={(e) => handleEditClick(e, job)}
                          title="Edit Position details"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="action-icon-btn delete"
                          onClick={(e) => handleDeleteClick(e, job.id, job.company, job.role)}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {columnJobs.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    padding: "24px 10px",
                    border: "1px dashed rgba(55, 53, 47, 0.08)",
                    borderRadius: "6px",
                  }}
                >
                  No applications
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
