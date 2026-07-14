import { api } from './api';

export type MeetingStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface MeetingParty {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'entrepreneur' | 'investor';
}

export interface Meeting {
  id: string;
  organizer: MeetingParty;
  participant: MeetingParty;
  title: string;
  notes?: string;
  startTime: string; // ISO string
  endTime: string;
  status: MeetingStatus;
  roomId: string;
  createdAt: string;
}

export interface CreateMeetingInput {
  participantId: string;
  title: string;
  notes?: string;
  startTime: string; // ISO string
  endTime: string;
}

export const meetingsApi = {
  create: async (input: CreateMeetingInput): Promise<Meeting> => {
    const { data } = await api.post('/meetings', input);
    return data.meeting;
  },

  listMine: async (status?: MeetingStatus): Promise<Meeting[]> => {
    const { data } = await api.get('/meetings', { params: status ? { status } : {} });
    return data.meetings;
  },

  getById: async (id: string): Promise<Meeting> => {
    const { data } = await api.get(`/meetings/${id}`);
    return data.meeting;
  },

  accept: async (id: string): Promise<Meeting> => {
    const { data } = await api.patch(`/meetings/${id}/accept`);
    return data.meeting;
  },

  reject: async (id: string): Promise<Meeting> => {
    const { data } = await api.patch(`/meetings/${id}/reject`);
    return data.meeting;
  },

  cancel: async (id: string): Promise<Meeting> => {
    const { data } = await api.patch(`/meetings/${id}/cancel`);
    return data.meeting;
  },
};
