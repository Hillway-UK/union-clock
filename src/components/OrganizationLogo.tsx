import React, { useState, useEffect } from 'react';
import autoTimeLogo from '@/assets/autotime-logo.jpg';

interface OrganizationLogoProps {
  organizationLogoUrl?: string | null;
  size?: 'small' | 'large';
  className?: string;
  showText?: boolean;
}

export const OrganizationLogo: React.FC<OrganizationLogoProps> = ({ 
  organizationLogoUrl,
  size = 'large', 
  className = '',
  showText = true 
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const logoSrc = (imageError || !organizationLogoUrl) ? autoTimeLogo : organizationLogoUrl;
  const logoSizeClass = size === 'small' ? 'h-8' : 'h-12';
  const textSizeClass = size === 'small' ? 'text-lg' : 'text-2xl';

  // Reset error state when organizationLogoUrl changes
  useEffect(() => {
    if (organizationLogoUrl) {
      setImageError(false);
      setImageLoaded(false);
      console.log('📸 Organization logo URL:', organizationLogoUrl);
    } else {
      console.warn('⚠️ No organization logo URL provided');
    }
  }, [organizationLogoUrl]);
  
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <img 
        src={logoSrc} 
        alt="Organization Logo" 
        className={`${logoSizeClass} w-auto object-contain transition-opacity ${!imageLoaded && organizationLogoUrl ? 'opacity-0' : 'opacity-100'}`}
        onError={() => {
          console.error('❌ Failed to load organization logo:', organizationLogoUrl);
          setImageError(true);
          setImageLoaded(true);
        }}
        onLoad={() => {
          console.log('✅ Organization logo loaded successfully');
          setImageLoaded(true);
        }}
      />
      {showText && (
        <div>
          <div className={`font-heading font-extrabold ${textSizeClass} text-primary`}>
            AutoTime
          </div>
          {size === 'large' && (
            <div className="font-body text-xs text-muted-foreground tracking-widest -mt-1">
              WORKER TIME MANAGEMENT
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrganizationLogo;
