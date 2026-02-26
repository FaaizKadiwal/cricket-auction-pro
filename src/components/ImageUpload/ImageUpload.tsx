import { useRef, useState, useId } from 'react';
import { MAX_IMAGE_SIZE } from '@/constants/auction';
import { resizeImage } from '@/utils/image';
import styles from './ImageUpload.module.css';

interface ImageUploadProps {
  value: string | null;
  onChange: (base64: string | null) => void;
  label?: string;
  size?: number;       // px width/height of the zone
  circle?: boolean;
  maxDim?: number;     // resize target dimension
  placeholder?: string;
}

export function ImageUpload({
  value, onChange, label, size = 80, circle = false, maxDim = 300, placeholder = '📷',
}: ImageUploadProps) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const inputId   = useId();

  async function processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are accepted.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('Image must be under 10 MB.');
      return;
    }
    setError(null);
    try {
      const b64 = await resizeImage(file, maxDim);
      onChange(b64);
    } catch {
      setError('Failed to process image.');
    }
  }

  function handleFiles(files: FileList | null) {
    if (files && files[0]) processFile(files[0]);
  }

  return (
    <div className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}

      <div
        className={`${styles.zone} ${circle ? styles.circle : ''} ${dragging ? styles.zoneDragging : ''}`}
        style={{ width: size, height: size }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        aria-label={label ?? 'Upload image'}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        {value ? (
          <>
            <img src={value} alt="preview" className={styles.previewImg} />
            <button
              className={styles.removeBtn}
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              aria-label="Remove image"
            >✕</button>
          </>
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>{placeholder}</span>
            <span className={styles.placeholderText}>Click or drop</span>
          </div>
        )}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <span style={{ fontSize: 10, color: 'var(--danger)', textAlign: 'center' }}>{error}</span>
      )}
    </div>
  );
}
