import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Upload, AlertCircle, RefreshCw, SwitchCamera } from 'lucide-react';

interface ScannerModalProps {
  onScanDni: (dni: string) => void;
  onClose?: () => void;
}

interface CameraOption {
  id: string;
  label: string;
}

const isPermissionError = (err: unknown): boolean => {
  const msg = String(err instanceof Error ? `${err.name} ${err.message}` : err || '').toLowerCase();
  return (
    msg.includes('notallowed') ||
    msg.includes('permission') ||
    msg.includes('denied') ||
    msg.includes('dismissed')
  );
};

const formatFriendlyCameraError = (err: unknown): string => {
  const msg = String(err instanceof Error ? `${err.name} ${err.message}` : err || '').toLowerCase();
  if (isPermissionError(err)) {
    return 'Permiso de cámara denegado. Toca el ícono de candado o cámara en la barra de direcciones de tu navegador, permite el acceso a la cámara y vuelve a intentarlo.';
  }
  if (msg.includes('notfound') || msg.includes('no camera') || msg.includes('requested device not found')) {
    return 'No se detectó ninguna cámara disponible en este dispositivo. Puedes subir una foto con el código QR.';
  }
  if (msg.includes('notreadable') || msg.includes('trackstart') || msg.includes('could not start video source')) {
    return 'La cámara está siendo usada por otra aplicación o pestaña. Ciérrala e intenta nuevamente.';
  }
  if (msg.includes('overconstrained')) {
    return 'La configuración de video no es compatible con esta cámara. Intenta cambiar de cámara o recargar la página.';
  }
  return 'No se pudo activar la cámara. Verifica los permisos de cámara en los ajustes de tu navegador o sube una imagen con QR.';
};

export const ScannerModal: React.FC<ScannerModalProps> = ({ onScanDni }) => {
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const onScanDniRef = useRef<(dni: string) => void>(onScanDni);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  useEffect(() => {
    onScanDniRef.current = onScanDni;
  }, [onScanDni]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      void stopScanner();
    };
  }, []);

  const releaseContainerStreams = () => {
    const container = document.getElementById('qr-reader-container');
    if (!container) return;
    const videos = container.querySelectorAll('video');
    videos.forEach((video) => {
      const stream = video.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Ignorar error al detener pista residual
          }
        });
        video.srcObject = null;
      }
    });
  };

  const stopScanner = async () => {
    const current = scannerRef.current;
    scannerRef.current = null;

    if (current) {
      try {
        if (isScanningRef.current) {
          await current.stop();
        }
      } catch (e) {
        console.warn('Error al detener escáner:', e);
      }
      try {
        current.clear();
      } catch {
        // Ignorar error si el DOM ya fue limpiado
      }
    }

    releaseContainerStreams();
    isScanningRef.current = false;
    if (isMountedRef.current) {
      setScannerActive(false);
    }
  };

  const requestCameraPermissionAndListDevices = async (): Promise<CameraOption[]> => {
    // Verificar si el permiso ya fue bloqueado explícitamente (en navegadores que soportan Permissions API para cámara)
    if (navigator.permissions?.query) {
      try {
        const permStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (permStatus.state === 'denied') {
          throw new DOMException('Camera permission denied', 'NotAllowedError');
        }
      } catch (err) {
        if (isPermissionError(err)) {
          throw err;
        }
        // Safari/Firefox lanzan TypeError al consultar 'camera' en Permissions API; continuar normalmente con getUserMedia
      }
    }

    // Solicitar acceso explícito dentro del gesto del usuario para desbloquear etiquetas y permisos en iOS/Android
    let probeStream: MediaStream | null = null;
    let listedCameras: CameraOption[] = [];
    try {
      try {
        probeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
      } catch (firstErr) {
        if (isPermissionError(firstErr)) {
          throw firstErr;
        }
        probeStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      // Enumerar mientras el stream sigue activo para asegurar etiquetas e IDs válidos en iOS Safari
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      listedCameras = allDevices
        .filter((d) => d.kind === 'videoinput' && d.deviceId)
        .map((d, idx) => ({
          id: d.deviceId,
          label: d.label || `Cámara ${idx + 1}`
        }));
    } finally {
      if (probeStream) {
        probeStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Ignorar error
          }
        });
      }
    }

    // Pequeña pausa para que Android Camera2 HAL libere el hardware antes de que html5-qrcode lo abra
    await new Promise((resolve) => setTimeout(resolve, 150));

    return listedCameras;
  };

  const findBackCamera = (devices: CameraOption[]): CameraOption | undefined => {
    const backKeywords = ['back', 'rear', 'trasera', 'environment', 'posterior', 'camera 0', 'camera2 0'];
    const matches = devices.filter((d) => {
      const lower = d.label.toLowerCase();
      return backKeywords.some((kw) => lower.includes(kw));
    });
    if (matches.length === 0) return undefined;
    // Evitar lentes ultra gran angular o macro si hay otra cámara trasera principal disponible
    const nonMacroOrUltra = matches.find((d) => {
      const lower = d.label.toLowerCase();
      return !lower.includes('macro') && !lower.includes('ultra') && !lower.includes('wide') && !lower.includes('depth');
    });
    return nonMacroOrUltra || matches[0];
  };

  const applyMobileVideoFixes = () => {
    const container = document.getElementById('qr-reader-container');
    if (!container) return;
    const video = container.querySelector('video');
    if (video) {
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('muted', 'true');
      video.setAttribute('autoplay', 'true');
      video.style.width = '100%';
      video.style.height = 'auto';
      video.style.display = 'block';
      video.style.objectFit = 'cover';
    }
  };

  const handleDecodedText = (decodedText: string) => {
    const cleanDni = decodedText.trim().replace(/[^0-9]/g, '');
    const normalized = cleanDni.length >= 8 ? cleanDni.slice(0, 8) : cleanDni;
    if (!normalized) return;

    const now = Date.now();
    if (lastScanRef.current.code === normalized && now - lastScanRef.current.time < 2500) {
      return;
    }
    lastScanRef.current = { code: normalized, time: now };
    onScanDniRef.current(normalized);
  };

  const startScanner = async (explicitCameraId?: string) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setIsStarting(true);
    setErrorMessage('');

    try {
      // Verificar contexto seguro (HTTPS) y API de cámara
      const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      if (typeof window !== 'undefined' && !window.isSecureContext && !isLocalhost) {
        setErrorMessage(
          'Los navegadores móviles solo permiten usar la cámara en sitios con HTTPS seguro. Abre la aplicación mediante HTTPS o sube una foto con QR.'
        );
        return;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage(
          'Tu navegador no permite el acceso directo a la cámara. Prueba abrir en Chrome o Safari actualizado, o sube una foto con QR.'
        );
        return;
      }

      await stopScanner();
      if (!isMountedRef.current) return;

      // Solicitar permisos explícitos y obtener cámaras disponibles con etiquetas reales
      let availableCameras = cameras;
      if (availableCameras.length === 0 || !explicitCameraId) {
        availableCameras = await requestCameraPermissionAndListDevices();
        if (!isMountedRef.current) return;
        setCameras(availableCameras);
      }

      const scanConfig = {
        fps: 12,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(140, Math.min(250, Math.floor(minEdge * 0.72)));
          return { width: size, height: size };
        },
        disableFlip: false
      };

      // Construir estrategias de cámara en orden de prioridad compatible con iOS y Android
      const candidates: Array<string | MediaTrackConstraints> = [];
      if (explicitCameraId) {
        candidates.push({ deviceId: { exact: explicitCameraId } });
        candidates.push(explicitCameraId);
        candidates.push({ facingMode: 'environment' });
      } else {
        candidates.push({ facingMode: 'environment' });
        const backCam = findBackCamera(availableCameras);
        if (backCam) {
          candidates.push({ deviceId: { exact: backCam.id } });
        }
        candidates.push({ facingMode: 'user' });
        if (availableCameras[0]) {
          candidates.push(availableCameras[0].id);
        }
      }

      let started = false;
      let lastError: unknown = null;

      for (const candidate of candidates) {
        if (!isMountedRef.current) return;

        const containerEl = document.getElementById('qr-reader-container');
        if (containerEl) {
          containerEl.innerHTML = '';
        }

        const html5Qr = new Html5Qrcode('qr-reader-container', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          useBarCodeDetectorIfSupported: true,
          verbose: false
        });
        scannerRef.current = html5Qr;

        try {
          await html5Qr.start(
            candidate,
            scanConfig,
            (decodedText) => {
              handleDecodedText(decodedText);
            },
            () => {
              // Ignorar cuadros sin QR
            }
          );

          if (!isMountedRef.current) {
            await html5Qr.stop().catch(() => {});
            html5Qr.clear();
            scannerRef.current = null;
            return;
          }

          isScanningRef.current = true;
          started = true;
          setScannerActive(true);
          applyMobileVideoFixes();

          // Intentar enfoque continuo si el lente del celular lo soporta
          try {
            await html5Qr.applyVideoConstraints({
              advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet]
            });
          } catch {
            // No todos los navegadores soportan focusMode; ignorar silenciosamente
          }

          // Sincronizar la cámara activa en el selector
          try {
            const activeSettings = html5Qr.getRunningTrackSettings();
            if (activeSettings?.deviceId) {
              setSelectedCameraId(activeSettings.deviceId);
            } else if (explicitCameraId) {
              setSelectedCameraId(explicitCameraId);
            }
          } catch {
            // Ignorar si no está disponible
          }

          break;
        } catch (err) {
          lastError = err;
          try {
            if (html5Qr.isScanning) {
              await html5Qr.stop();
            }
            html5Qr.clear();
          } catch {
            // Ignorar error de limpieza
          }
          scannerRef.current = null;
          releaseContainerStreams();

          if (isPermissionError(err)) {
            break;
          }
        }
      }

      if (!started) {
        throw lastError || new Error('No se pudo inicializar ninguna cámara');
      }
    } catch (err: unknown) {
      console.error('Error iniciando cámara:', err);
      if (isMountedRef.current) {
        setErrorMessage(formatFriendlyCameraError(err));
        setScannerActive(false);
        isScanningRef.current = false;
      }
    } finally {
      isStartingRef.current = false;
      if (isMountedRef.current) {
        setIsStarting(false);
      }
    }
  };

  const handleSwitchNextCamera = () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % cameras.length;
    const nextId = cameras[nextIndex].id;
    setSelectedCameraId(nextId);
    void startScanner(nextId);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMessage('');
    const html5Qr = new Html5Qrcode('qr-reader-temp', {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false
    });

    try {
      const result = await html5Qr.scanFile(file, false);
      handleDecodedText(result);
    } catch {
      setErrorMessage('No se encontró ningún código QR legible en la imagen seleccionada.');
    } finally {
      try {
        html5Qr.clear();
      } catch {
        // Ignorar
      }
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Contenedor de video de la cámara */}
      <div className="w-full max-w-sm rounded-xl overflow-hidden border-2 border-slate-300 dark:border-slate-700 bg-slate-900 shadow-inner relative min-h-[260px]">
        <div id="qr-reader-container" className="w-full min-h-[260px]" />
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
              type="button"
              disabled={isStarting}
              onClick={() => void startScanner()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Camera className="w-4 h-4" />
              {isStarting ? 'Activando cámara...' : 'Activar Cámara'}
            </button>
          </div>
        )}
      </div>

      {/* Controles del escáner */}
      <div className="w-full max-w-sm mt-3 flex flex-col gap-2">
        {scannerActive && (
          <div className="flex gap-2">
            {cameras.length > 1 && (
              <>
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value);
                    void startScanner(e.target.value);
                  }}
                  className="flex-1 min-w-0 text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Cámara ${c.id.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSwitchNextCamera}
                  title="Cambiar cámara (frontal / trasera)"
                  className="p-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  <SwitchCamera className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => void stopScanner()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
            >
              Detener
            </button>
            <button
              type="button"
              onClick={() => void startScanner(selectedCameraId || undefined)}
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
