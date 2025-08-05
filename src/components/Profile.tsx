import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { User, Phone, Mail, MapPin, Clock, DollarSign, Calendar, ChevronLeft } from 'lucide-react';

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

export default function Profile() {
  const navigate = useNavigate();
  const [worker, setWorker] = useState<Worker | null>(null);
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
      toast({
        title: "Error",
        description: "Failed to load profile information",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white shadow-sm px-6 py-4 flex items-center">
        <button 
          onClick={() => navigate('/')}
          className="mr-4 p-1"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">My Profile</h1>
      </div>

      <div className="p-4">
        <div className="max-w-md mx-auto space-y-6">
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Worker Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Read-only Information */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Name</p>
                  <p className="text-sm text-muted-foreground">{worker.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{worker.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Hourly Rate</p>
                  <p className="text-sm text-muted-foreground">${worker.hourly_rate}/hour</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Start Date</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(worker.date_started).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Editable Information */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Contact Information</h3>
                {!editing && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="phone" className="flex items-center gap-2">
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
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address
                  </Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    disabled={!editing}
                    placeholder="Enter address"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="emergency_contact" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Emergency Contact
                  </Label>
                  <Input
                    id="emergency_contact"
                    value={formData.emergency_contact}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
                    disabled={!editing}
                    placeholder="Enter emergency contact name"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="emergency_phone" className="flex items-center gap-2">
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
                    className="mt-1"
                  />
                </div>
              </div>

              {editing && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSave} disabled={loading} className="flex-1">
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={handleCancel} disabled={loading}>
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