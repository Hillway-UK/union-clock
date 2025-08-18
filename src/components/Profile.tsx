import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { User, Phone, Mail, MapPin, Clock, DollarSign, Calendar, ChevronLeft, Camera, Award, Briefcase } from 'lucide-react';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  hourly_rate: number;
  date_started: string;
  is_active: boolean;
  created_at: string;
}

interface WorkerStats {
  totalHours: number;
  jobsWorked: number;
  daysActive: number;
}

export default function Profile() {
  const navigate = useNavigate();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    address: '',
    emergency_contact: '',
    emergency_phone: ''
  });

  useEffect(() => {
    loadWorkerProfile();
    loadWorkerStats();
  }, []);

  const loadWorkerProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('email', user.email)
        .single();

      if (error) throw error;

      setWorker(data);
      setFormData({
        phone: data.phone || '',
        address: data.address || '',
        emergency_contact: data.emergency_contact || '',
        emergency_phone: data.emergency_phone || ''
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Error loading profile', {
        description: 'Failed to load profile information',
        className: 'bg-error text-error-foreground border-error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWorkerStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get worker ID
      const { data: workerData } = await supabase
        .from('workers')
        .select('id, date_started')
        .eq('email', user.email)
        .single();

      if (!workerData) return;

      // Calculate this week's hours
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const { data: weeklyEntries } = await supabase
        .from('clock_entries')
        .select('total_hours')
        .eq('worker_id', workerData.id)
        .gte('clock_in', startOfWeek.toISOString())
        .not('total_hours', 'is', null);

      const totalHours = weeklyEntries?.reduce((sum, entry) => sum + (entry.total_hours || 0), 0) || 0;

      // Count unique jobs worked on
      const { data: jobEntries } = await supabase
        .from('clock_entries')
        .select('job_id')
        .eq('worker_id', workerData.id);

      const uniqueJobs = new Set(jobEntries?.map(entry => entry.job_id) || []);
      const jobsWorked = uniqueJobs.size;

      // Calculate days since start
      const startDate = new Date(workerData.date_started);
      const today = new Date();
      const daysActive = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      setStats({
        totalHours,
        jobsWorked,
        daysActive
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSave = async () => {
    if (!worker) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('workers')
        .update({
          phone: formData.phone,
          address: formData.address,
          emergency_contact: formData.emergency_contact,
          emergency_phone: formData.emergency_phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', worker.id);

      if (error) throw error;

      setWorker(prev => prev ? { ...prev, ...formData } : null);
      setEditing(false);
      toast.success('Profile Updated', {
        description: 'Your information has been saved successfully',
        className: 'bg-success text-success-foreground border-success'
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Update Failed', {
        description: 'Failed to update profile information',
        className: 'bg-error text-error-foreground border-error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (worker) {
      setFormData({
        phone: worker.phone || '',
        address: worker.address || '',
        emergency_contact: worker.emergency_contact || '',
        emergency_phone: worker.emergency_phone || ''
      });
    }
    setEditing(false);
  };

  if (loading && !worker) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner message="Loading your profile..." />
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Worker profile not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm shadow-lg px-6 py-4 flex items-center border-b border-border/20">
        <button 
          onClick={() => navigate('/clock')}
          className="mr-4 p-2 hover:bg-accent rounded-lg transition-colors duration-200 active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">My Profile</h1>
      </div>

      <div className="p-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* Worker Avatar & Stats */}
          <Card className="shadow-xl backdrop-blur-sm bg-card/95 animate-slide-in-up">
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <div className="relative mx-auto w-24 h-24 mb-4">
                  <div className="w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center shadow-lg">
                    <User className="w-12 h-12 text-primary-foreground" />
                  </div>
                  <button className="absolute -bottom-1 -right-1 p-2 bg-accent rounded-full shadow-md border-2 border-card hover:bg-accent/80 transition-colors">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="text-2xl font-bold">{worker.name}</h2>
                <p className="text-muted-foreground">{worker.email}</p>
              </div>

              {/* Stats Grid */}
              {stats && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-success/10 rounded-lg border border-success/20">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-success" />
                    <p className="text-2xl font-bold text-success">{stats.totalHours.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Hours This Week</p>
                  </div>
                  <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <Briefcase className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold text-primary">{stats.jobsWorked}</p>
                    <p className="text-xs text-muted-foreground">Jobs Worked</p>
                  </div>
                  <div className="text-center p-3 bg-warning/10 rounded-lg border border-warning/20">
                    <Award className="w-6 h-6 mx-auto mb-2 text-warning" />
                    <p className="text-2xl font-bold text-warning">{stats.daysActive}</p>
                    <p className="text-xs text-muted-foreground">Days Active</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile Details */}
          <Card className="shadow-xl backdrop-blur-sm bg-card/95 animate-slide-in-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <User className="h-6 w-6 text-primary" />
              Worker Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Read-only Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20">
                <div className="p-3 bg-primary/20 rounded-full">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hourly Rate</p>
                  <p className="text-xl font-bold text-primary">${worker.hourly_rate}/hour</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-success/5 to-success/10 rounded-xl border border-success/20">
                <div className="p-3 bg-success/20 rounded-full">
                  <Calendar className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                  <p className="text-lg font-semibold text-success">
                    {new Date(worker.date_started).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Editable Information */}
            <div className="space-y-6 pt-6 border-t border-border/50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Contact Information</h3>
                {!editing && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setEditing(true)}
                    className="hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
                  >
                    Edit
                  </Button>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    disabled={!editing}
                    placeholder="Enter phone number"
                    className={`h-12 transition-all duration-200 ${editing ? 'border-2 focus:border-primary' : 'bg-muted/50'}`}
                  />
                </div>

                <div>
                  <Label htmlFor="address" className="flex items-center gap-2 text-sm font-medium mb-2">
                    <MapPin className="h-4 w-4" />
                    Address
                  </Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    disabled={!editing}
                    placeholder="Enter address"
                    className={`h-12 transition-all duration-200 ${editing ? 'border-2 focus:border-primary' : 'bg-muted/50'}`}
                  />
                </div>

                <div>
                  <Label htmlFor="emergency_contact" className="flex items-center gap-2 text-sm font-medium mb-2">
                    <User className="h-4 w-4" />
                    Emergency Contact
                  </Label>
                  <Input
                    id="emergency_contact"
                    value={formData.emergency_contact}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
                    disabled={!editing}
                    placeholder="Enter emergency contact name"
                    className={`h-12 transition-all duration-200 ${editing ? 'border-2 focus:border-primary' : 'bg-muted/50'}`}
                  />
                </div>

                <div>
                  <Label htmlFor="emergency_phone" className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Phone className="h-4 w-4" />
                    Emergency Phone
                  </Label>
                  <Input
                    id="emergency_phone"
                    type="tel"
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_phone: e.target.value }))}
                    disabled={!editing}
                    placeholder="Enter emergency contact phone"
                    className={`h-12 transition-all duration-200 ${editing ? 'border-2 focus:border-primary' : 'bg-muted/50'}`}
                  />
                </div>
              </div>

              {editing && (
                <div className="flex gap-3 pt-6">
                  <Button 
                    onClick={handleSave} 
                    disabled={loading} 
                    className="flex-1 h-12 bg-gradient-success hover:shadow-lg transition-all duration-200 active:scale-95"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCancel} 
                    disabled={loading}
                    className="h-12 hover:bg-secondary transition-colors duration-200"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}