'use client'

import { useState, useRef } from 'react'
import { Upload, File, X, FileText, Image } from 'lucide-react'
import { UploadedFile } from '@/lib/types'
import { useTranslation } from 'react-i18next'

interface FileUploadProps {
  files: UploadedFile[]
  onFilesChange: (files: UploadedFile[]) => void
  isProcessing: boolean
  documentsReady?: boolean
  selectedModelId?: string
  showUploadArea?: boolean
}

export default function FileUpload({ files, onFilesChange, isProcessing, documentsReady = false, selectedModelId, showUploadArea = true }: FileUploadProps) {
  const { t } = useTranslation()
  const [isDragOver, setIsDragOver] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    console.log('Files dropped:', e.dataTransfer.files.length)
    const droppedFiles = Array.from(e.dataTransfer.files)
    processFiles(droppedFiles)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      processFiles(selectedFiles)
    }
  }

  const processFiles = async (newFiles: File[]) => {
    console.log('Processing files:', newFiles.length, newFiles.map(f => f.name))
    const processedFiles: UploadedFile[] = []

    for (const file of newFiles) {
      console.log('Processing file:', file.name, 'Type:', file.type)
      // Process PDFs, text files, and images
      if (file.type === 'application/pdf' || file.type === 'text/plain' || file.type.startsWith('image/')) {
        try {
          setProcessingStatus(t('fileUpload.processing'))
          
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          })

          if (response.ok) {
            const result = await response.json()
            const isImage = file.type.startsWith('image/')
            const uploadedFile: UploadedFile = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              name: file.name,
              size: file.size,
              type: file.type,
              content: result.content,
              isImage
            }
            
            // Parse image data if this is an image file
            if (isImage) {
              try {
                uploadedFile.imageData = JSON.parse(result.content)
              } catch (e) {
                console.error('Failed to parse image data:', e)
              }
            }
            
            processedFiles.push(uploadedFile)
          }
        } catch (error) {
          console.error('Error processing file:', file.name, error)
          // Still show an error state file
          processedFiles.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: file.size,
            type: file.type,
            content: `Error processing file: ${file.name}`
          })
        }
      } else {
        console.log('File type not supported:', file.type)
      }
    }

    onFilesChange([...files, ...processedFiles])
    setProcessingStatus('')
  }

  const removeFile = (fileId: string) => {
    onFilesChange(files.filter(f => f.id !== fileId))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {showUploadArea && (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <Upload size={40} className="mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          {t('fileUpload.dragDrop')}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-blue-600 hover:text-blue-700 underline mb-2"
        >
          {t('fileUpload.selectFiles')}
        </button>
        <p className="text-sm text-gray-500">
          {t('fileUpload.supportedFormats')}
          {selectedModelId?.includes('Mistral-Small') && (
            <span className="block text-blue-600 dark:text-blue-400 font-medium mt-1">
              ✨ {t('fileUpload.imageAnalysis')}
            </span>
          )}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.jpg,.jpeg,.png,.gif"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      )}

      {/* Processing Status */}
      {processingStatus && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-blue-700 dark:text-blue-300">{t('fileUpload.processing')}</span>
        </div>
      )}

      {/* Success Status */}
      {files.length > 0 && documentsReady && !isProcessing && (
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-sm text-green-700 dark:text-green-300">
            ✅ {t('fileUpload.documentsReady')}
          </span>
        </div>
      )}

      {/* Processing Status for Embeddings */}
      {files.length > 0 && isProcessing && (
        <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-orange-700 dark:text-orange-300">
            🔄 {t('fileUpload.creatingEmbeddings')}
          </span>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('fileUpload.uploadedFiles', { count: files.length })}
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {file.isImage && file.imageData ? (
                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700">
                      <img 
                        src={file.imageData.data} 
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to icon if image fails to load
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.nextElementSibling!.style.display = 'flex'
                        }}
                      />
                      <div className="w-full h-full hidden items-center justify-center">
                        <Image size={20} className="text-blue-500" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10">
                      {file.type.startsWith('image/') ? 
                        <Image size={20} className="text-blue-500 flex-shrink-0" /> :
                        <FileText size={20} className="text-gray-500 flex-shrink-0" />
                      }
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} {file.isImage && `• ${t('fileUpload.image')}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title={t('fileUpload.remove')}
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}