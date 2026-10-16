// muf shared modal portal — renders popup shells into a body-level root so
// they are never clipped by app containers. Identical in all three farm apps.
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: ReactNode;
}

function getModalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let root = document.getElementById('ff-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'ff-modal-root';
    document.body.appendChild(root);
  }
  return root;
}

export default function ModalPortal({ children }: ModalPortalProps) {
  const [container] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : document.createElement('div')
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!container) return;
    const root = getModalRoot();
    if (!root) return;
    root.appendChild(container);
    setMounted(true);

    return () => {
      root.removeChild(container);
      if (root.childElementCount === 0) {
        root.remove();
      }
    };
  }, [container]);

  if (!container || !mounted) return null;
  return createPortal(children, container);
}
