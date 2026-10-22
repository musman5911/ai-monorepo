// muf-login-lang — small language switch shown on the sign-in screens, so a
// worker can pick Urdu / Roman Urdu / English before logging in.
// TWIN FILES (byte-identical): agri_farm/frontend/src/, dairy_farm/client/src/, flock_farm/client/src/
import { Languages } from 'lucide-react';
import { L } from '../../i18n';
import { mufL } from '../data/muf-urdu';

interface Props {
  lang: 'en' | 'ur' | 'roman';
  onToggle: () => void;
}

export default function MufLoginLang({ lang, onToggle }: Props) {
  const next = lang === 'en' ? mufL('ur', 'Urdu') : lang === 'ur' ? 'Roman' : 'English';
  const title = lang === 'en' ? L('Switch to Urdu') : lang === 'ur' ? L('Switch to Roman Urdu') : L('Switch to English');
  return (
    <button type="button" className="muf-login-lang" onClick={onToggle} title={title} aria-label={L('Switch language')}>
      <Languages size={15} aria-hidden="true" />
      <span>{next}</span>
    </button>
  );
}
