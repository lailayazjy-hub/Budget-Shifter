import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  themeColor?: string; // Optional override for primary color
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  children, 
  themeColor,
  ...props 
}) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  
  // Base classes for structure/typography, colors handled dynamically if themeColor is present
  const sizeClasses = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base"
  };

  let variantStyles = {};
  
  if (variant === 'primary') {
    variantStyles = {
      backgroundColor: themeColor || '#2563eb',
      color: 'white',
      border: 'none'
    };
  } else if (variant === 'secondary') {
    variantStyles = {
      backgroundColor: 'white',
      color: '#334155', // slate-700
      border: '1px solid #cbd5e1' // slate-300
    };
  } else if (variant === 'danger') {
    variantStyles = {
      backgroundColor: '#dc2626',
      color: 'white'
    };
  } else if (variant === 'ghost') {
    variantStyles = {
      backgroundColor: 'transparent',
      color: '#475569'
    };
  }

  return (
    <button 
      className={`${baseStyle} ${sizeClasses[size]} ${className} ${variant === 'primary' ? 'shadow-sm' : ''}`}
      style={variantStyles}
      {...props}
    >
      {children}
    </button>
  );
};
