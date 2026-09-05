import {LocalizedError} from '@/i18n/errors';
import {getApiErrorMessage} from '@/utils/apiError';
import { useTranslation } from 'react-i18next';
import {useEffect, useRef, useState} from 'react';
import Cropper, {type Area} from 'react-easy-crop';
import styles from './AvatarCropDialog.module.scss';

export function AvatarCropDialog({
  file,
  pending,
  error,
  onSave,
  onClose,
}: {
  file: File;
  pending: boolean;
  error?: string;
  onSave: (file: File) => void;
  onClose: () => void;
}) {
  const { t: translate } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState<string>();
  const [crop, setCrop] = useState({x: 0, y: 0});
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area>();
  const [cropError, setCropError] = useState<unknown>();
  const [processing, setProcessing] = useState(false);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    dialog.current?.showModal();
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const saveCrop = async () => {
    if (!source || !area) return;
    setCropError(undefined);
    setProcessing(true);
    try {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      // Preserve the selected crop's native detail, subject only to the source dimensions.
      canvas.width = Math.round(area.width);
      canvas.height = Math.round(area.height);
      const context = canvas.getContext('2d');
      if (!context)
        throw new LocalizedError("settings:avatar.unavailable");
      context.drawImage(
        image,
        area.x,
        area.y,
        area.width,
        area.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new LocalizedError("settings:avatar.prepareFailed")),
          'image/png',
        ),
      );
      onSave(
        new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-cropped.png`, {
          type: 'image/png',
        }),
      );
    } catch (failure) {
      setCropError(failure);
    } finally {
      setProcessing(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="crop-photo-title"
      onClose={onClose}
      onCancel={(event) => {
        if (pending || processing) event.preventDefault();
      }}
    >
      <header>
        <h2 id="crop-photo-title">{translate("settings:avatar.crop")}</h2>
        <button
          type="button"
          aria-label={translate("settings:avatar.close")}
          disabled={pending || processing}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className={styles.crop}>
        {source ? (
          <Cropper
            image={source}
            mediaProps={{alt: translate('settings:avatar.original')}}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        ) : null}
      </div>
      <label className={styles.zoom}>
        {translate("course:pdf.zoom")}<input
          aria-label={translate("settings:avatar.photoZoom")}
          type="range"
          min="1"
          max="3"
          step="0.05"
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
        />
      </label>
      {cropError || error ? <p role="alert">{cropError ? getApiErrorMessage(cropError, translate('settings:avatar.cropFailed')) : error}</p> : null}
      <footer>
        <button
          type="button"
          disabled={pending || processing}
          onClick={onClose}
        >
          {translate("common:actions.cancel")}</button>
        <button
          type="button"
          className={styles.primary}
          disabled={pending || processing || !area}
          onClick={() => void saveCrop()}
        >
          {pending || processing ? translate("common:actions.saving") : translate("settings:avatar.save")}
        </button>
      </footer>
    </dialog>
  );
}
