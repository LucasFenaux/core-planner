import { useState, useEffect } from 'react';
import { Database, Download, Save, ServerCrash, Clock, HardDrive, RefreshCw } from 'lucide-react';

interface BackupEntry {
  filename: string;
  size_kb: number;
  created_at: string;
}

export function SettingsView() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState('');
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch('/api/backups');
      if (res.ok) setBackups(await res.json());
    } catch {
      // silently ignore
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    setBackupMessage('');
    setBackupError('');

    try {
      const res = await fetch('/api/backup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Backup failed');
      setBackupMessage(`${data.message} (${data.total_backups} total)`);
      fetchBackups(); // refresh list
    } catch (err: any) {
      setBackupError(err.message || 'Failed to trigger backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  const labelColor = (filename: string) => {
    if (filename.includes('_startup')) return { bg: 'rgba(52,152,219,0.12)', color: '#3498db', label: 'startup' };
    if (filename.includes('_auto'))    return { bg: 'rgba(46,204,113,0.12)',  color: '#2ecc71', label: 'auto' };
    if (filename.includes('_manual'))  return { bg: 'rgba(155,89,182,0.12)', color: '#9b59b6', label: 'manual' };
    return { bg: 'rgba(149,165,166,0.12)', color: '#95a5a6', label: 'legacy' };
  };

  return (
    <div className="page-body" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>

      {/* Header card */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Database size={24} style={{ color: 'var(--accent-color)' }} />
          <h2 style={{ margin: 0 }}>Database Management</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Your data is backed up automatically every <strong>24 hours</strong> and on every startup.
          Backups are stored in the <code>data/backups/</code> folder and the newest <strong>30</strong> are kept.
        </p>
      </div>

      {/* Manual backup */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Manual Backup</h3>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          Create an extra snapshot of your database right now.
        </p>

        <button className="btn-primary" onClick={handleManualBackup} disabled={isBackingUp}>
          <Download size={18} />
          {isBackingUp ? 'Backing up…' : 'Trigger Manual Backup'}
        </button>

        {backupMessage && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(46,204,113,0.1)', color: '#2ecc71', borderRadius: '4px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Save size={16} /> {backupMessage}
          </div>
        )}
        {backupError && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', borderRadius: '4px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ServerCrash size={16} /> {backupError}
          </div>
        )}
      </div>

      {/* Backup history */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Backup History</h3>
          <button className="btn-icon" onClick={fetchBackups} title="Refresh list">
            <RefreshCw size={16} />
          </button>
        </div>

        {loadingBackups ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Loading…</p>
        ) : backups.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No backups yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {backups.map((b) => {
              const tag = labelColor(b.filename);
              return (
                <div
                  key={b.filename}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.9rem',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                  }}
                >
                  <HardDrive size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />

                  <span style={{ flex: 1, fontFamily: 'monospace', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.filename}
                  </span>

                  <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '0.75rem', background: tag.bg, color: tag.color, flexShrink: 0 }}>
                    {tag.label}
                  </span>

                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    <Clock size={12} /> {b.created_at}
                  </span>

                  <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {b.size_kb} KB
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
