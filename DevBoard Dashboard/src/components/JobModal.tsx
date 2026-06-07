import React, { useState, useEffect } from "react";
import type { Application } from "../services/api";
import { Building, Briefcase, Link2, FileText, X } from "lucide-react";

interface JobModalProps {
  job?: Application | null;
  onClose: () => void;
  onSave: (payload: {
    company: string;
    role: string;
    jdUrl?: string;
    notes?: string;
  }) => Promise<void>;
}

export const JobModal: React.FC<JobModalProps> = ({ job, onClose, onSave }) => {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (job) {
      setCompany(job.company);
      setRole(job.role);
      setJdUrl(job.jdUrl || "");
      setNotes(job.notes || "");
    } else {
      setCompany("");
      setRole("");
      setJdUrl("");
      setNotes("");
    }
  }, [job]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSave({
        company: company.trim(),
        role: role.trim(),
        jdUrl: jdUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save application");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{job ? "Edit Job Details" : "Track New Application"}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="feedback-msg error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="company" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Building size={12} />
              Company Name
            </label>
            <input
              type="text"
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Google"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="role" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Briefcase size={12} />
              Role / Position
            </label>
            <input
              type="text"
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Software Engineer"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="jdUrl" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Link2 size={12} />
              Job Description URL
            </label>
            <input
              type="url"
              id="jdUrl"
              value={jdUrl}
              onChange={(e) => setJdUrl(e.target.value)}
              placeholder="https://company.com/careers/123"
            />
          </div>

          <div className="field">
            <label htmlFor="notes" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FileText size={12} />
              Notes / Observations
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add key info, links, contacts..."
              rows={4}
              style={{ resize: "vertical" }}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Saving..." : job ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
