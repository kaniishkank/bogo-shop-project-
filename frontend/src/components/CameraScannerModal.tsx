import React, { useEffect, useRef } from 'react';
import { Camera } from 'lucide-react';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
}

export default function CameraScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  onScanError
}: CameraScannerModalProps) {
  const html5QrCodeRef = useRef<any>(null);

  const startCamera = async () => {
    try {
      await stopCamera();

      // Lazy-load html5-qrcode module to optimize bundle performance
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode('webcam-scanner');
      html5QrCodeRef.current = html5QrCode;

      const config = { 
        fps: 10, 
        qrbox: (width: number, height: number) => {
          const size = Math.min(width, height) * 0.70;
          return { width: size, height: size };
        }
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          stopCamera();
          onScanSuccess(decodedText);
        },
        undefined
      );
    } catch (err) {
      console.error('Failed to start camera scan:', err);
      if (onScanError) {
        onScanError('Could not access camera. Please check camera permissions.');
      }
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (err) {
        console.error('Failed to stop camera stream:', err);
      }
      html5QrCodeRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startCamera();
      }, 150);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="glass-panel glow-card-violet rounded-2xl w-full max-w-lg p-6 relative animate-scaleUp flex flex-col items-center">
        
        <div className="flex items-center justify-between w-full mb-4 border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-violet-400" />
            Live Camera Barcode Scanner
          </h3>
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 font-bold bg-slate-800/80 px-3 py-1 rounded-xl transition-all"
          >
            Cancel / Close
          </button>
        </div>

        <p className="text-xs text-slate-400 text-center mb-4">
          Center the barcode or QR code inside the camera scanning viewport guide below.
        </p>

        {/* Scanning Viewport */}
        <div className="w-full aspect-video rounded-2xl bg-[#0b0f19] border border-slate-700/80 overflow-hidden relative shadow-inner">
          <div id="webcam-scanner" className="w-full h-full"></div>
        </div>

        <div className="text-[10px] text-slate-500 font-mono mt-4 text-center">
          Scanning active • Support: EAN-13, EAN-8, UPC-A, Code 128, QR Codes
        </div>
      </div>
    </div>
  );
}
