import { useState, useRef, useCallback } from 'react'

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      throw error
    }
  }, [])

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current
      if (!mediaRecorder) {
        reject(new Error('No media recorder found'))
        return
      }

      mediaRecorder.onstop = async () => {
        setIsRecording(false)
        setIsTranscribing(true)
        
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
          
          // Send to transcription API
          const formData = new FormData()
          formData.append('audio', audioBlob, 'audio.wav')

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            throw new Error('Transcription failed')
          }

          const result = await response.json()
          resolve(result.text)
        } catch (error) {
          reject(error)
        } finally {
          setIsTranscribing(false)
          // Stop all tracks to release microphone
          mediaRecorder.stream.getTracks().forEach(track => track.stop())
        }
      }

      mediaRecorder.stop()
    })
  }, [])

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      mediaRecorder.stream.getTracks().forEach(track => track.stop())
      setIsRecording(false)
      setIsTranscribing(false)
    }
  }, [])

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    cancelRecording
  }
}