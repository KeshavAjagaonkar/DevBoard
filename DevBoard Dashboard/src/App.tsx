import { useState, useEffect } from "react";
import { api, clearToken, getToken } from "./services/api";
import type { Application, AnalyticsData } from "./services/api";
import { AuthPage } from "./components/AuthPage";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { KanbanBoard } from "./components/KanbanBoard";
import { JobModal } from "./components/JobModal";
import { JobDetailsPage } from "./components/JobDetailsPage";
import { IMAPSettings } from "./components/IMAPSettings";
import { Compass, Plus, LogOut, Settings, RefreshCw } from "lucide-react";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Application | null>(null);
  
  // Navigation state for details view page
  const [activeView, setActiveView] = useState<"board" | "details">("board");
  const [selectedJob, setSelectedJob] = useState<Application | null>(null);

  // Email sync and profile state
  const [userEmail, setUserEmail] = useState("test@example.com");
  const [imapEnabled, setImapEnabled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Check login state on startup
  useEffect(() => {
    const token = getToken();
    if (token) {
      setIsAuthenticated(true);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchData = async () => {
    try {
      const [appsData, statsData, profileData] = await Promise.all([
        api.getApplications(),
        api.getAnalytics(),
        api.getProfile(),
      ]);
      setApplications(appsData);
      setAnalytics(statsData);
      setUserEmail(profileData.email);
      setImapEnabled(profileData.imapEnabled);
      
      // Update selectedJob state if we are currently viewing the details page
      if (selectedJob) {
        const freshJob = appsData.find((j) => j.id === selectedJob.id);
        if (freshJob) {
          setSelectedJob(freshJob);
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  // Load data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      fetchData();
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    clearToken();
    setIsAuthenticated(false);
    setApplications([]);
    setAnalytics(null);
    setSelectedJob(null);
    setActiveView("board");
    setUserEmail("test@example.com");
    setImapEnabled(false);
  };

  const handleSyncEmails = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatusMsg("Scanning inbox...");
    try {
      const res = await api.syncEmails();
      setSyncStatusMsg(`Sync complete! Found ${res.stats.syncedCount} emails, updated ${res.stats.updatedCount} jobs.`);
      await fetchData();
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } catch (err: any) {
      setSyncStatusMsg(`Sync failed: ${err.message || "Connection error"}`);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveJob = async (payload: {
    company: string;
    role: string;
    jdUrl?: string;
    notes?: string;
  }) => {
    if (editingJob) {
      await api.updateApplication(editingJob.id, payload);
    } else {
      await api.createApplication(payload);
    }
    await fetchData();
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    await api.updateApplication(id, { status: newStatus });
    await fetchData();
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    await api.updateApplication(id, { notes });
    await fetchData();
  };

  const handleDeleteJob = async (id: string) => {
    await api.deleteApplication(id);
    await fetchData();
  };

  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={() => setIsAuthenticated(true)} />;
  }

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <div className="logo">
          <span className="logo-icon">
            <Compass size={18} />
          </span>
          <span className="logo-text">DevBoard</span>
        </div>
        <div className="user-nav">
          <span className="user-email">{userEmail}</span>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: "4px 8px", fontSize: "12px" }}>
            <LogOut size={12} />
            Logout
          </button>
        </div>
      </header>

      <main className="main-content">
        {activeView === "details" && selectedJob ? (
          <JobDetailsPage
            job={selectedJob}
            onBack={() => {
              setSelectedJob(null);
              setActiveView("board");
            }}
            onUpdateStatus={handleUpdateStatus}
            onUpdateNotes={handleUpdateNotes}
            onDelete={handleDeleteJob}
          />
        ) : (
          <>
            <div className="board-header-section">
              <div className="board-title">
                <h2>Your Tracking Pipeline</h2>
                <p>Monitor your stages and conversion rates</p>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {imapEnabled && (
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleSyncEmails} 
                    disabled={isSyncing}
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >
                    <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                    {isSyncing ? "Syncing..." : "Sync Emails"}
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => setIsSettingsOpen(true)}>
                  <Settings size={14} />
                  Email Settings
                </button>
                <button className="btn btn-primary" onClick={() => { setEditingJob(null); setIsModalOpen(true); }}>
                  <Plus size={14} />
                  Add Application
                </button>
              </div>
            </div>

            {syncStatusMsg && (
              <div className={`feedback-msg ${syncStatusMsg.includes("failed") ? "error" : "success"}`} style={{ margin: "0", fontSize: "12px", width: "fit-content" }}>
                {syncStatusMsg}
              </div>
            )}

            {/* Analytics panels */}
            {analytics && <AnalyticsPanel data={analytics} />}

            {/* Kanban Board */}
            <KanbanBoard
              applications={applications}
              onUpdateStatus={handleUpdateStatus}
              onEditJob={(job) => {
                setEditingJob(job);
                setIsModalOpen(true);
              }}
              onDeleteJob={handleDeleteJob}
              onViewDetails={(job) => {
                setSelectedJob(job);
                setActiveView("details");
              }}
            />
          </>
        )}
      </main>

      {isModalOpen && (
        <JobModal
          job={editingJob}
          onClose={() => {
            setIsModalOpen(false);
            setEditingJob(null);
          }}
          onSave={handleSaveJob}
        />
      )}

      {isSettingsOpen && (
        <IMAPSettings
          onClose={() => setIsSettingsOpen(false)}
          onSave={fetchData}
        />
      )}
    </div>
  );
}

export default App;
