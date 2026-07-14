import { api } from './api';

export interface ApiDocument {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: { id: string; name: string; avatarUrl: string } | string;
  sharedWith: string[];
  meetingId?: string;
  version: number;
  status: 'draft' | 'signed' | 'archived';
  signatureUrl?: string;
  signedBy?: string;
  signedAt?: string;
  createdAt: string;
}

export const documentsApi = {
  list: async (): Promise<ApiDocument[]> => {
    const { data } = await api.get('/documents');
    return data.documents;
  },

  get: async (id: string): Promise<ApiDocument> => {
    const { data } = await api.get(`/documents/${id}`);
    return data.document;
  },

  upload: async (file: File, meetingId?: string): Promise<ApiDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    if (meetingId) formData.append('meetingId', meetingId);

    const { data } = await api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.document;
  },

  share: async (id: string, userIds: string[]): Promise<ApiDocument> => {
    const { data } = await api.patch(`/documents/${id}/share`, { userIds });
    return data.document;
  },

  // signatureBlob is the PNG exported from a <canvas> signature pad
  // (e.g. react-signature-canvas's `.toDataURL()` converted to a Blob)
  sign: async (id: string, signatureBlob: Blob): Promise<ApiDocument> => {
    const formData = new FormData();
    formData.append('signature', signatureBlob, 'signature.png');

    const { data } = await api.post(`/documents/${id}/sign`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.document;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },

  // Builds the full URL to preview/download a stored file
  fileUrlFor: (relativeUrl: string): string => {
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');
    return `${base}${relativeUrl}`;
  },
};
