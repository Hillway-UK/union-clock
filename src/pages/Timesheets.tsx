import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, differenceInMinutes, parseISO, addDays } from 'date-fns';
import { Calendar, Clock, Edit2, Plus, ChevronLeft, ChevronRight, AlertCircle, DollarSign, ArrowLeft, Construction, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Timesheets() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showAmendmentDialog, setShowAmendmentDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [amendmentReason, setAmendmentReason] = useState('');
  const [newClockIn, setNewClockIn] = useState('');
  const [newClockOut, setNewClockOut] = useState('');
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [existingAmendments, setExistingAmendments] = useState<any[]>([]);
  const [savingExpenses, setSavingExpenses] = useState(false);
  const [workerHourlyRate, setWorkerHourlyRate] = useState<number>(0);
  const [organizationName, setOrganizationName] = useState<string>('');
  
  // Manual entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    job_id: '',
    clock_in_time: '09:00',
    clock_out_time: '17:00',
    notes: ''
  });
  const [jobs, setJobs] = useState<any[]>([]);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [worker, setWorker] = useState<any>(null);

  // Fetch timesheet entries for current week
  const fetchEntries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        console.log('No authenticated user found');
        setLoading(false);
        return;
      }

      // First get worker profile by email
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('id, hourly_rate, organizations(name)')
        .eq('email', user.email)
        .single();

      if (workerError || !workerData) {
        console.log('Worker not found for email:', user.email);
        toast.error('Worker profile not found');
        setLoading(false);
        return;
      }

      setWorkerHourlyRate(workerData.hourly_rate || 0);
      setOrganizationName(workerData.organizations?.name || '');

      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

      console.log('Fetching entries for worker:', workerData.id, 'week:', weekStart, 'to', weekEnd);

      const { data, error } = await supabase
        .from('clock_entries')
        .select(`
          *,
          jobs (name, code),
          additional_costs (amount, description)
        `)
        .eq('worker_id', workerData.id)
        .gte('clock_in', weekStart.toISOString())
        .lte('clock_in', weekEnd.toISOString())
        .order('clock_in', { ascending: false });

      if (error) {
        console.error('Error fetching entries:', error);
        toast.error('Failed to load timesheet entries');
      } else {
        console.log('Found entries:', data?.length || 0);
        setEntries(data || []);
      }
    } catch (error) {
      console.error('Error in fetchEntries:', error);
      toast.error('Failed to load timesheet data');
    }
    setLoading(false);
  };

  // Fetch existing amendments
  const fetchAmendments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // First get worker profile by email
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (workerError || !workerData) return;

      const { data } = await supabase
        .from('time_amendments')
        .select('*')
        .eq('worker_id', workerData.id);

      if (data) {
        setExistingAmendments(data);
      }
    } catch (error) {
      console.error('Error fetching amendments:', error);
    }
  };

  // Fetch expense types
  const fetchExpenseTypes = async () => {
    const { data } = await supabase
      .from('expense_types')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (data) {
      setExpenseTypes(data);
    }
  };

  // Fetch worker data
  const fetchWorker = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('email', user.email)
        .single();

      if (error) throw error;
      setWorker(data);
    } catch (error) {
      console.error('Error fetching worker:', error);
    }
  };

  // Fetch jobs for manual entry
  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  useEffect(() => {
    fetchWorker();
    fetchJobs();
    fetchEntries();
    fetchAmendments();
    fetchExpenseTypes();
  }, [currentWeek]);

  // Group entries by day
  const entriesByDay = entries.reduce((acc, entry) => {
    const day = format(parseISO(entry.clock_in), 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = [];
    acc[day].push(entry);
    return acc;
  }, {} as Record<string, any[]>);

  // Calculate daily and weekly totals
  const calculateHours = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return 0;
    return differenceInMinutes(parseISO(clockOut), parseISO(clockIn)) / 60;
  };

  const weeklyTotal = entries.reduce((total, entry) => {
    return total + calculateHours(entry.clock_in, entry.clock_out);
  }, 0);

  // Calculate pay totals
  const calculateWeeklyHoursPay = () => weeklyTotal * workerHourlyRate;
  
  const calculateWeeklyExpenses = () => {
    return entries.reduce((total, entry) => {
      if (entry.additional_costs && Array.isArray(entry.additional_costs)) {
        return total + entry.additional_costs.reduce((sum: number, cost: any) => 
          sum + parseFloat(cost.amount), 0);
      }
      return total;
    }, 0);
  };

  const calculateWeeklyTotalPay = () => calculateWeeklyHoursPay() + calculateWeeklyExpenses();

  const calculateDayHours = (dayEntries: any[]) => {
    return dayEntries.reduce((total, entry) => 
      total + calculateHours(entry.clock_in, entry.clock_out), 0);
  };

  const calculateDayHoursPay = (dayEntries: any[]) => {
    return calculateDayHours(dayEntries) * workerHourlyRate;
  };

  const calculateDayExpenses = (dayEntries: any[]) => {
    return dayEntries.reduce((total, entry) => {
      if (entry.additional_costs && Array.isArray(entry.additional_costs)) {
        return total + entry.additional_costs.reduce((sum: number, cost: any) => 
          sum + parseFloat(cost.amount), 0);
      }
      return total;
    }, 0);
  };

  const calculateDayTotalPay = (dayEntries: any[]) => {
    return calculateDayHoursPay(dayEntries) + calculateDayExpenses(dayEntries);
  };

  // Submit amendment request
  const handleAmendmentSubmit = async () => {
    if (!selectedEntry || !amendmentReason) {
      toast.error('Please provide a reason for the amendment');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get worker ID by email
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (workerError || !workerData) {
        toast.error('Worker profile not found');
        return;
      }
      
      const { error } = await supabase
        .from('time_amendments')
        .insert({
          worker_id: workerData.id,
          clock_entry_id: selectedEntry.id,
          requested_clock_in: newClockIn || selectedEntry.clock_in,
          requested_clock_out: newClockOut || selectedEntry.clock_out,
          reason: amendmentReason,
          status: 'pending'
        });
    
      if (error) {
        toast.error('Failed to submit amendment');
      } else {
        toast.success('Amendment request submitted for approval');
        setShowAmendmentDialog(false);
        setAmendmentReason('');
        setNewClockIn('');
        setNewClockOut('');
        fetchAmendments();
      }
    } catch (error) {
      console.error('Error submitting amendment:', error);
      toast.error('Failed to submit amendment');
    }
  };

  // Add expenses to past entry
  const handleExpenseSubmit = async () => {
    if (selectedExpenses.length === 0) {
      setShowExpenseDialog(false);
      return;
    }

    setSavingExpenses(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get worker ID by email  
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (workerError || !workerData) {
        toast.error('Worker profile not found');
        setSavingExpenses(false);
        return;
      }

      let successCount = 0;

      for (const expenseId of selectedExpenses) {
        const expense = expenseTypes.find(e => e.id === expenseId);
        if (expense) {
          const { error } = await supabase
            .from('additional_costs')
            .insert({
              worker_id: workerData.id,
              clock_entry_id: selectedEntry.id,
              date: format(parseISO(selectedEntry.clock_in), 'yyyy-MM-dd'),
              description: expense.name,
              amount: expense.amount,
              cost_type: 'other',
              expense_type_id: expenseId
            });

          if (!error) {
            successCount++;
          }
        }
      }

      setSavingExpenses(false);
      toast.success(`${successCount} expense(s) added`);
      setShowExpenseDialog(false);
      setSelectedExpenses([]);
      fetchEntries();
    } catch (error) {
      console.error('Error adding expenses:', error);
      toast.error('Failed to add expenses');
      setSavingExpenses(false);
    }
  };

  // Check if amendment exists for entry
  const hasAmendment = (entryId: string) => {
    return existingAmendments.some(a => a.clock_entry_id === entryId);
  };

  const getAmendmentStatus = (entryId: string) => {
    const amendment = existingAmendments.find(a => a.clock_entry_id === entryId);
    return amendment?.status;
  };

  // Submit manual entry
  const submitManualEntry = async () => {
    if (!manualEntry.job_id) {
      toast.error('Please select a job site');
      return;
    }

    if (!worker?.id) {
      toast.error('Worker profile not found');
      return;
    }

    setSubmittingManual(true);
    try {
      // Combine date and time for timestamps
      const clockInDateTime = new Date(`${manualEntry.date}T${manualEntry.clock_in_time}:00`);
      const clockOutDateTime = new Date(`${manualEntry.date}T${manualEntry.clock_out_time}:00`);

      // Validate times
      if (clockOutDateTime <= clockInDateTime) {
        toast.error('Clock out time must be after clock in time');
        setSubmittingManual(false);
        return;
      }

      // Check for existing entries on this date
      const { data: existingEntries, error: checkError } = await supabase
        .from('clock_entries')
        .select('*')
        .eq('worker_id', worker.id)
        .gte('clock_in', `${manualEntry.date}T00:00:00`)
        .lte('clock_in', `${manualEntry.date}T23:59:59`);

      if (checkError) throw checkError;

      if (existingEntries && existingEntries.length > 0) {
        toast.error('You already have an entry for this date');
        setSubmittingManual(false);
        return;
      }

      // Calculate total hours
      const totalHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);

      // Create the manual entry
      const { error } = await supabase
        .from('clock_entries')
        .insert({
          worker_id: worker.id,
          job_id: manualEntry.job_id,
          clock_in: clockInDateTime.toISOString(),
          clock_out: clockOutDateTime.toISOString(),
          total_hours: Math.round(totalHours * 100) / 100,
          manual_entry: true,
          notes: manualEntry.notes || `Manual entry added on ${format(new Date(), 'dd/MM/yyyy')}`
        });

      if (error) throw error;

      toast.success('Manual entry added successfully');
      setShowManualEntry(false);
      setManualEntry({
        date: format(new Date(), 'yyyy-MM-dd'),
        job_id: '',
        clock_in_time: '09:00',
        clock_out_time: '17:00',
        notes: ''
      });
      fetchEntries(); // Refresh the timesheet
    } catch (error: any) {
      console.error('Error adding manual entry:', error);
      toast.error(error.message || 'Failed to add manual entry');
    } finally {
      setSubmittingManual(false);
    }
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  const groupEntriesByDay = () => entriesByDay;
  const calculateWeeklyHours = () => weeklyTotal.toFixed(2);
  const getAmendmentForEntry = (entryId: string) => existingAmendments.find(a => a.clock_entry_id === entryId);
  const calculateEntryHours = (entry: any) => calculateHours(entry.clock_in, entry.clock_out).toFixed(2);
  const calculateEntryPay = (entry: any) => (calculateHours(entry.clock_in, entry.clock_out) * workerHourlyRate).toFixed(2);
  const changeWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(addDays(currentWeek, direction === 'prev' ? -7 : 7));
  };
  const openAmendmentDialog = (entry: any) => {
    setSelectedEntry(entry);
    setShowAmendmentDialog(true);
  };
  const openExpenseDialog = (entry: any) => {
    setSelectedEntry(entry);
    setShowExpenseDialog(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-black shadow-lg sticky top-0 z-50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/clock')}
                className="p-2 text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">AutoTime</h1>
                <p className="text-sm text-gray-300">Timesheets</p>
              </div>
              {organizationName && (
                <span className="text-sm text-gray-300 border-l border-gray-500 pl-3">
                  {organizationName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-white border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => changeWeek('prev')}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <div className="text-center">
            <p className="font-semibold text-gray-900">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </p>
            <p className="text-sm text-gray-500">
              Total: {calculateWeeklyHours()} hours | £{calculateWeeklyTotalPay().toFixed(2)}
            </p>
          </div>
          
          <button
            onClick={() => changeWeek('next')}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Timesheet Entries */}
      <div className="p-4">
        {loading ? (
          <div className="animate-pulse">Loading timesheets...</div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No timesheet entries for this week</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Group entries by day */}
            {Object.entries(groupEntriesByDay()).map(([date, dayEntries]) => (
              <div key={date} className="bg-white rounded-xl shadow-sm">
                <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl">
                  <p className="font-semibold text-gray-900">
                    {format(new Date(date), 'EEEE, MMM d')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {calculateDayHours(dayEntries).toFixed(2)} hours | £{calculateDayTotalPay(dayEntries).toFixed(2)}
                  </p>
                </div>
                
                <div className="divide-y">
                  {dayEntries.map((entry: any) => (
                    <div key={entry.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {entry.jobs?.name || 'Unknown Job'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {format(new Date(entry.clock_in), 'h:mm a')} - 
                            {entry.clock_out 
                              ? format(new Date(entry.clock_out), 'h:mm a')
                              : 'In Progress'}
                          </p>
                          {entry.additional_costs?.length > 0 && (
                            <p className="text-sm text-gray-500 mt-1">
                              Expenses: £{entry.additional_costs.reduce((sum: number, cost: any) => 
                                sum + (cost.amount || 0), 0).toFixed(2)}
                            </p>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <p className="font-medium text-gray-900">
                            {calculateEntryHours(entry)} hrs
                          </p>
                          <p className="text-sm text-gray-600">
                            £{calculateEntryPay(entry)}
                          </p>
                          
                          {/* Amendment Status Badge */}
                          {getAmendmentForEntry(entry.id) && (
                            <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
                              getAmendmentForEntry(entry.id)?.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : getAmendmentForEntry(entry.id)?.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {getAmendmentForEntry(entry.id)?.status}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="mt-3 flex space-x-2">
                        {!getAmendmentForEntry(entry.id) && entry.clock_out && (
                          <button
                            onClick={() => openAmendmentDialog(entry)}
                            className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                          >
                            Request Amendment
                          </button>
                        )}
                        
                        {!entry.additional_costs?.length && entry.clock_out && (
                          <button
                            onClick={() => openExpenseDialog(entry)}
                            className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                          >
                            Add Expense
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        {/* Week Navigation and Manual Entry */}
        <div className="bg-card rounded-lg shadow-sm p-4 mb-4 border border-border border-l-4 border-[#702D30]">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
              className="p-2 bg-[#702D30] hover:bg-[#420808] text-white rounded-lg transition-colors shadow-md"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="font-heading font-semibold text-foreground">
                {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM d')} - 
                {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), ' MMM d, yyyy')}
              </div>
              <div className="text-sm font-body text-muted-foreground mt-1">
                Total Hours: {weeklyTotal.toFixed(2)} | Total Pay: £{calculateWeeklyTotalPay().toFixed(2)}
              </div>
              <div className="text-xs font-body text-muted-foreground">
                Hours: £{calculateWeeklyHoursPay().toFixed(2)} + Expenses: £{calculateWeeklyExpenses().toFixed(2)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowManualEntry(true)}
                className="bg-[#702D30] hover:bg-[#420808] text-white"
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Manual Entry
              </Button>
              <button
                onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
                className="p-2 bg-[#702D30] hover:bg-[#420808] text-white rounded-lg transition-colors shadow-md"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Timesheet Entries */}
        {loading ? (
          <div className="bg-card rounded-lg shadow-sm p-8 text-center border border-border">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading timesheet...</p>
          </div>
        ) : Object.keys(entriesByDay).length === 0 ? (
          <div className="bg-card rounded-lg shadow-sm p-8 text-center border border-border">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No entries for this week</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(entriesByDay).map(([day, dayEntries]) => (
              <div key={day} className="bg-card rounded-lg shadow-sm overflow-hidden border border-border border-l-4 border-[#702D30]">
                <div className="bg-gradient-to-r from-[#111111] to-[#939393] text-white px-4 py-2 border-b border-border">
                  <div className="flex justify-between items-center">
                    <span className="font-heading font-bold text-white">{format(parseISO(day), 'EEEE, MMM d')}</span>
                    <div className="text-right">
                      <div className="text-sm font-body text-white/90">
                        {calculateDayHours(dayEntries as any[]).toFixed(2)} hours | £{calculateDayTotalPay(dayEntries as any[]).toFixed(2)} total
                      </div>
                      <div className="text-xs font-body text-white/80">
                        Hours: £{calculateDayHoursPay(dayEntries as any[]).toFixed(2)} + Expenses: £{calculateDayExpenses(dayEntries as any[]).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
                
                 <div className="divide-y divide-border">
                   {(dayEntries as any[]).map((entry: any) => (
                    <div key={entry.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                           <div className="font-body font-medium text-foreground">
                             {entry.jobs?.name} ({entry.jobs?.code})
                           </div>
                            <div className="text-sm font-body text-muted-foreground mt-1">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(parseISO(entry.clock_in), 'HH:mm')} - 
                                {entry.clock_out ? format(parseISO(entry.clock_out), ' HH:mm') : ' Active'}
                              </span>
                              {entry.clock_out && (
                                <span className="ml-3 font-heading font-medium">
                                  ({calculateHours(entry.clock_in, entry.clock_out).toFixed(2)} hrs)
                                </span>
                              )}
                            </div>
                            
                            {/* Manual entry indicator */}
                            {entry.manual_entry && (
                              <span className="inline-block mt-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded">
                                Manual Entry
                              </span>
                            )}
                            
                            {/* Auto clock-out indicator */}
                            {entry.auto_clocked_out && (
                              <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded ml-2">
                                Auto Clock-Out
                              </span>
                            )}
                            
                            {/* Show notes */}
                            {entry.notes && (
                              <p className="text-sm text-gray-500 mt-1">{entry.notes}</p>
                            )}
                          
                          {/* Show expenses */}
                          {entry.additional_costs && Array.isArray(entry.additional_costs) && entry.additional_costs.length > 0 && (
                            <div className="mt-2 text-sm text-primary">
                              {entry.additional_costs.length} expense(s) - 
                              £{(entry.additional_costs as any[]).reduce((sum: number, cost: any) => 
                                sum + parseFloat(cost.amount), 0
                              ).toFixed(2)}
                            </div>
                          )}

                           {/* Show amendment status */}
                           {hasAmendment(entry.id) && (
                             <div className="mt-2">
                               <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full
                                ${getAmendmentStatus(entry.id) === 'pending' ? 'bg-[#ED8936]/20 text-[#ED8936]' : 
                                   getAmendmentStatus(entry.id) === 'approved' ? 'bg-[#48BB78]/20 text-[#48BB78]' : 
                                   'bg-[#F56565]/20 text-[#F56565]'}`}>
                                 <AlertCircle className="w-3 h-3" />
                                 Amendment {getAmendmentStatus(entry.id)}
                               </span>
                             </div>
                           )}
                        </div>
                        
                        {entry.clock_out && (
                          <div className="flex gap-2 ml-4">
                             <button
                               onClick={() => {
                                 setSelectedEntry(entry);
                                 setNewClockIn(entry.clock_in);
                                 setNewClockOut(entry.clock_out);
                                 setShowAmendmentDialog(true);
                               }}
                               disabled={hasAmendment(entry.id)}
                               className="p-2 text-[#702D30] hover:bg-[#702D30]/10 font-heading font-semibold rounded-lg transition-colors disabled:opacity-50"
                               title="Request Amendment"
                             >
                               <Edit2 className="w-4 h-4" />
                             </button>
                             <button
                               onClick={() => {
                                setSelectedEntry(entry);
                                setShowExpenseDialog(true);
                              }}
                              className="p-2 text-[#1E3A5F] hover:bg-blue-50 rounded-lg transition-colors"
                              title="Add Expenses"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Amendment Dialog */}
        {showAmendmentDialog && selectedEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto border border-border">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Request Time Amendment</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Current Clock In
                  </label>
                  <input
                    type="datetime-local"
                    value={format(parseISO(selectedEntry.clock_in), "yyyy-MM-dd'T'HH:mm")}
                    disabled
                    className="w-full px-3 py-2 border border-input rounded-lg bg-muted"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    New Clock In
                  </label>
                  <input
                    type="datetime-local"
                    value={format(parseISO(newClockIn), "yyyy-MM-dd'T'HH:mm")}
                    onChange={(e) => setNewClockIn(new Date(e.target.value).toISOString())}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring"
                  />
                </div>
                
                {selectedEntry.clock_out && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Current Clock Out
                      </label>
                      <input
                        type="datetime-local"
                        value={format(parseISO(selectedEntry.clock_out), "yyyy-MM-dd'T'HH:mm")}
                        disabled
                        className="w-full px-3 py-2 border border-input rounded-lg bg-muted"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        New Clock Out
                      </label>
                      <input
                        type="datetime-local"
                        value={format(parseISO(newClockOut), "yyyy-MM-dd'T'HH:mm")}
                        onChange={(e) => setNewClockOut(new Date(e.target.value).toISOString())}
                        className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Reason for Amendment <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    value={amendmentReason}
                    onChange={(e) => setAmendmentReason(e.target.value)}
                    placeholder="Please explain why this amendment is needed..."
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring"
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAmendmentSubmit}
                  disabled={!amendmentReason}
                  className="flex-1 bg-[#FF6B35] hover:bg-[#E85A2A] text-white py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
                >
                  Submit Request
                </button>
                <button
                  onClick={() => {
                    setShowAmendmentDialog(false);
                    setAmendmentReason('');
                  }}
                  className="px-6 py-3 border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Expense Dialog */}
        {showExpenseDialog && selectedEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto border border-border">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Add Expenses</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add expenses for {format(parseISO(selectedEntry.clock_in), 'MMM d, yyyy')}
              </p>
              
              <div className="space-y-2 mb-6">
                {expenseTypes && expenseTypes.map && expenseTypes.map((expense: any) => (
                  <label key={expense.id} className="flex items-center p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mr-3 w-4 h-4"
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
                      <div className="font-medium text-foreground">{expense.name}</div>
                      <div className="text-sm text-muted-foreground">£{expense.amount.toFixed(2)}</div>
                      {expense.description && (
                        <div className="text-xs text-muted-foreground mt-1">{expense.description}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              
              {selectedExpenses.length > 0 && (
                <div className="p-3 bg-primary/10 rounded-lg mb-4">
                  <div className="flex justify-between font-medium text-foreground">
                    <span>Total:</span>
                    <span>£{selectedExpenses.reduce((sum: number, id: string) => {
                      const expense = expenseTypes.find(e => e.id === id);
                      return sum + (expense?.amount || 0);
                    }, 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={handleExpenseSubmit}
                  disabled={savingExpenses}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                    savingExpenses 
                      ? 'bg-muted cursor-not-allowed' 
                      : 'bg-[#FF6B35] hover:bg-[#E85A2A] text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                  }`}
                >
                  {savingExpenses ? 'Saving...' : selectedExpenses.length > 0 ? `Add ${selectedExpenses.length} Expense(s)` : 'Cancel'}
                </button>
                {selectedExpenses.length > 0 && !savingExpenses && (
                  <button
                    onClick={() => {
                      setShowExpenseDialog(false);
                      setSelectedExpenses([]);
                    }}
                    className="px-6 py-3 border border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Manual Entry Dialog */}
        <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Add Manual Time Entry</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="entry-date">Date</Label>
                <Input
                  id="entry-date"
                  type="date"
                  value={manualEntry.date}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, date: e.target.value }))}
                  max={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>

              <div>
                <Label htmlFor="job-select">Job Site</Label>
                <Select
                  value={manualEntry.job_id}
                  onValueChange={(value) => setManualEntry(prev => ({ ...prev, job_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job site" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name} ({job.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clock-in">Clock In Time</Label>
                  <Input
                    id="clock-in"
                    type="time"
                    value={manualEntry.clock_in_time}
                    onChange={(e) => setManualEntry(prev => ({ ...prev, clock_in_time: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="clock-out">Clock Out Time</Label>
                  <Input
                    id="clock-out"
                    type="time"
                    value={manualEntry.clock_out_time}
                    onChange={(e) => setManualEntry(prev => ({ ...prev, clock_out_time: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="Reason for manual entry"
                  value={manualEntry.notes}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowManualEntry(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitManualEntry}
                  className="flex-1 bg-[#702D30] hover:bg-[#420808] text-white"
                  disabled={submittingManual}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {submittingManual ? 'Adding...' : 'Add Entry'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}