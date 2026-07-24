import React from 'react';

interface OrbisLogoProps {
  className?: string;
  size?: number;
  withBg?: boolean;
}

/**
 * OrbisLogo - Desenho vetorial de alta fidelidade do logo oficial Orbis.
 * Representa um círculo azul-turquesa/teal com 4 asas/penas estilizadas brancas fuzionadas à esquerda.
 */
export default function OrbisLogo({ className = "w-10 h-10", size, withBg = true }: OrbisLogoProps) {
  const inlineStyle = size ? { width: size, height: size } : undefined;
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`shrink-0 ${className}`} 
      style={inlineStyle}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {withBg && (
        <rect width="100" height="100" rx="24" fill="#0d687b" />
      )}
      {/* Desenho do logo oficial Orbis redimensionado e centralizado */}
      <g transform="translate(8, 8) scale(0.84)">
        {/* Anel Externo Direito */}
        <path 
          d="M 50 2 C 76.5 2 98 23.5 98 50 C 98 76.5 76.5 98 50 98 C 30.5 98 13.8 86.4 6.5 69.8 L 15.6 65.5 C 21.5 78.5 34.7 87.5 50 87.5 C 70.7 87.5 87.5 70.7 87.5 50 C 87.5 29.3 70.7 12.5 50 12.5 C 44 12.5 38.3 13.9 33.2 16.4 L 33.2 5.1 C 38.4 3.1 44.1 2 50 2 Z" 
          fill="white" 
        />
        {/* Asa 1 (Pena Superior) */}
        <path 
          d="M 33 5 L 15 5 C 15 5 19.5 12 25.5 19 C 31.5 26 36 30 40 33 C 33 30 25.5 27 18 24.5 L 14 23 C 18 19 23.5 14 30.5 9.5 L 33 5 Z" 
          fill="white" 
        />
        {/* Asa 2 (Pena Intermediária Superior) */}
        <path 
          d="M 33 22 L 18 24 C 18 24 23 31.5 29 37.5 C 35 43.5 39 46.5 43 49 C 36 46 29 43.5 21.5 41 L 18 40 C 21.5 36.5 26 31.5 31.5 26.5 L 33 22 Z" 
          fill="white" 
        />
        {/* Asa 3 (Pena Intermediária Inferior) */}
        <path 
          d="M 33 39 L 21 41.5 C 21 41.5 25.5 48.5 31 53.5 C 36.5 58.5 40.5 61 44.5 63 C 38 60.5 31.5 58.5 25 56.5 L 21.5 55.5 C 24.5 52.5 28.5 48 32.5 43 L 33 39 Z" 
          fill="white" 
        />
        {/* Asa 4 (Pena Inferior) */}
        <path 
          d="M 33 56 L 24.5 58.5 C 24.5 58.5 28.5 65 33.5 69.5 C 38.5 74 42 76 45.5 77.5 C 39.5 75.5 33.5 74 27.5 72.5 L 24.5 71.5 C 27 68.5 30.5 64.5 33 60 L 33 56 Z" 
          fill="white" 
        />
      </g>
    </svg>
  );
}
