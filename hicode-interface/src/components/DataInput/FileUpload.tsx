"use client";

import { useCallback, useState } from "react";
import { CloudUpload, X } from "lucide-react";

interface FileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export function FileUpload({ files, onFilesChange }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      const validFiles = droppedFiles.filter((f) =>
        /\.(csv|json|txt|pdf)$/i.test(f.name)
      );
      onFilesChange([...files, ...validFiles]);
    },
    [files, onFilesChange]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        onFilesChange([...files, ...selectedFiles]);
      }
    },
    [files, onFilesChange]
  );

  const removeFile = useCallback(
    (index: number) => {
      onFilesChange(files.filter((_, i) => i !== index));
    },
    [files, onFilesChange]
  );

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center gap-3
          w-full h-40 rounded-[var(--radius-m)] cursor-pointer
          border-2 border-dashed transition-colors
          ${isDragging
            ? "border-[var(--primary)] bg-[var(--primary)]/5"
            : "border-[var(--border)] hover:border-[var(--primary)]/50"
          }
        `}
      >
        <CloudUpload className="w-12 h-12 text-[var(--muted-foreground)]" />
        <p className="text-[var(--muted-foreground)] font-secondary text-sm text-center">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-[var(--muted-foreground)] font-secondary text-xs opacity-70">
          Supports: CSV, JSON, TXT, PDF
        </p>
        <input
          type="file"
          multiple
          accept=".csv,.json,.txt,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </label>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between px-4 py-2 bg-[var(--secondary)] rounded-lg"
            >
              <span className="font-secondary text-sm text-[var(--foreground)] truncate">
                {file.name}
              </span>
              <button
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-[var(--border)] rounded"
              >
                <X className="w-4 h-4 text-[var(--muted-foreground)]" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
