import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Upload, AlertCircle, RefreshCw } from 'lucide-react';

interface ScannerModalProps {
  onScanDni: (dni: string) => void;
  onClose?: () => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ onScanDni }) => {
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);

  useEffect(() => {
    // Listar cámaras disponibles
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Preferir cámara trasera si existe
          const backCam = devices.find(
            (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('trasera')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.warn('No se pudieron obtener cámaras:', err);
      });

    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async (cameraId?: string) => {
    setErrorMessage('');
    const targetCameraId = cameraId || selectedCameraId;

    try {
      if (scannerRef.current && isScanningRef.current) {
        await scannerRef.current.stop();
        isScanningRef.current = false;
      }

      const html5Qr = new Html5Qrcode('qr-reader-container');
      scannerRef.current = html5Qr;

      const config = {
        fps: 15,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0
      };

      const cameraConfig = targetCameraId ? { deviceId: { exact: targetCameraId } } : { facingMode: 'environment' };

      await html5Qr.start(
        cameraConfig,
        config,
        (decodedText) => {
          // Extraer DNI limpio (dígitos)
          const cleanDni = decodedText.trim().replace(/[^0-9]/g, '');
          if (cleanDni.length >= 8) {
            onScanDni(cleanDni.slice(0, 8));
          } else if (cleanDni.length > 0) {
            onScanDni(cleanDni);
          }
        },
        () => {
          // Ignorar cuadros sin QR
        }
      );

      isScanningRef.current = true;
      setScannerActive(true);
    } catch (err: unknown) {
      console.error('Error iniciando cámara:', err);
      setErrorMessage(
        'No se pudo activar la cámara. Verifica que diste permisos de cámara en tu navegador o sube una imagen con QR.'
      );
      setScannerActive(false);
      isScanningRef.current = false;
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanningRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Error al detener escáner:', e);
      }
      isScanningRef.current = false;
      setScannerActive(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5Qr = new Html5Qrcode('qr-reader-temp');
      const result = await html5Qr.scanFile(file, true);
      const cleanDni = result.trim().replace(/[^0-9]/g, '');
      if (cleanDni.length >= 8) {
        onScanDni(cleanDni.slice(0, 8));
      } else {
        onScanDni(cleanDni);
      }
      html5Qr.clear();
    } catch {
      setErrorMessage('No se encontró ningún código QR legible en la imagen seleccionada.');
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Contenedor de video de la cámara */}
      <div className="w-full max-w-sm rounded-xl overflow-hidden border-2 border-slate-300 dark:border-slate-700 bg-slate-900 shadow-inner relative min-h-[260px] flex items-center justify-center">
        <div id="qr-reader-container" className="w-full h-full" />
        <div id="qr-reader-temp" style={{ display: 'none' }} />

        {!scannerActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-300 bg-slate-900/90 z-10">
            <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-3 text-amber-400">
              <Camera className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-white mb-1">Cámara de Asistencia</p>
            <p className="text-xs text-slate-400 mb-4 max-w-[220px]">
              Activa la cámara para escanear los carnets QR institucionales al instante.
            </p>
            <button
              onClick={() => startScanner()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Camera className="w-4 h-4" />
              Activar Cámara
            </button>
          </div>
        )}
      </div>

      {/* Controles del escáner */}
      <div className="w-full max-w-sm mt-3 flex flex-col gap-2">
        {scannerActive && (
          <div className="flex gap-2">
            {cameras.length > 1 && (
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  startScanner(e.target.value);
                }}
                className="flex-1 text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Cámara ${c.id.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={stopScanner}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
            >
              Detener
            </button>
            <button
              onClick={() => startScanner()}
              title="Reiniciar cámara"
              className="p-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Opción de subir foto con QR */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <label className="text-xs text-slate-600 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <Upload className="w-3.5 h-3.5" />
            <span>O subir foto con código QR</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
