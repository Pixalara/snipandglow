'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { completeOnboarding } from './actions';
import { createClient as createBrowserSupabase } from '@/lib/supabase/client';

interface ServiceEntry {
  name: string;
  category: string;
  duration_minutes: number;
  price: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 fields
  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2 fields
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('21:00');

  // Step 3 fields
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [newService, setNewService] = useState<ServiceEntry>({
    name: '',
    category: 'Hair',
    duration_minutes: 30,
    price: 500,
  });

  const addService = () => {
    if (!newService.name.trim()) return;
    setServices((prev) => [...prev, { ...newService }]);
    setNewService({ name: '', category: 'Hair', duration_minutes: 30, price: 500 });
  };

  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const result = await completeOnboarding({
      salonName,
      ownerName,
      phone,
      branchName: branchName || salonName,
      branchAddress,
      state,
      pincode,
      openTime,
      closeTime,
      services: services.length > 0 ? services : undefined,
    });

    setLoading(false);

    if (result.success) {
      // Refresh the session so the JWT picks up the new tenant_id metadata
      const supabase = createBrowserSupabase();
      await supabase.auth.refreshSession();
      router.push('/dashboard?welcome=true');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Set Up Your Salon</CardTitle>
          {/* Progress indicator */}
          <div className="flex items-center gap-2 pt-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Step {step} of 3</p>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Step 1: Salon Info */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="salonName">Salon Name</Label>
                <Input
                  id="salonName"
                  value={salonName}
                  onChange={(e) => setSalonName(e.target.value)}
                  placeholder="e.g. Snip & Glow"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Owner Name</Label>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </>
          )}

          {/* Step 2: Branch Info */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="branchName">Branch Name</Label>
                <Input
                  id="branchName"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder={salonName || 'Main Branch'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branchAddress">Address <span className="text-destructive">*</span></Label>
                <Input
                  id="branchAddress"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="Shop no., street, area, city"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state">State <span className="text-destructive">*</span></Label>
                  <Input
                    id="state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Maharashtra"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode <span className="text-destructive">*</span></Label>
                  <Input
                    id="pincode"
                    inputMode="numeric"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit pincode"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="openTime">Opening Time</Label>
                  <Input
                    id="openTime"
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="closeTime">Closing Time</Label>
                  <Input
                    id="closeTime"
                    type="time"
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 3: Services */}
          {step === 3 && (
            <>
              <p className="text-sm text-muted-foreground">
                Add your initial services or skip for now.
              </p>
              {services.length > 0 && (
                <ul className="space-y-2">
                  {services.map((svc, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span>{svc.name} — {svc.category} — ₹{svc.price}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeService(i)}>
                        ✕
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Service name"
                  value={newService.name}
                  onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))}
                />
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newService.category}
                  onChange={(e) => setNewService((s) => ({ ...s, category: e.target.value }))}
                >
                  <option value="Hair">Hair</option>
                  <option value="Skin">Skin</option>
                  <option value="Nails">Nails</option>
                  <option value="Spa">Spa</option>
                </select>
                <Input
                  type="number"
                  placeholder="Price (₹)"
                  value={newService.price}
                  onChange={(e) => setNewService((s) => ({ ...s, price: Number(e.target.value) }))}
                />
              </div>
              <Button variant="outline" size="sm" onClick={addService} disabled={!newService.name.trim()}>
                + Add Service
              </Button>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 && (!salonName || !ownerName || !phone)) ||
                (step === 2 && (!branchAddress.trim() || !state.trim() || !/^\d{6}$/.test(pincode)))
              }
            >
              Next
            </Button>
          ) : (
            <div className="flex gap-2">
              {services.length === 0 && (
                <Button variant="ghost" onClick={handleSubmit} disabled={loading}>
                  Skip for now
                </Button>
              )}
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Setting up…' : 'Complete Setup'}
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
