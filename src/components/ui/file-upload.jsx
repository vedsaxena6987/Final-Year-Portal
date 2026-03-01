"use client";

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { logger } from "../../lib/logger";
const FileUpload = ({ 
  onUploadComplete, 
  acceptedTypes = { 'application/pdf': ['.pdf'], 'application/vnd.ms-powerpoint': ['.ppt'], 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] },
  maxSize = 10 * 1024 * 1024, // 10MB default
  folder = 'submissions',
  teamId,
  phaseId,
  disabled = false
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    if (disabled) return;

    // Handle rejected files
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach(({ file, errors }) => {
        errors.forEach((error) => {
          if (error.code === 'file-too-large') {
            toast.error(`File "${file.name}" is too large. Maximum size is ${maxSize / 1024 / 1024}MB.`);
          } else if (error.code === 'file-invalid-type') {
            toast.error(`File "${file.name}" is not a supported format. Please upload PDF or PPT files only.`);
          }
        });
      });
    }

    // Handle accepted files
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]; // Only handle first file
      await uploadFile(file);
    }
  }, [disabled, maxSize]);

  const uploadFile = async (file) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${folder}/${teamId}/${phaseId}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);

      // Upload file with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          logger.error('Upload error:', error);
          toast.error('Upload failed. Please try again.');
          setUploading(false);
          setUploadProgress(0);
        },
        async () => {
          // Upload completed successfully
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const fileData = {
              name: file.name,
              size: file.size,
              type: file.type,
              url: downloadURL,
              path: fileName,
              uploadedAt: new Date()
            };
            
            setUploadedFile(fileData);
            setUploading(false);
            toast.success('File uploaded successfully!');
            
            // Call the parent callback
            if (onUploadComplete) {
              onUploadComplete(fileData);
            }
          } catch (error) {
            logger.error('Error getting download URL:', error);
            toast.error('Upload failed. Please try again.');
            setUploading(false);
          }
        }
      );
    } catch (error) {
      logger.error('Upload error:', error);
      toast.error('Upload failed. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setUploadProgress(0);
    // Note: In production, you might want to delete the file from storage
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes,
    maxSize,
    multiple: false,
    disabled: disabled || uploading
  });

  if (uploadedFile) {
    return (
      <div className="flex items-center gap-3 p-4 border rounded-lg bg-green-50 border-green-200">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <div className="flex-1">
          <p className="font-medium text-green-900">{uploadedFile.name}</p>
          <p className="text-sm text-green-600">
            Uploaded successfully • {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={removeFile}
          className="text-green-600 hover:text-green-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (uploading) {
    return (
      <div className="p-6 border-2 border-dashed rounded-lg">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 animate-pulse" />
            <span>Uploading...</span>
          </div>
          <Progress value={uploadProgress} className="w-full" />
          <p className="text-sm text-muted-foreground">
            {Math.round(uploadProgress)}% complete
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
        isDragActive
          ? 'border-primary bg-primary/5'
          : disabled
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
          : 'border-gray-300 hover:border-primary'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <div className={`p-3 rounded-full ${isDragActive ? 'bg-primary/10' : 'bg-gray-100'}`}>
          <Upload className={`h-6 w-6 ${isDragActive ? 'text-primary' : 'text-gray-600'}`} />
        </div>
        <div className="text-center">
          <p className="font-medium">
            {isDragActive ? 'Drop the file here' : 'Click to upload or drag and drop'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            PDF, PPT, PPTX files up to {maxSize / 1024 / 1024}MB
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
