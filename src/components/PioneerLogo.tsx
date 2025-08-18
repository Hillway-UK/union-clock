import { Construction } from 'lucide-react';

export const PioneerLogo = () => (
  <div className="flex items-center space-x-2">
    <div className="w-10 h-10 bg-[#FF6B35] rounded-lg flex items-center justify-center shadow-lg">
      <Construction className="w-6 h-6 text-white" />
    </div>
    <div className="flex flex-col">
      <span className="text-[#1E3A5F] font-bold text-sm leading-tight">PIONEER</span>
      <span className="text-[#FF6B35] text-xs leading-tight">AUTO TIMESHEETS</span>
    </div>
  </div>
);

export const PioneerLogoBrand = () => (
  <div className="w-48 h-24 bg-white rounded-lg shadow-md flex items-center justify-center">
    <span className="text-[#1E3A5F] font-bold text-xl">PIONEER</span>
    <span className="text-[#FF6B35] font-bold text-xl ml-2">CONSTRUCTION</span>
  </div>
);