import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { Video, Calendar as CalendarIcon, Check, X, Ban, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, BadgeVariant } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { meetingsApi, Meeting } from '../../lib/meetings';
import { api } from '../../lib/api';

// A lightweight person the scheduling dropdown can pick from
interface Contact {
  id: string;
  name: string;
  role: 'entrepreneur' | 'investor';
}

const statusBadge: Record<Meeting['status'], { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pending', variant: 'warning' },
  accepted: { label: 'Accepted', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
  cancelled: { label: 'Cancelled', variant: 'gray' },
};

export const MeetingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    participantId: '',
    title: '',
    notes: '',
    date: '',
    startTime: '',
    endTime: '',
  });

  const loadMeetings = useCallback(async () => {
    try {
      const data = await meetingsApi.listMine();
      setMeetings(data);
    } catch {
      toast.error('Could not load meetings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
    // The opposite role is who you'd schedule a meeting with
    const oppositeRole = user?.role === 'investor' ? 'entrepreneur' : 'investor';
    api
      .get('/profile', { params: { role: oppositeRole } })
      .then(({ data }) => setContacts(data.users.map((u: any) => ({ id: u.id, name: u.name, role: u.role }))))
      .catch(() => {});
  }, [loadMeetings, user?.role]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.participantId || !form.title || !form.date || !form.startTime || !form.endTime) {
      toast.error('Please fill in every field');
      return;
    }

    setSubmitting(true);
    try {
      await meetingsApi.create({
        participantId: form.participantId,
        title: form.title,
        notes: form.notes,
        startTime: new Date(`${form.date}T${form.startTime}`).toISOString(),
        endTime: new Date(`${form.date}T${form.endTime}`).toISOString(),
      });
      toast.success('Meeting request sent');
      setShowForm(false);
      setForm({ participantId: '', title: '', notes: '', date: '', startTime: '', endTime: '' });
      loadMeetings();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not schedule meeting');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: 'accept' | 'reject' | 'cancel') => {
    try {
      const fn = { accept: meetingsApi.accept, reject: meetingsApi.reject, cancel: meetingsApi.cancel }[action];
      await fn(id);
      toast.success(`Meeting ${action}ed`);
      loadMeetings();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Could not ${action} meeting`);
    }
  };

  // Group meetings by day for a simple, readable agenda view
  const grouped: { date: Date; items: Meeting[] }[] = [];
  meetings.forEach((m) => {
    const d = new Date(m.startTime);
    const bucket = grouped.find((g) => isSameDay(g.date, d));
    if (bucket) bucket.items.push(m);
    else grouped.push({ date: d, items: [m] });
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="text-gray-500 text-sm mt-1">Schedule and manage your calls</p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => setShowForm((s) => !s)}>
          Schedule Meeting
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-semibold text-gray-900">New Meeting Request</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meet with</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={form.participantId}
                  onChange={(e) => setForm({ ...form, participantId: e.target.value })}
                >
                  <option value="">Select a person...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                  ))}
                </select>
              </div>

              <Input
                label="Title"
                placeholder="e.g. Seed round discussion"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
                <Input
                  label="Start time"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
                <Input
                  label="End time"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button variant="primary" type="submit" isLoading={submitting}>Send Request</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading meetings...</p>
      ) : grouped.length === 0 ? (
        <Card>
          <CardBody className="text-center py-10">
            <CalendarIcon className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-500">No meetings scheduled yet.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, items }) => (
            <div key={date.toISOString()}>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">{format(date, 'EEEE, MMMM d, yyyy')}</h3>
              <div className="space-y-3">
                {items.map((m) => {
                  const otherParty = m.organizer.id === user?.id ? m.participant : m.organizer;
                  const iAmOrganizer = m.organizer.id === user?.id;
                  const badge = statusBadge[m.status];

                  return (
                    <Card key={m.id}>
                      <CardBody className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar src={otherParty.avatarUrl} alt={otherParty.name} size="md" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{m.title}</p>
                            <p className="text-sm text-gray-500 truncate">
                              with {otherParty.name} · {format(new Date(m.startTime), 'p')} – {format(new Date(m.endTime), 'p')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={badge.variant}>{badge.label}</Badge>

                          {m.status === 'pending' && !iAmOrganizer && (
                            <>
                              <Button size="sm" variant="success" leftIcon={<Check size={14} />} onClick={() => handleAction(m.id, 'accept')}>
                                Accept
                              </Button>
                              <Button size="sm" variant="error" leftIcon={<X size={14} />} onClick={() => handleAction(m.id, 'reject')}>
                                Reject
                              </Button>
                            </>
                          )}

                          {['pending', 'accepted'].includes(m.status) && (
                            <Button size="sm" variant="ghost" leftIcon={<Ban size={14} />} onClick={() => handleAction(m.id, 'cancel')}>
                              Cancel
                            </Button>
                          )}

                          {m.status === 'accepted' && (
                            <Button size="sm" variant="primary" leftIcon={<Video size={14} />} onClick={() => navigate(`/call/${m.roomId}`)}>
                              Join Call
                            </Button>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
