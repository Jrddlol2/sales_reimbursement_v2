import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { SupportRequest, SupportRequestStatus, SupportRequestPriority, UserRole } from '../types';
import { useAuth } from '../components/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { format } from 'date-fns';
import { Plus, Lifebuoy, CaretRight, ShieldCheck, User as UserIcon } from '@phosphor-icons/react';
import { useToast } from '../components/Toast';
import { EmptyState } from '../components/EmptyState';

export const Support: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // New Request Form State
  const urlParams = new URLSearchParams(window.location.search);
  const [showNew, setShowNew] = useState(urlParams.get('new') === 'true' && user?.role !== UserRole.ADMIN);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<SupportRequestPriority>(SupportRequestPriority.LOW);
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    try {
      const data = await apiFetch('/api/support');
      setRequests(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load support requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await apiFetch('/api/support', {
        method: 'POST',
        body: JSON.stringify({ subject, description, priority, related_entity_type: urlParams.get('entityType') || undefined, related_entity_id: urlParams.get('entityId') || undefined })
      });
      setRequests([...requests, data]);
      setShowNew(false);
      setSubject('');
      setDescription('');
      setPriority(SupportRequestPriority.LOW);
      toast.success('Support request submitted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 italic">Loading support requests...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2 font-display">
            <Lifebuoy className="w-6 h-6 text-brand" />
            Support Requests
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {user?.role === UserRole.ADMIN ? 'Manage all system support requests' : 'Your support history and active tickets'}
          </p>
        </div>
        {!showNew && user?.role !== UserRole.ADMIN && (
          <button onClick={() => setShowNew(true)} className="corp-btn-primary whitespace-nowrap">
            <Plus className="w-4 h-4" /> New Support Ticket
          </button>
        )}
      </div>

      {showNew && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4 font-display uppercase tracking-wider">Submit New Support Ticket</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Subject</label>
              <input type="text" required value={subject} onChange={e => setSubject(e.target.value)} className="w-full border-gray-300 rounded px-3 py-2 text-sm focus:border-brand focus:ring-brand" placeholder="Brief summary of the issue" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Description</label>
              <textarea required rows={4} value={description} onChange={e => setDescription(e.target.value)} className="w-full border-gray-300 rounded px-3 py-2 text-sm focus:border-brand focus:ring-brand" placeholder="Detailed explanation..."></textarea>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as SupportRequestPriority)} className="border-gray-300 rounded px-3 py-2 text-sm focus:border-brand focus:ring-brand">
                <option value={SupportRequestPriority.LOW}>Low</option>
                <option value={SupportRequestPriority.MEDIUM}>Medium</option>
                <option value={SupportRequestPriority.HIGH}>High</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitting} className="corp-btn-primary">
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {requests.length === 0 ? (
          <EmptyState icon={Lifebuoy} title="No support requests found" />
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ticket</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Updated</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).map(req => (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-900">{req.subject}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{req.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${req.priority === SupportRequestPriority.HIGH ? 'bg-red-100 text-red-800' : req.priority === SupportRequestPriority.MEDIUM ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                      {req.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(req.updated_at), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Link to={`/support/${req.id}`} className="text-brand hover:text-brand-hover inline-flex items-center text-sm font-semibold">
                      View <CaretRight className="w-4 h-4 ml-1" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
};
