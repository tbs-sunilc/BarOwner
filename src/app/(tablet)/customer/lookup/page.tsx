'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getActiveBarId } from '@/lib/active-bar';
import { getTabletState, TabletState, saveTabletState } from '@/lib/tablet-state';
import {
  ApiError,
  confirmWalletTopUp,
  fetchCustomerLookup as lookupCustomerByMobile,
  initiateWalletTopUp,
  type WalletVolumeMl,
} from '@/lib/api-client';
import { openRazorpayCheckout } from '@/lib/razorpay-checkout';
import { WalletActionModal } from '@/components/payments/WalletActionModal';

type LookupWallet = NonNullable<TabletState['customerProfile']>['wallets'][number];

const TOP_UP_VOLUMES: WalletVolumeMl[] = [750, 1000];

export default function CustomerLookupPage() {
  const router = useRouter();
  const [state, setState] = useState<TabletState | null>(null);
  const [lookupMode, setLookupMode] = useState<'qr' | 'mobile'>('qr');
  const [showProfile, setShowProfile] = useState(false);
  const [showNotFound, setShowNotFound] = useState(false);
  const [mobileValue, setMobileValue] = useState('');
  const [topUpWallet, setTopUpWallet] = useState<LookupWallet | null>(null);
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  useEffect(() => {
    setState(getTabletState());
  }, []);

  if (!state) {
    return <div className="p-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest text-xs">Loading customer lookup...</div>;
  }

  const normalize = (value: string) => value.replace(/\W/g, '').toLowerCase();

  const normalizeMobileForLookup = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return digits;
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  };

  type CustomerProfile = NonNullable<TabletState['customerProfile']>;

  const fetchCustomerLookup = async (mobile: string): Promise<CustomerProfile | null> => {
    const normalizedMobile = normalizeMobileForLookup(mobile);
    if (!normalizedMobile) return null;

    try {
      const barId = getActiveBarId() ?? 1;
      const data = await lookupCustomerByMobile(normalizedMobile, barId);
      return {
        name: data.name,
        mobile: data.mobile,
        kycStatus: data.kycStatus,
        table: data.currentTable ?? 'Unknown',
        wallets: (data.wallets || []).map((wallet: any) => ({
          id: wallet.id,
          name: wallet.name,
          balance: wallet.balance,
          total: wallet.total,
          lastServed: wallet.lastServed,
          warning: wallet.warning,
        })),
      };
    } catch (error) {
      console.error('[CustomerLookup] lookup failed', error);
      return null;
    }
  };

  const buildCustomerProfile = (
    customerName: string,
    fallbackMobile?: string
  ): CustomerProfile => {
    const normalizedName = normalize(customerName);
    const customerPours = state.pourQueue.filter(p => normalize(p.customer) === normalizedName);
    const table = state.tables.find(
      t =>
        (t.customerName && normalize(t.customerName) === normalizedName) ||
        customerPours.some(p => p.tableId === t.id)
    );

    const mobile =
      state.customerProfile?.name === customerName
        ? state.customerProfile.mobile
        : fallbackMobile || state.customerProfile?.mobile || 'Unknown';

    const wallets =
      customerPours.length > 0
        ? customerPours.map((pour) => ({
            id: pour.id,
            name: pour.bottle,
            balance: pour.walletBalance,
            total: 750,
            lastServed: pour.waitTime,
            warning: pour.walletBalance < 200 ? 'Low balance' : undefined,
          }))
        : state.customerProfile?.name === customerName
        ? state.customerProfile.wallets
        : [];

    return {
      name: customerName,
      mobile,
      kycStatus: customerPours.length > 0 ? 'Verified' : state.customerProfile?.name === customerName ? state.customerProfile.kycStatus : 'Unknown',
      table: table ? `Table ${table.id}` : customerPours.length > 0 ? `Table ${customerPours[0].tableId}` : 'Unknown',
      wallets,
    };
  };

  const handleToggle = (mode: 'qr' | 'mobile') => {
    setLookupMode(mode);
    setShowNotFound(false);
  };

  const handleScanClick = () => {
    setShowNotFound(false);

    const pour = state.pourQueue[0];
    let profile: TabletState['customerProfile'] | null = null;

    if (pour) {
      profile = buildCustomerProfile(pour.customer);
    } else if (state.customerProfile) {
      profile = buildCustomerProfile(state.customerProfile.name, state.customerProfile.mobile);
    }

    const newState = { ...state, customerProfile: profile };
    setState(newState);
    saveTabletState(newState);
    setShowProfile(Boolean(profile));

    if ((window as any).toast) {
      (window as any).toast(profile ? `✅ QR scanned — ${profile.name} loaded` : '⚠️ No customer data', profile ? 's' : 'w');
    }
  };

  const handleMobileSearch = async (val: string) => {
    setMobileValue(val);
    setShowNotFound(false);
    setShowProfile(false);

    const digits = val.replace(/\D/g, '');
    if (digits.length < 4) {
      return;
    }

    // If the currently loaded customer already matches this mobile pattern, keep it
    if (
      state.customerProfile &&
      state.customerProfile.mobile.replace(/\D/g, '').includes(digits)
    ) {
      const newState = { ...state, customerProfile: state.customerProfile };
      setState(newState);
      saveTabletState(newState);
      setShowProfile(true);
      if ((window as any).toast) (window as any).toast(`✅ Mobile search match — ${state.customerProfile.name} loaded`, 's');
      return;
    }

    // Local queue/table lookup by name if input is not a full mobile number.
    const normalized = normalize(val);
    const byName = state.pourQueue.find(p => normalize(p.customer).includes(normalized));
    const byTable = state.tables.find(
      t => t.customerName && normalize(t.customerName).includes(normalized)
    );
    const matchName = byName?.customer || byTable?.customerName;

    if (matchName) {
      const profile = buildCustomerProfile(matchName, state.customerProfile?.mobile);
      const newState = { ...state, customerProfile: profile };
      setState(newState);
      saveTabletState(newState);
      setShowProfile(true);
      if ((window as any).toast) (window as any).toast(`✅ Customer found — ${profile.name} loaded`, 's');
      return;
    }

    // Remote lookup via the dynamic customer lookup API.
    const queryMobile = normalizeMobileForLookup(val);
    const profile = await fetchCustomerLookup(queryMobile);

    if (profile) {
      const newState = { ...state, customerProfile: profile };
      setState(newState);
      saveTabletState(newState);
      setShowProfile(true);
      if ((window as any).toast) (window as any).toast(`✅ Mobile lookup loaded — ${profile.name}`, 's');
      return;
    }

    setShowNotFound(true);
    setShowProfile(false);
  };

  const handleServeWallet = (walletId: number) => {
    // Find a pending pour for the currently loaded customer and requested wallet
    const custName = state.customerProfile?.name;
    const pour = state.pourQueue.find(q => q.customer === custName && q.id === walletId) || state.pourQueue.find(q => q.customer === custName) || state.pourQueue.find(q => q.id === walletId);

    if (pour) {
      router.push(`/serve/${pour.id}`);
    } else {
      // fallback to first pour or a manual serve screen
      const first = state.pourQueue[0];
      router.push(first ? `/serve/${first.id}` : '/serve/5002');
    }
  };

  const handleOpenTopUp = (wallet: LookupWallet) => {
    setTopUpError(null);
    setTopUpWallet(wallet);
  };

  const handleCloseTopUp = () => {
    if (topUpBusy) return;
    setTopUpWallet(null);
    setTopUpError(null);
  };

  const handleConfirmTopUp = async (volumeMl: WalletVolumeMl) => {
    if (!topUpWallet || !state.customerProfile || topUpBusy) return;

    setTopUpBusy(true);
    setTopUpError(null);
    try {
      const initiation = await initiateWalletTopUp(topUpWallet.id, { volumeMl });
      const checkout = await openRazorpayCheckout({
        keyId: initiation.razorpayKeyId,
        orderId: initiation.razorpayOrderId,
        amountInPaise: initiation.amountInPaise,
        currency: initiation.currency,
        name: initiation.barName,
        description: `${initiation.bottleBrandName} ${initiation.bottleProductName} • Top up ${initiation.volumeMl}ml`,
        prefill: {
          name: state.customerProfile.name,
          contact: state.customerProfile.mobile,
        },
        notes: {
          paymentId: String(initiation.paymentId),
          walletId: String(topUpWallet.id),
        },
      });

      if (!checkout) {
        setTopUpError('Checkout was closed before payment was completed.');
        return;
      }

      const confirmed = await confirmWalletTopUp(topUpWallet.id, {
        razorpayOrderId: checkout.razorpay_order_id,
        razorpayPaymentId: checkout.razorpay_payment_id,
        razorpaySignature: checkout.razorpay_signature,
      });

      setTopUpWallet(null);
      setTopUpError(null);
      (window as any).toast?.(
        `Top-up complete. Wallet now has ${confirmed.newRemainingMl}ml remaining.`,
        's',
      );

      try {
        const refreshedProfile = await fetchCustomerLookup(state.customerProfile.mobile);
        if (refreshedProfile) {
          const nextState = { ...state, customerProfile: refreshedProfile };
          setState(nextState);
          saveTabletState(nextState);
        }
      } catch (refreshError) {
        console.warn('[CustomerLookup] post-top-up refresh failed', refreshError);
      }
    } catch (error) {
      setTopUpError(error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Payment failed.');
    } finally {
      setTopUpBusy(false);
    }
  };

  const handleGoDirectlyToServe = () => {
    router.push('/serve/5002');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto reveal">
      {/* Header Bar */}
      <header className="mb-8 flex justify-between items-center bg-slate-50 border border-slate-200 p-6 rounded-3xl">
        <div className="flex items-center gap-4">
          <Link href="/floor" className="btn-tablet btn-tablet-s !py-2 !px-4 !text-xs">
            ← Floor Plan
          </Link>
          <div>
            <h1 className="text-2xl font-black text-ink tracking-tighter">Customer Lookup</h1>
            <p className="text-xs text-muted font-bold uppercase tracking-wider mt-0.5">
              Verify KYC and wallet access
            </p>
          </div>
        </div>
        <Link href="/queue" className="btn-tablet btn-tablet-a !py-1.5 !px-4">
          🔔 Pour Queue
          <span className="ml-1 bg-white text-rose px-2 py-0.5 rounded-full text-[10px] font-black">
            {state.pourQueue.length}
          </span>
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left Column: Search Form */}
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Verification Method</h3>
          
          {/* Toggle buttons */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => handleToggle('qr')}
              className={`btn-tablet justify-center py-4 rounded-2xl ${lookupMode === 'qr' ? 'btn-tablet-p shadow-glow' : 'btn-tablet-s'}`}
            >
              📷 Scan Customer QR
            </button>
            <button
              onClick={() => handleToggle('mobile')}
              className={`btn-tablet justify-center py-4 rounded-2xl ${lookupMode === 'mobile' ? 'btn-tablet-p shadow-glow' : 'btn-tablet-s'}`}
            >
              📱 Mobile Search
            </button>
          </div>

          {/* QR Scan Area */}
          {lookupMode === 'qr' && (
            <div
              onClick={handleScanClick}
              className="panel border-dashed border-2 border-indigo-400 bg-indigo-50/20 p-10 h-64 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-indigo-50/40 transition-colors group rounded-[32px] mb-8"
            >
              <div className="text-5xl group-hover:scale-110 transition-transform">📷</div>
              <div className="text-center">
                <p className="text-indigo-900 font-black uppercase tracking-widest text-[11px] mb-1">Simulate Camera Scan</p>
                <p className="text-slate-500 text-xs font-bold leading-relaxed">Tap this box to scan the customer's app QR code</p>
              </div>
            </div>
          )}

          {/* Mobile Search Area */}
          {lookupMode === 'mobile' && (
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Customer Mobile Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={mobileValue}
                  onChange={(e) => handleMobileSearch(e.target.value)}
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl p-5 text-base font-bold focus:border-indigo-500 outline-none transition-all shadow-sm"
                />
              </div>
              <button
                onClick={() => handleMobileSearch(mobileValue)}
                className="btn-tablet btn-tablet-p w-full justify-center py-4 rounded-2xl"
              >
                Search Customer
              </button>
            </div>
          )}

          {/* Not Found Alert */}
          {showNotFound && (
            <div className="panel bg-amber-50 border border-amber-200 p-6 rounded-2xl mb-8 flex gap-4">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold text-amber-800 text-sm mb-1 uppercase tracking-tight">Customer Not Found</p>
                <p className="text-xs text-amber-700 font-bold leading-relaxed uppercase">
                  No customer found with this mobile number. They may not have a SipSave account. Use manual POS for walk-in orders.
                </p>
              </div>
            </div>
          )}

          {/* QA Test Note Box */}
          <div className="panel bg-slate-50 border border-slate-200 p-6 rounded-[24px]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">QA Terminal Testing Options</p>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
              Skip scanning or searching by jumping directly to the Arjun Mehta Serve & Deduct screen:
            </p>
            <button
              onClick={handleGoDirectlyToServe}
              className="btn-tablet btn-tablet-s w-full justify-center py-3 border-indigo-200 text-indigo-700 font-black text-xs uppercase"
            >
              🧪 Go directly to Serve screen
            </button>
          </div>
        </div>

        {/* Right Column: Profile details */}
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Customer Profile</h3>

          {showProfile && state.customerProfile ? (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-indigo-950 text-white rounded-[32px] p-8 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-40 h-40 bg-indigo-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-indigo-600 rounded-[24px] flex items-center justify-center text-3xl font-black shadow-glow border border-indigo-500/30">
                    A
                  </div>
                  <div>
                    <h2 className="text-2xl text-white tracking-tighter">{state.customerProfile.name}</h2>
                    <p className="text-indigo-300 text-sm font-bold mt-0.5">{state.customerProfile.mobile}</p>
                    
                    <div className="flex gap-2 mt-4">
                      <span className="badge-tablet bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        ✅ KYC Verified · 18+
                      </span>
                      <span className="badge-tablet bg-white/10 text-white border border-white/20">
                        {state.customerProfile.table}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wallets section */}
              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                  Active Wallets at Sky Lounge ({state.customerProfile.wallets.length})
                </h4>

                <div className="space-y-4">
                  {state.customerProfile.wallets.map((wallet) => {
                    const pct = (wallet.balance / wallet.total) * 100;
                    const isLow = wallet.balance < 200 || wallet.warning;
                    const borderClass = isLow ? 'border-amber-400 bg-amber-50/10 hover:bg-amber-50/20' : 'border-slate-200 bg-white hover:border-indigo-400';
                    const barColor = isLow ? 'bg-amber-500' : 'bg-indigo-600';

                    return (
                      <div
                        key={wallet.id}
                        onClick={() => handleServeWallet(wallet.id)}
                        className={`panel p-6 border-2 cursor-pointer transition-all ${borderClass}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="font-black text-slate-900 text-lg tracking-tight">{wallet.name}</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">
                              / {wallet.total}ml · Last served: {wallet.lastServed}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-black text-indigo-950 tracking-tighter">
                              {wallet.balance}<span className="text-xs ml-1 text-slate-300">ml</span>
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center">
                          <div>
                            {wallet.warning && (
                              <span className="text-[10px] text-amber-600 font-black uppercase tracking-wider">
                                ⚠️ {wallet.warning}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleServeWallet(wallet.id);
                            }}
                            className="btn-tablet btn-tablet-g !py-2 !px-4 !text-[10px] font-black uppercase tracking-widest"
                          >
                            Serve →
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTopUp(wallet);
                            }}
                            disabled={topUpBusy}
                            className="btn-tablet btn-tablet-a !py-2 !px-4 !text-[10px] font-black uppercase tracking-widest disabled:opacity-60 disabled:cursor-wait"
                          >
                            Top up
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-slate-100 rounded-[32px] p-24 text-center">
              <div className="text-6xl mb-4 grayscale opacity-20">👤</div>
              <p className="text-slate-900 font-bold text-lg">No customer loaded yet</p>
              <p className="text-slate-400 text-sm mt-1 font-medium leading-relaxed">
                Scan customer QR code or search by mobile number to load their KYC profile and spirits wallet balance.
              </p>
            </div>
          )}
        </div>
      </div>

      <WalletActionModal
        open={!!topUpWallet}
        title={topUpWallet ? `Top up ${topUpWallet.name}` : 'Top up wallet'}
        description={topUpWallet && state.customerProfile
          ? `${state.customerProfile.name} • Current balance ${topUpWallet.balance}ml of ${topUpWallet.total}ml\nChoose a volume to open the secure Razorpay checkout.`
          : 'Choose a volume to open the secure Razorpay checkout.'}
        confirmLabel="Open Razorpay"
        busy={topUpBusy}
        errorMessage={topUpError}
        availableVolumes={TOP_UP_VOLUMES}
        defaultVolumeMl={750}
        tone="emerald"
        onClose={handleCloseTopUp}
        onConfirm={handleConfirmTopUp}
      />
    </div>
  );
}
