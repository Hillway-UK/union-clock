import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { NotificationService } from "@/services/notifications";

interface OvertimeRequest {
  id: string;
  worker_id: string;
  clock_in: string;
  total_hours: number | null;
  ot_status: string;
  ot_requested_at: string;
  workers: {
    name: string;
  };
  jobs: {
    name: string;
  };
}

export default function OvertimeRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<OvertimeRequest | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [managerId, setManagerId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchManagerId();
      fetchRequests();
    }
  }, [user]);

  const fetchManagerId = async () => {
    if (!user?.email) return;
    
    const { data } = await supabase
      .from("managers")
      .select("id")
      .eq("email", user.email)
      .single();
    
    if (data) {
      setManagerId(data.id);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("clock_entries")
        .select(`
          id,
          worker_id,
          clock_in,
          total_hours,
          ot_status,
          ot_requested_at,
          workers(name),
          jobs(name)
        `)
        .eq("is_overtime", true)
        .order("ot_requested_at", { ascending: false });

      if (error) throw error;

      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching OT requests:", error);
      toast.error("Failed to load overtime requests");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: OvertimeRequest) => {
    if (!managerId) {
      toast.error("Manager ID not found");
      return;
    }

    try {
      const { error } = await supabase
        .from("clock_entries")
        .update({
          ot_status: "approved",
          ot_approved_by: managerId,
          ot_approved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      // Send notification
      const shiftDate = new Date(request.clock_in).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      const hours = request.total_hours?.toFixed(2) || '0.00';
      const dedupeKey = `${request.worker_id}:${new Date(request.clock_in).toISOString().split('T')[0]}:ot_approved`;

      await NotificationService.sendDualNotification(
        request.worker_id,
        "Overtime Approved ✅",
        `Your overtime request has been approved by your manager.\n\n✅ Status: Approved\n📅 Date: ${shiftDate}\n⏰ Hours: ${hours}\n\nYour OT hours will be added to your timesheet.`,
        "overtime_approved",
        dedupeKey
      );

      toast.success("Overtime approved");
      fetchRequests();
    } catch (error) {
      console.error("Error approving OT:", error);
      toast.error("Failed to approve overtime");
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !managerId) return;

    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      const { error } = await supabase
        .from("clock_entries")
        .update({
          ot_status: "rejected",
          ot_approved_by: managerId,
          ot_approved_at: new Date().toISOString(),
          ot_approved_reason: rejectReason,
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      // Send notification
      const shiftDate = new Date(selectedRequest.clock_in).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      const dedupeKey = `${selectedRequest.worker_id}:${new Date(selectedRequest.clock_in).toISOString().split('T')[0]}:ot_rejected`;

      await NotificationService.sendDualNotification(
        selectedRequest.worker_id,
        "Overtime Request Rejected ❌",
        `Your overtime request was rejected.\n\n❌ Status: Rejected\n📅 Date: ${shiftDate}\n📝 Reason: ${rejectReason}\n\nPlease contact your manager if you have questions.`,
        "overtime_rejected",
        dedupeKey
      );

      toast.success("Overtime rejected");
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectReason("");
      fetchRequests();
    } catch (error) {
      console.error("Error rejecting OT:", error);
      toast.error("Failed to reject overtime");
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { variant: "secondary" as const, label: "Pending", className: "bg-yellow-100 text-yellow-800" },
      approved: { variant: "default" as const, label: "Approved", className: "bg-green-100 text-green-800" },
      rejected: { variant: "destructive" as const, label: "Rejected", className: "bg-red-100 text-red-800" },
    };

    const statusConfig = config[status as keyof typeof config] || config.pending;
    return <Badge className={statusConfig.className}>{statusConfig.label}</Badge>;
  };

  const calculateHoursWorked = (clockIn: string, totalHours: number | null) => {
    if (totalHours !== null) return totalHours.toFixed(2);
    
    const now = new Date();
    const start = new Date(clockIn);
    const hours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.min(hours, 3).toFixed(2); // Cap at 3 hours
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Overtime Requests</h1>
          <p className="text-muted-foreground">Review and approve worker overtime</p>
        </div>
        <Button onClick={fetchRequests} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No overtime requests found</p>
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{request.workers.name}</CardTitle>
                    <CardDescription>{request.jobs.name}</CardDescription>
                  </div>
                  {getStatusBadge(request.ot_status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Clock In</p>
                    <p className="font-medium">
                      {new Date(request.clock_in).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {new Date(request.clock_in).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Hours</p>
                    <p className="font-medium">{calculateHoursWorked(request.clock_in, request.total_hours)}h</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Requested</p>
                    <p className="font-medium">
                      {new Date(request.ot_requested_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                {request.ot_status === "pending" && (
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleApprove(request)} 
                      className="flex-1"
                      variant="default"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button 
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowRejectDialog(true);
                      }} 
                      className="flex-1"
                      variant="destructive"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Overtime Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this overtime request. This will be sent to the worker.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
