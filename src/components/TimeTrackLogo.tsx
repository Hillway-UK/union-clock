import React from 'react';
import timeTrackLogo from '@/assets/autotime-logo.jpg';

interface TimeTrackLogoProps {
  size?: 'small' | 'large';
  className?: string;
  showText?: boolean;
}

export const TimeTrackLogo: React.FC<TimeTrackLogoProps> = ({
  size = 'large',
  className = '',
  showText = true
}) => {
  const logoSizeClass = size === 'small' ? 'h-8' : 'h-12';
  const textSizeClass = size === 'small' ? 'text-lg' : 'text-2xl';

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <img
        src={timeTrackLogo}
        alt="TimeTrack Logo"
        className={`${logoSizeClass} w-auto object-contain`}
      />
      {showText && (
        <div>
          <div className={`font-heading font-extrabold ${textSizeClass} text-primary`}>
            TimeTrack
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

export default TimeTrackLogo;
