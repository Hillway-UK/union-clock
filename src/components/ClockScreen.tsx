import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, MapPin, Clock, LogOut, Loader2, User, HelpCircle, X, Check, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import pioneerLogo from '@/assets/pioneer-logo.png';

interface Worker {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
}

interface Job {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  geofence_radius: number;
  is_active: boolean;
}

interface ClockEntry {
  id: string;
  worker_id: string;
  job_id: string;
  clock_in: string;
  clock_out?: string;
  jobs: { name: string };
}

interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
}

interface ExpenseType {
  id: string;
  name: string;
  amount: number;
  description?: string;
}

export default function ClockScreen() {
  const navigate = useNavigate();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [currentEntry, setCurrentEntry] = useState<ClockEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Expense management state
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [submittingExpenses, setSubmittingExpenses] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [currentShiftExpenses, setCurrentShiftExpenses] = useState<any[]>([]);

  useEffect(() => {
    // Load worker data
    const workerData = localStorage.getItem('worker');
    if (!workerData) {
      navigate('/login');
      return;
    }
    setWorker(JSON.parse(workerData));
    
    // Load initial data
    loadJobs();
    checkCurrentStatus();
    requestLocation();
    fetchExpenseTypes();

    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Real-time jobs listener
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs'
        },
        (payload) => {
          console.log('Job change detected:', payload);
          // Reload jobs when any change occurs
          loadJobs();
          
          // Show toast notification for new jobs
          if (payload.eventType === 'INSERT' && payload.new.is_active) {
            toast.success(`New job available: ${payload.new.name}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('is_active', true)
      .order('name');
      
    if (error) {
      toast.error('Failed to load jobs');
      return;
    }
    
    setJobs(data || []);
  };

  const fetchExpenseTypes = async () => {
    setLoadingExpenses(true);
    const { data, error } = await supabase
      .from('expense_types')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (!error && data) {
      setExpenseTypes(data);
    }
    setLoadingExpenses(false);
  };

  const fetchCurrentShiftExpenses = async (clockEntryId?: string) => {
    const entryId = clockEntryId || currentEntry?.id;
    if (!entryId) return;
    
    try {
      const { data, error } = await supabase
        .from('additional_costs')
        .select('*, expense_types(name, amount)')
        .eq('clock_entry_id', entryId);
      
      if (!error && data) {
        setCurrentShiftExpenses(data);
      }
      return data || [];
    } catch (error) {
      console.error('Error fetching shift expenses:', error);
      return [];
    }
  };

  const checkCurrentStatus = async () => {
    const workerData = JSON.parse(localStorage.getItem('worker') || '{}');
    const { data } = await supabase
      .from('clock_entries')
      .select('*, jobs(name)')
      .eq('worker_id', workerData.id)
      .is('clock_out', null)
      .single();
    
    setCurrentEntry(data);
    
    // Fetch expenses for current shift if clocked in
    if (data) {
      fetchCurrentShiftExpenses(data.id);
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        toast.error('Location access is required to clock in');
        console.error('Location error:', error);
      },
      { 
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  };

  const capturePhoto = async (): Promise<Blob> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.style.position = 'fixed';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.zIndex = '9999';
      video.style.backgroundColor = 'black';
      document.body.appendChild(video);
      
      await video.play();
      
      // Add capture button
      const captureBtn = document.createElement('button');
      captureBtn.innerHTML = '📸 Take Photo';
      captureBtn.style.position = 'fixed';
      captureBtn.style.bottom = '20px';
      captureBtn.style.left = '50%';
      captureBtn.style.transform = 'translateX(-50%)';
      captureBtn.style.zIndex = '10000';
      captureBtn.style.padding = '16px 32px';
      captureBtn.style.backgroundColor = '#3B82F6';
      captureBtn.style.color = 'white';
      captureBtn.style.border = 'none';
      captureBtn.style.borderRadius = '24px';
      captureBtn.style.fontSize = '18px';
      captureBtn.style.fontWeight = '600';
      captureBtn.style.cursor = 'pointer';
      document.body.appendChild(captureBtn);
      
      return new Promise((resolve, reject) => {
        captureBtn.onclick = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, 640, 480);
            }
            
            canvas.toBlob((blob) => {
              stream.getTracks().forEach(track => track.stop());
              document.body.removeChild(video);
              document.body.removeChild(captureBtn);
              
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to capture photo'));
              }
            }, 'image/jpeg', 0.8);
          } catch (error) {
            stream.getTracks().forEach(track => track.stop());
            document.body.removeChild(video);
            document.body.removeChild(captureBtn);
            reject(error);
          }
        };
      });
    } catch (error) {
      toast.error('Camera access is required');
      throw error;
    }
  };

  const uploadPhoto = async (blob: Blob): Promise<string> => {
    const fileName = `${worker?.id}/${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('clock-photos')
      .upload(fileName, blob);
    
    if (error) {
      console.error('Upload error:', error);
      throw error;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('clock-photos')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleClockIn = async () => {
    if (!selectedJobId || !location || !worker) {
      toast.error('Please select a job and enable location');
      return;
    }
    
    setLoading(true);
    
    try {
      // Check geofence
      const job = jobs.find(j => j.id === selectedJobId);
      if (!job) {
        toast.error('Selected job not found');
        setLoading(false);
        return;
      }

      const distance = calculateDistance(
        location.lat,
        location.lng,
        job.latitude,
        job.longitude
      );
      
      if (distance > job.geofence_radius) {
        toast.error(`You must be within ${job.geofence_radius}m of the job site. You are ${Math.round(distance)}m away.`);
        setLoading(false);
        return;
      }
      
      // Take photo
      const photoBlob = await capturePhoto();
      const photoUrl = await uploadPhoto(photoBlob);
      
      // Create clock entry
      const { data, error } = await supabase
        .from('clock_entries')
        .insert({
          worker_id: worker.id,
          job_id: selectedJobId,
          clock_in: new Date().toISOString(),
          clock_in_photo: photoUrl,
          clock_in_lat: location.lat,
          clock_in_lng: location.lng
        })
        .select('*, jobs(name)')
        .single();
      
      if (error) {
        toast.error('Failed to clock in: ' + error.message);
        return;
      }
      
      setCurrentEntry(data);
      toast.success('Clocked in successfully!');
    } catch (error) {
      console.error('Clock in error:', error);
      toast.error('Failed to clock in');
    }
    
    setLoading(false);
  };

  const handleClockOut = async () => {
    if (!currentEntry || !worker) return;
    
    setLoading(true);
    
    try {
      // Take photo
      const photoBlob = await capturePhoto();
      const photoUrl = await uploadPhoto(photoBlob);
      
      // Calculate hours
      const clockIn = new Date(currentEntry.clock_in);
      const clockOut = new Date();
      const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      
      // Update clock entry
      const { error } = await supabase
        .from('clock_entries')
        .update({
          clock_out: clockOut.toISOString(),
          clock_out_photo: photoUrl,
          clock_out_lat: location?.lat,
          clock_out_lng: location?.lng,
          total_hours: Math.round(hours * 100) / 100
        })
        .eq('id', currentEntry.id);
      
      if (error) {
        toast.error('Failed to clock out: ' + error.message);
        return;
      }
      
      // Fetch expenses for the completed shift
      const expenses = await fetchCurrentShiftExpenses(currentEntry.id);
      
      setCurrentEntry(null);
      setCurrentShiftExpenses([]);
      
      // Enhanced success message with expenses
      if (expenses && expenses.length > 0) {
        const totalExpenseAmount = expenses.reduce((sum, exp) => sum + (exp.expense_types?.amount || 0), 0);
        toast.success(
          `Clocked out successfully! Worked ${hours.toFixed(2)} hours. ${expenses.length} expense(s) claimed (£${totalExpenseAmount.toFixed(2)})`, 
          { duration: 6000 }
        );
      } else {
        toast.success(`Clocked out successfully! Worked ${hours.toFixed(2)} hours`);
      }
    } catch (error) {
      console.error('Clock out error:', error);
      toast.error('Failed to clock out');
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    localStorage.clear();
    await supabase.auth.signOut();
    navigate('/login');
  };

  const getElapsedTime = () => {
    if (!currentEntry) return '';
    
    const start = new Date(currentEntry.clock_in);
    const now = currentTime;
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const totalSelectedExpenses = selectedExpenses.reduce((sum, id) => {
    const expense = expenseTypes.find(e => e.id === id);
    return sum + (expense?.amount || 0);
  }, 0);

  const handleExpenseSubmit = async () => {
    if (selectedExpenses.length === 0 || !currentEntry) return;
    
    setSubmittingExpenses(true);
    try {
      // Get the authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Get worker ID from the user's email
      const { data: worker } = await supabase
        .from('workers')
        .select('id')
        .eq('email', user.email)
        .single();
      
      if (!worker) throw new Error('Worker not found');
      
      // Submit each selected expense
      const promises = selectedExpenses.map(async (expenseId) => {
        const expense = expenseTypes.find(e => e.id === expenseId);
        if (!expense) return;
        
        return supabase
          .from('additional_costs')
          .insert({
            clock_entry_id: currentEntry.id,
            worker_id: worker.id,
            description: expense.name,
            amount: expense.amount,
            expense_type_id: expense.id,
            cost_type: 'expense_claim',
            date: new Date().toISOString().split('T')[0]
          });
      });
      
      const results = await Promise.all(promises);
      const errors = results.filter(r => r?.error);
      
      if (errors.length > 0) {
        throw new Error(errors[0].error.message);
      }
      
      toast.success(`${selectedExpenses.length} expense(s) added successfully!`, {
        duration: 4000,
      });
      
      // Clear selection and refresh claimed expenses
      setSelectedExpenses([]);
      fetchCurrentShiftExpenses();
    } catch (error) {
      console.error('Error submitting expenses:', error);
      toast.error(error.message || 'Failed to add expenses');
    } finally {
      setSubmittingExpenses(false);
    }
  };

  if (!worker) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card shadow-sm px-4 py-3 flex justify-between items-center border-b">
        <div className="flex items-center gap-3">
          <img 
            src={pioneerLogo} 
            alt="Pioneer Construction" 
            className="h-8 w-12 object-contain"
          />
          <div>
            <h1 className="text-lg font-bold text-foreground">{worker.name}</h1>
            <p className="text-xs text-muted-foreground">Time Keeper</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
            <User className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate('/help')}>
            <HelpCircle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Current Time */}
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-mono font-bold text-foreground">
              {currentTime.toLocaleTimeString()}
            </div>
            <div className="text-sm text-muted-foreground">
              {currentTime.toLocaleDateString()}
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardContent className={`p-6 text-center ${
            currentEntry ? 'bg-green-50 border-green-200' : 'bg-gray-50'
          }`}>
            {currentEntry ? (
              <>
                <Clock className="w-16 h-16 mx-auto mb-4 text-green-600" />
                <h2 className="text-2xl font-bold text-green-800 mb-2">CLOCKED IN</h2>
                <p className="text-lg font-medium text-foreground">{currentEntry.jobs.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Since {new Date(currentEntry.clock_in).toLocaleTimeString()}
                </p>
                <p className="text-lg font-bold text-green-600 mt-2">
                  {getElapsedTime()}
                </p>
                {currentShiftExpenses.length > 0 && (
                  <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700 font-medium">
                      {currentShiftExpenses.length} expense(s) claimed this shift
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-2xl font-bold text-muted-foreground">CLOCKED OUT</h2>
                <p className="text-sm text-muted-foreground mt-2">Ready to start work</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Location Status */}
        {location && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-center text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mr-2 text-green-600" />
                GPS Accuracy: {Math.round(location.accuracy)}m
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-4">
          {currentEntry ? (
            <Button
              onClick={handleClockOut}
              disabled={loading}
              className="w-full h-14 text-lg font-semibold bg-red-600 hover:bg-red-700"
              size="lg"
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              <Camera className="mr-2 h-5 w-5" />
              {loading ? 'Processing...' : 'CLOCK OUT'}
            </Button>
          ) : (
            <>
              <Card>
                <CardContent className="p-4">
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Select Job Site
                  </label>
                  <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Choose a job site" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name} ({job.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              
              <Button
                onClick={handleClockIn}
                disabled={loading || !selectedJobId || !location}
                className="w-full h-14 text-lg font-semibold"
                size="lg"
              >
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                <Camera className="mr-2 h-5 w-5" />
                {loading ? 'Processing...' : 'CLOCK IN'}
              </Button>
            </>
          )}
        </div>

        {/* Inline Expense Management Section */}
        {currentEntry && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Wallet className="w-5 h-5 mr-2 text-blue-600" />
                Claim Expenses
              </h3>
              
              {loadingExpenses ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : expenseTypes.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">Select expenses to add to this shift:</p>
                  <div className="space-y-2">
                    {expenseTypes.map((expense) => (
                      <label key={expense.id} className="flex items-center p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="mr-3 w-5 h-5 text-blue-600"
                          checked={selectedExpenses.includes(expense.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedExpenses([...selectedExpenses, expense.id]);
                            } else {
                              setSelectedExpenses(selectedExpenses.filter(id => id !== expense.id));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{expense.name}</div>
                          <div className="text-sm text-blue-600 font-semibold">£{expense.amount.toFixed(2)}</div>
                          {expense.description && (
                            <div className="text-xs text-muted-foreground mt-1">{expense.description}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  
                  {selectedExpenses.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Selected:</span>
                        <span className="text-lg font-bold text-blue-600">
                          £{selectedExpenses.reduce((sum, id) => {
                            const expense = expenseTypes.find(e => e.id === id);
                            return sum + (expense?.amount || 0);
                          }, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <Button
                    onClick={handleExpenseSubmit}
                    disabled={selectedExpenses.length === 0 || submittingExpenses}
                    className={`w-full mt-4 py-3 font-medium transition-colors ${
                      selectedExpenses.length > 0 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {submittingExpenses ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding Expenses...
                      </span>
                    ) : (
                      `Add ${selectedExpenses.length} Expense${selectedExpenses.length !== 1 ? 's' : ''} to Shift`
                    )}
                  </Button>
                  
                  {currentShiftExpenses.length > 0 && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-800 mb-2">Already Claimed:</p>
                      {currentShiftExpenses.map((expense, idx) => (
                        <div key={idx} className="text-sm text-green-700">
                          • {expense.description}: £{expense.amount.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No expense types available</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
}