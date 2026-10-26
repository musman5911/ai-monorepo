import { useEffect, useState } from 'react';
import { api } from '../api';

type Props = { src?: string | null; alt?: string; className?: string };

export default function PhotoImage({ src = '', alt = '', className = '' }: Props) {
  const [resolved, setResolved] = useState('');
  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    if (!src) { setResolved(''); return; }
    if (!src.startsWith('/api/photos/')) { setResolved(src); return; }
    setResolved('');
    api.getPhotoObjectUrl(src).then((url) => {
      if (cancelled) URL.revokeObjectURL(url);
      else { objectUrl = url; setResolved(url); }
    }).catch(() => { if (!cancelled) setResolved(''); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  if (!resolved) return null;
  return <img src={resolved} alt={alt} className={className} />;
}
