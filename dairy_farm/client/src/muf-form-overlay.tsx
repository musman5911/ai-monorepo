// muf shared form popup — entry forms use the same popup shell as detail / confirm / admin.
import DetailModal from './muf-modal';

interface FormOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  size?: 'small' | 'big';
}

export default function FormOverlay({ open, onClose, title, subtitle, icon, children, size = 'big' }: FormOverlayProps) {
  return (
    <DetailModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      size={size}
    >
      {children}
    </DetailModal>
  );
}
