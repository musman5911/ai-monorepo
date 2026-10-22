import React from 'react';
import { L } from '../i18n';

interface LogoProps {
  className?: string;
  size?: number;
}

export const MufMasterLogo: React.FC<LogoProps> = ({ className = '', size = 36 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
    aria-label={L('Malik Usman Farms Master Logo')}
  >
    {/* Shield Base */}
    <path
      d="M50 6L88 18V48C88 72 50 94 50 94C50 94 12 72 12 48V18L50 6Z"
      fill="#0F172A"
      stroke="#F59E0B"
      strokeWidth="3.5"
    />
    {/* Inner Crest Line */}
    <path
      d="M50 14L80 23V46C80 65 50 84 50 84C50 84 20 65 20 46V23L50 14Z"
      fill="#1E293B"
      stroke="#10B981"
      strokeWidth="1.5"
      strokeOpacity="0.6"
    />
    {/* Central Wheat & Sunburst Motif */}
    <circle cx="50" cy="38" r="14" fill="#D97706" fillOpacity="0.25" />
    <path
      d="M50 28V68M50 34L41 30M50 40L59 36M50 44L39 40M50 50L61 46M50 55L42 52M50 60L58 58"
      stroke="#FBBF24"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Furrow / Soil Base Accent */}
    <path
      d="M32 70Q50 76 68 70M36 75Q50 81 64 75"
      stroke="#10B981"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

export const AgriFarmLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
    aria-label={L('MUF Agri Farm Logo')}
  >
    {/* Hexagonal Agronomy Seal */}
    <polygon
      points="50,5 89,27 89,73 50,95 11,73 11,27"
      fill="#064E3B"
      stroke="#F59E0B"
      strokeWidth="3"
    />
    {/* Rising Sun Arc */}
    <path
      d="M26 54C26 41 37 30 50 30C63 30 74 41 74 54"
      stroke="#FCD34D"
      strokeWidth="2.5"
      strokeDasharray="4 2"
    />
    {/* Dual Wheat Heads */}
    <path
      d="M50 68V24M50 30C45 28 42 22 46 17C50 22 47 28 50 30ZM50 38C55 36 58 30 54 25C50 30 53 36 50 38ZM50 46C44 44 41 38 45 33C50 38 47 44 50 46ZM50 54C56 52 59 46 55 41C50 46 53 52 50 54Z"
      fill="#F59E0B"
      stroke="#D97706"
      strokeWidth="1.5"
    />
    {/* Furrow Lines */}
    <path
      d="M24 72L50 62L76 72M20 80L50 70L80 80"
      stroke="#34D399"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
  </svg>
);

export const DairyFarmLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
    aria-label={L('MUF Dairy Farm Logo')}
  >
    {/* Circular Farm Badge */}
    <circle cx="50" cy="50" r="44" fill="#1E3A8A" stroke="#38BDF8" strokeWidth="3.5" />
    <circle cx="50" cy="50" r="38" fill="#0F172A" />
    {/* Stylized Cattle Head & Horns */}
    <path
      d="M32 30C36 24 44 26 47 34C48 31 52 31 53 34C56 26 64 24 68 30C66 38 60 41 58 45C58 56 62 62 58 72C55 77 45 77 42 72C38 62 42 56 42 45C40 41 34 38 32 30Z"
      fill="#F8FAFC"
      stroke="#94A3B8"
      strokeWidth="1.5"
    />
    {/* Cattle Muzzle / Snout */}
    <ellipse cx="50" cy="65" rx="8" ry="6" fill="#F1F5F9" stroke="#64748B" strokeWidth="1" />
    <circle cx="47" cy="66" r="1.5" fill="#1E293B" />
    <circle cx="53" cy="66" r="1.5" fill="#1E293B" />
    {/* Milk Drop Highlight */}
    <path
      d="M50 16C50 16 43 25 43 29C43 33 46 36 50 36C54 36 57 33 57 29C57 25 50 16 50 16Z"
      fill="#38BDF8"
      stroke="#BAE6FD"
      strokeWidth="1.2"
    />
    {/* Pasture Arc */}
    <path
      d="M20 78C30 72 70 72 80 78"
      stroke="#10B981"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
  </svg>
);

export const FlockFarmLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
    aria-label={L('MUF Flock Farm Logo')}
  >
    {/* Octagonal Shield */}
    <polygon
      points="30,8 70,8 92,30 92,70 70,92 30,92 8,70 8,30"
      fill="#7F1D1D"
      stroke="#F59E0B"
      strokeWidth="3"
    />
    {/* Golden Egg Silhouette Base */}
    <ellipse cx="62" cy="58" rx="16" ry="22" fill="#D97706" fillOpacity="0.3" stroke="#F59E0B" strokeWidth="1.5" />
    {/* Proud Rooster Silhouette */}
    <path
      d="M34 32C32 26 36 21 42 22C43 18 48 18 50 22C54 19 57 22 56 26C60 27 63 32 60 36L64 38L58 43C59 50 63 56 70 56C64 62 55 64 48 60C44 65 38 72 38 78H32C33 72 38 65 40 58C36 54 32 46 34 38C32 37 32 34 34 32Z"
      fill="#FEF3C7"
      stroke="#B45309"
      strokeWidth="1.5"
    />
    {/* Comb Detail */}
    <path d="M42 20C44 16 48 16 50 20" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
    {/* Beak & Wattle */}
    <polygon points="61,35 68,37 61,40" fill="#F59E0B" />
    <path d="M59 40C62 44 58 48 55 45Z" fill="#DC2626" />
  </svg>
);
