import React, { useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Download, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface TimesheetExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (
    dateRange: { start: Date; end: Date; label: string },
    format: 'excel' | 'pdf',
    rangeType: 'weekly' | 'monthly' | 'custom'
  ) => Promise<void>;
  exporting: boolean;
}

export default function TimesheetExportDialog({
  open,
  onClose,
  onExport,
  exporting
}: TimesheetExportDialogProps) {
  const [rangeType, setRangeType] = useState<'weekly' | 'monthly' | 'custom'>('weekly');
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customStart, setCustomStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [customEnd, setCustomEnd] = useState<Date>(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');

  const getDateRange = () => {
    switch (rangeType) {
      case 'weekly':
        return {
          start: startOfWeek(selectedWeek, { weekStartsOn: 1 }),
          end: endOfWeek(selectedWeek, { weekStartsOn: 1 }),
          label: `Week of ${format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM dd')} - ${format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM dd, yyyy')}`
        };
      case 'monthly':
        return {
          start: startOfMonth(selectedMonth),
          end: endOfMonth(selectedMonth),
          label: format(selectedMonth, 'MMMM yyyy')
        };
      case 'custom':
        return {
          start: customStart,
          end: customEnd,
          label: `${format(customStart, 'MMM dd, yyyy')} - ${format(customEnd, 'MMM dd, yyyy')}`
        };
    }
  };

  const handleExport = async () => {
    const dateRange = getDateRange();
    await onExport(dateRange, exportFormat, rangeType);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Timesheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Range Type Selection */}
          <div className="space-y-3">
            <Label>Select Range Type</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={rangeType === 'weekly' ? 'default' : 'outline'}
                onClick={() => setRangeType('weekly')}
                className="flex flex-col items-center gap-1 h-auto py-3"
              >
                <span className="text-xl">🗓️</span>
                <span className="text-xs">Weekly</span>
              </Button>
              <Button
                type="button"
                variant={rangeType === 'monthly' ? 'default' : 'outline'}
                onClick={() => setRangeType('monthly')}
                className="flex flex-col items-center gap-1 h-auto py-3"
              >
                <span className="text-xl">📅</span>
                <span className="text-xs">Monthly</span>
              </Button>
              <Button
                type="button"
                variant={rangeType === 'custom' ? 'default' : 'outline'}
                onClick={() => setRangeType('custom')}
                className="flex flex-col items-center gap-1 h-auto py-3"
              >
                <span className="text-xl">📆</span>
                <span className="text-xs">Custom</span>
              </Button>
            </div>
          </div>

          {/* Date Selection */}
          <div className="space-y-3">
            {rangeType === 'weekly' && (
              <div>
                <Label>Select Week</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-2",
                        !selectedWeek && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM dd')} - {format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM dd, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedWeek}
                      onSelect={(date) => date && setSelectedWeek(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {rangeType === 'monthly' && (
              <div>
                <Label>Select Month</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-2",
                        !selectedMonth && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedMonth, 'MMMM yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedMonth}
                      onSelect={(date) => date && setSelectedMonth(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {rangeType === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-2",
                          !customStart && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(customStart, 'MMM dd, yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customStart}
                        onSelect={(date) => date && setCustomStart(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-2",
                          !customEnd && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(customEnd, 'MMM dd, yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customEnd}
                        onSelect={(date) => date && setCustomEnd(date)}
                        disabled={(date) => date < customStart}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          {/* Selected Range Preview */}
          <div className="p-3 bg-muted rounded-md">
            <Label className="text-xs text-muted-foreground">Selected Range:</Label>
            <p className="font-medium mt-1">{getDateRange().label}</p>
          </div>

          {/* Export Format */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={exportFormat === 'excel' ? 'default' : 'outline'}
                onClick={() => setExportFormat('excel')}
              >
                📊 Excel
              </Button>
              <Button
                type="button"
                variant={exportFormat === 'pdf' ? 'default' : 'outline'}
                onClick={() => setExportFormat('pdf')}
              >
                📄 PDF
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={exporting}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Generate Export
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
