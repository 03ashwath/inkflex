import React from 'react';
import { formatInr, useUsdToInrRate } from '@/lib/currency';

export type ResultsDashboardData = {
  price_prediction: {
    predicted_price_mid: number;
    predicted_price_min: number;
    predicted_price_max: number;
    factors: string[];
  };
  health_assessment: {
    category: string;
    factors: string[];
    explanation: string;
    sources: string[];
  };
  designText?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  skinTone?: string;
  inkColor?: string;
  inkBrand?: string;
  sizeCategory?: string;
  nearby_studios?: Array<{ name: string; distance: string; rating: number; address: string }>;
};

export default function ResultsDashboard({ data }: { data: ResultsDashboardData | null }) {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

  const health: ResultsDashboardData['health_assessment'] = data?.health_assessment || {
    category: "Lower concern",
    factors: ["No major conditions reported"],
    explanation: "Based on the information provided, there are no immediate red flags, but always consult a professional if unsure.",
    sources: []
  };

  const price: ResultsDashboardData['price_prediction'] = data?.price_prediction || {
    predicted_price_mid: 250,
    predicted_price_min: 200,
    predicted_price_max: 300,
    factors: ["Medium size", "Moderate complexity", "Local studio averages"]
  };

  const displayCity = data?.city || "City Center";
  const nearbyStudios = data?.nearby_studios || [
    { name: "Ink Master Studio", distance: "0.8 miles", rating: 4.8, address: `123 Main St, ${displayCity}` },
    { name: "Neon Rose Tattoos", distance: "1.2 miles", rating: 4.6, address: `45 Art District Blvd, ${displayCity}` },
    { name: "Sacred Geometry Ink", distance: "2.5 miles", rating: 4.9, address: `789 West Ave, ${displayCity}` }
  ];

  const [generatedDesigns, setGeneratedDesigns] = React.useState<Array<{ id: number; url: string; title: string }>>([]);
  const [imageError, setImageError] = React.useState('');

  React.useEffect(() => {
    let isMounted = true;
    const fetchImages = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/images/random`);
        const result = await response.json() as { images?: unknown; detail?: string };
        if (!response.ok) {
          throw new Error(result.detail || `Image request failed with status ${response.status}.`);
        }
        if (!Array.isArray(result.images) || result.images.length !== 6 || !result.images.every((url): url is string => typeof url === 'string')) {
          throw new Error('The local image dataset did not return six valid images.');
        }
        if (isMounted) {
          setGeneratedDesigns(result.images.map((url, i) => ({
            id: i + 1,
            url,
            title: `Inspiration ${i + 1}`
          })));
        }
      } catch (err) {
        console.error("Failed to load local tattoo images", err);
        if (isMounted) setImageError('Local tattoo reference images are currently unavailable.');
      }
    };
    fetchImages();
    return () => { isMounted = false; };
  }, [API_BASE_URL]);

  const [selectedDesign, setSelectedDesign] = React.useState<number | null>(null);
  const [viewedImage, setViewedImage] = React.useState<string | null>(null);
  const inkSwatchColor = typeof data?.inkColor === 'string'
    ? (data.inkColor.startsWith('#')
        ? data.inkColor
        : data.inkColor === 'Black'
          ? 'black'
          : data.inkColor === 'Red'
            ? 'red'
            : data.inkColor === 'Blue'
              ? 'blue'
              : 'currentColor')
    : 'currentColor';

  const { rate: usdToInrRate, isLoaded: isExchangeRateLoaded, hasError: exchangeRateFailed } = useUsdToInrRate();
  const formatPrice = (val: number) => formatInr(val, usdToInrRate);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 text-left">
      
      {/* Generated Designs Section */}
      <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-2xl font-bold text-slate-200 mb-2 flex items-center">
          <span className="bg-purple-500/20 text-purple-400 p-2 rounded-lg mr-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          </span>
          Tattoo Image Inspirations
        </h3>
        <p className="text-slate-400 mb-6">Here are six random reference images from the local dataset. Click one to select it.</p>
        {imageError && <p role="status" className="mb-4 text-sm text-amber-300">{imageError}</p>}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {generatedDesigns.map((design) => (
            <div
              key={design.id}
              className={`relative group rounded-xl overflow-hidden border-2 transition-all duration-300 ${selectedDesign === design.id ? 'border-purple-500 scale-105 shadow-lg shadow-purple-900/50' : 'border-transparent hover:border-slate-500'}`}
            >
              <img
                src={design.url}
                alt={design.title}
                className="w-full h-48 object-cover cursor-pointer"
                onClick={() => setSelectedDesign(design.id)}
                onError={() => setImageError('A local dataset image could not be loaded.')}
              />

              <button
                onClick={(e) => { e.stopPropagation(); setViewedImage(design.url); }}
                className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                title="View Full Size"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
              </button>

              <div
                className={`p-2 text-center text-sm font-bold cursor-pointer ${selectedDesign === design.id ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                onClick={() => setSelectedDesign(design.id)}
              >
                {selectedDesign === design.id ? 'Selected' : design.title}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Price Prediction Card */}
      <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <svg className="w-32 h-32 text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        </div>
        <h3 className="text-2xl font-bold text-slate-200 mb-6 flex items-center">
          <span className="bg-green-500/20 text-green-400 p-2 rounded-lg mr-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </span>
          Estimated Price Range
        </h3>
        <div className="text-center py-6">
          <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 mb-2">
            {formatPrice(price.predicted_price_min)} - {formatPrice(price.predicted_price_max)}
          </div>
          <p className="text-slate-400">Estimated Average: <span className="text-slate-200 font-bold">{formatPrice(price.predicted_price_mid)}</span></p>
          {(exchangeRateFailed || !isExchangeRateLoaded) && (
            <p role="status" className="mt-2 text-xs text-amber-300">
              {exchangeRateFailed
                ? 'Approximate INR conversion is being used.'
                : 'Loading the latest INR exchange rate.'}
            </p>
          )}
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 mt-4">
          <h4 className="text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Key Pricing Factors</h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {price.factors.map((factor: string, i: number) => (
              <li key={i} className="flex items-center text-slate-400 text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                {factor}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Health Assessment Card */}
      <section className={`border rounded-2xl p-6 relative overflow-hidden ${
        health.category === 'Medical consultation recommended' ? 'bg-red-950/20 border-red-900/50' :
        health.category === 'Caution' ? 'bg-yellow-950/20 border-yellow-900/50' :
        'bg-blue-950/20 border-blue-900/50'
      }`}>
        <h3 className="text-2xl font-bold text-slate-200 mb-4 flex items-center">
           <span className={`p-2 rounded-lg mr-3 ${
             health.category === 'Medical consultation recommended' ? 'bg-red-500/20 text-red-400' :
             health.category === 'Caution' ? 'bg-yellow-500/20 text-yellow-400' :
             'bg-blue-500/20 text-blue-400'
           }`}>
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
           </span>
           Health Screening: {health.category}
        </h3>
        
        <p className="text-slate-300 leading-relaxed mb-6">
          {health.explanation}
        </p>

        {health.factors.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Identified Factors / Reasons</h4>
            <div className="flex flex-wrap gap-2">
              {health.factors.map((factor: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-full text-sm">
                  {factor}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 p-4 bg-slate-900/80 rounded-xl border border-slate-800">
           <p className="text-xs text-slate-500 italic">
             Disclaimer: This AI-generated assessment is for informational purposes only and is not medical advice. Consult a qualified healthcare professional before getting a tattoo if you have a medical condition. Your health data is entirely private and is not stored or logged on our servers.
           </p>
        </div>
      </section>

      {/* Placeholders for remaining modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-slate-200 mb-2">Ink Recommendations</h3>
          <p className="text-slate-400 text-sm">Based on your {data?.skinTone ? `"${data.skinTone}" skin tone` : 'skin tone'}, our AI suggests contrasting colors to maximize longevity and vibrancy.</p>
          <div className="mt-4 p-4 border border-slate-700 rounded-xl bg-slate-800/50 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-slate-300 font-medium">Selected Base Color:</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full border border-slate-600 shadow-sm"
                  style={{ backgroundColor: inkSwatchColor }}
                ></div>
                <span className="text-slate-200">{data?.inkColor === 'No Preference' ? 'Artist Recommended Color' : (data?.inkColor || 'Artist Recommended Color')}</span>
              </div>
            </div>
            <p className="text-slate-400 text-sm italic">
              {data?.inkColor === 'Black' || data?.inkColor === 'Grey' ? "Excellent choice for longevity. Black and grey inks hold up best over time and work universally across all skin tones." : 
               data?.inkColor === 'No Preference' ? "Our artist will help you select the optimal color palette during consultation based on your exact design." :
               "Color tattoos require slightly more maintenance. Sunscreen will be vital to prevent this pigment from fading."}
            </p>
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-slate-200 mb-2">Tattoo Meaning</h3>
          <p className="text-slate-400 text-sm">Cultural context and symbolic interpretations of your chosen design elements.</p>
          <div className="mt-4 p-4 border border-slate-700 rounded-xl bg-slate-800/50">
            {data?.designText ? (
              <div className="text-slate-300 space-y-2 text-sm">
                <p><strong>Design:</strong> &quot;{data.designText as string}&quot;</p>
                <p>AI Analysis of your concept suggests these common themes:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Personal expression and unique storytelling based on your specific keywords.</li>
                  <li>Aesthetic focus on form and flow for the selected placement.</li>
                </ul>
              </div>
            ) : (
              <ul className="list-disc list-inside text-slate-300 space-y-2 text-sm">
                <li>Represents resilience and personal growth.</li>
                <li>Connected to traditional themes of transformation.</li>
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Ink Pricing Section */}
      <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-2xl font-bold text-slate-200 mb-6 flex items-center">
          <span className="bg-pink-500/20 text-pink-400 p-2 rounded-lg mr-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path></svg>
          </span>
          Premium Ink Bottle Pricing (For Artists & Studios)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
            <h4 className="text-lg font-bold text-slate-200 mb-1">Eternal Ink</h4>
            <p className="text-slate-400 text-sm">0.5 oz from ₹450. 1 oz/30ml standard color or black bottles range from ₹500 to ₹999 (e.g., Crimson Red or White).</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
            <h4 className="text-lg font-bold text-slate-200 mb-1">Dynamic Color</h4>
            <p className="text-slate-400 text-sm">Standard 1 oz black and color bottles (like Triple Black or Fire Red) generally cost between ₹571 and ₹799.</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
            <h4 className="text-lg font-bold text-slate-200 mb-1">Intenze Tattoo Ink</h4>
            <p className="text-slate-400 text-sm">Individual 1 oz bottles (such as True Black, Zuper Black, or Teal) range from ₹476 to ₹999.</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
            <h4 className="text-lg font-bold text-slate-200 mb-1">Kuro Sumi</h4>
            <p className="text-slate-400 text-sm">Individual lining and shading 1 oz/legacy bottles start around ₹1,500 to ₹1,800 when in stock.</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
            <h4 className="text-lg font-bold text-slate-200 mb-1">Xtreme Ink</h4>
            <p className="text-slate-400 text-sm">Individual 1 oz (30ml) options like Black Magic retail around ₹595 to ₹1,299 depending on discounts and specific pigment types.</p>
          </div>
        </div>
      </section>

      {/* Nearby Studios Section */}
      <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-2xl font-bold text-slate-200 mb-6 flex items-center">
          <span className="bg-blue-500/20 text-blue-400 p-2 rounded-lg mr-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          </span>
          Nearby Tattoo Studios Map
        </h3>
        
        <div className="w-full h-[400px] rounded-xl overflow-hidden border border-slate-700">
          <iframe 
            width="100%" 
            height="100%" 
            frameBorder="0" 
            style={{ border: 0 }} 
            src={`https://maps.google.com/maps?q=${encodeURIComponent('tattoo studios in ' + (data?.city || '') + ' ' + (data?.country || ''))}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
            allowFullScreen
          ></iframe>
        </div>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {nearbyStudios.map((studio, i: number) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col">
              <h4 className="text-lg font-bold text-slate-200">{studio.name}</h4>
              <p className="text-slate-400 text-sm mb-3">{studio.address}</p>
              <div className="flex items-center mt-auto">
                <span className="text-yellow-400 font-bold">★ {studio.rating}</span>
                <span className="text-slate-500 ml-auto text-sm">{studio.distance}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Full Size Image Modal */}
      {viewedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setViewedImage(null)}>
          <div className="relative max-w-4xl w-full max-h-screen flex items-center justify-center">
            <button 
              className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 p-2 rounded-full"
              onClick={() => setViewedImage(null)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <img src={viewedImage} alt="Full Size" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}

    </div>
  );
}
