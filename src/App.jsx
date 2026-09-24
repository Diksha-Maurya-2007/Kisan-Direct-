import { Component, useEffect, useRef, useState } from 'react';
import { languages, t, cropName, quantityText, priceText, personName, locationName } from './i18n.js';
import { DEMO_OTP, uploadCropImage, saveListingToSupabase, fetchListingsFromSupabase, deleteListingFromSupabase, isSupabaseConfigured } from './services/supabase.js';
import { assessCropQuality } from './services/aiQualityAssessment.js';
import { fetchLiveMandiPrices } from './services/mandiPrices.js';
import Leaflet from 'leaflet';

// Fix Leaflet default marker icons (broken by Vite's asset handling)
delete Leaflet.Icon.Default.prototype._getIconUrl;
Leaflet.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const LOGO = '/assets/kisan-direct-logo.png';

// Each buyer match is an individual farm with enough stock for the requested
// quantity. Smaller lots are intentionally never combined to fulfil a match.
const F = [
  ['Rajesh Singh', 'Lucknow', 400, 26, 'Grade A'],
  ['Meena Devi', 'Kanpur', 350, 25, 'Grade A'],
  ['Harpreet Kaur', 'Barabanki', 500, 24, 'Grade A'],
  ['Vikram Patel', 'Unnao', 320, 22, 'Grade B'],
  ['Nisha Verma', 'Sitapur', 300, 21, 'Grade B'],
];
const FARMER_DETAILS = {
  'Rajesh Singh': { phone:'+91 98765 21001', address:'Aliganj, Lucknow, Uttar Pradesh', category:'Vegetables', image:'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=80' },
  'Meena Devi': { phone:'+91 98765 21002', address:'Kalyanpur, Kanpur, Uttar Pradesh', category:'Vegetables', image:'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=80' },
  'Harpreet Kaur': { phone:'+91 98765 21003', address:'Nawabganj, Barabanki, Uttar Pradesh', category:'Vegetables', image:'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=80' },
  'Vikram Patel': { phone:'+91 98765 21004', address:'Safipur, Unnao, Uttar Pradesh', category:'Vegetables', image:'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=80' },
  'Nisha Verma': { phone:'+91 98765 21005', address:'Biswan, Sitapur, Uttar Pradesh', category:'Vegetables', image:'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=80' },
};

const DEMO_ORDERS = [
  { id: 'KD1024', buyer: 'ABC Foods Pvt. Ltd.', crop: 'Tomato', quantity: 100, price: 25, total: 2500, status: 'Pickup Scheduled', type: 'active' },
  { id: 'KD1031', buyer: 'Green Harvest Co.', crop: 'Wheat', quantity: 200, price: 24, total: 4800, status: 'Pending Confirmation', type: 'pending' },
  { id: 'KD1018', buyer: 'Fresh Basket', crop: 'Potato', quantity: 150, price: 20, total: 3000, status: 'Completed', type: 'completed' },
];

const DEFAULT_FARMER_PROFILE = {
  name: 'Ramesh Kumar',
  mobile: '+91 99999 00001',
  location: 'Barabanki, Uttar Pradesh',
  accountType: 'Farmer',
};

const DEFAULT_BUYER_PROFILE = {
  name: 'Anita Sharma',
  org: 'ABC Foods Pvt. Ltd.',
  mobile: '+91 99999 00002',
  location: 'Lucknow, Uttar Pradesh',
  accountType: 'Buyer',
};

const DEFAULT_LISTINGS = [
  {
    id: 'listing-tomato-1',
    cropName: 'Tomato',
    quantity: 100,
    price: 25,
    grade: 'Grade A',
    location: 'Barabanki, Uttar Pradesh',
    status: 'Active',
    availability: 'Available today',
    harvestDate: '2026-09-05',
    availableFrom: 'Today',
    image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'listing-wheat-1',
    cropName: 'Wheat',
    quantity: 200,
    price: 24,
    grade: 'Grade A',
    location: 'Barabanki, Uttar Pradesh',
    status: 'Active',
    availability: 'Ready for dispatch',
    harvestDate: '2026-09-03',
    availableFrom: 'Tomorrow',
    image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'listing-potato-1',
    cropName: 'Potato',
    quantity: 150,
    price: 20,
    grade: 'Grade A',
    location: 'Barabanki, Uttar Pradesh',
    status: 'Active',
    availability: 'Available this week',
    harvestDate: '2026-09-02',
    availableFrom: 'In 2 days',
    image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=900&q=80',
  },
];

const MANDI_SNAPSHOT = [
  { crop: 'Tomato', min: 20, max: 28, modal: 24 },
  { crop: 'Wheat', min: 21, max: 26, modal: 23 },
  { crop: 'Potato', min: 15, max: 20, modal: 18 },
  { crop: 'Onion', min: 18, max: 24, modal: 21 },
];

const B = ({ children, onClick, alt = false, type = 'button', className = '', disabled = false }) => (
  <button type={type} onClick={onClick} disabled={disabled} className={alt ? `btn alt ${className}` : `btn ${className}`.trim()}>
    {children}
  </button>
);

const Title = ({ tag, title, copy }) => (
  <div className="mb-7">
    <p className="tag">{tag}</p>
    <h1 className="title">{title}</h1>
    <p className="copy">{copy}</p>
  </div>
);

const Field = ({ label, value, onChange, name, type = 'text', required = false, placeholder = '' }) => (
  <label className="field">
    {label}
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
    />
  </label>
);

const getAssessmentForCrop = (cropName) => {
  const crop = String(cropName || 'Tomato').toLowerCase();

  if (crop.includes('tomato')) {
    return {
      crop: 'Tomato',
      grade: 'Grade A',
      confidence: '94%',
      score: '94%',
      checks: ['Good color', 'Fresh appearance', 'Low visible damage', 'Good overall quality'],
      recommendation: 'Suitable for bulk sale',
      imageHint: 'Fresh red harvest',
    };
  }

  if (crop.includes('wheat')) {
    return {
      crop: 'Wheat',
      grade: 'Grade A',
      confidence: '91%',
      score: '91%',
      checks: ['Clean grains', 'Consistent moisture level', 'Strong ear structure', 'Low foreign matter'],
      recommendation: 'Ready for milling delivery',
      imageHint: 'Well-filled grain lot',
    };
  }

  if (crop.includes('potato')) {
    return {
      crop: 'Potato',
      grade: 'Grade B+',
      confidence: '88%',
      score: '88%',
      checks: ['Uniform sizing', 'Healthy skin', 'Minimal cuts', 'Stable storage quality'],
      recommendation: 'Good for local wholesale',
      imageHint: 'Fresh tuber lot',
    };
  }

  return {
    crop: cropName || 'Crop',
    grade: 'Grade B',
    confidence: '86%',
    score: '86%',
    checks: ['Good field appearance', 'Acceptable size', 'Minor sorting advised', 'Needs quick dispatch'],
    recommendation: 'Suitable for short-term sale',
    imageHint: 'Fresh harvest sample',
  };
};

const resolveGrade = (cropName) => {
  const crop = String(cropName || '').toLowerCase();
  if (crop.includes('tomato')) return 'Grade A';
  if (crop.includes('wheat')) return 'Grade A';
  if (crop.includes('potato')) return 'Grade B+';
  return 'Grade B';
};

const WHEAT_IMAGE = 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=900&q=80';
const OLD_PLANT_IMAGE = 'photo-1501004318641-b39e6451bec6';

const loadStorage = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const filtered = parsed
        .filter((item) => item && item.id !== 'listing-onion-1' && item.id !== 'listing-mustard-1')
        .map((item) => {
          if (item && (item.cropName === 'Wheat' || item.id === 'listing-wheat-1' || String(item.image || '').includes(OLD_PLANT_IMAGE))) {
            if (String(item.image || '').includes(OLD_PLANT_IMAGE)) {
              return { ...item, image: WHEAT_IMAGE };
            }
          }
          return item;
        });

      if (Array.isArray(fallback)) {
        const existingIds = new Set(filtered.map((i) => i?.id));
        const merged = [...filtered];
        for (const def of fallback) {
          if (!existingIds.has(def.id)) {
            merged.push(def);
          }
        }
        return merged;
      }
      return filtered;
    }
    return parsed;
  } catch (error) {
    return fallback;
  }
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('App error boundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="welcome-screen">
          <div className="welcome-card" style={{ maxWidth: 520, textAlign: 'center' }}>
            <h1>Something went wrong, please reload.</h1>
            <button className="btn" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [role, setRole] = useState(() => localStorage.getItem('kd-role') || '');
  const [page, setPage] = useState('dashboard');
  const [lang, setLang] = useState(() => localStorage.getItem('kd-lang') || 'en');
  const [toast, setToast] = useState('');
  const [farmerProfile, setFarmerProfile] = useState(() => loadStorage('kd-farmer-profile', DEFAULT_FARMER_PROFILE));
  const [buyerProfile, setBuyerProfile] = useState(() => loadStorage('kd-buyer-profile', DEFAULT_BUYER_PROFILE));
  const [listings, setListings] = useState(() => loadStorage('kd-farmer-listings', DEFAULT_LISTINGS));
  const [editingListingId, setEditingListingId] = useState(null);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [buyerOrder, setBuyerOrder] = useState(null);

  const activeProfile = role === 'buyer' ? (buyerProfile || DEFAULT_BUYER_PROFILE) : (farmerProfile || DEFAULT_FARMER_PROFILE);
  const setActiveProfile = (updated) => {
    if (role === 'buyer') {
      setBuyerProfile(updated);
    } else {
      setFarmerProfile(updated);
    }
  };

  const safeListings = Array.isArray(listings) && listings.length ? listings : DEFAULT_LISTINGS;

  const tr = (key) => t(lang, key);
  tr.crop = (name) => cropName(lang, name);
  tr.quantity = (value) => quantityText(lang, value);
  tr.price = (value) => priceText(lang, value);
  tr.person = (name) => personName(lang, name);
  tr.location = (loc) => locationName(lang, loc);

  useEffect(() => {
    localStorage.setItem('kd-lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('kd-farmer-profile', JSON.stringify(farmerProfile));
  }, [farmerProfile]);

  useEffect(() => {
    localStorage.setItem('kd-buyer-profile', JSON.stringify(buyerProfile));
  }, [buyerProfile]);

  useEffect(() => {
    localStorage.setItem('kd-farmer-listings', JSON.stringify(listings));
  }, [listings]);

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchListingsFromSupabase().then(({ data }) => {
        if (data && data.length > 0) {
          setListings((current) => {
            const dataIds = new Set(data.map((d) => d.id));
            const baseList = Array.isArray(current) && current.length ? current : DEFAULT_LISTINGS;
            const remaining = baseList.filter((item) => !dataIds.has(item.id));
            return [...data, ...remaining];
          });
        }
      }).catch((e) => console.warn('Supabase fetch failed:', e));
    }
  }, []);

  const chooseLanguage = (nextLang) => {
    setLang(nextLang);
    localStorage.setItem('kd-lang', nextLang);
  };

  const chooseRole = (nextRole, newProfileData) => {
    localStorage.setItem('kd-role', nextRole);
    if (newProfileData) {
      if (nextRole === 'buyer') {
        setBuyerProfile(newProfileData);
        localStorage.setItem('kd-buyer-profile', JSON.stringify(newProfileData));
      } else {
        setFarmerProfile(newProfileData);
        localStorage.setItem('kd-farmer-profile', JSON.stringify(newProfileData));
      }
    }
    setRole(nextRole);
  };

  const note = (message) => {
    setToast(message);
    window.clearTimeout(note.timeoutId);
    note.timeoutId = window.setTimeout(() => setToast(''), 2500);
  };

  if (!role) {
    return <Welcome chooseRole={chooseRole} lang={lang} setLang={chooseLanguage} tr={tr} />;
  }

  const buyer = role === 'buyer';
  const nav = buyer
    ? [
        ['dashboard', '⌂', 'dashboard'],
        ['requirement', '＋', 'requirement'],
        ['orders', '▣', 'orders'],
        ['payments', '₹', 'payments'],
        ['tracking', '◫', 'tracking'],
        ['profile', '◉', 'profile'],
      ]
    : [
        ['dashboard', '⌂', 'dashboard'],
        ['listing', '＋', 'listProduce'],
        ['listings', '▣', 'myListings'],
        ['orders', '▣', 'orders'],
        ['mandi', '⌖', 'mandi'],
        ['transport', '↗', 'bookVehicle'],
        ['profile', '◉', 'profile'],
      ];

  const activeListings = Array.isArray(safeListings) ? safeListings : [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <img src={LOGO} alt="KisanDirect" className="brand-logo" />
        <span>{buyer ? tr('buyerPortal') : tr('farmerPortal')}</span>
        <div className="topbar-tools">
          <select className="top-language" value={lang} onChange={(e) => chooseLanguage(e.target.value)}>
            {languages.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <a href="tel:+916784957310">☎ {tr('call')}</a>
          <a className="wa" href="https://wa.me/916784957310">{tr('whatsapp')}</a>
        </div>
      </header>

      <div className="shell">
        <aside className="side-panel">
          <small>{tr(role === 'buyer' ? 'buyer' : 'farmer')} {tr('menu')}</small>
          <div className="nav-list">
            {nav.map(([itemKey, icon, translationKey]) => (
              <button
                key={itemKey}
                className={page === itemKey ? 'nav-btn active' : 'nav-btn'}
                onClick={() => {
                  setPage(itemKey);
                  if (itemKey !== 'listing') setEditingListingId(null);
                }}
              >
                <span>{icon}</span>
                {tr(translationKey)}
              </button>
            ))}
          </div>
          <button
            className="logout-btn"
            onClick={() => {
              localStorage.removeItem('kd-role');
              setRole('');
            }}
          >
            ← {tr('logout')}
          </button>
        </aside>

        <main className="content-panel">
          {page === 'dashboard' && (buyer ? <Dashboard buyer={buyer} go={setPage} tr={tr} listings={activeListings} profile={activeProfile} /> : <FarmerDashboard go={setPage} tr={tr} listings={activeListings} profile={activeProfile} />)}
          {page === 'listing' && (
            <ListingPage
              note={note}
              listings={activeListings}
              setListings={setListings}
              editingListingId={editingListingId}
              setEditingListingId={setEditingListingId}
              go={setPage}
              tr={tr}
            />
          )}
          {page === 'listings' && (<ListingsPage listings={activeListings} setListings={setListings} setPage={setPage} setEditingListingId={setEditingListingId} tr={tr} note={note} />)}
          {page === 'orders' && (buyer ? <Orders go={setPage} tr={tr} selectedFarmer={selectedFarmer} buyerOrder={buyerOrder} /> : <FarmerOrders tr={tr} />)}
          {page === 'mandi' && <MandiPage tr={tr} />}
          {page === 'requirement' && <Requirement go={setPage} tr={tr} />}
          {page === 'matches' && <Matches go={setPage} tr={tr} chooseFarmer={setSelectedFarmer} />}
          {page === 'farmer-listing' && <BuyerFarmerListing farmer={selectedFarmer} go={setPage} tr={tr} placeOrder={setBuyerOrder} />}
          {page === 'transport' && <Transport note={note} tr={tr} />}
          {page === 'payments' && <Payments note={note} tr={tr} />}
          {page === 'tracking' && <Tracking tr={tr} />}
          {page === 'profile' && <ProfilePage profile={activeProfile} setProfile={setActiveProfile} tr={tr} />}
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Shared Nominatim helpers
// ─────────────────────────────────────────────────────────
const NOM_HEADERS = { 'Accept-Language': 'en', 'User-Agent': 'KisanDirect-MVP/1.0' };

// Format Nominatim address — deduplicates repeated parts (e.g. "Lucknow, Lucknow")
const fmtNomAddress = (addr = {}) => {
  const parts = [
    addr.village || addr.town || addr.city_district || addr.city || addr.suburb,
    addr.county  || addr.district || addr.state_district,
    addr.state,
  ].filter(Boolean);
  // Remove consecutive duplicates (case-insensitive)
  const seen = new Set();
  return parts.filter(p => {
    const k = p.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).join(', ');
};

async function reverseGeocode(lat, lng) {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=10`,
      { headers: NOM_HEADERS }
    );
    const data = await res.json();
    return fmtNomAddress(data.address) || data.display_name || '';
  } catch { return ''; }
}

// ─────────────────────────────────────────────────────────
// MapModal — fullscreen Swiggy-style map picker
// ─────────────────────────────────────────────────────────
function MapModal({ initialAddress, onConfirm, onClose }) {
  const mapDivRef  = useRef(null);
  const mapRef     = useRef(null);
  const geocodeRef = useRef(null);
  const debRef     = useRef(null);

  const [address,     setAddress]     = useState(initialAddress || '');
  const [geocoding,   setGeocoding]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [gpsLoading,  setGpsLoading]  = useState(false);
  const [gpsError,    setGpsError]    = useState('');
  const [showSugg,    setShowSugg]    = useState(false);

  const INDIA      = [20.5937, 78.9629];
  const CITY_ZOOM  = 13;
  const INDIA_ZOOM = 5;

  // Init Leaflet map
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    const map = Leaflet.map(mapDivRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(INDIA, INDIA_ZOOM);

    Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Only reverse geocode when user has zoomed in to a meaningful level
    map.on('moveend', () => {
      const zoom = map.getZoom();
      if (zoom < 11) return;           // too zoomed out — skip
      const { lat, lng } = map.getCenter();
      clearTimeout(geocodeRef.current);
      setGeocoding(true);
      geocodeRef.current = setTimeout(async () => {
        const addr = await reverseGeocode(lat, lng);
        if (addr) setAddress(addr);
        setGeocoding(false);
      }, 400);
    });

    mapRef.current = map;
    return () => {
      clearTimeout(geocodeRef.current);
      clearTimeout(debRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // GPS: fly to user's location → moveend fires → geocodes
  const handleGPS = () => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported.'); return; }
    setGpsLoading(true); setGpsError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapRef.current?.setView([coords.latitude, coords.longitude], CITY_ZOOM);
        setGpsLoading(false);
      },
      () => { setGpsError('Location access denied. Search manually.'); setGpsLoading(false); },
      { timeout: 12000 }
    );
  };

  // Search (debounced)
  const handleSearch = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    clearTimeout(debRef.current);
    if (val.length < 3) { setSuggestions([]); setShowSugg(false); return; }
    debRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&countrycodes=in&limit=6&addressdetails=1`,
          { headers: NOM_HEADERS }
        );
        const data = await res.json();
        setSuggestions(data);
        setShowSugg(data.length > 0);
      } catch { setSuggestions([]); }
      finally   { setSearching(false); }
    }, 400);
  };

  // BUG FIX: Set address DIRECTLY from suggestion data, then also fly map there
  // (Don't rely on moveend reverse geocode which returned wrong village names)
  const selectSuggestion = (item) => {
    const addr = fmtNomAddress(item.address) || item.display_name;
    setAddress(addr);                  // ← set correct address immediately
    setSearchQuery('');
    setSuggestions([]);
    setShowSugg(false);
    mapRef.current?.setView([parseFloat(item.lat), parseFloat(item.lon)], CITY_ZOOM);
  };

  return (
    <div className="map-overlay" role="dialog" aria-modal="true">
      <div className="map-modal">

        {/* ── Header: search + close ── */}
        <div className="map-header">
          <div className="map-search-row">
            <span className="map-search-ico">🔍</span>
            <input
              type="text"
              className="map-search-input"
              placeholder="Search for city, area, village…"
              value={searchQuery}
              onChange={handleSearch}
              autoComplete="off"
            />
            {searching && <span className="map-search-spin" />}
          </div>
          <button className="map-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Search suggestions — IN FLOW (not absolutely positioned)
            so they NEVER cover or hide the search input above */}
        {showSugg && suggestions.length > 0 && (
          <ul className="map-suggestions">
            {suggestions.map((item) => (
              <li key={item.place_id} onMouseDown={() => selectSuggestion(item)}>
                <span>📌</span>
                <span>{fmtNomAddress(item.address) || item.display_name}</span>
              </li>
            ))}
          </ul>
        )}

        {/* ── Map with fixed center pin (Swiggy-style) ── */}
        <div className="map-area-wrap">
          <div ref={mapDivRef} className="map-area" />
          <div className="map-center-pin" aria-hidden="true">
            <div className="map-pin-icon">📍</div>
            <div className="map-pin-dot" />
          </div>
          {/* Zoom-in hint shown when map is too zoomed out */}
          <div className="map-zoom-hint">
            Zoom in to pick a precise location
          </div>
        </div>

        {/* ── Bottom panel ── */}
        <div className="map-bottom">
          <button
            type="button"
            className="map-gps-btn"
            onClick={handleGPS}
            disabled={gpsLoading}
          >
            {gpsLoading
              ? <><span className="spinner spinner-sm" /> Detecting…</>
              : <>🎯 Use my current location</>}
          </button>
          {gpsError && <p className="map-gps-err">⚠ {gpsError}</p>}

          <div className="map-addr-box">
            <span className="map-addr-label">Selected Location</span>
            <p className="map-addr-text">
              {geocoding
                ? <em>Fetching address…</em>
                : address
                  ? <><strong>📌</strong> {address}</>
                  : <em>Search above or use GPS to pick location</em>}
            </p>
          </div>

          <button
            type="button"
            className="btn map-confirm-btn"
            onClick={() => { if (address && !geocoding) onConfirm(address); }}
            disabled={!address || geocoding}
          >
            Confirm Location →
          </button>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────
// LocationPicker — trigger button + MapModal
// ─────────────────────────────────────────────────────────
function LocationPicker({ value, onChange, placeholder = 'Set your location…' }) {
  const [address,   setAddress]   = useState(value || '');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => { setAddress(value || ''); }, [value]);

  const handleConfirm = (addr) => {
    setAddress(addr);
    onChange(addr);
    setModalOpen(false);
  };

  return (
    <div className="location-picker">
      <div className="loc-display-row" onClick={() => setModalOpen(true)}>
        <div className="loc-display-addr">
          {address
            ? <><span>📌</span> {address}</>
            : <span className="loc-placeholder">{placeholder}</span>}
        </div>
        <button
          type="button"
          className="loc-open-btn"
          onClick={(e) => {
            e.stopPropagation();
            setModalOpen(true);
          }}
        >
          🗺️ Set on Map
        </button>
      </div>

      {modalOpen && (
        <MapModal
          initialAddress={address}
          onConfirm={handleConfirm}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Demo credentials shown on the login banner
// ─────────────────────────────────────────────
const DEMO_ACCOUNTS = {
  farmer: { phone: '9999900001', label: 'Demo Farmer', name: 'Ramesh Kumar', location: 'Barabanki, Uttar Pradesh' },
  buyer:  { phone: '9999900002', label: 'Demo Buyer',  name: 'ABC Foods Pvt. Ltd.', location: 'Lucknow, Uttar Pradesh' },
};

function Welcome({ chooseRole, lang, setLang, tr }) {
  // step: 'role' | 'phone' | 'otp' | 'profile'
  const [step, setStep]           = useState('role');
  const [loginRole, setLoginRole] = useState('');
  const [phone, setPhone]         = useState('');
  const [otp, setOtp]             = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [profileForm, setProfileForm] = useState({ name: '', location: '', org: '' });
  const [profileError, setProfileError] = useState('');
  const timerRef = useRef(null);

  // 60-second resend countdown
  const startCountdown = () => {
    setCountdown(60);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const goToRole = (roleChoice) => {
    setLoginRole(roleChoice);
    setPhone('');
    setOtp('');
    setError('');
    setStep('phone');
  };

  const useDemo = () => {
    const demo = DEMO_ACCOUNTS[loginRole];
    if (demo) { setPhone(demo.phone); setError(''); }
  };

  const validatePhone = (val) => /^[6-9]\d{9}$/.test(val.replace(/\s/g, ''));

  const handleSendOtp = () => {
    setError('');
    if (!validatePhone(phone)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setOtp('');
      startCountdown();
      setStep('otp');
    }, 600);
  };

  const handleVerifyOtp = () => {
    setError('');
    if (otp.length < 4) {
      setError('Please enter the OTP sent to your number.');
      return;
    }
    if (otp !== DEMO_OTP) {
      setError(`Incorrect OTP. Hint: the demo OTP is ${DEMO_OTP}.`);
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setProfileForm({
        name: loginRole === 'farmer' ? 'Ramesh Kumar' : 'Anita Sharma',
        location: loginRole === 'farmer' ? 'Barabanki, Uttar Pradesh' : 'Lucknow, Uttar Pradesh',
        org: loginRole === 'buyer' ? 'ABC Foods Pvt. Ltd.' : '',
      });
      setProfileError('');
      setStep('profile');
    }, 500);
  };

  const handleResend = () => {
    if (countdown > 0) return;
    setOtp('');
    setError('');
    startCountdown();
  };

  const handleProfileSubmit = () => {
    setProfileError('');
    if (!profileForm.name.trim() || !profileForm.location.trim()) {
      setProfileError('Please fill in all required fields.');
      return;
    }
    if (loginRole === 'buyer' && !profileForm.org.trim()) {
      setProfileError('Please enter your organisation name.');
      return;
    }
    const roleData = {
      name: profileForm.name.trim(),
      location: profileForm.location.trim(),
      org: loginRole === 'buyer' ? profileForm.org.trim() : '',
      mobile: phone ? `+91 ${phone}` : (loginRole === 'farmer' ? '+91 99999 00001' : '+91 99999 00002'),
      accountType: loginRole === 'buyer' ? 'Buyer' : 'Farmer',
    };
    chooseRole(loginRole, roleData);
  };

  // ─── Shared topbar ────────────────────────────────────────────
  const Topbar = (
    <header className="topbar compact">
      <img src={LOGO} alt="KisanDirect" className="brand-logo" />
      <div className="topbar-tools">
        <a href="tel:+916784957310">☎ {tr('call')}</a>
        <a className="wa" href="https://wa.me/916784957310">{tr('whatsapp')}</a>
      </div>
    </header>
  );

  // ─── Demo banner — only shows the CURRENT role's demo account ─
  const DemoBanner = loginRole ? (
    <div className="demo-banner">
      <p className="demo-banner-title">🎯 Demo Credentials</p>
      <p className="demo-banner-sub">Use this to explore — OTP is <strong>{DEMO_OTP}</strong></p>
      <div className="demo-rows">
        <div className="demo-row demo-row-active">
          <span className="demo-icon">{loginRole === 'farmer' ? '👨‍🌾' : '🏪'}</span>
          <div className="demo-info">
            <strong>{DEMO_ACCOUNTS[loginRole].label}</strong>
            <span>+91 {DEMO_ACCOUNTS[loginRole].phone}</span>
          </div>
          <button type="button" className="demo-use-btn" onClick={useDemo}>
            Use Demo
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ─── STEP: ROLE SELECTION ──────────────────────────────────────
  if (step === 'role') {
    return (
      <div className="welcome-screen">
        {Topbar}
        <section className="welcome-card">
          <h1>{tr('tagline')}</h1>
          <label className="field lang-picker">
            {tr('chooseLanguage')}
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              {languages.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
          <h2>{tr('continueAs')}</h2>
          <div className="roles-grid">
            <button className="role-btn" onClick={() => goToRole('farmer')}>
              <b>👨‍🌾<br />{tr('farmer')} {tr('login')}</b>
              <span>{tr('farmerCopy')}</span>
              {tr('enterFarmer')}
            </button>
            <button className="role-btn" onClick={() => goToRole('buyer')}>
              <b>🏪<br />{tr('bulkBuyer')} {tr('login')}</b>
              <span>{tr('buyerCopy')}</span>
              {tr('enterBuyer')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ─── STEP: PHONE ENTRY ─────────────────────────────────────────
  if (step === 'phone') {
    return (
      <div className="welcome-screen">
        {Topbar}
        <section className="login-card">
          <button className="back-btn" onClick={() => setStep('role')}>{tr('back')}</button>
          <p className="tag">{loginRole === 'farmer' ? tr('farmerPortal') : tr('buyerPortal')}</p>
          <h1>{loginRole === 'farmer' ? 'Farmer Login' : 'Buyer Login'}</h1>
          <p className="copy">Enter your mobile number to receive a one-time password.</p>

          {DemoBanner}

          <div className="phone-field-wrap">
            <label className="field" style={{ marginTop: 20 }}>
              Mobile Number
              <div className="phone-input-row">
                <span className="phone-prefix">🇮🇳 +91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setError(''); }}
                  className="phone-number-input"
                />
              </div>
            </label>
          </div>

          {error && <div className="auth-error">⚠ {error}</div>}

          <button
            type="button"
            className="btn send-otp-btn"
            onClick={handleSendOtp}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Sending…' : 'Send OTP →'}
          </button>
        </section>
      </div>
    );
  }

  // ─── STEP: OTP VERIFICATION ────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="welcome-screen">
        {Topbar}
        <section className="login-card">
          <button className="back-btn" onClick={() => { setStep('phone'); setOtp(''); setError(''); }}>{tr('back')}</button>
          <p className="tag">{loginRole === 'farmer' ? tr('farmerPortal') : tr('buyerPortal')}</p>
          <h1>Verify OTP</h1>
          <p className="copy">OTP sent to <strong>+91 {phone}</strong></p>

          <div className="otp-hint-box">
            🔐 Demo OTP: <strong>{DEMO_OTP}</strong> &nbsp;·&nbsp; Works for all numbers
          </div>

          <div className="otp-input-wrap">
            <label className="field" style={{ alignItems: 'center' }}>
              Enter OTP
              <input
                type="tel"
                inputMode="numeric"
                maxLength={6}
                placeholder="- - - -"
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
                className="otp-input"
              />
            </label>
          </div>

          {error && <div className="auth-error">⚠ {error}</div>}

          <button
            type="button"
            className="btn send-otp-btn"
            onClick={handleVerifyOtp}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Verifying…' : 'Verify & Continue →'}
          </button>

          <div className="resend-row">
            {countdown > 0
              ? <span>Resend OTP in <strong>{countdown}s</strong></span>
              : (
                <button type="button" className="resend-btn" onClick={handleResend}>
                  Didn't receive? Resend OTP
                </button>
              )
            }
          </div>
        </section>
      </div>
    );
  }

  // ─── STEP: PROFILE INFO ────────────────────────────────────────
  return (
    <div className="welcome-screen">
      {Topbar}
      <section className="login-card">
        <button className="back-btn" onClick={() => { setStep('otp'); setProfileError(''); }}>{tr('back')}</button>
        <p className="tag">{loginRole === 'farmer' ? tr('farmerPortal') : tr('buyerPortal')}</p>
        <h1>Your Details</h1>
        <p className="copy">
          {loginRole === 'farmer'
            ? 'Tell us about yourself so buyers can find you.'
            : 'Tell us about your organisation so farmers can reach you.'}
        </p>

        <div className="profile-form-grid">
          {loginRole === 'buyer' && (
            <label className="field">
              Organisation / Company Name <span className="required-star">*</span>
              <input
                type="text"
                placeholder="e.g. ABC Foods Pvt. Ltd."
                value={profileForm.org}
                onChange={(e) => setProfileForm({ ...profileForm, org: e.target.value })}
              />
            </label>
          )}
          <label className="field">
            {loginRole === 'farmer' ? 'Your Name' : 'Contact Person Name'} <span className="required-star">*</span>
            <input
              type="text"
              placeholder={loginRole === 'farmer' ? 'e.g. Ramesh Kumar' : 'e.g. Anita Sharma'}
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            />
          </label>
          <label className="field">
            Location <span className="required-star">*</span>
            <LocationPicker
              value={profileForm.location}
              onChange={(val) => setProfileForm({ ...profileForm, location: val })}
              placeholder={loginRole === 'farmer' ? 'e.g. Barabanki, Uttar Pradesh' : 'e.g. Lucknow, Uttar Pradesh'}
            />
          </label>
        </div>

        {profileError && <div className="auth-error">⚠ {profileError}</div>}

        <button
          type="button"
          className="btn send-otp-btn"
          onClick={handleProfileSubmit}
        >
          Continue to Dashboard →
        </button>
      </section>
    </div>
  );
}


function FarmerDashboard({ go, tr, listings = [], profile }) {
  const safeListings = Array.isArray(listings) ? listings : [];
  const activeCount = safeListings.filter((item) => String(item?.status || '').toLowerCase() === 'active').length;
  const cards = [
    [tr('totalActiveListings'), String(activeCount).padStart(2, '0'), tr('acrossHarvests')],
    [tr('pendingOrders'), '02', tr('pickupScheduling')],
    [tr('completedOrders'), '01', tr('lastThirtyDays')],
    [tr('estimatedEarnings'), '₹6,600', tr('projectedValue')],
  ];

  const actions = [
    { label: tr('listProduce'), handler: () => go('listing') },
    { label: tr('myListings'), handler: () => go('listings') },
    { label: tr('orders'), handler: () => go('orders') },
    { label: tr('mandi'), handler: () => go('mandi') },
  ];

  const recentListings = safeListings.slice(0, 3);
  const marketSnapshot = [
    { crop: 'Tomato', price: 24 },
    { crop: 'Wheat', price: 23 },
    { crop: 'Potato', price: 18 },
  ];

  const displayName = profile?.name || 'Ramesh Kumar';

  return (
    <>
      <Title tag={tr('farmerDashboard')} title={`${tr('welcomeBack')}, ${displayName}`} copy={tr('dashboardOverview')} />

      <div className="stats-grid">
        {cards.map(([title, value, meta]) => (
          <article key={title} className="stat-card">
            <small>{title}</small>
            <b>{value}</b>
            <em>{meta}</em>
          </article>
        ))}
      </div>

      <article className="highlight-card">
        <div>
          <p className="tag">{tr('sellDirectly')}</p>
          <h2>{tr('listFreshHarvest')}</h2>
          <p>{tr('qualityAssessmentCopy')}</p>
        </div>
        <B onClick={() => go('listing')}>{tr('listProduce')} →</B>
      </article>

      <div className="dashboard-grid">
        <section className="panel-card">
          <div className="section-head">
            <h3>{tr('quickActions')}</h3>
          </div>
          <div className="quick-actions">
            {actions.map((action) => (
              <button key={action.label} className="action-btn" onClick={action.handler}>{action.label}</button>
            ))}
          </div>
        </section>

        <section className="panel-card">
          <div className="section-head">
            <h3>{tr('recentListings')}</h3>
          </div>
          <div className="mini-list">
            {recentListings.length ? recentListings.map((listing) => (
              <div key={listing?.id || listing?.cropName || Math.random()} className="mini-item">
                <img src={listing?.image || WHEAT_IMAGE} alt={listing?.cropName || 'Crop'} />
                <div>
                  <strong>{tr.crop(listing?.cropName || 'Crop')}</strong>
                  <span>{tr.quantity(listing?.quantity || 0)} · {tr.price(listing?.price || 0)}</span>
                </div>
              </div>
            )) : <p className="copy">{tr('noListingsYet')}</p>}
          </div>
        </section>

        <section className="panel-card wide-panel">
          <div className="section-head">
            <h3>{tr('marketSnapshot')}</h3>
          </div>
          <div className="snapshot-list">
            {marketSnapshot.map((item) => (
              <div key={item.crop} className="snapshot-item">
                <span>{tr.crop(item.crop)}</span>
                <b>{tr.price(item.price)}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Dashboard({ buyer, go, tr, listings = [], profile }) {
  const safeListings = Array.isArray(listings) ? listings : [];
  const cards = buyer
    ? [
        [tr('activeRequirements'), '01', `${tr.crop('Tomato')} · ${tr.quantity(300)}`],
        [tr('matchedSupply'), tr.quantity(300), tr('requirementFulfilled')],
        [tr('orders'), '01', `${tr('order')} #KD1024`],
        [tr('advancePayment'), '₹2,250', tr('received')],
      ]
    : [
        [tr('totalActiveListings'), String(safeListings.filter((item) => String(item?.status || '').toLowerCase() === 'active').length).padStart(2, '0'), tr('acrossHarvests')],
        [tr('pendingOrders'), '02', tr('pickupScheduling')],
        [tr('completedOrders'), '01', tr('lastThirtyDays')],
        [tr('estimatedEarnings'), '₹6,600', tr('projectedValue')],
      ];

  const actions = buyer
    ? [{ label: tr('requirement'), handler: () => go('requirement') }, { label: tr('orders'), handler: () => go('orders') }, { label: tr('transport'), handler: () => go('transport') }, { label: tr('payments'), handler: () => go('payments') }]
    : [{ label: tr('listProduce'), handler: () => go('listing') }, { label: tr('myListings'), handler: () => go('listings') }, { label: tr('orders'), handler: () => go('orders') }, { label: tr('mandi'), handler: () => go('mandi') }];

  const displayName = buyer
    ? (profile?.org || profile?.name || 'ABC Foods Pvt. Ltd.')
    : (profile?.name || 'Ramesh Kumar');

  return (
    <>
      <Title tag={buyer ? tr('buyerDashboard') : tr('farmerDashboard')} title={`${tr('welcomeBack')}, ${displayName}`} copy={tr('dashboardOverview')} />

      <div className="stats-grid">
        {cards.map(([title, value, meta]) => (
          <article key={title} className="stat-card">
            <small>{title}</small>
            <b>{value}</b>
            <em>{meta}</em>
          </article>
        ))}
      </div>

      <article className="highlight-card">
        <div>
          <p className="tag">{buyer ? tr('requirement') : tr('sellDirectly')}</p>
          <h2>{buyer ? tr('findFarmerForRequirement') : tr('listFreshHarvest')}</h2>
          <p>{buyer ? tr('individualFarmerOrderCopy') : tr('qualityAssessmentCopy')}</p>
        </div>
        <B onClick={() => go(buyer ? 'requirement' : 'listing')}>{buyer ? tr('createRequirement') : tr('listProduce')} →</B>
      </article>

      {!buyer && (
        <div className="dashboard-grid">
          <section className="panel-card">
            <div className="section-head">
              <h3>{tr('quickActions')}</h3>
            </div>
            <div className="quick-actions">
              {actions.map((action) => (
                <button key={action.label} className="action-btn" onClick={action.handler}>{action.label}</button>
              ))}
            </div>
          </section>

          <section className="panel-card">
            <div className="section-head">
              <h3>{tr('recentListings')}</h3>
            </div>
            <div className="mini-list">
              {recentListings.map((listing) => (
                <div key={listing.id} className="mini-item">
                  <img src={listing.image} alt={listing.cropName} />
                  <div>
                    <strong>{tr.crop(listing.cropName)}</strong>
                    <span>{tr.quantity(listing.quantity)} · {tr.price(listing.price)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-card wide-panel">
            <div className="section-head">
              <h3>{tr('marketSnapshot')}</h3>
            </div>
            <div className="snapshot-list">
              {marketSnapshot.map((item) => (
                <div key={item.crop} className="snapshot-item">
                  <span>{tr.crop(item.crop)}</span>
                  <b>{tr.price(item.price)}</b>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ListingPage({ note, listings, setListings, editingListingId, setEditingListingId, go, tr }) {
  const editingListing = Array.isArray(listings) ? listings.find((item) => item?.id === editingListingId) || null : null;
  const emptyForm = {
    cropName: '',
    quantity: '',
    price: '',
    location: '',
    harvestDate: '',
    availableFrom: '',
    image: '',
  };

  const [form, setForm] = useState(() => (editingListing ? {
    cropName: editingListing.cropName || '',
    quantity: String(editingListing.quantity ?? ''),
    price: String(editingListing.price ?? ''),
    location: editingListing.location || '',
    harvestDate: editingListing.harvestDate || '',
    availableFrom: editingListing.availableFrom || '',
    image: editingListing.image || '',
  } : emptyForm));

  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('');
  const [cameraShot, setCameraShot] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const currentImg = form.image || cameraShot;
    if (currentImg) {
      setIsAnalyzing(true);
      assessCropQuality(form.cropName, currentImg)
        .then((res) => {
          setAiResult(res);
          if (res?.grade) {
            setForm((prev) => ({ ...prev, grade: res.grade }));
          }
        })
        .catch((err) => console.warn('AI quality assessment error:', err))
        .finally(() => setIsAnalyzing(false));
    } else {
      setAiResult(null);
    }
  }, [form.image, cameraShot, form.cropName]);

  useEffect(() => {
    setForm(editingListing ? {
      cropName: editingListing.cropName || '',
      quantity: String(editingListing.quantity ?? ''),
      price: String(editingListing.price ?? ''),
      location: editingListing.location || '',
      harvestDate: editingListing.harvestDate || '',
      availableFrom: editingListing.availableFrom || '',
      image: editingListing.image || '',
    } : emptyForm);
    setError('');
  }, [editingListingId, listings]);

  useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
    setCameraShot('');
  };

  const openCamera = async () => {
    setCameraMessage('');
    setCameraShot('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraMessage(tr('cameraUnavailable'));
      return;
    }

    try {
      setCameraOpen(true);
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => console.warn('Video play error:', err));
      }
    } catch (error) {
      console.error('Camera error:', error);
      setCameraOpen(false);
      setCameraMessage(tr('cameraAccessDenied'));
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCameraShot(dataUrl);
  };

  const applyCapturedPhoto = () => {
    if (!cameraShot) return;
    setForm((prev) => ({ ...prev, image: cameraShot }));
    stopCamera();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, image: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const requiredKeys = ['cropName', 'quantity', 'price', 'location', 'harvestDate', 'availableFrom'];

    for (const key of requiredKeys) {
      if (!String(form[key] || '').trim()) {
        return tr('validationRequired');
      }
    }

    if (Number(form.quantity) <= 0 || Number(form.price) <= 0) {
      return tr('validationNumbers');
    }

    if (!form.image) {
      return tr('validationImage');
    }

    return '';
  };

  const assessment = getAssessmentForCrop(form.cropName || 'Tomato');
  const imagePreview = form.image || cameraShot;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    let finalImageUrl = form.image;

    try {
      if (form.image && (form.image.startsWith('data:') || form.image.startsWith('blob:')) && isSupabaseConfigured) {
        const uploadRes = await uploadCropImage(form.image);
        if (uploadRes.url) {
          finalImageUrl = uploadRes.url;
        }
      }
    } catch (err) {
      console.warn('Image upload issue:', err);
    } finally {
      setUploading(false);
    }

    const payload = {
      id: editingListing?.id || `listing-${Date.now()}`,
      cropName: form.cropName.trim(),
      quantity: Number(form.quantity),
      price: Number(form.price),
      grade: aiResult?.grade || form.grade || resolveGrade(form.cropName),
      location: form.location.trim(),
      status: editingListing?.status || 'Active',
      availability: form.availableFrom.trim() || 'Available now',
      harvestDate: form.harvestDate,
      availableFrom: form.availableFrom.trim(),
      image: finalImageUrl,
    };

    if (isSupabaseConfigured) {
      saveListingToSupabase(payload).catch((e) => console.warn('Supabase DB save error:', e));
    }

    setListings((current) => {
      if (editingListing) {
        return current.map((item) => (item.id === editingListing.id ? { ...item, ...payload } : item));
      }
      return [payload, ...current];
    });

    if (editingListing) {
      setEditingListingId(null);
      note(tr('listingUpdated'));
    } else {
      note(tr('listingSaved'));
    }

    go('listings');
  };

  return (
    <>
      <Title tag={tr('farmerPortal')} title={editingListing ? tr('editListingTitle') : tr('listProduceTitle')} copy={editingListing ? tr('editListingCopy') : tr('listProduceCopy')} />

      <form className="form-layout" onSubmit={handleSubmit}>
        <article className="panel-card form-panel">
          <div className="section-head">
            <h3>{tr('produceDetails')}</h3>
          </div>
          <div className="form-grid two-col">
            <Field label={tr('cropName')} value={form.cropName} name="cropName" placeholder="e.g. Tomato" onChange={handleChange} required />
            <Field label={tr('quantityKg')} value={form.quantity} name="quantity" type="number" placeholder="e.g. 100" onChange={handleChange} required />
            <Field label={tr('expectedPrice')} value={form.price} name="price" type="number" placeholder="e.g. 25" onChange={handleChange} required />
            <label className="field">
              {tr('location')}
              <LocationPicker
                value={form.location}
                onChange={(val) => setForm((prev) => ({ ...prev, location: val }))}
                placeholder="Set farm/pickup location…"
              />
            </label>
            <Field label={tr('harvestDate')} value={form.harvestDate} name="harvestDate" type="date" onChange={handleChange} required />
            <Field label={tr('availableFrom')} value={form.availableFrom} name="availableFrom" type="date" onChange={handleChange} required />
          </div>

          {error && <div className="message error">{error}</div>}

          <div className="form-actions-inline">
            <B type="submit" disabled={uploading}>{uploading ? '...' : editingListing ? tr('saveChanges') : tr('save')}</B>
            <B alt onClick={() => { setEditingListingId(null); go('listings'); }} type="button" disabled={uploading}>{tr('cancel')}</B>
          </div>
        </article>

        <article className="panel-card image-panel">
          <div className="section-head">
            <h3>{tr('cropImage')}</h3>
          </div>

          <div className="image-action-row">
            <label className="image-picker">
              <input type="file" accept="image/*" onChange={handleFileChange} />
              {tr('uploadImage')}
            </label>
            <button type="button" className="image-picker secondary" onClick={openCamera}>{tr('takePhoto')}</button>
          </div>

          {cameraMessage && <div className="message warning">{cameraMessage}</div>}

          {imagePreview ? (
            <div className="image-preview-wrap">
              <img className="preview-image" src={imagePreview} alt="Selected crop" />
              <div className="image-preview-actions">
                <label className="mini-action upload">
                  <input type="file" accept="image/*" onChange={handleFileChange} />
                  {tr('replace')}
                </label>
                <button type="button" className="mini-action danger" onClick={() => setForm((prev) => ({ ...prev, image: '' }))}>{tr('remove')}</button>
              </div>
            </div>
          ) : (
            <div className="empty-photo-box">
              <span>📷</span>
              <strong>{tr('uploadImage')}</strong>
              <small>{tr('uploadImageHint')}</small>
            </div>
          )}
        </article>
      </form>

      {imagePreview && (
        <article className="panel-card ai-panel">
          <div className="section-head">
            <h3>{tr('aiAssessment')}</h3>
          </div>
          <div className="assessment-layout">
            <div style={{ position: 'relative' }}>
              <img src={imagePreview} alt={form.cropName || 'Crop'} className="assessment-image" />
              {isAnalyzing && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(27, 56, 43, 0.75)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '14px',
                  color: '#fff',
                  textAlign: 'center',
                  padding: '16px',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '24px', animation: 'spin 1.5s linear infinite' }}>✨</div>
                  <strong style={{ fontSize: '15px' }}>AI Inspecting Produce Quality...</strong>
                  <small style={{ opacity: 0.9, fontSize: '12px' }}>Analyzing skin, color uniformity & freshness</small>
                </div>
              )}
            </div>
            <div className="assessment-copy">
              <p className="tag">
                {aiResult?.isAiGenerated ? '✨ Gemini Vision AI' : tr('aiPrototypeResult')}
              </p>
              <h3>{form.cropName || tr('crop')}</h3>
              <div className="score-summary">
                <div>
                  <span>{tr('cropDetected')}</span>
                  <strong>{form.cropName || 'Crop'}</strong>
                </div>
                <div>
                  <span>{tr('qualityGrade')}</span>
                  <strong style={{ color: aiResult?.grade === 'Grade A' ? '#1b5e20' : aiResult?.grade === 'Grade B' ? '#e65100' : '#c62828' }}>
                    {aiResult?.grade || resolveGrade(form.cropName)}
                  </strong>
                </div>
                <div>
                  <span>{tr('confidence')}</span>
                  <strong>{aiResult ? `${aiResult.score}%` : '90%'}</strong>
                </div>
              </div>

              {aiResult?.defects && aiResult.defects.length > 0 && (
                <div className="assessment-checklist">
                  <h4>{tr('visualAssessment')}</h4>
                  <ul>
                    {aiResult.defects.map((item) => (
                      <li key={item}>✓ {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="recommendation-box">
                <span>{tr('recommendation')}</span>
                <strong>{aiResult?.summary || (assessment.recommendation)}</strong>
              </div>

              <small className="prototype-note">
                {aiResult?.isAiGenerated
                  ? '✓ Verified with Google Gemini Vision Computer Vision inspection.'
                  : tr('prototypeDisclaimer')}
              </small>
            </div>
          </div>
        </article>
      )}

      {cameraOpen && (
        <div
          className="camera-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) stopCamera();
          }}
        >
          <div className="camera-panel-wrapper">
            <button
              type="button"
              className="camera-close-btn"
              onClick={stopCamera}
              aria-label="Close camera"
              title="Close camera"
            >
              ✕
            </button>
            <div className="camera-panel">
              {!cameraShot ? (
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                />
              ) : (
                <img src={cameraShot} alt="Captured preview" />
              )}
              {!cameraShot ? (
                <div className="camera-actions">
                  <button type="button" className="btn alt" onClick={stopCamera}>{tr('cancel')}</button>
                  <button type="button" className="btn" onClick={capturePhoto}>{tr('capture')}</button>
                </div>
              ) : (
                <div className="camera-actions">
                  <button type="button" className="btn alt" onClick={() => setCameraShot('')}>{tr('retake')}</button>
                  <button type="button" className="btn" onClick={applyCapturedPhoto}>{tr('usePhoto')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ListingsPage({ listings, setListings, setPage, setEditingListingId, tr, note }) {
  const [filter, setFilter] = useState('All');
  const [selectedId, setSelectedId] = useState(null);

  const safeListings = Array.isArray(listings) ? listings : [];
  const filtered = filter === 'All' ? safeListings : safeListings.filter((item) => item?.status === filter);
  const selected = safeListings.find((item) => item?.id === selectedId) || null;

  const handleDelete = (id) => {
    setListings((current) => current.filter((item) => item.id !== id));
    if (isSupabaseConfigured) {
      deleteListingFromSupabase(id).catch((e) => console.warn('Supabase DB delete error:', e));
    }
    note(tr('listingDeleted'));
  };

  return (
    <>
      <Title tag={tr('farmerPortal')} title={tr('myListings')} copy={tr('myListingsCopy')} />

      <div className="panel-card filter-panel">
        <div className="filter-row">
          {['All', 'Active', 'Sold', 'Pending'].map((option) => (
            <button key={option} type="button" className={filter === option ? 'filter-btn active' : 'filter-btn'} onClick={() => setFilter(option)}>
              {tr(option.toLowerCase()) || option}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel-card empty-state">
          <h3>{tr('noListings')}</h3>
          <p>{tr('emptyListingHint')}</p>
          <B onClick={() => setPage('listing')}>{tr('listProduce')}</B>
        </div>
      ) : (
        <div className="listing-grid">
          {filtered.map((item) => (
            <article key={item.id} className="listing-card">
              <img src={item.image} alt={item.cropName} className="listing-image" />
              <div className="listing-body">
                <div className="listing-header">
                  <div>
                    <h3>{tr.crop(item.cropName)}</h3>
                    <small>{item.grade}</small>
                  </div>
                  <span className={`status-badge ${String(item.status).toLowerCase()}`}>{tr(String(item.status).toLowerCase()) || item.status}</span>
                </div>

                <ul className="meta-list">
                  <li>{tr.quantity(item.quantity)}</li>
                  <li>{tr.price(item.price)}</li>
                  <li>{item.location}</li>
                </ul>

                <p className="availability">{item.availability}</p>

                <div className="card-actions">
                  <button type="button" className="mini-link" onClick={() => setSelectedId(item.id)}>{tr('view')}</button>
                  <button type="button" className="mini-link" onClick={() => { setEditingListingId(item.id); setPage('listing'); }}>{tr('edit')}</button>
                  <button type="button" className="mini-link danger" onClick={() => handleDelete(item.id)}>{tr('delete')}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <article className="panel-card detail-panel">
          <div className="section-head">
            <h3>{tr.crop(selected.cropName)}</h3>
          </div>
          <div className="detail-grid">
            <img src={selected.image} alt={selected.cropName} className="detail-image" />
            <div>
              <p><strong>{tr('quantity')}:</strong> {tr.quantity(selected.quantity)}</p>
              <p><strong>{tr('expectedPrice')}:</strong> {tr.price(selected.price)}</p>
              <p><strong>{tr('grade')}:</strong> {selected.grade}</p>
              <p><strong>{tr('location')}:</strong> {selected.location}</p>
              <p><strong>{tr('status')}:</strong> {selected.status}</p>
            </div>
          </div>
        </article>
      )}
    </>
  );
}

function FarmerOrders({ tr }) {
  const orders = DEMO_ORDERS;

  return (
    <>
      <Title tag={tr('farmerPortal')} title={tr('farmerOrdersTitle')} copy={tr('farmerOrdersCopy')} />

      <div className="orders-list">
        {orders.map((order) => {
          const statusKey = order.status === 'Pickup Scheduled' ? 'pickupScheduled' : order.status === 'Pending Confirmation' ? 'pendingConfirmation' : 'completed';
          return (
            <article key={order.id} className="panel-card order-card">
              <div className="order-header">
                <div>
                  <p className="tag">{tr('orderNumber')} {order.id}</p>
                  <h3>{tr.crop(order.crop)}</h3>
                </div>
                <span className={`status-badge ${String(order.status).toLowerCase().replace(/\s+/g, '-')}`}>{tr(statusKey)}</span>
              </div>

              <div className="order-body">
                <p><strong>{tr('buyer')}:</strong> {tr.person(order.buyer)}</p>
                <p><strong>{tr('quantity')}:</strong> {tr.quantity(order.quantity)}</p>
                <p><strong>{tr('price')}:</strong> {tr.price(order.price)}</p>
                <p><strong>{tr('total')}:</strong> ₹{order.total}</p>
                <p><strong>{tr('status')}:</strong> {tr(statusKey)}</p>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function MandiPage({ tr }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [source, setSource] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [state, setState] = useState('Uttar Pradesh');
  const [market, setMarket] = useState('All');
  const [commodity, setCommodity] = useState('All');
  const [search, setSearch] = useState('');
  const [unit, setUnit] = useState('kg'); // 'kg' or 'quintal'

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchLiveMandiPrices({
        state: state === 'All' ? '' : state,
        market: market === 'All' ? '' : market,
        commodity: commodity === 'All' ? '' : commodity,
      });
      setRecords(res.records || []);
      setIsLive(res.isLive || false);
      setSource(res.source || 'Agmarknet Feed');
      setLastUpdated(res.lastUpdated || new Date().toLocaleTimeString());
    } catch (err) {
      console.warn('Mandi load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state, market, commodity]);

  const filteredRecords = records.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.commodity || '').toLowerCase().includes(q) ||
      (r.market || '').toLowerCase().includes(q) ||
      (r.district || '').toLowerCase().includes(q) ||
      (r.state || '').toLowerCase().includes(q)
    );
  });

  const avgModal = filteredRecords.length
    ? Math.round(
        filteredRecords.reduce(
          (acc, r) => acc + (unit === 'kg' ? (r.modal_per_kg || Math.round(r.modal_price / 100)) : r.modal_price),
          0
        ) / filteredRecords.length
      )
    : 0;

  return (
    <>
      <Title
        tag="Agmarknet · data.gov.in"
        title="Live Mandi Commodity Prices"
        copy="Official wholesale market prices from Government of India Agmarknet open data portal."
      />

      <div className="mandi-status-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className={`mandi-source-badge ${isLive ? 'live' : 'snapshot'}`}>
            <span className={`mandi-pulse-dot ${isLive ? '' : 'gold'}`} />
            {isLive ? '🟢 data.gov.in Live Agmarknet Feed' : '🟡 Agmarknet Daily Verified Feed'}
          </span>
          <small style={{ color: 'var(--muted)', fontSize: 12 }}>
            Last Synced: <strong>{lastUpdated || 'Just now'}</strong>
          </small>
        </div>
        <button
          type="button"
          className="btn alt"
          onClick={loadData}
          disabled={loading}
          style={{ padding: '8px 16px', fontSize: '13px' }}
        >
          {loading ? 'Refreshing…' : '🔄 Refresh Live Rates'}
        </button>
      </div>

      <div className="mandi-stats-row">
        <div className="mandi-stat-box">
          <small>Tracked Commodities</small>
          <b>{filteredRecords.length} Items</b>
          <span>{state} Mandis</span>
        </div>
        <div className="mandi-stat-box">
          <small>Avg Modal Rate</small>
          <b>₹{avgModal} {unit === 'kg' ? '/ kg' : '/ Qtl'}</b>
          <span>Wholesale Mandi Average</span>
        </div>
        <div className="mandi-stat-box">
          <small>Active Region</small>
          <b>{market === 'All' ? state : `${market}, ${state}`}</b>
          <span>Agmarknet Verified</span>
        </div>
      </div>

      <article className="panel-card mandi-filter-panel">
        <div className="mandi-controls-bar">
          <div className="mandi-unit-toggle">
            <button
              type="button"
              className={`mandi-unit-btn ${unit === 'kg' ? 'active' : ''}`}
              onClick={() => setUnit('kg')}
            >
              ₹ / kg (Retail/Farm)
            </button>
            <button
              type="button"
              className={`mandi-unit-btn ${unit === 'quintal' ? 'active' : ''}`}
              onClick={() => setUnit('quintal')}
            >
              ₹ / Quintal (Mandi)
            </button>
          </div>
          <input
            type="text"
            className="search-input"
            placeholder="Search crop or mandi (e.g. Tomato, Barabanki)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              maxWidth: 320,
              padding: '8px 14px',
              borderRadius: 10,
              border: '1.5px solid var(--border)',
              fontSize: 13,
            }}
          />
        </div>

        <div className="mandi-filter-grid">
          <label className="field">
            State
            <select value={state} onChange={(e) => { setState(e.target.value); setMarket('All'); }}>
              <option value="Uttar Pradesh">Uttar Pradesh</option>
              <option value="Punjab">Punjab</option>
              <option value="Madhya Pradesh">Madhya Pradesh</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="All">All States</option>
            </select>
          </label>
          <label className="field">
            Mandi / Market
            <select value={market} onChange={(e) => setMarket(e.target.value)}>
              <option value="All">All Mandis</option>
              <option value="Barabanki">Barabanki Mandi</option>
              <option value="Lucknow">Lucknow Mandi</option>
              <option value="Kanpur">Kanpur Mandi</option>
              <option value="Ludhiana">Ludhiana Mandi</option>
              <option value="Indore">Indore Mandi</option>
              <option value="Lasalgaon">Lasalgaon Mandi</option>
            </select>
          </label>
          <label className="field">
            Commodity
            <select value={commodity} onChange={(e) => setCommodity(e.target.value)}>
              <option value="All">All Commodities</option>
              <option value="Tomato">Tomato (टमाटर)</option>
              <option value="Wheat">Wheat (गेहूं)</option>
              <option value="Potato">Potato (आलू)</option>
              <option value="Onion">Onion (प्याज)</option>
              <option value="Mustard">Mustard (सरसों)</option>
              <option value="Paddy(Dhan)">Paddy / Rice (धान)</option>
              <option value="Soyabean">Soyabean (सोयाबीन)</option>
              <option value="Green Chilli">Green Chilli (हरी मिर्च)</option>
            </select>
          </label>
        </div>
      </article>

      <article className="panel-card table-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>Connecting to data.gov.in Agmarknet feed…</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>No mandi records found</p>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Try changing the filters above or clearing the search.</p>
          </div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Commodity</th>
                  <th>Mandi / District</th>
                  <th>Arrival Date</th>
                  <th>Min Price</th>
                  <th>Modal Price</th>
                  <th>Max Price</th>
                  <th>24h Trend</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((item, idx) => (
                  <tr key={`${item.commodity}-${item.market}-${idx}`}>
                    <td>
                      <strong>{tr.crop(item.commodity)}</strong>
                      <br />
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>{item.variety}</small>
                    </td>
                    <td>
                      <span>{item.market}</span>
                      <br />
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>{item.state}</small>
                    </td>
                    <td>{item.arrival_date}</td>
                    <td>
                      {unit === 'kg' ? `₹${item.min_per_kg || Math.round(item.min_price / 100)}/kg` : `₹${item.min_price}/Qtl`}
                    </td>
                    <td>
                      <span className="mandi-modal-badge">
                        {unit === 'kg' ? `₹${item.modal_per_kg || Math.round(item.modal_price / 100)} / kg` : `₹${item.modal_price} / Qtl`}
                      </span>
                    </td>
                    <td>
                      {unit === 'kg' ? `₹${item.max_per_kg || Math.round(item.max_price / 100)}/kg` : `₹${item.max_price}/Qtl`}
                    </td>
                    <td>
                      <span
                        className={`mandi-trend-tag ${
                          item.trend?.startsWith('+')
                            ? 'positive'
                            : item.trend?.startsWith('-')
                            ? 'negative'
                            : 'neutral'
                        }`}
                      >
                        {item.trend || 'Stable'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="notice" style={{ marginTop: 14 }}>
          📡 Data Source: Ministry of Agriculture & Farmers Welfare via <strong>data.gov.in (Agmarknet)</strong>.
        </p>
      </article>
    </>
  );
}

function ProfilePage({ profile, setProfile, tr }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const isBuyer = profile?.accountType === 'Buyer' || !!profile?.org;

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const saveProfile = () => {
    setProfile(draft);
    setEditing(false);
  };

  return (
    <>
      <Title tag={tr('profile')} title={tr('profileTitle')} copy={tr('profileCopy')} />

      <article className="panel-card profile-card">
        {!editing ? (
          <>
            {isBuyer && <p><strong>Organisation:</strong> {profile.org || 'ABC Foods Pvt. Ltd.'}</p>}
            <p><strong>{isBuyer ? 'Contact Person' : tr('name')}:</strong> {profile.name}</p>
            <p><strong>{tr('mobile')}:</strong> {profile.mobile}</p>
            <p><strong>{tr('location')}:</strong> {profile.location}</p>
            <p><strong>{tr('accountType')}:</strong> {profile.accountType || (isBuyer ? 'Buyer' : 'Farmer')}</p>
            <div className="form-actions-inline">
              <B onClick={() => { setDraft(profile); setEditing(true); }}>{tr('edit')}</B>
            </div>
          </>
        ) : (
          <>
            <div className="form-grid two-col">
              {isBuyer && (
                <Field
                  label="Organisation"
                  value={draft.org || ''}
                  name="org"
                  placeholder="e.g. ABC Foods Pvt. Ltd."
                  onChange={(e) => setDraft({ ...draft, org: e.target.value })}
                />
              )}
              <Field
                label={isBuyer ? 'Contact Person' : tr('name')}
                value={draft.name}
                name="name"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <Field
                label={tr('mobile')}
                value={draft.mobile}
                name="mobile"
                onChange={(e) => setDraft({ ...draft, mobile: e.target.value })}
              />
              <label className="field">
                {tr('location')}
                <LocationPicker
                  value={draft.location}
                  onChange={(val) => setDraft({ ...draft, location: val })}
                  placeholder="Set your address on map…"
                />
              </label>
              <Field
                label={tr('accountType')}
                value={draft.accountType}
                name="accountType"
                onChange={(e) => setDraft({ ...draft, accountType: e.target.value })}
              />
            </div>
            <div className="form-actions-inline">
              <B onClick={saveProfile}>{tr('save')}</B>
              <B alt onClick={() => setEditing(false)}>{tr('cancel')}</B>
            </div>
          </>
        )}
      </article>
    </>
  );
}

function Requirement({ go, tr }) {
  const [reqForm, setReqForm] = useState({
    crop: 'Tomato',
    quantity: '300',
    quality: 'Grade A',
    price: '28',
    location: 'Lucknow, Uttar Pradesh',
    date: '2026-09-08'
  });

  return (
    <>
      <Title tag={tr('buyerPortal')} title={tr('createRequirement')} copy={tr('requirementCopy')} />
      <article className="panel-card">
        <div className="form-grid two-col">
          <Field label={tr('productCrop')} value={tr.crop(reqForm.crop)} name="crop" onChange={(e) => setReqForm({ ...reqForm, crop: e.target.value })} />
          <Field label={tr('requiredQuantity')} value={tr.quantity(reqForm.quantity)} name="quantity" onChange={(e) => setReqForm({ ...reqForm, quantity: e.target.value })} />
          <Field label={tr('preferredQuality')} value={reqForm.quality} name="quality" onChange={(e) => setReqForm({ ...reqForm, quality: e.target.value })} />
          <Field label={tr('maximumPrice')} value={`₹${reqForm.price} / kg`} name="price" onChange={(e) => setReqForm({ ...reqForm, price: e.target.value })} />
          <label className="field">
            {tr('deliveryLocation')}
            <LocationPicker
              value={reqForm.location}
              onChange={(val) => setReqForm({ ...reqForm, location: val })}
              placeholder="Set delivery location on map…"
            />
          </label>
          <Field label={tr('requiredBy')} value={reqForm.date} name="date" type="date" onChange={(e) => setReqForm({ ...reqForm, date: e.target.value })} />
        </div>
        <div className="form-actions-inline">
          <B onClick={() => go('matches')}>{tr('findSuitableFarmers')}</B>
        </div>
      </article>
    </>
  );
}

function Matches({ go, tr, chooseFarmer }) {
  const requiredQuantity = 300;
  const matchingFarmers = F.filter((farmer) => farmer[2] >= requiredQuantity);
  return (
    <>
      <Title tag={tr('matches')} title={tr('requirementFulfilled')} copy={`${tr.quantity(requiredQuantity)} · Grade A · ${tr.crop('Tomato')} · ${tr.location('Lucknow')}`} />
      <div className="list-stack">
        {matchingFarmers.map((farmer) => (
          <button className="panel-card row-card farmer-choice" key={farmer[0]} onClick={() => { chooseFarmer(farmer); go('farmer-listing'); }}>
            <span className="avatar">{farmer[0].split(' ').map((part) => part[0]).join('')}</span>
            <div>
              <h2>{tr.person(farmer[0])}</h2>
              <p>{tr.location(farmer[1])} · {farmer[4]} · {tr('active')}</p>
            </div>
            <b>{tr.quantity(farmer[2])}</b>
            <em>{tr.price(farmer[3])}</em>
          </button>
        ))}
      </div>
      <div className="total-box"><b>Select one farmer to view the complete listing and order details.</b></div>
    </>
  );
}

function BuyerFarmerListing({ farmer, go, tr, placeOrder }) {
  if (!farmer) { go('requirement'); return null; }
  const [name, location, stock, price, grade] = farmer;
  const details = FARMER_DETAILS[name];
  const orderQuantity = 300;
  const subtotal = orderQuantity * price;
  const transport = 750;
  const total = subtotal + transport;
  return <><Title tag={tr('buyerPortal')} title={`${tr.person(name)} · ${tr.crop('Tomato')}`} copy={tr('singleFarmerOrder')} />
    <article className="panel-card buyer-listing-detail"><img className="buyer-listing-image" src={details.image} alt={tr.crop('Tomato')} /><div className="buyer-listing-copy"><p className="tag">{details.category}</p><h2>{tr.crop('Tomato')} · {grade}</h2><p><strong>{tr('farmerLabel')}</strong> {tr.person(name)}</p><p><strong>{tr('phoneLabel')}</strong> {details.phone}</p><p><strong>{tr('addressLabel')}</strong> {tr.location(details.address)}</p><p><strong>{tr('stockLabel')}</strong> {tr.quantity(stock)}</p><p><strong>{tr('price')}:</strong> {tr.price(price)}</p><p><strong>{tr('harvestLabel')}</strong> {tr('freshHarvestReady')}</p></div></article>
    <article className="panel-card bill-card"><h2>{tr('billBreakdown')}</h2><p className="line-item"><span>{tr.crop('Tomato')} · {tr.quantity(orderQuantity)}</span><b>₹{subtotal}</b></p><p className="line-item"><span>{tr('transportEstimate')}</span><b>₹{transport}</b></p><p className="line-item grand"><b>{tr('totalPayable')}</b><b>₹{total}</b></p><div className="form-actions-inline"><B alt onClick={() => go('matches')}>{tr('backToFarmers')}</B><B onClick={() => { placeOrder({ farmer, subtotal, transport, total, quantity:orderQuantity }); go('orders'); }}>{tr('proceedOrder')}</B></div></article></>;
}

function Orders({ go, tr, selectedFarmer, buyerOrder }) {
  const order = buyerOrder;
  if (!order || !selectedFarmer) return <><Title tag={tr('orders')} title={tr('noOrderSelected')} copy={tr('chooseFarmerOrder')} /><B onClick={() => go('requirement')}>{tr('createRequirement')}</B></>;
  const [name, location, stock, price, grade] = selectedFarmer;
  return (
    <>
      <Title tag={tr('orderSummary')} title={`${tr('order')} #KD1024`} copy={`${tr('directOrderWith')} ${tr.person(name)}`} />
      <article className="panel-card">
        <h2>{tr.crop('Tomato')} · {grade}</h2>
        <p className="line-item"><span>{tr.person(name)} · {tr.location(location)}</span><b>{tr.quantity(order.quantity)} · {tr.price(price)}</b></p>
        <p className="line-item"><span>{tr('produceSubtotal')}</span><b>₹{order.subtotal}</b></p>
        <p className="line-item"><span>{tr('transportEstimate')}</span><b>₹{order.transport}</b></p>
        <p className="line-item grand"><b>{tr('total')}</b><b>₹{order.total}</b></p>
        <div className="form-actions-inline">
          <B onClick={() => go('payments')}>{tr('continuePayment')}</B>
        </div>
      </article>
    </>
  );
}

function Transport({ note, tr }) {
  const [form, setForm] = useState({ produce: 'Tomato', quantity: '100', pickup: 'Barabanki, Uttar Pradesh', destination: 'Barabanki Mandi' });
  const [vehicle, setVehicle] = useState('tempo');
  const [confirmed, setConfirmed] = useState(false);
  const vehicles = [
    { id:'tempo', cost:900, icon:'🛺' },
    { id:'truck', cost:1500, icon:'🚚' },
    { id:'tractor', cost:1800, icon:'🚜' },
  ];
  const selected = vehicles.find((item) => item.id === vehicle);
  const serviceFee = selected ? 50 : 0;
  const total = selected ? selected.cost + serviceFee : 0;
  return (
    <>
      <Title tag={tr('vehicleBooking')} title={tr('bookVehicle')} copy={tr('vehicleBookingCopy')} />
      {confirmed ? (
        <article className="panel-card booking-confirmation">
          <span>✓</span>
          <h2>{tr('bookingConfirmed')}</h2>
          <p>{tr(selected.id)} · {tr.crop(form.produce)} · {tr.location(form.pickup)} → {tr.location(form.destination)}</p>
          <p><strong>{tr('bookingTotal')}</strong> ₹{total}</p>
          <p className="copy">{tr('bookingIdCopy')}</p>
        </article>
      ) : (
        <div className="vehicle-booking-layout">
          <article className="panel-card">
            <h2>{tr('produceRoute')}</h2>
            <div className="form-grid two-col">
              <Field label={tr('productCrop')} value={tr.crop(form.produce)} name="produce" onChange={(e) => setForm({ ...form, produce: e.target.value })} />
              <Field label={tr('quantityKg')} value={form.quantity} name="quantity" type="number" onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              <label className="field">
                {tr('pickupLocation')}
                <LocationPicker
                  value={form.pickup}
                  onChange={(val) => setForm((prev) => ({ ...prev, pickup: val }))}
                  placeholder="Set pickup location on map…"
                />
              </label>
              <label className="field">
                {tr('destinationMandi')}
                <LocationPicker
                  value={form.destination}
                  onChange={(val) => setForm((prev) => ({ ...prev, destination: val }))}
                  placeholder="Set destination mandi on map…"
                />
              </label>
            </div>
            <h3 className="vehicle-heading">{tr('selectVehicle')}</h3>
            <div className="vehicle-options">
              {vehicles.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setVehicle(item.id)}
                  className={vehicle === item.id ? 'vehicle-option selected' : 'vehicle-option'}
                >
                  <span>{item.icon}</span>
                  <strong>{tr(item.id)}</strong>
                  <small>{tr(item.id + 'Capacity')}</small>
                  <b>₹{item.cost}</b>
                </button>
              ))}
            </div>
          </article>
          <article className="panel-card booking-summary">
            <h2>{tr('bookingSummary')}</h2>
            {selected ? (
              <>
                <p className="line-item"><span>{tr(selected.id)}</span><b>₹{selected.cost}</b></p>
                <p className="line-item"><span>{tr('serviceFee')}</span><b>₹{serviceFee}</b></p>
                <p className="line-item grand"><b>{tr('total')}</b><b>₹{total}</b></p>
                <p className="copy">{tr.crop(form.produce)} · {tr.quantity(form.quantity)}<br/>{tr.location(form.pickup)}<br/>↓ {tr.location(form.destination)}</p>
                <B onClick={() => { setConfirmed(true); note(`✓ ${tr('bookingConfirmed')}`); }}>{tr('proceedBooking')} →</B>
              </>
            ) : (
              <p className="copy">{tr('selectVehicleHint')}</p>
            )}
          </article>
        </div>
      )}
    </>
  );
}

function Payments({ note, tr }) {
  return (
    <>
      <Title tag={tr('paymentSimulation')} title={tr('paymentTitle')} copy={tr('paymentCopy')} />
      <article className="panel-card">
        {[
          [tr('orderTotal'),    '₹7,500'],
          [tr('advancePayment'),'₹2,250'],
          [tr('remaining'),     '₹5,250'],
        ].map((row) => (
          <p className="line-item" key={row[0]}>
            <span>{row[0]}</span>
            <b>{row[1]}</b>
          </p>
        ))}
        <div className="form-actions-inline">
          <B onClick={() => note(`✓ ${tr('advancePayment')} ₹2,250 (simulation)`)}>{tr('payAdvance')}</B>
        </div>
        <small>{tr('prototypeOnly')}</small>
      </article>
    </>
  );
}

function Tracking({ tr }) {
  const stepKeys = ['orderCreated','farmersMatched','advanceReceived','transportConfirmed','pickupInProgress','inTransit','delivered','finalPayment'];

  return (
    <>
      <Title tag={tr('orderTracking')} title="Order #KD1024" copy={`${tr.crop('Tomato')} · ${tr.quantity(300)} · Lucknow`} />
      <article className="panel-card">
        {stepKeys.map((key, index) => (
          <p className="track-line" key={key}>
            <b className={index < 4 ? 'done' : index === 4 ? 'current' : ''}>{index < 4 ? '✓' : index === 4 ? '●' : '○'}</b>
            <span>{tr(key)}<small>{index < 4 ? tr('completed') : index === 4 ? tr('vehicleCollect') : tr('pending2')}</small></span>
          </p>
        ))}
      </article>
    </>
  );
}


export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
