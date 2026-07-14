import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Upload, Download, Trash2, Share2, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { documentsApi, ApiDocument } from '../../lib/documentsApi';
import toast from 'react-hot-toast';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await documentsApi.list();
      setDocuments(docs);
    } catch (err) {
      toast.error('Could not load documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
        const doc = await documentsApi.upload(file);
        setDocuments((prev) => [doc, ...prev]);
        toast.success('Document uploaded');
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Upload failed');
      } finally {
        setIsUploading(false);
      }
    };
    input.click();
  };

  const handleDelete = async (id: string) => {
    try {
      await documentsApi.remove(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast.success('Document deleted');
    } catch (err) {
      toast.error('Could not delete document');
    }
  };

  const handleDownload = (doc: ApiDocument) => {
    window.open(documentsApi.fileUrlFor(doc.fileUrl), '_blank');
  };

  const totalBytes = documents.reduce((sum, d) => sum + d.fileSize, 0);
  // Arbitrary demo storage cap - swap for a real plan-based limit later
  const STORAGE_CAP_BYTES = 500 * 1024 * 1024;
  const usedPercent = Math.min(100, (totalBytes / STORAGE_CAP_BYTES) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600">Manage your startup's important files</p>
        </div>

        <Button
          leftIcon={isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          onClick={handleUploadClick}
          disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload Document'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Storage info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <h2 className="text-lg font-medium text-gray-900">Storage</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Used</span>
                <span className="font-medium text-gray-900">{formatBytes(totalBytes)}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div
                  className="h-2 bg-primary-600 rounded-full"
                  style={{ width: `${usedPercent}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Documents</span>
                <span className="font-medium text-gray-900">{documents.length}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Document list */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">All Documents</h2>
            </CardHeader>
            <CardBody>
              {isLoading ? (
                <div className="flex justify-center py-12 text-gray-400">
                  <Loader2 className="animate-spin" size={28} />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No documents yet. Upload your first file to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center p-4 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                    >
                      <div className="p-2 bg-primary-50 rounded-lg mr-4">
                        <FileText size={24} className="text-primary-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-gray-900 truncate">{doc.name}</h3>
                          {doc.status === 'signed' && (
                            <Badge variant="secondary" size="sm">Signed</Badge>
                          )}
                          {doc.sharedWith.length > 0 && (
                            <Badge variant="secondary" size="sm">Shared</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span>{doc.fileType.split('/').pop()?.toUpperCase()}</span>
                          <span>{formatBytes(doc.fileSize)}</span>
                          <span>Uploaded {formatDate(doc.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2"
                          aria-label="Download"
                          onClick={() => handleDownload(doc)}
                        >
                          <Download size={18} />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2"
                          aria-label="Share"
                          onClick={() => toast('Sharing UI coming soon - wire this to documentsApi.share()')}
                        >
                          <Share2 size={18} />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2 text-error-600 hover:text-error-700"
                          aria-label="Delete"
                          onClick={() => handleDelete(doc.id)}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
