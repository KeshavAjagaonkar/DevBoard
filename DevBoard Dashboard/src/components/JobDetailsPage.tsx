import React, { useState, useEffect } from "react";
import type { Application } from "../services/api";
import { ArrowLeft, Building, Briefcase, Calendar, Link2, FileText, Trash2, Clock, CheckCircle } from "lucide-react";

interface JobDetailsPageProps {
  job: Application;
  onBack: () => void;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onUpdateNotes: (id: string, notes: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
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

export const JobDetailsPage: React.FC<JobDetailsPageProps> = ({
  job,
  onBack,
  onUpdateStatus,
  onUpdateNotes,
  onDelete,
}) => {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setNotes(job.notes || "");
  }, [job]);

  const handleStatusChange = async (value: string) => {
    try {
      await onUpdateStatus(job.id, value);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateNotes(job.id, notes);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete your application for ${job.role} at ${job.company}?`)) {
      try {
        await onDelete(job.id);
        onBack();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to delete application");
      }
    }
  };

  const formatStatus = (status: string) => {
    const col = COLUMNS.find((c) => c.id === status);
    return col ? col.title : status;
  };

  const selectClass = `status-select badge-${job.status.toLowerCase()}`;

  return (
    <div className="details-page-container">
      {/* Back button header */}
      <button className="btn btn-secondary back-btn" onClick={onBack}>
        <ArrowLeft size={14} />
        Back to Dashboard
      </button>

      <div className="details-layout">
        {/* Main Details Panel */}
        <div className="details-main">
          <div className="details-header">
            <h1 className="details-company">
              <Building size={24} style={{ color: "var(--text-secondary)" }} />
              {job.company}
            </h1>
            <h2 className="details-role">
              <Briefcase size={18} style={{ color: "var(--text-secondary)" }} />
              {job.role}
            </h2>
          </div>

          <div className="details-notes-section">
            <div className="notes-header">
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "600" }}>
                <FileText size={16} />
                Application Notes
              </span>
              <button
                className="btn btn-primary save-notes-btn"
                onClick={handleSaveNotes}
                disabled={saving}
              >
                {saving ? "Saving..." : saveSuccess ? (
                  <>
                    <CheckCircle size={14} />
                    Saved!
                  </>
                ) : "Save Notes"}
              </button>
            </div>
            <textarea
              className="details-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write down interview questions, preparation material, company details, key contacts..."
            />
          </div>
        </div>

        {/* Sidebar Info Panel */}
        <div className="details-sidebar">
          <div className="sidebar-group">
            <h4 className="sidebar-title">Pipeline Stage</h4>
            <select
              className={selectClass}
              value={job.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{
                fontSize: "13px",
                padding: "6px 10px",
                width: "100%",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
                marginTop: "6px",
              }}
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id} style={{ backgroundColor: "#ffffff" }}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="sidebar-group">
            <h4 className="sidebar-title">Job Details</h4>
            <div className="sidebar-item">
              <Calendar size={13} />
              <span>
                Tracked: {new Date(job.appliedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            {job.jdUrl && (
              <div className="sidebar-item">
                <Link2 size={13} />
                <a href={job.jdUrl} target="_blank" rel="noopener noreferrer" className="job-link">
                  Open Original Listing
                </a>
              </div>
            )}
          </div>

          {/* History log */}
          {job.statusLogs && job.statusLogs.length > 0 && (
            <div className="sidebar-group">
              <h4 className="sidebar-title">
                <Clock size={13} />
                Status Timeline
              </h4>
              <ul className="timeline-list" style={{ marginTop: "10px" }}>
                {job.statusLogs.map((log) => (
                  <li key={log.id} className="timeline-item">
                    <span className="timeline-bullet" />
                    <span>
                      {log.fromStatus === log.toStatus ? (
                        <>Created in stage <strong>{formatStatus(log.toStatus)}</strong></>
                      ) : (
                        <>
                          Moved to <strong>{formatStatus(log.toStatus)}</strong>
                        </>
                      )}
                      <div className="timeline-time">
                        {new Date(log.changedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="sidebar-group" style={{ marginTop: "auto", paddingTop: "20px" }}>
            <button className="btn btn-danger" onClick={handleDelete} style={{ width: "100%" }}>
              <Trash2 size={14} />
              Delete Application
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
