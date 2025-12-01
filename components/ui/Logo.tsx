import React from 'react';

export const WoodpeckerLogo: React.FC<{ className?: string, style?: React.CSSProperties }> = ({ className, style }) => {
  return (
    <svg 
      viewBox="0 0 200 200" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      style={style}
    >
      {/* Light gray circle background */}
      <circle cx="100" cy="100" r="90" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="2" />
      
      {/* Tree trunk - Watercolor style abstract */}
      <path d="M70,190 Q65,100 75,10 L125,10 Q135,100 130,190 Z" fill="#D2B48C" opacity="0.8" />
      <path d="M75,190 Q70,120 78,20 L85,20 Q80,120 85,190 Z" fill="#8B4513" opacity="0.3" />
      <path d="M120,190 Q125,120 118,20 L110,20 Q115,120 110,190 Z" fill="#8B4513" opacity="0.3" />

      {/* Woodpecker */}
      <g transform="translate(100, 80) scale(0.6)">
         {/* Tail */}
         <path d="M20,120 L40,150 L10,140 Z" fill="#2d3748" />
         
         {/* Body (Dark wings) */}
         <ellipse cx="20" cy="80" rx="25" ry="50" fill="#2d3748" transform="rotate(-10)" />
         
         {/* White Chest */}
         <ellipse cx="10" cy="80" rx="15" ry="40" fill="#ffffff" transform="rotate(-10)" />
         
         {/* Head (Black & White) */}
         <circle cx="20" cy="30" r="20" fill="#2d3748" />
         <path d="M20,30 L40,30 L40,45 Z" fill="#ffffff" />
         <circle cx="25" cy="25" r="2" fill="#000" /> {/* Eye */}
         
         {/* Red Spot (Back of head) */}
         <path d="M5,20 Q0,25 5,30 Z" fill="#e53e3e" stroke="#e53e3e" strokeWidth="4" />
         
         {/* Beak */}
         <path d="M35,25 L60,30 L35,35 Z" fill="#718096" />
         
         {/* Feet clutching tree */}
         <path d="M10,120 L-10,130" stroke="#4a5568" strokeWidth="3" />
         <path d="M10,125 L-10,135" stroke="#4a5568" strokeWidth="3" />
      </g>
    </svg>
  );
};
