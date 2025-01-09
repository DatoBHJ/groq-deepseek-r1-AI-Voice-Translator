import { useState, useCallback, useRef, useEffect } from 'react';

interface UseAudioRecorderProps {
  onRecordingComplete: (blob: Blob) => Promise<void>;
  silenceThreshold?: number; // dB threshold for silence detection
  silenceTimeout?: number; // ms to wait before stopping
}

export function useAudioRecorder({ 
  onRecordingComplete,
  silenceThreshold = -50,
  silenceTimeout = 1500
}: UseAudioRecorderProps) {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const isProcessingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingStartRef = useRef<(() => Promise<void>) | null>(null);
  const recordingStopRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback((fullCleanup: boolean = false) => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    // Full cleanup only when completely stopping
    if (fullCleanup) {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          streamRef.current?.removeTrack(track);
        });
        streamRef.current = null;
      }

      if (mediaRecorder?.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }

      analyserRef.current = null;
    }

    // Always cleanup recording state
    setIsRecording(false);
    setMediaRecorder(null);
    audioChunksRef.current = [];
    isProcessingRef.current = false;
  }, [mediaRecorder]);

  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('Found supported MIME type:', type);
        return type;
      }
    }

    throw new Error('No supported audio MIME type found');
  };

  const startRecording = useCallback(async () => {
    if (isProcessingRef.current || isRecording) {
      console.log('Recording already in progress');
      return;
    }

    try {
      isProcessingRef.current = true;

      // Ensure we have a stream
      if (!streamRef.current || !audioContextRef.current || !analyserRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
        streamRef.current = stream;

        // Set up audio context and analyser
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.minDecibels = -90;
        analyserRef.current.maxDecibels = -10;
        analyserRef.current.smoothingTimeConstant = 0.85;
        source.connect(analyserRef.current);
      }
      
      // Get supported MIME type
      const mimeType = getSupportedMimeType();
      console.log('Using MIME type:', mimeType);

      // Create new MediaRecorder instance
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType,
        audioBitsPerSecond: 128000
      });
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Received audio chunk:', event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        console.log('Recording stopped');
        setIsRecording(false);
        
        if (audioChunksRef.current.length > 0) {
          console.log('Creating audio blob from', audioChunksRef.current.length, 'chunks');
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          console.log('Audio blob created:', audioBlob.size, 'bytes');
          
          try {
            await onRecordingComplete(audioBlob);
          } catch (error) {
            console.error('Error processing recording:', error);
          }
          
          audioChunksRef.current = [];
        } else {
          console.error('No audio data recorded');
        }

        // Only do partial cleanup
        cleanup(false);
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        cleanup(true);
      };

      // Start recording and request data every 500ms
      recorder.start(500);
      console.log('Recorder started');
      setMediaRecorder(recorder);
      setIsRecording(true);
      isProcessingRef.current = false;

    } catch (error) {
      console.error('Error starting recording:', error);
      cleanup(true);
      throw error;
    }
  }, [onRecordingComplete, cleanup, isRecording]);

  const stopRecording = useCallback(() => {
    if (isProcessingRef.current) {
      console.log('Already processing stop request');
      return;
    }

    console.log('Stopping recording...');
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      isProcessingRef.current = true;
      try {
        mediaRecorder.stop();
      } catch (error) {
        console.error('Error stopping recording:', error);
        cleanup(true);
      }
    } else {
      cleanup(false);
    }
  }, [mediaRecorder, cleanup]);

  // Store the recording functions in refs to avoid circular dependencies
  recordingStartRef.current = startRecording;
  recordingStopRef.current = stopRecording;

  const detectSilence = useCallback(() => {
    if (!analyserRef.current || !isListening) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const dB = 20 * Math.log10(average / 255);

    // Debug log for volume levels
    console.log('Current volume (dB):', dB.toFixed(2));

    if (dB < silenceThreshold) {
      console.log('Silence detected');
      if (!silenceTimeoutRef.current && isRecording) {
        console.log('Starting silence timeout');
        silenceTimeoutRef.current = setTimeout(() => {
          if (isRecording && recordingStopRef.current) {
            console.log('Stopping recording due to silence');
            recordingStopRef.current();
          }
        }, silenceTimeout);
      }
    } else {
      console.log('Voice detected');
      if (silenceTimeoutRef.current) {
        console.log('Clearing silence timeout');
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      if (!isRecording && isListening && recordingStartRef.current) {
        console.log('Starting recording due to voice');
        recordingStartRef.current();
      }
    }
  }, [isRecording, isListening, silenceThreshold, silenceTimeout]);

  // Use useEffect to handle continuous monitoring
  useEffect(() => {
    let animationFrameId: number;

    const monitorAudio = () => {
      detectSilence();
      if (isListening) {
        animationFrameId = requestAnimationFrame(monitorAudio);
      }
    };

    if (isListening) {
      monitorAudio();
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isListening, detectSilence]);

  const startListening = useCallback(async () => {
    console.log('startListening called, current state:', {
      isListening,
      audioContextState: audioContextRef.current?.state,
      hasStream: !!streamRef.current,
      hasAnalyser: !!analyserRef.current
    });

    try {
      // Check if we already have a stream and audio context
      if (!streamRef.current || !audioContextRef.current || !analyserRef.current) {
        console.log('Creating new audio stream and context');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });

        streamRef.current = stream;
        
        // Set up audio context and analyser
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.minDecibels = -90;
        analyserRef.current.maxDecibels = -10;
        analyserRef.current.smoothingTimeConstant = 0.85;
        source.connect(analyserRef.current);
      } else {
        console.log('Attempting to resume existing audio context');
        // Resume the audio context if it was suspended
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
          console.log('Audio context resumed');
          
          // Reconnect the stream to the analyser
          const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
          source.connect(analyserRef.current);
          console.log('Audio stream reconnected to analyser');
        }
      }

      setIsListening(true);
      console.log('Started listening for audio');

    } catch (error) {
      console.error('Error starting audio monitoring:', error);
      cleanup(true);
      throw error;
    }
  }, [cleanup]);

  const stopListening = useCallback(() => {
    console.log('stopListening called, current state:', {
      isListening,
      audioContextState: audioContextRef.current?.state,
      hasStream: !!streamRef.current,
      hasAnalyser: !!analyserRef.current
    });

    // If recording is in progress, stop it first
    if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
      console.log('Stopping ongoing recording');
      mediaRecorder.stop();
    }

    // First set the state to false to stop the monitoring loop
    setIsListening(false);
    console.log('Listening state set to false');

    // Then suspend the audio context and disconnect the source
    if (audioContextRef.current) {
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current!);
      source.disconnect();
      audioContextRef.current.suspend().then(() => {
        console.log('Audio context suspended');
      });
    }

    // Clear any pending silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, [isRecording, mediaRecorder]);

  return {
    startRecording,
    stopRecording,
    isRecording,
    startListening,
    stopListening,
    isListening
  };
} 