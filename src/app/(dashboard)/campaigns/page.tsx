'use client';

import { useEffect, useMemo, useState } from 'react';
import { getActiveBarId } from '@/lib/active-bar';
import {
  ApiError,
  createCampaign,
  getCampaignSegmentCounts,
  getCampaignQuotaSummary,
  listCampaignTemplates,
  listCampaigns,
  sendCampaign,
  type CampaignListItemDto,
  type CampaignQuotaSummaryDto,
  type SegmentCountsDto,
  type TemplateDto,
} from '@/lib/api-client';

const SEGMENTS = [
  { key: 'all', label: 'All visitors', desc: 'Everyone from this bar', icon: 'users' },
  { key: 'power', label: 'Power regular', desc: '4+ visits/month', icon: 'flame' },
  { key: 'dormant', label: 'Dormant user', desc: 'No visit 3+ weeks', icon: 'moon' },
  { key: 'new', label: 'New customer', desc: '0-1 visit', icon: 'user-plus' },
  { key: 'fav', label: 'Fav item lover', desc: 'Repeat orderer', icon: 'heart' },
  { key: 'group', label: 'Group visitor', desc: 'Avg group 3+', icon: 'friends' },
  { key: 'weekend', label: 'Weekend warrior', desc: 'Fri-Sat only', icon: 'calendar-week' },
  { key: 'bday', label: 'Birthday month', desc: 'DOB this month', icon: 'cake' },
] as const;

const CATEGORIES = ['all', 'humor', 'personal', 'fomo', 'event', 'weather', 'game', 'late', 'vip'] as const;

const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  all: 'All',
  humor: 'Humor & emotion',
  personal: 'Hyper-personalized',
  fomo: 'FOMO & scarcity',
  event: 'Event & community',
  weather: 'Weather & context',
  game: 'Gamification',
  late: 'Late night',
  vip: 'VIP / Exclusive',
};

const TEMPLATES = [
  { id: 1, cat: 'humor', segs: ['all'], text: 'That meeting could have been an email. Leave the laptop. Happy Hour in 15 mins.', time: 'Weekday 4:45 PM' },
  { id: 2, cat: 'humor', segs: ['all'], text: 'You survived Monday. Reward yourself. First cocktail half-price tonight only.', time: 'Monday 6 PM' },
  { id: 3, cat: 'humor', segs: ['all'], text: 'The salary just hit. You earned this. Treat yourself to the premium shelf tonight.', time: 'Last Friday 4 PM' },
  { id: 4, cat: 'humor', segs: ['weekend'], text: 'Wednesday ka vibe alag hota hai. No crowd, best bartender, 2-for-1 cocktails. Try it?', time: 'Wednesday 6 PM' },
  { id: 5, cat: 'humor', segs: ['all'], text: 'Delay Monday as long as possible. Espresso Martinis - 2 for 1 tonight.', time: 'Sunday 7 PM' },
  { id: 6, cat: 'humor', segs: ['all'], text: "Gym cancelled? The bar didn't. Frozen margaritas + rooftop fans. Come cool down.", time: 'Hot day 4 PM' },
  { id: 7, cat: 'humor', segs: ['all'], text: 'Raining? Good. That means you have the perfect excuse to stay in... at our bar.', time: 'Rainy day 5 PM' },
  { id: 8, cat: 'personal', segs: ['fav'], text: 'Hey {name}, your favourite Japanese Whiskey is back. We saved a pour for you.', time: 'Restock day 5:30 PM' },
  { id: 9, cat: 'personal', segs: ['fav'], text: "{name}, we added a new single malt you'll love. Based on what you usually order.", time: 'Friday 5 PM' },
  { id: 10, cat: 'personal', segs: ['power'], text: "{name}, your usual spot near the bar is waiting. Complimentary first pour - just for you.", time: 'Friday 6 PM' },
  { id: 11, cat: 'personal', segs: ['power'], text: "Legend status unlocked, {name}. You're now in our Top 10 regulars. Free round tonight.", time: 'On milestone' },
  { id: 12, cat: 'personal', segs: ['bday'], text: 'Birthday week starts NOW, {name}! Bring 3 friends tonight - bubbly bottle is on us.', time: 'Mon of bday week 10 AM' },
  { id: 13, cat: 'personal', segs: ['bday'], text: 'Happy Birthday, {name}! VIP table + free shots for your whole crew. Reserve now.', time: 'Birthday 12 PM' },
  { id: 14, cat: 'fomo', segs: ['all'], text: "We just tapped a rare single-keg craft beer. When it's gone - it's gone forever. First pour?", time: 'Thursday 5 PM' },
  { id: 15, cat: 'fomo', segs: ['all'], text: 'Our Summer Cocktail Menu drops TONIGHT. Be first to try "Spicy Mango Mezcal".', time: 'Friday 4 PM' },
  { id: 16, cat: 'fomo', segs: ['all'], text: 'Only 4 tables left for Comedy Night tonight. Tap to grab yours before theyre gone!', time: 'Event day 12 PM' },
  { id: 17, cat: 'fomo', segs: ['all'], text: 'Flash Extension! Happy Hour extended 60 mins for app users ONLY. Ends 8 PM.', time: 'Tue/Wed 7 PM' },
  { id: 18, cat: 'fomo', segs: ['all'], text: 'The dancefloor is already packed. Come before the queue builds - your name is on the list.', time: 'Fri/Sat 10:30 PM' },
  { id: 19, cat: 'event', segs: ['group'], text: "Trivia Night at 8! Last week's champs are back. Bring your smartest crew, {name}.", time: 'Tuesday 3 PM' },
  { id: 20, cat: 'event', segs: ['all'], text: 'Jersey up! Every time we score tonight - FREE round for EVERYONE in the bar.', time: '1 hr before kickoff' },
  { id: 21, cat: 'event', segs: ['all'], text: "Wine Wednesday is back. Bring your best friend - we'll bring the bottle (and cheese board).", time: 'Wednesday 5 PM' },
  { id: 22, cat: 'weather', segs: ['all'], text: "It's a scorcher today. Rooftop misting fans ON. Frozen margaritas flowing all evening.", time: 'Hot day 4 PM' },
  { id: 23, cat: 'weather', segs: ['all'], text: 'Raining cats and dogs? Escape the storm. Fireplace is lit. Drinks are cold.', time: 'Rainy day 5 PM' },
  { id: 24, cat: 'weather', segs: ['all'], text: 'Hard week? Weekend starts NOW. Happy Hour + live acoustic set at 6 PM.', time: 'Friday 5 PM' },
  { id: 25, cat: 'game', segs: ['all'], text: 'Beat your bartender at Rock-Paper-Scissors tonight. Win = free drink upsize!', time: 'Sun/Mon 7 PM' },
  { id: 26, cat: 'game', segs: ['all'], text: 'Tap to scratch! You just won a mystery prize for tonight. Show to your server.', time: 'Thursday 4:30 PM' },
  { id: 27, cat: 'game', segs: ['power'], text: "You're on a 4-week streak, {name}! Come tonight to keep it alive + earn 3x points.", time: 'Thursday 6 PM' },
  { id: 28, cat: 'game', segs: ['all'], text: 'Double loyalty points on ALL drinks tonight. Stack your rewards. Tonight only.', time: 'Friday 4 PM' },
  { id: 29, cat: 'late', segs: ['all'], text: 'Still out? Kitchen is closed everywhere else. Our late-night bites are hot till 2 AM.', time: 'Fri/Sat 10:30 PM' },
  { id: 30, cat: 'late', segs: ['all'], text: "Last round in 30 mins. Don't leave thirsty. One more before we close the bar.", time: '1:30 AM weekends' },
  { id: 31, cat: 'vip', segs: ['power'], text: 'Secret menu cocktail - tonight only, only for regulars. Show this screen to your bartender, {name}.', time: 'Friday 6 PM' },
  { id: 32, cat: 'vip', segs: ['power'], text: "{name}, we've held your spot near the bar. Complimentary first pour - just say you're here.", time: 'Saturday 7 PM' },
  { id: 33, cat: 'vip', segs: ['all'], text: 'App users ONLY: Half-price second drink tonight. Walk-ins do not get this. You are welcome.', time: 'Wed/Thu 7 PM' },
  { id: 34, cat: 'humor', segs: ['new'], text: 'Welcome to the family, {name}! First visit = second drink FREE. Valid this weekend.', time: '2 days after signup' },
  { id: 35, cat: 'humor', segs: ['dormant'], text: "{name}, we changed the playlist. Added the good stuff. Come back and tell us what you think?", time: 'Day 14, Wed 7 PM' },
  { id: 36, cat: 'personal', segs: ['dormant'], text: "It's been 3 weeks, {name}. The barstool feels empty. Tonight - first drink is on us.", time: 'Day 21, Thu 6 PM' },
] as const;

const WIN_BACK = [
  { step: '1', days: 'Day 14', type: 'Curiosity nudge (no offer)', msg: '{name}, we changed the playlist. Added the good stuff. Come back and tell us what you think?', time: 'Wednesday 7 PM', why: 'Soft contact. No pressure, no discount. Curiosity hook only. Low unsubscribe risk.', cls: '' },
  { step: '2', days: 'Day 21', type: 'Emotional + free drink', msg: "It's been 3 weeks, {name}. The barstool feels empty. Tonight - first drink is on us.", time: 'Thursday 6 PM', why: 'Emotional guilt + concrete offer. Proven win-back psychology. High conversion.', cls: '' },
  { step: '3', days: 'Day 30', type: 'Hard discount - last chance', msg: 'Last chance, {name}. 30% off your next 2 drinks this weekend. No questions asked.', time: 'Friday 5 PM', why: 'Maximum offer. Final attempt before silence period. Urgency language essential.', cls: '' },
  { step: 'Pause', days: 'Day 31-44', type: 'Silence period', msg: 'DO NOT SEND ANY NOTIFICATIONS - 2 week rest period.', time: '-', why: 'Over-messaging a dormant user = permanent opt-out. Let them breathe.', cls: 'pause' },
  { step: '5', days: 'Day 45+', type: 'Seasonal campaign re-entry', msg: "{name}, it's been a while. Big things happening this month. Come see for yourself.", time: 'Event / season start', why: 'Re-enter via major event or season. Feels fresh, not desperate. Normal flow resumes.', cls: '' },
  { step: '6', days: 'Day 60+', type: 'Birthday / special event only', msg: 'Only send if birthday month OR major event matches their past preferences.', time: 'Contextual', why: 'Last resort personalization. If this fails, mark as churned. Stop sending.', cls: 'stop' },
] as const;

const RULES = [
  { title: 'Max 2-3 per week', body: 'Har user ko week me max 2-3 notifications. Isse zyada -> notification fatigue -> uninstall.', good: true },
  { title: 'Never 11 PM - 10 AM', body: 'Raat 11 ke baad aur subah 10 se pehle bilkul nahi. Sleep disturb = permanent damage.', good: false },
  { title: 'Always use {name}', body: 'Har possible notification me user ka first name. Generic = ignored. 3x open rate uplift.', good: true },
  { title: 'Casual friend tone only', body: 'Corporate language banned. Bartender dost ki tarah baat karo.', good: true },
  { title: 'Scarcity must be real', body: '"Only 4 tables left" sirf tab kaho jab sach ho. Fake urgency = trust break = churn.', good: false },
  { title: 'A/B test every 4 weeks', body: '2 message versions, 50/50 split. Jo zyada click kare, wo use karo next month.', good: true },
  { title: 'Weather API integrate karo', body: 'Rain/heat-triggered auto-notifications. Real-time context = maximum relevance.', good: true },
  { title: 'Birthday data = mandatory', body: 'DOB field mandatory at signup. Birthday segment = highest ROI. Avg 3-5 friends brought.', good: true },
  { title: 'App-exclusive offers', body: 'Kuch deals sirf app users ke liye. Walk-in = nahi milega. Strongest retention reason.', good: true },
  { title: 'Never repeat same copy', body: 'Same message same user ko 2 baar nahi. Rotate copy every 4 weeks.', good: false },
  { title: 'Post-event follow-up', body: 'Event ke baad "see you next time" push bhejo agale din. +30% next-visit probability.', good: true },
  { title: 'Dormant flow strictly', body: 'Day 14 -> 21 -> 30 -> silence -> re-entry. Random spam mat karo.', good: false },
] as const;

const CHECKLIST = [
  { what: "User's first name (mandatory field)", why: '[Name] personalization - all segments use this', pri: 'crit' },
  { what: 'Date of birth (mandatory signup field)', why: 'Birthday Month segment - highest ROI segment', pri: 'crit' },
  { what: 'Last visit timestamp', why: 'Dormant user detection (14/21/30 day flow)', pri: 'crit' },
  { what: 'Total visit count (monthly)', why: 'Power Regular detection (4+ visits/month)', pri: 'crit' },
  { what: 'Order / drink history per user', why: 'Fav Item Lover detection + restock trigger', pri: 'crit' },
  { what: 'Notification send log (per user)', why: 'Anti-spam frequency capping - max 2-3/week', pri: 'crit' },
  { what: 'Visit day pattern (which days of week)', why: 'Weekend Warrior segment identification', pri: 'high' },
  { what: 'Group check-in size (avg)', why: 'Group Visitor segment - who comes in groups', pri: 'high' },
  { what: 'Weather API integration (city-level)', why: 'Rain/heat auto-triggered notifications', pri: 'high' },
  { what: 'A/B test user flag (50/50 split)', why: 'Message variant testing per campaign', pri: 'high' },
  { what: 'Event booking / RSVP data', why: 'Sold-out warning, table last call triggers', pri: 'high' },
  { what: 'Loyalty points balance', why: 'Gamification - streak, double points, tier unlock', pri: 'med' },
  { what: 'Win-back status flag', why: 'Track which win-back step user is currently on', pri: 'med' },
  { what: 'App install date', why: 'New Customer flow - Day 2/7/14/30 messages', pri: 'med' },
] as const;

type SegmentKey = (typeof SEGMENTS)[number]['key'];
type CategoryKey = (typeof CATEGORIES)[number];

function toApiSegment(segment: SegmentKey): string {
  if (segment === 'power') return 'PowerRegular';
  if (segment === 'dormant') return 'Dormant';
  if (segment === 'new') return 'NewCustomer';
  if (segment === 'bday') return 'BirthdayMonth';
  return 'All';
}

function toApiCategory(category: string): string {
  switch (category) {
    case 'humor':
      return 'Humor';
    case 'personal':
      return 'Personalized';
    case 'fomo':
      return 'FOMO';
    case 'event':
      return 'Event';
    case 'weather':
      return 'Weather';
    case 'game':
      return 'Gamification';
    case 'late':
      return 'LateNight';
    case 'vip':
      return 'VIP';
    default:
      return 'Personalized';
  }
}

export default function CampaignsPage() {
  const [barId, setBarId] = useState<number | null>(null);
  const [segment, setSegment] = useState<SegmentKey | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [counts, setCounts] = useState<SegmentCountsDto | null>(null);
  const [backendTemplates, setBackendTemplates] = useState<TemplateDto[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignListItemDto[]>([]);
  const [quotaSummary, setQuotaSummary] = useState<CampaignQuotaSummaryDto[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [campaignName, setCampaignName] = useState('Weekend Push');
  const [sendTime, setSendTime] = useState('');
  const [pushChecked, setPushChecked] = useState(true);
  const [whatsAppChecked, setWhatsAppChecked] = useState(true);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'winback' | 'rules'>('campaigns');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => setBarId(getActiveBarId()), []);

  useEffect(() => {
    if (barId == null) return;
    void reload(barId);
  }, [barId]);

  async function reload(id: number) {
    try {
      const [segmentCounts, templates, recent] = await Promise.all([
        getCampaignSegmentCounts(id),
        listCampaignTemplates(),
        listCampaigns(id, 10),
      ]);
      setCounts(segmentCounts);
      setBackendTemplates(templates);
      setCampaigns(recent);
      if (recent.length > 0) {
        const summary = await getCampaignQuotaSummary(id, String(recent[0].id));
        setQuotaSummary(summary);
      } else {
        setQuotaSummary([]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load campaigns');
    }
  }

  const mergedTemplates = useMemo(() => {
    const backendByCode = new Map(backendTemplates.map((tpl) => [tpl.code, tpl]));
    const items = TEMPLATES.map((tpl) => ({
      ...tpl,
      backend: backendByCode.get(
        tpl.cat === 'humor' ? 'humor_late_night' :
        tpl.cat === 'personal' ? 'personalized_comeback' :
        tpl.cat === 'fomo' ? 'fomo_busy' :
        tpl.cat === 'event' ? 'event_dj' :
        tpl.cat === 'weather' ? 'weather_rain' :
        tpl.cat === 'game' ? 'game_streak' :
        tpl.cat === 'late' ? 'late_night' :
        'vip_touch',
      ),
    }));
    return items.filter((tpl) => categoryFilter === 'all' || tpl.cat === categoryFilter);
  }, [backendTemplates, categoryFilter]);

  const preview = body.replaceAll('{name}', 'Rahul').replaceAll('{bottle}', 'your bottle').replaceAll('{remaining}', '120ml');
  const selectedCount = counts
    ? segment === 'power'
      ? counts.powerRegular
      : segment === 'dormant'
        ? counts.dormant
        : segment === 'new'
          ? counts.newCustomer
          : segment === 'bday'
            ? counts.birthdayMonth
            : counts.all
    : 0;

  function selectTemplate(id: number) {
    setSelectedTemplateId(id);
    const tpl = mergedTemplates.find((item) => item.id === id);
    if (!tpl) return;
    setSubject(tpl.backend?.subject ?? `Campaign ${tpl.id}`);
    setBody(tpl.text);
    setSendTime(tpl.time);
  }

  function canSend() {
    return Boolean(segment && body.trim() && (pushChecked || whatsAppChecked));
  }

  async function handleSend() {
    if (!barId || !segment) return;
    setError('');
    try {
      const channels = [pushChecked ? 'Push' : null, whatsAppChecked ? 'WhatsApp' : null].filter(Boolean).join(',');
      const category = categoryFilter === 'all' ? mergedTemplates.find((tpl) => tpl.id === selectedTemplateId)?.cat ?? 'personal' : categoryFilter;
      const created = await createCampaign(barId, {
        name: campaignName,
        segment: toApiSegment(segment),
        category: toApiCategory(category),
        templateCode: mergedTemplates.find((tpl) => tpl.id === selectedTemplateId)?.backend?.code ?? null,
        subject: subject || 'Campaign message',
        body,
        channels,
        scheduledAt: scheduleMode === 'schedule' && /^\d{4}-\d{2}-\d{2}T/.test(sendTime) ? new Date(sendTime).toISOString() : null,
      });
      if (scheduleMode === 'now') {
        await sendCampaign(barId, String(created.id));
      }
      setMessage('Campaign saved and queued.');
      setConfirmOpen(false);
      await reload(barId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send campaign');
    }
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 p-6 text-white shadow-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-300">SipSave Campaigns</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Smart notification builder</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Build segmented campaigns, preview personalized copy, and send through the connected campaign API. The UI mirrors your reference flow and the buttons are wired to real data.
        </p>
      </div>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <div className="flex gap-1 border-b border-slate-200">
        {[
          ['campaigns', 'Campaign builder'],
          ['winback', 'Win-back flow'],
          ['rules', 'Rules & checklist'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`border-b-2 px-4 py-2 text-sm transition ${activeTab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'campaigns' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Target audience for this bar</div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {SEGMENTS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setSegment(item.key)}
                    className={`rounded-2xl border p-4 text-left transition ${segment === item.key ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <div className="text-xs uppercase tracking-wider text-slate-500">{item.icon}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.desc}</div>
                    <div className="mt-3 text-2xl font-bold tabular-nums text-slate-900">
                      {counts ? (item.key === 'power' ? counts.powerRegular : item.key === 'dormant' ? counts.dormant : item.key === 'new' ? counts.newCustomer : item.key === 'bday' ? counts.birthdayMonth : counts.all) : '...'}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notification category</div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((item) => (
                  <button
                    key={item}
                    onClick={() => setCategoryFilter(item)}
                    className={`rounded-full px-4 py-2 text-sm transition ${categoryFilter === item ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {CATEGORY_LABELS[item]}
                  </button>
                ))}
              </div>

              <div className="mt-6 mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Choose a template</div>
              <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {mergedTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => selectTemplate(tpl.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${selectedTemplateId === tpl.id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <div className="text-xs uppercase tracking-wider text-slate-500">{CATEGORY_LABELS[tpl.cat]}</div>
                    <div className="mt-1 font-semibold text-slate-900">{tpl.backend?.subject ?? 'Suggested subject'}</div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{tpl.text}</p>
                    <div className="mt-2 text-xs text-slate-500">{tpl.time}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recent campaigns</div>
              {campaigns.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No campaigns sent yet</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-2">Name</th>
                        <th>Segment</th>
                        <th>Recipients</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c) => (
                        <tr key={c.id} className="border-t border-slate-100">
                          <td className="py-2 font-medium text-slate-900">{c.name}</td>
                          <td>{c.segment}</td>
                          <td>{c.totalRecipients}</td>
                          <td>{c.status}</td>
                          <td>{new Date(c.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Latest quota summary</div>
              {quotaSummary.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No quota data yet</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-2">User</th>
                        <th>Sent</th>
                        <th>Remaining</th>
                        <th>Limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotaSummary.map((row) => (
                        <tr key={row.userId} className="border-t border-slate-100">
                          <td className="py-2 font-medium text-slate-900">{row.fullName ?? `User ${row.userId}`}</td>
                          <td>{row.sentCount}</td>
                          <td>{row.remainingCount}</td>
                          <td>{row.limitCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Compose message</div>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">Campaign name</span>
                <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="w-full rounded-xl border-slate-300" />
              </label>
              <label className="mt-4 block text-sm">
                <span className="mb-1 block text-slate-600">Subject</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border-slate-300" />
              </label>
              <label className="mt-4 block text-sm">
                <span className="mb-1 block text-slate-600">Body - use {`{name}, {bottle}, {remaining}`}</span>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="w-full rounded-xl border-slate-300 font-mono" />
              </label>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm">
                <div className="font-medium text-slate-600">Preview</div>
                <p className="mt-2 whitespace-pre-wrap text-slate-800">{preview || 'Your preview will appear here.'}</p>
              </div>
              <label className="mt-4 block text-sm">
                <span className="mb-1 block text-slate-600">Best send time</span>
                <input value={sendTime} onChange={(e) => setSendTime(e.target.value)} className="w-full rounded-xl border-slate-300" placeholder="e.g. Friday 5 PM" />
              </label>
              <div className="mt-4">
                <div className="mb-2 text-sm font-medium text-slate-700">Channels</div>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={pushChecked} onChange={(e) => setPushChecked(e.target.checked)} />
                    Push
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={whatsAppChecked} onChange={(e) => setWhatsAppChecked(e.target.checked)} />
                    WhatsApp
                  </label>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setScheduleMode('now')} className={`flex-1 rounded-xl border px-3 py-2 ${scheduleMode === 'now' ? 'bg-slate-900 text-white' : 'bg-white'}`}>Send now</button>
                <button onClick={() => setScheduleMode('schedule')} className={`flex-1 rounded-xl border px-3 py-2 ${scheduleMode === 'schedule' ? 'bg-slate-900 text-white' : 'bg-white'}`}>Schedule</button>
              </div>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={!canSend()}
                className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white disabled:bg-slate-300"
              >
                Review send to {selectedCount} users
              </button>
              {!segment && <p className="mt-2 text-xs text-rose-600">Select a segment to enable send.</p>}
              {segment && !body.trim() && <p className="mt-2 text-xs text-rose-600">Pick a template or write a message to continue.</p>}
            </section>
          </aside>
        </div>
      )}

      {activeTab === 'winback' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Dormant user win-back flow</div>
            <p className="mb-6 text-sm text-slate-600">User 3+ weeks se nahi aaya? This structured flow recovers them without spamming.</p>
            <div className="space-y-0">
              {WIN_BACK.map((step, index) => (
                <div key={step.days} className="grid grid-cols-[32px_1fr] gap-x-3">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold ${step.cls === 'pause' ? 'bg-amber-100' : step.cls === 'stop' ? 'bg-rose-100' : ''}`}>{step.step}</div>
                    {index < WIN_BACK.length - 1 && <div className="my-1 min-h-6 w-px bg-slate-200" />}
                  </div>
                  <div className="pb-5">
                    <div className="font-medium text-slate-900">{step.days} - {step.type}</div>
                    <div className="mt-1 text-sm text-slate-600">{step.why}</div>
                    <div className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm italic text-slate-700">"{step.msg}"</div>
                    <div className="mt-2 inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">{step.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Flow rules</div>
              <div className="space-y-3 text-sm">
                {[
                  'Max 1 notification/week during win-back',
                  'Always personalize with {name}',
                  'Never offer discount on Day 14 - curiosity only',
                  'No sends during Day 31-44 silence window',
                  'Day 60+ -> mark as churned, stop flow',
                ].map((rule, idx) => (
                  <div key={rule} className="flex items-start gap-2 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                    <span className={idx === 2 || idx === 3 ? 'text-rose-600' : idx === 4 ? 'text-amber-600' : 'text-emerald-600'}>•</span>
                    <span className="text-slate-700">{rule}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Required data</div>
              <div className="space-y-3 text-sm text-slate-700">
                {['Last visit timestamp', 'User first name', 'Visit history count', 'Win-back step flag (current step)', 'Notification send log (anti-spam)'].map((item) => (
                  <div key={item} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">{item}</div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Golden rules</div>
            <div className="grid gap-3 md:grid-cols-2">
              {RULES.map((rule) => (
                <div key={rule.title} className={`rounded-2xl border p-4 ${rule.good ? 'border-emerald-200' : 'border-rose-200'}`}>
                  <div className="font-medium text-slate-900">{rule.title}</div>
                  <div className="mt-1 text-sm text-slate-600">{rule.body}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Backend implementation checklist</div>
            <div className="space-y-3">
              {CHECKLIST.map((item) => (
                <div key={item.what} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                  <div>
                    <div className="font-medium text-slate-900">{item.what}</div>
                    <div className="mt-1 text-sm text-slate-600">{item.why}</div>
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${item.pri === 'crit' ? 'bg-rose-100 text-rose-700' : item.pri === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                    {item.pri === 'crit' ? 'Critical' : item.pri === 'high' ? 'High' : 'Medium'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Confirm send</h3>
            <p className="mt-2 text-sm text-slate-600">
              You are about to send to {selectedCount} users via {pushChecked && whatsAppChecked ? 'Push + WhatsApp' : pushChecked ? 'Push' : 'WhatsApp'}.
              {scheduleMode === 'schedule' ? ' This will be scheduled.' : ' This will send immediately.'}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmOpen(false)} className="rounded-xl border px-4 py-2">Cancel</button>
              <button onClick={handleSend} className="rounded-xl bg-slate-900 px-4 py-2 text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
