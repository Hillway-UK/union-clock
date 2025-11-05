import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, AlertCircle } from "lucide-react";

interface OvertimeConfirmationDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  shiftEndTime?: string;
}

export default function OvertimeConfirmationDialog({ 
  open, 
  onConfirm, 
  onCancel,
  shiftEndTime 
}: OvertimeConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            Overtime Clock-In Request
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p className="text-sm">
              You're clocking in after your shift ended{shiftEndTime ? ` at ${shiftEndTime}` : ''}.
            </p>
            
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-orange-900">
                ⏰ Overtime Policy
              </p>
              <ul className="text-xs text-orange-800 space-y-1 list-disc pl-4">
                <li>Requires manager approval</li>
                <li>Maximum 3 hours per session</li>
                <li>Auto clock-out if you leave the site</li>
                <li>Auto clock-out after 3 hours</li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Need more than 3 hours? File a Time Amendment after auto clock-out.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} className="bg-orange-600 hover:bg-orange-700">
            Yes, Request Overtime
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
