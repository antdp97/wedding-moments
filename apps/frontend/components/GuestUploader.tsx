'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Upload, X, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getPresignedUrl, uploadFile, savePhotoMetadata } from '@/lib/api';

interface GuestUploaderProps {
  eventSlug?: string;
  eventId?: string;
}

export default function GuestUploader({ eventSlug, eventId }: GuestUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [userName, setUserName] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles?.length > 0) {
      setFile(acceptedFiles[0]);
      setSuccess(false);
      setProgress(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
      'video/*': [],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;

    // Require eventId for real uploads
    if (!eventId) {
      toast.error('Event not configured. Please try again later.');
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      // Step A: Get presigned URL from backend
      const presignedResponse = await getPresignedUrl(file.name, file.type);
      setProgress(30);

      // Step B: Upload file (handles both S3 and local modes)
      const photoUrl = await uploadFile(presignedResponse, file);
      setProgress(80);

      // Step C: Notify backend with photo metadata
      await savePhotoMetadata({
        eventId,
        url: photoUrl,
        senderName: userName || undefined,
        message: message || undefined,
        mimeType: file.type,
      });
      setProgress(100);

      setSuccess(true);
      toast.success('Photo uploaded successfully!');

      // Reset after success
      setTimeout(() => {
        setFile(null);
        setSuccess(false);
        setUploading(false);
        setProgress(0);
        setMessage('');
        // Keep userName for convenience
      }, 3000);

    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Upload failed. Please try again.');
      setUploading(false);
      setProgress(0);
    }
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
  };

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <Card className="border-2 border-border/50 bg-card/95 backdrop-blur shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-primary text-xl font-bold font-serif">
            Share Your Moment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 cursor-pointer text-center
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted'}
              ${file ? 'border-success/50 bg-success/5' : ''}
            `}
          >
            <input {...getInputProps()} />

            {file ? (
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="relative w-full h-48 rounded-lg overflow-hidden bg-background">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  <button
                    onClick={removeFile}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm font-medium truncate max-w-full px-2">{file.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3 py-6">
                <div className="p-4 bg-primary/10 rounded-full text-primary">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Tap to upload</p>
                  <p className="text-xs text-muted-foreground">or drag and drop photo/video</p>
                </div>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs text-muted-foreground uppercase tracking-wider">Your Name (Optional)</Label>
              <Input
                id="name"
                placeholder="Guest"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="bg-background/50 border-input/50 focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="message" className="text-xs text-muted-foreground uppercase tracking-wider">Message (Optional)</Label>
              <Input
                id="message"
                placeholder="Congrats!"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="bg-background/50 border-input/50 focus:border-primary"
              />
            </div>
          </div>

          {/* Progress */}
          {uploading && (
            <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center justify-center text-green-600 gap-2 font-medium animate-in zoom-in">
              <CheckCircle className="w-5 h-5" />
              <span>Sent to LiveWall!</span>
            </div>
          )}

        </CardContent>
        <CardFooter>
          <Button
            className="w-full text-lg font-medium h-12 shadow-lg hover:shadow-xl transition-all"
            onClick={handleUpload}
            disabled={!file || uploading || success}
          >
            {uploading ? 'Sending...' : success ? 'Uploaded' : 'Send to Screen'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
