import React from 'react';

export const PioneerLogo = ({ className = "h-12" }: { className?: string }) => (
  <div className={`flex items-center space-x-3 ${className}`}>
    <div className="flex space-x-1">
      <div className="w-2 h-8 bg-[#702D30]"></div>
      <div className="w-2 h-10 bg-[#702D30]"></div>
      <div className="w-2 h-12 bg-[#702D30]"></div>
      <div className="flex flex-col space-y-1">
        <div className="w-8 h-2 bg-[#702D30]"></div>
        <div className="w-6 h-2 bg-[#702D30]"></div>
      </div>
    </div>
    <div>
      <div className="font-heading font-extrabold text-2xl text-[#702D30]">PIONEER</div>
      <div className="font-body text-xs text-[#111111] tracking-widest -mt-1">CONSTRUCTION</div>
    </div>
  </div>
);