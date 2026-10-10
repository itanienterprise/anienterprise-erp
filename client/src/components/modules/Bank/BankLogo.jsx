import React, { useState } from 'react';
import { BuildingIcon } from '../../Icons';

// Comprehensive map of normalized keywords to official bank logos
const BANK_LOGOS = {
  agrani: '/bank-logos/agrani.svg',
  'al-arafah': '/bank-logos/al-arafah.png',
  arafah: '/bank-logos/al-arafah.png',
  'bank asia': '/bank-logos/bank-asia.svg',
  'basic bank': '/bank-logos/basic-bank.svg',
  brac: '/bank-logos/brac.svg',
  'city bank': '/bank-logos/city-bank.svg',
  'dhaka bank': '/bank-logos/dhaka-bank.svg',
  'dutch-bangla': '/bank-logos/dutch-bangla.svg',
  'dutch bangla': '/bank-logos/dutch-bangla.svg',
  dbbl: '/bank-logos/dutch-bangla.svg',
  ebl: '/bank-logos/ebl.svg',
  'eastern bank': '/bank-logos/ebl.svg',
  'exim bank': '/bank-logos/exim-bank.svg',
  fsibl: '/bank-logos/fsibl.svg',
  'first security': '/bank-logos/fsibl.svg',
  ific: '/bank-logos/ific.svg',
  'islami bank': '/bank-logos/islami-bank.svg',
  ibbl: '/bank-logos/islami-bank.svg',
  jamuna: '/bank-logos/jamuna.svg',
  janata: '/bank-logos/janata.svg',
  'krishi bank': '/bank-logos/krishi-bank.png',
  mercantile: '/bank-logos/mercantile.png',
  mtb: '/bank-logos/mtb.svg',
  'mutual trust': '/bank-logos/mtb.svg',
  'national bank': '/bank-logos/national-bank.png',
  nbl: '/bank-logos/national-bank.png',
  'national credit': '/bank-logos/ncc-bank.png',
  ncc: '/bank-logos/ncc-bank.png',
  premier: '/bank-logos/premier-bank.svg',
  'prime bank': '/bank-logos/prime-bank.svg',
  pubali: '/bank-logos/pubali.svg',
  rupali: '/bank-logos/rupali.svg',
  sbac: '/bank-logos/sbac.svg',
  'south bangla': '/bank-logos/sbac.svg',
  shahjalal: '/bank-logos/shahjalal.png',
  shajalal: '/bank-logos/shahjalal.png',
  sibl: '/bank-logos/sibl.svg',
  'social islami': '/bank-logos/sibl.svg',
  sonali: '/bank-logos/sonali.svg',
  southeast: '/bank-logos/southeast.svg',
  standard: '/bank-logos/standard-bank.png',
  trust: '/bank-logos/trust-bank.svg',
  ucb: '/bank-logos/ucb.svg',
  'united commercial': '/bank-logos/ucb.svg',
  uttara: '/bank-logos/uttara.svg'
};

/**
 * Returns the matching logo URL for a given bank name, or null if not found.
 */
const getBankLogoUrl = (bankName) => {
  if (!bankName) return null;
  const lower = String(bankName).toLowerCase().trim();
  for (const [key, path] of Object.entries(BANK_LOGOS)) {
    if (lower.includes(key)) {
      return path;
    }
  }
  return null;
};

/**
 * BankLogo Component
 * Renders original bank brand logo with fallback to stylish building icon
 */
const BankLogo = ({
  bankName,
  className = "w-14 h-14",
  imgClassName = "w-full h-full object-contain p-1",
  fallbackClassName = "w-full h-full flex items-center justify-center bg-blue-50 text-blue-600 rounded-2xl border border-blue-100",
  showFallbackBuilding = true
}) => {
  const [hasError, setHasError] = useState(false);
  const logoUrl = getBankLogoUrl(bankName);

  if (!logoUrl || hasError) {
    return (
      <div className={`shrink-0 overflow-hidden ${className} ${fallbackClassName}`}>
        {showFallbackBuilding ? (
          <BuildingIcon className="w-6 h-6 text-blue-600" />
        ) : (
          <span className="font-bold text-sm uppercase text-blue-700">
            {(bankName || 'B').slice(0, 2)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl bg-white border border-gray-200/80 shadow-2xs flex items-center justify-center ${className}`}
      title={bankName}
    >
      <img
        src={logoUrl}
        alt={bankName || "Bank Logo"}
        className={imgClassName}
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
};

/**
 * BankWatermark Component
 * Renders a subtle, large watermark logo in the center of cards
 */
export const BankWatermark = ({
  bankName,
  className = "w-52 h-52 sm:w-60 sm:h-60",
  opacity = 0.09,
  style = {}
}) => {
  const [hasError, setHasError] = useState(false);
  const logoUrl = getBankLogoUrl(bankName);
  if (!logoUrl || hasError) return null;

  // Resolve numeric opacity to ensure bulletproof rendering regardless of CSS purging
  let resolvedOpacity = 0.09;
  if (typeof opacity === 'number') {
    resolvedOpacity = opacity;
  } else if (typeof opacity === 'string') {
    const match = opacity.match(/\[([0-9.]+)\]/);
    if (match) {
      resolvedOpacity = parseFloat(match[1]);
    } else if (opacity.includes('opacity-')) {
      const val = parseInt(opacity.replace('opacity-', ''), 10);
      if (!isNaN(val)) resolvedOpacity = val / 100;
    }
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className={`${className} flex items-center justify-center`}>
        <img
          src={logoUrl}
          alt=""
          className="w-full h-full object-contain transition-transform duration-700 ease-out group-hover:scale-105"
          style={{
            opacity: resolvedOpacity,
            pointerEvents: 'none',
            userSelect: 'none',
            ...style
          }}
          loading="lazy"
          onError={() => setHasError(true)}
        />
      </div>
    </div>
  );
};

export default BankLogo;
